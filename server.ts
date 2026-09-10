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
