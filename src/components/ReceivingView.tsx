import React, { useState, useRef } from 'react';
import { Customer, ComponentMatrix, CustomColumn, Job, JobFile, deduplicateJobFiles } from '../types';
import { generateNextComponentId } from '../utils/idUtils';
import { compressFile } from '../utils/imageCompressor';
import CameraCaptureModal from './CameraCaptureModal';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Upload, 
  CheckCircle, 
  Image as ImageIcon, 
  HelpCircle,
  FileSpreadsheet,
  Camera,
  Sparkles,
  Loader2,
  Scan,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ReceivingViewProps {
  customers: Customer[];
  componentsList: ComponentMatrix[];
  customColumns: CustomColumn[];
  onSaveJobs: (jobs: Job[]) => Promise<void>;
  currentUser: any;
  existingJobs?: Job[];
  initialPrepopulatedData?: {
    deliveryNoteNumber?: string;
    customerId?: string;
    customerJobNumber?: string;
    orderNumber?: string;
    dateReceived?: string;
    items?: {
      componentType: string;
      modelName: string;
      serialNumber: string;
      orderNumber?: string;
      customerJobNumber?: string;
      yourRef?: string;
    }[];
    files?: JobFile[];
  } | null;
}

interface TempJobItem {
  componentType: string;
  modelName: string;
  serialNumber: string; // Part Number
  files: JobFile[];
  orderNumber?: string;
  yourRef?: string;
  customerJobNumber?: string;
  dueDate?: string;
  workshopArea?: string;
}

