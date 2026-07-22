import React, { useState, useEffect } from 'react';
import { Job } from '../types';
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
}

export default function JobCardView({
  jobs,
  onUpdateJob,
  currentUser
}: JobCardViewProps) {
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

  // Job Card Form State
  const [assignedTechnician, setAssignedTechnician] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [requiredParts, setRequiredParts] = useState('');
  const [instructions, setInstructions] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [yourRef, setYourRef] = useState('NONE');
  const [customerJobNumber, setCustomerJobNumber] = useState('NONE');
  const [dueDate, setDueDate] = useState('31 Dec 2025');
  const [workshopArea, setWorkshopArea] = useState('9B');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'page1' | 'page2' | 'all'>('all');
  const [activeModalTab, setActiveModalTab] = useState<'preview' | 'edit'>('preview');

  // Pre-fill instructions with QC customer instructions if available
  useEffect(() => {
    if (selectedJob) {
      setAssignedTechnician(selectedJob.jobCardDetails?.assignedTechnician || '');
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
      setDueDate(selectedJob.jobCardDetails?.dueDate || '31 Dec 2025');
      setWorkshopArea(selectedJob.jobCardDetails?.workshopArea || '9B');
    }
  }, [selectedJob]);

  const handleSelectJob = (job: Job) => {
    setSelectedJob(job);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedJob) return;

    if (!assignedTechnician.trim()) {
      alert("Please assign a technician to the job card.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedJob: Job = {
        ...selectedJob,
        status: 'JobCardCreated', // Advance to Active Workshop state (Job Card Created)
        jobCardDetails: {
          assignedTechnician,
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
      setSelectedJob(null);
      alert(`Job Card successfully created for Job ${selectedJob.id}. Sent to workshop floor.`);
    } catch (error) {
      console.error(error);
      alert("Error saving Job Card details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
              {/* Tabs */}
              <div className="flex bg-slate-100 border border-slate-200/60 rounded-xl p-0.5 self-start shadow-xs">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('preview')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                    activeModalTab === 'preview'
                      ? 'bg-white text-slate-800 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5 text-blue-500" />
                  Job Card Preview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('edit')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                    activeModalTab === 'edit'
                      ? 'bg-white text-slate-800 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-500" />
                  Edit Configuration Details
                </button>
              </div>

              {/* Action Buttons based on active tab */}
              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                {activeModalTab === 'preview' && (
                  <div className="flex bg-slate-100 border border-slate-200/60 rounded-lg p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setActivePreviewTab('page1')}
                      className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
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
                      className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
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
                      className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                        activePreviewTab === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Show Both
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition-all cursor-pointer select-none"
                >
                  <Printer className="w-4 h-4" />
                  Print Sheets
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer select-none disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm & Release Job Card'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Modal Body Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
              {activeModalTab === 'edit' ? (
                /* Edit Configuration Details Form */
                <div className="w-full max-w-3xl bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 h-fit text-left animate-fade-in">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-800">Job Card Setup &amp; Routing Details</h4>
                    <p className="text-xs text-slate-400 mt-1">Review or adjust the details pre-populated from the job receiving step.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Assigned Tech */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Lead Technician *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Marc Artisan"
                        value={assignedTechnician}
                        onChange={(e) => setAssignedTechnician(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                      />
                    </div>

                    {/* Scheduled Date */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Scheduled Start
                      </label>
                      <input
                        type="date"
                        required
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-blue-500 font-semibold"
                      />
                    </div>

                    {/* Order Number */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Order Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 2604 EDWARD"
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                      />
                    </div>

                    {/* Workshop Area */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Workshop Area</label>
                      <input
                        type="text"
                        placeholder="e.g. 9B"
                        value={workshopArea}
                        onChange={(e) => setWorkshopArea(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-blue-500 font-mono font-bold"
                      />
                    </div>

                    {/* Your Ref */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Your Ref</label>
                      <input
                        type="text"
                        placeholder="e.g. NONE"
                        value={yourRef}
                        onChange={(e) => setYourRef(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                      />
                    </div>

                    {/* Customer Job Number */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Customer Job #</label>
                      <input
                        type="text"
                        placeholder="e.g. NONE"
                        value={customerJobNumber}
                        onChange={(e) => setCustomerJobNumber(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                      />
                    </div>

                    {/* Due Date */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Due Date</label>
                      <input
                        type="text"
                        placeholder="e.g. 31 Dec 2025"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-blue-500 font-semibold"
                      />
                    </div>
                  </div>

                  {/* Required Parts */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Parts &amp; Materials Required</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 2x Heavy Bearing Cups, 1x Retainer Ring, 3L Synthetic Lube"
                      value={requiredParts}
                      onChange={(e) => setRequiredParts(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                    />
                  </div>

                  {/* Procedure instructions */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Special Technical Instructions</label>
                    <textarea
                      rows={4}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-blue-500 font-mono text-slate-600"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold font-mono uppercase">Stage 4: Create Job Card</span>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('preview')}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer select-none flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Apply &amp; See Preview
                    </button>
                  </div>
                </div>
              ) : (
                /* Simulated Screen Preview Container */
                <div className="w-full max-w-4xl flex flex-col gap-6 animate-fade-in">
                  {/* Page 1 Preview Block */}
                  {(activePreviewTab === 'page1' || activePreviewTab === 'all') && (
                    <div className="bg-white border border-slate-400 shadow-md p-6 w-full text-black font-sans relative aspect-[1/1.41] scale-100 origin-top flex flex-col justify-between">
                      <div>
                        {/* Page 1 Header */}
                        <div className="border-2 border-black p-3 flex justify-between items-center bg-white">
                          <div className="flex items-center gap-2">
                            <div className="relative w-10 h-10">
                              <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-600 fill-current">
                                <path d="M50 35c-8.3 0-15 6.7-15 15s6.7 15 15 15 15-6.7 15-15-6.7-15-15-15zm0 25c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z" />
                                <path d="M91.5 44.5l-6.8-2.2c-.6-2.1-1.6-4.1-2.8-5.9l4.1-5.8c.8-1.1.7-2.6-.3-3.6l-5.7-5.7c-1-.1-2.5-.2-3.6.6l-5.8 4.1c-1.8-1.2-3.8-2.2-5.9-2.8l-2.2-6.8c-.4-1.3-1.6-2.2-3-2.2h-8c-1.4 0-2.6.9-3 2.2l-2.2 6.8c-2.1.6-4.1 1.6-5.9 2.8l-5.8-4.1c-1.1-.8-2.6-.7-3.6.3l-5.7 5.7c-1 1-1.1 2.5-.3 3.6l4.1 5.8c-1.2 1.8-2.2 3.8-2.8 5.9l-6.8 2.2c-1.3.4-2.2 1.6-2.2 3v8c0 1.4.9 2.6 2.2 3l6.8 2.2c.6 2.1 1.6 4.1 2.8 5.9l-4.1 5.8c-.8 1.1-.7 2.6.3 3.6l5.7 5.7c1 1 2.5 1.1 3.6.3l5.8-4.1c1.8 1.2 3.8 2.2 5.9 2.8l2.2 6.8c.4 1.3 1.6 2.2 3 2.2h8c1.4 0 2.6-.9 3-2.2l2.2-6.8c2.1-.6 4.1-1.6 5.9-2.8l5.8 4.1c1.1.8 2.6.7 3.6-.3l5.7-5.7c1-1 1.1-2.5.3-3.6l-4.1-5.8c1.2-1.8 2.2-3.8 2.8-5.9l6.8-2.2c1.3-.4 2.2-1.6 2.2-3v-8c0-1.4-.9-2.6-2.2-3zm-41.5 18c-7.2 0-13-5.8-13-13s5.8-13 13-13 13 5.8 13 13-5.8 13-13 13z" />
                              </svg>
                              <div className="absolute -bottom-1 -left-1 text-[5px] font-black text-amber-500 bg-white px-0.5 rounded border border-amber-300 transform -rotate-12 uppercase tracking-tight whitespace-nowrap">
                                Advanced Logic
                              </div>
                            </div>
                            <div className="text-left leading-none">
                              <div className="text-xs font-black tracking-tight text-slate-800 font-display">METALOGIK</div>
                              <div className="text-[5px] font-bold text-slate-500 uppercase">ENGINEERING SERVICES (Pty) Ltd</div>
                              <div className="text-[5px] font-bold text-slate-400">OMNI NOTE</div>
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="border border-red-500 text-[5px] text-red-500 font-bold px-0.5 rounded uppercase font-sans">SABS</span>
                              <span className="text-[5px] text-slate-400 font-bold">ISO 9001</span>
                            </div>
                            <h1 className="text-sm font-black text-slate-900 tracking-tight font-display mt-0.5">Job Card</h1>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500">Job #</span>
                            <div className="border border-red-500 rounded px-2.5 py-1 bg-red-50/50">
                              <span className="text-sm font-black text-red-600 font-mono tracking-wider">{selectedJob.id}</span>
                            </div>
                          </div>
                        </div>

                        {/* Details Grid Table */}
                        <div className="grid grid-cols-12 border-x-2 border-b-2 border-black bg-white">
                          <div className="col-span-7 flex flex-col justify-between border-r-2 border-black">
                            <div className="p-3 flex-1 flex flex-col justify-center items-center bg-slate-50/10 min-h-[50px]">
                              <span className="text-[7px] font-extrabold text-slate-400 tracking-wider uppercase block mb-0.5">Customer Identifier</span>
                              <span className="text-sm font-black text-fuchsia-600 tracking-wider font-display text-center leading-tight">
                                {selectedJob.customerName.toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 border-t-2 border-black text-[8px] font-bold text-slate-700">
                              <div className="p-1 border-r border-black text-center bg-slate-50/50">
                                <span className="text-[6px] text-slate-400 block uppercase font-bold leading-tight">Delivery / RFQ #</span>
                                <span className="font-bold text-slate-800 font-mono">{selectedJob.deliveryNoteNumber || 'NONE'}</span>
                              </div>
                              <div className="p-1 border-r border-black text-center bg-slate-50/50">
                                <span className="text-[6px] text-slate-400 block uppercase font-bold leading-tight">Your Ref. 1</span>
                                <span className="font-bold text-slate-800 font-mono">{yourRef || 'NONE'}</span>
                              </div>
                              <div className="p-1 text-center bg-slate-50/50">
                                <span className="text-[6px] text-slate-400 block uppercase font-bold leading-tight">Customer Job #</span>
                                <span className="font-bold text-slate-800 font-mono">{customerJobNumber || 'NONE'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="col-span-5 flex flex-col text-[8px]">
                            <div className="flex justify-between items-center px-1.5 py-0.5 bg-blue-50 border-b border-black text-[6px] font-bold text-slate-500">
                              <span className="text-blue-700 font-mono font-black">&lt;NA&gt;</span>
                              <span>{selectedJob.jobCardDetails?.jobCardCreatedAt || new Date().toISOString().split('T')[0]} 10:49:46</span>
                            </div>

                            <div className="grid grid-cols-3 border-b border-black">
                              <div className="p-1 font-bold text-slate-500 uppercase text-[6px] flex items-center bg-slate-50">Order #</div>
                              <div className="col-span-2 p-1 font-bold text-slate-800 border-l border-black text-left font-mono">{orderNumber || 'NONE'}</div>
                            </div>
                            <div className="grid grid-cols-3 border-b border-black">
                              <div className="p-1 font-bold text-slate-500 uppercase text-[6px] flex items-center bg-slate-50">Model #</div>
                              <div className="col-span-2 p-1 font-bold text-slate-800 border-l border-black text-left font-mono">{selectedJob.modelName || '960'}</div>
                            </div>
                            <div className="grid grid-cols-3 border-b border-black">
                              <div className="p-1 font-bold text-slate-500 uppercase text-[6px] flex items-center bg-slate-50">Status</div>
                              <div className="col-span-2 p-1 font-bold text-red-600 border-l border-black text-left font-mono">{assignedTechnician ? assignedTechnician.toUpperCase() : '2604 EDWARD'}</div>
                            </div>
                            <div className="grid grid-cols-4 text-center">
                              <div className="p-1 font-bold text-slate-500 uppercase text-[6px] bg-slate-50 border-r border-black flex items-center justify-center">Qty</div>
                              <div className="p-1 font-bold text-slate-800 border-r border-black flex items-center justify-center">1</div>
                              <div className="p-1 font-bold text-slate-500 uppercase text-[6px] bg-slate-50 border-r border-black flex items-center justify-center">Go Ahead</div>
                              <div className="p-1 font-bold text-blue-600 flex items-center justify-center font-mono">NA</div>
                            </div>
                          </div>
                        </div>

                        {/* Component Header Bar */}
                        <div className="border-x-2 border-b-2 border-black bg-slate-50 flex justify-between items-center px-3 py-1 text-[10px] font-black text-slate-900 leading-none">
                          <span className="font-mono text-red-600">{selectedJob.modelName || '960'}</span>
                          <span className="uppercase font-display tracking-widest text-[8px]">{selectedJob.modelName || '960'} {selectedJob.componentType.toUpperCase()} (F)-000</span>
                        </div>

                        {/* Workshop step area - replacing 'FOR TEST PURPOSES ONLY' */}
                        <div className="border-x-2 border-b-2 border-black p-3 bg-white min-h-[160px] flex flex-col justify-between relative">
                          <div className="text-left">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-[7px] font-extrabold text-slate-400 tracking-widest uppercase">
                                APPROVED REPAIR WORK PROCEDURES (FROM PRE-QUOTE)
                              </h3>
                              {/* Area Stamp Box */}
                              <div className="border-2 border-blue-600 rounded p-1 text-center min-w-[50px] bg-white transform rotate-2">
                                <span className="text-[5px] text-blue-500 font-extrabold uppercase tracking-tight block">AREA</span>
                                <span className="text-xs font-black text-blue-600 font-mono leading-none">{workshopArea || '9B'}</span>
                              </div>
                            </div>

                            <div className="space-y-1 text-[8px] text-slate-800 max-h-[120px] overflow-y-auto">
                              {(() => {
                                const prefix = `${selectedJob.id} - `;
                                const jobSteps = selectedJob.preQuoteDetails?.steps?.filter(step => 
                                  step.stepName.startsWith(prefix)
                                ) || [];
                                const displaySteps = jobSteps.length > 0 ? jobSteps : (selectedJob.preQuoteDetails?.steps || []);
                                return (
                                  <>
                                    {displaySteps.map((step, idx) => {
                                      const cleanName = step.stepName.startsWith(prefix)
                                        ? step.stepName.substring(prefix.length)
                                        : step.stepName;
                                      return (
                                        <div key={idx} className="flex items-start gap-1.5 leading-tight">
                                          <span className="text-[7px] text-slate-400 font-mono flex-shrink-0 font-bold">[ ]</span>
                                          <span>
                                            <span className="font-bold mr-1">{idx + 1}.</span>
                                            {cleanName}
                                          </span>
                                        </div>
                                      );
                                    })}
                                    {displaySteps.length === 0 && (
                                      <div className="text-slate-400 italic text-[7px]">
                                        No repair operations listed. Add operations during the pre-quote stage.
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="flex justify-between items-end border-t border-slate-100 pt-1.5 text-[8px] font-semibold text-slate-600">
                            <div>
                              <span>Approval Signature: _______________________</span>
                            </div>
                            <div className="border border-slate-200 px-2 py-0.5 bg-slate-50 rounded text-right flex flex-col leading-none">
                              <span className="text-[5px] text-slate-400 uppercase font-black block">Due Date</span>
                              <span className="font-bold text-slate-800 font-mono">{dueDate || '31 Dec 2025'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Consumables tables section */}
                        <div className="grid grid-cols-2 border-x-2 border-b-2 border-black bg-white">
                          <div className="border-r border-black flex flex-col">
                            <div className="bg-sky-100 border-b border-black text-center py-0.5 font-bold text-slate-700 text-[8px] uppercase tracking-wider">
                              Consumables
                            </div>
                            <table className="w-full text-[6px]">
                              <thead>
                                <tr className="bg-slate-50 text-slate-400 border-b border-black/30 text-center font-bold">
                                  <th className="p-0.5 border-r border-black/20 w-1/4">Supplier</th>
                                  <th className="p-0.5 border-r border-black/20 w-1/2">Description</th>
                                  <th className="p-0.5 border-r border-black/20 w-1/8">Size</th>
                                  <th className="p-0.5 w-1/8">QTY</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from({ length: 9 }).map((_, i) => (
                                  <tr key={i} className="h-2.5 border-b border-black/10">
                                    <td className="border-r border-black/20"></td>
                                    <td className="border-r border-black/20"></td>
                                    <td className="border-r border-black/20"></td>
                                    <td></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex flex-col">
                            <div className="flex flex-col border-b border-black">
                              <div className="bg-sky-100 border-b border-black text-center py-0.5 font-bold text-slate-700 text-[8px] uppercase tracking-wider">
                                Consumables
                              </div>
                              <table className="w-full text-[6px]">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-400 border-b border-black/30 text-center font-bold">
                                    <th className="p-0.5 border-r border-black/20 w-1/4">Supplier</th>
                                    <th className="p-0.5 border-r border-black/20 w-1/2">Description</th>
                                    <th className="p-0.5 border-r border-black/20 w-1/8">Size</th>
                                    <th className="p-0.5 w-1/8">QTY</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i} className="h-2.5 border-b border-black/10">
                                      <td className="border-r border-black/20"></td>
                                      <td className="border-r border-black/20"></td>
                                      <td className="border-r border-black/20"></td>
                                      <td></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="flex flex-col">
                              <div className="bg-amber-100 border-b border-black text-center py-0.5 font-bold text-slate-700 text-[8px] uppercase tracking-wider">
                                Outsourcing
                              </div>
                              <table className="w-full text-[6px]">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-400 border-b border-black/30 text-center font-bold">
                                    <th className="p-0.5 border-r border-black/20 w-1/4">Supplier</th>
                                    <th className="p-0.5 border-r border-black/20 w-1/2">Material Spec</th>
                                    <th className="p-0.5 border-r border-black/20 w-1/8">Hardness</th>
                                    <th className="p-1/8">QTY</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i} className="h-2.5 border-b border-black/10">
                                      <td className="border-r border-black/20"></td>
                                      <td className="border-r border-black/20"></td>
                                      <td className="border-r border-black/20"></td>
                                      <td></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="p-1 flex justify-between items-center mt-auto bg-slate-50/50">
                              <span className="text-[6px] text-slate-400 font-semibold font-mono">Seq: {getJobSequenceString(selectedJob, jobs)}</span>
                              <div className="border border-emerald-600 rounded p-0.5 text-center min-w-[70px] bg-white flex flex-col leading-none">
                                <span className="text-[5px] text-emerald-600 font-bold uppercase tracking-tight block">HARD STAMP DATE</span>
                                <div className="h-3 mt-0.5"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-[6px] text-slate-400 text-center font-semibold mt-1">Page 1: Workshop Floor Control Sheet</div>
                    </div>
                  )}

                  {/* Page 2 Preview Block */}
                  {(activePreviewTab === 'page2' || activePreviewTab === 'all') && (
                    <div className="bg-white border border-slate-400 shadow-md p-6 w-full text-black font-sans relative aspect-[1.41/1] scale-100 origin-top flex flex-col justify-between">
                      <div>
                        {/* Red warning subtitle */}
                        <div className="text-center font-black text-red-600 text-[8px] uppercase tracking-widest mb-2">
                          DOCUMENT NOT to be copied for customer
                        </div>

                        {/* Top Side Job Identifier */}
                        <div className="border-2 border-black p-3 flex justify-between items-center bg-slate-50 mb-3">
                          <div className="text-left">
                            <span className="text-[6px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Timesheet Record</span>
                            <h2 className="text-xs font-black text-slate-800 tracking-wide mt-0.5">WORKSHOP MACHINING LOG</h2>
                          </div>
                          <div className="flex gap-3 text-[8px] font-semibold text-slate-700">
                            <div className="border-r border-black/10 pr-2 leading-none text-left">
                              <span className="text-[5px] text-slate-400 uppercase block font-bold">Model</span>
                              <span>{selectedJob.modelName || '960'}</span>
                            </div>
                            <div className="border-r border-black/10 pr-2 leading-none text-left">
                              <span className="text-[5px] text-slate-400 uppercase block font-bold">Item Description</span>
                              <span>{selectedJob.componentType} ({selectedJob.modelName})</span>
                            </div>
                            <div className="leading-none text-left">
                              <span className="text-[5px] text-slate-400 uppercase block font-bold">Job Number</span>
                              <span className="text-red-600 font-mono font-black">{selectedJob.id}</span>
                            </div>
                          </div>
                        </div>

                        {/* Full machining timesheet table */}
                        <div className="border border-black overflow-x-auto bg-white">
                          <table className="w-full text-[6px]">
                            <thead>
                              <tr className="bg-slate-100 border-b border-black text-slate-700 font-black text-center divide-x divide-black">
                                <th className="p-1 w-[8%]">MC#</th>
                                <th className="p-1 w-[24%]">Operation</th>
                                <th className="p-1 w-[8%]">Clock No</th>
                                <th className="p-1 w-[16%]">Emp Name</th>
                                <th className="p-1 w-[10%]">Date</th>
                                <th className="p-1 w-[8%]">Time Start</th>
                                <th className="p-1 w-[8%]">Time End</th>
                                <th className="p-1 w-[9%]">Pick Up Size</th>
                                <th className="p-1 w-[9%]">Finished Size</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/30">
                              {Array.from({ length: 14 }).map((_, i) => (
                                <tr key={i} className="h-6 divide-x divide-black/20">
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="text-[6px] text-slate-400 text-center font-semibold mt-1">Page 2: Machine Shop Operations & Timesheet Log</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden print container containing BOTH pages for the physical print */}
      {selectedJob && (
        <div id="printable-jobcard-doc" className="hidden">
          {/* Page 1 */}
          <div className="print-page flex flex-col justify-between font-sans text-black bg-white">
            <div>
              {/* Header */}
              <div className="border-2 border-black p-4 flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-600 fill-current">
                      <path d="M50 35c-8.3 0-15 6.7-15 15s6.7 15 15 15 15-6.7 15-15-6.7-15-15-15zm0 25c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z" />
                      <path d="M91.5 44.5l-6.8-2.2c-.6-2.1-1.6-4.1-2.8-5.9l4.1-5.8c.8-1.1.7-2.6-.3-3.6l-5.7-5.7c-1-.1-2.5-.2-3.6.6l-5.8 4.1c-1.8-1.2-3.8-2.2-5.9-2.8l-2.2-6.8c-.4-1.3-1.6-2.2-3-2.2h-8c-1.4 0-2.6.9-3 2.2l-2.2 6.8c-2.1.6-4.1 1.6-5.9 2.8l-5.8-4.1c-1.1-.8-2.6-.7-3.6.3l-5.7 5.7c-1 1-1.1 2.5-.3 3.6l4.1 5.8c-1.2 1.8-2.2 3.8-2.8 5.9l-6.8 2.2c-1.3.4-2.2 1.6-2.2 3v8c0 1.4.9 2.6 2.2 3l6.8 2.2c.6 2.1 1.6 4.1 2.8 5.9l-4.1 5.8c-.8 1.1-.7 2.6.3 3.6l5.7 5.7c1 1 2.5 1.1 3.6.3l5.8-4.1c1.8 1.2 3.8 2.2 5.9 2.8l2.2 6.8c.4 1.3 1.6 2.2 3 2.2h8c1.4 0 2.6-.9 3-2.2l2.2-6.8c2.1-.6 4.1-1.6 5.9-2.8l5.8 4.1c1.1.8 2.6.7 3.6-.3l5.7-5.7c1-1 1.1-2.5.3-3.6l-4.1-5.8c1.2-1.8 2.2-3.8 2.8-5.9l6.8-2.2c1.3-.4 2.2-1.6 2.2-3v-8c0-1.4-.9-2.6-2.2-3zm-41.5 18c-7.2 0-13-5.8-13-13s5.8-13 13-13 13 5.8 13 13-5.8 13-13 13z" />
                    </svg>
                    <div className="absolute -bottom-1 -left-1 text-[6px] font-black text-amber-500 bg-white px-0.5 rounded border border-amber-300 transform -rotate-12 uppercase tracking-tight whitespace-nowrap">
                      Advanced Logic
                    </div>
                  </div>
                  <div className="text-left leading-none">
                    <div className="text-base font-black tracking-tight text-slate-800">METALOGIK</div>
                    <div className="text-[7px] font-bold text-slate-500 uppercase">ENGINEERING SERVICES (Pty) Ltd</div>
                    <div className="text-[6px] font-bold text-slate-400">OMNI NOTE</div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="border border-red-500 text-[6px] text-red-500 font-bold px-1 rounded uppercase tracking-wider">SABS</span>
                    <span className="text-[6px] text-slate-400 font-bold">ISO 9001</span>
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-wide font-display mt-0.5">Job Card</h1>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Job #</span>
                  <div className="border-2 border-red-500 rounded px-4 py-1.5 bg-white">
                    <span className="text-xl font-black text-red-600 font-mono tracking-wider">{selectedJob.id}</span>
                  </div>
                </div>
              </div>

              {/* Grid of Details */}
              <div className="grid grid-cols-12 border-x-2 border-b-2 border-black bg-white">
                <div className="col-span-7 flex flex-col justify-between border-r-2 border-black">
                  <div className="p-4 flex-1 flex flex-col justify-center items-center bg-slate-50/10 min-h-[70px]">
                    <span className="text-[9px] font-extrabold text-slate-400 tracking-widest uppercase block mb-1">Customer Identifier</span>
                    <span className="text-lg font-black text-fuchsia-600 tracking-wider font-display text-center leading-tight">
                      {selectedJob.customerName.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 border-t-2 border-black text-[9px] font-bold text-slate-700">
                    <div className="p-1.5 border-r border-black text-center bg-slate-50/50">
                      <span className="text-[7px] text-slate-400 block uppercase font-black leading-tight">Delivery / RFQ #</span>
                      <span className="font-bold text-slate-800 font-mono">{selectedJob.deliveryNoteNumber || 'NONE'}</span>
                    </div>
                    <div className="p-1.5 border-r border-black text-center bg-slate-50/50">
                      <span className="text-[7px] text-slate-400 block uppercase font-black leading-tight">Your Ref. 1</span>
                      <span className="font-bold text-slate-800 font-mono">{yourRef || 'NONE'}</span>
                    </div>
                    <div className="p-1.5 text-center bg-slate-50/50">
                      <span className="text-[7px] text-slate-400 block uppercase font-black leading-tight">Customer Job #</span>
                      <span className="font-bold text-slate-800 font-mono">{customerJobNumber || 'NONE'}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-5 flex flex-col text-[10px]">
                  <div className="flex justify-between items-center px-2.5 py-1 bg-blue-50 border-b border-black text-[8px] font-bold text-slate-500">
                    <span className="text-blue-700 font-mono font-black">&lt;NA&gt;</span>
                    <span>{selectedJob.jobCardDetails?.jobCardCreatedAt || new Date().toISOString().split('T')[0]} 10:49:46</span>
                  </div>

                  <div className="grid grid-cols-3 border-b border-black">
                    <div className="p-1.5 font-bold text-slate-500 uppercase text-[8px] flex items-center bg-slate-50">Order #</div>
                    <div className="col-span-2 p-1.5 font-bold text-slate-800 border-l border-black text-left font-mono">{orderNumber || 'NONE'}</div>
                  </div>
                  <div className="grid grid-cols-3 border-b border-black">
                    <div className="p-1.5 font-bold text-slate-500 uppercase text-[8px] flex items-center bg-slate-50">Model #</div>
                    <div className="col-span-2 p-1.5 font-bold text-slate-800 border-l border-black text-left font-mono">{selectedJob.modelName || '960'}</div>
                  </div>
                  <div className="grid grid-cols-3 border-b border-black">
                    <div className="p-1.5 font-bold text-slate-500 uppercase text-[8px] flex items-center bg-slate-50">Status</div>
                    <div className="col-span-2 p-1.5 font-bold text-red-600 border-l border-black text-left font-mono">{assignedTechnician ? assignedTechnician.toUpperCase() : '2604 EDWARD'}</div>
                  </div>
                  <div className="grid grid-cols-4 text-center">
                    <div className="p-1.5 font-bold text-slate-500 uppercase text-[8px] bg-slate-50 border-r border-black flex items-center justify-center">Qty</div>
                    <div className="p-1.5 font-bold text-slate-800 border-r border-black flex items-center justify-center">1</div>
                    <div className="p-1.5 font-bold text-slate-500 uppercase text-[8px] bg-slate-50 border-r border-black flex items-center justify-center">Go Ahead</div>
                    <div className="p-1.5 font-bold text-blue-600 flex items-center justify-center font-mono">NA</div>
                  </div>
                </div>
              </div>

              {/* Component Header Bar */}
              <div className="border-x-2 border-b-2 border-black bg-slate-50 flex justify-between items-center px-4 py-2 text-xs font-black text-slate-900 leading-none">
                <span className="font-mono text-base text-red-600">{selectedJob.modelName || '960'}</span>
                <span className="uppercase font-display tracking-widest text-[10px]">{selectedJob.modelName || '960'} {selectedJob.componentType.toUpperCase()} (F)-000</span>
              </div>

              {/* Procedures/Steps Box */}
              <div className="border-x-2 border-b-2 border-black p-4 bg-white min-h-[300px] flex flex-col justify-between relative">
                <div className="text-left">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      APPROVED REPAIR WORK PROCEDURES & INSTRUCTIONS
                    </h3>
                    {/* Area Stamp Box */}
                    <div className="border-2 border-blue-600 rounded-lg p-1.5 text-center min-w-[60px] bg-white transform rotate-2">
                      <span className="text-[6px] text-blue-500 font-extrabold uppercase block">AREA</span>
                      <span className="text-sm font-black text-blue-600 font-mono leading-none">{workshopArea || '9B'}</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-[10px] text-slate-800">
                    {(() => {
                      const prefix = `${selectedJob.id} - `;
                      const jobSteps = selectedJob.preQuoteDetails?.steps?.filter(step => 
                        step.stepName.startsWith(prefix)
                      ) || [];
                      const displaySteps = jobSteps.length > 0 ? jobSteps : (selectedJob.preQuoteDetails?.steps || []);
                      return (
                        <>
                          {displaySteps.map((step, idx) => {
                            const cleanName = step.stepName.startsWith(prefix)
                              ? step.stepName.substring(prefix.length)
                              : step.stepName;
                            return (
                              <div key={idx} className="flex items-start gap-2 leading-tight">
                                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 font-bold">[ ]</span>
                                <span>
                                  <span className="font-bold mr-1">{idx + 1}.</span>
                                  {cleanName}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex justify-between items-end border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-600">
                  <div>
                    <span>Approval Signature: _______________________</span>
                  </div>
                  <div className="border border-slate-200 px-3 py-1 bg-slate-50 rounded-lg text-right flex flex-col leading-none">
                    <span className="text-[6px] text-slate-400 uppercase font-black block">Due Date</span>
                    <span className="font-bold text-slate-800 font-mono">{dueDate || '31 Dec 2025'}</span>
                  </div>
                </div>
              </div>

              {/* Consumables columns */}
              <div className="grid grid-cols-2 border-x-2 border-b-2 border-black bg-white">
                <div className="border-r border-black flex flex-col">
                  <div className="bg-sky-100 border-b border-black text-center py-1 font-bold text-slate-700 text-[10px] uppercase tracking-wider">
                    Consumables
                  </div>
                  <table className="w-full text-[8px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 border-b border-black/30 text-center font-bold">
                        <th className="p-1 border-r border-black/20 w-1/4">Supplier</th>
                        <th className="p-1 border-r border-black/20 w-1/2">Description</th>
                        <th className="p-1 border-r border-black/20 w-1/8">Size</th>
                        <th className="p-1 w-1/8">QTY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 11 }).map((_, i) => (
                        <tr key={i} className="h-[21px] border-b border-black/10">
                          <td className="border-r border-black/20"></td>
                          <td className="border-r border-black/20"></td>
                          <td className="border-r border-black/20"></td>
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col border-b border-black">
                      <div className="bg-sky-100 border-b border-black text-center py-1 font-bold text-slate-700 text-[10px] uppercase tracking-wider">
                        Consumables
                      </div>
                      <table className="w-full text-[8px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 border-b border-black/30 text-center font-bold">
                            <th className="p-1 border-r border-black/20 w-1/4">Supplier</th>
                            <th className="p-1 border-r border-black/20 w-1/2">Description</th>
                            <th className="p-1 border-r border-black/20 w-1/8">Size</th>
                            <th className="p-1 w-1/8">QTY</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 4 }).map((_, i) => (
                            <tr key={i} className="h-[21px] border-b border-black/10">
                              <td className="border-r border-black/20"></td>
                              <td className="border-r border-black/20"></td>
                              <td className="border-r border-black/20"></td>
                              <td></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col">
                      <div className="bg-amber-100 border-b border-black text-center py-1 font-bold text-slate-700 text-[10px] uppercase tracking-wider">
                        Outsourcing
                      </div>
                      <table className="w-full text-[8px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 border-b border-black/30 text-center font-bold">
                            <th className="p-1 border-r border-black/20 w-1/4">Supplier</th>
                            <th className="p-1 border-r border-black/20 w-1/2">Material Spec</th>
                            <th className="p-1 border-r border-black/20 w-1/8">Hardness</th>
                            <th className="p-1 w-1/8">QTY</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i} className="h-[21px] border-b border-black/10">
                              <td className="border-r border-black/20"></td>
                              <td className="border-r border-black/20"></td>
                              <td className="border-r border-black/20"></td>
                              <td></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-2 flex justify-between items-center bg-slate-50/50 border-t border-black/20 mt-auto">
                    <span className="text-[8px] text-slate-400 font-bold font-mono">Seq: {getJobSequenceString(selectedJob, jobs)}</span>
                    <div className="border-2 border-emerald-600 rounded-lg p-1.5 text-center min-w-[100px] bg-white flex flex-col leading-none">
                      <span className="text-[6px] text-emerald-600 font-black uppercase tracking-wider block">HARD STAMP DATE</span>
                      <div className="h-5 mt-1"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-[8px] text-slate-400 text-center font-semibold border-t border-slate-100 pt-2">Page 1: Workshop Floor Control Sheet</div>
          </div>

          {/* Page 2 */}
          <div className="print-page-landscape flex flex-col justify-between font-sans text-black bg-white">
            <div>
              {/* Warning label */}
              <div className="text-center font-black text-red-600 text-xs uppercase tracking-widest mb-4">
                DOCUMENT NOT to be copied for customer
              </div>

              {/* Sidebar Header Block */}
              <div className="border-2 border-black p-4 flex justify-between items-center bg-slate-50 mb-4">
                <div>
                  <span className="text-[8px] font-black text-red-500 uppercase tracking-widest block">Timesheet Record</span>
                  <h2 className="text-sm font-black text-slate-800 tracking-wider mt-0.5">WORKSHOP MACHINING LOG</h2>
                </div>
                <div className="flex gap-4 text-xs font-semibold text-slate-700">
                  <div className="border-r border-black/10 pr-3 text-left">
                    <span className="text-[7px] text-slate-400 uppercase block font-bold leading-tight">Model</span>
                    <span>{selectedJob.modelName || '960'}</span>
                  </div>
                  <div className="border-r border-black/10 pr-3 text-left">
                    <span className="text-[7px] text-slate-400 uppercase block font-bold leading-tight">Item Description</span>
                    <span>{selectedJob.componentType} ({selectedJob.modelName})</span>
                  </div>
                  <div className="text-left">
                    <span className="text-[7px] text-slate-400 uppercase block font-bold leading-tight">Job Number</span>
                    <span className="text-red-600 font-mono font-black">{selectedJob.id}</span>
                  </div>
                </div>
              </div>

              {/* Timesheet Table */}
              <div className="border border-black overflow-hidden bg-white">
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black text-slate-700 font-black text-center divide-x divide-black">
                      <th className="p-2 w-[8%]">MC#</th>
                      <th className="p-2 w-[24%]">Operation</th>
                      <th className="p-2 w-[8%]">Clock No</th>
                      <th className="p-2 w-[16%]">Emp Name</th>
                      <th className="p-2 w-[10%]">Date</th>
                      <th className="p-2 w-[8%]">Time Start</th>
                      <th className="p-2 w-[8%]">Time End</th>
                      <th className="p-2 w-[9%]">Pick Up Size</th>
                      <th className="p-2 w-[9%]">Finished Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/30">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <tr key={i} className="h-8 divide-x divide-black/20">
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="text-[8px] text-slate-400 text-center font-semibold border-t border-slate-100 pt-2">Page 2: Machine Shop Operations & Timesheet Log</div>
          </div>
        </div>
      )}
    </div>
  );
}
