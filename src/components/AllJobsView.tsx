import React, { useState } from 'react';
import { Job, CustomColumn } from '../types';
import { 
  Archive, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  UserCheck, 
  Calendar,
  Lock,
  ArrowRight,
  ClipboardCheck,
  Wrench,
  Calculator,
  Layers,
  Clock,
  User,
  Paperclip,
  Activity,
  UserX,
  FileDown,
  ChevronRight,
  X
} from 'lucide-react';

interface AllJobsViewProps {
  jobs: Job[];
  customColumns: CustomColumn[];
  onUpdateJob: (job: Job) => Promise<void>;
  currentUser: any;
}

export default function AllJobsView({
  jobs,
  customColumns,
  onUpdateJob,
  currentUser
}: AllJobsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Closing Form State (for active floor jobs being completed)
  const [closedBy, setClosedBy] = useState(currentUser?.displayName || currentUser?.email || '');
  const [closedAt, setClosedAt] = useState(new Date().toISOString().split('T')[0]);
  const [closingNotes, setClosingNotes] = useState('');
  const [qualityReleaseSign, setQualityReleaseSign] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSelectJob = (job: Job) => {
    setSelectedJob(job);
    setClosedBy(currentUser?.displayName || currentUser?.email || '');
    setClosedAt(new Date().toISOString().split('T')[0]);
    setClosingNotes('');
    setQualityReleaseSign('');
  };

  const handleCloseJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!qualityReleaseSign.trim()) {
      alert("Please sign off the quality release before closing the job.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedJob: Job = {
        ...selectedJob,
        status: 'Closed',
        closingDetails: {
          closedAt,
          closedBy,
          closingNotes,
          qualityReleaseSign
        },
        updatedAt: new Date().toISOString()
      };

      await onUpdateJob(updatedJob);
      setSelectedJob(updatedJob); // Update selected job view state to show closed info
      alert(`Job ${selectedJob.id} has been successfully closed and archived.`);
    } catch (error) {
      console.error(error);
      alert("Error closing job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter & Search Logic
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.componentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.serialNumber && job.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      job.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'Received':
        return <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full font-bold">Stage 1: Received</span>;
      case 'Inspected':
        return <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-bold">Stage 2: Inspected</span>;
      case 'PreQuoted':
        return <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full font-bold">Stage 3: Pre-Quoted</span>;
      case 'JobCardCreated':
        return <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">Stage 4: In Workshop</span>;
      case 'Closed':
        return <span className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full font-bold">Stage 5: Closed &amp; Archived</span>;
      default:
        return null;
    }
  };

  const getStepProgressIndex = (status: Job['status']): number => {
    switch (status) {
      case 'Received': return 1;
      case 'Inspected': return 2;
      case 'PreQuoted': return 3;
      case 'JobCardCreated': return 4;
      case 'Closed': return 5;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6 text-left" id="all-jobs-view-root">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 font-display flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            All Jobs Audit Center
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Global repository to search, filter, and trace jobs across all five production phases. Review technical assessments, estimates, workshop routing sheets, and archives.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl font-bold text-indigo-700 w-fit">
          <Activity className="w-4 h-4 text-indigo-500" />
          <span>Database Size: {jobs.length} Records</span>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Job ID, customer, component model, serial number or delivery note..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Status filter bar */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 border border-slate-200/60 p-1 rounded-xl shadow-xs self-start lg:self-auto">
            {[
              { id: 'ALL', label: 'All Stages' },
              { id: 'Received', label: '1. Received' },
              { id: 'Inspected', label: '2. Inspected' },
              { id: 'PreQuoted', label: '3. Pre-Quoted' },
              { id: 'JobCardCreated', label: '4. In Workshop' },
              { id: 'Closed', label: '5. Closed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Jobs Table List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <th className="p-4 pl-6">Job ID</th>
                <th className="p-4">Customer Name</th>
                <th className="p-4">Component &amp; Model</th>
                <th className="p-4">Serial Number</th>
                <th className="p-4">Delivery Note #</th>
                <th className="p-4">Date Received</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">No matching jobs found</p>
                    <p className="text-xs text-slate-400 mt-1">Try broadening your search term or selecting a different stage filter.</p>
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => (
                  <tr 
                    key={job.id} 
                    onClick={() => handleSelectJob(job)}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer font-medium"
                  >
                    <td className="p-4 pl-6 font-bold text-slate-900 font-mono tracking-wider">
                      {job.id}
                    </td>
                    <td className="p-4 font-semibold text-slate-700">
                      {job.customerName}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[10px]">
                          {job.componentType}
                        </span>
                        <span className="font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                          {job.modelName}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-medium text-slate-500">
                      {job.serialNumber || 'N/A'}
                    </td>
                    <td className="p-4 font-mono font-medium text-slate-500">
                      {job.deliveryNoteNumber}
                    </td>
                    <td className="p-4 text-slate-500">
                      {new Date(job.dateReceived).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="p-4 text-center">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="p-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleSelectJob(job)}
                        className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold px-2.5 py-1.5 rounded-lg border border-indigo-100 hover:border-indigo-600 transition-all text-[11px] cursor-pointer"
                      >
                        Open Details
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OVERLAY MODAL FOR JOB AUDIT DETAILS */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 md:p-6 lg:p-8 animate-fade-in" id="job-details-modal">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full h-[92vh] flex flex-col overflow-hidden animate-zoom-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 text-left">
                <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600 border border-indigo-100">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                    Job File: {selectedJob.id}
                    {selectedJob.status === 'Closed' && (
                      <span className="text-[9px] font-extrabold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full border border-slate-300 uppercase tracking-wider">Archived</span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                    Opened at {new Date(selectedJob.createdAt).toLocaleString()} • Last modified {new Date(selectedJob.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Navigation & Stage Progress Indicator */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex-shrink-0 text-left">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Current Production Stage</span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedJob.status)}
                    <span className="text-xs text-slate-500 font-medium">Sequence: {getJobSequenceString(selectedJob, jobs)}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-1.5 flex-1 max-w-md">
                  {[1, 2, 3, 4, 5].map((stageNum) => {
                    const activeIndex = getStepProgressIndex(selectedJob.status);
                    const isPassed = stageNum <= activeIndex;
                    const isCurrent = stageNum === activeIndex;
                    return (
                      <div key={stageNum} className="flex-1 flex flex-col gap-1">
                        <div className={`h-2 rounded-full transition-all ${
                          isCurrent 
                            ? 'bg-indigo-600 shadow-sm' 
                            : isPassed 
                            ? 'bg-emerald-500' 
                            : 'bg-slate-200'
                        }`} />
                        <span className={`text-[9px] font-bold text-center ${
                          isCurrent ? 'text-indigo-600 font-extrabold' : isPassed ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          Stage {stageNum}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Body - Grid layout for Stages */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 space-y-6 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* STAGE 1: RECEIVING */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                      <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Stage 1</h4>
                        <h3 className="text-sm font-bold text-slate-800">Job Receiving Demographics</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs text-slate-600">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Customer</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.customerName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Delivery Note #</p>
                        <p className="font-mono font-bold text-slate-800 mt-0.5">{selectedJob.deliveryNoteNumber}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Component Type</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.componentType}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Model Name</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.modelName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Serial Number</p>
                        <p className="font-mono font-bold text-slate-800 mt-0.5">{selectedJob.serialNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Date Received</p>
                        <p className="font-medium mt-0.5">{new Date(selectedJob.dateReceived).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Operator / Clerk</p>
                        <p className="font-medium mt-0.5">{selectedJob.capturedBy || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Custom fields */}
                    {selectedJob.customFields && Object.keys(selectedJob.customFields).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Custom Field Checklists</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          {customColumns.map(col => {
                            const val = selectedJob.customFields?.[col.id];
                            if (val === undefined || val === '') return null;
                            return (
                              <div key={col.id}>
                                <p className="text-[10px] font-semibold text-slate-400">{col.label}</p>
                                <p className="font-medium text-slate-800 mt-0.5">
                                  {col.type === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Attached Files / Photos */}
                  {selectedJob.files && selectedJob.files.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5" />
                        Attached Deliverables ({selectedJob.files.length})
                      </p>
                      <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                        {selectedJob.files.map((file, fIdx) => (
                          <div key={fIdx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                            <span className="font-medium text-slate-700 truncate max-w-xs">{file.name}</span>
                            <a 
                              href={file.dataUrl} 
                              download={file.name}
                              referrerPolicy="no-referrer"
                              className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold ml-2 shrink-0 cursor-pointer"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              Save
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* STAGE 2: QC / INSPECTION */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                      <div className="bg-amber-50 p-1.5 rounded-lg text-amber-600">
                        <ClipboardCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Stage 2</h4>
                        <h3 className="text-sm font-bold text-slate-800">QC Technical Assessment</h3>
                      </div>
                    </div>

                    {selectedJob.inspectionDetails ? (
                      <div className="space-y-3.5 text-xs text-slate-600">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Inspector Name</p>
                            <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.inspectionDetails.inspectorName || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Inspection Date</p>
                            <p className="font-semibold text-slate-800 mt-0.5">
                              {selectedJob.inspectionDetails.inspectedAt ? new Date(selectedJob.inspectionDetails.inspectedAt).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Findings &amp; Failure Mode Analysis</p>
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-1 text-[11px] font-medium leading-relaxed max-h-24 overflow-y-auto">
                            {selectedJob.inspectionDetails.findings || 'No findings recorded.'}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Technical Repair Instructions</p>
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-1 text-[11px] font-mono leading-relaxed max-h-24 overflow-y-auto">
                            {selectedJob.inspectionDetails.inspectorNotes || 'No tech instructions provided.'}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Customer Instructions</p>
                          <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.inspectionDetails.customerInstructions || 'None specified.'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400 flex flex-col items-center justify-center h-full">
                        <UserX className="w-8 h-8 text-slate-300 mb-1.5" />
                        <p className="text-xs font-semibold">Stage Pending</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">The job is waiting for QC inspection.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* STAGE 3: ESTIMATING / PRE-QUOTE */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                      <div className="bg-purple-50 p-1.5 rounded-lg text-purple-600">
                        <Calculator className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Stage 3</h4>
                        <h3 className="text-sm font-bold text-slate-800">Pre-Quote Estimation</h3>
                      </div>
                    </div>

                    {selectedJob.preQuoteDetails && selectedJob.preQuoteDetails.steps ? (
                      <div className="space-y-3.5">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Prepared By</p>
                            <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.preQuoteDetails.quotedBy || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Quote Date</p>
                            <p className="font-semibold text-slate-800 mt-0.5">
                              {selectedJob.preQuoteDetails.quotedAt ? new Date(selectedJob.preQuoteDetails.quotedAt).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* List of scoped operations */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[9px] uppercase">
                              <tr>
                                <th className="p-2 pl-3">Scoped Operation</th>
                                <th className="p-2 text-right pr-3">Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {(() => {
                                const prefix = `${selectedJob.id} - `;
                                const jobSteps = selectedJob.preQuoteDetails.steps?.filter(step => 
                                  step.stepName.startsWith(prefix)
                                ) || [];
                                const displaySteps = jobSteps.length > 0 ? jobSteps : (selectedJob.preQuoteDetails.steps || []);

                                return displaySteps.map((step, sIdx) => {
                                  // Strip job ID prefix for cleaner display inside detail pane
                                  const displayName = step.stepName.startsWith(prefix) 
                                    ? step.stepName.slice(prefix.length) 
                                    : step.stepName;
                                  return (
                                    <tr key={sIdx}>
                                      <td className="p-2 pl-3 text-slate-700">{displayName}</td>
                                      <td className="p-2 text-right pr-3 font-mono font-bold text-slate-800">${step.price}</td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>

                        {/* Total Cost Alert */}
                        <div className="bg-purple-50 border border-purple-100 p-3 rounded-xl flex items-center justify-between text-xs">
                          <span className="font-bold text-purple-800">Total Estimated Cost:</span>
                          <span className="font-black text-sm text-purple-900 font-mono">
                            ${(() => {
                              const prefix = `${selectedJob.id} - `;
                              const jobSteps = selectedJob.preQuoteDetails.steps?.filter(step => 
                                step.stepName.startsWith(prefix)
                              ) || [];
                              const displaySteps = jobSteps.length > 0 ? jobSteps : (selectedJob.preQuoteDetails.steps || []);
                              return displaySteps.reduce((sum, s) => sum + s.price, 0);
                            })()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400 flex flex-col items-center justify-center h-full">
                        <UserX className="w-8 h-8 text-slate-300 mb-1.5" />
                        <p className="text-xs font-semibold">Stage Pending</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">The job is waiting for estimation.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* STAGE 4: JOB CARD & WORKSHOP */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                      <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Stage 4</h4>
                        <h3 className="text-sm font-bold text-slate-800">Workshop Routing &amp; Job Card</h3>
                      </div>
                    </div>

                    {selectedJob.jobCardDetails ? (
                      <div className="space-y-3.5 text-xs text-slate-600">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Lead Technician</p>
                            <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.jobCardDetails.assignedTechnician || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Workshop Area</p>
                            <p className="font-mono font-bold text-slate-800 mt-0.5">{selectedJob.jobCardDetails.workshopArea || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Scheduled Start</p>
                            <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.jobCardDetails.scheduledDate || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Target Due Date</p>
                            <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.jobCardDetails.dueDate || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Order / Account No.</p>
                            <p className="font-medium text-slate-800 mt-0.5">{selectedJob.jobCardDetails.orderNumber || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Your Reference</p>
                            <p className="font-medium text-slate-800 mt-0.5">{selectedJob.jobCardDetails.yourRef || 'N/A'}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Required Parts &amp; Materials</p>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1 text-[11px] font-medium leading-relaxed max-h-20 overflow-y-auto">
                            {selectedJob.jobCardDetails.requiredParts || 'None explicitly requested.'}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Technical Directives</p>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1 text-[11px] font-mono leading-relaxed max-h-20 overflow-y-auto text-slate-600">
                            {selectedJob.jobCardDetails.instructions || 'No special technical instructions.'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400 flex flex-col items-center justify-center h-full">
                        <UserX className="w-8 h-8 text-slate-300 mb-1.5" />
                        <p className="text-xs font-semibold">Stage Pending</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">The job is waiting for workshop scheduling.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* STAGE 5 / COMPLETION BLOCK - FULL WIDTH */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <div className="bg-slate-100 p-1.5 rounded-lg text-slate-600">
                    <Archive className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Stage 5</h4>
                    <h3 className="text-base font-bold text-slate-800">Job Completion, QC Sign-off &amp; Archives</h3>
                  </div>
                </div>

                {selectedJob.status === 'Closed' && selectedJob.closingDetails ? (
                  /* Render Archived Closure Information */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600">
                    <div className="space-y-3 md:col-span-1">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Date Closed</p>
                        <p className="font-semibold text-slate-800 mt-0.5">
                          {selectedJob.closingDetails.closedAt ? new Date(selectedJob.closingDetails.closedAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Released By</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.closingDetails.closedBy || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Authorized Quality Signature</p>
                        <div className="mt-1 bg-slate-50 border border-slate-200 border-dashed rounded-lg p-2.5 font-semibold text-center text-slate-800 font-serif text-sm tracking-wide">
                          ✓ {selectedJob.closingDetails.qualityReleaseSign}
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Final Work Summary / Release Notes</p>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-1.5 text-xs leading-relaxed font-medium text-slate-700 min-h-[100px] whitespace-pre-wrap">
                        {selectedJob.closingDetails.closingNotes || 'No closing notes recorded.'}
                      </div>
                    </div>
                  </div>
                ) : selectedJob.status === 'JobCardCreated' ? (
                  /* Render closing sign-off form since it's active in the workshop and ready to complete! */
                  <div className="space-y-4">
                    <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 font-medium">
                      <p className="font-bold flex items-center gap-1.5 text-amber-900">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        Active Workshop Record
                      </p>
                      <p className="mt-1">
                        This job has an active job card. Authorized quality managers can review the logs above and perform the final sign-off below to archive this job.
                      </p>
                    </div>

                    <form onSubmit={handleCloseJobSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Closed By */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Closed By *</label>
                          <input
                            type="text"
                            required
                            value={closedBy}
                            onChange={(e) => setClosedBy(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 font-medium"
                          />
                        </div>

                        {/* Closed At */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Date Completed</label>
                          <input
                            type="date"
                            required
                            value={closedAt}
                            onChange={(e) => setClosedAt(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 font-semibold"
                          />
                        </div>
                      </div>

                      {/* Quality Release Sign-off */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-indigo-500" />
                          Authorized Quality Release Sign-off *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Enter full name (e.g. S. Sarah Quality Manager) for signature validation"
                          value={qualityReleaseSign}
                          onChange={(e) => setQualityReleaseSign(e.target.value)}
                          className="w-full bg-white border-2 border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Signing confirms the component has been rebuilt, inspected, microtested, and is fully safe to return to the active mining fleet.
                        </p>
                      </div>

                      {/* Closing Notes */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Closing Release Notes / Work Summary</label>
                        <textarea
                          rows={3}
                          required
                          placeholder="Provide a final summary of steps completed, micron checks, and packaging release notes..."
                          value={closingNotes}
                          onChange={(e) => setClosingNotes(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 font-medium text-slate-700"
                        />
                      </div>

                      {/* Submit action */}
                      <div className="flex justify-end pt-2">
                        {currentUser?.permissions.canClose || currentUser?.permissions.isAdmin ? (
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm hover:shadow-md disabled:opacity-55 cursor-pointer"
                          >
                            {isSubmitting ? 'Archiving...' : 'Authorize Quality Pass & Close Job'}
                            <Lock className="w-3.5 h-3.5 text-indigo-200" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 text-red-500 bg-red-50 border border-red-100 px-3.5 py-2 rounded-xl text-xs font-bold">
                            <Lock className="w-4 h-4" />
                            <span>Your account lacks Stage 5 closing clearance permissions</span>
                          </div>
                        )}
                      </div>
                    </form>
                  </div>
                ) : (
                  /* Not Closed, and not in Stage 4 either */
                  <div className="text-center py-6 text-slate-400 flex flex-col items-center justify-center">
                    <Lock className="w-6 h-6 text-slate-300 mb-1.5" />
                    <p className="text-xs font-semibold">Stage Locked</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">This job must complete Stage 4 before closure sign-off.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Audit File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
