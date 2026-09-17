import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable CORS for all routes (important for AI Studio iframe & preview environments)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Body parsing with generous limit for camera photos (base64)
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Lazy initialize Google GenAI
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Endpoint: Parse delivery note or component picture
app.post(['/api/parse-delivery-image', '/parse-delivery-image'], async (req, res) => {
  try {
    const { image, images, knownCustomers, knownComponentTypes } = req.body;

    // Collect base64 images without heavy regex
    const rawImages: { data: string; mimeType: string }[] = [];
    const parseImageItem = (item: any) => {
      if (!item) return;
      if (typeof item === 'object' && item.data) {
        rawImages.push({ mimeType: item.mimeType || 'image/jpeg', data: item.data });
      } else if (typeof item === 'string') {
        const commaIndex = item.indexOf(',');
        if (item.startsWith('data:') && commaIndex !== -1) {
          const meta = item.slice(5, commaIndex);
          const mimeType = meta.split(';')[0] || 'image/jpeg';
          const data = item.slice(commaIndex + 1);
          rawImages.push({ mimeType, data });
        } else {
          rawImages.push({ mimeType: 'image/jpeg', data: item });
        }
      }
    };

    if (Array.isArray(images) && images.length > 0) {
      images.forEach(parseImageItem);
    } else if (image) {
      parseImageItem(image);
    }

    if (rawImages.length === 0) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured in the server environment.'
      });
    }

    const ai = getAIClient();

    const customerListPrompt = Array.isArray(knownCustomers) && knownCustomers.length > 0
      ? `Known customers in ERP system:\n${knownCustomers.map((c: any) => `- ID: "${c.id}", Name: "${c.name}"`).join('\n')}`
      : 'No predefined customer list.';

    const componentTypesPrompt = Array.isArray(knownComponentTypes) && knownComponentTypes.length > 0
      ? `Known component types in ERP:\n${knownComponentTypes.join(', ')}`
      : 'Common workshop types: Spindle, Motor, Pump, Gearbox, Ball Screw, Tooling, Cylinder, Inverter.';

    const promptText = `
You are an expert OCR and industrial receiving specialist for an ERP workshop management system (MES Workshop3).
Analyze the provided picture(s). The picture is a photo taken from document upload or machinery paperwork (such as Delivery Note, Dispatch Advice, Packing Slip, Goods Received Note (GRN), Consignment note, Shipping manifest, or Purchase Order paperwork).

Extract the following information carefully to populate the delivery and job details:
1. "deliveryNoteNumber": The delivery note number, advice note #, packing slip #, DN number, consignment number, or document reference number.
2. "customerName": The customer or sender company name (look for "Customer", "To", "From", "Client", or company letterhead).
3. "matchedCustomerId": If a customer from the known customers list matches or closely matches the sender/customer name, provide their exact ID; otherwise empty string.
4. "dateReceived": Date on the document or delivery note in ISO format "YYYY-MM-DD". If only day and month are present, assume the current year.
5. "orderNumber": Purchase Order (PO) number, customer order #, or requisition #.
6. "yourRef": Reference number, quote reference, or internal reference.
7. "customerJobNumber": Customer job number, tag number, or work order #.
8. "items": List of equipment/components identified in the image:
   - "componentType": Match to the closest known component type (e.g. Spindle, Motor, Pump, Gearbox, Ball Screw, etc.).
   - "modelName": Model name, model number, part description or machine type.
   - "serialNumber": Serial number, part number, or equipment ID.
   - "orderNumber": Item-specific PO or line reference.
   - "quantity": Quantity if noted (integer, defaults to 1).
   - "description": Description or symptom reported.
9. "rawExtractedSummary": A concise summary (1-2 sentences) of the document and components identified.

${customerListPrompt}

${componentTypesPrompt}

Extract accurately and only extract visible information.
`.trim();

    const parts: any[] = rawImages.slice(0, 3).map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    }));
    parts.push({ text: promptText });

    const config = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          deliveryNoteNumber: { type: Type.STRING },
          customerName: { type: Type.STRING },
          matchedCustomerId: { type: Type.STRING },
          dateReceived: { type: Type.STRING },
          orderNumber: { type: Type.STRING },
          yourRef: { type: Type.STRING },
          customerJobNumber: { type: Type.STRING },
          dueDate: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                componentType: { type: Type.STRING },
                modelName: { type: Type.STRING },
                serialNumber: { type: Type.STRING },
                orderNumber: { type: Type.STRING },
                quantity: { type: Type.INTEGER },
                description: { type: Type.STRING },
              },
            },
          },
          rawExtractedSummary: { type: Type.STRING },
        },
      },
    };

    // Cascade models for optimal reliability: gemini-3.1-flash-lite -> gemini-flash-latest -> gemini-3.8-flash
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let response: any = null;
    let lastError: any = null;

    for (const modelCandidate of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelCandidate,
          contents: { parts },
          config,
        });
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`parse-delivery-image model ${modelCandidate} failed:`, err?.message?.slice(0, 120));
      }
    }

    if (!response || !response.text) {
      console.error('All vision models failed to parse delivery image:', lastError?.message);
      return res.status(502).json({
        success: false,
        error: lastError?.message
          ? `Gemini AI vision error: ${lastError.message}`
          : 'Could not extract text from delivery document image. Please ensure the photo is clear and well-lit, then try again.'
      });
    }

    const outputText = response.text || '{}';
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(outputText);
    } catch {
      parsedData = {};
    }

    return res.json({ success: true, data: parsedData });
  } catch (err: any) {
    console.error('Error parsing delivery image with Gemini:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to process image with Gemini AI',
    });
  }
});

