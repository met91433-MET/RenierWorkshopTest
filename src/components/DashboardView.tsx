import { useState, useEffect, useMemo } from 'react';
import { Job, Machine, UserProfile, getPreQuoteId } from '../types';
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
  Calendar,
  Boxes,
  Calculator,
  Eye,
  Printer,
  Mail
} from 'lucide-react';
import { motion } from 'motion/react';
import StoresDashboardView from './StoresDashboardView';
import PreQuoteDocumentModal, { PreQuoteGroup } from './PreQuoteDocumentModal';

interface DashboardViewProps {
  jobs: Job[];
  machines?: Machine[];
  currentUser: UserProfile | null;
  onSelectJob: (job: Job, targetTab: string) => void;
  onNavigateToStores?: () => void;
}

export default function DashboardView({ 
  jobs, 
  machines = [],
  currentUser, 
  onSelectJob,
  onNavigateToStores
}: DashboardViewProps) {
  // Check permission access for each dashboard mode on the slider
  const canAccessIncoming = Boolean(!currentUser || currentUser.permissions?.isAdmin || currentUser.permissions?.canReceive);
  const canAccessJobCards = Boolean(!currentUser || currentUser.permissions?.isAdmin || currentUser.permissions?.canCreateJobCard);
  const canAccessPreQuote = Boolean(!currentUser || currentUser.permissions?.isAdmin || currentUser.permissions?.canQuote);
  const canAccessStores = Boolean(!currentUser || currentUser.permissions?.isAdmin || currentUser.permissions?.canStores);

  const allowedModes = useMemo(() => {
    const modes: ('incoming' | 'jobcards' | 'prequote' | 'stores')[] = [];
    if (canAccessIncoming) modes.push('incoming');
    if (canAccessJobCards) modes.push('jobcards');
    if (canAccessPreQuote) modes.push('prequote');
    if (canAccessStores) modes.push('stores');
    return modes.length > 0 ? modes : ['incoming'];
  }, [canAccessIncoming, canAccessJobCards, canAccessPreQuote, canAccessStores]);

  // Mode Switcher: 'incoming' (View 1: Receiving Dashboard), 'jobcards' (View 2: Jobs Dashboard), 'prequote' (View 3: PreQuote Dashboard), 'stores' (View 4: Stores Dashboard)
  const [activeDashboardMode, setActiveDashboardMode] = useState<'incoming' | 'jobcards' | 'prequote' | 'stores'>(allowedModes[0]);

  // Ensure active dashboard mode is always valid for the logged-in user's clearance
  useEffect(() => {
    if (!allowedModes.includes(activeDashboardMode)) {
      setActiveDashboardMode(allowedModes[0]);
    }
  }, [allowedModes, activeDashboardMode]);

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
  const handleSwitchMode = (mode: 'incoming' | 'jobcards' | 'prequote' | 'stores') => {
    setActiveDashboardMode(mode);
    setStatusFilter('All');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // ------------------- JOB CLASSIFICATION -------------------
  // View 1: Receiving components (Stage 1-3 before Job Card creation)
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

  // View 3: PreQuoted Jobs (Components with PreQuote created)
  const preQuoteJobs = jobs.filter(job => 
    job.status === 'PreQuoted' || 
    Boolean(job.preQuoteDetails?.steps && job.preQuoteDetails.steps.length > 0)
  );

  // Modal State for PreQuote Document
  const [selectedPreQuoteGroupForDoc, setSelectedPreQuoteGroupForDoc] = useState<PreQuoteGroup | null>(null);
  const [docModalInitialMode, setDocModalInitialMode] = useState<'view' | 'print' | 'email'>('view');

  // Group PreQuoted jobs by PreQuote ID so multiple jobs on 1 prequote form a single line
  const preQuoteGroups: PreQuoteGroup[] = useMemo(() => {
    const map = new Map<string, Job[]>();
    preQuoteJobs.forEach(job => {
      const pqId = getPreQuoteId(job, jobs);
      if (!map.has(pqId)) {
        map.set(pqId, []);
      }
      map.get(pqId)!.push(job);
    });

    const groups: PreQuoteGroup[] = [];
    map.forEach((groupedJobs, pqId) => {
      const customerName = groupedJobs[0]?.customerName || 'Unknown Customer';
      const deliveryNotes = Array.from(new Set(groupedJobs.map(j => j.deliveryNoteNumber).filter(Boolean)));
      const totalCost = groupedJobs.reduce((sum, j) => sum + (j.preQuoteDetails?.totalCost || 0), 0);
      const quotedBy = groupedJobs.find(j => j.preQuoteDetails?.quotedBy)?.preQuoteDetails?.quotedBy || 'Estimator';
      const quotedAt = groupedJobs.find(j => j.preQuoteDetails?.quotedAt)?.preQuoteDetails?.quotedAt || groupedJobs[0]?.dateReceived || '';
      const hasJobCard = groupedJobs.some(j => Boolean(j.jobCardDetails?.jobCardNumber));
      const jobCardNumbers = Array.from(new Set(groupedJobs.map(j => j.jobCardDetails?.jobCardNumber).filter(Boolean))) as string[];

      groups.push({
        preQuoteId: pqId,
        jobs: groupedJobs,
        customerName,
        deliveryNotes,
        totalCost,
        quotedBy,
        quotedAt,
        hasJobCard,
        jobCardNumbers
      });
    });

    return groups;
  }, [preQuoteJobs, jobs]);

  // ------------------- METRICS CALCULATIONS -------------------
  // View 1 Receiving Metrics
  const incomingReceivedCount = incomingJobs.filter(j => j.status === 'Received').length;
  const incomingQCCount = incomingJobs.filter(j => j.status === 'Inspected').length;
  const incomingQuotedCount = incomingJobs.filter(j => j.status === 'PreQuoted').length;
  const readyForJobCardCount = incomingJobs.filter(j => 
    j.status === 'PreQuoted' || (j.preQuoteDetails?.steps && j.preQuoteDetails.steps.length > 0)
  ).length;

  // View 2 Jobs Dashboard Metrics
  const activeJobCards = jobCardJobs.filter(j => j.status !== 'Closed');
  const activeJobCardsCount = activeJobCards.length;
  const totalQuotedValue = activeJobCards.reduce((sum, j) => sum + (j.preQuoteDetails?.totalCost || 0), 0);
  const assignedTechCount = activeJobCards.filter(j => Boolean(j.jobCardDetails?.assignedTechnician)).length;
  const closedJobCardsCount = jobCardJobs.filter(j => j.status === 'Closed').length;

  // View 3 PreQuote Dashboard Metrics (based on consolidated groups)
  const totalPreQuoteCount = preQuoteGroups.length;
  const totalPreQuoteValue = preQuoteGroups.reduce((sum, g) => sum + g.totalCost, 0);
  const avgPreQuoteValue = totalPreQuoteCount > 0 ? totalPreQuoteValue / totalPreQuoteCount : 0;
  const uniqueQuotersCount = new Set(preQuoteGroups.map(g => g.quotedBy).filter(Boolean)).size;

  // ------------------- FILTERING & PAGINATION LOGIC -------------------
  const filteredPreQuoteGroups = preQuoteGroups.filter(group => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch = !query ||
      group.preQuoteId.toLowerCase().includes(query) ||
      group.customerName.toLowerCase().includes(query) ||
      group.deliveryNotes.some(dn => dn.toLowerCase().includes(query)) ||
      group.quotedBy.toLowerCase().includes(query) ||
      group.jobs.some(j => 
        j.id.toLowerCase().includes(query) ||
        j.componentType.toLowerCase().includes(query) ||
        j.modelName.toLowerCase().includes(query) ||
        (j.serialNumber && j.serialNumber.toLowerCase().includes(query))
      );

    let matchesStatus = true;
    if (statusFilter !== 'All') {
      if (statusFilter === 'ReadyForCard') matchesStatus = !group.hasJobCard;
      else if (statusFilter === 'CardCreated') matchesStatus = group.hasJobCard;
    }

    return matchesSearch && matchesStatus;
  });

  const activeJobsList = activeDashboardMode === 'incoming' 
    ? incomingJobs 
    : jobCardJobs;

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
      } else if (activeDashboardMode === 'jobcards') {
        if (statusFilter === 'Active') matchesStatus = job.status !== 'Closed';
        else if (statusFilter === 'Closed') matchesStatus = job.status === 'Closed';
        else matchesStatus = job.status === statusFilter;
      }
    }

    return matchesSearch && matchesStatus;
  });

  // Calculate pagination boundaries
  const totalItems = activeDashboardMode === 'prequote' 
    ? filteredPreQuoteGroups.length 
    : filteredJobs.length;

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const validatedPage = Math.min(Math.max(1, currentPage), totalPages);
  
  const startIndex = (validatedPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);
  const paginatedPreQuoteGroups = filteredPreQuoteGroups.slice(startIndex, endIndex);

  // Format currency helper
  const formatCurrency = (val: number) => {
    return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6" id="dashboard-view-root">
      {/* Header Banner & View Switcher */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-display text-slate-800 flex items-center justify-center gap-2">
          Dashboard
        </h1>

        {/* TOP SEGMENTED VIEW SWITCHER */}
        <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-center gap-1 shrink-0">
          {/* View 1 Button: Receiving Dashboard */}
          {canAccessIncoming && (
            <button
              onClick={() => handleSwitchMode('incoming')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeDashboardMode === 'incoming'
                  ? 'bg-amber-500 text-white shadow-xs ring-1 ring-amber-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Receiving Dashboard</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeDashboardMode === 'incoming' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {incomingJobs.length}
              </span>
            </button>
          )}

          {/* View 2 Button: Jobs Dashboard */}
          {canAccessJobCards && (
            <button
              onClick={() => handleSwitchMode('jobcards')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeDashboardMode === 'jobcards'
                  ? 'bg-slate-900 text-white shadow-xs ring-1 ring-slate-800/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Jobs Dashboard</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeDashboardMode === 'jobcards' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {jobCardJobs.length}
              </span>
            </button>
          )}

          {/* View 3 Button: PreQuote Dashboard */}
          {canAccessPreQuote && (
            <button
              onClick={() => handleSwitchMode('prequote')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeDashboardMode === 'prequote'
                  ? 'bg-purple-600 text-white shadow-xs ring-1 ring-purple-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Calculator className="w-4 h-4 text-purple-200" />
              <span>PreQuote Dashboard</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeDashboardMode === 'prequote' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {preQuoteJobs.length}
              </span>
            </button>
          )}

          {/* View 4 Button: Stores Dashboard */}
          {canAccessStores && (
            <button
              onClick={() => handleSwitchMode('stores')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeDashboardMode === 'stores'
                  ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Boxes className="w-4 h-4 text-blue-200" />
              <span>Stores Dashboard</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== VIEW 1: RECEIVING DASHBOARD ==================== */}
      {activeDashboardMode === 'incoming' && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Receiving Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Receiving */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Receiving Queue</span>
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

          {/* Receiving Workflow Breakdown Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold tracking-tight text-slate-800 mb-4 flex items-center gap-2 font-display">
              <Layers className="w-4 h-4 text-amber-500" />
              Receiving Intake Pipeline (Pre-Job Card Stages)
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

      {/* ==================== VIEW 2: JOBS DASHBOARD ==================== */}
      {activeDashboardMode === 'jobcards' && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Jobs Dashboard Metrics Grid */}
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

      {/* ==================== VIEW 3: PREQUOTE DASHBOARD ==================== */}
      {activeDashboardMode === 'prequote' && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* PreQuote Dashboard Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Pre-Quoted Components */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all border-l-4 border-l-purple-500">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Pre-Quoted Components</span>
                <Calculator className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-3xl font-extrabold text-slate-800 font-display">{totalPreQuoteCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Unique PQ Estimations</p>
            </div>

            {/* Total Pre-Quote Value */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Quoted Value</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-700 font-display truncate">{formatCurrency(totalPreQuoteValue)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Combined Estimated Cost</p>
            </div>

            {/* Average Quote Value */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Average Quote Value</span>
                <Tag className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-extrabold text-blue-700 font-display truncate">{formatCurrency(avgPreQuoteValue)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Per Component Avg</p>
            </div>

            {/* Active Quoter Technicians */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Quoting Estimators</span>
                <UserCheck className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-extrabold text-amber-600 font-display">{uniqueQuotersCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Active Estimator Accounts</p>
            </div>
          </div>

          {/* PreQuote Workflow Breakdown Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold tracking-tight text-slate-800 mb-4 flex items-center gap-2 font-display">
              <Calculator className="w-4 h-4 text-purple-600" />
              Pre-Quote Estimation & Pricing Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div className="p-5 rounded-2xl border border-purple-200 bg-purple-50/50 flex flex-col justify-between relative overflow-hidden shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-purple-400/80 absolute right-3 top-2 text-2xl font-display">01</span>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">Stage 3 Pricing</p>
                  <h3 className="text-base font-bold tracking-tight mt-1 text-slate-800">PreQuote ID Assignment</h3>
                  <p className="text-xs text-slate-500 mt-1">Unique pre-quote identifiers (e.g. PQ00001) assigned to every inspected component.</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-purple-200/60 pt-3">
                  <span className="text-xl font-black text-slate-900 font-display">{totalPreQuoteCount} <span className="text-xs font-normal text-slate-500">pre-quoted</span></span>
                  <span className="text-xs font-bold text-purple-700 bg-white px-2.5 py-1 rounded-md border border-purple-200">PQ Standard</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between relative overflow-hidden shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-emerald-400/80 absolute right-3 top-2 text-2xl font-display">02</span>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Financial Estimations</p>
                  <h3 className="text-base font-bold tracking-tight mt-1 text-slate-800">Repair Cost Structure</h3>
                  <p className="text-xs text-slate-500 mt-1">Consolidated line items, labor operations, and machining matrix pricing.</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-emerald-200/60 pt-3">
                  <span className="text-lg font-black text-emerald-800 font-display truncate">{formatCurrency(totalPreQuoteValue)}</span>
                  <span className="text-xs font-bold text-emerald-700 bg-white px-2 py-1 rounded-md border border-emerald-200">Valued</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/50 flex flex-col justify-between relative overflow-hidden shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-blue-400/80 absolute right-3 top-2 text-2xl font-display">03</span>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">Job Card Handover</p>
                  <h3 className="text-base font-bold tracking-tight mt-1 text-slate-800">Ready for Workshop Card</h3>
                  <p className="text-xs text-slate-500 mt-1">Approved pre-quotes converted directly into official production Job Cards.</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-blue-200/60 pt-3">
                  <span className="text-xl font-black text-slate-900 font-display">{totalPreQuoteCount} <span className="text-xs font-normal text-slate-500">ready</span></span>
                  <span className="text-xs font-bold text-blue-700 bg-white px-2.5 py-1 rounded-md border border-blue-200">Ready for Card</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================== TABLE CONTAINER (WITH PAGINATION) ==================== */}
      {activeDashboardMode !== 'stores' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table Filters Header */}
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-800 flex items-center gap-2 font-display">
                {activeDashboardMode === 'incoming' && (
                  <>
                    <Inbox className="w-4.5 h-4.5 text-amber-500" />
                    Receiving Components List
                  </>
                )}
                {activeDashboardMode === 'jobcards' && (
                  <>
                    <FileText className="w-4.5 h-4.5 text-emerald-600" />
                    Official Jobs Dashboard List
                  </>
                )}
                {activeDashboardMode === 'prequote' && (
                  <>
                    <Calculator className="w-4.5 h-4.5 text-purple-600" />
                    PreQuote Components List
                  </>
                )}
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {totalItems} {totalItems === 1 ? 'Job' : 'Jobs'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeDashboardMode === 'incoming' && "Showing items in receiving queue awaiting inspection, pre-quote, or job card creation."}
                {activeDashboardMode === 'jobcards' && "Showing active job cards assigned to workshop floor technicians."}
                {activeDashboardMode === 'prequote' && "Showing all components with completed PreQuote estimations (formatted PQ00001)." }
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder={
                    activeDashboardMode === 'incoming' 
                      ? "Search serial, DN, customer, model..." 
                      : activeDashboardMode === 'jobcards'
                        ? "Search JC #, serial, tech, customer..."
                        : "Search PQ #, Job ID, customer, model..."
                  }
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
                  {activeDashboardMode === 'incoming' && (
                    <>
                      <option value="All">All Receiving Stages</option>
                      <option value="Received">1. Job Receiving</option>
                      <option value="Inspected">2. QC / Inspection</option>
                      <option value="PreQuoted">3. Pre-Quoted</option>
                    </>
                  )}
                  {activeDashboardMode === 'jobcards' && (
                    <>
                      <option value="All">All Job Cards</option>
                      <option value="Active">Active in Workshop</option>
                      <option value="Closed">Closed / Completed</option>
                    </>
                  )}
                  {activeDashboardMode === 'prequote' && (
                    <>
                      <option value="All">All Pre-Quotes</option>
                      <option value="ReadyForCard">Awaiting Job Card Issue</option>
                      <option value="CardCreated">Job Card Issued</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Jobs List / Table */}
          {totalItems === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700">No matching items found</h3>
              <p className="text-xs text-slate-400 mt-1">
                There are no items matching your search parameters or filter tab.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-slate-700 border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
                    {activeDashboardMode === 'incoming' && (
                      <>
                        <th className="p-4 pl-6">Job ID / Serial</th>
                        <th className="p-4">Delivery Note / RFQ #</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Component & Model</th>
                        <th className="p-4">Receiving Stage</th>
                        <th className="p-4">Date Recv</th>
                        <th className="p-4 text-right pr-6">Action</th>
                      </>
                    )}
                    {activeDashboardMode === 'jobcards' && (
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
                    {activeDashboardMode === 'prequote' && (
                      <>
                        <th className="p-4 pl-6">PreQuote ID & Jobs</th>
                        <th className="p-4">Customer & Delivery Note</th>
                        <th className="p-4">Component Breakdown</th>
                        <th className="p-4">Pre-Quote Total</th>
                        <th className="p-4">Quoted By & Date</th>
                        <th className="p-4">Stage Status</th>
                        <th className="p-4 text-center pr-6">PreQuote Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {activeDashboardMode === 'prequote' ? (
                    paginatedPreQuoteGroups.map((group) => (
                      <tr key={group.preQuoteId} className="hover:bg-purple-50/20 transition-colors">
                        {/* PreQuote ID & Component Count */}
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-purple-900 text-xs bg-purple-100/90 px-2.5 py-1 rounded-lg border border-purple-200 font-mono">
                              {group.preQuoteId}
                            </span>
                            <span className="text-[10px] bg-slate-100 font-extrabold text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                              {group.jobs.length} {group.jobs.length === 1 ? 'Component' : 'Components'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">Quoted: {group.quotedAt}</p>
                        </td>

                        {/* Customer & Delivery Note */}
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{group.customerName}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            DN: {group.deliveryNotes.length > 0 ? group.deliveryNotes.join(', ') : 'N/A'}
                          </div>
                        </td>

                        {/* Component Breakdown */}
                        <td className="p-4">
                          <div className="space-y-1">
                            {group.jobs.map((j, i) => (
                              <div key={j.id || i} className="text-xs text-slate-700 font-medium flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900">{j.componentType}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500 text-[11px] font-mono bg-slate-100 px-1.5 py-0.2 rounded-xs">
                                  Job #{j.id}
                                </span>
                                {j.modelName && <span className="text-slate-400 text-[10px]">({j.modelName})</span>}
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* PreQuote Total Cost */}
                        <td className="p-4 font-bold font-mono text-purple-900 text-xs">
                          <span className="text-purple-900 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 font-black text-xs">
                            {formatCurrency(group.totalCost)}
                          </span>
                        </td>

                        {/* Quoted By & Date */}
                        <td className="p-4">
                          <div className="font-semibold text-slate-800 text-xs">{group.quotedBy}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{group.quotedAt}</div>
                        </td>

                        {/* Stage Status */}
                        <td className="p-4">
                          {group.hasJobCard ? (
                            <span className="px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-800 border-emerald-300 font-bold text-[11px] inline-block">
                              Card Issued ({group.jobCardNumbers.join(', ')})
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg border bg-purple-50 text-purple-800 border-purple-300 font-bold text-[11px] flex items-center gap-1.5 w-fit">
                              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                              Pre-Quoted
                            </span>
                          )}
                        </td>

                        {/* Action Buttons: View, Print */}
                        <td className="p-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPreQuoteGroupForDoc(group);
                                setDocModalInitialMode('view');
                              }}
                              className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl border border-slate-300 transition-all cursor-pointer shadow-2xs text-[11px]"
                              title="View Official PreQuote Document"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPreQuoteGroupForDoc(group);
                                setDocModalInitialMode('print');
                              }}
                              className="inline-flex items-center gap-1 font-bold text-purple-800 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-xl border border-purple-200 transition-all cursor-pointer shadow-2xs text-[11px]"
                              title="Print Official PreQuote"
                            >
                              <Printer className="w-3.5 h-3.5 text-purple-600" />
                              <span>Print</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    paginatedJobs.map((job) => {
                      if (activeDashboardMode === 'incoming') {
                        // Render Receiving Components Row
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
                        // Render Jobs Dashboard Row (jobcards)
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
                    })
                  )}
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
                            : activeDashboardMode === 'prequote'
                              ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
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
      )}

      {/* ==================== VIEW 4: STORES DASHBOARD ==================== */}
      {activeDashboardMode === 'stores' && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
        >
          <StoresDashboardView currentUser={currentUser} jobs={jobs} machines={machines} />
        </motion.div>
      )}

      {/* PreQuote Official Document Modal */}
      {selectedPreQuoteGroupForDoc && (
        <PreQuoteDocumentModal
          group={selectedPreQuoteGroupForDoc}
          initialMode={docModalInitialMode}
          onClose={() => setSelectedPreQuoteGroupForDoc(null)}
        />
      )}
    </div>
  );
}
