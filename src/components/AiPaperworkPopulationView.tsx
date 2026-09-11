import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Camera, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  Plus, 
  ExternalLink, 
  Copy, 
  Eye, 
  X, 
  Layers, 
  Boxes, 
  Hash, 
  Building2, 
  Calendar, 
  Tag, 
  FileSpreadsheet, 
  History, 
  Download,
  Maximize2
} from 'lucide-react';
import { Customer, ComponentMatrix, JobFile } from '../types';
import CameraCaptureModal from './CameraCaptureModal';
import { generateSampleDeliveryNote, generateSampleRFQ } from '../utils/samplePaperworkGenerator';

export interface ExtractedComponentLine {
  lineNumber: number;
  componentType: string;
  modelName: string;
  serialNumber: string;
  quantity: number;
  description: string;
  notes?: string;
}

export interface PopulatedPaperworkData {
  deliveryNoteNumber: string;
  customerJobNumber: string;
  amountOfComponents: number;
  customerName: string;
  matchedCustomerId?: string;
  documentDate: string;
  orderNumber: string;
  documentType: string;
  rawExtractedSummary: string;
  componentLines: ExtractedComponentLine[];
}

export interface PaperworkTestRun {
  id: string;
  timestamp: string;
  imagePreview: string;
  data: PopulatedPaperworkData;
  source: 'camera' | 'upload' | 'sample';
}

interface AiPaperworkPopulationViewProps {
  customers: Customer[];
  componentsList: ComponentMatrix[];
  currentUser: any;
  onTransferToReceiving?: (data: {
    deliveryNoteNumber: string;
    customerId?: string;
    customerJobNumber?: string;
    orderNumber?: string;
    dateReceived?: string;
    items: {
      componentType: string;
      modelName: string;
      serialNumber: string;
      orderNumber?: string;
      customerJobNumber?: string;
      yourRef?: string;
    }[];
    files?: JobFile[];
  }) => void;
}

