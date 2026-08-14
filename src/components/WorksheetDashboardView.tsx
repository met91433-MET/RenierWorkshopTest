import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Job, 
  Machine, 
  UserProfile, 
  WorksheetEntry, 
  MachineTimesheetBook,
  formatMachineDisplayName,
  getMachineLabelByIdOrNumber
} from '../types';
import { 
  getWorksheetEntries, 
  saveWorksheetEntry, 
  deleteWorksheetEntry, 
  subscribeWorksheetEntries 
} from '../dbService';
import { 
  Clock, 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Wrench, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit2, 
  Download, 
  Printer, 
  RefreshCw, 
  UserCheck, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronRight, 
  Layers, 
  ArrowUpDown, 
  Timer, 
  Sparkles,
  Info,
  X
} from 'lucide-react';

interface WorksheetDashboardViewProps {
  jobs: Job[];
  machines: Machine[];
  currentUser: UserProfile | null;
  onSaveMachine?: (machine: Machine) => Promise<void> | void;
  onSelectJob?: (job: Job) => void;
}

export default function WorksheetDashboardView({
  jobs = [],
  machines = [],
  currentUser,
  onSaveMachine,
  onSelectJob
}: WorksheetDashboardViewProps) {
  // Worksheet entries state
  const [entries, setEntries] = useState<WorksheetEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State for morning page capture
  const [pageNumberInput, setPageNumberInput] = useState<string>('');
  const [clockNumberInput, setClockNumberInput] = useState<string>('');
  const [jobDateInput, setJobDateInput] = useState<string>(new Date().toISOString().slice(0, 10));
  const [jobNumberInput, setJobNumberInput] = useState<string>('');
  const [startTimeInput, setStartTimeInput] = useState<string>('07:30');
  const [endTimeInput, setEndTimeInput] = useState<string>('12:00');
  const [operationInput, setOperationInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [manualBookNumber, setManualBookNumber] = useState<string>('');

  // Editing state
  const [editingEntry, setEditingEntry] = useState<WorksheetEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPageNumber, setFilterPageNumber] = useState<string>('');
  const [filterJobNumber, setFilterJobNumber] = useState<string>('');
  const [filterMachineId, setFilterMachineId] = useState<string>('ALL');
  const [filterClockNumber, setFilterClockNumber] = useState<string>('');
  const [filterOperation, setFilterOperation] = useState<string>('ALL');
  const [filterDateMode, setFilterDateMode] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'>('all');
  const [filterCustomStartDate, setFilterCustomStartDate] = useState<string>('');
  const [filterCustomEndDate, setFilterCustomEndDate] = useState<string>('');

  // UI Panels toggle
  const [showDedicatedBooksPanel, setShowDedicatedBooksPanel] = useState<boolean>(false);
  const [showNewBookModal, setShowNewBookModal] = useState<boolean>(false);

  // New Book Appointment Form State
  const [bookMachineId, setBookMachineId] = useState<string>('');
  const [bookStartPage, setBookStartPage] = useState<string>('301');
  const [bookEndPage, setBookEndPage] = useState<string>('360');
  const [bookCustomNumber, setBookCustomNumber] = useState<string>('');
  const [bookAppointedDate, setBookAppointedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isSavingBook, setIsSavingBook] = useState<boolean>(false);

  const pageInputRef = useRef<HTMLInputElement>(null);

  // Auto-subscribe to real-time worksheet entries
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeWorksheetEntries((data) => {
      setEntries(data);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Show temporary feedback toast
  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Build a fast lookup list of all appointed books across all machines
  const allMachineBooks = useMemo(() => {
    const list: {
      machine: Machine;
      book: MachineTimesheetBook;
    }[] = [];

    machines.forEach((m) => {
      if (m.timesheetBooks && Array.isArray(m.timesheetBooks)) {
        m.timesheetBooks.forEach((b) => {
          list.push({ machine: m, book: b });
        });
      }
    });

    return list;
  }, [machines]);

  // Dynamic automatic resolver: given a page number, find the dedicated machine and book!
  const matchedBookInfo = useMemo(() => {
    const pageNum = parseInt(pageNumberInput.trim(), 10);
    if (isNaN(pageNum) || pageNum <= 0) return null;

    for (const item of allMachineBooks) {
      const { startPage, endPage } = item.book;
      if (pageNum >= startPage && pageNum <= endPage) {
        return {
          machine: item.machine,
          book: item.book,
          bookRange: `${startPage}-${endPage}`,
          bookNumber: item.book.bookNumber || `${startPage}-${endPage}`
        };
      }
    }
    return null;
  }, [pageNumberInput, allMachineBooks]);

  // Calculate elapsed time between Start and End time in hours & minutes
  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return { minutes: 0, hours: 0, formatted: '0h 00m' };

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
      return { minutes: 0, hours: 0, formatted: '0h 00m' };
    }

    let startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;

    // Handle overnight shifts if end is earlier than start
    if (endTotal < startTotal) {
      endTotal += 24 * 60;
    }

    const diffMinutes = Math.max(0, endTotal - startTotal);
    const diffHours = Number((diffMinutes / 60).toFixed(2));
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;

    return {
      minutes: diffMinutes,
      hours: diffHours,
      formatted: `${h}h ${m < 10 ? '0' : ''}${m}m (${diffHours.toFixed(2)} hrs)`
    };
  };

  const currentDuration = useMemo(() => {
    return calculateDuration(startTimeInput, endTimeInput);
  }, [startTimeInput, endTimeInput]);

  // List of distinct Clock Numbers logged for suggestions
  const recentClockNumbers = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.clockNumber) set.add(e.clockNumber.trim().toUpperCase());
    });
    return Array.from(set).slice(0, 10);
  }, [entries]);

  // List of active Job Cards (jobs with job cards created and not closed)
  const activeJobCards = useMemo(() => {
    return jobs
      .filter((j) => {
        const hasJobCard = j.status === 'JobCardCreated' || Boolean(j.jobCardDetails?.jobCardNumber);
        const isNotClosed = j.status !== 'Closed';
        return hasJobCard && isNotClosed;
      })
      .map((j) => {
        const jcNum = j.jobCardDetails?.jobCardNumber || j.id;
        const customer = j.customerName || 'Customer';
        const comp = [j.componentType, j.modelName].filter(Boolean).join(' - ');
        const serial = j.serialNumber ? `SN: ${j.serialNumber}` : '';
        const order = j.jobCardDetails?.orderNumber || j.customerOrderNo ? `PO: ${j.jobCardDetails?.orderNumber || j.customerOrderNo}` : '';
        
        const details = [customer, comp, serial, order].filter(Boolean).join(' • ');

        return {
          jobId: j.id,
          jobNumber: jcNum,
          label: `${jcNum} — ${details}`,
          shortLabel: `${jcNum} (${customer})`,
          customerName: j.customerName,
          component: comp,
          serial: j.serialNumber,
          job: j
        };
      })
      .sort((a, b) => a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true }));
  }, [jobs]);

  // Selected job card details for live preview
  const selectedJobCardInfo = useMemo(() => {
    if (!jobNumberInput.trim()) return null;
    return (
      activeJobCards.find(
        (j) =>
          j.jobNumber.toLowerCase() === jobNumberInput.trim().toLowerCase() ||
          j.jobId.toLowerCase() === jobNumberInput.trim().toLowerCase()
      ) || null
    );
  }, [activeJobCards, jobNumberInput]);

  // Extract operations/steps strictly from the selected Job Card
  const selectedJobSteps = useMemo(() => {
    if (!selectedJobCardInfo?.job) return [];
    const j = selectedJobCardInfo.job;
    const prefix = `${j.id} - `;
    const steps = j.preQuoteDetails?.steps || [];
    
    const stepList: string[] = [];
    const seen = new Set<string>();

    steps.forEach((s) => {
      if (!s.stepName) return;
      let clean = s.stepName.trim();
      if (clean.startsWith(prefix)) {
        clean = clean.substring(prefix.length).trim();
      }
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        stepList.push(clean);
      }
    });

    return stepList;
  }, [selectedJobCardInfo]);

  // All distinct operations for table filtering
  const availableFilterOperations = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.operation) set.add(e.operation.trim());
    });
    jobs.forEach((j) => {
      const prefix = `${j.id} - `;
      j.preQuoteDetails?.steps?.forEach((s) => {
        if (!s.stepName) return;
        let clean = s.stepName.trim();
        if (clean.startsWith(prefix)) {
          clean = clean.substring(prefix.length).trim();
        }
        if (clean) set.add(clean);
      });
    });
    return Array.from(set).sort();
  }, [entries, jobs]);

  // Synchronize operationInput when selecting job card
  const handleJobCardSelect = (newJobNumber: string) => {
    setJobNumberInput(newJobNumber);
    if (!newJobNumber.trim()) {
      setOperationInput('');
      return;
    }
    const target = activeJobCards.find(
      (j) =>
        j.jobNumber.toLowerCase() === newJobNumber.trim().toLowerCase() ||
        j.jobId.toLowerCase() === newJobNumber.trim().toLowerCase()
    );
    if (!target?.job) {
      setOperationInput('');
    } else {
      const prefix = `${target.job.id} - `;
      const steps = target.job.preQuoteDetails?.steps || [];
      const stepNames: string[] = [];
      const seen = new Set<string>();
      steps.forEach((s) => {
        if (!s.stepName) return;
        let clean = s.stepName.trim();
        if (clean.startsWith(prefix)) {
          clean = clean.substring(prefix.length).trim();
        }
        if (clean && !seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          stepNames.push(clean);
        }
      });

      if (stepNames.length === 1) {
        setOperationInput(stepNames[0]);
      } else if (stepNames.length > 0 && !stepNames.some((s) => s.toLowerCase() === operationInput.trim().toLowerCase())) {
        setOperationInput('');
      }
    }
  };

  // Handle saving a morning worksheet entry line
  const handleSaveEntry = async (e?: React.FormEvent, continueNext: boolean = false) => {
    if (e) e.preventDefault();

    const pageNum = parseInt(pageNumberInput.trim(), 10);
    if (isNaN(pageNum) || pageNum <= 0) {
      showFeedback('Please provide a valid numeric Page Number (e.g. 301, 305).', 'error');
      return;
    }

    if (!clockNumberInput.trim()) {
      showFeedback('Please enter the Employee Clock Number.', 'error');
      return;
    }

    if (!jobDateInput) {
      showFeedback('Please select a Job Date.', 'error');
      return;
    }

    if (!jobNumberInput.trim()) {
      showFeedback('Please enter or select a Job Number.', 'error');
      return;
    }

    if (!startTimeInput || !endTimeInput) {
      showFeedback('Please specify Start Time and End Time.', 'error');
      return;
    }

    if (!operationInput.trim()) {
      showFeedback('Please specify the Operation performed.', 'error');
      return;
    }

    // Resolve machine details
    let resolvedMachine = matchedBookInfo?.machine;
    let resolvedBookNumber = matchedBookInfo?.bookNumber || manualBookNumber.trim() || undefined;

    if (!resolvedMachine && selectedMachineId) {
      resolvedMachine = machines.find((m) => m.id === selectedMachineId);
    }

    const duration = calculateDuration(startTimeInput, endTimeInput);

    setIsSaving(true);
    try {
      const entryId = editingEntry ? editingEntry.id : `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      
      const newEntry: WorksheetEntry = {
        id: entryId,
        pageNumber: pageNum,
        bookNumber: resolvedBookNumber || (resolvedMachine ? `Book for ${resolvedMachine.machineName}` : undefined),
        machineId: resolvedMachine?.id,
        machineSerialNumber: resolvedMachine?.serialNumber,
        machineName: resolvedMachine?.machineName,
        clockNumber: clockNumberInput.trim().toUpperCase(),
        jobDate: jobDateInput,
        jobNumber: jobNumberInput.trim().toUpperCase(),
        startTime: startTimeInput,
        endTime: endTimeInput,
        durationMinutes: duration.minutes,
        durationHours: duration.hours,
        operation: operationInput.trim(),
        notes: notesInput.trim() || undefined,
        capturedBy: currentUser?.displayName || currentUser?.email || 'Admin',
        createdAt: editingEntry ? editingEntry.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveWorksheetEntry(newEntry);

      showFeedback(
        editingEntry 
          ? `Worksheet line for Page #${pageNum} updated successfully.` 
          : `Worksheet line for Page #${pageNum} saved successfully!`, 
        'success'
      );

      if (editingEntry) {
        setEditingEntry(null);
      }

      if (continueNext) {
        // Increment page number or clear for next fast capture line
        setPageNumberInput(String(pageNum + 1));
        setClockNumberInput('');
        setJobNumberInput('');
        setNotesInput('');
        if (pageInputRef.current) {
          pageInputRef.current.focus();
        }
      } else {
        // Reset inputs
        setPageNumberInput('');
        setClockNumberInput('');
        setJobNumberInput('');
        setNotesInput('');
      }
    } catch (err) {
      console.error('Error saving worksheet entry:', err);
      showFeedback('Failed to save worksheet line. Please check connection.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Start editing a worksheet entry
  const handleStartEdit = (entry: WorksheetEntry) => {
    setEditingEntry(entry);
    setPageNumberInput(String(entry.pageNumber));
    setClockNumberInput(entry.clockNumber);
    setJobDateInput(entry.jobDate);
    setJobNumberInput(entry.jobNumber);
    setStartTimeInput(entry.startTime);
    setEndTimeInput(entry.endTime);
    setOperationInput(entry.operation);
    setNotesInput(entry.notes || '');
    setSelectedMachineId(entry.machineId || '');
    setManualBookNumber(entry.bookNumber || '');

    // Scroll to top of capture form
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (pageInputRef.current) {
      pageInputRef.current.focus();
    }
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingEntry(null);
    setPageNumberInput('');
    setClockNumberInput('');
    setJobNumberInput('');
    setNotesInput('');
    setSelectedMachineId('');
    setManualBookNumber('');
  };

  // Delete a worksheet entry
  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteWorksheetEntry(id);
      setDeleteConfirmId(null);
      showFeedback('Worksheet entry deleted successfully.', 'success');
    } catch (err) {
      console.error('Error deleting worksheet entry:', err);
      showFeedback('Failed to delete worksheet entry.', 'error');
    }
  };

  // Appoint / Assign a new Dedicated Book to a machine
  const handleAppointDedicatedBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookMachineId) {
      showFeedback('Please select a target machine.', 'error');
      return;
    }

    const startNum = parseInt(bookStartPage.trim(), 10);
    const endNum = parseInt(bookEndPage.trim(), 10);

    if (isNaN(startNum) || isNaN(endNum) || startNum <= 0 || endNum < startNum) {
      showFeedback('Start page must be positive and End page must be >= Start page (e.g. 301 to 360).', 'error');
      return;
    }

    const targetMachine = machines.find((m) => m.id === bookMachineId);
    if (!targetMachine) {
      showFeedback('Machine not found.', 'error');
      return;
    }

    const computedBookNumber = bookCustomNumber.trim() || `${startNum}-${endNum}`;

    setIsSavingBook(true);
    try {
      const newBook: MachineTimesheetBook = {
        id: `tsbook-${Date.now()}`,
        bookNumber: computedBookNumber,
        startPage: startNum,
        endPage: endNum,
        dateAppointed: bookAppointedDate || new Date().toISOString().slice(0, 10),
        status: 'Active',
        notes: `Dedicated book appointed for ${formatMachineDisplayName(targetMachine)} (${startNum}-${endNum})`,
        loggedAt: new Date().toISOString()
      };

      const updatedBooks = [newBook, ...(targetMachine.timesheetBooks || [])];
      const updatedMachine: Machine = {
        ...targetMachine,
        timesheetBooks: updatedBooks,
        updatedAt: new Date().toISOString()
      };

      if (onSaveMachine) {
        await onSaveMachine(updatedMachine);
      }

      showFeedback(`Book ${computedBookNumber} (Pages ${startNum}-${endNum}) dedicated to ${formatMachineDisplayName(targetMachine)}!`, 'success');
      setShowNewBookModal(false);
      
      // Auto increment next book range suggestion
      const diff = endNum - startNum + 1;
      setBookStartPage(String(endNum + 1));
      setBookEndPage(String(endNum + diff));
      setBookCustomNumber('');
    } catch (err) {
      console.error('Error appointing dedicated book:', err);
      showFeedback('Failed to appoint book to machine.', 'error');
    } finally {
      setIsSavingBook(false);
    }
  };

  // Filtered worksheet entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // 1. Text Search across all fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSearch =
          String(entry.pageNumber).includes(q) ||
          entry.jobNumber.toLowerCase().includes(q) ||
          entry.clockNumber.toLowerCase().includes(q) ||
          (entry.machineName && entry.machineName.toLowerCase().includes(q)) ||
          (entry.machineSerialNumber && entry.machineSerialNumber.toLowerCase().includes(q)) ||
          (entry.bookNumber && entry.bookNumber.toLowerCase().includes(q)) ||
          entry.operation.toLowerCase().includes(q) ||
          (entry.notes && entry.notes.toLowerCase().includes(q)) ||
          (entry.capturedBy && entry.capturedBy.toLowerCase().includes(q));

        if (!matchSearch) return false;
      }

      // 2. Specific Page Number Filter
      if (filterPageNumber.trim()) {
        const pVal = filterPageNumber.trim();
        if (pVal.includes('-')) {
          const [minP, maxP] = pVal.split('-').map(Number);
          if (!isNaN(minP) && !isNaN(maxP)) {
            if (entry.pageNumber < minP || entry.pageNumber > maxP) return false;
          }
        } else {
          const pNum = parseInt(pVal, 10);
          if (!isNaN(pNum) && entry.pageNumber !== pNum) return false;
        }
      }

      // 3. Job Number Filter
      if (filterJobNumber.trim()) {
        const jQ = filterJobNumber.toLowerCase().trim();
        if (!entry.jobNumber.toLowerCase().includes(jQ)) return false;
      }

      // 4. Machine Filter
      if (filterMachineId !== 'ALL') {
        if (entry.machineId !== filterMachineId && entry.machineSerialNumber !== filterMachineId) {
          return false;
        }
      }

      // 5. Clock Number Filter
      if (filterClockNumber.trim()) {
        const cQ = filterClockNumber.toLowerCase().trim();
        if (!entry.clockNumber.toLowerCase().includes(cQ)) return false;
      }

      // 6. Operation Filter
      if (filterOperation !== 'ALL') {
        if (entry.operation !== filterOperation) return false;
      }

      // 7. Date Filter
      if (filterDateMode !== 'all') {
        const todayStr = new Date().toISOString().slice(0, 10);
        const entryDate = entry.jobDate;

        if (filterDateMode === 'today') {
          if (entryDate !== todayStr) return false;
        } else if (filterDateMode === 'yesterday') {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          const yesterdayStr = y.toISOString().slice(0, 10);
          if (entryDate !== yesterdayStr) return false;
        } else if (filterDateMode === 'this_week') {
          const now = new Date();
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          if (entryDate < oneWeekAgo || entryDate > todayStr) return false;
        } else if (filterDateMode === 'this_month') {
          const currentMonth = todayStr.slice(0, 7);
          if (!entryDate.startsWith(currentMonth)) return false;
        } else if (filterDateMode === 'custom') {
          if (filterCustomStartDate && entryDate < filterCustomStartDate) return false;
          if (filterCustomEndDate && entryDate > filterCustomEndDate) return false;
        }
      }

      return true;
    });
  }, [
    entries,
    searchQuery,
    filterPageNumber,
    filterJobNumber,
    filterMachineId,
    filterClockNumber,
    filterOperation,
    filterDateMode,
    filterCustomStartDate,
    filterCustomEndDate
  ]);

  // Summary statistics
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayEntries = entries.filter((e) => e.jobDate === todayStr);

    const totalHoursAll = entries.reduce((sum, e) => sum + (e.durationHours || 0), 0);
    const totalHoursToday = todayEntries.reduce((sum, e) => sum + (e.durationHours || 0), 0);

    const uniqueJobs = new Set(entries.map((e) => e.jobNumber)).size;
    const uniqueMachinesWithBooks = machines.filter(
      (m) => m.timesheetBooks && m.timesheetBooks.length > 0
    ).length;

    const filteredHours = filteredEntries.reduce((sum, e) => sum + (e.durationHours || 0), 0);

    return {
      totalEntries: entries.length,
      todayEntriesCount: todayEntries.length,
      totalHoursAll,
      totalHoursToday,
      uniqueJobs,
      uniqueMachinesWithBooks,
      filteredCount: filteredEntries.length,
      filteredHours
    };
  }, [entries, machines, filteredEntries]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      showFeedback('No entries to export.', 'error');
      return;
    }

    const headers = [
      'Job Date',
      'Page Number',
      'Dedicated Book',
      'Machine Name',
      'Machine Serial No',
      'Employee Clock #',
      'Job Number',
      'Operation',
      'Start Time',
      'End Time',
      'Duration (Hours)',
      'Duration (Minutes)',
      'Notes',
      'Captured By',
      'Timestamp'
    ];

    const rows = filteredEntries.map((e) => [
      `"${e.jobDate}"`,
      e.pageNumber,
      `"${e.bookNumber || ''}"`,
      `"${e.machineName || ''}"`,
      `"${e.machineSerialNumber || ''}"`,
      `"${e.clockNumber}"`,
      `"${e.jobNumber}"`,
      `"${e.operation}"`,
      `"${e.startTime}"`,
      `"${e.endTime}"`,
      e.durationHours || 0,
      e.durationMinutes || 0,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${e.capturedBy || ''}"`,
      `"${e.createdAt}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Worksheet_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Worksheet Log table
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-900" id="worksheet-dashboard-view">
      {/* 1. TOP HEADER & METRIC SUMMARY CARDS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-3 rounded-xl shadow-xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-900 font-display">
                  Worksheet Dashboard
                </h1>
                <span className="bg-blue-50 text-blue-700 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full border border-blue-200">
                  Daily Timesheet Capture
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Every machine has a dedicated numerical page book (e.g. 301-360). Capture morning workshop pages, operations, times and linked job cards.
              </p>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowDedicatedBooksPanel(!showDedicatedBooksPanel)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                showDedicatedBooksPanel 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Dedicated Machine Books ({allMachineBooks.length})</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDedicatedBooksPanel ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={() => setShowNewBookModal(true)}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Appoint Dedicated Book</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Export filtered records to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Print worksheet log report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today's Captures</span>
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1 font-mono">{stats.todayEntriesCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {stats.totalHoursToday.toFixed(2)} workshop hrs logged today
            </p>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Hours</span>
              <Timer className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-black text-purple-700 mt-1 font-mono">{stats.totalHoursAll.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Across {stats.totalEntries} total captured lines</p>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Machines with Books</span>
              <Wrench className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">
              {stats.uniqueMachinesWithBooks} / {machines.length}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{allMachineBooks.length} dedicated books appointed</p>
          </div>
        </div>
      </div>

      {/* FEEDBACK TOAST BANNER */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-bold shadow-xs transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* 2. DEDICATED MACHINE BOOKS ACCORDION PANEL */}
      {showDedicatedBooksPanel && (
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Dedicated Machine Timesheet Books Directory</h3>
                <p className="text-[11px] text-slate-400">
                  Each machine has a numerical range book (e.g. 301-360). When entering page 305, the system automatically routes to the dedicated machine.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNewBookModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Appoint New Book</span>
            </button>
          </div>

          {allMachineBooks.length === 0 ? (
            <div className="text-center py-6 bg-slate-850 rounded-xl border border-dashed border-slate-750">
              <BookOpen className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-xs font-bold text-slate-300">No dedicated books appointed to machines yet</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Click "Appoint New Book" to dedicate a numerical page range (e.g. 301-360) to a machine.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allMachineBooks.map(({ machine, book }) => (
                <div
                  key={`${machine.id}-${book.id}`}
                  className="bg-slate-850 rounded-xl p-3.5 border border-slate-750 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-amber-400 text-sm bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                        Book #{book.bookNumber || `${book.startPage}-${book.endPage}`}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase">
                        {book.status || 'Active'}
                      </span>
                    </div>

                    <div className="mt-2.5">
                      <p className="text-xs font-bold text-white truncate">{formatMachineDisplayName(machine)}</p>
                      <p className="text-[11px] font-mono text-blue-400">
                        {machine.serialNumber} {machine.machineType ? `• ${machine.machineType}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {machine.make || 'Plant Equipment'} {machine.model ? `(${machine.model})` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-300">
                      Pages: <strong className="font-mono text-amber-300">{book.startPage} – {book.endPage}</strong> ({Math.max(0, book.endPage - book.startPage + 1)} pgs)
                    </span>
                    <span>{book.dateAppointed ? new Date(book.dateAppointed).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. MORNING CAPTURE FORM (THE WORKHORSE) */}
      <div className={`rounded-2xl border transition-all ${
        editingEntry 
          ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-200' 
          : 'bg-white border-slate-200/90 shadow-xs'
      } p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3.5 mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white ${editingEntry ? 'bg-amber-600' : 'bg-blue-600'}`}>
              {editingEntry ? <Edit2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {editingEntry ? 'Edit Captured Worksheet Line' : 'Morning Timesheet Capture Form'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Type Page Number, Clock Number, Job Date, Job Number, Times, and Operation.
              </p>
            </div>
          </div>

          {editingEntry && (
            <button
              onClick={handleCancelEdit}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Edit</span>
            </button>
          )}
        </div>

        <form onSubmit={(e) => handleSaveEntry(e, false)} className="space-y-4">
          {/* TOP ROW: PAGE NUMBER (WITH AUTO-RESOLVER), CLOCK NUMBER, JOB DATE, JOB NUMBER */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Page Number & Auto Machine Link */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                Page Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={pageInputRef}
                  type="number"
                  placeholder="e.g. 305"
                  value={pageNumberInput}
                  onChange={(e) => setPageNumberInput(e.target.value)}
                  className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-mono font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition-all"
                  required
                />
              </div>

              {/* AUTO-MATCHED MACHINE BADGE */}
              {matchedBookInfo ? (
                <div className="mt-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg p-1.5 text-[10px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-extrabold text-emerald-800">
                      Book #{matchedBookInfo.bookNumber}:
                    </span>{' '}
                    <span className="font-bold text-slate-800">{formatMachineDisplayName(matchedBookInfo.machine)}</span>
                  </div>
                </div>
              ) : pageNumberInput.trim() ? (
                <div className="mt-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg p-1.5 text-[10px] flex items-center justify-between">
                  <div className="flex items-center gap-1 text-amber-800">
                    <Info className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>No dedicated book found for page #{pageNumberInput}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBookStartPage(pageNumberInput);
                      setBookEndPage(String(parseInt(pageNumberInput, 10) + 59));
                      setShowNewBookModal(true);
                    }}
                    className="text-[9px] font-extrabold text-blue-700 hover:underline cursor-pointer ml-1"
                  >
                    + Appoint Book
                  </button>
                </div>
              ) : null}
            </div>

            {/* 2. Clock Number (Employee) */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                Clock Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 104, CK-402"
                value={clockNumberInput}
                onChange={(e) => setClockNumberInput(e.target.value)}
                className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition-all uppercase"
                required
              />
              {recentClockNumbers.length > 0 && (
                <div className="flex items-center gap-1 mt-1 overflow-x-auto no-scrollbar">
                  <span className="text-[9px] text-slate-400 font-bold shrink-0">Recent:</span>
                  {recentClockNumbers.slice(0, 5).map((clk) => (
                    <button
                      key={clk}
                      type="button"
                      onClick={() => setClockNumberInput(clk)}
                      className="text-[9px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer shrink-0"
                    >
                      {clk}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Job Date */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                Job Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={jobDateInput}
                onChange={(e) => setJobDateInput(e.target.value)}
                className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition-all"
                required
              />
              <div className="flex items-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => setJobDateInput(new Date().toISOString().slice(0, 10))}
                  className="text-[9px] font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  Today
                </button>
                <span className="text-slate-300 text-[9px]">•</span>
                <button
                  type="button"
                  onClick={() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    setJobDateInput(y.toISOString().slice(0, 10));
                  }}
                  className="text-[9px] font-bold text-slate-600 hover:underline cursor-pointer"
                >
                  Yesterday
                </button>
              </div>
            </div>

            {/* 4. Job Card Number (Dropdown containing only Active Job Cards) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Active Job Card <span className="text-red-500">*</span>
                </label>
                <span className="text-[9px] font-bold text-slate-400">
                  {activeJobCards.length} Active
                </span>
              </div>
              <div className="relative">
                <select
                  value={jobNumberInput}
                  onChange={(e) => handleJobCardSelect(e.target.value)}
                  className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-blue-950 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition-all truncate"
                  required
                >
                  <option value="">-- Select Active Job Card --</option>
                  {activeJobCards.map((j) => (
                    <option key={j.jobId} value={j.jobNumber}>
                      {j.label}
                    </option>
                  ))}
                  {/* If editing an existing entry whose job number is closed or not in active list, show fallback option */}
                  {jobNumberInput && !activeJobCards.some((j) => j.jobNumber.toLowerCase() === jobNumberInput.trim().toLowerCase()) && (
                    <option value={jobNumberInput}>
                      {jobNumberInput} (Archived / Closed Job)
                    </option>
                  )}
                </select>
              </div>

              {/* SELECTED JOB CARD CONTEXT BADGE */}
              {selectedJobCardInfo ? (
                <div className="mt-1.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg p-1.5 text-[10px] flex items-center justify-between">
                  <div className="truncate">
                    <span className="font-black text-blue-950">{selectedJobCardInfo.customerName}:</span>{' '}
                    <span className="text-slate-700 font-medium">{selectedJobCardInfo.component}</span>{' '}
                    {selectedJobCardInfo.serial && (
                      <span className="font-mono text-slate-500 font-bold">({selectedJobCardInfo.serial})</span>
                    )}
                  </div>
                  {onSelectJob && (
                    <button
                      type="button"
                      onClick={() => onSelectJob(selectedJobCardInfo.job)}
                      className="text-[9px] font-extrabold text-blue-700 hover:underline shrink-0 ml-1 cursor-pointer"
                      title="View Job Card in Enquiries"
                    >
                      View ↗
                    </button>
                  )}
                </div>
              ) : activeJobCards.length === 0 ? (
                <div className="mt-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg p-1.5 text-[10px] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>No active job cards found. Create job cards in Stage 4 first.</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* SECOND ROW: START TIME, END TIME (WITH REAL-TIME DURATION), OPERATION (FROM JOB CARD STEPS), MACHINE SELECTOR OVERRIDE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            {/* Start Time */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={startTimeInput}
                onChange={(e) => setStartTimeInput(e.target.value)}
                className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition-all"
                required
              />
            </div>

            {/* End Time & Duration Badge */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  End Time <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] font-mono font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {currentDuration.formatted}
                </span>
              </div>
              <input
                type="time"
                value={endTimeInput}
                onChange={(e) => setEndTimeInput(e.target.value)}
                className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition-all"
                required
              />
            </div>

            {/* Operation (Dropdown containing only steps from the selected Job Card) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Operation Step <span className="text-red-500">*</span>
                </label>
                {selectedJobCardInfo && (
                  <span className="text-[9px] font-bold text-slate-400">
                    {selectedJobSteps.length} {selectedJobSteps.length === 1 ? 'Step' : 'Steps'}
                  </span>
                )}
              </div>
              <div className="relative">
                <select
                  value={operationInput}
                  onChange={(e) => setOperationInput(e.target.value)}
                  disabled={!selectedJobCardInfo}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold transition-all focus:outline-hidden focus:ring-2 truncate ${
                    !selectedJobCardInfo
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-50 focus:bg-white border-slate-300 focus:border-blue-500 text-slate-900 focus:ring-blue-100'
                  }`}
                  required
                >
                  {!selectedJobCardInfo ? (
                    <option value="">-- Select Active Job Card First --</option>
                  ) : selectedJobSteps.length === 0 ? (
                    <option value="">-- No Steps Defined on Job Card --</option>
                  ) : (
                    <option value="">-- Select Operation Step --</option>
                  )}
                  {selectedJobSteps.map((step, idx) => (
                    <option key={idx} value={step}>
                      {idx + 1}. {step}
                    </option>
                  ))}
                  {/* Fallback option if operation was already saved or custom */}
                  {operationInput && !selectedJobSteps.some((s) => s.toLowerCase() === operationInput.trim().toLowerCase()) && (
                    <option value={operationInput}>
                      {operationInput} (Recorded Step)
                    </option>
                  )}
                </select>
              </div>
              {!selectedJobCardInfo ? (
                <p className="text-[9px] text-slate-400 mt-1">
                  Select a job card to populate its operation steps.
                </p>
              ) : selectedJobSteps.length === 0 ? (
                <p className="text-[9px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  No procedures/steps configured on this job card.
                </p>
              ) : null}
            </div>

            {/* Manual Machine / Book Override (if not auto-matched) */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                Machine Assignment
              </label>
              <select
                value={matchedBookInfo ? matchedBookInfo.machine.id : selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="">-- {matchedBookInfo ? `Auto: ${formatMachineDisplayName(matchedBookInfo.machine)}` : 'Select Plant Machine'} --</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatMachineDisplayName(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* THIRD ROW: OPTIONAL NOTES & SUBMISSION BUTTONS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Optional notes / comments / work details..."
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              {!editingEntry && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={(e) => handleSaveEntry(e, true)}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  title="Save this line and immediately prepare next page line"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save &amp; Add Another</span>
                </button>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>{editingEntry ? 'Update Worksheet Line' : 'Save Worksheet Line'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 4. FILTER & SEARCH CONTROL BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by page #, job #, clock #, machine, operation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Range Buttons */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Date:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: '7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'custom', label: 'Custom' }
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setFilterDateMode(d.id as any)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterDateMode === d.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* CUSTOM DATE RANGE PICKER (IF SELECTED) */}
        {filterDateMode === 'custom' && (
          <div className="flex items-center gap-2 p-2.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs">
            <span className="font-bold text-blue-900">Custom Date Range:</span>
            <input
              type="date"
              value={filterCustomStartDate}
              onChange={(e) => setFilterCustomStartDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={filterCustomEndDate}
              onChange={(e) => setFilterCustomEndDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs"
            />
          </div>
        )}

        {/* SECONDARY FILTER CHIPS: PAGE NUMBER, JOB NUMBER, MACHINE, CLOCK #, OPERATION */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Page #</label>
            <input
              type="text"
              placeholder="e.g. 305 or 301-360"
              value={filterPageNumber}
              onChange={(e) => setFilterPageNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Job #</label>
            <input
              type="text"
              placeholder="e.g. JOB-..."
              value={filterJobNumber}
              onChange={(e) => setFilterJobNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Machine</label>
            <select
              value={filterMachineId}
              onChange={(e) => setFilterMachineId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs"
            >
              <option value="ALL">All Machines</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatMachineDisplayName(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Clock #</label>
            <input
              type="text"
              placeholder="e.g. 104"
              value={filterClockNumber}
              onChange={(e) => setFilterClockNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Operation</label>
            <select
              value={filterOperation}
              onChange={(e) => setFilterOperation(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs"
            >
              <option value="ALL">All Operations</option>
              {availableFilterOperations.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ACTIVE FILTER SUMMARY & RESET */}
        {(searchQuery || filterPageNumber || filterJobNumber || filterMachineId !== 'ALL' || filterClockNumber || filterOperation !== 'ALL' || filterDateMode !== 'all') && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{filteredEntries.length}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{entries.length}</strong> total lines (
              <strong className="font-mono text-purple-700">{stats.filteredHours.toFixed(2)} hrs</strong>)
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterPageNumber('');
                setFilterJobNumber('');
                setFilterMachineId('ALL');
                setFilterClockNumber('');
                setFilterOperation('ALL');
                setFilterDateMode('all');
                setFilterCustomStartDate('');
                setFilterCustomEndDate('');
              }}
              className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer hover:underline text-[11px]"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* 5. WORKSHEET TABLE (DISPLAY EVERY LINE PER DASHBOARD) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Captured Worksheet Timesheet Log ({filteredEntries.length})
            </h3>
          </div>
          <div className="text-[11px] font-mono text-slate-500 font-bold">
            Total Elapsed: <span className="text-purple-700 font-black">{stats.filteredHours.toFixed(2)} Hours</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Loading worksheet timesheet entries...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-50/50">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-700">No worksheet lines found</h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              {entries.length === 0 
                ? 'Use the capture form above to type in the morning page number, clock number, times and operation.' 
                : 'No entries match your current search and filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="p-3">Date</th>
                  <th className="p-3">Page #</th>
                  <th className="p-3">Dedicated Book &amp; Machine</th>
                  <th className="p-3">Clock #</th>
                  <th className="p-3">Job Number</th>
                  <th className="p-3">Operation</th>
                  <th className="p-3">Time Range</th>
                  <th className="p-3 text-center">Duration</th>
                  <th className="p-3">Captured By / Notes</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredEntries.map((entry) => {
                  const isBeingEdited = editingEntry?.id === entry.id;
                  const durationFmt = calculateDuration(entry.startTime, entry.endTime);

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        isBeingEdited
                          ? 'bg-amber-50/80 font-semibold'
                          : 'hover:bg-blue-50/30'
                      }`}
                    >
                      {/* 1. Job Date */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 font-mono text-[11px]">
                          {entry.jobDate}
                        </div>
                      </td>

                      {/* 2. Page Number */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80">
                          p. {entry.pageNumber}
                        </span>
                      </td>

                      {/* 3. Dedicated Book & Machine */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {entry.bookNumber && (
                            <span className="font-mono text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              {entry.bookNumber.startsWith('Book') ? entry.bookNumber : `Book #${entry.bookNumber}`}
                            </span>
                          )}
                          <span className="font-bold text-slate-800 text-xs">
                            {getMachineLabelByIdOrNumber(entry.machineId || entry.machineSerialNumber || entry.machineName, machines)}
                          </span>
                        </div>
                      </td>

                      {/* 4. Clock Number */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-mono font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                          {entry.clockNumber}
                        </span>
                      </td>

                      {/* 5. Job Number */}
                      <td className="p-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            const matchedJob = jobs.find(
                              (j) =>
                                j.id === entry.jobNumber ||
                                j.jobCardDetails?.jobCardNumber === entry.jobNumber
                            );
                            if (matchedJob && onSelectJob) {
                              onSelectJob(matchedJob);
                            }
                          }}
                          className="font-mono font-black text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200/80 text-[11px] transition-colors cursor-pointer text-left"
                          title="Click to view related Job Card"
                        >
                          #{entry.jobNumber}
                        </button>
                      </td>

                      {/* 6. Operation */}
                      <td className="p-3">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                          {entry.operation}
                        </span>
                      </td>

                      {/* 7. Time Range */}
                      <td className="p-3 whitespace-nowrap font-mono text-xs text-slate-700">
                        <span>{entry.startTime}</span>
                        <span className="text-slate-400 mx-1.5">→</span>
                        <span>{entry.endTime}</span>
                      </td>

                      {/* 8. Duration */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="font-mono font-black text-xs text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                          {entry.durationHours ? `${entry.durationHours.toFixed(2)} hrs` : durationFmt.formatted}
                        </span>
                      </td>

                      {/* 9. Captured By & Notes */}
                      <td className="p-3 max-w-xs">
                        {entry.notes ? (
                          <div className="text-xs text-slate-700 truncate" title={entry.notes}>
                            {entry.notes}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No notes</span>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          By {entry.capturedBy || 'Operator'}
                        </div>
                      </td>

                      {/* 10. Actions */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(entry)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit worksheet line"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {deleteConfirmId === entry.id ? (
                            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold cursor-pointer hover:bg-red-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1.5 py-0.5 text-slate-600 rounded text-[10px] font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(entry.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete worksheet line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. MODAL: APPOINT DEDICATED BOOK TO MACHINE */}
      {showNewBookModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">Appoint Dedicated Timesheet Book</h3>
              </div>
              <button
                onClick={() => setShowNewBookModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAppointDedicatedBook} className="p-5 space-y-4 text-xs">
              <p className="text-slate-500">
                Dedicate a numerical page book to a specific plant machine. For example, assigning <strong>301-360</strong> links page 301 all the way to page 360 to that machine.
              </p>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                  Target Machine <span className="text-red-500">*</span>
                </label>
                <select
                  value={bookMachineId}
                  onChange={(e) => setBookMachineId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  required
                >
                  <option value="">-- Choose Machine to receive this Book --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {formatMachineDisplayName(m)}{m.location ? ` — ${m.location}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                    Start Page <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 301"
                    value={bookStartPage}
                    onChange={(e) => setBookStartPage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                    End Page <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 360"
                    value={bookEndPage}
                    onChange={(e) => setBookEndPage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                    Custom Book Number / Name
                  </label>
                  <input
                    type="text"
                    placeholder={`Defaults to "${bookStartPage}-${bookEndPage}"`}
                    value={bookCustomNumber}
                    onChange={(e) => setBookCustomNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                    Date Appointed
                  </label>
                  <input
                    type="date"
                    value={bookAppointedDate}
                    onChange={(e) => setBookAppointedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900">
                <strong>Resulting Book Definition:</strong> Pages{' '}
                <strong className="font-mono text-amber-950">
                  {bookStartPage || 0} to {bookEndPage || 0}
                </strong>{' '}
                ({Math.max(0, parseInt(bookEndPage || '0', 10) - parseInt(bookStartPage || '0', 10) + 1)} pages) will be dedicated to this machine.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewBookModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBook}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isSavingBook ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Confirm and Appoint Book</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
