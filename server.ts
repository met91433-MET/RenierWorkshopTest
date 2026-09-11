import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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
app.post('/api/parse-delivery-image', async (req, res) => {
  try {
    const { image, images, knownCustomers, knownComponentTypes } = req.body;

    // Collect base64 images
    const rawImages: { data: string; mimeType: string }[] = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const item of images) {
        if (typeof item === 'string') {
          const match = item.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            rawImages.push({ mimeType: match[1], data: match[2] });
          } else {
            rawImages.push({ mimeType: 'image/jpeg', data: item });
          }
        } else if (item && item.data) {
          rawImages.push({ mimeType: item.mimeType || 'image/jpeg', data: item.data });
        }
      }
    } else if (image && typeof image === 'string') {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        rawImages.push({ mimeType: match[1], data: match[2] });
      } else {
        rawImages.push({ mimeType: 'image/jpeg', data: image });
      }
    }

    if (rawImages.length === 0) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
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
Analyze the provided picture(s). The picture could be:
- A Delivery Note, Dispatch Advice, Packing Slip, Goods Received Note (GRN), Consignment note, Shipping manifest, or Purchase Order paperwork.
- Or a photo of machinery, component nameplate, serial badge, barcode tag, or parts label.

Extract the following information carefully to populate the delivery and job details:
1. "deliveryNoteNumber": The delivery note number, advice note #, packing slip #, DN number, consignment number, or document reference number.
2. "customerName": The customer or sender company name (look for "Customer", "To", "From", "Client", or logo/letterhead).
3. "matchedCustomerId": If a customer from the known customers list matches or closely matches the sender/customer name, provide their exact ID; otherwise empty string.
4. "dateReceived": Date on the document or delivery note in ISO format "YYYY-MM-DD". If only day and month are present, assume the current year.
5. "orderNumber": Purchase Order (PO) number, customer order #, or requisition #.
6. "yourRef": Reference number, quote reference, or internal reference.
7. "customerJobNumber": Customer job number, tag number, or work order #.
8. "items": List of equipment/components identified in the image:
   - "componentType": Match to the closest known component type (e.g. Spindle, Motor, etc.).
   - "modelName": Model name, model number, part description or machine type.
   - "serialNumber": Serial number, part number, or equipment ID.
   - "orderNumber": Item-specific PO or line reference.
9. "rawExtractedSummary": A concise summary (1-2 sentences) of what document or item was read.

${customerListPrompt}

${componentTypesPrompt}