export default function AiPaperworkPopulationView({
  customers,
  componentsList,
  currentUser,
  onTransferToReceiving
}: AiPaperworkPopulationViewProps) {
  // State for current uploaded/captured document
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Populated fields state
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState<string>('');
  const [customerJobNumber, setCustomerJobNumber] = useState<string>('');
  const [amountOfComponents, setAmountOfComponents] = useState<number>(0);
  const [componentLines, setComponentLines] = useState<ExtractedComponentLine[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [documentType, setDocumentType] = useState<string>('Customer Delivery Note');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [hasExtracted, setHasExtracted] = useState(false);

  // Modals & UI helpers
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // History of test runs (saved in localStorage)
  const [testRuns, setTestRuns] = useState<PaperworkTestRun[]>(() => {
    try {
      const saved = localStorage.getItem('metalogik_ai_paperwork_tests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Auto-sync amountOfComponents whenever componentLines change
  useEffect(() => {
    setAmountOfComponents(componentLines.length);
  }, [componentLines]);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('metalogik_ai_paperwork_tests', JSON.stringify(testRuns.slice(0, 15)));
    } catch (e) {
      console.error('Error caching test runs:', e);
    }
  }, [testRuns]);

  // Execute extraction through backend Gemini endpoint
  const processImageWithAI = async (imageDataUrl: string, source: 'camera' | 'upload' | 'sample', name = 'document.jpg') => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessNotice(null);
    setProcessStep('Sending image to Gemini AI Vision engine...');

    try {
      const response = await fetch('/api/parse-paperwork-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageDataUrl,
          knownCustomers: customers.map(c => ({ id: c.id, name: c.name })),
          knownComponentTypes: componentsList.map(c => c.name || c.id)
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned error status ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to extract structured data from paperwork picture');
      }

      const data: PopulatedPaperworkData = result.data;

      // Populate basic fields
      setDeliveryNoteNumber(data.deliveryNoteNumber || '');
      setCustomerJobNumber(data.customerJobNumber || '');
      
      const lines: ExtractedComponentLine[] = Array.isArray(data.componentLines) && data.componentLines.length > 0
        ? data.componentLines.map((line, idx) => ({
            lineNumber: line.lineNumber || idx + 1,
            componentType: line.componentType || 'Spindle',
            modelName: line.modelName || 'Standard Model',
            serialNumber: line.serialNumber || '',
            quantity: line.quantity || 1,
            description: line.description || '',
            notes: line.notes || ''
          }))
        : [];

      setComponentLines(lines);
      setAmountOfComponents(data.amountOfComponents || lines.length);
      setCustomerName(data.customerName || '');
      
      // Match customer to ERP
      if (data.matchedCustomerId && customers.some(c => c.id === data.matchedCustomerId)) {
        setSelectedCustomerId(data.matchedCustomerId);
      } else if (data.customerName) {
        const found = customers.find(c => 
          c.name.toLowerCase().includes(data.customerName.toLowerCase()) ||
          data.customerName.toLowerCase().includes(c.name.toLowerCase())
        );
        if (found) setSelectedCustomerId(found.id);
        else setSelectedCustomerId('');
      } else {
        setSelectedCustomerId('');
      }

      setDocumentDate(data.documentDate || new Date().toISOString().split('T')[0]);
      setOrderNumber(data.orderNumber || '');
      setDocumentType(data.documentType || 'Customer Delivery Note');
      setAiSummary(data.rawExtractedSummary || 'Extraction completed successfully.');
      setHasExtracted(true);

      // Save into test runs history
      const newRun: PaperworkTestRun = {
        id: `test-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        imagePreview: imageDataUrl,
        data: {
          ...data,
          componentLines: lines,
          amountOfComponents: lines.length
        },
        source
      };
      setTestRuns(prev => [newRun, ...prev.filter(r => r.id !== newRun.id)]);

      setSuccessNotice(`Successfully populated ${lines.length} receiving component line${lines.length === 1 ? '' : 's'} from picture!`);
    } catch (err: any) {
      console.error('Error during paperwork AI parsing:', err);
      setErrorMessage(err?.message || 'Failed to process document with AI. Please check your image or try again.');
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  // Handle file selection from local device
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid picture file (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCurrentImage(dataUrl);
      setImageFileName(file.name);
      processImageWithAI(dataUrl, 'upload', file.name);
    };
    reader.readAsDataURL(file);
  };

  // Handle Camera Capture
  const handlePhotosCaptured = (files: File[]) => {
    setIsCameraModalOpen(false);
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCurrentImage(dataUrl);
      setImageFileName(`Camera_Snap_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.jpg`);
      processImageWithAI(dataUrl, 'camera', 'camera_snap.jpg');
    };
    reader.readAsDataURL(file);
  };

  // Test with Sample Delivery Note Preset
  const handleLoadSampleDeliveryNote = () => {
    const sampleUrl = generateSampleDeliveryNote();
    if (!sampleUrl) return;
    setCurrentImage(sampleUrl);
    setImageFileName('Sample_Delivery_Note_DN-99481.jpg');
    processImageWithAI(sampleUrl, 'sample', 'sample_delivery_note.jpg');
  };

  // Test with Sample RFQ Preset
  const handleLoadSampleRFQ = () => {
    const sampleUrl = generateSampleRFQ();
    if (!sampleUrl) return;
    setCurrentImage(sampleUrl);
    setImageFileName('Sample_RFQ_40892_Dispatch.jpg');
    processImageWithAI(sampleUrl, 'sample', 'sample_rfq.jpg');
  };

  // Add a new component line manually
  const handleAddComponentLine = () => {
    const nextLineNumber = componentLines.length + 1;
    const defaultType = componentsList[0]?.name || componentsList[0]?.id || 'Spindle';
    const firstComp = componentsList.find(c => c.name === defaultType || c.id === defaultType) || componentsList[0];
    const defaultModel = firstComp?.models?.[0] || 'Model Spec';

    const newLine: ExtractedComponentLine = {
      lineNumber: nextLineNumber,
      componentType: defaultType,
      modelName: defaultModel,
      serialNumber: '',
      quantity: 1,
      description: 'Customer component repair item',
      notes: ''
    };
    setComponentLines(prev => [...prev, newLine]);
  };

  // Update a component line field
  const handleUpdateComponentLine = (index: number, field: keyof ExtractedComponentLine, val: any) => {
    setComponentLines(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  // Remove a component line
  const handleRemoveComponentLine = (index: number) => {
    setComponentLines(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      // Re-number
      return filtered.map((item, idx) => ({ ...item, lineNumber: idx + 1 }));
    });
  };

  // Load a previous test run
  const handleLoadTestRun = (run: PaperworkTestRun) => {
    setCurrentImage(run.imagePreview);
    setImageFileName(`Saved_${run.data.deliveryNoteNumber || 'Test'}.jpg`);
    setDeliveryNoteNumber(run.data.deliveryNoteNumber || '');
    setCustomerJobNumber(run.data.customerJobNumber || '');
    setAmountOfComponents(run.data.amountOfComponents || run.data.componentLines.length);
    setComponentLines(run.data.componentLines || []);
    setCustomerName(run.data.customerName || '');
    if (run.data.matchedCustomerId) {
      setSelectedCustomerId(run.data.matchedCustomerId);
    }
    setDocumentDate(run.data.documentDate || new Date().toISOString().split('T')[0]);
    setOrderNumber(run.data.orderNumber || '');
    setDocumentType(run.data.documentType || 'Customer Delivery Note');
    setAiSummary(run.data.rawExtractedSummary || '');
    setHasExtracted(true);
    setShowHistoryDrawer(false);
    setSuccessNotice(`Loaded test run: ${run.data.deliveryNoteNumber || 'Document'} (${run.timestamp})`);
  };

  // Reset form
  const handleResetForm = () => {
    setCurrentImage(null);
    setImageFileName('');
    setDeliveryNoteNumber('');
    setCustomerJobNumber('');
    setAmountOfComponents(0);
    setComponentLines([]);
    setCustomerName('');
    setSelectedCustomerId('');
    setDocumentDate(new Date().toISOString().split('T')[0]);
    setOrderNumber('');
    setAiSummary('');
    setHasExtracted(false);
    setErrorMessage(null);
    setSuccessNotice(null);
  };

  // Transfer populated fields into Receiving
  const handleTransferToReceiving = () => {
    if (!onTransferToReceiving) return;

    // Build attached file from current image if available
    const attachedFiles: JobFile[] = [];
    if (currentImage) {
      attachedFiles.push({
        name: imageFileName || 'Delivery_Note_Scan.jpg',
        dataUrl: currentImage,
        size: Math.round(currentImage.length * 0.75),
        type: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        category: 'delivery'
      });
    }

    // Convert component lines into Receiving items
    const items = componentLines.map(line => ({
      componentType: line.componentType || 'Spindle',
      modelName: line.modelName || 'Standard Model',
      serialNumber: line.serialNumber || '',
      orderNumber: orderNumber || '',
      customerJobNumber: customerJobNumber || 'NONE',
      yourRef: line.description || 'NONE'
    }));

    onTransferToReceiving({
      deliveryNoteNumber: deliveryNoteNumber || 'DN-PENDING',
      customerId: selectedCustomerId || undefined,
      customerJobNumber: customerJobNumber || 'NONE',
      orderNumber: orderNumber || '',
      dateReceived: documentDate,
      items: items.length > 0 ? items : [{
        componentType: 'Spindle',
        modelName: 'Standard Model',
        serialNumber: '',
        orderNumber: orderNumber || '',
        customerJobNumber: customerJobNumber || 'NONE',
        yourRef: 'NONE'
      }],
      files: attachedFiles
    });
  };

  // Copy extracted data as JSON
  const handleCopyJSON = () => {
    const payload = {
      deliveryNoteNumber,
      customerJobNumber,
      amountOfComponents,
      customerName: selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name : customerName,
      documentDate,
      orderNumber,
      documentType,
      componentLines
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setSuccessNotice('Extracted fields copied to clipboard as JSON!');
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" id="ai-paperwork-module">
      {/* MODULE HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-blue-600/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                AI Paperwork Population Lab
              </span>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                Delivery Notes & RFQ OCR
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white flex items-center gap-2.5">
              AI Paperwork Population
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Take or upload a picture of a customer delivery note or RFQ. The AI extracts the 
              <span className="text-blue-300 font-semibold"> Delivery Note Number</span>, 
              <span className="text-blue-300 font-semibold"> Customer Job Number</span>, 
              <span className="text-blue-300 font-semibold"> Total Components</span>, and generates each item as a 
              <span className="text-blue-300 font-semibold"> Receiving Component Line</span> with its exact model designation.
            </p>
          </div>

          {/* Test History and Action Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {testRuns.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <History className="w-4 h-4 text-slate-400" />
                <span>Test History ({testRuns.length})</span>
              </button>
            )}

            {hasExtracted && onTransferToReceiving && (
              <button
                type="button"
                onClick={handleTransferToReceiving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Transfer to 1. Receiving</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {successNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successNotice}</span>
          </div>
          <button 
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button 
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* RECENT TEST RUNS DRAWER */}
      {showHistoryDrawer && (
        <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Previous AI Paperwork Test Runs</h3>
            </div>
            <button
              onClick={() => setShowHistoryDrawer(false)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {testRuns.map(run => (
              <div
                key={run.id}
                onClick={() => handleLoadTestRun(run)}
                className="bg-slate-800/80 hover:bg-slate-750 border border-slate-700 p-3 rounded-xl cursor-pointer transition-all hover:border-blue-500 flex gap-3 items-center group"
              >
                <img
                  src={run.imagePreview}
                  alt="Test thumbnail"
                  className="w-14 h-14 object-cover rounded-lg bg-black shrink-0 border border-slate-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate group-hover:text-blue-300">
                    {run.data.deliveryNoteNumber || 'No DN #'}
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    Job: {run.data.customerJobNumber || 'N/A'}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1">
                    <span>{run.data.amountOfComponents || 0} line(s)</span>
                    <span className="capitalize text-blue-400">{run.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN 2-COLUMN WORKSPACE: LEFT (UPLOAD & PICTURE) | RIGHT (POPULATED BASIC FIELDS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: CAPTURE / UPLOAD / PREVIEW (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center justify-between mb-3">
              <span className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                1. Take Picture or Upload
              </span>
              {currentImage && (
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Active Document
                </span>
              )}
            </h2>

            {/* ACTION BUTTONS: Real Camera + File Upload */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                id="btn-take-picture"
                onClick={() => setIsCameraModalOpen(true)}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs sm:text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>Take Picture</span>
              </button>

              <button
                type="button"
                id="btn-upload-picture"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-3 rounded-xl text-xs sm:text-sm border border-slate-300 transition-all cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4 shrink-0 text-slate-600" />
                <span>Upload Picture</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>

            {/* QUICK TEST PRESETS FOR EASY DEMO / VERIFICATION */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Instant Test Presets (No camera required)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleDeliveryNote}
                  disabled={isProcessing}
                  className="bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 p-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer shadow-2xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-900">Sample Delivery Note</div>
                    <div className="text-[10px] text-slate-500">DN-99481 (3 components)</div>
                  </div>
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleLoadSampleRFQ}
                  disabled={isProcessing}
                  className="bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300 text-slate-700 hover:text-cyan-700 p-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer shadow-2xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-900">Sample RFQ Dispatch</div>
                    <div className="text-[10px] text-slate-500">RFQ-40892 (2 components)</div>
                  </div>
                  <FileSpreadsheet className="w-4 h-4 text-cyan-600 shrink-0" />
                </button>
              </div>
            </div>

            {/* DRAG & DROP OR ACTIVE PHOTO PREVIEW */}
            {currentImage ? (
              <div className="space-y-3">
                <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-[4/3] flex items-center justify-center">
                  <img
                    src={currentImage}
                    alt="Paperwork capture"
                    className="max-h-full max-w-full object-contain"
                  />
                  
                  {/* Hover Overlay Controls */}
                  <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPreviewModalOpen(true)}
                      className="bg-white/90 hover:bg-white text-slate-900 p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Full View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => processImageWithAI(currentImage, 'upload', imageFileName)}
                      disabled={isProcessing}
                      className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                      <span>Re-Analyze</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span className="truncate max-w-[220px] font-mono text-[11px]">
                    {imageFileName || 'Captured document'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect Photo
                  </button>
                </div>
              </div>
            ) : (
              /* Drag & Drop Zone */
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handleFileSelect(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragOver 
                    ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' 
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-slate-800">
                  Drag and drop paperwork picture here
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Take a photo with your mobile device or drag a JPEG / PNG document
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-2xs">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Choose file or take snap</span>
                </div>
              </div>
            )}

            {/* PROCESSING OVERLAY / PROGRESS BAR */}
            {isProcessing && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3.5 animate-pulse">
                <div className="flex items-center gap-2.5 text-blue-900 font-bold text-xs">
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                  <span>AI OCR Processing:</span>
                </div>
                <div className="text-xs text-blue-700 mt-1 font-medium">
                  {processStep || 'Extracting delivery note number, customer job number & component lines...'}
                </div>
              </div>
            )}
          </div>

          {/* AI SUMMARY COMMENTARY CARD */}
          {aiSummary && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>AI Paperwork Insights & Overview</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                {aiSummary}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: POPULATED BASIC FIELDS & RECEIVING COMPONENT LINES (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  2. Populated Information from Picture
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extracted from customer delivery note or RFQ document
                </p>
              </div>

              <div className="flex items-center gap-2">
                {hasExtracted && (
                  <button
                    type="button"
                    onClick={handleCopyJSON}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                    title="Copy extracted payload as JSON"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </button>
                )}
                <div className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5" />
                  <span>{amountOfComponents} Component{amountOfComponents === 1 ? '' : 's'}</span>
                </div>
              </div>
            </div>

            {/* BASIC FIELDS REQUIRED:
                1. Delivery note number
                2. Customer Job Number
                3. Amount of components
                4. Customer / Sender
            */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* FIELD 1: DELIVERY NOTE NUMBER */}
              <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all">
                <label className="text-xs font-extrabold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-blue-600" />
                    Delivery Note Number
                  </span>
                  {hasExtracted && deliveryNoteNumber && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                      Extracted
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  id="field-delivery-note-number"
                  value={deliveryNoteNumber}
                  onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                  placeholder="e.g. DN-99481 or Advice #"
                  className="w-full font-mono font-bold text-sm text-slate-900 bg-transparent border-0 focus:ring-0 p-0 placeholder:text-slate-400 focus:outline-none"
                />
                <div className="text-[10px] text-slate-400">
                  Primary delivery reference / goods receipt note
                </div>
              </div>

              {/* FIELD 2: CUSTOMER JOB NUMBER */}
              <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all">
                <label className="text-xs font-extrabold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    Customer Job Number
                  </span>
                  {hasExtracted && customerJobNumber && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                      Extracted
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  id="field-customer-job-number"
                  value={customerJobNumber}
                  onChange={(e) => setCustomerJobNumber(e.target.value)}
                  placeholder="e.g. CJ-2024-88A, Works Order #"
                  className="w-full font-mono font-bold text-sm text-indigo-900 bg-transparent border-0 focus:ring-0 p-0 placeholder:text-slate-400 focus:outline-none"
                />
                <div className="text-[10px] text-slate-400">
                  Customer's internal work order / tag reference
                </div>
              </div>

              {/* FIELD 3: AMOUNT OF COMPONENTS (TOTAL COUNT) */}
              <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all">
                <label className="text-xs font-extrabold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-600" />
                    Amount of Components
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded">
                    Line items count
                  </span>
                </label>
                <div className="flex items-center justify-between">
                  <input
                    type="number"
                    id="field-amount-of-components"
                    min="0"
                    value={amountOfComponents}
                    onChange={(e) => setAmountOfComponents(parseInt(e.target.value, 10) || 0)}
                    className="w-24 font-bold text-sm text-slate-900 bg-transparent border-0 focus:ring-0 p-0 placeholder:text-slate-400 focus:outline-none"
                  />
                  <div className="text-xs font-bold text-slate-600">
                    {componentLines.length} Receiving Lines
                  </div>
                </div>
                <div className="text-[10px] text-slate-400">
                  Total physical units identified on document
                </div>
              </div>

              {/* FIELD 4: CUSTOMER / SENDER */}
              <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all">
                <label className="text-xs font-extrabold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    Customer / Sender
                  </span>
                  {selectedCustomerId && (
                    <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded">
                      ERP Matched
                    </span>
                  )}
                </label>
                <select
                  id="field-customer-select"
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    const matched = customers.find(c => c.id === e.target.value);
                    if (matched) setCustomerName(matched.name);
                  }}
                  className="w-full text-xs font-bold text-slate-900 bg-transparent border-0 focus:ring-0 p-0 focus:outline-none"
                >
                  <option value="">
                    {customerName ? `Detected: "${customerName}"` : '-- Select Registered Customer --'}
                  </option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-400 truncate">
                  {selectedCustomerId 
                    ? `Linked to ERP Customer ID: ${selectedCustomerId}` 
                    : customerName || 'Select from existing customers'}
                </div>
              </div>

              {/* SECONDARY HEADER FIELDS: DATE & PO / RFQ REF */}
              <div className="space-y-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-200">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Date of Document
                </label>
                <input
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-transparent border-0 focus:ring-0 p-0 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-200">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  Order / PO Reference
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g. PO-77291 or Quote Ref"
                  className="w-full text-xs font-mono font-medium text-slate-800 bg-transparent border-0 focus:ring-0 p-0 focus:outline-none"
                />
              </div>

            </div>

            {/* RECEIVING COMPONENT LINES SECTION
                The user specifically asked for:
                "Amount of components and each of them as a receiving component line - the model of the components."
            */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-blue-600" />
                    Receiving Component Lines
                  </h3>
                  <p className="text-xs text-slate-500">
                    Each component extracted as a distinct line with its verified model designation
                  </p>
                </div>

                <button
                  type="button"
                  id="btn-add-component-line"
                  onClick={handleAddComponentLine}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Add Component Line</span>
                </button>
              </div>

              {/* COMPONENT LINES LIST / TABLE */}
              {componentLines.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50">
                  <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div className="text-xs font-bold text-slate-700">
                    No component lines populated yet
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Take or upload a picture of a delivery note/RFQ, or click "Add Component Line" to create receiving items.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {componentLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50/70 hover:bg-white rounded-xl border border-slate-200 p-4 transition-all shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-900 text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded-md">
                            Line {line.lineNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            Receiving Item
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="font-semibold">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) => handleUpdateComponentLine(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                              className="w-12 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-center font-bold"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveComponentLine(idx)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded-md transition-colors cursor-pointer"
                            title="Remove component line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* COMPONENT FIELDS:
                          1. Model of the component (Crucial requested field)
                          2. Component Type
                          3. Serial / Part Number
                      */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        
                        {/* THE MODEL OF THE COMPONENT (Highlighted prominent field) */}
                        <div className="sm:col-span-6 space-y-1">
                          <label className="text-[11px] font-extrabold text-blue-900 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            Model of the Component:
                          </label>
                          <input
                            type="text"
                            value={line.modelName}
                            onChange={(e) => handleUpdateComponentLine(idx, 'modelName', e.target.value)}
                            placeholder="e.g. HSD ES929, Siemens 1FK7060"
                            className="w-full bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        {/* COMPONENT TYPE */}
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[11px] font-bold text-slate-600">
                            Component Category:
                          </label>
                          <select
                            value={line.componentType}
                            onChange={(e) => handleUpdateComponentLine(idx, 'componentType', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                          >
                            {componentsList.length > 0 ? (
                              componentsList.map(c => (
                                <option key={c.id || c.name} value={c.id || c.name}>
                                  {c.name || c.id}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="Spindle">Spindle</option>
                                <option value="Motor">Motor</option>
                                <option value="Pump">Pump</option>
                                <option value="Gearbox">Gearbox</option>
                                <option value="Ball Screw">Ball Screw</option>
                                <option value="Cylinder">Cylinder</option>
                                <option value="Tooling">Tooling</option>
                              </>
                            )}
                          </select>
                        </div>

                        {/* SERIAL / PART NUMBER */}
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[11px] font-bold text-slate-600">
                            Serial / Part #:
                          </label>
                          <input
                            type="text"
                            value={line.serialNumber}
                            onChange={(e) => handleUpdateComponentLine(idx, 'serialNumber', e.target.value)}
                            placeholder="e.g. SN-884912"
                            className="w-full font-mono bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* DESCRIPTION / FAULT / SCOPE OF WORK */}
                        <div className="sm:col-span-12 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">
                            Customer Description / Fault Note / Stated Scope:
                          </label>
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => handleUpdateComponentLine(idx, 'description', e.target.value)}
                            placeholder="e.g. Bearing noise on taper, evaluation for rebuild"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-700 placeholder:text-slate-400"
                          />
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ACTION FOOTER */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Clear Form
                </button>
              </div>

              {onTransferToReceiving && (
                <button
                  type="button"
                  id="btn-transfer-to-receiving"
                  onClick={handleTransferToReceiving}
                  disabled={componentLines.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Push to 1. Receiving ({componentLines.length} Lines)</span>
                </button>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* FULL-IMAGE PREVIEW LIGHTBOX MODAL */}
      {isPreviewModalOpen && currentImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsPreviewModalOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="text-xs font-bold flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
                <span>Paperwork Photo Inspection ({imageFileName || 'Captured Picture'})</span>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-black/40">
              <img
                src={currentImage}
                alt="Full paperwork preview"
                className="max-h-[75vh] object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Delivery Note: <strong className="text-white font-mono">{deliveryNoteNumber || 'N/A'}</strong></span>
              <span>Customer Job #: <strong className="text-blue-400 font-mono">{customerJobNumber || 'N/A'}</strong></span>
              <span>Components: <strong className="text-emerald-400">{amountOfComponents}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA CAPTURE MODAL */}
      {isCameraModalOpen && (
        <CameraCaptureModal
          isOpen={isCameraModalOpen}
          onClose={() => setIsCameraModalOpen(false)}
          onPhotosCaptured={handlePhotosCaptured}
          title="Take Photo of Customer Delivery Note / RFQ"
          categoryName="Delivery Note"
        />
      )}

    </div>
  );
}