export default function ReceivingView({
  customers,
  componentsList,
  customColumns,
  onSaveJobs,
  currentUser,
  existingJobs = [],
  initialPrepopulatedData = null
}: ReceivingViewProps) {
  // Main form fields
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryFiles, setDeliveryFiles] = useState<JobFile[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<{ [colId: string]: string }>({});

  const getDefaultDueDate = (fromDateStr?: string) => {
    const base = fromDateStr ? new Date(fromDateStr) : new Date();
    if (isNaN(base.getTime())) {
      const fallback = new Date();
      fallback.setMonth(fallback.getMonth() + 1);
      return fallback.toISOString().split('T')[0];
    }
    base.setMonth(base.getMonth() + 1);
    return base.toISOString().split('T')[0];
  };

  // Modular jobs inside this delivery
  const [jobItems, setJobItems] = useState<TempJobItem[]>(() => {
    const defaultType = componentsList[0]?.id || componentsList[0]?.name || 'Spindle';
    const firstComp = componentsList.find(c => c.id === defaultType || c.name === defaultType) || componentsList[0];
    const defaultModel = firstComp?.models[0] || '';
    return [{ 
      componentType: defaultType, 
      modelName: defaultModel, 
      serialNumber: '', 
      files: [],
      orderNumber: '',
      yourRef: 'NONE',
      customerJobNumber: 'NONE',
      dueDate: getDefaultDueDate(new Date().toISOString().split('T')[0]),
      workshopArea: '9B'
    }];
  });

  // Sync componentType with componentsList when component matrices load or update
  React.useEffect(() => {
    if (componentsList && componentsList.length > 0) {
      setJobItems(prev => prev.map(item => {
        const matched = componentsList.find(c => c.id === item.componentType || c.name === item.componentType);
        if (!matched) {
          const firstComp = componentsList[0];
          return {
            ...item,
            componentType: firstComp.id || firstComp.name,
            modelName: firstComp.models[0] || ''
          };
        }
        return item;
      }));
    }
  }, [componentsList]);

  // Handle pre-populated data from AI Paperwork Population module
  React.useEffect(() => {
    if (initialPrepopulatedData) {
      if (initialPrepopulatedData.deliveryNoteNumber) {
        setDeliveryNoteNumber(initialPrepopulatedData.deliveryNoteNumber);
      }
      if (initialPrepopulatedData.customerId) {
        setSelectedCustomerId(initialPrepopulatedData.customerId);
      }
      if (initialPrepopulatedData.dateReceived) {
        setDateReceived(initialPrepopulatedData.dateReceived);
      }
      if (Array.isArray(initialPrepopulatedData.files) && initialPrepopulatedData.files.length > 0) {
        setDeliveryFiles(initialPrepopulatedData.files);
      }
      if (Array.isArray(initialPrepopulatedData.items) && initialPrepopulatedData.items.length > 0) {
        setJobItems(initialPrepopulatedData.items.map(item => ({
          componentType: item.componentType || 'Spindle',
          modelName: item.modelName || '',
          serialNumber: item.serialNumber || '',
          files: [],
          orderNumber: item.orderNumber || initialPrepopulatedData.orderNumber || '',
          yourRef: item.yourRef || 'NONE',
          customerJobNumber: item.customerJobNumber || initialPrepopulatedData.customerJobNumber || 'NONE',
          dueDate: getDefaultDueDate(initialPrepopulatedData.dateReceived),
          workshopArea: '9B'
        })));
      }
      setAiExtractedBanner({
        summary: `Transferred from AI Paperwork Population: Delivery Note #${initialPrepopulatedData.deliveryNoteNumber || ''} with ${initialPrepopulatedData.items?.length || 0} component receiving lines.`,
        details: [
          `Delivery Note: ${initialPrepopulatedData.deliveryNoteNumber || 'N/A'}`,
          `Customer Job #: ${initialPrepopulatedData.customerJobNumber || 'N/A'}`,
          `Components: ${initialPrepopulatedData.items?.length || 0} receiving lines pre-populated`
        ],
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }, [initialPrepopulatedData]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // File uploading & AI extraction states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<{ isDeliveryLevel: boolean; jobIdx?: number; categoryName?: string } | null>(null);

  // Option for AI to auto populate the fields via picture taken from document upload
  const [autoPopulateEnabled, setAutoPopulateEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('metalogik_auto_populate_receiving');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleAutoPopulate = (val: boolean) => {
    setAutoPopulateEnabled(val);
    try {
      localStorage.setItem('metalogik_auto_populate_receiving', String(val));
    } catch {
      // ignore
    }
  };

  // AI Extraction state
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState('');
  const [aiExtractedBanner, setAiExtractedBanner] = useState<{
    summary: string;
    details: string[];
    timestamp: string;
    isError?: boolean;
  } | null>(null);

  // Auto-populate delivery information from picture using Gemini AI
  const autoPopulateFromPicture = async (
    imageUrls: string[],
    sourceType: 'delivery' | 'job',
    targetJobIdx?: number
  ) => {
    if (!imageUrls || imageUrls.length === 0) return;
    setIsExtractingAi(true);
    setAiStatusMsg('Reading document picture with Gemini AI vision...');
    setAiExtractedBanner(null);

    try {
      let result: any = null;
      let res = await fetch('/api/parse-delivery-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imageUrls,
          knownCustomers: customers.map(c => ({ id: c.id, name: c.name })),
          knownComponentTypes: componentsList.map(c => c.name || c.id)
        })
      });

      if (res.ok) {
        result = await res.json();
      }

      // If /api/parse-delivery-image failed or returned no data, fallback to /api/parse-paperwork-ai
      if (!result?.success || !result?.data) {
        setAiStatusMsg('Retrying with document OCR fallback...');
        res = await fetch('/api/parse-paperwork-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageUrls[0],
            knownCustomers: customers.map(c => ({ id: c.id, name: c.name })),
            knownComponentTypes: componentsList.map(c => c.name || c.id)
          })
        });
        if (res.ok) {
          result = await res.json();
        }
      }

      if (!result?.success || !result?.data) {
        throw new Error(result?.error || 'No readable paperwork details returned from photo analysis');
      }

      const info = result.data;
      const detectedDetails: string[] = [];

      // 1. Delivery Note Number
      const dn = info.deliveryNoteNumber?.trim();
      if (dn) {
        setDeliveryNoteNumber(dn);
        detectedDetails.push(`Delivery Note #: ${dn}`);
      }

      // 2. Customer matching
      let matchedCust: Customer | undefined;
      if (info.matchedCustomerId) {
        matchedCust = customers.find(c => c.id === info.matchedCustomerId);
      }
      if (!matchedCust && info.customerName) {
        const query = info.customerName.toLowerCase().trim();
        matchedCust = customers.find(c => 
          c.name.toLowerCase() === query || 
          c.name.toLowerCase().includes(query) || 
          query.includes(c.name.toLowerCase())
        );
      }
      if (matchedCust) {
        setSelectedCustomerId(matchedCust.id);
        detectedDetails.push(`Customer: ${matchedCust.name}`);
      } else if (info.customerName && info.customerName.trim()) {
        detectedDetails.push(`Customer detected: "${info.customerName}"`);
      }

      // 3. Date Received
      const rawDate = info.dateReceived || info.documentDate;
      if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        setDateReceived(rawDate);
        detectedDetails.push(`Date: ${rawDate}`);
      }

      // 4. Job Items & Reference fields
      const extractedLines = (Array.isArray(info.items) && info.items.length > 0)
        ? info.items
        : (Array.isArray(info.componentLines) && info.componentLines.length > 0)
          ? info.componentLines
          : [];
      const hasExtractedItems = extractedLines.length > 0;
      const generalOrderNumber = info.orderNumber?.trim() || '';
      const generalYourRef = info.yourRef?.trim() || '';
      const generalCustJob = info.customerJobNumber?.trim() || '';

      if (targetJobIdx !== undefined) {
        // Specific component/job row was targeted
        setJobItems(prev => {
          const updated = [...prev];
          if (updated[targetJobIdx]) {
            const firstItem = hasExtractedItems ? extractedLines[0] : null;
            if (firstItem?.serialNumber) {
              updated[targetJobIdx].serialNumber = firstItem.serialNumber;
              detectedDetails.push(`Part/Serial #: ${firstItem.serialNumber}`);
            }
            if (firstItem?.modelName) {
              updated[targetJobIdx].modelName = firstItem.modelName;
              detectedDetails.push(`Model: ${firstItem.modelName}`);
            }
            if (firstItem?.componentType) {
              const matchedComp = componentsList.find(c => 
                c.id.toLowerCase() === firstItem.componentType.toLowerCase() ||
                c.name.toLowerCase() === firstItem.componentType.toLowerCase()
              );
              if (matchedComp) {
                updated[targetJobIdx].componentType = matchedComp.id || matchedComp.name;
                detectedDetails.push(`Component: ${matchedComp.name || matchedComp.id}`);
              }
            }
            if (firstItem?.orderNumber || generalOrderNumber) {
              const poNum = firstItem?.orderNumber || generalOrderNumber;
              updated[targetJobIdx].orderNumber = poNum;
              detectedDetails.push(`Order/PO #: ${poNum}`);
            }
            if (generalYourRef) updated[targetJobIdx].yourRef = generalYourRef;
            if (generalCustJob) updated[targetJobIdx].customerJobNumber = generalCustJob;
          }
          return updated;
        });
      } else if (hasExtractedItems) {
        // Delivery note has one or more line items
        setJobItems(prev => {
          const newItems: TempJobItem[] = extractedLines.map((rawItem: any, index: number) => {
            const rawType = (rawItem.componentType || '').toLowerCase().trim();
            const matchedComp = componentsList.find(c => 
              c.id.toLowerCase() === rawType ||
              c.name.toLowerCase() === rawType ||
              rawType.includes(c.id.toLowerCase()) ||
              rawType.includes(c.name.toLowerCase())
            ) || componentsList[0];

            const compType = matchedComp ? (matchedComp.id || matchedComp.name) : (componentsList[0]?.id || 'Spindle');
            const model = rawItem.modelName?.trim() || matchedComp?.models[0] || '';
            const serial = rawItem.serialNumber?.trim() || '';
            const order = rawItem.orderNumber?.trim() || generalOrderNumber;
            const custJob = rawItem.customerJobNumber?.trim() || generalCustJob || 'NONE';

            if (serial || model) {
              detectedDetails.push(`Line ${index + 1}: ${model || compType} ${serial ? `(S/N: ${serial})` : ''}`);
            }

            // Preserve existing photos if modifying item 0
            const existingFiles = (index === 0 && prev[0]?.files) ? prev[0].files : [];

            return {
              componentType: compType,
              modelName: model,
              serialNumber: serial,
              files: existingFiles,
              orderNumber: order,
              yourRef: generalYourRef || 'NONE',
              customerJobNumber: custJob,
              dueDate: getDefaultDueDate(rawDate || dateReceived),
              workshopArea: '9B'
            };
          });

          return newItems.length > 0 ? newItems : prev;
        });
      } else {
        // Apply references to existing job items
        if (generalOrderNumber || generalYourRef || generalCustJob) {
          setJobItems(prev => prev.map(item => ({
            ...item,
            orderNumber: generalOrderNumber || item.orderNumber,
            yourRef: generalYourRef || item.yourRef,
            customerJobNumber: generalCustJob || item.customerJobNumber
          })));
          if (generalOrderNumber) detectedDetails.push(`Order/PO #: ${generalOrderNumber}`);
          if (generalYourRef) detectedDetails.push(`Your Ref: ${generalYourRef}`);
        }
      }

      if (detectedDetails.length > 0) {
        setAiExtractedBanner({
          summary: info.rawExtractedSummary || 'Delivery note information extracted successfully from picture.',
          details: detectedDetails,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: false
        });
      } else {
        setAiExtractedBanner({
          summary: info.rawExtractedSummary || 'Picture analyzed, but no recognizable delivery fields were detected.',
          details: ['You can enter or verify details manually.'],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: false
        });
      }
    } catch (err: any) {
      console.warn('AI Extraction from picture failed:', err);
      setAiExtractedBanner({
        summary: 'Could not auto-extract delivery information from picture.',
        details: [err?.message || 'Manual entry is available.'],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      });
    } finally {
      setIsExtractingAi(false);
      setAiStatusMsg('');
    }
  };

  // Helper to process array of Files and optionally auto-populate delivery information
  const processFilesList = async (
    fileList: File[], 
    isDeliveryLevel: boolean, 
    jobIdx?: number, 
    overrideAutoPopulate?: boolean
  ) => {
    const newlyAddedJobFiles: JobFile[] = [];
    for (const file of fileList) {
      const { dataUrl, size } = await compressFile(file, 1280, 0.72);
      const jobFile: JobFile = {
        name: file.name,
        type: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
        size: size || file.size,
        dataUrl: dataUrl,
        uploadedAt: new Date().toISOString(),
        category: isDeliveryLevel ? 'delivery' : 'job'
      };
      newlyAddedJobFiles.push(jobFile);

      if (isDeliveryLevel) {
        setDeliveryFiles(prev => deduplicateJobFiles([...prev, jobFile]));
      } else if (jobIdx !== undefined) {
        setJobItems(prev => {
          const updated = [...prev];
          updated[jobIdx].files = deduplicateJobFiles([...updated[jobIdx].files, jobFile]);
          return updated;
        });
      }
    }

    // Check if auto-population is requested (via explicit override or global toggle)
    const shouldAutoPopulate = overrideAutoPopulate !== undefined 
      ? overrideAutoPopulate 
      : (isDeliveryLevel ? autoPopulateEnabled : false);

    const imageFiles = newlyAddedJobFiles.filter(f => f.type.startsWith('image/') && f.dataUrl);
    if (imageFiles.length > 0 && shouldAutoPopulate) {
      const imageUrls = imageFiles.map(f => f.dataUrl);
      autoPopulateFromPicture(imageUrls, isDeliveryLevel ? 'delivery' : 'job', jobIdx);
    }
  };

  // Handle generic file to Base64 helper with compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isDeliveryLevel: boolean, jobIdx?: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await processFilesList(Array.from(files), isDeliveryLevel, jobIdx);
    e.target.value = '';
  };

  const removeFile = (idx: number, isDeliveryLevel: boolean, jobIdx?: number) => {
    if (isDeliveryLevel) {
      setDeliveryFiles(prev => prev.filter((_, i) => i !== idx));
    } else if (jobIdx !== undefined) {
      setJobItems(prev => {
        const updated = [...prev];
        updated[jobIdx].files = updated[jobIdx].files.filter((_, i) => i !== idx);
        return updated;
      });
    }
  };

  const addJobItem = () => {
    const defaultType = componentsList[0]?.id || componentsList[0]?.name || 'Spindle';
    const firstComp = componentsList.find(c => c.id === defaultType || c.name === defaultType) || componentsList[0];
    const defaultModel = firstComp?.models[0] || '';

    setJobItems(prev => [
      ...prev,
      { 
        componentType: defaultType, 
        modelName: defaultModel, 
        serialNumber: '', 
        files: [],
        orderNumber: '',
        yourRef: 'NONE',
        customerJobNumber: 'NONE',
        dueDate: getDefaultDueDate(dateReceived),
        workshopArea: '9B'
      }
    ]);
  };

  const removeJobItem = (idx: number) => {
    if (jobItems.length === 1) return; // Must have at least one job
    setJobItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateJobItem = (idx: number, field: keyof TempJobItem, value: any) => {
    setJobItems(prev => {
      const updated = [...prev];
      if (field === 'componentType') {
        updated[idx].componentType = value;
        // Reset model select to first model of this selected component
        const comp = componentsList.find(c => c.id === value || c.name === value);
        updated[idx].modelName = comp?.models[0] || '';
      } else {
        (updated[idx] as any)[field] = value;
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert("Please select a customer.");
      return;
    }
    if (!deliveryNoteNumber.trim()) {
      alert("Please enter a Delivery Note number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      const customerName = customer ? customer.name : 'Unknown Customer';

      // Map job items to actual Jobs
      const jobsToSave: Job[] = jobItems.map((item, idx) => {
        const jobId = generateNextComponentId(existingJobs, idx);

        // Tag delivery level files (document upload) explicitly as 'paperwork' category
        const taggedDeliveryFiles = deliveryFiles.map(f => ({
          ...f,
          category: 'paperwork' as const
        }));

        // Tag job component files as 'component' category if not already set
        const taggedJobFiles = item.files.map(f => ({
          ...f,
          category: f.category || ('component' as const)
        }));

        const combinedFiles = deduplicateJobFiles([...taggedDeliveryFiles, ...taggedJobFiles]);

        return {
          id: jobId,
          deliveryNoteNumber,
          customerId: selectedCustomerId,
          customerName,
          componentType: item.componentType,
          modelName: item.modelName,
          serialNumber: item.serialNumber,
          status: 'Received',
          customFields: customFieldValues,
          files: combinedFiles,
          dateReceived,
          capturedBy: currentUser?.displayName || currentUser?.email || 'Workshop Receiver',
          jobCardDetails: {
            orderNumber: item.orderNumber || '',
            yourRef: item.yourRef || 'NONE',
            customerJobNumber: item.customerJobNumber || 'NONE',
            dueDate: item.dueDate || getDefaultDueDate(dateReceived),
            workshopArea: item.workshopArea || '9B'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });

      await onSaveJobs(jobsToSave);

      // Reset Form on Success
      setSelectedCustomerId('');
      setDeliveryNoteNumber('');
      setDeliveryFiles([]);
      setCustomFieldValues({});
      const resetType = componentsList[0]?.id || componentsList[0]?.name || 'Spindle';
      const resetComp = componentsList.find(c => c.id === resetType || c.name === resetType) || componentsList[0];
      setJobItems([{ 
        componentType: resetType, 
        modelName: resetComp?.models[0] || '', 
        serialNumber: '', 
        files: [],
        orderNumber: '',
        yourRef: 'NONE',
        customerJobNumber: 'NONE',
        dueDate: getDefaultDueDate(new Date().toISOString().split('T')[0]),
        workshopArea: '9B'
      }]);

      setSuccessMsg(`Successfully registered ${jobsToSave.length} jobs under Delivery Note ${deliveryNoteNumber}!`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving the jobs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" id="receiving-view-root">
      {/* Page Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 font-display flex items-center justify-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-blue-500" />
          Job Receiving
        </h1>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-medium text-sm">{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section 1: Delivery Sheet Information */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">1. Delivery Sheet Details</h2>
                {deliveryFiles.filter(f => f.type.startsWith('image/')).length > 0 && (
                  <button
                    type="button"
                    disabled={isExtractingAi}
                    onClick={() => {
                      const imgs = deliveryFiles.filter(f => f.type.startsWith('image/')).map(f => f.dataUrl);
                      autoPopulateFromPicture(imgs, 'delivery');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    Re-extract From Picture
                  </button>
                )}
              </div>

              {/* AI Processing Status */}
              {isExtractingAi && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex items-center gap-3 text-indigo-900 text-xs animate-pulse">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
                  <div className="flex-1 font-medium">
                    {aiStatusMsg || 'Analyzing picture with AI to populate delivery information...'}
                  </div>
                </div>
              )}

              {/* AI Extracted Information Summary */}
              {aiExtractedBanner && (
                <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
                  aiExtractedBanner.isError 
                    ? 'bg-amber-50 border-amber-200 text-amber-900' 
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-slate-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>AI Auto-Populated from Picture</span>
                      <span className="text-[10px] text-slate-400 font-normal">at {aiExtractedBanner.timestamp}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiExtractedBanner(null)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">{aiExtractedBanner.summary}</p>
                  {aiExtractedBanner.details && aiExtractedBanner.details.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {aiExtractedBanner.details.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white border border-blue-200 text-blue-900 px-2 py-0.5 rounded-md shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer *</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Delivery Note Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Delivery Note Number *</label>
                  <input
                    type="text"
                    required
                    value={deliveryNoteNumber}
                    onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                    placeholder="e.g. DN-1004"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                {/* Date Received */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date Received</label>
                  <input
                    type="date"
                    required
                    value={dateReceived}
                    onChange={(e) => setDateReceived(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                {/* Dynamic Columns Custom Fields */}
                {customColumns.filter(col => col.id !== 'damage_severity' && col.label !== 'Damage Severity Level').map(col => (
                  <div key={col.id}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">{col.label}</label>
                    <input
                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                      value={customFieldValues[col.id] || ''}
                      onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [col.id]: e.target.value }))}
                      placeholder={`Enter ${col.label.toLowerCase()}`}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Component Jobs attached */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">2. Jobs on this delivery</h2>
                <button
                  type="button"
                  onClick={addJobItem}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Another Component
                </button>
              </div>

              <div className="space-y-4">
                {jobItems.map((item, idx) => {
                  const availableModels = (
                    componentsList.find(c => c.id === item.componentType || c.name === item.componentType) ||
                    componentsList.find(c => c.id.toLowerCase().replace(/\s+/g, '') === item.componentType?.toLowerCase().replace(/\s+/g, '')) ||
                    componentsList[0]
                  )?.models || [];

                  return (
                    <div key={idx} className="p-5 bg-slate-50/30 rounded-2xl border border-slate-200 space-y-4 relative pb-14">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
                          Component Job #{idx + 1}
                        </span>
                        {jobItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeJobItem(idx)}
                            className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Component Type */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Component Type *</label>
                          <select
                            value={item.componentType}
                            onChange={(e) => updateJobItem(idx, 'componentType', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                          >
                            {componentsList.map(comp => (
                              <option key={comp.id} value={comp.id}>{comp.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Model */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Model *</label>
                          <select
                            value={item.modelName}
                            onChange={(e) => updateJobItem(idx, 'modelName', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                          >
                            {availableModels.map((m, mIdx) => (
                              <option key={`${m}-${mIdx}`} value={m}>{m}</option>
                            ))}
                            {item.modelName && !availableModels.includes(item.modelName) && (
                              <option value={item.modelName}>{item.modelName} (Detected)</option>
                            )}
                            {availableModels.length === 0 && !item.modelName && (
                              <option value="">-- No models found --</option>
                            )}
                          </select>
                        </div>

                        {/* Part Number */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Part Number</label>
                          <input
                            type="text"
                            placeholder="e.g. PN-552A (Optional)"
                            value={item.serialNumber}
                            onChange={(e) => updateJobItem(idx, 'serialNumber', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Optional Workshop Job Card details */}
                      <div className="border-t border-slate-200/60 pt-4 mt-4 space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Workshop Job Card Config (Optional)
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                          {/* Order Number */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left">Order Number</label>
                            <input
                              type="text"
                              placeholder="e.g. 2604 EDWARD"
                              value={item.orderNumber || ''}
                              onChange={(e) => updateJobItem(idx, 'orderNumber', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                            />
                          </div>

                          {/* Workshop Area */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left">Workshop Area</label>
                            <input
                              type="text"
                              placeholder="e.g. 9B"
                              value={item.workshopArea || '9B'}
                              onChange={(e) => updateJobItem(idx, 'workshopArea', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-mono font-bold"
                            />
                          </div>

                          {/* Your Ref */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left">Your Ref</label>
                            <input
                              type="text"
                              placeholder="e.g. NONE"
                              value={item.yourRef || 'NONE'}
                              onChange={(e) => updateJobItem(idx, 'yourRef', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                            />
                          </div>

                          {/* Customer Job Number */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left">Customer Job #</label>
                            <input
                              type="text"
                              placeholder="e.g. NONE"
                              value={item.customerJobNumber || 'NONE'}
                              onChange={(e) => updateJobItem(idx, 'customerJobNumber', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                            />
                          </div>

                          {/* Due Date (Defaults to 1 month from receive date) */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left">Due Date</label>
                            <input
                              type="date"
                              value={item.dueDate || getDefaultDueDate(dateReceived)}
                              onChange={(e) => updateJobItem(idx, 'dueDate', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-semibold text-slate-800"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Component Job Pictures */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Job / Component Pictures</label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setCameraTarget({ isDeliveryLevel: false, jobIdx: idx, categoryName: `Job #${idx + 1}` });
                              setIsCameraModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5 cursor-pointer shadow-2xs transition-all"
                          >
                            <Camera className="w-3.5 h-3.5 text-emerald-600" />
                            Take Photo
                          </button>

                          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer select-none">
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            Upload Component Photos
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => handleFileChange(e, false, idx)}
                              className="hidden"
                            />
                          </label>

                          {/* Render Job Files */}
                          {item.files.map((file, fileIdx) => (
                            <div key={fileIdx} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg pl-2 pr-1 py-1 text-xs text-blue-800">
                              <ImageIcon className="w-3 h-3 text-blue-500" />
                              <span className="max-w-[120px] truncate">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeFile(fileIdx, false, idx)}
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 p-0.5 rounded-md"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bottom-right corner Job indication */}
                      <div className="absolute bottom-4 right-4 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
                        {jobItems.length === 1 ? '1 of 1' : `Job ${idx + 1} of ${jobItems.length}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Paperwork & Submit */}
          <div className="space-y-6">
            {/* Paperwork Upload Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">3. Document Upload</h2>
                
                {/* AI Auto-Populate Option Switch */}
                <label 
                  className={`inline-flex items-center gap-2 cursor-pointer border px-2.5 py-1.5 rounded-xl transition-all select-none ${
                    autoPopulateEnabled 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-2xs' 
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                  title="When enabled, taking a picture or uploading paperwork automatically reads and populates delivery note, customer, and components"
                >
                  <input
                    type="checkbox"
                    checked={autoPopulateEnabled}
                    onChange={(e) => toggleAutoPopulate(e.target.checked)}
                    className="w-4 h-4 rounded-md accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className={`w-3.5 h-3.5 ${autoPopulateEnabled ? 'text-indigo-600' : 'text-slate-400'}`} />
                    Auto-populate with AI
                  </span>
                </label>
              </div>
              
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center hover:bg-slate-50/80 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">Upload or Photograph Delivery Note</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  Snap a photo of paperwork to automatically populate delivery number, customer, and equipment rows.
                </p>
                
                <div className="flex items-center justify-center gap-2.5 mt-4 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setCameraTarget({ isDeliveryLevel: true, categoryName: 'Delivery Paperwork' });
                      setIsCameraModalOpen(true);
                    }}
                    className="inline-flex text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl px-4 py-2 cursor-pointer transition-all items-center gap-2 shadow-sm hover:shadow"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Photo</span>
                    {autoPopulateEnabled && (
                      <span className="bg-emerald-700/80 text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                  </button>

                  <input
                    type="file"
                    multiple
                    id="delivery-file-upload"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileChange(e, true)}
                    className="hidden"
                  />
                  <label
                    htmlFor="delivery-file-upload"
                    className="inline-flex text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 cursor-pointer transition-all items-center gap-2 shadow-2xs"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    Browse Files
                  </label>
                </div>
              </div>

              {/* Extract Info from Picture action */}
              {deliveryFiles.filter(f => f.type.startsWith('image/')).length > 0 && (
                <div className="p-3.5 bg-gradient-to-r from-indigo-50/90 to-blue-50/90 border border-indigo-200/80 rounded-2xl space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      AI Document Extraction
                    </span>
                    <span className="text-[10px] bg-white border border-indigo-200 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                      {deliveryFiles.filter(f => f.type.startsWith('image/')).length} photo(s) attached
                    </span>
                  </div>

                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    Read Delivery Note #, customer name, date, and create equipment rows directly from the picture.
                  </p>

                  <button
                    type="button"
                    disabled={isExtractingAi}
                    onClick={() => {
                      const imgs = deliveryFiles.filter(f => f.type.startsWith('image/')).map(f => f.dataUrl);
                      autoPopulateFromPicture(imgs, 'delivery');
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl py-2.5 px-4 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isExtractingAi ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        {aiStatusMsg || 'Analyzing Document with AI...'}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-indigo-200" />
                        Auto-Populate Fields from Picture
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* List Paperwork Files with thumbnail preview */}
              {deliveryFiles.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attached Paperwork ({deliveryFiles.length})</p>
                  <div className="space-y-1.5">
                    {deliveryFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {file.type.startsWith('image/') && file.dataUrl ? (
                            <img 
                              src={file.dataUrl} 
                              alt={file.name} 
                              className="w-9 h-9 object-cover rounded-lg border border-slate-200 flex-shrink-0 bg-white" 
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-200/80 flex items-center justify-center flex-shrink-0 text-slate-500">
                              <FileText className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="truncate block font-semibold text-slate-800">{file.name}</span>
                            <span className="text-[10px] text-slate-400">
                              {(file.size / 1024).toFixed(0)} KB {file.type.startsWith('image/') && '• Paperwork photo'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {file.type.startsWith('image/') && (
                            <button
                              type="button"
                              disabled={isExtractingAi}
                              onClick={() => autoPopulateFromPicture([file.dataUrl], 'delivery')}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                              title="Re-run AI extraction on this photo"
                            >
                              Scan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(idx, true)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg cursor-pointer"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Action Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">4. Complete Capture</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Clicking register will save each item above as an active job linked to delivery sheet <strong>{deliveryNoteNumber || '--'}</strong>.
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-sm hover:shadow-md transition-all text-sm disabled:opacity-55 cursor-pointer select-none"
              >
                {isSubmitting ? 'Registering Delivery...' : `Register ${jobItems.length} Job${jobItems.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        title={cameraTarget?.isDeliveryLevel ? "Photograph Paperwork" : "Take Photo"}
        categoryName={cameraTarget?.categoryName}
        enableAiOption={cameraTarget?.isDeliveryLevel}
        isAiOptionDefault={autoPopulateEnabled}
        onPhotosCaptured={(files, shouldAutoPopulate) => {
          if (cameraTarget) {
            processFilesList(files, cameraTarget.isDeliveryLevel, cameraTarget.jobIdx, shouldAutoPopulate);
          }
        }}
      />
    </div>
  );
}