// Health & Status endpoint for Paperwork AI
app.get(['/api/parse-paperwork-ai', '/parse-paperwork-ai'], (req, res) => {
  res.json({
    status: 'ok',
    endpoint: '/api/parse-paperwork-ai',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    message: 'Paperwork AI endpoint is online and ready for POST requests.'
  });
});

// Endpoint: AI Paperwork Population (Specialized for Delivery Notes, RFQs & Component Receiving Lines)
app.post(['/api/parse-paperwork-ai', '/api/parse-paperwork-ai/', '/parse-paperwork-ai'], async (req, res) => {
  try {
    const { image, images, knownCustomers, knownComponentTypes } = req.body;

    // Collect base64 images without heavy regex
    const rawImages: { data: string; mimeType: string }[] = [];
    const parseImageItem = (item: any) => {
      if (!item) return;
      if (typeof item === 'object' && item.data) {
        rawImages.push({ mimeType: item.mimeType || 'image/jpeg', data: item.data });
      } else if (typeof item === 'string') {
        const commaIndex = item.indexOf(',');
        if (item.startsWith('data:') && commaIndex !== -1) {
          const meta = item.slice(5, commaIndex);
          const mimeType = meta.split(';')[0] || 'image/jpeg';
          const data = item.slice(commaIndex + 1);
          rawImages.push({ mimeType, data });
        } else {
          rawImages.push({ mimeType: 'image/jpeg', data: item });
        }
      }
    };

    if (Array.isArray(images) && images.length > 0) {
      images.forEach(parseImageItem);
    } else if (image) {
      parseImageItem(image);
    }

    if (rawImages.length === 0) {
      return res.status(400).json({ success: false, error: 'No image data provided. Please upload or photograph a document.' });
    }

    // Check if GEMINI_API_KEY is available
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured in the server environment. Please set GEMINI_API_KEY in the environment or Settings.'
      });
    }

    const ai = getAIClient();

    const customerListPrompt = Array.isArray(knownCustomers) && knownCustomers.length > 0
      ? `Known registered customers in ERP:\n${knownCustomers.map((c: any) => `- ID: "${c.id}", Name: "${c.name}"`).join('\n')}`
      : 'No registered customer list provided.';

    const componentTypesPrompt = Array.isArray(knownComponentTypes) && knownComponentTypes.length > 0
      ? `Known component categories in ERP:\n${knownComponentTypes.join(', ')}`
      : 'Standard industrial categories: Spindle, Motor, Pump, Gearbox, Ball Screw, Cylinder, Inverter, Tooling.';

    const promptText = `
You are an advanced industrial OCR and document understanding engine for an ERP workshop management system (MES Workshop3).
Carefully read the provided picture of a Customer Delivery Note, Dispatch Advice, Packing Slip, or RFQ (Request for Quotation).

CRITICAL ACCURACY DIRECTIVES:
- Extract the EXACT text and data visible in THIS specific photograph.
- DO NOT invent, hallucinate, or substitute any demo/sample data or placeholders.
- If a field is not present on the document, leave it as an empty string ("") or 0.

Extract the paperwork information to populate these fields:
1. "deliveryNoteNumber": The delivery note number, advice note number, DN #, packing slip #, or RFQ reference number visible on the document.
2. "customerJobNumber": The customer job number, customer order/works number, customer asset/tag #, or reference number (look for "Customer Job No", "Cust Job #", "Works Order", "Tag", "Job No", "Ref").
3. "amountOfComponents": The total number of items/components listed on the document (integer count).
4. "componentLines": Itemize EACH component as a separate receiving component line:
   - "lineNumber": Sequential integer (1, 2, 3...)
   - "componentType": Match to the closest known component category (e.g. Spindle, Motor, Pump, Gearbox, Ball Screw, Cylinder, Tooling, etc.)
   - "modelName": The specific model or type designation of the component visible on the document. This is CRITICAL.
   - "serialNumber": Serial number, part number, or asset code if present on the document.
   - "quantity": Quantity of this item (usually 1 or integer).
   - "description": Description of the component or customer's stated fault/repair scope as written on the document.
   - "notes": Any specific customer remarks, urgency, or notes written on the document.
5. "customerName": Customer, sender, or client company name on the document.
6. "matchedCustomerId": ID of the matched known customer if found, otherwise empty string.
7. "documentDate": Date on the document in "YYYY-MM-DD" format.
8. "orderNumber": Customer Purchase Order (PO) number or RFQ number.
9. "documentType": The type of document (e.g. "Customer Delivery Note", "Request for Quotation (RFQ)", "Dispatch Advice", "Goods Received Note", or "Other").
10. "rawExtractedSummary": A concise factual summary (2-3 sentences) detailing the document identified, the exact delivery note number, customer name, and component lines found.

${customerListPrompt}

${componentTypesPrompt}

Be thorough and extract only genuine content from the document image.
`.trim();

    const parts: any[] = rawImages.slice(0, 3).map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    }));
    parts.push({ text: promptText });

    const schemaConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          deliveryNoteNumber: { type: Type.STRING },
          customerJobNumber: { type: Type.STRING },
          amountOfComponents: { type: Type.INTEGER },
          customerName: { type: Type.STRING },
          matchedCustomerId: { type: Type.STRING },
          documentDate: { type: Type.STRING },
          orderNumber: { type: Type.STRING },
          documentType: { type: Type.STRING },
          rawExtractedSummary: { type: Type.STRING },
          componentLines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                lineNumber: { type: Type.INTEGER },
                componentType: { type: Type.STRING },
                modelName: { type: Type.STRING },
                serialNumber: { type: Type.STRING },
                quantity: { type: Type.INTEGER },
                description: { type: Type.STRING },
                notes: { type: Type.STRING },
              },
              required: ['lineNumber', 'componentType', 'modelName'],
            },
          },
        },
        required: ['deliveryNoteNumber', 'customerJobNumber', 'amountOfComponents', 'componentLines'],
      },
    };

    // Cascade: Try gemini-3.1-flash-lite first, then gemini-flash-latest, then gemini-3.8-flash
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let response: any = null;
    let lastError: any = null;

    for (const modelCandidate of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelCandidate,
          contents: { parts },
          config: schemaConfig,
        });
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Vision model ${modelCandidate} failed:`, err?.message?.slice(0, 120));
      }
    }

    if (!response || !response.text) {
      console.error('All vision models failed to parse document:', lastError?.message);
      return res.status(502).json({
        success: false,
        error: lastError?.message
          ? `Gemini AI vision error: ${lastError.message}`
          : 'Could not extract text from document image. Please ensure the paperwork is clear and well-lit, then try again.'
      });
    }

    const outputText = response.text || '{}';
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(outputText);
    } catch {
      parsedData = {};
    }

    // Ensure amountOfComponents matches componentLines length if not provided
    if (!parsedData.amountOfComponents && Array.isArray(parsedData.componentLines)) {
      parsedData.amountOfComponents = parsedData.componentLines.length;
    }

    return res.json({ success: true, data: parsedData });
  } catch (err: any) {
    console.error('Error in /api/parse-paperwork-ai:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to process paperwork picture with Gemini AI',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MES Workshop server running on port ${PORT}`);
  });
}

startServer();
