import React, { useState, useEffect } from 'react';
import { Job, JobFile, deduplicateJobFiles } from '../types';
import { compressFile } from '../utils/imageCompressor';
import CameraCaptureModal from './CameraCaptureModal';
import { 
  ClipboardCheck, 
  Search, 
  Trash2, 
  Upload, 
  Image as ImageIcon,
  AlertCircle,
  ArrowRight,
  Info,
  FileText,
  Folder,
  FolderOpen,
  Truck,
  Wrench,
  CheckCircle2,
  Tag,
  Plus,
  RefreshCw,
  ExternalLink,
  Filter,
  Camera,
  X,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  FileImage
} from 'lucide-react';

interface InspectionViewProps {
  jobs: Job[];
  onUpdateJob: (job: Job) => Promise<void>;
  currentUser: any;
}

type PhotoCategory = 'paperwork' | 'component' | 'inspection' | 'final_inspection' | 'delivery';

// Helper to test if file is an image
const isPictureFile = (file: JobFile): boolean => {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  const name = file.name || '';
  return /\.(jpg|jpeg|png|gif|webp|heic|svg)$/i.test(name) || (file.dataUrl && file.dataUrl.startsWith('data:image/'));
};

// Helper to categorize photos into the 5 slider categories
const getPhotoCategory = (file: JobFile): PhotoCategory => {
  const cat = (file.category || '').toLowerCase();
  if (cat === 'paperwork' || cat === 'document' || cat === 'documents') return 'paperwork';
  if (cat === 'component' || cat === 'job' || cat === 'components') return 'component';
  if (cat === 'inspection' || cat === 'qc') return 'inspection';
  if (cat === 'final_inspection' || cat === 'final-inspection' || cat === 'final') return 'final_inspection';
  if (cat === 'delivery' || cat === 'dispatch' || cat === 'delivery_final') return 'delivery';

  // Fallback heuristic by name
  const nameLower = (file.name || '').toLowerCase();
  if (nameLower.includes('paperwork') || nameLower.includes('pod') || nameLower.includes('dn_') || nameLower.includes('doc')) {
    return 'paperwork';
  }
  if (nameLower.includes('final') || nameLower.includes('signoff') || nameLower.includes('release')) {
    return 'final_inspection';
  }
  if (nameLower.includes('delivery') || nameLower.includes('dispatch') || nameLower.includes('leaving')) {
    return 'delivery';
  }
  if (nameLower.includes('inspect') || nameLower.includes('qc') || nameLower.includes('finding')) {
    return 'inspection';
  }

  if (file.category === 'delivery') return 'paperwork';

  return 'component';
};

