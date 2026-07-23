import React, { useState } from 'react';
import { Job, CustomColumn, JobCardFormatConfig, DEFAULT_JOB_CARD_FORMAT } from '../types';
import JobCardDocument from './JobCardDocument';
import { downloadPdf, openPrintTab, handlePrintAndSavePdf } from '../utils/printDoc';
import { 
  Archive, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  UserCheck, 
  Lock, 
  ClipboardCheck, 
  Wrench, 
  Calculator, 
  Layers, 
  UserX, 
  FileDown, 
  Paperclip, 
  Activity, 
  X,
  Printer,
  Download,
  Edit2,
  Save,
  Check,
  Eye
} from 'lucide-react';

interface JobEnquiriesViewProps {
  jobs: Job[];
  customColumns: CustomColumn[];
  onUpdateJob: (job: Job) => Promise<void>;
  currentUser: any;
  jobCardFormat?: JobCardFormatConfig;
}

export default function JobEnquiriesView({
  jobs,
  customColumns,
  onUpdateJob,
  currentUser,
  jobCardFormat
}: JobEnquiriesViewProps) {
  const format = jobCardFormat || DEFAULT_JOB_CARD_FORMAT;

  const [searchTerm, setSearchTerm] = useState('');
  // Default filter: 'JobCardCreated' as requested ("Here all jobs with configured job cards should get displayed")
  const [statusFilter, setStatusFilter] = useState<string>('JobCardCreated');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Modal active sub-tab: 'overview' | 'reprint' | 'edit' | 'close'
  const [modalTab, setModalTab] = useState<'overview' | 'reprint' | 'edit' | 'close'>('overview');

  // Closing Form State
  const [closedBy, setClosedBy] = useState(currentUser?.displayName || currentUser?.email || '');
  const [closedAt, setClosedAt] = useState(new Date().toISOString().split('T')[0]);
  const [closingNotes, setClosingNotes] = useState('');
  const [qualityReleaseSign, setQualityReleaseSign] = useState('');
  const [isClosingSubmitting, setIsClosingSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Edit Job Form State
  const [editTechnician, setEditTechnician] = useState('');
  const [editScheduledDate, setEditScheduledDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editWorkshopArea, setEditWorkshopArea] = useState('');
  const [editOrderNumber, setEditOrderNumber] = useState('');
  const [editYourRef, setEditYourRef] = useState('');
  const [editRequiredParts, setEditRequiredParts] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editSerialNumber, setEditSerialNumber] = useState('');
  const [editModelName, setEditModelName] = useState('');
  const [editComponentType, setEditComponentType] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

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

  const handleSelectJob = (job: Job, defaultModalTab: 'overview' | 'reprint' | 'edit' | 'close' = 'overview') => {
    setSelectedJob(job);
    setModalTab(defaultModalTab);

    // Initialize Closing Form
    setClosedBy(currentUser?.displayName || currentUser?.email || 'Quality Inspector');
    setClosedAt(new Date().toISOString().split('T')[0]);
    setClosingNotes(job.closingDetails?.closingNotes || '');
    setQualityReleaseSign(job.closingDetails?.qualityReleaseSign || currentUser?.displayName || currentUser?.email || 'Quality Inspector');

    // Initialize Edit Form
    setEditTechnician(job.jobCardDetails?.assignedTechnician || '');
    setEditScheduledDate(job.jobCardDetails?.scheduledDate || new Date().toISOString().split('T')[0]);
    setEditDueDate(job.jobCardDetails?.dueDate || '31 Dec 2025');
    setEditWorkshopArea(job.jobCardDetails?.workshopArea || '9B');
    setEditOrderNumber(job.jobCardDetails?.orderNumber || '');
    setEditYourRef(job.jobCardDetails?.yourRef || '');
    setEditRequiredParts(job.jobCardDetails?.requiredParts || '');
    setEditInstructions(job.jobCardDetails?.instructions || '');
    setEditSerialNumber(job.serialNumber || '');
    setEditModelName(job.modelName || '');
    setEditComponentType(job.componentType || '');
  };

  const handleSaveEditedJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    setIsEditSubmitting(true);
    try {
      const updatedJob: Job = {
        ...selectedJob,
        serialNumber: editSerialNumber,
        modelName: editModelName,
        componentType: editComponentType,
        jobCardDetails: {
          ...selectedJob.jobCardDetails,
          assignedTechnician: editTechnician,
          scheduledDate: editScheduledDate,
          dueDate: editDueDate,
          workshopArea: editWorkshopArea,
          orderNumber: editOrderNumber,
          yourRef: editYourRef,
          requiredParts: editRequiredParts,
          instructions: editInstructions,
          createdBy: selectedJob.jobCardDetails?.createdBy || currentUser?.displayName || currentUser?.email || 'Operator',
          createdAt: selectedJob.jobCardDetails?.createdAt || new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      };

      await onUpdateJob(updatedJob);
      setSelectedJob(updatedJob);
      alert(`Job ${selectedJob.id} details successfully updated.`);
      setModalTab('overview');
    } catch (err) {
      console.error(err);
      alert("Failed to save edited job details.");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleCloseJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!qualityReleaseSign.trim()) {
      alert("Please sign off the quality release before closing the job.");
      return;
    }

    setIsClosingSubmitting(true);
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
      setSelectedJob(updatedJob);
      alert(`Job ${selectedJob.id} has been successfully closed and archived.`);
      setModalTab('overview');
    } catch (error) {
      console.error(error);
      alert("Error closing job.");
    } finally {
      setIsClosingSubmitting(false);
    }
  };

  const getJobCardFilename = () => {
    const jNo = selectedJob?.jobCardDetails?.jobCardNumber || selectedJob?.id || 'Doc';
    return `JobCard_${jNo}.pdf`;
  };

  const handleSavePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await downloadPdf({
        elementId: 'printable-jobcard-doc',
        filename: getJobCardFilename()
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleOpenPrint = () => {
    const jNo = selectedJob?.jobCardDetails?.jobCardNumber || selectedJob?.id || 'Doc';
    const opened = openPrintTab({
      elementId: 'printable-jobcard-doc',
      documentTitle: `Job Card - ${jNo}`
    });

    if (!opened) {
      // Fallback if popup blocked
      const printDoc = document.getElementById('printable-jobcard-doc');
      if (printDoc) {
        printDoc.classList.remove('hidden');
        printDoc.classList.add('print-active');
        setTimeout(() => {
          window.print();
          setTimeout(() => {
            printDoc.classList.add('hidden');
            printDoc.classList.remove('print-active');
          }, 800);
        }, 50);
      } else {
        window.print();
      }
    }
  };

  const handleTriggerPrint = async () => {
    setIsGeneratingPdf(true);
    try {
      await handlePrintAndSavePdf({
        elementId: 'printable-jobcard-doc',
        filename: getJobCardFilename(),
        documentTitle: `Job Card - ${selectedJob?.jobCardDetails?.jobCardNumber || selectedJob?.id || 'Doc'}`
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Filter & Search Logic
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.jobCardDetails?.jobCardNumber && job.jobCardDetails.jobCardNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.componentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.serialNumber && job.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      job.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.jobCardDetails?.assignedTechnician && job.jobCardDetails.assignedTechnician.toLowerCase().includes(searchTerm.toLowerCase()));

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

  // Metrics
  const activeJobCardsCount = jobs.filter(j => j.status === 'JobCardCreated').length;
  const closedJobsCount = jobs.filter(j => j.status === 'Closed').length;
  const totalJobsCount = jobs.length;

  return (
    <div className="space-y-6 text-left" id="job-enquiries-view-root">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 font-display flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-600" />
            Stage 5: Job Enquiries &amp; Active Workshop
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Central repository to store, view, edit, reprint job cards, and close active workshop jobs once released from Stage 4.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-emerald-800">
            <Wrench className="w-3.5 h-3.5 text-emerald-600" />
            <span>Active Job Cards: {activeJobCardsCount}</span>
          </div>
          <div className="flex items-center gap-2 text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700">
            <Archive className="w-3.5 h-3.5 text-slate-500" />
            <span>Closed: {closedJobsCount}</span>
          </div>
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
              placeholder="Search by Job Card # (J00001), Component ID (C00001), Customer, Serial #, Delivery Note, Technician..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Status filter bar */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 border border-slate-200/60 p-1 rounded-xl shadow-xs self-start lg:self-auto">
            {[
              { id: 'JobCardCreated', label: 'Active Job Cards', highlight: true },
              { id: 'Closed', label: 'Closed / Archived' },
              { id: 'ALL', label: 'All Jobs Database' },
              { id: 'Received', label: '1. Received' },
              { id: 'Inspected', label: '2. Inspected' },
              { id: 'PreQuoted', label: '3. Pre-Quoted' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
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
                <th className="p-4 pl-6">Job Card &amp; Comp ID</th>
                <th className="p-4">Customer Name</th>
                <th className="p-4">Component &amp; Model</th>
                <th className="p-4">Serial Number</th>
                <th className="p-4">Technician / DN</th>
                <th className="p-4">Date Received</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right pr-6">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">No matching jobs found in Stage 5 Enquiries</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {statusFilter === 'JobCardCreated' 
                        ? 'No active job cards are currently in the workshop. Generate a job card in Stage 4 to see it land here.' 
                        : 'Try broadening your search or switching filters above.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => (
                  <tr 
                    key={job.id} 
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer font-medium"
                    onClick={() => handleSelectJob(job, 'overview')}
                  >
                    <td className="p-4 pl-6 font-bold text-slate-900 font-mono tracking-wider">
                      {job.jobCardDetails?.jobCardNumber ? (
                        <div className="text-indigo-600 font-extrabold text-sm flex items-center gap-1.5">
                          <span>Card #{job.jobCardDetails.jobCardNumber}</span>
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs font-normal">No Job Card</div>
                      )}
                      <div className="text-[11px] text-slate-500 font-mono">
                        Comp ID: {job.id}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-slate-800">
                      {job.customerName}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{job.modelName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{job.componentType}</div>
                    </td>
                    <td className="p-4 font-mono font-medium text-slate-700">
                      {job.serialNumber || 'N/A'}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{job.jobCardDetails?.assignedTechnician || 'Unassigned'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">DN: {job.deliveryNoteNumber}</div>
                    </td>
                    <td className="p-4 font-medium text-slate-600">
                      {new Date(job.dateReceived).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-center">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="p-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Enquire / View */}
                        <button
                          onClick={() => handleSelectJob(job, 'overview')}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Enquire / View Job Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Reprint Job Card */}
                        {(job.jobCardDetails || job.status === 'JobCardCreated' || job.status === 'Closed') && (
                          <button
                            onClick={() => handleSelectJob(job, 'reprint')}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                            title="Reprint Job Card Document"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit Job Details */}
                        <button
                          onClick={() => handleSelectJob(job, 'edit')}
                          className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Edit Job Parameters"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Close / Sign Off */}
                        {job.status === 'JobCardCreated' && (
                          <button
                            onClick={() => handleSelectJob(job, 'close')}
                            className="p-1.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors font-bold text-[10px] px-2 py-1 flex items-center gap-1 cursor-pointer"
                            title="Close & Sign Off Job"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Close</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPREHENSIVE JOB ENQUIRY MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in text-left">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-md">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display flex items-center gap-2 text-white">
                    {selectedJob.jobCardDetails?.jobCardNumber ? (
                      <span className="text-emerald-400 font-mono font-black">
                        Job Card #{selectedJob.jobCardDetails.jobCardNumber}
                      </span>
                    ) : (
                      <span>Job Enquiry</span>
                    )}
                    <span className="text-xs text-slate-400 font-mono font-normal">
                      (Component ID: {selectedJob.id})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedJob.customerName} • {selectedJob.modelName} ({selectedJob.componentType}) • Serial: {selectedJob.serialNumber || 'N/A'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tab Navigation Bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center justify-between gap-2 flex-shrink-0 overflow-x-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalTab('overview')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    modalTab === 'overview'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Audit &amp; Stage Trace
                </button>

                {(selectedJob.jobCardDetails || selectedJob.status === 'JobCardCreated' || selectedJob.status === 'Closed') && (
                  <button
                    onClick={() => setModalTab('reprint')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      modalTab === 'reprint'
                        ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Reprint Job Card
                  </button>
                )}

                <button
                  onClick={() => setModalTab('edit')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    modalTab === 'edit'
                      ? 'bg-white text-amber-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Job Parameters
                </button>

                <button
                  onClick={() => setModalTab('close')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    modalTab === 'close'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  QC Sign-Off &amp; Closure
                </button>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {getStatusBadge(selectedJob.status)}
              </div>
            </div>

            {/* Modal Body depending on selected sub-tab */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 space-y-6">
              
              {/* SUB-TAB 1: AUDIT & STAGE TRACE OVERVIEW */}
              {modalTab === 'overview' && (
                <div className="space-y-6">
                  {/* Progress bar */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Production Lifecycle Stage Progress</span>
                    <div className="flex items-center gap-1.5 w-full">
                      {[1, 2, 3, 4, 5].map((stageNum) => {
                        const activeIndex = getStepProgressIndex(selectedJob.status);
                        const isPassed = stageNum <= activeIndex;
                        const isCurrent = stageNum === activeIndex;
                        return (
                          <div key={stageNum} className="flex-1 flex flex-col gap-1">
                            <div className={`h-2.5 rounded-full transition-all ${
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

                  {/* Stage Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* STAGE 1: RECEIVING */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                          <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Stage 1</h4>
                            <h3 className="text-xs font-bold text-slate-800">Job Receiving Demographics</h3>
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
                        </div>
                      </div>
                    </div>

                    {/* STAGE 2: QC / INSPECTION */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                          <div className="bg-amber-50 p-1.5 rounded-lg text-amber-600">
                            <ClipboardCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Stage 2</h4>
                            <h3 className="text-xs font-bold text-slate-800">QC Technical Assessment</h3>
                          </div>
                        </div>

                        {selectedJob.inspectionDetails ? (
                          <div className="space-y-3 text-xs text-slate-600">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Inspector</p>
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
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Findings &amp; Failure Mode</p>
                              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1 text-[11px] font-medium leading-relaxed max-h-20 overflow-y-auto">
                                {selectedJob.inspectionDetails.findings || 'No findings recorded.'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-slate-400">
                            <p className="text-xs font-semibold">Stage Pending</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STAGE 3: ESTIMATING / PRE-QUOTE */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                          <div className="bg-purple-50 p-1.5 rounded-lg text-purple-600">
                            <Calculator className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Stage 3</h4>
                            <h3 className="text-xs font-bold text-slate-800">Pre-Quote Estimation</h3>
                          </div>
                        </div>

                        {selectedJob.preQuoteDetails && selectedJob.preQuoteDetails.steps ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Prepared By</p>
                                <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.preQuoteDetails.quotedBy || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Total Estimated Cost</p>
                                <p className="font-mono font-bold text-purple-700 mt-0.5">
                                  ${selectedJob.preQuoteDetails.steps.reduce((sum, s) => sum + s.price, 0)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-slate-400">
                            <p className="text-xs font-semibold">Stage Pending</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STAGE 4: WORKSHOP ROUTING & JOB CARD */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                          <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600">
                            <Wrench className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Stage 4</h4>
                            <h3 className="text-xs font-bold text-slate-800">Workshop Routing &amp; Job Card</h3>
                          </div>
                        </div>

                        {selectedJob.jobCardDetails ? (
                          <div className="space-y-3 text-xs text-slate-600">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Job Card Number</p>
                                <p className="font-mono font-extrabold text-emerald-700 mt-0.5">{selectedJob.jobCardDetails.jobCardNumber || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Lead Technician</p>
                                <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.jobCardDetails.assignedTechnician || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Workshop Area</p>
                                <p className="font-mono font-bold text-slate-800 mt-0.5">{selectedJob.jobCardDetails.workshopArea || '9B'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Scheduled Start</p>
                                <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.jobCardDetails.scheduledDate || 'N/A'}</p>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Technical Directives</p>
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 mt-1 text-[11px] font-mono leading-relaxed max-h-20 overflow-y-auto text-slate-600">
                                {selectedJob.jobCardDetails.instructions || 'No special technical instructions.'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-slate-400">
                            <p className="text-xs font-semibold">Stage Pending</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* STAGE 5 ARCHIVE & CLOSING DETAILS */}
                  {selectedJob.status === 'Closed' && selectedJob.closingDetails && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                      <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Archive className="w-4 h-4 text-slate-600" />
                        Stage 5 Quality Release &amp; Archive Certificate
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Date Closed</p>
                          <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.closingDetails.closedAt}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Released By</p>
                          <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.closingDetails.closedBy}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Authorized Quality Signature</p>
                          <p className="font-serif font-bold text-emerald-800 mt-0.5">✓ {selectedJob.closingDetails.qualityReleaseSign}</p>
                        </div>
                      </div>
                      {selectedJob.closingDetails.closingNotes && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Release Notes</p>
                          <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            {selectedJob.closingDetails.closingNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 2: REPRINT JOB CARD DOCUMENT */}
              {modalTab === 'reprint' && (
                <div className="space-y-6 flex flex-col items-center">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Printer className="w-4 h-4 text-emerald-600" />
                        Official Job Card Document Preview &amp; Reprint
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Reprint official Page 1 Workshop Routing Card and Page 2 Machining Log.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSavePdf}
                        disabled={isGeneratingPdf}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        title="Download PDF Document directly to your device"
                      >
                        <Download className="w-4 h-4 text-emerald-600" />
                        {isGeneratingPdf ? 'Generating PDF...' : 'Save PDF'}
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenPrint}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
                        title="Open clean print window"
                      >
                        <Printer className="w-4 h-4 text-slate-600" />
                        Print Document
                      </button>
                      <button
                        type="button"
                        onClick={handleTriggerPrint}
                        disabled={isGeneratingPdf}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Printer className="w-4 h-4" />
                        {isGeneratingPdf ? 'Processing...' : 'Print & Save PDF'}
                      </button>
                    </div>
                  </div>

                  {/* Document Preview Container */}
                  <div className="w-full max-w-2xl flex flex-col items-center gap-8 my-2">
                    {/* Page 1 */}
                    <div className="w-full bg-slate-200/80 p-4 rounded-2xl shadow-inner border border-slate-300 flex flex-col items-center">
                      <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">A4 Portrait Sheet — Page 1 (Workshop Job Card)</div>
                      <div className="w-full max-w-[560px] bg-white shadow-xl border border-slate-300">
                        <JobCardDocument
                          format={format}
                          page="page1"
                          job={selectedJob}
                          overrideFields={{
                            jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber,
                            assignedTechnician: selectedJob.jobCardDetails?.assignedTechnician,
                            orderNumber: selectedJob.jobCardDetails?.orderNumber,
                            yourRef: selectedJob.jobCardDetails?.yourRef,
                            scheduledDate: selectedJob.jobCardDetails?.scheduledDate,
                            dueDate: selectedJob.jobCardDetails?.dueDate,
                            workshopArea: selectedJob.jobCardDetails?.workshopArea,
                            requiredParts: selectedJob.jobCardDetails?.requiredParts,
                            instructions: selectedJob.jobCardDetails?.instructions,
                          }}
                        />
                      </div>
                    </div>

                    {/* Page 2 */}
                    <div className="w-full bg-slate-200/80 p-4 rounded-2xl shadow-inner border border-slate-300 flex flex-col items-center">
                      <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">A4 Portrait Sheet — Page 2 (Timesheet &amp; Machining Log)</div>
                      <div className="w-full max-w-[560px] bg-white shadow-xl border border-slate-300">
                        <JobCardDocument
                          format={format}
                          page="page2"
                          job={selectedJob}
                          overrideFields={{
                            jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber,
                            assignedTechnician: selectedJob.jobCardDetails?.assignedTechnician,
                            orderNumber: selectedJob.jobCardDetails?.orderNumber,
                            yourRef: selectedJob.jobCardDetails?.yourRef,
                            scheduledDate: selectedJob.jobCardDetails?.scheduledDate,
                            dueDate: selectedJob.jobCardDetails?.dueDate,
                            workshopArea: selectedJob.jobCardDetails?.workshopArea,
                            requiredParts: selectedJob.jobCardDetails?.requiredParts,
                            instructions: selectedJob.jobCardDetails?.instructions,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: EDIT JOB PARAMETERS */}
              {modalTab === 'edit' && (
                <form onSubmit={handleSaveEditedJob} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
                      <Edit2 className="w-4 h-4 text-amber-600" />
                      Edit Job &amp; Routing Parameters
                    </h4>
                    <p className="text-xs text-slate-500">
                      Update component descriptions or workshop routing details directly in Stage 5 Enquiries.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Component Type</label>
                      <input
                        type="text"
                        value={editComponentType}
                        onChange={(e) => setEditComponentType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Model Name</label>
                      <input
                        type="text"
                        value={editModelName}
                        onChange={(e) => setEditModelName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Serial Number</label>
                      <input
                        type="text"
                        value={editSerialNumber}
                        onChange={(e) => setEditSerialNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assigned Lead Technician</label>
                      <input
                        type="text"
                        value={editTechnician}
                        onChange={(e) => setEditTechnician(e.target.value)}
                        placeholder="e.g. Master Tech John Doe"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Workshop Bay / Area</label>
                      <input
                        type="text"
                        value={editWorkshopArea}
                        onChange={(e) => setEditWorkshopArea(e.target.value)}
                        placeholder="e.g. Bay 9B"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Scheduled Start Date</label>
                      <input
                        type="date"
                        value={editScheduledDate}
                        onChange={(e) => setEditScheduledDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Due Date</label>
                      <input
                        type="text"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Order / Account Number</label>
                      <input
                        type="text"
                        value={editOrderNumber}
                        onChange={(e) => setEditOrderNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Your Reference</label>
                      <input
                        type="text"
                        value={editYourRef}
                        onChange={(e) => setEditYourRef(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Required Parts &amp; Materials</label>
                      <textarea
                        rows={2}
                        value={editRequiredParts}
                        onChange={(e) => setEditRequiredParts(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Technical Directives &amp; Workshop Instructions</label>
                      <textarea
                        rows={3}
                        value={editInstructions}
                        onChange={(e) => setEditInstructions(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setModalTab('overview')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isEditSubmitting}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isEditSubmitting ? 'Saving Changes...' : 'Save Job Updates'}
                    </button>
                  </div>
                </form>
              )}

              {/* SUB-TAB 4: QC SIGN-OFF & CLOSURE */}
              {modalTab === 'close' && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Stage 5 Quality Release &amp; Job Closure</h4>
                      <p className="text-xs text-slate-500">Sign off quality inspection pass to complete and archive this job.</p>
                    </div>
                  </div>

                  {selectedJob.status === 'Closed' ? (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-700 space-y-2">
                      <p className="font-bold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        This job is already closed and archived!
                      </p>
                      <p>Closed on {selectedJob.closingDetails?.closedAt} by {selectedJob.closingDetails?.closedBy}.</p>
                      <p className="font-serif italic font-bold">Signature: ✓ {selectedJob.closingDetails?.qualityReleaseSign}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleCloseJobSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Closed By *</label>
                          <input
                            type="text"
                            required
                            value={closedBy}
                            onChange={(e) => setClosedBy(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date Completed *</label>
                          <input
                            type="date"
                            required
                            value={closedAt}
                            onChange={(e) => setClosedAt(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-indigo-500" />
                          Authorized Quality Release Sign-off *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Enter full name for signature validation (e.g. Quality Mgr S. Sarah)"
                          value={qualityReleaseSign}
                          onChange={(e) => setQualityReleaseSign(e.target.value)}
                          className="w-full bg-white border-2 border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Closing Release Notes / Work Summary</label>
                        <textarea
                          rows={3}
                          required
                          placeholder="Provide final summary of steps completed, micron checks, and packaging release notes..."
                          value={closingNotes}
                          onChange={(e) => setClosingNotes(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium focus:outline-hidden focus:border-indigo-500 text-slate-700"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        {currentUser?.permissions.canClose || currentUser?.permissions.isAdmin ? (
                          <button
                            type="submit"
                            disabled={isClosingSubmitting}
                            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm disabled:opacity-55 cursor-pointer"
                          >
                            {isClosingSubmitting ? 'Archiving...' : 'Authorize Quality Pass & Close Job'}
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
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-100 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Enquiry View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print container containing BOTH pages for physical browser print */}
      {selectedJob && (
        <div id="printable-jobcard-doc" className="hidden print:block">
          <div className="print-page flex flex-col font-sans text-black bg-white">
            <JobCardDocument
              format={format}
              page="page1"
              job={selectedJob}
              overrideFields={{
                jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber,
                assignedTechnician: selectedJob.jobCardDetails?.assignedTechnician,
                orderNumber: selectedJob.jobCardDetails?.orderNumber,
                yourRef: selectedJob.jobCardDetails?.yourRef,
                scheduledDate: selectedJob.jobCardDetails?.scheduledDate,
                dueDate: selectedJob.jobCardDetails?.dueDate,
                workshopArea: selectedJob.jobCardDetails?.workshopArea,
                requiredParts: selectedJob.jobCardDetails?.requiredParts,
                instructions: selectedJob.jobCardDetails?.instructions,
              }}
            />
          </div>
          <div className="print-page flex flex-col font-sans text-black bg-white">
            <JobCardDocument
              format={format}
              page="page2"
              job={selectedJob}
              overrideFields={{
                jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber,
                assignedTechnician: selectedJob.jobCardDetails?.assignedTechnician,
                orderNumber: selectedJob.jobCardDetails?.orderNumber,
                yourRef: selectedJob.jobCardDetails?.yourRef,
                scheduledDate: selectedJob.jobCardDetails?.scheduledDate,
                dueDate: selectedJob.jobCardDetails?.dueDate,
                workshopArea: selectedJob.jobCardDetails?.workshopArea,
                requiredParts: selectedJob.jobCardDetails?.requiredParts,
                instructions: selectedJob.jobCardDetails?.instructions,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
