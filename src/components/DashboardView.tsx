import { useState, useEffect } from 'react';
import { Job, UserProfile } from '../types';
import { 
  Clipboard, 
  Search, 
  Filter, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Layers, 
  AlertCircle,
  FileText,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Truck,
  DollarSign,
  UserCheck,
  PackageCheck,
  Tag,
  Hash,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardViewProps {
  jobs: Job[];
  currentUser: UserProfile | null;
  onSelectJob: (job: Job, targetTab: string) => void;
}

export default function DashboardView({ 
  jobs, 
  currentUser, 
  onSelectJob,
}: DashboardViewProps) {
  // Mode Switcher: 'incoming' (View 1: Incoming Components) vs 'jobcards' (View 2: Jobs with Job Cards)
  const [activeDashboardMode, setActiveDashboardMode] = useState<'incoming' | 'jobcards'>('incoming');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Reset pagination to page 1 on mode, filter, or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeDashboardMode, searchTerm, statusFilter, itemsPerPage]);

  // Reset status filter dropdown when mode changes
  const handleSwitchMode = (mode: 'incoming' | 'jobcards') => {
    setActiveDashboardMode(mode);
    setStatusFilter('All');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // ------------------- JOB CLASSIFICATION -------------------
  // View 1: Incoming components (Stage 1-3 before Job Card creation)
  const incomingJobs = jobs.filter(job => 
    job.status === 'Received' || 
    job.status === 'Inspected' || 
    job.status === 'PreQuoted' ||
    (!job.jobCardDetails?.jobCardNumber && job.status !== 'JobCardCreated' && job.status !== 'Closed')
  );

  // View 2: Jobs with Job Cards (Stage 4: Job Card Created, plus Closed / In Service)
  const jobCardJobs = jobs.filter(job => 
    job.status === 'JobCardCreated' || 
    Boolean(job.jobCardDetails?.jobCardNumber) ||
    job.status === 'Closed'
  );

  // ------------------- METRICS CALCULATIONS -------------------
  // View 1 Incoming Metrics
  const incomingReceivedCount = incomingJobs.filter(j => j.status === 'Received').length;
  const incomingQCCount = incomingJobs.filter(j => j.status === 'Inspected').length;
  const incomingQuotedCount = incomingJobs.filter(j => j.status === 'PreQuoted').length;
  const readyForJobCardCount = incomingJobs.filter(j => 
    j.status === 'PreQuoted' || (j.preQuoteDetails?.steps && j.preQuoteDetails.steps.length > 0)
  ).length;

  // View 2 Job Card Metrics
  const activeJobCards = jobCardJobs.filter(j => j.status !== 'Closed');
  const activeJobCardsCount = activeJobCards.length;
  const totalQuotedValue = activeJobCards.reduce((sum, j) => sum + (j.preQuoteDetails?.totalCost || 0), 0);
  const assignedTechCount = activeJobCards.filter(j => Boolean(j.jobCardDetails?.assignedTechnician)).length;
  const closedJobCardsCount = jobCardJobs.filter(j => j.status === 'Closed').length;

  // ------------------- FILTERING & PAGINATION LOGIC -------------------
  const activeJobsList = activeDashboardMode === 'incoming' ? incomingJobs : jobCardJobs;

  const filteredJobs = activeJobsList.filter(job => {
    const query = searchTerm.toLowerCase().trim();
    const jcNumber = job.jobCardDetails?.jobCardNumber || '';
    const orderNum = job.jobCardDetails?.orderNumber || '';
    const yourRef = job.jobCardDetails?.yourRef || '';
    const tech = job.jobCardDetails?.assignedTechnician || '';

    const matchesSearch = !query || 
      job.id.toLowerCase().includes(query) ||
      job.customerName.toLowerCase().includes(query) ||
      job.deliveryNoteNumber.toLowerCase().includes(query) ||
      job.componentType.toLowerCase().includes(query) ||
      job.modelName.toLowerCase().includes(query) ||
      job.serialNumber.toLowerCase().includes(query) ||
      jcNumber.toLowerCase().includes(query) ||
      orderNum.toLowerCase().includes(query) ||
      yourRef.toLowerCase().includes(query) ||
      tech.toLowerCase().includes(query);

    let matchesStatus = true;
    if (statusFilter !== 'All') {
      if (activeDashboardMode === 'incoming') {
        matchesStatus = job.status === statusFilter;
      } else {
        if (statusFilter === 'Active') matchesStatus = job.status !== 'Closed';
        else if (statusFilter === 'Closed') matchesStatus = job.status === 'Closed';
        else matchesStatus = job.status === statusFilter;
      }
    }

    return matchesSearch && matchesStatus;
  });

  // Calculate pagination boundaries
  const totalItems = filteredJobs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const validatedPage = Math.min(Math.max(1, currentPage), totalPages);
  
  const startIndex = (validatedPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  // Format currency helper
  const formatCurrency = (val: number) => {
    return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6" id="dashboard-view-root">
      {/* Header Banner & View Switcher */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-display text-slate-800 flex items-center gap-2">
            Welcome back, {currentUser?.displayName || currentUser?.email || 'Workshop Operator'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            MES Workshop3 — Real-time tracking for incoming component intakes and active job cards.
          </p>
        </div>

        {/* TOP SEGMENTED VIEW SWITCHER */}
        <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1 shrink-0 self-start lg:self-auto">
          {/* View 1 Button: Incoming Components */}
          <button
            onClick={() => handleSwitchMode('incoming')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeDashboardMode === 'incoming'
                ? 'bg-amber-500 text-white shadow-xs ring-1 ring-amber-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Incoming Components</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              activeDashboardMode === 'incoming' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {incomingJobs.length}
            </span>
          </button>

          {/* View 2 Button: Jobs with Job Cards */}
          <button
            onClick={() => handleSwitchMode('jobcards')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeDashboardMode === 'jobcards'
                ? 'bg-slate-900 text-white shadow-xs ring-1 ring-slate-800/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Jobs with Job Cards</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              activeDashboardMode === 'jobcards' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {jobCardJobs.length}
            </span>
          </button>
        </div>
      </div>

      {/* ==================== VIEW 1: INCOMING COMPONENTS ==================== */}
      {activeDashboardMode === 'incoming' && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Incoming Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Incoming */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Incoming Queue</span>
                <Inbox className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-extrabold text-slate-800 font-display">{incomingJobs.length}</p>
              <p className="text-[11px] text-slate-400 mt-1">Pending Job Card</p>
            </div>

            {/* Stage 1: Received */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">1. Received</span>
                <Truck className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-3xl font-extrabold text-blue-600 font-display">{incomingReceivedCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Awaiting Inspection</p>
            </div>

            {/* Stage 2: Inspected */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">2. Inspected</span>
                <Clipboard className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-extrabold text-amber-600 font-display">{incomingQCCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Awaiting Pre-Quote</p>
            </div>

            {/* Stage 3: Pre-Quoted */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-purple-500 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">3. Pre-Quoted</span>
                <DollarSign className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-3xl font-extrabold text-purple-600 font-display">{incomingQuotedCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Ready for Job Card</p>
            </div>

            {/* Ready to Issue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Ready for Card</span>
                <PackageCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-3xl font-extrabold text-emerald-600 font-display">{readyForJobCardCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Pre-Quote Complete</p>
            </div>
          </div>

          {/* Incoming Workflow Breakdown Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold tracking-tight text-slate-800 mb-4 flex items-center gap-2 font-display">
              <Layers className="w-4 h-4 text-amber-500" />
              Incoming Intake Pipeline (Pre-Job Card Stages)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/50 flex flex-col justify-between relative overflow-hidden shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-blue-400/80 absolute right-3 top-2 text-2xl font-display">01</span>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">Stage 1</p>
                  <h3 className="text-base font-bold tracking-tight mt-1 text-slate-800">Job Receiving</h3>
                  <p className="text-xs text-slate-500 mt-1">Incoming delivery notes, serial numbers, and initial capture.</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-blue-200/60 pt-3">
                  <span className="text-xl font-black text-slate-900 font-display">{incomingReceivedCount} <span className="text-xs font-normal text-slate-500">jobs</span></span>
                  <span className="text-xs font-bold text-blue-700 bg-white px-2.5 py-1 rounded-md border border-blue-200">Pending Inspection</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between relative overflow-hidden shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-amber-400/80 absolute right-3 top-2 text-2xl font-display">02</span>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Stage 2</p>
                  <h3 className="text-base font-bold tracking-tight mt-1 text-slate-800">QC Inspection & Photos</h3>
                  <p className="text-xs text-slate-500 mt-1">Damage assessments, technical findings, and targeted photo uploads.</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-amber-200/60 pt-3">
                  <span className="text-xl font-black text-slate-900 font-display">{incomingQCCount} <span className="text-xs font-normal text-slate-500">jobs</span></span>
                  <span className="text-xs font-bold text-amber-700 bg-white px-2.5 py-1 rounded-md border border-amber-200">Pending Pre-Quote</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl border border-purple-200 bg-purple-50/50 flex flex-col justify-between relative overflow-hidden shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-purple-400/80 absolute right-3 top-2 text-2xl font-display">03</span>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">Stage 3</p>
                  <h3 className="text-base font-bold tracking-tight mt-1 text-slate-800">Pre-Quoting & Pricing</h3>
                  <p className="text-xs text-slate-500 mt-1">Component matrix pricing, cost calculation, and final pre-quote approval.</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-purple-200/60 pt-3">
                  <span className="text-xl font-black text-slate-900 font-display">{incomingQuotedCount} <span className="text-xs font-normal text-slate-500">jobs</span></span>
                  <span className="text-xs font-bold text-purple-700 bg-white px-2.5 py-1 rounded-md border border-purple-200">Ready to Generate Card</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================== VIEW 2: JOBS WITH JOB CARDS ==================== */}
      {activeDashboardMode === 'jobcards' && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Job Cards Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Active Cards */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Active Job Cards</span>
                <FileText className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-3xl font-extrabold text-slate-800 font-display">{activeJobCardsCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Issued & In Workshop</p>
            </div>

            {/* Total Quoted Value */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Active Value</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-700 font-display truncate">{formatCurrency(totalQuotedValue)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Total Active Quoted Value</p>
            </div>

            {/* Assigned Technicians */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Assigned Techs</span>
                <UserCheck className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-3xl font-extrabold text-blue-600 font-display">{assignedTechCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Active Floor Technicians</p>
            </div>

            {/* Total Cards Created */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-purple-500 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Cards Issued</span>
                <Tag className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-3xl font-extrabold text-purple-600 font-display">{jobCardJobs.length}</p>
              <p className="text-[11px] text-slate-400 mt-1">Total Lifetime Cards</p>
            </div>

            {/* Completed / Closed */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-slate-600 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Closed Cards</span>
                <ShieldCheck className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-700 font-display">{closedJobCardsCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Repairs Completed</p>
            </div>
          </div>

          {/* Job Card Workflow Breakdown Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold tracking-tight text-slate-800 mb-4 flex items-center gap-2 font-display">
              <Wrench className="w-4 h-4 text-emerald-500" />
              Job Card Workshop Execution Pipeline
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between relative overflow-hidden shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-emerald-400/80 absolute right-3 top-2 text-2xl font-display">01</span>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">Stage 4</p>
                  <h3 className="text-base font-bold tracking-tight mt-1 text-slate-800">Job Card Generation</h3>
                  <p className="text-xs text-slate-500 mt-1">Official Job Card issuance, Order #, Your Ref, and required parts list.</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-emerald-200/60 pt-3">
                  <span className="text-xl font-black text-slate-900 font-display">{activeJobCardsCount} <span className="text-xs font-normal text-slate-500">active</span></span>
                  <span className="text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-md border border-emerald-200">Card Issued</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/50 flex flex-col justify-between relative overflow-hidden shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-blue-400/80 absolute right-3 top-2 text-2xl font-display">02</span>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">Workshop</p>
                  <h3 className="text-base font-bold tracking-tight mt-1 text-slate-800">Technician Routing & Execution</h3>
                  <p className="text-xs text-slate-500 mt-1">Assigned technician procedures, parts picking, and machining operations.</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-blue-200/60 pt-3">
                  <span className="text-xl font-black text-slate-900 font-display">{assignedTechCount} <span className="text-xs font-normal text-slate-500">assigned</span></span>
                  <span className="text-xs font-bold text-blue-700 bg-white px-2.5 py-1 rounded-md border border-blue-200">In Workshop</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between relative overflow-hidden shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-slate-300 absolute right-3 top-2 text-2xl font-display">03</span>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Completion</p>
                  <h3 className="text-base font-bold tracking-tight mt-1 text-slate-800">QC Release & Dispatch</h3>
                  <p className="text-xs text-slate-500 mt-1">Hard stamp validation, quality release signoff, and job closing archive.</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-xl font-black text-slate-900 font-display">{closedJobCardsCount} <span className="text-xs font-normal text-slate-500">closed</span></span>
                  <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200">Completed</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================== TABLE CONTAINER (WITH PAGINATION) ==================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-800 flex items-center gap-2 font-display">
              {activeDashboardMode === 'incoming' ? (
                <>
                  <Inbox className="w-4.5 h-4.5 text-amber-500" />
                  Incoming Components List
                </>
              ) : (
                <>
                  <FileText className="w-4.5 h-4.5 text-emerald-600" />
                  Official Job Cards List
                </>
              )}
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {totalItems} {totalItems === 1 ? 'Job' : 'Jobs'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeDashboardMode === 'incoming' 
                ? "Showing incoming items awaiting inspection, pre-quote, or job card creation."
                : "Showing active job cards assigned to workshop floor technicians."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder={activeDashboardMode === 'incoming' ? "Search serial, DN, customer, model..." : "Search JC #, serial, tech, customer..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 w-full sm:w-64 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-amber-500"
              />
            </div>

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-amber-500"
              >
                {activeDashboardMode === 'incoming' ? (
                  <>
                    <option value="All">All Incoming Stages</option>
                    <option value="Received">1. Job Receiving</option>
                    <option value="Inspected">2. QC / Inspection</option>
                    <option value="PreQuoted">3. Pre-Quoted</option>
                  </>
                ) : (
                  <>
                    <option value="All">All Job Cards</option>
                    <option value="Active">Active in Workshop</option>
                    <option value="Closed">Closed / Completed</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Jobs List / Table */}
        {filteredJobs.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">No matching jobs found</h3>
            <p className="text-xs text-slate-400 mt-1">
              There are no jobs matching your search parameters or filter tab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
                  {activeDashboardMode === 'incoming' ? (
                    <>
                      <th className="p-4 pl-6">Job ID / Serial</th>
                      <th className="p-4">Delivery Note / RFQ #</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Component & Model</th>
                      <th className="p-4">Incoming Stage</th>
                      <th className="p-4">Date Recv</th>
                      <th className="p-4 text-right pr-6">Action</th>
                    </>
                  ) : (
                    <>
                      <th className="p-4 pl-6">Job Card # & Job ID</th>
                      <th className="p-4">Customer & Order Ref</th>
                      <th className="p-4">Component & Serial #</th>
                      <th className="p-4">Quoted Value</th>
                      <th className="p-4">Assigned Tech</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right pr-6">Action</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {paginatedJobs.map((job) => {
                  if (activeDashboardMode === 'incoming') {
                    // Render Incoming Components Row
                    let statusBadge = '';
                    let statusText = '';
                    let nextActionTab = 'receiving';
                    let actionLabel = 'Open Job';

                    switch(job.status) {
                      case 'Received':
                        statusBadge = 'bg-blue-50 text-blue-700 border-blue-200';
                        statusText = '1. Received';
                        nextActionTab = 'inspection';
                        actionLabel = 'Inspect Job';
                        break;
                      case 'Inspected':
                        statusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                        statusText = '2. Inspected';
                        nextActionTab = 'quoting';
                        actionLabel = 'Add Pre-Quote';
                        break;
                      case 'PreQuoted':
                        statusBadge = 'bg-purple-50 text-purple-700 border-purple-200';
                        statusText = '3. Pre-Quoted';
                        nextActionTab = 'jobcard';
                        actionLabel = 'Create Job Card';
                        break;
                      default:
                        statusBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                        statusText = job.status;
                        nextActionTab = 'receiving';
                        actionLabel = 'View Job';
                        break;
                    }

                    return (
                      <tr key={job.id} className="hover:bg-amber-50/20 transition-colors">
                        {/* Job ID / Serial */}
                        <td className="p-4 pl-6">
                          <div className="font-bold text-slate-800 text-sm font-display flex items-center gap-1.5">
                            {job.id}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">SN: {job.serialNumber || 'N/A'}</div>
                        </td>

                        {/* Delivery Note */}
                        <td className="p-4 font-mono font-medium text-slate-700">
                          {job.deliveryNoteNumber}
                        </td>

                        {/* Customer */}
                        <td className="p-4 font-semibold text-slate-800">
                          {job.customerName}
                        </td>

                        {/* Component & Model */}
                        <td className="p-4">
                          <span className="font-bold text-slate-800">{job.componentType}</span>
                          <span className="text-slate-400 mx-1.5">•</span>
                          <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                            {job.modelName}
                          </span>
                        </td>

                        {/* Incoming Stage Badge */}
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] inline-block ${statusBadge}`}>
                            {statusText}
                          </span>
                        </td>

                        {/* Date Recv */}
                        <td className="p-4 font-mono text-slate-500">
                          {job.dateReceived}
                        </td>

                        {/* Action */}
                        <td className="p-4 text-right pr-6">
                          <button
                            onClick={() => onSelectJob(job, nextActionTab)}
                            className="inline-flex items-center gap-1.5 font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3.5 py-1.5 rounded-xl border border-amber-200 transition-all cursor-pointer shadow-2xs"
                          >
                            <span>{actionLabel}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  } else {
                    // Render Jobs with Job Cards Row
                    const jcNumber = job.jobCardDetails?.jobCardNumber || `JC-${job.id}`;
                    const orderNum = job.jobCardDetails?.orderNumber;
                    const yourRef = job.jobCardDetails?.yourRef;
                    const tech = job.jobCardDetails?.assignedTechnician || 'Unassigned';
                    const cost = job.preQuoteDetails?.totalCost || 0;

                    const isClosed = job.status === 'Closed';

                    return (
                      <tr key={job.id} className="hover:bg-emerald-50/20 transition-colors">
                        {/* Job Card # & Job ID */}
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-emerald-800 text-xs bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-200 font-mono">
                              {jcNumber}
                            </span>
                            <span className="font-bold text-slate-500 text-xs">({job.id})</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">Created: {job.jobCardDetails?.jobCardCreatedAt?.slice(0, 10) || job.dateReceived}</p>
                        </td>

                        {/* Customer & Order Ref */}
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{job.customerName}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {orderNum ? `PO #: ${orderNum}` : yourRef ? `Ref: ${yourRef}` : `DN: ${job.deliveryNoteNumber}`}
                          </div>
                        </td>

                        {/* Component & Serial # */}
                        <td className="p-4">
                          <div className="font-semibold text-slate-800">{job.componentType} ({job.modelName})</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">SN: {job.serialNumber}</div>
                        </td>

                        {/* Quoted Cost */}
                        <td className="p-4 font-bold font-mono text-slate-800 text-xs">
                          {cost > 0 ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              {formatCurrency(cost)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">Standard</span>
                          )}
                        </td>

                        {/* Assigned Tech */}
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold ${
                            tech !== 'Unassigned' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {tech}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          {isClosed ? (
                            <span className="px-2.5 py-1 rounded-lg border bg-slate-100 text-slate-700 border-slate-300 font-bold">
                              Closed / Done
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-800 border-emerald-300 font-bold flex items-center gap-1.5 w-fit">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              Card Active
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="p-4 text-right pr-6">
                          <button
                            onClick={() => onSelectJob(job, 'jobcard')}
                            className="inline-flex items-center gap-1.5 font-bold text-slate-800 hover:text-black bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-xl border border-slate-300 transition-all cursor-pointer shadow-2xs"
                          >
                            <span>Manage Card</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ==================== PAGINATION BAR ==================== */}
        {filteredJobs.length > 0 && (
          <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Summary Text */}
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{endIndex}</span> of{' '}
              <span className="font-bold text-slate-800">{totalItems}</span> jobs
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-3">
              {/* Items Per Page Selector */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Page Buttons */}
              <div className="flex items-center gap-1">
                {/* Previous Button */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={validatedPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-all shadow-2xs"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page Number Badges */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[32px] h-8 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      pageNum === validatedPage
                        ? activeDashboardMode === 'incoming'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                          : 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={validatedPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-all shadow-2xs"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
