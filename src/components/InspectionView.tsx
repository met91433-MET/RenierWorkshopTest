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
  X
} from 'lucide-react';

interface InspectionViewProps {
  jobs: Job[];
  onUpdateJob: (job: Job) => Promise<void>;
  currentUser: any;
}

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

  // Targeted Photo Upload State
  const [targetCategory, setTargetCategory] = useState<'inspection' | 'delivery' | 'job'>('inspection');
  const [photoFilterTab, setPhotoFilterTab] = useState<'all' | 'inspection' | 'delivery' | 'job'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraCategory, setCameraCategory] = useState<'inspection' | 'delivery' | 'job' | undefined>(undefined);

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
    categoryToUse?: 'inspection' | 'delivery' | 'job',
    jobToUse?: Job
  ) => {
    const activeJob = jobToUse || selectedJob;
    if (!fileList || fileList.length === 0 || !activeJob) return;

    const category = categoryToUse || targetCategory;
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
        if (category === 'delivery' && activeJob.deliveryNoteNumber) {
          // Sync delivery photos across all jobs on this delivery note
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

  const handleTargetedPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    categoryToUse?: 'inspection' | 'delivery' | 'job',
    jobToUse?: Job
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processTargetedPhotoFiles(Array.from(files), categoryToUse, jobToUse);
    e.target.value = '';
  };

  // Change category tag of an existing photo
  const handleChangePhotoCategory = async (
    fileIndex: number, 
    newCategory: 'inspection' | 'delivery' | 'job',
    targetJob?: Job
  ) => {
    const activeJob = targetJob || selectedJob;
    if (!activeJob || !activeJob.files) return;

    const updatedFiles = [...activeJob.files];
    if (updatedFiles[fileIndex]) {
      updatedFiles[fileIndex] = {
        ...updatedFiles[fileIndex],
        category: newCategory
      };

      const updatedJob: Job = {
        ...activeJob,
        files: deduplicateJobFiles(updatedFiles),
        updatedAt: new Date().toISOString()
      };

      await onUpdateJob(updatedJob);
    }
  };

  // Delete a photo from a job
  const handleDeletePhoto = async (fileIndex: number, targetJob?: Job) => {
    const activeJob = targetJob || selectedJob;
    if (!activeJob || !activeJob.files) return;

    const fileToDelete = activeJob.files[fileIndex];
    if (!fileToDelete) return;

    if (!confirm(`Are you sure you want to delete "${fileToDelete.name}"?`)) return;

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
  const matchedUploadJobs = uploadQuery
    ? jobs.filter(j => 
        j.id.toLowerCase().includes(uploadQuery) ||
        (j.jobCardDetails?.jobCardNumber && j.jobCardDetails.jobCardNumber.toLowerCase().includes(uploadQuery)) ||
        j.customerName.toLowerCase().includes(uploadQuery) ||
        j.componentType.toLowerCase().includes(uploadQuery) ||
        j.modelName.toLowerCase().includes(uploadQuery) ||
        j.serialNumber.toLowerCase().includes(uploadQuery) ||
        j.deliveryNoteNumber.toLowerCase().includes(uploadQuery)
      )
    : jobs.slice(0, 15);

  // Category file counts for selected job
  const jobFiles = selectedJob?.files || [];
  const getCategoryFiles = (cat: 'inspection' | 'delivery' | 'job') => {
    return jobFiles.filter(f => {
      if (cat === 'delivery') return f.category === 'delivery';
      if (cat === 'inspection') return f.category === 'inspection';
      return f.category === 'job' || (!f.category && !f.name.toLowerCase().includes('delivery'));
    });
  };

  const deliveryPhotos = getCategoryFiles('delivery');
  const inspectionPhotos = getCategoryFiles('inspection');
  const componentJobPhotos = getCategoryFiles('job');

  const displayedPhotos = jobFiles.filter(f => {
    if (photoFilterTab === 'all') return true;
    if (photoFilterTab === 'delivery') return f.category === 'delivery';
    if (photoFilterTab === 'inspection') return f.category === 'inspection';
    return f.category === 'job' || (!f.category && !f.name.toLowerCase().includes('delivery'));
  });

  return (
    <div className="space-y-6" id="inspection-view-root">
      {/* Header Banner with Slider Switcher */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 font-display flex items-center gap-2">
            {activeSliderMode === 'pending' ? (
              <ClipboardCheck className="w-5 h-5 text-amber-500" />
            ) : (
              <Camera className="w-5 h-5 text-amber-500" />
            )}
            Inspection & Photo Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeSliderMode === 'pending' 
              ? "Stage 2 Inspection: Select a pending component to complete damage findings and advance to Pre-Quote." 
              : "Upload Photos: Search any job number or customer to upload and organize photos into target folders."}
          </p>
        </div>

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
                    <button
                      type="button"
                      onClick={() => setActiveSliderMode('upload')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-500" />
                      <span>Upload Photos ({selectedJob.files?.length || 0})</span>
                    </button>

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

                  {/* Inspector Internal Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Internal Technical Notes</label>
                    <textarea
                      rows={2}
                      value={inspectorNotes}
                      onChange={(e) => setInspectorNotes(e.target.value)}
                      placeholder="Add any internal suggestions for the pre-quoting team..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  {/* Form Footer Action Buttons */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400">
                      {selectedJob.status === 'Received'
                        ? "Submitting will mark job as Inspected and advance to Pre-Quote."
                        : "Job is already past Receiving. Updates will save findings without changing status."}
                    </p>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? 'Saving Findings...' : 'Save Inspection Details'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left Column: Job Search for Uploads */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1 space-y-4">
            <div className="pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 font-display flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-500" />
                Select Target Job
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Type Job #, Job Card #, Customer, or Serial # to pick a job for photos.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="Search Job # (e.g. J2026-0001), JC #, Serial..."
                value={uploadSearchTerm}
                onChange={(e) => setUploadSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2.5 w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-amber-500"
              />
            </div>

            {/* Matched Jobs List */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {matchedUploadJobs.length === 0 ? (
                <div className="text-center py-10 px-3 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <AlertCircle className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">No matching jobs found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Check the search query or job number.
                  </p>
                </div>
              ) : (
                matchedUploadJobs.map(job => (
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
                        {job.jobCardDetails?.jobCardNumber && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            JC: {job.jobCardDetails.jobCardNumber}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-slate-100 text-slate-700 border-slate-200">
                        {job.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 font-medium mt-1 truncate">
                      {job.customerName} - {job.componentType} ({job.modelName})
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>SN: {job.serialNumber}</span>
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {job.files?.length || 0} Photos
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Photo Upload & Gallery Center for Selected Job */}
          <div className="lg:col-span-2">
            {selectedJob ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
                {/* Selected Job Header Card */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-md border border-amber-200 uppercase">
                        Target Job #{selectedJob.id}
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
                    <h3 className="text-base font-bold text-slate-800 font-display mt-1.5">
                      {selectedJob.customerName} - {selectedJob.componentType} ({selectedJob.modelName})
                    </h3>
                  </div>

                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
                    Total Media: {jobFiles.length}
                  </span>
                </div>

                {/* TARGETED PHOTO FOLDER UPLOAD AREA */}
                <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FolderOpen className="w-4 h-4 text-amber-500" />
                        Target Destination Folder
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Select destination folder before choosing files.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={targetCategory}
                        onChange={(e) => setTargetCategory(e.target.value as any)}
                        className="bg-white border border-amber-300 text-xs font-bold text-slate-800 px-3 py-2 rounded-xl focus:outline-hidden focus:border-amber-500 cursor-pointer shadow-2xs"
                      >
                        <option value="inspection">🔍 Inspection Photos Folder</option>
                        <option value="delivery">🚚 Delivery Photos Folder</option>
                        <option value="job">⚙️ Job / Component Photos Folder</option>
                      </select>
                    </div>
                  </div>

                  {/* Dropzone / Upload Button */}
                  <div className="border-2 border-dashed border-amber-300 bg-white rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-3">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {isUploading ? "Processing & Compressing Photos..." : `Upload Photos to ${targetCategory.toUpperCase()} Folder`}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Take photos directly with camera or select image files.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCameraCategory(targetCategory);
                          setIsCameraOpen(true);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        Take Photo
                      </button>

                      <label className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs flex items-center gap-1.5">
                        <Upload className="w-4 h-4" />
                        Browse Files
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          disabled={isUploading}
                          onChange={(e) => handleTargetedPhotoUpload(e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Quick Folder Add Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-amber-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Inspection Folder</p>
                          <p className="text-[10px] text-slate-400">{inspectionPhotos.length} Photos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCameraCategory('inspection');
                            setIsCameraOpen(true);
                          }}
                          className="p-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md cursor-pointer"
                          title="Take Inspection Photo"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                        <label className="text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md cursor-pointer">
                          + Add
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleTargetedPhotoUpload(e, 'inspection')}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Delivery Folder</p>
                          <p className="text-[10px] text-slate-400">{deliveryPhotos.length} Photos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCameraCategory('delivery');
                            setIsCameraOpen(true);
                          }}
                          className="p-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md cursor-pointer"
                          title="Take Delivery Photo"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                        <label className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md cursor-pointer">
                          + Add
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleTargetedPhotoUpload(e, 'delivery')}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-slate-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Job/Component</p>
                          <p className="text-[10px] text-slate-400">{componentJobPhotos.length} Photos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCameraCategory('job');
                            setIsCameraOpen(true);
                          }}
                          className="p-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md cursor-pointer"
                          title="Take Component Photo"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                        <label className="text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md cursor-pointer">
                          + Add
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleTargetedPhotoUpload(e, 'job')}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* EXISTING PHOTOS GALLERY WITH FILTER TABS */}
                <div className="space-y-3 border-t border-slate-200 pt-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-amber-500" />
                      Uploaded Job Gallery ({jobFiles.length})
                    </span>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPhotoFilterTab('all')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                          photoFilterTab === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        All ({jobFiles.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoFilterTab('inspection')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                          photoFilterTab === 'inspection' ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Inspection ({inspectionPhotos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoFilterTab('delivery')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                          photoFilterTab === 'delivery' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Delivery ({deliveryPhotos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoFilterTab('job')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                          photoFilterTab === 'job' ? 'bg-slate-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Job ({componentJobPhotos.length})
                      </button>
                    </div>
                  </div>

                  {displayedPhotos.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-bold text-slate-700">No photos in this folder</p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                        Upload photos using the dropzone above to populate this gallery.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto p-1">
                      {displayedPhotos.map((file, idx) => {
                        const realIndex = jobFiles.findIndex(f => f.dataUrl === file.dataUrl && f.name === file.name);
                        const cat = file.category || (file.name.toLowerCase().includes('delivery') ? 'delivery' : 'job');

                        return (
                          <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs group flex flex-col justify-between">
                            <div className="relative aspect-4/3 bg-slate-100">
                              <img
                                src={file.dataUrl}
                                alt={file.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />

                              <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md border shadow-2xs ${
                                cat === 'delivery' ? 'bg-blue-600 text-white border-blue-700' :
                                cat === 'inspection' ? 'bg-amber-500 text-white border-amber-600' :
                                'bg-slate-700 text-white border-slate-800'
                              }`}>
                                {cat.toUpperCase()}
                              </span>

                              <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                                <a
                                  href={file.dataUrl}
                                  download={file.name}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 bg-white/90 hover:bg-white text-slate-700 rounded-md shadow-xs transition-all"
                                  title="Download"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePhoto(realIndex !== -1 ? realIndex : idx)}
                                  className="p-1 bg-white/90 hover:bg-red-50 text-red-600 rounded-md shadow-xs transition-all cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div className="p-2 space-y-1">
                              <p className="text-[10px] font-semibold text-slate-700 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-400 font-mono">{(file.size / 1024).toFixed(0)} KB</span>
                                <select
                                  value={cat}
                                  onChange={(e) => handleChangePhotoCategory(realIndex !== -1 ? realIndex : idx, e.target.value as any)}
                                  className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 cursor-pointer"
                                >
                                  <option value="inspection">Inspection</option>
                                  <option value="delivery">Delivery</option>
                                  <option value="job">Job</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400">
                <Camera className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <h3 className="text-base font-semibold text-slate-700">Select a job to manage photos</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Pick a job from the list on the left or search any job number to upload photos directly to Inspection, Delivery, or Job folders.
                </p>
              </div>
            )}
          </div>
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
    </div>
  );
}
