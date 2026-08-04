import React, { useState, useEffect } from 'react';
import { Job, ComponentMatrix, JobQuoteStep, getPreQuoteId } from '../types';
import { 
  Calculator, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  DollarSign, 
  ArrowRight,
  RefreshCw,
  Edit2,
  Lock,
  Unlock,
  Link,
  Unlink,
  Layers,
  Check,
  Clock,
  X
} from 'lucide-react';

interface PreQuoteViewProps {
  jobs: Job[];
  componentsList: ComponentMatrix[];
  onUpdateJob: (job: Job) => Promise<void>;
  currentUser: any;
}

export default function PreQuoteView({
  jobs,
  componentsList,
  onUpdateJob,
  currentUser
}: PreQuoteViewProps) {
  // Helpers to group and manage deliveries
  const [selectedGroupJobs, setSelectedGroupJobs] = useState<Job[]>([]);
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<string | null>(null);
  const [selectedJobForMatrix, setSelectedJobForMatrix] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLeftTab, setActiveLeftTab] = useState<'ready' | 'pending' | 'waiting'>('ready');

  // Active Quote Draft
  const [quoteSteps, setQuoteSteps] = useState<JobQuoteStep[]>([]);
  const [quoterName, setQuoterName] = useState(currentUser?.displayName || currentUser?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selector for adding predefined steps
  const [selectedPredefinedStep, setSelectedPredefinedStep] = useState('');

  // Modal for Linking Jobs from Other Deliveries
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [customStepName, setCustomStepName] = useState('');
  const [customStepPrice, setCustomStepPrice] = useState<number | ''>('');

  // Grouping logic for the sidebar
  const getDeliveryGroups = () => {
    const groups: {
      [dn: string]: {
        deliveryNoteNumber: string;
        customerName: string;
        jobs: Job[];
        isBlocked: boolean;
        pendingInspectionCount: number;
        inspectedJobs: Job[];
      }
    } = {};

    jobs.forEach(job => {
      const dn = job.deliveryNoteNumber;
      if (!dn) return;

      if (!groups[dn]) {
        groups[dn] = {
          deliveryNoteNumber: dn,
          customerName: job.customerName,
          jobs: [],
          isBlocked: false,
          pendingInspectionCount: 0,
          inspectedJobs: []
        };
      }

      groups[dn].jobs.push(job);
      if (job.status === 'Received') {
        groups[dn].isBlocked = true;
        groups[dn].pendingInspectionCount += 1;
      } else if (job.status === 'Inspected') {
        groups[dn].inspectedJobs.push(job);
      }
    });

    return Object.values(groups);
  };

  const allGroups = getDeliveryGroups();

  // Filter groups that have at least one Inspected job
  const relevantGroups = allGroups.filter(g => g.jobs.some(j => j.status === 'Inspected'));

  // Apply search term
  const filteredGroups = relevantGroups.filter(g => 
    g.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.jobs.some(j => 
      j.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.componentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.modelName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const readyGroups = filteredGroups.filter(g => !g.isBlocked);
  const blockedGroups = filteredGroups.filter(g => g.isBlocked);

  // Jobs still to be inspected (status === 'Received')
  const waitingInspectionJobs = jobs.filter(j => j.status === 'Received');
  const filteredWaitingJobs = waitingInspectionJobs.filter(j => 
    j.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (j.deliveryNoteNumber && j.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (j.customerName && j.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (j.componentType && j.componentType.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (j.modelName && j.modelName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (j.serialNumber && j.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Other eligible ready jobs from different deliveries that are NOT in the active quote group
  const otherEligibleJobs = jobs.filter(j => 
    j.status === 'Inspected' && 
    !selectedGroupJobs.some(selected => selected.id === j.id)
  );

  const filteredLinkableJobs = otherEligibleJobs.filter(j => {
    const q = linkSearchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      j.id.toLowerCase().includes(q) ||
      (j.deliveryNoteNumber && j.deliveryNoteNumber.toLowerCase().includes(q)) ||
      (j.customerName && j.customerName.toLowerCase().includes(q)) ||
      (j.componentType && j.componentType.toLowerCase().includes(q)) ||
      (j.modelName && j.modelName.toLowerCase().includes(q)) ||
      (j.serialNumber && j.serialNumber.toLowerCase().includes(q))
    );
  });

  // Get pricing matrix for the job currently selected as the active matrix source
  const [selectedMatrixId, setSelectedMatrixId] = useState<string>('');

  const findMatrixForJob = (job: Job | null): ComponentMatrix | undefined => {
    if (!componentsList || componentsList.length === 0) return undefined;
    if (!job) return componentsList[0];

    const targetType = (job.componentType || '').trim();
    const targetModel = (job.modelName || '').trim();

    // 1. Direct match on ID or Name
    let matched = componentsList.find(c => c.id === targetType || c.name === targetType);
    if (matched) return matched;

    // 2. Case and whitespace insensitive match
    const cleanType = targetType.toLowerCase().replace(/\s+/g, '');
    if (cleanType) {
      matched = componentsList.find(c => 
        c.id.toLowerCase().replace(/\s+/g, '') === cleanType || 
        (c.name && c.name.toLowerCase().replace(/\s+/g, '') === cleanType) ||
        c.id.toLowerCase().includes(cleanType) ||
        (c.name && c.name.toLowerCase().includes(cleanType))
      );
      if (matched) return matched;
    }

    // 3. Match by model name in matrix models list
    if (targetModel) {
      const cleanModel = targetModel.toLowerCase().replace(/\s+/g, '');
      matched = componentsList.find(c => 
        c.models && c.models.some(m => m.toLowerCase().replace(/\s+/g, '') === cleanModel)
      );
      if (matched) return matched;
    }

    // 4. Fallback to first available pricing matrix
    return componentsList[0];
  };

  const activeMatrix = selectedMatrixId 
    ? componentsList.find(c => c.id === selectedMatrixId) || findMatrixForJob(selectedJobForMatrix)
    : findMatrixForJob(selectedJobForMatrix);

  // Helper to safely extract step price for a specific modelName
  const getStepPrice = (stepObj: { stepName: string; prices: Record<string, number> } | undefined, modelName: string): number => {
    if (!stepObj || !stepObj.prices) return 0;
    if (!modelName) {
      const firstVal = Object.values(stepObj.prices)[0];
      return typeof firstVal === 'number' ? firstVal : 0;
    }

    // Direct key match
    if (stepObj.prices[modelName] !== undefined) return stepObj.prices[modelName];

    // Case / trim match
    const cleanModel = modelName.trim().toLowerCase();
    const exactKey = Object.keys(stepObj.prices).find(k => k.trim().toLowerCase() === cleanModel);
    if (exactKey !== undefined) return stepObj.prices[exactKey];

    // Substring match
    const partialKey = Object.keys(stepObj.prices).find(k => 
      k.trim().toLowerCase().includes(cleanModel) || cleanModel.includes(k.trim().toLowerCase())
    );
    if (partialKey !== undefined) return stepObj.prices[partialKey];

    // Fallback to first available model price
    const firstVal = Object.values(stepObj.prices)[0];
    return typeof firstVal === 'number' ? firstVal : 0;
  };

  // Reset selected matrix override when selected job changes
  useEffect(() => {
    setSelectedMatrixId('');
    setSelectedPredefinedStep('');
  }, [selectedJobForMatrix]);

  // Sync selected job for matrix helper when group changes
  useEffect(() => {
    if (selectedGroupJobs.length > 0) {
      setQuoterName(currentUser?.displayName || currentUser?.email || '');
      
      // Default matrix source helper to the first job if not set or not in the current group
      if (!selectedJobForMatrix || !selectedGroupJobs.some(j => j.id === selectedJobForMatrix.id)) {
        setSelectedJobForMatrix(selectedGroupJobs[0]);
      }
    } else {
      setQuoteSteps([]);
      setSelectedJobForMatrix(null);
    }
  }, [selectedGroupJobs, currentUser]);

  const handleSelectGroup = (deliveryNoteNumber: string, inspectedJobs: Job[]) => {
    setSelectedDeliveryNote(deliveryNoteNumber);
    setSelectedGroupJobs(inspectedJobs);
    setQuoteSteps([]); // Start with a completely clean slate
    setSelectedPredefinedStep('');
    setCustomStepName('');
    setCustomStepPrice('');
  };

  const handleLinkJob = (jobToLink: Job) => {
    if (selectedGroupJobs.some(j => j.id === jobToLink.id)) return;
    
    // Add to group without prepopulating steps automatically
    setSelectedGroupJobs(prev => [...prev, jobToLink]);
  };

  const handleUnlinkJob = (jobId: string) => {
    setSelectedGroupJobs(prev => prev.filter(j => j.id !== jobId));
    // Filter out steps belonging to this unlinked job
    setQuoteSteps(prev => prev.filter(s => !s.stepName.startsWith(`${jobId} - `)));
    
    if (selectedJobForMatrix?.id === jobId) {
      const remaining = selectedGroupJobs.filter(j => j.id !== jobId);
      setSelectedJobForMatrix(remaining.length > 0 ? remaining[0] : null);
    }
  };

  // Add a step from the predefined pricing table
  const addPredefinedStep = () => {
    if (!selectedJobForMatrix || !activeMatrix || !selectedPredefinedStep) return;

    const fullStepName = `${selectedJobForMatrix.id} - ${selectedPredefinedStep}`;

    // Check if step is already added
    if (quoteSteps.some(s => s.stepName === fullStepName)) {
      alert("This step has already been added to the quote.");
      return;
    }

    const stepObj = activeMatrix.steps.find(s => s.stepName === selectedPredefinedStep);
    if (!stepObj) return;

    const price = getStepPrice(stepObj, selectedJobForMatrix.modelName);

    setQuoteSteps(prev => [
      ...prev,
      { stepName: fullStepName, price, isCustom: false }
    ]);
    setSelectedPredefinedStep('');
  };

  // Add a fully custom step
  const addCustomStep = () => {
    if (!selectedJobForMatrix || !customStepName.trim() || customStepPrice === '') return;

    const fullStepName = `${selectedJobForMatrix.id} - ${customStepName.trim()}`;

    if (quoteSteps.some(s => s.stepName.toLowerCase() === fullStepName.toLowerCase())) {
      alert("A step with this name already exists.");
      return;
    }

    setQuoteSteps(prev => [
      ...prev,
      { stepName: fullStepName, price: Number(customStepPrice), isCustom: true }
    ]);
    setCustomStepName('');
    setCustomStepPrice('');
  };

  const removeStep = (idx: number) => {
    setQuoteSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePriceChange = (idx: number, newPrice: number) => {
    setQuoteSteps(prev => {
      const updated = [...prev];
      updated[idx].price = newPrice;
      return updated;
    });
  };

  const totalCost = quoteSteps.reduce((sum, step) => sum + step.price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedGroupJobs.length === 0) return;

    if (quoteSteps.length === 0) {
      alert("Please add at least one repair step to the quote.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Save pre-quote to all jobs in the quote group
      const updatePromises = selectedGroupJobs.map(job => {
        const generatedPqId = job.preQuoteDetails?.preQuoteId || getPreQuoteId(job, jobs);
        const updatedJob: Job = {
          ...job,
          status: 'PreQuoted',
          preQuoteDetails: {
            preQuoteId: generatedPqId,
            steps: quoteSteps,
            totalCost,
            quotedAt: new Date().toISOString().split('T')[0],
            quotedBy: quoterName
          },
          updatedAt: new Date().toISOString()
        };
        return onUpdateJob(updatedJob);
      });

      await Promise.all(updatePromises);
      setSelectedGroupJobs([]);
      setSelectedDeliveryNote(null);
      alert(`Quote approved and applied to ${selectedGroupJobs.length} components.`);
    } catch (error) {
      console.error(error);
      alert("Error saving consolidated pre-quote pricing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Predefined steps available for current active matrix source
  const availablePredefinedSteps = activeMatrix
    ? activeMatrix.steps
        .map(s => s.stepName)
        .filter(name => selectedJobForMatrix ? !quoteSteps.some(qs => qs.stepName === `${selectedJobForMatrix.id} - ${name}`) : true)
    : [];

  return (
    <div className="space-y-6" id="prequote-view-root">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
        <h1 className="text-xl font-semibold text-slate-800 font-display flex items-center gap-2">
          <Calculator className="w-5 h-5 text-purple-500" />
          Pre-Quote Repair Estimator
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Compile repair quotes once all delivery components are fully inspected. Build a single consolidated pre-quote for entire orders, or link additional jobs dynamically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Delivery Queues */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1 space-y-5 text-left">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Waiting Pre Quote
            </h2>
            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full border border-purple-200 uppercase">
              Stage 3
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search delivery notes, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Tab Slider Control */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveLeftTab('ready')}
              className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                activeLeftTab === 'ready'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">Ready to Quote</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold shrink-0 ${
                activeLeftTab === 'ready' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {readyGroups.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLeftTab('pending')}
              className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                activeLeftTab === 'pending'
                  ? 'bg-white text-amber-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">Pending Inspection</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold shrink-0 ${
                activeLeftTab === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {blockedGroups.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLeftTab('waiting')}
              className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                activeLeftTab === 'waiting'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">Waiting Inspection</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold shrink-0 ${
                activeLeftTab === 'waiting' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {filteredWaitingJobs.length}
              </span>
            </button>
          </div>

          {/* TAB 1: Ready to Quote Deliveries */}
          {activeLeftTab === 'ready' && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Ready to Quote ({readyGroups.length})
              </h3>
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {readyGroups.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs font-medium">No deliveries ready to quote.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Check Pending or Waiting Inspection tabs.</p>
                  </div>
                ) : (
                  readyGroups.map(group => {
                    const isSelected = selectedDeliveryNote === group.deliveryNoteNumber;
                    return (
                      <button
                        key={group.deliveryNoteNumber}
                        type="button"
                        onClick={() => handleSelectGroup(group.deliveryNoteNumber, group.inspectedJobs)}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50/20 shadow-xs ring-2 ring-purple-500/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 font-display">DN: {group.deliveryNoteNumber}</span>
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-md font-bold">Passed QC</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-600">
                          {group.customerName}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {group.inspectedJobs.map(job => (
                            <span key={job.id} className="text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-sm">
                              {job.id} ({job.modelName})
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Pending Inspection Deliveries */}
          {activeLeftTab === 'pending' && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                Pending Inspection ({blockedGroups.length})
              </h3>
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {blockedGroups.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs font-medium">No active deliveries are pending inspection.</p>
                  </div>
                ) : (
                  blockedGroups.map(group => (
                    <div
                      key={group.deliveryNoteNumber}
                      className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col gap-2 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 font-display">DN: {group.deliveryNoteNumber}</span>
                        <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold uppercase flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          Locked
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-600">
                        {group.customerName}
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 flex items-start gap-1.5 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-[10px] text-amber-800 leading-normal">
                          <p className="font-bold">Awaiting Inspector Quality Pass</p>
                          <p className="text-slate-600 font-normal mt-0.5">
                            {group.pendingInspectionCount} of {group.jobs.length} components must be inspected before you can estimate this delivery.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {group.jobs.map(job => (
                          <span
                            key={job.id}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm border ${
                              job.status === 'Received'
                                ? 'bg-amber-50 text-amber-600 border-amber-150'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {job.id}: {job.status === 'Received' ? 'Pending' : 'Inspected'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Waiting Inspection (All jobs still to be inspected) */}
          {activeLeftTab === 'waiting' && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Waiting Inspection ({filteredWaitingJobs.length})
              </h3>
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {filteredWaitingJobs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs font-medium">No components currently waiting for inspection.</p>
                    <p className="text-[11px] text-slate-400 mt-1">All received jobs have completed quality inspection.</p>
                  </div>
                ) : (
                  filteredWaitingJobs.map(job => (
                    <div
                      key={job.id}
                      className="w-full p-4 rounded-xl border border-blue-100 bg-blue-50/30 hover:bg-blue-50/60 transition-all flex flex-col gap-2 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 font-display">{job.id}</span>
                        <span className="text-[9px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-bold uppercase flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-blue-500" />
                          Awaiting Inspection
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        {job.customerName || 'No Customer Specified'}
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div><span className="font-semibold text-slate-400">DN:</span> {job.deliveryNoteNumber || 'N/A'}</div>
                        <div><span className="font-semibold text-slate-400">Component:</span> {job.componentType} {job.modelName ? `(${job.modelName})` : ''}</div>
                        {job.serialNumber && <div><span className="font-semibold text-slate-400">S/N:</span> {job.serialNumber}</div>}
                      </div>
                      <div className="mt-1 bg-white border border-blue-150 rounded-lg p-2 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-medium">Received: {job.dateReceived || job.createdAt ? new Date(job.dateReceived || job.createdAt).toLocaleDateString() : 'Today'}</span>
                        <span className="font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">QC Inspection Pending</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Quote Worksheet */}
        <div className="lg:col-span-2">
          {selectedGroupJobs.length > 0 ? (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Worksheet Header */}
              <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 uppercase flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      Consolidated Quote Worksheet
                    </span>
                    {selectedDeliveryNote && (
                      <span className="text-xs text-slate-500 font-mono font-bold">Delivery: {selectedDeliveryNote}</span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 font-display mt-1">
                    Order Pricing for {selectedGroupJobs.length} Component(s)
                  </h2>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold text-slate-700">Combined Order</p>
                  <p className="text-slate-400 mt-0.5 font-semibold">
                    {selectedGroupJobs.map(j => j.id).join(', ')}
                  </p>
                </div>
              </div>

              {/* Jobs List in current Quote group */}
              <div className="px-6 pt-5 space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Components in this Quote</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedGroupJobs.map(job => (
                    <div key={job.id} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">{job.id}</span>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-150 px-1.5 py-0.5 rounded-sm">
                            {job.componentType} ({job.modelName})
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold font-mono">SN: {job.serialNumber}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlinkJob(job.id)}
                        disabled={selectedGroupJobs.length <= 1}
                        className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove component from this pre-quote"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Active Matrix Selection & Step Adding */}
                <div className="space-y-4 bg-slate-50 p-4.5 rounded-xl border border-slate-200">
                  {/* Selector for which component's matrix to view */}
                  <div className="space-y-2 text-left">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Active Pricing Matrix Source
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedGroupJobs.map(job => (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => setSelectedJobForMatrix(job)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            selectedJobForMatrix?.id === job.id
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${selectedJobForMatrix?.id === job.id ? 'bg-white' : 'bg-purple-500'}`}></span>
                          {job.id} ({job.modelName})
                        </button>
                      ))}
                    </div>
                    {selectedJobForMatrix && (
                      <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-left text-xs mt-2 shadow-2xs">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="font-bold text-amber-950">
                              Inspection Findings for <span className="underline">{selectedJobForMatrix.id}</span> ({selectedJobForMatrix.componentType} - {selectedJobForMatrix.modelName}):
                            </p>
                            {selectedJobForMatrix.inspectionDetails?.inspectorName && (
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                                Inspector: {selectedJobForMatrix.inspectionDetails.inspectorName}
                              </span>
                            )}
                          </div>
                          <p className="text-amber-900 mt-1 italic font-medium">
                            "{selectedJobForMatrix.inspectionDetails?.findings || 'No specific findings recorded during inspection.'}"
                          </p>
                          {selectedJobForMatrix.inspectionDetails?.customerInstructions && (
                            <p className="text-amber-900 mt-1 text-[11px]">
                              <strong className="text-amber-950 font-bold">Customer Instructions:</strong> {selectedJobForMatrix.inspectionDetails.customerInstructions}
                            </p>
                          )}
                          {selectedJobForMatrix.inspectionDetails?.inspectorNotes && (
                            <p className="text-amber-900 mt-1 text-[11px]">
                              <strong className="text-amber-950 font-bold">Inspector Notes:</strong> {selectedJobForMatrix.inspectionDetails.inspectorNotes}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Predefined Steps add */}
                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Add Step from Matrix {activeMatrix ? `(${activeMatrix.name || activeMatrix.id})` : ''}
                        </label>
                        {componentsList.length > 1 && (
                          <select
                            value={selectedMatrixId || activeMatrix?.id || ''}
                            onChange={(e) => setSelectedMatrixId(e.target.value)}
                            className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2 py-0.5 focus:outline-hidden shrink-0 max-w-[150px] truncate"
                            title="Switch Matrix Source"
                          >
                            {componentsList.map(m => (
                              <option key={m.id} value={m.id}>Matrix: {m.name || m.id}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <select
                          value={selectedPredefinedStep}
                          onChange={(e) => setSelectedPredefinedStep(e.target.value)}
                          className="flex-1 min-w-0 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden font-medium truncate"
                        >
                          <option value="">-- Choose step from matrix --</option>
                          {availablePredefinedSteps.map((name, idx) => {
                            const originalStep = activeMatrix?.steps.find(s => s.stepName === name);
                            const price = selectedJobForMatrix && originalStep ? getStepPrice(originalStep, selectedJobForMatrix.modelName) : 0;
                            return (
                              <option key={`${name}-${idx}`} value={name}>
                                {name} (R{price})
                              </option>
                            );
                          })}
                          {availablePredefinedSteps.length === 0 && (
                            <option value="" disabled>All matrix steps already added</option>
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={addPredefinedStep}
                          disabled={!selectedPredefinedStep}
                          className="shrink-0 whitespace-nowrap min-w-[75px] h-[36px] bg-purple-600 hover:bg-purple-700 disabled:opacity-55 text-white rounded-xl px-4 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>Add</span>
                        </button>
                      </div>
                      {!activeMatrix && selectedJobForMatrix && (
                        <p className="text-[10px] text-red-500 font-semibold mt-1">
                          * Pricing matrix was not found for component {selectedJobForMatrix.componentType}. Please define it in Admin Center.
                        </p>
                      )}
                    </div>

                    {/* Custom steps add */}
                    <div className="space-y-2 text-left">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Add Custom / Manual Step
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Step description (e.g. Specialized Boring)"
                          value={customStepName}
                          onChange={(e) => setCustomStepName(e.target.value)}
                          className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden"
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          value={customStepPrice}
                          onChange={(e) => setCustomStepPrice(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-20 shrink-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={addCustomStep}
                          disabled={!customStepName.trim() || customStepPrice === ''}
                          className="shrink-0 whitespace-nowrap min-w-[75px] h-[36px] bg-slate-700 hover:bg-slate-800 disabled:opacity-55 text-white rounded-xl px-4 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active quote steps list table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Consolidated Quote Line Items</h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 uppercase font-semibold border-b border-slate-200 text-[9px] tracking-wider">
                          <th className="p-3 pl-4">Step Description</th>
                          <th className="p-3">Source</th>
                          <th className="p-3 w-32">Price (R)</th>
                          <th className="p-3 text-right pr-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {quoteSteps.map((step, idx) => (
                          <tr key={`${step.stepName}-${idx}`} className="hover:bg-slate-50/40">
                            <td className="p-3 pl-4 font-medium text-slate-800 text-left">
                              {step.stepName}
                            </td>
                            <td className="p-3 text-left">
                              {step.isCustom ? (
                                <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px]">Custom</span>
                              ) : (
                                <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-[10px]">Pricing Matrix</span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1 max-w-[110px] bg-white">
                                <span className="text-slate-400 font-semibold font-sans text-xs">R</span>
                                <input
                                  type="number"
                                  value={step.price}
                                  onChange={(e) => handlePriceChange(idx, Number(e.target.value))}
                                  className="w-full bg-transparent border-0 p-0 text-xs text-slate-700 focus:ring-0 focus:outline-hidden font-bold text-right"
                                />
                              </div>
                            </td>
                            <td className="p-3 text-right pr-4">
                              <button
                                type="button"
                                onClick={() => removeStep(idx)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {quoteSteps.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                              No repair steps added. Please select matrix steps or add custom ones above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dynamic Linking Button for Out-of-the-norm Circumstances */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkSearchTerm('');
                      setIsLinkModalOpen(true);
                    }}
                    className="w-full py-3 px-4 bg-purple-50/80 hover:bg-purple-100/80 text-purple-700 font-bold rounded-xl border border-purple-200 transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-extrabold group-hover:scale-105 transition-transform shadow-2xs">
                        <Link className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-800">Link Components from Other Deliveries</p>
                        <p className="text-[10px] text-slate-500 font-normal">Add out-of-the-norm inspected jobs to this prequote order</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-purple-200/70 text-purple-900 font-extrabold px-2.5 py-0.5 rounded-full">
                        {otherEligibleJobs.length} available
                      </span>
                      <Plus className="w-4 h-4 text-purple-600 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                </div>

                {/* totals card and quoter */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-left">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Quoted By *</label>
                    <input
                      type="text"
                      required
                      value={quoterName}
                      onChange={(e) => setQuoterName(e.target.value)}
                      placeholder="Enter estimator name"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-hidden"
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex flex-col justify-between text-right">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Combined Order Quote</span>
                    <span className="text-2xl font-black text-slate-800 font-display mt-2 flex items-center justify-end gap-1">
                      <span className="text-sm font-semibold text-slate-400 font-sans">R</span>
                      {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroupJobs([]);
                    setSelectedDeliveryNote(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel Quote
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-55 cursor-pointer"
                >
                  {isSubmitting ? 'Saving Estimates...' : 'Approve & Pass to Job Cards'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400">
              <Calculator className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <h3 className="text-base font-semibold text-slate-700">Select a delivery for Estimating</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                Once all components on a delivery have passed quality inspection, the delivery is unlocked and ready to quote as a single combined order.
              </p>
            </div>
          )}
        </div>
      </div>
      {/* POPUP MODAL: SEARCH & LINK JOBS FROM OTHER DELIVERIES */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] text-left">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center">
                  <Link className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-display">
                    Link Jobs from Other Deliveries
                  </h3>
                  <p className="text-xs text-slate-500">
                    Search & add inspected components from other delivery notes into this quote
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={linkSearchTerm}
                  onChange={(e) => setLinkSearchTerm(e.target.value)}
                  placeholder="Search by Job ID, DN #, customer, component, serial #..."
                  className="w-full pl-10 pr-12 py-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-purple-500 focus:bg-white transition-all"
                  autoFocus
                />
                {linkSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setLinkSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Modal Candidate List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {filteredLinkableJobs.length === 0 ? (
                <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs font-semibold text-slate-600">
                    {otherEligibleJobs.length === 0
                      ? "No other inspected components available from different deliveries."
                      : "No components match your search filter."}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Only components that have passed QC Inspection (status: Inspected) and are not yet linked will appear here.
                  </p>
                </div>
              ) : (
                filteredLinkableJobs.map(job => (
                  <div
                    key={job.id}
                    className="p-3.5 bg-white hover:bg-purple-50/20 border border-slate-200 hover:border-purple-300 rounded-xl flex items-center justify-between text-left transition-all gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 font-display">{job.id}</span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                          Inspected QC Pass
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700">{job.customerName || 'No Customer Specified'}</p>
                      <div className="text-[11px] text-slate-500 font-mono space-x-2">
                        <span>DN: {job.deliveryNoteNumber || 'N/A'}</span>
                        <span>•</span>
                        <span>{job.componentType} {job.modelName ? `(${job.modelName})` : ''}</span>
                        {job.serialNumber && (
                          <>
                            <span>•</span>
                            <span>SN: {job.serialNumber}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLinkJob(job)}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Link Job</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium">
                Currently in quote: <span className="font-bold text-purple-700">{selectedGroupJobs.length} components</span>
              </p>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
