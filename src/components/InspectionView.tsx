import React, { useState, useRef } from 'react';
import { Job, JobFile } from '../types';
import { 
  ClipboardCheck, 
  Search, 
  CheckSquare, 
  Clock, 
  Paperclip, 
  Trash2, 
  Upload, 
  Image as ImageIcon,
  AlertCircle,
  ArrowRight,
  User,
  Info,
  FileText
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
    return total === 1 ? "1 of 1" : `Job ${index} of ${total}`;
  };

  // Filter jobs waiting for inspection
  const pendingJobs = jobs.filter(job => job.status === 'Received');

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Inspection Form State
  const [inspectorName, setInspectorName] = useState(currentUser?.displayName || currentUser?.email || '');
  const [inspectedAt, setInspectedAt] = useState(new Date().toISOString().split('T')[0]);
  const [findings, setFindings] = useState('');
  const [customerInstructions, setCustomerInstructions] = useState('');
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [inspectionFiles, setInspectionFiles] = useState<JobFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      if (file.size > 800 * 1024) {
        alert(`File ${file.name} is too large. Please upload files under 800KB.`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const jobFile: JobFile = {
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result as string,
          uploadedAt: new Date().toISOString()
        };
        setInspectionFiles(prev => [...prev, jobFile]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (idx: number) => {
    setInspectionFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSelectJob = (job: Job) => {
    setSelectedJob(job);
    // Initialize forms
    setInspectorName(currentUser?.displayName || currentUser?.email || '');
    setInspectedAt(new Date().toISOString().split('T')[0]);
    setFindings(job.inspectionDetails?.findings || '');
    setCustomerInstructions(job.inspectionDetails?.customerInstructions || '');
    setInspectorNotes(job.inspectionDetails?.inspectorNotes || '');
    setInspectionFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!findings.trim()) {
      alert("Please record your inspection findings.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Merge job files
      const updatedFiles = [...(selectedJob.files || []), ...inspectionFiles];

      const updatedJob: Job = {
        ...selectedJob,
        status: 'Inspected', // Advance to Inspected stage
        files: updatedFiles,
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
      setSelectedJob(null);
      alert(`Job ${selectedJob.id} has been inspected and passed to Quoting.`);
    } catch (error) {
      console.error(error);
      alert("Error saving inspection details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter pending list
  const filteredJobs = pendingJobs.filter(job => 
    job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.componentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6" id="inspection-view-root">
      {/* View Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800 font-display flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-amber-500" />
          Quality Check & Component Inspection
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Perform quality inspections, record damages, check customer repair instructions, and upload inspection photos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: List of Jobs Pending Inspection */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              Pending QC ({pendingJobs.length})
            </h2>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200 uppercase">
              Stage 2
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search pending..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* List items */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredJobs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                <p className="text-xs">No jobs pending inspection.</p>
              </div>
            ) : (
              filteredJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => handleSelectJob(job)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    selectedJob?.id === job.id
                      ? 'border-blue-500 bg-blue-50/40 shadow-sm'
                      : 'border-slate-200 hover:border-slate-200 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800 font-display">{job.id}</span>
                    <span className="text-xs text-slate-500 font-mono">{job.serialNumber}</span>
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-1.5 truncate">
                    {job.customerName}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {job.componentType} ({job.modelName})
                    </span>
                    <span className="font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                      {getJobSequenceString(job, jobs)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Active Inspection Sheet */}
        <div className="lg:col-span-2">
          {selectedJob ? (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 uppercase">Active QC Sheet</span>
                    <span className="text-xs text-slate-400 font-mono">DN: {selectedJob.deliveryNoteNumber}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 font-display mt-1">
                    Inspecting {selectedJob.id}
                  </h2>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold text-slate-600">{selectedJob.customerName}</p>
                  <p className="text-slate-400 mt-0.5">Serial: {selectedJob.serialNumber}</p>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-6">
                {/* Existing Delivery attachments preview */}
                {selectedJob.files && selectedJob.files.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5" />
                      Paperwork & Delivery Attachments
                    </h3>
                    <div className="flex flex-wrap gap-2.5">
                      {selectedJob.files.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs max-w-[200px]">
                          {file.type.startsWith('image/') ? (
                            <img src={file.dataUrl} alt="preview" className="w-8 h-8 rounded-lg object-cover border border-slate-200" referrerPolicy="no-referrer" />
                          ) : (
                            <FileText className="w-8 h-8 text-slate-400 p-1 bg-slate-100 rounded-lg border" />
                          )}
                          <div className="truncate text-left flex-1">
                            <p className="font-semibold text-slate-700 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <a href={file.dataUrl} download={file.name} className="text-blue-500 hover:text-blue-700 font-semibold text-[10px] bg-white border px-1.5 py-0.5 rounded-md">View</a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Inspection Capture Fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Inspector Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Inspector Name *</label>
                      <input
                        type="text"
                        required
                        value={inspectorName}
                        onChange={(e) => setInspectorName(e.target.value)}
                        placeholder="e.g. Inspector Bob"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
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
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Customer Repair Instructions */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      Customer Repair Process Instructions (If Given)
                    </label>
                    <textarea
                      rows={2}
                      value={customerInstructions}
                      onChange={(e) => setCustomerInstructions(e.target.value)}
                      placeholder="e.g. Customer requested sandblast and crack detection report prior to rebuild."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  {/* Findings / Damage assessment */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Inspection Findings / Damage Assessment *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={findings}
                      onChange={(e) => setFindings(e.target.value)}
                      placeholder="Describe precise cracks, wear measurements, or work required..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  {/* Inspector Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Internal Technical Notes</label>
                    <textarea
                      rows={2}
                      value={inspectorNotes}
                      onChange={(e) => setInspectorNotes(e.target.value)}
                      placeholder="Add any internal suggestions for the pre-quoting team..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  {/* Inspection Picture Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Add QC / Damage Photos</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer select-none">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        Take / Upload Damage Photos
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>

                      {/* Display new files */}
                      {inspectionFiles.map((file, fileIdx) => (
                        <div key={fileIdx} className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg pl-2 pr-1 py-1 text-xs text-amber-800">
                          <ImageIcon className="w-3 h-3 text-amber-500" />
                          <span className="max-w-[120px] truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(fileIdx)}
                            className="text-amber-500 hover:text-amber-700 hover:bg-amber-100 p-0.5 rounded-md"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions Footer */}
              <div className="p-6 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel Sheet
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-55 cursor-pointer"
                >
                  {isSubmitting ? 'Saving QC Report...' : 'Sign Off & Pass to Pre-Quote'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <h3 className="text-base font-semibold text-slate-700">Select a job to inspect</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                All components captured by Job Receiving appear in the left list. Select any pending item to record technical findings and customer specifications.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