export default function InspectionView({
  jobs,
  onUpdateJob,
  currentUser
}: InspectionViewProps) {
  // Helper to determine Job sequence (e.g. Job 1 of 3)
  const getJobSequenceString = (job: Job, allJobs: Job[]): string => {
    const deliveryJobs = allJobs.filter(j => j.deliveryNoteNumber === job.deliveryNoteNumber);
    const total = deliveryJobs.length;
    const sorted = [...deliveryJobs].sort((a, b) => {
      const timeA = a.createdAt || '';
      const timeB = b.createdAt || '';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return a.id.localeCompare(b.id);
    });
    const index = sorted.findIndex(j => j.id === job.id) + 1;
    return total <= 1 ? "1 of 1" : `Job ${index} of ${total}`;
  };

  // Filter pending Stage 2 jobs (Pending Components)
  const pendingJobs = jobs.filter(job => job.status === 'Received');

  // Slider switch mode: 'pending' (Pending Components) vs 'upload' (Upload Photos)
  const [activeSliderMode, setActiveSliderMode] = useState<'pending' | 'upload'>('pending');

  const [searchTerm, setSearchTerm] = useState('');
  const [uploadSearchTerm, setUploadSearchTerm] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Derive selectedJob dynamically from `jobs` array so edits refresh instantly
  const selectedJob = jobs.find(j => j.id === selectedJobId) || null;

  // Targeted Photo Upload & Gallery State
  const [activePhotoSlideIndex, setActivePhotoSlideIndex] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraCategory, setCameraCategory] = useState<PhotoCategory | undefined>(undefined);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; name: string; category?: string; uploadedAt?: string; size?: number; originalIdx?: number } | null>(null);
  const [deletingFileIndex, setDeletingFileIndex] = useState<number | null>(null);

  // Inspection Form State
  const [inspectorName, setInspectorName] = useState(currentUser?.displayName || currentUser?.email || '');
  const [inspectedAt, setInspectedAt] = useState(new Date().toISOString().split('T')[0]);
  const [findings, setFindings] = useState('');
  const [customerInstructions, setCustomerInstructions] = useState('');
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto select first pending job when switching to pending mode if no job is selected
  useEffect(() => {
    if (activeSliderMode === 'pending' && !selectedJobId && pendingJobs.length > 0) {
      setSelectedJobId(pendingJobs[0].id);
    }
  }, [activeSliderMode]);

  // Update inspection form fields whenever selectedJob changes
  useEffect(() => {
    if (selectedJob) {
      setInspectorName(selectedJob.inspectionDetails?.inspectorName || currentUser?.displayName || currentUser?.email || '');
      setInspectedAt(selectedJob.inspectionDetails?.inspectedAt || new Date().toISOString().split('T')[0]);
      setFindings(selectedJob.inspectionDetails?.findings || '');
      setCustomerInstructions(selectedJob.inspectionDetails?.customerInstructions || '');
      setInspectorNotes(selectedJob.inspectionDetails?.inspectorNotes || '');
    }
  }, [selectedJobId]);

  const handleSelectJob = (job: Job) => {
    setSelectedJobId(job.id);
  };

  // Upload targeted photos directly to selected folder for a job
  const processTargetedPhotoFiles = async (
    fileList: File[],
    categoryToUse?: PhotoCategory,
    jobToUse?: Job
  ) => {
    const activeJob = jobToUse || selectedJob;
    if (!fileList || fileList.length === 0 || !activeJob) return;

    const category = categoryToUse || 'inspection';
    setIsUploading(true);

    try {
      const newJobFiles: JobFile[] = [];

      for (const file of fileList) {
        const { dataUrl, size } = await compressFile(file, 1024, 0.65);

        newJobFiles.push({
          name: file.name,
          type: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
          size: size || file.size,
          dataUrl: dataUrl,
          uploadedAt: new Date().toISOString(),
          category: category
        });
      }

      if (newJobFiles.length > 0) {
        if ((category === 'delivery' || category === 'paperwork') && activeJob.deliveryNoteNumber) {
          // Sync delivery/paperwork photos across all jobs on this delivery note
          const deliveryJobs = jobs.filter(j => j.deliveryNoteNumber === activeJob.deliveryNoteNumber);
          for (const dJob of deliveryJobs) {
            const updatedFiles = deduplicateJobFiles([...(dJob.files || []), ...newJobFiles]);
            const updatedJob: Job = {
              ...dJob,
              files: updatedFiles,
              updatedAt: new Date().toISOString()
            };
            await onUpdateJob(updatedJob);
          }
        } else {
          const updatedFiles = deduplicateJobFiles([...(activeJob.files || []), ...newJobFiles]);
          const updatedJob: Job = {
            ...activeJob,
            files: updatedFiles,
            updatedAt: new Date().toISOString()
          };
          await onUpdateJob(updatedJob);
        }
      }
    } catch (err) {
      console.error("Photo upload error:", err);
      alert("Failed to upload photos.");
    } finally {
      setIsUploading(false);
    }
  };

  // Delete a photo from a job
  const handleDeletePhoto = async (fileIndex: number, targetJob?: Job) => {
    const activeJob = targetJob || selectedJob;
    if (!activeJob || !activeJob.files) return;

    const fileToDelete = activeJob.files[fileIndex];
    if (!fileToDelete) return;

    const updatedFiles = activeJob.files.filter((_, idx) => idx !== fileIndex);
    const updatedJob: Job = {
      ...activeJob,
      files: updatedFiles,
      updatedAt: new Date().toISOString()
    };

    await onUpdateJob(updatedJob);
  };

  // Submit Inspection Sheet & Pass to Pre-Quote
  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!findings.trim()) {
      alert("Please enter inspection findings or damage assessment.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newStatus = selectedJob.status === 'Received' ? 'Inspected' : selectedJob.status;

      const updatedJob: Job = {
        ...selectedJob,
        status: newStatus,
        inspectionDetails: {
          inspectorName,
          inspectedAt,
          findings,
          customerInstructions,
          inspectorNotes
        },
        updatedAt: new Date().toISOString()
      };

      await onUpdateJob(updatedJob);
      alert(`Inspection details saved for ${selectedJob.id}.${selectedJob.status === 'Received' ? ' Advanced to Pre-Quote stage.' : ''}`);
    } catch (error) {
      console.error(error);
      alert("Error saving inspection details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter list of pending jobs based on search query
  const filteredPendingJobs = pendingJobs.filter(job => 
    !searchTerm.trim() ||
    job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.componentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Search list of all jobs for Upload Photos mode
  const uploadQuery = uploadSearchTerm.trim().toLowerCase();
  const matchedUploadJobs = (uploadQuery
    ? jobs.filter(j => 
        j.id.toLowerCase().includes(uploadQuery) ||
        (j.jobCardDetails?.jobCardNumber && j.jobCardDetails.jobCardNumber.toLowerCase().includes(uploadQuery)) ||
        j.customerName.toLowerCase().includes(uploadQuery) ||
        j.componentType.toLowerCase().includes(uploadQuery) ||
        j.modelName.toLowerCase().includes(uploadQuery) ||
        j.serialNumber.toLowerCase().includes(uploadQuery) ||
        j.deliveryNoteNumber.toLowerCase().includes(uploadQuery)
      )
    : jobs).slice(0, 4);

  return (
    <div className="space-y-6" id="inspection-view-root">
      {/* Header Banner with Slider Switcher */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 font-display flex items-center justify-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-amber-500" />
          Inspection
        </h1>

        {/* SLIDER SEGMENTED TOGGLE SWITCH */}
        <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1 shrink-0">
          <button
            onClick={() => setActiveSliderMode('pending')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSliderMode === 'pending'
                ? 'bg-amber-500 text-white shadow-xs ring-1 ring-amber-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Pending Components</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              activeSliderMode === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {pendingJobs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSliderMode('upload')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSliderMode === 'upload'
                ? 'bg-slate-900 text-white shadow-xs ring-1 ring-slate-800/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Camera className="w-4 h-4 text-amber-400" />
            <span>Upload Photos</span>
          </button>
        </div>
      </div>

      {/* MODE 1: PENDING COMPONENTS VIEW */}
      {activeSliderMode === 'pending' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left Column: Pending Jobs Selector */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-800 font-display">
                  Pending Components
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {pendingJobs.length}
                </span>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search pending components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-amber-500 font-medium"
              />
            </div>

            {/* Job List */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {filteredPendingJobs.length === 0 ? (
                <div className="text-center py-10 px-3 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-emerald-500/70" />
                  <p className="text-xs font-bold text-slate-700">No pending components</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {searchTerm.trim() ? "No pending components match your search query." : "All received jobs have passed Stage 2 inspection."}
                  </p>
                </div>
              ) : (
                filteredPendingJobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => handleSelectJob(job)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      selectedJob?.id === job.id
                        ? 'border-amber-500 bg-amber-50/40 shadow-xs ring-1 ring-amber-400/30'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800 font-display flex items-center gap-1.5">
                        {job.id}
                        <span className="text-[10px] font-semibold text-slate-400 font-mono">({getJobSequenceString(job, jobs)})</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200">
                        Received
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 font-medium mt-1 truncate">
                      {job.customerName}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 truncate max-w-[160px]">
                        {job.componentType} ({job.modelName})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">SN: {job.serialNumber}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Clean Inspection Sheet Form */}
          <div className="lg:col-span-2">
            {selectedJob ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
                {/* Job Header Bar */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-md border border-amber-200 uppercase">
                        Job #{selectedJob.id}
                      </span>
                      {selectedJob.jobCardDetails?.jobCardNumber && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-200">
                          Job Card #{selectedJob.jobCardDetails.jobCardNumber}
                        </span>
                      )}
                      <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        DN: {selectedJob.deliveryNoteNumber}
                      </span>
                      <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        SN: {selectedJob.serialNumber}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 font-display mt-1.5">
                      {selectedJob.customerName} - {selectedJob.componentType} ({selectedJob.modelName})
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      {selectedJob.status}
                    </span>
                  </div>
                </div>

                {/* INSPECTION FINDINGS SHEET & RECORD FORM */}
                <form onSubmit={handleSubmitInspection} className="border border-slate-200 rounded-xl p-5 bg-white space-y-5">
                  <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 font-display flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-amber-500" />
                      Inspection Details & Findings Report
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">
                      Inspector: {inspectorName || 'Unassigned'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Inspector Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Inspector Name *</label>
                      <input
                        type="text"
                        required
                        value={inspectorName}
                        onChange={(e) => setInspectorName(e.target.value)}
                        placeholder="e.g. Lead Technician Bob"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-medium focus:outline-hidden focus:border-amber-500"
                      />
                    </div>

                    {/* Inspection Date */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date Inspected</label>
                      <input
                        type="date"
                        required
                        value={inspectedAt}
                        onChange={(e) => setInspectedAt(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-medium focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Customer Repair Instructions */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      Customer Repair Process Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={customerInstructions}
                      onChange={(e) => setCustomerInstructions(e.target.value)}
                      placeholder="e.g. Customer requested NDT crack testing and sandblasting report prior to quotation."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  {/* Findings / Damage Assessment */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Inspection Findings / Damage Assessment *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={findings}
                      onChange={(e) => setFindings(e.target.value)}
                      placeholder="Describe specific damage, wear measurements, cracked housings, or rebuilding required..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  {/* Form Footer Action Buttons */}
                  <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      {selectedJob.status === 'Received'
                        ? "Submitting will mark job as Inspected and advance to Pre-Quote."
                        : "Job is already past Receiving. Updates will save findings without changing status."}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Take / Add Inspection Photos Button Group */}
                      <button
                        type="button"
                        onClick={() => {
                          setCameraCategory('inspection');
                          setIsCameraOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                        title="Take inspection photos with camera"
                      >
                        <Camera className="w-4 h-4 text-amber-400" />
                        <span>Take Inspection Photos</span>
                      </button>

                      <label className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-2xs">
                        <Upload className="w-4 h-4 text-amber-600" />
                        <span>Upload Photos</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={async (e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              await processTargetedPhotoFiles(Array.from(e.target.files), 'inspection');
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmitting ? 'Saving Findings...' : 'Save Inspection Details'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <h3 className="text-base font-semibold text-slate-700">Select a pending component to inspect</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Pick a job from the pending components list on the left to enter inspection findings and advance it to the pre-quote stage.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: UPLOAD PHOTOS VIEW */}
      {activeSliderMode === 'upload' && (
        <div className="space-y-6 animate-fadeIn">
          {/* TOP SEARCH & TARGET JOB BANNER */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                  <Search className="w-4.5 h-4.5 text-amber-500" />
                  Target Job / Component Search
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search by Job #, Job Card #, Customer, Component, Serial #, or Delivery Note # to view and upload photos.
                </p>
              </div>

              {selectedJob && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Targeted: Job #{selectedJob.id}
                  </span>
                </div>
              )}
            </div>

            {/* Search Bar Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Type Job # (e.g. J2026-0001), JC #, Customer Name, Serial #, Component..."
                value={uploadSearchTerm}
                onChange={(e) => setUploadSearchTerm(e.target.value)}
                className="pl-10 pr-10 py-3 w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-amber-500 focus:bg-white transition-all shadow-2xs"
              />
              {uploadSearchTerm && (
                <button
                  type="button"
                  onClick={() => setUploadSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* SEARCH RESULTS MATCHING JOBS GRID */}
            {(uploadQuery || !selectedJob) && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  <span>{uploadQuery ? `Matching Jobs (${matchedUploadJobs.length})` : 'Select a Job to Target'}</span>
                  {!uploadQuery && <span className="text-slate-400 font-normal">Recent Jobs</span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[240px] overflow-y-auto p-0.5">
                  {matchedUploadJobs.length === 0 ? (
                    <div className="col-span-full text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <AlertCircle className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">No matching jobs found</p>
                      <p className="text-[11px] text-slate-400">Try searching with a different Job #, JC #, or Customer Name.</p>
                    </div>
                  ) : (
                    matchedUploadJobs.map(job => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          setSelectedJobId(job.id);
                          if (uploadQuery) setUploadSearchTerm('');
                        }}
                        className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          selectedJob?.id === job.id
                            ? 'border-amber-500 bg-amber-50/60 shadow-xs ring-1 ring-amber-400/30'
                            : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 font-display flex items-center gap-1">
                            {job.id}
                            {job.jobCardDetails?.jobCardNumber && (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                JC:{job.jobCardDetails.jobCardNumber}
                              </span>
                            )}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {job.status}
                          </span>
                        </div>

                        <p className="text-[11px] font-semibold text-slate-700 truncate mt-1">
                          {job.customerName}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                          <span className="truncate max-w-[120px]">{job.componentType}</span>
                          <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded">
                            {job.files?.length || 0} pics
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* CURRENT TARGETED JOB SUMMARY BANNER */}
            {selectedJob && (
              <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-extrabold text-amber-400 font-mono">
                      Job #{selectedJob.id}
                    </span>
                    {selectedJob.jobCardDetails?.jobCardNumber && (
                      <span className="font-bold text-emerald-400 font-mono">
                        JC #{selectedJob.jobCardDetails.jobCardNumber}
                      </span>
                    )}
                    <span className="text-slate-300 font-mono">DN: {selectedJob.deliveryNoteNumber}</span>
                    <span className="text-slate-300 font-mono">SN: {selectedJob.serialNumber}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1">
                    {selectedJob.customerName} — {selectedJob.componentType} ({selectedJob.modelName})
                  </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold bg-slate-800 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700">
                    Status: {selectedJob.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 5-SLIDER GALLERY VIEW (Paperwork, Component, Inspection, Final Inspection, Delivery) */}
          {selectedJob ? (
            (() => {
              const PHOTO_SLIDES = [
                {
                  key: 'paperwork' as const,
                  num: 1,
                  title: 'Paperwork',
                  subtitle: 'Document upload photos from Job Receiving',
                  icon: FileText,
                  activeBg: 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700',
                  description: 'Pictures taken in job receiving under document upload (delivery notes, customer paperwork, purchase orders) are stored here.'
                },
                {
                  key: 'component' as const,
                  num: 2,
                  title: 'Components',
                  subtitle: 'Job receiving component photos',
                  icon: Wrench,
                  activeBg: 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-700',
                  description: 'Pictures taken in job receiving under each component item (as-received condition, serial plates, housings) are stored here.'
                },
                {
                  key: 'inspection' as const,
                  num: 3,
                  title: 'Inspection',
                  subtitle: 'Technical QC & damage assessment photos',
                  icon: ClipboardCheck,
                  activeBg: 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-700',
                  description: 'Pictures taken during technical inspection, teardown findings, and damage assessments.'
                },
                {
                  key: 'final_inspection' as const,
                  num: 4,
                  title: 'Final Inspection',
                  subtitle: 'Pre-release QC sign-off photos',
                  icon: ShieldCheck,
                  activeBg: 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700',
                  description: 'Photos taken during final quality checks before job release. At least one photo required here before a job can be closed.'
                },
                {
                  key: 'delivery' as const,
                  num: 5,
                  title: 'Delivery',
                  subtitle: 'Final photos when job leaves premises',
                  icon: Truck,
                  activeBg: 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-700',
                  description: 'Final photos of completed job packaged, loaded onto truck, or leaving the premises at dispatch.'
                }
              ];

              const pictures = (selectedJob.files || [])
                .map((file, originalIdx) => ({ file, originalIdx }))
                .filter(item => isPictureFile(item.file));

              const paperworkPhotos = pictures.filter(item => getPhotoCategory(item.file) === 'paperwork');
              const componentPhotos = pictures.filter(item => getPhotoCategory(item.file) === 'component');
              const inspectionPhotos = pictures.filter(item => getPhotoCategory(item.file) === 'inspection');
              const finalInspectionPhotos = pictures.filter(item => getPhotoCategory(item.file) === 'final_inspection');
              const deliveryPhotos = pictures.filter(item => getPhotoCategory(item.file) === 'delivery');

              const slideCounts = [
                paperworkPhotos.length,
                componentPhotos.length,
                inspectionPhotos.length,
                finalInspectionPhotos.length,
                deliveryPhotos.length
              ];

              const currentSlide = PHOTO_SLIDES[activePhotoSlideIndex] || PHOTO_SLIDES[0];
              const currentSlidePhotos = pictures.filter(
                item => getPhotoCategory(item.file) === currentSlide.key
              );

              return (
                <div className="space-y-5">
                  {/* 5-SLIDER TAB NAVIGATION SWITCHER */}
                  <div className="bg-slate-100 p-2 rounded-2xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                      {PHOTO_SLIDES.map((slide, idx) => {
                        const SlideIcon = slide.icon;
                        const count = slideCounts[idx];
                        const isActive = activePhotoSlideIndex === idx;

                        return (
                          <button
                            key={slide.key}
                            type="button"
                            onClick={() => setActivePhotoSlideIndex(idx)}
                            className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col justify-between gap-1 text-left cursor-pointer ${
                              isActive
                                ? slide.activeBg
                                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                              }`}>
                                Section {slide.num}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                isActive ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {count}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 pt-1">
                              <SlideIcon className="w-4 h-4 shrink-0" />
                              <span className="truncate">{slide.title}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* SLIDE HEADER & CONTROLS WITH UPLOAD OPTIONS */}
                    <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                          currentSlide.key === 'paperwork' ? 'bg-blue-50 text-blue-600' :
                          currentSlide.key === 'component' ? 'bg-indigo-50 text-indigo-600' :
                          currentSlide.key === 'inspection' ? 'bg-amber-50 text-amber-600' :
                          currentSlide.key === 'final_inspection' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-purple-50 text-purple-600'
                        }`}>
                          <currentSlide.icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                              Slide {activePhotoSlideIndex + 1} of 5
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {currentSlide.title}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                            {currentSlide.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* Slide Previous / Next Switcher */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 mr-1">
                          <button
                            type="button"
                            disabled={activePhotoSlideIndex === 0}
                            onClick={() => {
                              const newIdx = Math.max(0, activePhotoSlideIndex - 1);
                              setActivePhotoSlideIndex(newIdx);
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-white disabled:opacity-30 cursor-pointer transition-colors"
                            title="Previous Category"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-[11px] font-bold text-slate-600 px-2 font-mono">
                            {activePhotoSlideIndex + 1} / 5
                          </span>
                          <button
                            type="button"
                            disabled={activePhotoSlideIndex === PHOTO_SLIDES.length - 1}
                            onClick={() => {
                              const newIdx = Math.min(PHOTO_SLIDES.length - 1, activePhotoSlideIndex + 1);
                              setActivePhotoSlideIndex(newIdx);
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-white disabled:opacity-30 cursor-pointer transition-colors"
                            title="Next Category"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Take / Upload Buttons */}
                        <button
                          type="button"
                          onClick={() => {
                            setCameraCategory(currentSlide.key);
                            setIsCameraOpen(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Take Photo</span>
                        </button>

                        <label className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs">
                          <Upload className="w-4 h-4" />
                          <span>Upload Photos</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                processTargetedPhotoFiles(Array.from(e.target.files), currentSlide.key);
                                e.target.value = '';
                              }
                            }}
                            className="hidden"
                            disabled={isUploading}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* GALLERY PHOTO CARDS OR EMPTY STATE */}
                  {currentSlidePhotos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {currentSlidePhotos.map(({ file, originalIdx }) => (
                        <div
                          key={originalIdx}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all group flex flex-col justify-between"
                        >
                          <div
                            className="relative aspect-4/3 bg-slate-900 overflow-hidden group cursor-pointer"
                            onClick={() => setLightboxPhoto({ url: file.dataUrl, name: file.name, category: currentSlide.key, uploadedAt: file.uploadedAt, size: file.size, originalIdx })}
                          >
                            <img
                              src={file.dataUrl}
                              alt={file.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            <div className="absolute top-2 left-2 z-10">
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-xs flex items-center gap-1 text-white ${
                                currentSlide.key === 'paperwork' ? 'bg-blue-600/90' :
                                currentSlide.key === 'component' ? 'bg-indigo-600/90' :
                                currentSlide.key === 'inspection' ? 'bg-amber-600/90' :
                                currentSlide.key === 'final_inspection' ? 'bg-emerald-600/90' :
                                'bg-purple-600/90'
                              }`}>
                                {currentSlide.title}
                              </span>
                            </div>

                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="bg-white text-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5">
                                <ZoomIn className="w-4 h-4 text-amber-600" /> View Full
                              </span>
                            </div>
                          </div>

                          <div className="p-3 bg-white space-y-2">
                            <p className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                              <span>{file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : 'N/A'}</span>
                              <span>{Math.round(file.size / 1024)} KB</span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                              <a
                                href={file.dataUrl}
                                download={file.name}
                                className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                                title="Download Image"
                              >
                                <Download className="w-3.5 h-3.5" /> Download
                              </a>

                              {deletingFileIndex === originalIdx ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-rose-600 font-bold">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePhoto(originalIdx);
                                      setDeletingFileIndex(null);
                                    }}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingFileIndex(null);
                                    }}
                                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingFileIndex(originalIdx);
                                  }}
                                  className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                                  title="Delete Picture"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                        <currentSlide.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">No {currentSlide.title} Photos Attached</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                          {currentSlide.description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400">
              <Camera className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <h3 className="text-base font-semibold text-slate-700">Select a job above to view & upload photos</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Use the search banner above to target any Job #, Job Card #, Customer, or Component to manage photos across all 5 sections.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        title="Take Photo"
        categoryName={cameraCategory ? `${cameraCategory.toUpperCase()} folder` : undefined}
        onPhotosCaptured={(files) => {
          processTargetedPhotoFiles(files, cameraCategory);
        }}
      />

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxPhoto(null)}
        >
          <div 
            className="bg-white rounded-3xl overflow-hidden max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <p className="text-sm font-bold truncate max-w-md">{lightboxPhoto.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">
                  Category: {lightboxPhoto.category || 'General'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxPhoto.url}
                  download={lightboxPhoto.name}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                  <Download className="w-4 h-4 text-amber-400" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="bg-slate-950 flex-1 overflow-auto p-4 flex items-center justify-center">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.name}
                className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