Extract accurately. If a field cannot be determined with confidence, leave it as empty string or empty array.
`.trim();

    const parts: any[] = rawImages.slice(0, 3).map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    }));
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
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
                },
              },
            },
            rawExtractedSummary: { type: Type.STRING },
          },
        },
      },
    });

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

// Endpoint: AI Paperwork Population (Specialized for Delivery Notes, RFQs & Component Receiving Lines)
app.post('/api/parse-paperwork-ai', async (req, res) => {
  try {
    const { image, images, knownCustomers, knownComponentTypes } = req.body;

    // Collect base64 images
    const rawImages: { data: string; mimeType: string }[] = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const item of images) {
        if (typeof item === 'string') {
          const match = item.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            rawImages.push({ mimeType: match[1], data: match[2] });
          } else {
            rawImages.push({ mimeType: 'image/jpeg', data: item });
          }
        } else if (item && item.data) {
          rawImages.push({ mimeType: item.mimeType || 'image/jpeg', data: item.data });
        }
      }
    } else if (image && typeof image === 'string') {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        rawImages.push({ mimeType: match[1], data: match[2] });
      } else {
        rawImages.push({ mimeType: 'image/jpeg', data: image });
      }
    }

    if (rawImages.length === 0) {
      return res.status(400).json({ success: false, error: 'No image data provided. Please upload or photograph a document.' });
    }

    // Check if GEMINI_API_KEY is available
    if (!process.env.GEMINI_API_KEY) {
      // Provide a structured fallback if no key is supplied
      return res.json({
        success: true,
        data: {
          deliveryNoteNumber: 'DN-99481',
          customerJobNumber: 'CJ-2024-88A',
          amountOfComponents: 3,
          customerName: 'Precision Engineering Ltd',
          documentDate: new Date().toISOString().split('T')[0],
          orderNumber: 'PO-77291',
          documentType: 'Customer Delivery Note',
          rawExtractedSummary: 'Demo Extraction (Configure GEMINI_API_KEY in Secrets for live Gemini OCR): Extracted Delivery Note #DN-99481 with 3 component lines.',
          componentLines: [
            {
              lineNumber: 1,
              componentType: 'Spindle',
              modelName: 'HSD ES929 24000RPM ISO30',
              serialNumber: 'SN-884912',
              quantity: 1,
              description: 'Electrospindle - Bearing noise reported, evaluate for rebuild',
              notes: 'Bearing noise, shaft runout inspection'
            },
            {
              lineNumber: 2,
              componentType: 'Motor',
              modelName: 'Siemens 1FK7060-5AF71-1AH0',
              serialNumber: 'SN-049281',
              quantity: 1,
              description: 'AC Servomotor - Resolver fault & rewinding check',
              notes: 'Resolver check'
            },
            {
              lineNumber: 3,
              componentType: 'Pump',
              modelName: 'Rexroth A10VSO45 DFR1/31R',
              serialNumber: 'SN-552109',
              quantity: 1,
              description: 'Variable displacement hydraulic piston pump',
              notes: 'Low pressure symptom'
            }
          ]
        },
        notice: 'Note: Using simulated fallback response because GEMINI_API_KEY is not configured in this environment.'
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

Extract the exact paperwork information to populate these specific fields:
1. "deliveryNoteNumber": The delivery note number, advice note number, DN #, packing slip #, or RFQ reference number.
2. "customerJobNumber": The customer job number, customer order/works number, customer asset/tag #, or reference number (look for "Customer Job No", "Cust Job #", "Works Order", "Tag", "Job No", "Ref").
3. "amountOfComponents": The total number/amount of components or items delivered/quoted on the document (integer count).
4. "componentLines": Itemize EACH component as a separate receiving component line:
   - "lineNumber": Sequential integer (1, 2, 3...)
   - "componentType": Match to the closest known component category (e.g. Spindle, Motor, Pump, Gearbox, Ball Screw, Cylinder, Tooling, etc.)
   - "modelName": The specific model or type designation of the component (e.g. "HSD ES929", "Siemens 1FK7060-5AF71", "Rexroth A10VSO45", "Fanuc Alpha i 12/10000"). This is CRITICAL.
   - "serialNumber": Serial number, part number, or asset code if present on the document.
   - "quantity": Quantity of this item (usually 1 or integer).
   - "description": Description of the component or customer's stated fault/repair scope (e.g., "High vibration", "Bearing failure", "Rebuild required").
   - "notes": Any specific customer remarks, urgency, or notes.
5. "customerName": Customer, sender, or client company name.
6. "matchedCustomerId": ID of the matched known customer if found, otherwise empty string.
7. "documentDate": Date on the document in "YYYY-MM-DD" format (or today's date if year missing).
8. "orderNumber": Customer Purchase Order (PO) number or RFQ number.
9. "documentType": The type of document (e.g. "Customer Delivery Note", "Request for Quotation (RFQ)", "Dispatch Advice", "Goods Received Note", or "Other").
10. "rawExtractedSummary": A concise summary (2-3 sentences) detailing the document identified, delivery note number, customer job number, and how many component lines were read.

${customerListPrompt}

${componentTypesPrompt}

Be thorough and accurate. Ensure every component mentioned in the document becomes its own receiving component line with its model clearly identified.
`.trim();

    const parts: any[] = rawImages.slice(0, 3).map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    }));
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
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
      },
    });

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
