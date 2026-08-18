import React, { useState, useMemo, useEffect } from 'react';
import { 
  WorksheetEntry, 
  Job, 
  Machine, 
  Customer, 
  ComponentMatrix, 
  UserProfile,
  ConsumableAllocationLog,
  formatMachineDisplayName,
  hasJobGoAhead
} from '../types';
import { 
  subscribeConsumableAllocationLogs,
  subscribeWorksheetEntries,
  getWorksheetEntries
} from '../dbService';
import { 
  openInNewWindow,
  printViaHiddenIframe,
  printDocumentReliably,
  triggerNativePrint
} from '../utils/printDoc';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  CartesianGrid,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { 
  Calendar, 
  Filter, 
  Download, 
  Printer, 
  RefreshCw, 
  FileSpreadsheet, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  TrendingUp, 
  Users, 
  Wrench, 
  Building2, 
  Briefcase, 
  Activity, 
  PieChart as PieChartIcon, 
  SlidersHorizontal,
  X,
  Boxes,
  HelpCircle,
  ExternalLink,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type ReportTemplateType = 
  | 'employee_labour'
  | 'machine_utilization'
  | 'job_labour_breakdown'
  | 'operation_distribution'
  | 'customer_summary'
  | 'executive_overview'
  | 'custom_query';

export type GroupByOption = 
  | 'clockNumber' 
  | 'machine' 
  | 'jobNumber' 
  | 'customer' 
  | 'operation' 
  | 'date'
  | 'month';

interface WorksheetReportsViewProps {
  entries?: WorksheetEntry[];
  jobs: Job[];
  machines: Machine[];
  customers?: Customer[];
  componentsList?: ComponentMatrix[];
  currentUser: UserProfile | null;
  onSelectJob?: (job: Job) => void;
}

export default function WorksheetReportsView({
  entries: propEntries,
  jobs = [],
  machines = [],
  customers = [],
  componentsList = [],
  currentUser,
  onSelectJob
}: WorksheetReportsViewProps) {
  // Internal entries state if not passed from parent
  const [internalEntries, setInternalEntries] = useState<WorksheetEntry[]>([]);

  useEffect(() => {
    if (!propEntries || propEntries.length === 0) {
      const unsub = subscribeWorksheetEntries((data) => {
        setInternalEntries(data);
      });
      return () => {
        if (unsub) unsub();
      };
    }
  }, [propEntries]);

  const entries = (propEntries && propEntries.length > 0) ? propEntries : internalEntries;
  // Report Selection
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplateType>('employee_labour');

  // Date Range Filter State
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'last_month' | 'this_quarter' | 'ytd' | 'custom'>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Multi-dimensional Query Filters
  const [filterClockNumber, setFilterClockNumber] = useState<string>('ALL');
  const [filterMachineId, setFilterMachineId] = useState<string>('ALL');
  const [filterJobNumber, setFilterJobNumber] = useState<string>('');
  const [filterCustomerId, setFilterCustomerId] = useState<string>('ALL');
  const [filterOperation, setFilterOperation] = useState<string>('ALL');
  const [filterGoAheadOnly, setFilterGoAheadOnly] = useState<'ALL' | 'GO_AHEAD' | 'NO_GO_AHEAD'>('ALL');
  const [filterMinHours, setFilterMinHours] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Custom Query Grouping & Sorting
  const [customGroupBy, setCustomGroupBy] = useState<GroupByOption>('clockNumber');
  const [sortBy, setSortBy] = useState<'hours_desc' | 'hours_asc' | 'count_desc' | 'name_asc'>('hours_desc');

  // Interactive Drilldown state (expanded group keys)
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  // Print Preview Modal State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Consumables state for workshop linkage
  const [consumableLogs, setConsumableLogs] = useState<ConsumableAllocationLog[]>([]);

  useEffect(() => {
    const unsub = subscribeConsumableAllocationLogs((data) => {
      setConsumableLogs(data);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Quick Date Range helper
  const resolvedDateRange = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (datePreset === 'today') {
      return { start: todayStr, end: todayStr, label: 'Today' };
    }
    if (datePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      return { start: yStr, end: yStr, label: 'Yesterday' };
    }
    if (datePreset === 'last_7_days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { start: d.toISOString().slice(0, 10), end: todayStr, label: 'Last 7 Days' };
    }
    if (datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { start, end: todayStr, label: 'This Month' };
    }
    if (datePreset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      return { start, end, label: 'Last Month' };
    }
    if (datePreset === 'this_quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1).toISOString().slice(0, 10);
      return { start, end: todayStr, label: 'This Quarter' };
    }
    if (datePreset === 'ytd') {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      return { start, end: todayStr, label: 'Year to Date' };
    }
    if (datePreset === 'custom') {
      return { start: customStartDate, end: customEndDate, label: `${customStartDate} to ${customEndDate}` };
    }
    return { start: '', end: '', label: 'All Recorded Time' };
  }, [datePreset, customStartDate, customEndDate]);

  // Extract all unique clock numbers from entries
  const availableClockNumbers = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.clockNumber) set.add(e.clockNumber.trim());
    });
    return Array.from(set).sort();
  }, [entries]);

  // Extract all unique operations
  const availableOperations = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.operation) set.add(e.operation.trim());
    });
    return Array.from(set).sort();
  }, [entries]);

  // Map job numbers to job details for rapid lookup
  const jobsByNumberMap = useMemo(() => {
    const map = new Map<string, Job>();
    jobs.forEach((j) => {
      if (j.jobCardDetails?.jobCardNumber) {
        map.set(j.jobCardDetails.jobCardNumber.toLowerCase(), j);
      }
      map.set(j.id.toLowerCase(), j);
      if (j.deliveryNoteNumber) {
        map.set(j.deliveryNoteNumber.toLowerCase(), j);
      }
    });
    return map;
  }, [jobs]);

  // Map machine IDs to machines
  const machinesByIdMap = useMemo(() => {
    const map = new Map<string, Machine>();
    machines.forEach((m) => {
      map.set(m.id, m);
      if (m.serialNumber) map.set(m.serialNumber.toLowerCase(), m);
      if (m.machineName) map.set(m.machineName.toLowerCase(), m);
    });
    return map;
  }, [machines]);

  // 1. FILTER ENTRIES BASED ON ALL APPLIED QUERY CONDITIONS
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Date Range Filter
      if (resolvedDateRange.start && entry.jobDate < resolvedDateRange.start) return false;
      if (resolvedDateRange.end && entry.jobDate > resolvedDateRange.end) return false;

      // Clock Number Filter
      if (filterClockNumber !== 'ALL' && entry.clockNumber?.toLowerCase() !== filterClockNumber.toLowerCase()) {
        return false;
      }

      // Machine Filter
      if (filterMachineId !== 'ALL') {
        const matchesId = entry.machineId === filterMachineId;
        const matchesSerial = entry.machineSerialNumber && entry.machineSerialNumber.toLowerCase() === filterMachineId.toLowerCase();
        if (!matchesId && !matchesSerial) return false;
      }

      // Job Number Filter
      if (filterJobNumber.trim()) {
        const q = filterJobNumber.trim().toLowerCase();
        const matchesJob = entry.jobNumber?.toLowerCase().includes(q);
        if (!matchesJob) return false;
      }

      // Operation Filter
      if (filterOperation !== 'ALL' && entry.operation?.toLowerCase() !== filterOperation.toLowerCase()) {
        return false;
      }

      // Customer Filter & Go-Ahead Filter (requires linked Job)
      const linkedJob = jobsByNumberMap.get(entry.jobNumber?.toLowerCase() || '');
      if (filterCustomerId !== 'ALL') {
        if (!linkedJob || linkedJob.customerId !== filterCustomerId) return false;
      }

      if (filterGoAheadOnly === 'GO_AHEAD') {
        if (!linkedJob || !hasJobGoAhead(linkedJob)) return false;
      } else if (filterGoAheadOnly === 'NO_GO_AHEAD') {
        if (linkedJob && hasJobGoAhead(linkedJob)) return false;
      }

      // Minimum Hours Filter
      if (filterMinHours) {
        const minH = parseFloat(filterMinHours);
        if (!isNaN(minH) && (entry.durationHours || 0) < minH) return false;
      }

      // Free Search Keyword Filter
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const strToSearch = [
          entry.jobNumber,
          entry.clockNumber,
          entry.machineName,
          entry.machineSerialNumber,
          entry.operation,
          entry.notes,
          entry.pageNumber?.toString(),
          entry.bookNumber,
          linkedJob?.customerName,
          linkedJob?.componentType,
          linkedJob?.modelName
        ].filter(Boolean).join(' ').toLowerCase();

        if (!strToSearch.includes(q)) return false;
      }

      return true;
    });
  }, [
    entries,
    resolvedDateRange,
    filterClockNumber,
    filterMachineId,
    filterJobNumber,
    filterCustomerId,
    filterOperation,
    filterGoAheadOnly,
    filterMinHours,
    searchKeyword,
    jobsByNumberMap
  ]);

  // Determine active grouping key depending on template
  const activeGroupBy: GroupByOption = useMemo(() => {
    switch (selectedTemplate) {
      case 'employee_labour':
        return 'clockNumber';
      case 'machine_utilization':
        return 'machine';
      case 'job_labour_breakdown':
        return 'jobNumber';
      case 'operation_distribution':
        return 'operation';
      case 'customer_summary':
        return 'customer';
      case 'executive_overview':
        return 'month';
      case 'custom_query':
      default:
        return customGroupBy;
    }
  }, [selectedTemplate, customGroupBy]);

  // 2. AGGREGATE & GROUP THE FILTERED ENTRIES
  const groupedReportData = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        key: string;
        title: string;
        subtitle: string;
        badge?: string;
        totalHours: number;
        totalMinutes: number;
        entryCount: number;
        entries: WorksheetEntry[];
        uniqueJobsCount: number;
        uniqueMachinesCount: number;
        uniqueClockNumbersCount: number;
        firstDate: string;
        lastDate: string;
        operationsList: { op: string; hours: number }[];
        linkedJob?: Job;
        linkedMachine?: Machine;
      }
    >();

    filteredEntries.forEach((entry) => {
      let groupKey = 'Unknown';
      let title = 'Unknown';
      let subtitle = '';
      let badge = '';
      let linkedJob: Job | undefined;
      let linkedMachine: Machine | undefined;

      const jobObj = jobsByNumberMap.get(entry.jobNumber?.toLowerCase() || '');
      const machineObj = machinesByIdMap.get(entry.machineId || '') || machinesByIdMap.get(entry.machineSerialNumber?.toLowerCase() || '');

      if (activeGroupBy === 'clockNumber') {
        groupKey = entry.clockNumber ? entry.clockNumber.trim() : 'Unassigned';
        title = `Clock #${groupKey}`;
        subtitle = entry.operatorName || 'Workshop Operator';
        badge = 'Employee';
      } else if (activeGroupBy === 'machine') {
        const mLabel = entry.machineName || entry.machineSerialNumber || 'General Machine';
        groupKey = entry.machineId || entry.machineSerialNumber || mLabel;
        title = machineObj ? formatMachineDisplayName(machineObj) : mLabel;
        subtitle = machineObj?.location ? `Location: ${machineObj.location}` : `Equipment Tag: ${entry.machineSerialNumber || 'N/A'}`;
        badge = 'Machine';
        linkedMachine = machineObj;
      } else if (activeGroupBy === 'jobNumber') {
        groupKey = entry.jobNumber || 'Unknown Job';
        title = groupKey;
        if (jobObj) {
          title = `${jobObj.jobCardDetails?.jobCardNumber || jobObj.id}`;
          subtitle = `${jobObj.customerName} • ${[jobObj.componentType, jobObj.modelName].filter(Boolean).join(' - ')}`;
          badge = hasJobGoAhead(jobObj) ? 'Go-Ahead Approved' : 'Pending Go-Ahead';
          linkedJob = jobObj;
        } else {
          subtitle = 'Workshop Task';
          badge = 'Job Line';
        }
      } else if (activeGroupBy === 'customer') {
        if (jobObj && jobObj.customerName) {
          groupKey = jobObj.customerName.trim();
          title = jobObj.customerName;
          subtitle = `${jobObj.customerBranch ? `Branch: ${jobObj.customerBranch}` : 'Corporate Customer'}`;
        } else {
          groupKey = 'Unassigned / Direct Workshop';
          title = 'Unassigned / Internal Workshop';
          subtitle = 'Jobs without customer linkage';
        }
        badge = 'Customer';
      } else if (activeGroupBy === 'operation') {
        groupKey = entry.operation ? entry.operation.trim() : 'General Machining';
        title = groupKey;
        subtitle = 'Workshop Manufacturing Procedure';
        badge = 'Operation';
      } else if (activeGroupBy === 'date') {
        groupKey = entry.jobDate || 'Unknown Date';
        title = new Date(groupKey).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        subtitle = groupKey;
        badge = 'Day';
      } else if (activeGroupBy === 'month') {
        const mStr = entry.jobDate ? entry.jobDate.slice(0, 7) : 'Unknown';
        groupKey = mStr;
        const [y, m] = mStr.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        title = isNaN(dateObj.getTime()) ? mStr : dateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        subtitle = `${mStr} Billing Period`;
        badge = 'Monthly Cycle';
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          key: groupKey,
          title,
          subtitle,
          badge,
          totalHours: 0,
          totalMinutes: 0,
          entryCount: 0,
          entries: [],
          uniqueJobsCount: 0,
          uniqueMachinesCount: 0,
          uniqueClockNumbersCount: 0,
          firstDate: entry.jobDate,
          lastDate: entry.jobDate,
          operationsList: [],
          linkedJob,
          linkedMachine
        });
      }

      const grp = groupsMap.get(groupKey)!;
      grp.totalHours += entry.durationHours || 0;
      grp.totalMinutes += entry.durationMinutes || 0;
      grp.entryCount += 1;
      grp.entries.push(entry);

      if (entry.jobDate < grp.firstDate) grp.firstDate = entry.jobDate;
      if (entry.jobDate > grp.lastDate) grp.lastDate = entry.jobDate;
    });

    // Compute sub-aggregations per group
    const list = Array.from(groupsMap.values()).map((g) => {
      const jobsSet = new Set<string>();
      const machinesSet = new Set<string>();
      const clockSet = new Set<string>();
      const opMap = new Map<string, number>();

      g.entries.forEach((e) => {
        if (e.jobNumber) jobsSet.add(e.jobNumber);
        if (e.machineName || e.machineSerialNumber) machinesSet.add(e.machineName || e.machineSerialNumber || '');
        if (e.clockNumber) clockSet.add(e.clockNumber);
        const opKey = e.operation || 'Unspecified';
        opMap.set(opKey, (opMap.get(opKey) || 0) + (e.durationHours || 0));
      });

      const operationsList = Array.from(opMap.entries())
        .map(([op, hours]) => ({ op, hours }))
        .sort((a, b) => b.hours - a.hours);

      return {
        ...g,
        uniqueJobsCount: jobsSet.size,
        uniqueMachinesCount: machinesSet.size,
        uniqueClockNumbersCount: clockSet.size,
        operationsList
      };
    });

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'hours_desc') return b.totalHours - a.totalHours;
      if (sortBy === 'hours_asc') return a.totalHours - b.totalHours;
      if (sortBy === 'count_desc') return b.entryCount - a.entryCount;
      if (sortBy === 'name_asc') return a.title.localeCompare(b.title);
      return 0;
    });

    return list;
  }, [filteredEntries, activeGroupBy, jobsByNumberMap, machinesByIdMap, sortBy]);

  // Overall KPI Metrics for the filtered dataset
  const overallKpi = useMemo(() => {
    const totalHours = filteredEntries.reduce((sum, e) => sum + (e.durationHours || 0), 0);
    const totalLines = filteredEntries.length;
    const uniqueEmployees = new Set(filteredEntries.map((e) => e.clockNumber).filter(Boolean)).size;
    const uniqueMachines = new Set(filteredEntries.map((e) => e.machineId || e.machineSerialNumber).filter(Boolean)).size;
    const uniqueJobs = new Set(filteredEntries.map((e) => e.jobNumber).filter(Boolean)).size;
    const avgHoursPerLine = totalLines > 0 ? totalHours / totalLines : 0;

    // Top contributor
    const topGroup = groupedReportData.length > 0 ? groupedReportData[0] : null;

    return {
      totalHours,
      totalLines,
      uniqueEmployees,
      uniqueMachines,
      uniqueJobs,
      avgHoursPerLine,
      topGroup
    };
  }, [filteredEntries, groupedReportData]);

  // Chart dataset (Top 10 groups for clean visual rendering)
  const chartData = useMemo(() => {
    return groupedReportData.slice(0, 10).map((g) => ({
      name: g.title.length > 18 ? g.title.slice(0, 16) + '…' : g.title,
      fullName: g.title,
      hours: Number(g.totalHours.toFixed(2)),
      count: g.entryCount
    }));
  }, [groupedReportData]);

  // Daily Timeline chart dataset
  const timelineData = useMemo(() => {
    const dateMap = new Map<string, number>();
    filteredEntries.forEach((e) => {
      if (e.jobDate) {
        dateMap.set(e.jobDate, (dateMap.get(e.jobDate) || 0) + (e.durationHours || 0));
      }
    });

    const dates = Array.from(dateMap.keys()).sort();
    return dates.map((d) => ({
      date: d,
      displayDate: new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      hours: Number((dateMap.get(d) || 0).toFixed(2))
    }));
  }, [filteredEntries]);

  // Color palette for charts
  const CHART_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0284c7', '#4f46e5', '#0d9488', '#ea580c', '#64748b'];

  // Export Report to CSV
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      alert('No data available to export for the selected query.');
      return;
    }

    const headers = [
      'Report Type',
      'Date Range',
      'Group / Key',
      'Total Group Hours',
      'Group Entry Count',
      'Job Date',
      'Page Number',
      'Book Number',
      'Machine Name',
      'Machine Serial No',
      'Employee Clock #',
      'Job Number',
      'Customer',
      'Operation',
      'Start Time',
      'End Time',
      'Duration (Hours)',
      'Duration (Minutes)',
      'Notes',
      'Captured By'
    ];

    const rows: string[][] = [];

    groupedReportData.forEach((group) => {
      group.entries.forEach((e) => {
        const job = jobsByNumberMap.get(e.jobNumber?.toLowerCase() || '');
        rows.push([
          `"${selectedTemplate}"`,
          `"${resolvedDateRange.label}"`,
          `"${group.title.replace(/"/g, '""')}"`,
          group.totalHours.toFixed(2),
          group.entryCount.toString(),
          `"${e.jobDate}"`,
          e.pageNumber ? e.pageNumber.toString() : '',
          `"${e.bookNumber || ''}"`,
          `"${(e.machineName || '').replace(/"/g, '""')}"`,
          `"${e.machineSerialNumber || ''}"`,
          `"${e.clockNumber}"`,
          `"${e.jobNumber}"`,
          `"${(job?.customerName || '').replace(/"/g, '""')}"`,
          `"${(e.operation || '').replace(/"/g, '""')}"`,
          `"${e.startTime}"`,
          `"${e.endTime}"`,
          (e.durationHours || 0).toFixed(2),
          (e.durationMinutes || 0).toString(),
          `"${(e.notes || '').replace(/"/g, '""')}"`,
          `"${e.capturedBy || ''}"`
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MES_Report_${selectedTemplate}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const reportDocTitle = `MES Workshop Report - ${selectedTemplate.toUpperCase().replace(/_/g, ' ')} (${resolvedDateRange.label})`;

  const handlePrintReport = () => {
    setShowPrintModal(true);
    // Automatically trigger hidden iframe print with fallback
    setTimeout(() => {
      printDocumentReliably({
        elementId: 'printable-report-doc',
        documentTitle: reportDocTitle
      });
    }, 120);
  };

  const handleDirectPrintNow = () => {
    printDocumentReliably({
      elementId: 'printable-report-doc',
      documentTitle: reportDocTitle
    });
  };

  const handleOpenStandalonePrintWindow = () => {
    openInNewWindow({
      elementId: 'printable-report-doc',
      documentTitle: reportDocTitle
    });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setDatePreset('this_month');
    setFilterClockNumber('ALL');
    setFilterMachineId('ALL');
    setFilterJobNumber('');
    setFilterCustomerId('ALL');
    setFilterOperation('ALL');
    setFilterGoAheadOnly('ALL');
    setFilterMinHours('');
    setSearchKeyword('');
    setSortBy('hours_desc');
  };

  const hasActiveFilters = 
    datePreset !== 'this_month' ||
    filterClockNumber !== 'ALL' ||
    filterMachineId !== 'ALL' ||
    filterJobNumber !== '' ||
    filterCustomerId !== 'ALL' ||
    filterOperation !== 'ALL' ||
    filterGoAheadOnly !== 'ALL' ||
    filterMinHours !== '' ||
    searchKeyword !== '';

  return (
    <div className="space-y-6 pb-12 text-slate-900" id="worksheet-reports-view">
      {/* 1. REPORT TEMPLATE SELECTOR CARDS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              <span>Select Reporting Mode / Software Breakdown</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose a dedicated breakdown template or construct multi-dimensional queries across all software data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200"
              title="Export active report results to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrintReport}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Print formal report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Template Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {[
            {
              id: 'employee_labour',
              title: 'Employee Performance',
              subtitle: 'Clock # & Hours',
              icon: Users,
              color: 'blue'
            },
            {
              id: 'machine_utilization',
              title: 'Machine Utilization',
              subtitle: 'Books & Hours',
              icon: Wrench,
              color: 'indigo'
            },
            {
              id: 'job_labour_breakdown',
              title: 'Job Card Labour',
              subtitle: 'Cost & Operations',
              icon: Briefcase,
              color: 'emerald'
            },
            {
              id: 'operation_distribution',
              title: 'Operation Procedures',
              subtitle: 'Turning, Milling, etc.',
              icon: Activity,
              color: 'purple'
            },
            {
              id: 'customer_summary',
              title: 'Customer Accounts',
              subtitle: 'Volume & Time',
              icon: Building2,
              color: 'amber'
            },
            {
              id: 'executive_overview',
              title: 'Monthly Summary',
              subtitle: 'Executive KPIs',
              icon: TrendingUp,
              color: 'rose'
            },
            {
              id: 'custom_query',
              title: 'Custom Query Builder',
              subtitle: 'Flexible Multi-Filters',
              icon: SlidersHorizontal,
              color: 'slate'
            }
          ].map((t) => {
            const IconComp = t.icon;
            const isSelected = selectedTemplate === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTemplate(t.id as ReportTemplateType);
                  setExpandedGroupKey(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[82px] ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500 shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/80 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <IconComp className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div>
                  <p className={`text-xs font-black tracking-tight ${isSelected ? 'text-blue-950 font-bold' : 'text-slate-800'}`}>
                    {t.title}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{t.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. UNIVERSAL QUERY & FILTER ENGINE BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Row 1: Date Range Presets & Custom Picker */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Date Range:</span>
            </span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last_7_days', label: '7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'this_quarter', label: 'This Quarter' },
              { id: 'ytd', label: 'YTD' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom Range' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as any)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs if Custom selected */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 p-1.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-medium"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-medium"
              />
            </div>
          )}
        </div>

        {/* Row 2: Multi-dimensional Query Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Employee Clock # Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Employee Clock #
            </label>
            <select
              value={filterClockNumber}
              onChange={(e) => setFilterClockNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            >
              <option value="ALL">All Clock #s ({availableClockNumbers.length})</option>
              {availableClockNumbers.map((clk) => (
                <option key={clk} value={clk}>
                  {clk}
                </option>
              ))}
            </select>
          </div>

          {/* Machine Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Machine / Lathe
            </label>
            <select
              value={filterMachineId}
              onChange={(e) => setFilterMachineId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100 truncate"
            >
              <option value="ALL">All Machines ({machines.length})</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatMachineDisplayName(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Customer Account
            </label>
            <select
              value={filterCustomerId}
              onChange={(e) => setFilterCustomerId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100 truncate"
            >
              <option value="ALL">All Customers ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Operation Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Operation Procedure
            </label>
            <select
              value={filterOperation}
              onChange={(e) => setFilterOperation(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            >
              <option value="ALL">All Operations ({availableOperations.length})</option>
              {availableOperations.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>

          {/* Go-Ahead Approval Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Job Go-Ahead Status
            </label>
            <select
              value={filterGoAheadOnly}
              onChange={(e) => setFilterGoAheadOnly(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            >
              <option value="ALL">All Jobs</option>
              <option value="GO_AHEAD">Go-Ahead Approved Only (PO #)</option>
              <option value="NO_GO_AHEAD">Pending Go-Ahead Only</option>
            </select>
          </div>

          {/* Search Keyword Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Search Text / Keyword
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Job #, notes, page #..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Custom Group By, Sort and Reset Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {selectedTemplate === 'custom_query' && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold">Group By:</span>
                <select
                  value={customGroupBy}
                  onChange={(e) => setCustomGroupBy(e.target.value as GroupByOption)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                >
                  <option value="clockNumber">Employee Clock #</option>
                  <option value="machine">Machine</option>
                  <option value="jobNumber">Job Card #</option>
                  <option value="customer">Customer</option>
                  <option value="operation">Operation Procedure</option>
                  <option value="date">Daily Timeline</option>
                  <option value="month">Monthly Cycle</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              >
                <option value="hours_desc">Highest Total Hours (Desc)</option>
                <option value="hours_asc">Lowest Total Hours (Asc)</option>
                <option value="count_desc">Most Line Entries (Desc)</option>
                <option value="name_asc">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium">
              Matches: <strong className="text-slate-900">{filteredEntries.length}</strong> lines across{' '}
              <strong className="text-slate-900">{groupedReportData.length}</strong> groups (
              <strong className="text-blue-700 font-mono font-bold">{overallKpi.totalHours.toFixed(2)} total hrs</strong>)
            </span>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer text-[11px]"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. KPI EXECUTIVE METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm bg-blue-50 border border-blue-200">
              Total Labour
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-slate-900">{overallKpi.totalHours.toFixed(2)}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Logged Hours</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm bg-indigo-50 border border-indigo-200">
              Timesheet Lines
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-slate-900">{overallKpi.totalLines}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Captured Rows</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm bg-emerald-50 border border-emerald-200">
              Operators
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-slate-900">{overallKpi.uniqueEmployees}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Clock #s Active</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <Wrench className="w-4 h-4" />
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm bg-purple-50 border border-purple-200">
              Machines
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-slate-900">{overallKpi.uniqueMachines}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Machines Utilized</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <Briefcase className="w-4 h-4" />
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm bg-amber-50 border border-amber-200">
              Jobs Worked
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-slate-900">{overallKpi.uniqueJobs}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Unique Job Cards</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <Activity className="w-4 h-4" />
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm bg-rose-50 border border-rose-200">
              Avg Line
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-slate-900">{overallKpi.avgHoursPerLine.toFixed(2)}h</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Hours Per Entry</p>
        </div>
      </div>

      {/* 4. VISUAL ANALYTICS & CHARTS SECTION */}
      {groupedReportData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Breakdown by Top Groups */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <PieChartIcon className="w-4 h-4 text-blue-600" />
                  <span>Top Contribution by {activeGroupBy.toUpperCase()}</span>
                </h3>
                <p className="text-[11px] text-slate-400">Total logged hours per category</p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                Top 10
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    angle={-25} 
                    textAnchor="end" 
                    interval={0} 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} unit="h" />
                  <Tooltip 
                    formatter={(value: any) => [`${value} hrs`, 'Total Labour']}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return (payload[0].payload as any).fullName;
                      }
                      return label;
                    }}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Daily Hours Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Workshop Daily Labour Activity</span>
                </h3>
                <p className="text-[11px] text-slate-400">Hours trend across the selected timeframe</p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                {timelineData.length} Days Active
              </span>
            </div>

            <div className="h-64 w-full">
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="displayDate" 
                      angle={-25} 
                      textAnchor="end" 
                      interval="preserveStartEnd" 
                      tick={{ fontSize: 10, fill: '#64748b' }} 
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} unit="h" />
                    <Tooltip 
                      formatter={(value: any) => [`${value} hrs`, 'Logged Hours']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    />
                    <Area type="monotone" dataKey="hours" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHours)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No chronological timeline data to display
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. MAIN TABULAR BREAKDOWN WITH EXPANDABLE DRILLDOWN */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>Detailed Breakdown Table ({groupedReportData.length} Records)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click on any row to expand and inspect individual timesheet capture entries, notes, and exact shift durations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">
              Total Filtered: <strong className="text-blue-700">{overallKpi.totalHours.toFixed(2)} hrs</strong>
            </span>
          </div>
        </div>

        {groupedReportData.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">No records found matching current criteria</p>
            <p className="text-xs text-slate-400">Try broadening your date range or adjusting the filter options above.</p>
            <button
              onClick={handleResetFilters}
              className="mt-3 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-block"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200">
                  <th className="py-3 px-3 w-8 text-center"></th>
                  <th className="py-3 px-3">
                    {activeGroupBy === 'clockNumber' ? 'Employee / Clock #' : 
                     activeGroupBy === 'machine' ? 'Machine / Equipment' :
                     activeGroupBy === 'jobNumber' ? 'Job Card #' :
                     activeGroupBy === 'customer' ? 'Customer Account' :
                     activeGroupBy === 'operation' ? 'Operation' : 'Group Category'}
                  </th>
                  <th className="py-3 px-3">Summary Metrics</th>
                  <th className="py-3 px-3 text-right">Timesheet Lines</th>
                  <th className="py-3 px-3 text-right">Total Hours</th>
                  <th className="py-3 px-3 text-right">% Share</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedReportData.map((group, idx) => {
                  const isExpanded = expandedGroupKey === group.key;
                  const percentShare = overallKpi.totalHours > 0 ? (group.totalHours / overallKpi.totalHours) * 100 : 0;

                  return (
                    <React.Fragment key={group.key}>
                      <tr 
                        onClick={() => setExpandedGroupKey(isExpanded ? null : group.key)}
                        className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-blue-50/60 font-medium' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-600 mx-auto" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 mx-auto" />
                          )}
                        </td>

                        {/* Title & Details */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              {group.title}
                            </span>
                            {group.badge && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 border border-slate-200">
                                {group.badge}
                              </span>
                            )}
                          </div>
                          {group.subtitle && (
                            <p className="text-[11px] text-slate-500 font-normal truncate mt-0.5">
                              {group.subtitle}
                            </p>
                          )}
                        </td>

                        {/* Summary Metrics tags */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {group.uniqueJobsCount > 0 && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                {group.uniqueJobsCount} Jobs
                              </span>
                            )}
                            {group.uniqueMachinesCount > 0 && (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                {group.uniqueMachinesCount} Machines
                              </span>
                            )}
                            {group.uniqueClockNumbersCount > 0 && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {group.uniqueClockNumbersCount} Operators
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Lines Count */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                          {group.entryCount}
                        </td>

                        {/* Total Hours */}
                        <td className="py-3 px-3 text-right">
                          <span className="font-mono font-black text-blue-700 text-xs sm:text-sm">
                            {group.totalHours.toFixed(2)} hrs
                          </span>
                        </td>

                        {/* Progress Bar & % Share */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                              <div 
                                className="bg-blue-600 h-1.5 rounded-full" 
                                style={{ width: `${Math.min(100, percentShare)}%` }} 
                              />
                            </div>
                            <span className="font-mono font-bold text-slate-600 text-[11px] w-12 text-right">
                              {percentShare.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* Drilldown Toggle Button */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedGroupKey(isExpanded ? null : group.key);
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 border border-slate-200 px-2 py-1 rounded-md transition-all"
                          >
                            {isExpanded ? 'Collapse' : 'Inspect'}
                          </button>
                        </td>
                      </tr>

                      {/* EXPANDABLE DRILLDOWN SUB-TABLE */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0 bg-slate-50/90 border-y border-blue-100">
                            <div className="p-4 sm:p-5 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                                <div>
                                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Individual Timesheet Line Entries for {group.title}</span>
                                  </h4>
                                  <p className="text-[11px] text-slate-500">
                                    Date span: {group.firstDate} to {group.lastDate} • {group.entries.length} captured lines
                                  </p>
                                </div>

                                {group.linkedJob && onSelectJob && (
                                  <button
                                    onClick={() => onSelectJob(group.linkedJob!)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition-all flex items-center gap-1 self-start sm:self-auto"
                                  >
                                    <span>Open Job Enquiries</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Operations Breakdown Chips for this group */}
                              {group.operationsList.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                    Operations Breakdown:
                                  </span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {group.operationsList.map((opItem) => (
                                      <span
                                        key={opItem.op}
                                        className="text-[11px] font-medium bg-white border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-slate-700 shadow-2xs"
                                      >
                                        <strong className="text-slate-900 font-bold">{opItem.op}</strong>
                                        <span className="font-mono text-blue-600 font-bold">
                                          {opItem.hours.toFixed(2)} hrs
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Detailed Entries Table */}
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100/90 text-slate-600 uppercase text-[9px] font-extrabold tracking-wider border-b border-slate-200">
                                      <th className="py-2 px-3">Date</th>
                                      <th className="py-2 px-3">Page #</th>
                                      <th className="py-2 px-3">Book #</th>
                                      <th className="py-2 px-3">Clock #</th>
                                      <th className="py-2 px-3">Machine</th>
                                      <th className="py-2 px-3">Job #</th>
                                      <th className="py-2 px-3">Operation</th>
                                      <th className="py-2 px-3 text-center">Time</th>
                                      <th className="py-2 px-3 text-right">Duration</th>
                                      <th className="py-2 px-3">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {group.entries.map((entry) => (
                                      <tr key={entry.id} className="hover:bg-slate-50">
                                        <td className="py-2 px-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                                          {entry.jobDate}
                                        </td>
                                        <td className="py-2 px-3 font-mono font-bold text-blue-700">
                                          #{entry.pageNumber}
                                        </td>
                                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                          {entry.bookNumber || '-'}
                                        </td>
                                        <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                                          {entry.clockNumber}
                                        </td>
                                        <td className="py-2 px-3 text-slate-800 truncate max-w-[140px]">
                                          {entry.machineName || entry.machineSerialNumber || '-'}
                                        </td>
                                        <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                          {entry.jobNumber}
                                        </td>
                                        <td className="py-2 px-3">
                                          <span className="inline-block bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                            {entry.operation}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 font-mono text-[10px] text-center text-slate-500 whitespace-nowrap">
                                          {entry.startTime} – {entry.endTime}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-black text-blue-700 whitespace-nowrap">
                                          {(entry.durationHours || 0).toFixed(2)}h
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 text-[11px] italic max-w-xs truncate">
                                          {entry.notes || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HIDDEN PRINTABLE DOCUMENT FOR NATIVE BROWSER PRINT / IFRAME PRINT */}
      <div id="printable-report-doc" className="hidden print:block bg-white text-slate-900 p-8">
        {/* Print Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-slate-900 text-white p-1 rounded font-black text-sm px-2">
                MES WORKSHOP3
              </div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                Engineering & Workshop MES ERP
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-950 mt-2 uppercase tracking-tight">
              {selectedTemplate === 'employee_labour' && 'Employee Labour Performance Report'}
              {selectedTemplate === 'machine_utilization' && 'Machine Utilization & Timesheet Report'}
              {selectedTemplate === 'job_labour_breakdown' && 'Job Card Labour & Cost Breakdown Report'}
              {selectedTemplate === 'operation_distribution' && 'Workshop Operation Procedures Distribution'}
              {selectedTemplate === 'customer_summary' && 'Customer Accounts Labour & Volume Report'}
              {selectedTemplate === 'executive_overview' && 'Executive Workshop Overview Report'}
              {selectedTemplate === 'custom_query' && `Custom Workshop Analysis (Grouped by ${customGroupBy.toUpperCase()})`}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Date Period Scope: <strong>{resolvedDateRange.label}</strong> ({resolvedDateRange.start} to {resolvedDateRange.end})
            </p>
          </div>

          <div className="text-right text-xs font-mono text-slate-600 space-y-1">
            <p><strong>Generated On:</strong> {new Date().toLocaleString('en-GB')}</p>
            <p><strong>Operator / User:</strong> {currentUser?.displayName || currentUser?.email || 'Authorized User'}</p>
            <p><strong>Total Groupings:</strong> {groupedReportData.length} Categories</p>
            <p><strong>Total Filtered Lines:</strong> {filteredEntries.length} Timesheet Records</p>
          </div>
        </div>

        {/* Print KPIs Strip */}
        <div className="grid grid-cols-6 gap-3 mb-6 border border-slate-300 rounded-lg p-3 bg-slate-50 text-center text-xs">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Total Workshop Hours</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{overallKpi.totalHours.toFixed(2)}h</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Timesheet Entries</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{overallKpi.totalLines}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Active Operators</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{overallKpi.uniqueEmployees}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Utilized Machines</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{overallKpi.uniqueMachines}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Unique Jobs</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{overallKpi.uniqueJobs}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Avg Duration / Line</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{overallKpi.avgHoursPerLine.toFixed(2)}h</p>
          </div>
        </div>

        {/* Print Primary Group Breakdown Table */}
        <div className="mb-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
            1. Group Summary Breakdown
          </h2>
          <table className="w-full text-xs text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                <th className="p-2 border-r border-slate-300">#</th>
                <th className="p-2 border-r border-slate-300">Group / Category</th>
                <th className="p-2 border-r border-slate-300">Details / Subtitle</th>
                <th className="p-2 border-r border-slate-300 text-right">Total Hours</th>
                <th className="p-2 border-r border-slate-300 text-right">% Share</th>
                <th className="p-2 border-r border-slate-300 text-center">Lines</th>
                <th className="p-2 border-r border-slate-300 text-center">Jobs</th>
                <th className="p-2 text-center">Machines</th>
              </tr>
            </thead>
            <tbody>
              {groupedReportData.map((g, idx) => {
                const pct = overallKpi.totalHours > 0 ? (g.totalHours / overallKpi.totalHours) * 100 : 0;
                return (
                  <tr key={g.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 border-t border-r border-slate-300 font-bold">{idx + 1}</td>
                    <td className="p-2 border-t border-r border-slate-300 font-black text-slate-900">{g.title}</td>
                    <td className="p-2 border-t border-r border-slate-300 text-slate-600">{g.subtitle || '-'}</td>
                    <td className="p-2 border-t border-r border-slate-300 text-right font-black font-mono">{g.totalHours.toFixed(2)}h</td>
                    <td className="p-2 border-t border-r border-slate-300 text-right font-mono">{pct.toFixed(1)}%</td>
                    <td className="p-2 border-t border-r border-slate-300 text-center font-mono">{g.entryCount}</td>
                    <td className="p-2 border-t border-r border-slate-300 text-center font-mono">{g.uniqueJobsCount}</td>
                    <td className="p-2 border-t border-slate-300 text-center font-mono">{g.uniqueMachinesCount}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-300 font-black text-slate-950 border-t-2 border-slate-400">
                <td colSpan={3} className="p-2 text-right uppercase border-r border-slate-300">Total Workshop Summary:</td>
                <td className="p-2 text-right font-mono border-r border-slate-300">{overallKpi.totalHours.toFixed(2)}h</td>
                <td className="p-2 text-right font-mono border-r border-slate-300">100.0%</td>
                <td className="p-2 text-center font-mono border-r border-slate-300">{overallKpi.totalLines}</td>
                <td className="p-2 text-center font-mono border-r border-slate-300">{overallKpi.uniqueJobs}</td>
                <td className="p-2 text-center font-mono">{overallKpi.uniqueMachines}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Print Detailed Timesheet Log Entries */}
        <div className="mb-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
            2. Detailed Timesheet Line Entries ({filteredEntries.length} Records)
          </h2>
          <table className="w-full text-[11px] text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                <th className="p-1.5 border-r border-slate-300">Date</th>
                <th className="p-1.5 border-r border-slate-300">Page</th>
                <th className="p-1.5 border-r border-slate-300">Clock #</th>
                <th className="p-1.5 border-r border-slate-300">Machine</th>
                <th className="p-1.5 border-r border-slate-300">Job #</th>
                <th className="p-1.5 border-r border-slate-300">Operation</th>
                <th className="p-1.5 border-r border-slate-300 text-center">Time Window</th>
                <th className="p-1.5 border-r border-slate-300 text-right">Hours</th>
                <th className="p-1.5">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e, idx) => (
                <tr key={e.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-1.5 border-t border-r border-slate-300 whitespace-nowrap font-mono">{e.jobDate}</td>
                  <td className="p-1.5 border-t border-r border-slate-300 font-bold">#{e.pageNumber}</td>
                  <td className="p-1.5 border-t border-r border-slate-300 font-mono font-bold text-slate-900">{e.clockNumber}</td>
                  <td className="p-1.5 border-t border-r border-slate-300 truncate max-w-[130px]">{e.machineName || e.machineSerialNumber || '-'}</td>
                  <td className="p-1.5 border-t border-r border-slate-300 font-mono font-bold">{e.jobNumber}</td>
                  <td className="p-1.5 border-t border-r border-slate-300">{e.operation}</td>
                  <td className="p-1.5 border-t border-r border-slate-300 text-center font-mono text-[10px] whitespace-nowrap">{e.startTime} – {e.endTime}</td>
                  <td className="p-1.5 border-t border-r border-slate-300 text-right font-black font-mono">{(e.durationHours || 0).toFixed(2)}h</td>
                  <td className="p-1.5 border-t border-slate-300 text-slate-600 text-[10px] italic">{e.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Verification Sign-Off Footer */}
        <div className="border-t-2 border-slate-900 pt-6 mt-8 grid grid-cols-3 gap-6 text-xs">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Report Compiled By</p>
            <div className="border-b border-slate-400 mt-6 pb-1 font-bold text-slate-800">
              {currentUser?.displayName || currentUser?.email || 'MES System Operator'}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Signature & Employee ID</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Workshop Supervisor Approval</p>
            <div className="border-b border-slate-400 mt-6 pb-1 text-slate-400 italic">
              Sign & Print Name
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Production / Operations Manager</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500">Date Verified</p>
            <div className="border-b border-slate-400 mt-6 pb-1 font-mono text-slate-800">
              {new Date().toISOString().slice(0, 10)}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Official Verification Stamp</p>
          </div>
        </div>
      </div>

      {/* PRINT PREVIEW & EXPORT MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Top Action Bar */}
            <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white p-2 rounded-xl">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    Formal Report Print & PDF Preview
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {reportDocTitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleDirectPrintNow}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document Now</span>
                </button>

                <button
                  onClick={handleOpenStandalonePrintWindow}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  title="Open document in a separate browser tab/window"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Window</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV</span>
                </button>

                <button
                  onClick={() => setShowPrintModal(false)}
                  className="bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300 p-2 rounded-xl transition-colors cursor-pointer border border-slate-700"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Document Body View */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/80">
              <div className="max-w-4xl mx-auto bg-white p-6 sm:p-10 rounded-xl shadow-md border border-slate-200/80 text-slate-900">
                {/* Visual Header */}
                <div className="border-b-2 border-slate-900 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-900 text-white p-1 rounded font-black text-xs px-2">
                        MES WORKSHOP3
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Engineering & Fabrication ERP
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-950 mt-2 uppercase tracking-tight">
                      {selectedTemplate === 'employee_labour' && 'Employee Labour Performance Report'}
                      {selectedTemplate === 'machine_utilization' && 'Machine Utilization & Timesheet Report'}
                      {selectedTemplate === 'job_labour_breakdown' && 'Job Card Labour & Cost Breakdown Report'}
                      {selectedTemplate === 'operation_distribution' && 'Workshop Operation Procedures Distribution'}
                      {selectedTemplate === 'customer_summary' && 'Customer Accounts Labour & Volume Report'}
                      {selectedTemplate === 'executive_overview' && 'Executive Workshop Overview Report'}
                      {selectedTemplate === 'custom_query' && `Custom Workshop Analysis (${customGroupBy.toUpperCase()})`}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Date Period: <strong>{resolvedDateRange.label}</strong> ({resolvedDateRange.start} to {resolvedDateRange.end})
                    </p>
                  </div>

                  <div className="text-left sm:text-right text-xs font-mono text-slate-600 space-y-1">
                    <p><strong>Generated:</strong> {new Date().toLocaleString('en-GB')}</p>
                    <p><strong>Generated By:</strong> {currentUser?.displayName || currentUser?.email || 'Operator'}</p>
                    <p><strong>Total Lines:</strong> {filteredEntries.length} Entries</p>
                  </div>
                </div>

                {/* Summary KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6 border border-slate-200 rounded-xl p-3 bg-slate-50 text-center text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Total Hours</p>
                    <p className="text-base font-black text-blue-700 mt-0.5">{overallKpi.totalHours.toFixed(2)}h</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Total Lines</p>
                    <p className="text-base font-black text-slate-900 mt-0.5">{overallKpi.totalLines}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Operators</p>
                    <p className="text-base font-black text-emerald-700 mt-0.5">{overallKpi.uniqueEmployees}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Machines</p>
                    <p className="text-base font-black text-indigo-700 mt-0.5">{overallKpi.uniqueMachines}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Unique Jobs</p>
                    <p className="text-base font-black text-amber-700 mt-0.5">{overallKpi.uniqueJobs}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Avg Duration</p>
                    <p className="text-base font-black text-purple-700 mt-0.5">{overallKpi.avgHoursPerLine.toFixed(2)}h</p>
                  </div>
                </div>

                {/* Group Summary Table */}
                <div className="mb-6">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2">
                    1. Summary Group Breakdown
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-2">#</th>
                          <th className="p-2">Category / Key</th>
                          <th className="p-2">Details</th>
                          <th className="p-2 text-right">Total Hours</th>
                          <th className="p-2 text-right">% Share</th>
                          <th className="p-2 text-center">Lines</th>
                          <th className="p-2 text-center">Jobs</th>
                          <th className="p-2 text-center">Machines</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {groupedReportData.map((g, idx) => {
                          const pct = overallKpi.totalHours > 0 ? (g.totalHours / overallKpi.totalHours) * 100 : 0;
                          return (
                            <tr key={g.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="p-2 font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-2 font-black text-slate-900">{g.title}</td>
                              <td className="p-2 text-slate-500 text-[11px]">{g.subtitle || '-'}</td>
                              <td className="p-2 text-right font-black font-mono text-blue-700">{g.totalHours.toFixed(2)}h</td>
                              <td className="p-2 text-right font-mono text-slate-600">{pct.toFixed(1)}%</td>
                              <td className="p-2 text-center font-mono">{g.entryCount}</td>
                              <td className="p-2 text-center font-mono">{g.uniqueJobsCount}</td>
                              <td className="p-2 text-center font-mono">{g.uniqueMachinesCount}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-100 font-black text-slate-950 border-t-2 border-slate-300">
                          <td colSpan={3} className="p-2 text-right uppercase">Total:</td>
                          <td className="p-2 text-right font-mono text-blue-800">{overallKpi.totalHours.toFixed(2)}h</td>
                          <td className="p-2 text-right font-mono">100.0%</td>
                          <td className="p-2 text-center font-mono">{overallKpi.totalLines}</td>
                          <td className="p-2 text-center font-mono">{overallKpi.uniqueJobs}</td>
                          <td className="p-2 text-center font-mono">{overallKpi.uniqueMachines}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Detailed Timesheet Entries Table */}
                <div className="mb-6">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2">
                    2. Chronological Line Records ({filteredEntries.length} Items)
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-96">
                    <table className="w-full text-[11px] text-left">
                      <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-1.5">Date</th>
                          <th className="p-1.5">Page</th>
                          <th className="p-1.5">Clock #</th>
                          <th className="p-1.5">Machine</th>
                          <th className="p-1.5">Job #</th>
                          <th className="p-1.5">Operation</th>
                          <th className="p-1.5 text-center">Window</th>
                          <th className="p-1.5 text-right">Hours</th>
                          <th className="p-1.5">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredEntries.map((e, idx) => (
                          <tr key={e.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="p-1.5 font-mono whitespace-nowrap">{e.jobDate}</td>
                            <td className="p-1.5 font-bold text-blue-700">#{e.pageNumber}</td>
                            <td className="p-1.5 font-mono font-bold text-emerald-700">{e.clockNumber}</td>
                            <td className="p-1.5 truncate max-w-[120px]">{e.machineName || e.machineSerialNumber || '-'}</td>
                            <td className="p-1.5 font-mono font-bold text-slate-900">{e.jobNumber}</td>
                            <td className="p-1.5 text-[10px] font-semibold">{e.operation}</td>
                            <td className="p-1.5 text-center font-mono text-[10px] whitespace-nowrap">{e.startTime} – {e.endTime}</td>
                            <td className="p-1.5 text-right font-black font-mono text-blue-700">{(e.durationHours || 0).toFixed(2)}h</td>
                            <td className="p-1.5 text-slate-500 text-[10px] italic truncate max-w-[160px]">{e.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Verification Sign-Off Footer */}
                <div className="border-t-2 border-slate-900 pt-6 mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Report Compiled By</p>
                    <div className="border-b border-slate-300 mt-6 pb-1 font-bold text-slate-800">
                      {currentUser?.displayName || currentUser?.email || 'MES System Operator'}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Signature & Employee ID</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Supervisor Approval</p>
                    <div className="border-b border-slate-300 mt-6 pb-1 text-slate-400 italic">
                      Sign & Print Name
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Workshop Operations Manager</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Date Verified</p>
                    <div className="border-b border-slate-300 mt-6 pb-1 font-mono text-slate-800">
                      {new Date().toISOString().slice(0, 10)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Official Verification Date</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span className="flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-blue-600" />
                Select <strong>"Save as PDF"</strong> in your browser print window to save a digital copy.
              </span>
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
