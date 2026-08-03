import React, { useState, useEffect } from 'react';
import { Job, JobCardFormatConfig, DEFAULT_JOB_CARD_FORMAT } from '../types';
import JobCardDocument from './JobCardDocument';
import { generateNextJobCardNumber } from '../utils/idUtils';
import { openInNewWindow } from '../utils/printDoc';
import { 
  FileSpreadsheet, 
  Search, 
  Wrench, 
  Printer, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  ClipboardList
} from 'lucide-react';

interface JobCardViewProps {
  jobs: Job[];
  onUpdateJob: (job: Job) => Promise<void>;
  currentUser: any;
  jobCardFormat?: JobCardFormatConfig;
}

export default function JobCardView({
  jobs,
  onUpdateJob,
  currentUser,
  jobCardFormat
}: JobCardViewProps) {
  const format = jobCardFormat || DEFAULT_JOB_CARD_FORMAT;
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

  // Filter jobs waiting for job card creation
  const pendingJobs = jobs.filter(job => job.status === 'PreQuoted');

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to compute 1 month from received date
  const getDefaultDueDateForJob = (job?: Job | null) => {
    if (job?.jobCardDetails?.dueDate) return job.jobCardDetails.dueDate;
    const base = job?.dateReceived ? new Date(job.dateReceived) : new Date();
    if (isNaN(base.getTime())) {
      const fallback = new Date();
      fallback.setMonth(fallback.getMonth() + 1);
      return fallback.toISOString().split('T')[0];
    }
    base.setMonth(base.getMonth() + 1);
    return base.toISOString().split('T')[0];
  };

  // Job Card Form State
  const [assignedTechnician, setAssignedTechnician] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [requiredParts, setRequiredParts] = useState('');
  const [instructions, setInstructions] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [yourRef, setYourRef] = useState('NONE');
  const [customerJobNumber, setCustomerJobNumber] = useState('NONE');
  const [dueDate, setDueDate] = useState('');
  const [workshopArea, setWorkshopArea] = useState('9B');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'page1' | 'page2' | 'all'>('all');
  const [activeModalTab, setActiveModalTab] = useState<'preview' | 'edit'>('preview');
  const [validationError, setValidationError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Pre-fill instructions with QC customer instructions if available
  useEffect(() => {
    if (selectedJob) {
      const defaultTech = currentUser?.displayName || currentUser?.email || 'Lead Technician';
      setAssignedTechnician(selectedJob.jobCardDetails?.assignedTechnician || defaultTech);
      setScheduledDate(selectedJob.jobCardDetails?.scheduledDate || new Date().toISOString().split('T')[0]);
      setRequiredParts(selectedJob.jobCardDetails?.requiredParts || '');
      
      const qcCustomerInstructions = selectedJob.inspectionDetails?.customerInstructions || '';
      const defaultIns = qcCustomerInstructions 
        ? `Customer Instructions: ${qcCustomerInstructions}\n\nProcedure steps:\n`
        : 'Perform standard workshop repair procedures in accordance with OEM parameters.';
      
      setInstructions(selectedJob.jobCardDetails?.instructions || defaultIns);

      // Pre-populate new fields if already present, or load sensible defaults
      setOrderNumber(selectedJob.jobCardDetails?.orderNumber || '');
      setYourRef(selectedJob.jobCardDetails?.yourRef || 'NONE');
      setCustomerJobNumber(selectedJob.jobCardDetails?.customerJobNumber || 'NONE');
      setDueDate(getDefaultDueDateForJob(selectedJob));
      setWorkshopArea(selectedJob.jobCardDetails?.workshopArea || '9B');
      setValidationError('');
    }
  }, [selectedJob, currentUser]);

  const handleSelectJob = (job: Job) => {
    setSelectedJob(job);
    setValidationError('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedJob) return;

    if (!assignedTechnician.trim()) {
      setValidationError("Lead Technician name is required before confirming and releasing the Job Card.");
      setActiveModalTab('edit');
      return;
    }

    setValidationError('');
    setIsSubmitting(true);
    try {
      const jobCardNumber = selectedJob.jobCardDetails?.jobCardNumber || generateNextJobCardNumber(jobs);
      const updatedJob: Job = {
        ...selectedJob,
        status: 'JobCardCreated', // Advance to Active Workshop state (Job Card Created)
        jobCardDetails: {
          jobCardNumber,
          assignedTechnician: assignedTechnician.trim(),
          scheduledDate,
          requiredParts,
          instructions,
          orderNumber,
          yourRef,
          customerJobNumber,
          dueDate,
          workshopArea,
          jobCardCreatedAt: new Date().toISOString().split('T')[0],
          jobCardCreatedBy: currentUser?.displayName || currentUser?.email || 'Workshop Planner'
        },
        updatedAt: new Date().toISOString()
      };

      await onUpdateJob(updatedJob);
      const releasedJobId = selectedJob.id;
      setSelectedJob(null);
      setSuccessToast(`Job Card #${jobCardNumber} successfully created & released for Component ${releasedJobId}! Moved to Active Workshop Floor.`);
    } catch (error) {
      console.error(error);
      setValidationError("Error saving Job Card details. Please check network connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getJobCardNum = () => {
    return selectedJob?.jobCardDetails?.jobCardNumber || (selectedJob ? generateNextJobCardNumber(jobs) : 'Doc');
  };

  const handlePrint = () => {
    openInNewWindow({
      elementId: 'printable-jobcard-doc',
      documentTitle: `Job Card - ${getJobCardNum()}`
    });
  };

  const filteredJobs = pendingJobs.filter(job => 
    job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.componentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.modelName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6" id="jobcard-view-root">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
        <h1 className="text-xl font-semibold text-slate-800 font-display flex items-center gap-2">
          <Wrench className="w-5 h-5 text-emerald-500" />
          Job Card Creation
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Review approved estimate details and convert them into physical or digital workshop job cards, designating technicians and special instructions.
        </p>
      </div>

      {successToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button 
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-extrabold text-xs px-2 py-1 bg-emerald-100 hover:bg-emerald-200 rounded-lg cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {!selectedJob ? (
        /* Search and Main Table List of Pending Jobs */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-left">
              <h2 className="text-base font-bold text-slate-800 font-display">
                Pending Job Cards
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review approved estimate details and generate job cards. Select any job to preview, print, or edit details.
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search quotes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="p-4">Job ID</th>
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">Component &amp; Model</th>
                  <th className="p-4">Serial Number</th>
                  <th className="p-4">Delivery Note #</th>
                  <th className="p-4">Sequence</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">No jobs pending card creation</p>
                      <p className="text-xs text-slate-400 mt-1">Try broadening your search or complete the pre-quote stage first.</p>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map(job => (
                    <tr 
                      key={job.id} 
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer font-medium animate-fade-in"
                      onClick={() => handleSelectJob(job)}
                    >
                      <td className="p-4 font-bold text-slate-900 font-mono tracking-wider">
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
                      <td className="p-4 font-semibold text-slate-500">
                        {getJobSequenceString(job, jobs)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-[10px] text-purple-600 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-full font-bold">
                          Pre-Quoted
                        </span>
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSelectJob(job)}
                          className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold px-3 py-1.5 rounded-lg border border-blue-200 hover:border-blue-600 transition-all text-xs cursor-pointer"
                        >
                          Configure &amp; Preview
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Overlay Modal Dialog when selectedJob is active */
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 md:p-6 lg:p-8 animate-fade-in" id="jobcard-wizard-modal">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col overflow-hidden animate-zoom-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-blue-50 p-2 rounded-xl text-blue-600 border border-blue-100">
                  <Wrench className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-bold text-slate-800 font-display">
                    Job Card Wizard: {selectedJob.id}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Configure details, preview visual sheets, and print or release to workshop.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1.5 bg-fuchsia-50 border border-fuchsia-100 px-3 py-1 rounded-full text-[11px] font-bold text-fuchsia-700 uppercase">
                  <span>{selectedJob.customerName}</span>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Navigation & Toolbar */}
            <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
              {/* Page View Toggle */}
              <div className="flex bg-slate-100 border border-slate-200/60 rounded-xl p-0.5 self-start shadow-xs">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('page1')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activePreviewTab === 'page1'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Page 1
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('page2')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activePreviewTab === 'page2'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Page 2
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('all')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activePreviewTab === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Show Both
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                  title="Print / Save PDF document in new window"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  Print Document
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer select-none disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm & Release Job Card'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Modal Body Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex flex-col items-center">
              {validationError && (
                <div className="w-full max-w-3xl bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 mb-4 shadow-xs text-left shrink-0">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              /* Simulated Screen Preview Container */
              <div className="w-full max-w-3xl flex flex-col items-center gap-8 animate-fade-in my-4">
                {/* Page 1 Preview Block */}
                {(activePreviewTab === 'page1' || activePreviewTab === 'all') && (
                  <div className="w-full bg-slate-100 p-4 rounded-2xl shadow-inner border border-slate-200 flex flex-col items-center">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">A4 Portrait Sheet — Page 1</div>
                    <div className="w-full max-w-[580px] bg-white shadow-xl border border-slate-300">
                      <JobCardDocument
                        format={format}
                        page="page1"
                        job={selectedJob}
                        overrideFields={{
                          jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber || generateNextJobCardNumber(jobs),
                          assignedTechnician,
                          orderNumber,
                          yourRef,
                          customerJobNumber,
                          dueDate,
                          workshopArea,
                          requiredParts,
                          instructions,
                          sequenceString: getJobSequenceString(selectedJob, jobs)
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Page 2 Preview Block */}
                {(activePreviewTab === 'page2' || activePreviewTab === 'all') && (
                  <div className="w-full bg-slate-100 p-4 rounded-2xl shadow-inner border border-slate-200 flex flex-col items-center">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">A4 Portrait Sheet — Page 2 (Timesheet &amp; Operations Log)</div>
                    <div className="w-full max-w-[580px] bg-white shadow-xl border border-slate-300">
                      <JobCardDocument
                        format={format}
                        page="page2"
                        job={selectedJob}
                        overrideFields={{
                          jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber || generateNextJobCardNumber(jobs),
                          assignedTechnician,
                          orderNumber,
                          yourRef,
                          customerJobNumber,
                          dueDate,
                          workshopArea,
                          requiredParts,
                          instructions,
                          sequenceString: getJobSequenceString(selectedJob, jobs)
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print container containing BOTH pages for the physical print */}
      {selectedJob && (
        <div id="printable-jobcard-doc" className="hidden print:block">
          <div className="print-page flex flex-col font-sans text-black bg-white">
            <JobCardDocument
              format={format}
              page="page1"
              job={selectedJob}
              overrideFields={{
                jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber || generateNextJobCardNumber(jobs),
                assignedTechnician,
                orderNumber,
                yourRef,
                customerJobNumber,
                dueDate,
                workshopArea,
                requiredParts,
                instructions,
                sequenceString: getJobSequenceString(selectedJob, jobs)
              }}
            />
          </div>
          <div className="print-page flex flex-col font-sans text-black bg-white">
            <JobCardDocument
              format={format}
              page="page2"
              job={selectedJob}
              overrideFields={{
                jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber || generateNextJobCardNumber(jobs),
                assignedTechnician,
                orderNumber,
                yourRef,
                customerJobNumber,
                dueDate,
                workshopArea,
                requiredParts,
                instructions,
                sequenceString: getJobSequenceString(selectedJob, jobs)
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
