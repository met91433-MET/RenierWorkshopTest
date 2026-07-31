import React, { useRef, useEffect, useState } from 'react';
import { Machine, Job, JobCardFormatConfig, DEFAULT_JOB_CARD_FORMAT, MachineTimesheetBook } from '../types';
import { openInNewWindow } from '../utils/printDoc';
import { 
  Wrench, 
  Printer, 
  X, 
  Building2, 
  MapPin, 
  Tag, 
  Activity, 
  FileText, 
  Edit, 
  Trash2, 
  Image as ImageIcon,
  ExternalLink,
  Calendar,
  Layers,
  Sparkles,
  BookOpen,
  Book,
  Plus,
  CheckCircle2,
  Clock,
  BookMarked
} from 'lucide-react';

interface MachineCardDocumentProps {
  machine: Machine;
  format?: JobCardFormatConfig;
  jobs?: Job[];
  onClose: () => void;
  onEdit?: (machine: Machine) => void;
  onDelete?: (id: string) => void;
  onSelectJob?: (job: Job) => void;
  onSaveMachine?: (machine: Machine) => Promise<void> | void;
}

export default function MachineCardDocument({
  machine,
  format = DEFAULT_JOB_CARD_FORMAT,
  jobs = [],
  onClose,
  onEdit,
  onDelete,
  onSelectJob,
  onSaveMachine
}: MachineCardDocumentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentMachine, setCurrentMachine] = useState<Machine>(machine);
  const [scale, setScale] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'card' | 'serviceLog' | 'timesheet'>('card');
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

  // Service/Repair form state
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [logOrderNumber, setLogOrderNumber] = useState<string>('');
  const [logIssue, setLogIssue] = useState<string>('');
  const [isSavingLog, setIsSavingLog] = useState<boolean>(false);

  // Machine Timesheet Book state
  const [tsStartPage, setTsStartPage] = useState<string>('301');
  const [tsEndPage, setTsEndPage] = useState<string>('360');
  const [tsBookNumber, setTsBookNumber] = useState<string>('');
  const [tsDateAppointed, setTsDateAppointed] = useState<string>(new Date().toISOString().slice(0, 10));
  const [tsStatus, setTsStatus] = useState<string>('Active');
  const [tsNotes, setTsNotes] = useState<string>('');
  const [isSavingBook, setIsSavingBook] = useState<boolean>(false);

  useEffect(() => {
    setCurrentMachine(machine);
  }, [machine]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.clientWidth;
      if (width > 0 && width < 794) {
        setScale(width / 794);
      } else {
        setScale(1);
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const serviceLogs = currentMachine.serviceLogs || [];
  const timesheetBooks = currentMachine.timesheetBooks || [];

  // Add Service / Repair Record
  const handleAddServiceRepairLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logOrderNumber.trim()) {
      alert('Please enter the Order Number for the repair.');
      return;
    }
    if (!logIssue.trim()) {
      alert('Please enter the issue / details of the repair or service.');
      return;
    }

    setIsSavingLog(true);
    const newLog = {
      id: `slog-${Date.now()}`,
      date: logDate || new Date().toISOString().slice(0, 10),
      orderNumber: logOrderNumber.trim(),
      issue: logIssue.trim(),
      loggedAt: new Date().toISOString()
    };

    const updatedLogs = [newLog, ...serviceLogs];
    const updatedMachine: Machine = {
      ...currentMachine,
      serviceLogs: updatedLogs,
      updatedAt: new Date().toISOString()
    };

    setCurrentMachine(updatedMachine);

    if (onSaveMachine) {
      try {
        await onSaveMachine(updatedMachine);
      } catch (err) {
        console.error('Failed to save service record:', err);
      }
    }

    setLogOrderNumber('');
    setLogIssue('');
    setLogDate(new Date().toISOString().slice(0, 10));
    setIsSavingLog(false);
  };

  // Appoint Timesheet Book to Machine
  const handleAddTimesheetBook = async (e: React.FormEvent) => {
    e.preventDefault();
    const startNum = parseInt(tsStartPage, 10);
    const endNum = parseInt(tsEndPage, 10);

    if (isNaN(startNum) || isNaN(endNum) || startNum <= 0) {
      alert('Please enter valid positive numbers for Start Page and End Page.');
      return;
    }
    if (endNum < startNum) {
      alert('End Page must be greater than or equal to Start Page (e.g. 301 to 360).');
      return;
    }

    const computedBookNo = tsBookNumber.trim() || `${startNum}-${endNum}`;

    setIsSavingBook(true);
    const newBook: MachineTimesheetBook = {
      id: `tsbook-${Date.now()}`,
      bookNumber: computedBookNo,
      startPage: startNum,
      endPage: endNum,
      dateAppointed: tsDateAppointed || new Date().toISOString().slice(0, 10),
      status: tsStatus || 'Active',
      notes: tsNotes.trim() || undefined,
      loggedAt: new Date().toISOString()
    };

    const updatedBooks = [newBook, ...timesheetBooks];
    const updatedMachine: Machine = {
      ...currentMachine,
      timesheetBooks: updatedBooks,
      updatedAt: new Date().toISOString()
    };

    setCurrentMachine(updatedMachine);

    if (onSaveMachine) {
      try {
        await onSaveMachine(updatedMachine);
      } catch (err) {
        console.error('Failed to save timesheet book:', err);
      }
    }

    // Auto increment next book range e.g. 361 to 420
    const pageCount = endNum - startNum + 1;
    const nextStart = endNum + 1;
    const nextEnd = nextStart + pageCount - 1;
    setTsStartPage(String(nextStart));
    setTsEndPage(String(nextEnd));
    setTsBookNumber('');
    setTsNotes('');
    setTsStatus('Active');
    setIsSavingBook(false);
  };

  // Update Timesheet Book status
  const handleUpdateBookStatus = async (bookId: string, newStatus: string) => {
    const updatedBooks = timesheetBooks.map(b => 
      b.id === bookId ? { ...b, status: newStatus } : b
    );
    const updatedMachine: Machine = {
      ...currentMachine,
      timesheetBooks: updatedBooks,
      updatedAt: new Date().toISOString()
    };

    setCurrentMachine(updatedMachine);
    if (onSaveMachine) {
      try {
        await onSaveMachine(updatedMachine);
      } catch (err) {
        console.error('Failed to update book status:', err);
      }
    }
  };

  // Print Machine Card function
  const handlePrint = () => {
    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Machine Card - ${currentMachine.machineName} (${currentMachine.serialNumber})</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: ui-sans-serif, system-ui, sans-serif; background: #ffffff; color: #000000; margin: 0; padding: 0; }
            .print-border { border: 2px solid #000000; }
          </style>
        </head>
        <body class="p-4">
          <div class="max-w-[794px] mx-auto border-2 border-black p-6 bg-white space-y-6">
            <!-- Header -->
            <div class="flex justify-between items-start border-b-2 border-black pb-4">
              <div>
                ${format.showCompanyLogo && format.logoUrl ? `<img src="${format.logoUrl}" class="h-16 mb-2 object-contain" />` : ''}
                <h1 class="text-2xl font-black tracking-tight text-slate-900 uppercase">${format.companyName || 'INDUSTRIAL COMPONENT REPAIRS'}</h1>
                <p class="text-xs text-slate-600 font-semibold">${format.companySubtitle || 'TECHNICAL MACHINERY & EQUIPMENT CARD'}</p>
              </div>
              <div class="text-right">
                <div class="inline-block border-2 border-slate-900 bg-slate-900 text-white font-black px-3 py-1 text-sm rounded">
                  MACHINE ID: ${currentMachine.serialNumber || currentMachine.id}
                </div>
                <p class="text-[10px] text-slate-500 mt-1 uppercase font-bold">STATUS: ${currentMachine.status || 'Active'}</p>
              </div>
            </div>

            <!-- Primary Grid -->
            <div class="grid grid-cols-2 gap-4 border border-black p-4 bg-slate-50">
              <div>
                <p class="text-[10px] uppercase font-bold text-slate-500">Machine Name / Equipment</p>
                <p class="text-base font-black text-slate-900">${currentMachine.machineName}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase font-bold text-slate-500">Machine Number</p>
                <p class="text-base font-black text-blue-800">${currentMachine.serialNumber}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase font-bold text-slate-500">Make & Model</p>
                <p class="text-sm font-bold text-slate-800">${currentMachine.make || 'N/A'} — ${currentMachine.model || 'N/A'}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase font-bold text-slate-500">Machine Type</p>
                <p class="text-sm font-bold text-slate-800">${currentMachine.machineType || 'N/A'}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase font-bold text-slate-500">Area Code</p>
                <p class="text-sm font-bold text-slate-800">${currentMachine.location || 'N/A'}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase font-bold text-slate-500">Operating Status</p>
                <p class="text-sm font-bold text-slate-800">${currentMachine.status || 'Operational'}</p>
              </div>
            </div>

            <!-- Machine Service & Repair Log -->
            <div>
              <h3 class="text-xs font-black uppercase text-slate-900 border-b border-black pb-1 mb-2">Machine Service & Repair History Log</h3>
              <table class="w-full text-xs border border-black">
                <thead>
                  <tr class="bg-slate-200 border-b border-black font-bold text-left">
                    <th class="p-2 border-r border-black w-28">Date</th>
                    <th class="p-2 border-r border-black w-32">Order Number</th>
                    <th class="p-2">Issue / Service Details</th>
                  </tr>
                </thead>
                <tbody>
                  ${serviceLogs.length > 0 
                    ? serviceLogs.map(log => `
                      <tr class="border-b border-slate-300">
                        <td class="p-2 font-bold border-r border-black bg-slate-50">${log.date ? new Date(log.date).toLocaleDateString() : 'N/A'}</td>
                        <td class="p-2 font-mono font-bold text-blue-800 border-r border-black bg-slate-50">${log.orderNumber}</td>
                        <td class="p-2 font-medium">${log.issue}</td>
                      </tr>
                    `).join('')
                    : '<tr><td colspan="3" class="p-2 text-slate-500 italic text-center">No service or repair records logged.</td></tr>'
                  }
                </tbody>
              </table>
            </div>

            <!-- Appointed Timesheet Books -->
            <div>
              <h3 class="text-xs font-black uppercase text-slate-900 border-b border-black pb-1 mb-2">Appointed Timesheet Books</h3>
              <table class="w-full text-xs border border-black">
                <thead>
                  <tr class="bg-slate-200 border-b border-black font-bold text-left">
                    <th class="p-2 border-r border-black w-28">Book Range</th>
                    <th class="p-2 border-r border-black w-32">Page Range</th>
                    <th class="p-2 border-r border-black w-28">Date Appointed</th>
                    <th class="p-2 border-r border-black w-24">Status</th>
                    <th class="p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${timesheetBooks.length > 0 
                    ? timesheetBooks.map(b => `
                      <tr class="border-b border-slate-300">
                        <td class="p-2 font-mono font-bold text-blue-800 border-r border-black bg-slate-50">${b.bookNumber}</td>
                        <td class="p-2 border-r border-black">Pages ${b.startPage} – ${b.endPage} (${Math.max(0, b.endPage - b.startPage + 1)} pages)</td>
                        <td class="p-2 border-r border-black bg-slate-50">${b.dateAppointed ? new Date(b.dateAppointed).toLocaleDateString() : 'N/A'}</td>
                        <td class="p-2 border-r border-black font-bold">${b.status || 'Active'}</td>
                        <td class="p-2">${b.notes || '-'}</td>
                      </tr>
                    `).join('')
                    : '<tr><td colspan="5" class="p-2 text-slate-500 italic text-center">No timesheet books appointed to this machine.</td></tr>'
                  }
                </tbody>
              </table>
            </div>

            <!-- System Info Footer -->
            <div class="border border-black p-3 bg-slate-100 flex justify-between items-center text-xs font-bold">
              <span>Service Records: ${serviceLogs.length} | Timesheet Books Appointed: ${timesheetBooks.length}</span>
              <span>Date Created: ${currentMachine.createdAt ? new Date(currentMachine.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </body>
      </html>
    `;
    const win = window.open('', '_blank', 'width=900,height=1000,scrollbars=yes');
    if (win) {
      win.document.write(printHtml);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Operational':
      case 'Active':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Under Repair':
      case 'In Maintenance':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Decommissioned':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-100 rounded-3xl shadow-2xl border border-slate-300 w-full max-w-5xl h-[88vh] min-h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Control Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-400/30 text-blue-400 rounded-2xl">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">{machine.machineName}</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(machine.status)}`}>
                  {machine.status || 'Active'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>SN: <strong className="text-blue-300">{machine.serialNumber}</strong></span>
                <span>•</span>
                <span>{machine.make || 'Equipment'} {machine.model ? `(${machine.model})` : ''}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Machine Card</span>
            </button>

            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(machine)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => setShowConfirmDeleteModal(true)}
                className="px-3 py-2 bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-700/50 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="Delete Machine Record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode Navigation Sub-bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('card')}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'card'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Machine Card Document</span>
            </button>

            <button
              onClick={() => setActiveTab('serviceLog')}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'serviceLog'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Machine Service/Repair ({serviceLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('timesheet')}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'timesheet'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Machine Timesheet ({timesheetBooks.length})</span>
            </button>
          </div>

          <p className="text-[11px] font-semibold text-slate-400 hidden sm:block">
            Machine No: <span className="font-bold text-slate-600">{machine.serialNumber}</span>
          </p>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/60">
          
          {/* TAB 1: MACHINE CARD DOCUMENT */}
          {activeTab === 'card' && (
            <div className="max-w-[794px] mx-auto bg-white border-2 border-slate-900 rounded-2xl shadow-xl p-8 space-y-6">
              
              {/* Header Box */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-5">
                <div>
                  {format.showCompanyLogo && format.logoUrl && (
                    <img src={format.logoUrl} alt="Logo" className="h-14 mb-2 object-contain" />
                  )}
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {format.companyName || 'INDUSTRIAL COMPONENT REPAIRS'}
                  </h1>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                    {format.companySubtitle || 'TECHNICAL MACHINERY & EQUIPMENT CARD'}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <div className="inline-block bg-slate-900 text-white font-black px-3.5 py-1.5 text-xs rounded-xl shadow-xs">
                    MACHINE NO: {machine.serialNumber || machine.id}
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                    System Record • Created {machine.createdAt ? new Date(machine.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Core Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-2 border-slate-900 rounded-xl p-5 bg-slate-50/80">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Machine Equipment Name</span>
                  <p className="text-base font-black text-slate-900">{machine.machineName}</p>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Machine Number</span>
                  <p className="text-base font-black text-blue-700 font-mono">{machine.serialNumber}</p>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Make / Manufacturer</span>
                  <p className="text-sm font-bold text-slate-800">
                    {machine.make || 'N/A'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Machine Type</span>
                  <p className="text-sm font-bold text-slate-800">
                    {machine.machineType || 'N/A'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Model / Series</span>
                  <p className="text-sm font-bold text-slate-800">
                    {machine.model || 'N/A'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Area Code</span>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-1 font-mono">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{machine.location || '4B'}</span>
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Operating Status</span>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-tight border ${
                    machine.status === 'Operational' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {machine.status || 'Operational'}
                  </span>
                </div>
              </div>

              {/* Machine Service/Repair History Log Summary Banner */}
              <div className="border-2 border-slate-900 rounded-xl p-4 bg-blue-50/80 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-2xs">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">Machine Service & Repair History</h4>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {serviceLogs.length > 0 
                        ? `${serviceLogs.length} service/repair records logged for Machine ${currentMachine.serialNumber}`
                        : `No service or repair records logged yet for Machine ${currentMachine.serialNumber}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('serviceLog')}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                >
                  {serviceLogs.length > 0 ? 'View & Add Log →' : '+ Add Service Log →'}
                </button>
              </div>

              {/* Machine Timesheet Books Summary Banner */}
              <div className="border-2 border-slate-900 rounded-xl p-4 bg-emerald-50/80 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-2xs">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">Machine Timesheet Books</h4>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {timesheetBooks.length > 0 
                        ? `${timesheetBooks.length} timesheet books appointed to Machine ${currentMachine.serialNumber}`
                        : `No timesheet books appointed yet to Machine ${currentMachine.serialNumber}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('timesheet')}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                >
                  {timesheetBooks.length > 0 ? 'View & Appoint Books →' : '+ Appoint Timesheet Book →'}
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: MACHINE SERVICE / REPAIR */}
          {activeTab === 'serviceLog' && (
            <div className="max-w-[794px] mx-auto space-y-6 text-left">
              
              {/* Form to capture Service/Repair Record */}
              <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">Add Machine Service / Repair Record</h3>
                      <p className="text-xs text-slate-500">Capture the repair details and order number for machine #{currentMachine.serialNumber}</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddServiceRepairLog} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Service / Repair Date *</label>
                      <input
                        type="date"
                        required
                        value={logDate}
                        onChange={(e) => setLogDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Order Number for Repair *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ORD-99201"
                        value={logOrderNumber}
                        onChange={(e) => setLogOrderNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-blue-800 font-mono focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Issue / Service Details *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe the issue, defect, parts replaced, or service work executed on this machine..."
                      value={logIssue}
                      onChange={(e) => setLogIssue(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingLog}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Wrench className="w-4 h-4" />
                      <span>{isSavingLog ? 'Saving to Machine Log...' : 'Add Service/Repair to Machine Log'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Service & Repair History List */}
              <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    Service & Repair History Log
                  </h3>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                    {serviceLogs.length} Records
                  </span>
                </div>

                {serviceLogs.length > 0 ? (
                  <div className="space-y-3">
                    {serviceLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-left"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-900 font-extrabold text-xs px-2.5 py-1 rounded-lg border border-blue-200 font-mono">
                              Order #: {log.orderNumber}
                            </span>
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {log.date ? new Date(log.date).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          {log.loggedAt && (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              Logged: {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Issue / Repair Details</p>
                          <p className="text-xs font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {log.issue}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-400 space-y-2">
                    <Wrench className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700 text-xs">No Service or Repair Records Logged</p>
                    <p className="text-xs text-slate-500">
                      Fill out the form above to log the first repair order and issue for machine {currentMachine.serialNumber}.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: MACHINE TIMESHEET */}
          {activeTab === 'timesheet' && (
            <div className="max-w-[794px] mx-auto space-y-6 text-left">
              
              {/* Timesheet Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-xs flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Appointed Books</p>
                    <p className="text-lg font-black text-slate-900">{timesheetBooks.length} Books</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-xs flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pages Issued</p>
                    <p className="text-lg font-black text-slate-900">
                      {timesheetBooks.reduce((acc, b) => acc + Math.max(0, b.endPage - b.startPage + 1), 0)} Pages
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-xs flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                    <BookMarked className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Book Range</p>
                    <p className="text-sm font-black text-blue-800 font-mono">
                      {timesheetBooks.find(b => b.status === 'Active')?.bookNumber || (timesheetBooks.length > 0 ? timesheetBooks[0].bookNumber : 'None')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form: Appoint New Timesheet Book */}
              <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">Appoint Timesheet Book to Machine</h3>
                      <p className="text-xs text-slate-500">Assign a new timesheet book and page range (e.g. 301–360) for Machine #{currentMachine.serialNumber}</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddTimesheetBook} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Start Page Number *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="301"
                        value={tsStartPage}
                        onChange={(e) => setTsStartPage(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 font-mono focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">End Page Number *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="360"
                        value={tsEndPage}
                        onChange={(e) => setTsEndPage(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 font-mono focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Book Number / Label</label>
                      <input
                        type="text"
                        placeholder={tsStartPage && tsEndPage ? `${tsStartPage}-${tsEndPage}` : "e.g. 301-360"}
                        value={tsBookNumber}
                        onChange={(e) => setTsBookNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-blue-800 font-mono focus:outline-hidden focus:border-blue-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Defaults to range e.g. "301-360"</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Date Appointed *</label>
                      <input
                        type="date"
                        required
                        value={tsDateAppointed}
                        onChange={(e) => setTsDateAppointed(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Initial Status</label>
                      <select
                        value={tsStatus}
                        onChange={(e) => setTsStatus(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                      >
                        <option value="Active">Active (In Use)</option>
                        <option value="Completed">Completed (Full)</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Notes / Remarks (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Issued to operator John for shift logging, replaces book 241-300..."
                      value={tsNotes}
                      onChange={(e) => setTsNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <div className="text-[11px] font-semibold text-slate-500">
                      {tsStartPage && tsEndPage && !isNaN(parseInt(tsStartPage)) && !isNaN(parseInt(tsEndPage)) && parseInt(tsEndPage) >= parseInt(tsStartPage) ? (
                        <span>Book range: <strong className="text-slate-900 font-mono">{tsStartPage} to {tsEndPage}</strong> ({parseInt(tsEndPage) - parseInt(tsStartPage) + 1} pages)</span>
                      ) : null}
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingBook}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isSavingBook ? 'Saving Book...' : 'Appoint Book to Machine'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Module: Previously Appointed Timesheet Books */}
              <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Book className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                      Previously Appointed Timesheet Books
                    </h3>
                  </div>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                    {timesheetBooks.length} Books
                  </span>
                </div>

                {timesheetBooks.length > 0 ? (
                  <div className="space-y-3">
                    {timesheetBooks.map((book) => {
                      const pageCount = Math.max(0, book.endPage - book.startPage + 1);
                      return (
                        <div 
                          key={book.id} 
                          className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-left transition-all hover:border-slate-300"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-2xs font-mono font-black text-sm">
                                {book.bookNumber}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold text-slate-900">
                                    Pages {book.startPage} – {book.endPage}
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">
                                    {pageCount} Pages
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  Appointed: {book.dateAppointed ? new Date(book.dateAppointed).toLocaleDateString() : 'N/A'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Status badge and toggle */}
                              <select
                                value={book.status || 'Active'}
                                onChange={(e) => handleUpdateBookStatus(book.id, e.target.value)}
                                className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border cursor-pointer focus:outline-hidden ${
                                  book.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : book.status === 'Completed'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-300'
                                }`}
                              >
                                <option value="Active">● Active</option>
                                <option value="Completed">✓ Completed</option>
                                <option value="Archived">📁 Archived</option>
                              </select>
                            </div>
                          </div>

                          {book.notes && (
                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-xs text-slate-700 font-medium">
                              <strong className="text-slate-400 font-bold uppercase text-[10px] block mb-0.5">Notes / Remarks</strong>
                              {book.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-400 space-y-2">
                    <BookOpen className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700 text-xs">No Timesheet Books Appointed Yet</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Fill out the form above to appoint the first timesheet book (e.g. page range 301–360) to machine {currentMachine.serialNumber}.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>

      {/* Custom Confirm Delete Modal */}
      {showConfirmDeleteModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-extrabold text-slate-900">Delete Equipment Record</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete machine equipment <strong className="text-slate-900">{machine.machineName}</strong> (SN: {machine.serialNumber})?
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmDeleteModal(false);
                  onClose();
                  if (onDelete) {
                    await onDelete(machine.id);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Delete Machine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
