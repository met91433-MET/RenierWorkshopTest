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
  Camera
} from 'lucide-react';

interface ReceivingViewProps {
  customers: Customer[];
  componentsList: ComponentMatrix[];
  customColumns: CustomColumn[];
  onSaveJobs: (jobs: Job[]) => Promise<void>;
  currentUser: any;
  existingJobs?: Job[];
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
  existingJobs = []
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // File uploading states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<{ isDeliveryLevel: boolean; jobIdx?: number; categoryName?: string } | null>(null);

  // Helper to process array of Files
  const processFilesList = async (fileList: File[], isDeliveryLevel: boolean, jobIdx?: number) => {
    for (const file of fileList) {
      const { dataUrl, size } = await compressFile(file, 1024, 0.65);
      const jobFile: JobFile = {
        name: file.name,
        type: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
        size: size || file.size,
        dataUrl: dataUrl,
        uploadedAt: new Date().toISOString(),
        category: isDeliveryLevel ? 'delivery' : 'job'
      };

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

        // Tag delivery level files (document upload) explicitly as 'delivery' category
        const taggedDeliveryFiles = deliveryFiles.map(f => ({
          ...f,
          category: 'delivery' as const
        }));

        // Tag job component files as 'job' category if not already set
        const taggedJobFiles = item.files.map(f => ({
          ...f,
          category: f.category || ('job' as const)
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
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800 font-display flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-blue-500" />
          Job Receiving / Delivery Intake
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Capture incoming repair shipments. Multiple component jobs can be modularly registered under a single Delivery Note.
        </p>
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
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">1. Delivery Sheet Details</h2>
              
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
                            {availableModels.length === 0 && (
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
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">3. Document Upload</h2>
              
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Upload Delivery Note & Paperwork</p>
                <p className="text-[10px] text-slate-400 mt-1">Images/PDFs up to 800KB</p>
                
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCameraTarget({ isDeliveryLevel: true, categoryName: 'Delivery Paperwork' });
                      setIsCameraModalOpen(true);
                    }}
                    className="inline-flex text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5 cursor-pointer transition-colors items-center gap-1.5 shadow-2xs"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    Take Photo
                  </button>

                  <input
                    type="file"
                    multiple
                    id="delivery-file-upload"
                    onChange={(e) => handleFileChange(e, true)}
                    className="hidden"
                  />
                  <label
                    htmlFor="delivery-file-upload"
                    className="inline-flex text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-1.5 cursor-pointer transition-colors items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Browse Files
                  </label>
                </div>
              </div>

              {/* List Paperwork Files */}
              {deliveryFiles.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attached Paperwork</p>
                  <div className="space-y-1.5">
                    {deliveryFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-700">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="truncate max-w-[150px] font-medium">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx, true)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
        title="Take Photo"
        categoryName={cameraTarget?.categoryName}
        onPhotosCaptured={(files) => {
          if (cameraTarget) {
            processFilesList(files, cameraTarget.isDeliveryLevel, cameraTarget.jobIdx);
          }
        }}
      />
    </div>
  );
}
