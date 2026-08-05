import { useState, useEffect, FormEvent } from 'react';
import { ToolStockItem, ConsumableItem, ConsumableAllocationLog, UserProfile, Job, Machine } from '../types';
import { 
  getToolStockItems, 
  saveToolStockItem, 
  deleteToolStockItem,
  getConsumableItems, 
  saveConsumableItem, 
  deleteConsumableItem,
  getConsumableAllocationLogs, 
  saveConsumableAllocationLog,
  deleteConsumableAllocationLog,
  getJobs,
  getMachines
} from '../dbService';
import { 
  Wrench, 
  Package, 
  ClipboardList, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  Clock, 
  Hash, 
  CheckCircle2, 
  ArrowRightLeft, 
  X, 
  AlertCircle,
  FileText,
  Boxes,
  Layers,
  Trash2,
  RefreshCw,
  HardHat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StoresDashboardViewProps {
  currentUser: UserProfile | null;
  jobs?: Job[];
  machines?: Machine[];
}

export default function StoresDashboardView({ currentUser, jobs = [], machines = [] }: StoresDashboardViewProps) {
  // Slider / Switcher Mode: 'tools' | 'consumables' | 'log'
  const [activeStoresMode, setActiveStoresMode] = useState<'tools' | 'consumables' | 'log'>('tools');

  // Core Data State
  const [tools, setTools] = useState<ToolStockItem[]>([]);
  const [consumables, setConsumables] = useState<ConsumableItem[]>([]);
  const [allocationLogs, setAllocationLogs] = useState<ConsumableAllocationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Jobs and Machines Sync for Allocation Dropdowns
  const [internalJobs, setInternalJobs] = useState<Job[]>(jobs);
  const [internalMachines, setInternalMachines] = useState<Machine[]>(machines);

  useEffect(() => {
    if (jobs && jobs.length > 0) {
      setInternalJobs(jobs);
    } else {
      getJobs().then(setInternalJobs).catch(console.error);
    }
  }, [jobs]);

  useEffect(() => {
    if (machines && machines.length > 0) {
      setInternalMachines(machines);
    } else {
      getMachines().then(setInternalMachines).catch(console.error);
    }
  }, [machines]);

  // Active jobs on the system with an active Job Card (excluding closed jobs)
  const activeJobsWithJobCards = internalJobs.filter(j => 
    j.status !== 'Closed' && 
    Boolean(j.jobCardDetails?.jobCardNumber && j.jobCardDetails.jobCardNumber.trim() !== '')
  );

  // Currently active / operating machines
  const operatingMachines = internalMachines.filter(m => {
    if (!m.status) return true;
    const s = m.status.toLowerCase();
    return s === 'operational' || s === 'active' || (s !== 'decommissioned' && s !== 'under repair' && s !== 'in maintenance');
  });

  // Search Terms
  const [searchTerm, setSearchTerm] = useState('');

  // ---------------- MODALS STATE ----------------
  // 1. Sign Out Tool Modal
  const [selectedToolForSignOut, setSelectedToolForSignOut] = useState<ToolStockItem | null>(null);
  const [toolClockNumber, setToolClockNumber] = useState('');
  const [toolSignOutDate, setToolSignOutDate] = useState(new Date().toISOString().slice(0, 10));

  // 2. Add Tool Modal
  const [isAddToolOpen, setIsAddToolOpen] = useState(false);
  const [newToolDesc, setNewToolDesc] = useState('');
  const [newToolTypeSize, setNewToolTypeSize] = useState('');
  const [newToolQty, setNewToolQty] = useState(1);
  const [newToolDate, setNewToolDate] = useState(new Date().toISOString().slice(0, 10));

  // 3. Allocate Consumable Modal
  const [isAllocateConsumableOpen, setIsAllocateConsumableOpen] = useState(false);
  const [selectedConsumableId, setSelectedConsumableId] = useState('');
  const [allocClockNumber, setAllocClockNumber] = useState('');
  const [allocJobNumber, setAllocJobNumber] = useState('');
  const [allocMachineNumber, setAllocMachineNumber] = useState('');
  const [allocQty, setAllocQty] = useState(1);

  // 4. Add Consumable Item Modal
  const [isAddConsumableOpen, setIsAddConsumableOpen] = useState(false);
  const [newConsDesc, setNewConsDesc] = useState('');
  const [newConsTypeSize, setNewConsTypeSize] = useState('');
  const [newConsQty, setNewConsQty] = useState(10);
  const [newConsDate, setNewConsDate] = useState(new Date().toISOString().slice(0, 10));

  // 5. Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'tool' | 'consumable' | 'log';
    id: string;
    description: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load All Stores Data
  const loadStoresData = async () => {
    setLoading(true);
    try {
      const [fetchedTools, fetchedConsumables, fetchedLogs] = await Promise.all([
        getToolStockItems(),
        getConsumableItems(),
        getConsumableAllocationLogs()
      ]);
      setTools(fetchedTools);
      setConsumables(fetchedConsumables);
      setAllocationLogs(fetchedLogs);
    } catch (err) {
      console.error("Error loading stores data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStoresData();
  }, []);

  // ---------------- SCREEN 1: TOOL STOCK ACTIONS ----------------
  // Open modal to sign out a tool
  const handleOpenSignOutToolModal = (tool: ToolStockItem) => {
    setSelectedToolForSignOut(tool);
    setToolClockNumber('');
    setToolSignOutDate(new Date().toISOString().slice(0, 10));
  };

  // Submit Tool Sign Out
  const handleConfirmToolSignOut = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedToolForSignOut) return;

    if (!toolClockNumber.trim()) {
      alert("Please enter the Employee Clock Number.");
      return;
    }

    const updatedTool: ToolStockItem = {
      ...selectedToolForSignOut,
      status: 'Signed Out',
      employeeNumber: toolClockNumber.trim(),
      signOutDate: toolSignOutDate || new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString()
    };

    // Optimistic UI update
    setTools(prev => prev.map(t => t.id === updatedTool.id ? updatedTool : t));
    setSelectedToolForSignOut(null);

    try {
      await saveToolStockItem(updatedTool);
    } catch (err) {
      console.error("Error signing out tool:", err);
    }
  };

  // Toggle/Return Tool back to "In Stock"
  const handleReturnTool = async (tool: ToolStockItem) => {
    const today = new Date().toISOString().slice(0, 10);
    const updatedTool: ToolStockItem = {
      ...tool,
      status: 'In Stock',
      employeeNumber: 'Stores',
      signOutDate: '',
      dateReturn: today,
      updatedAt: new Date().toISOString()
    };

    // Optimistic UI update
    setTools(prev => prev.map(t => t.id === updatedTool.id ? updatedTool : t));

    try {
      await saveToolStockItem(updatedTool);
    } catch (err) {
      console.error("Error returning tool:", err);
    }
  };

  // Add new tool
  const handleAddTool = async (e: FormEvent) => {
    e.preventDefault();
    if (!newToolDesc.trim() || !newToolTypeSize.trim()) {
      alert("Please fill in Description and Type/Size");
      return;
    }

    const newTool: ToolStockItem = {
      id: `tool-${Date.now()}`,
      description: newToolDesc.trim(),
      typeSize: newToolTypeSize.trim(),
      quantity: Number(newToolQty) || 1,
      addedDate: newToolDate || new Date().toISOString().slice(0, 10),
      employeeNumber: 'Stores',
      signOutDate: '',
      dateReturn: '',
      status: 'In Stock',
      createdAt: new Date().toISOString()
    };

    setTools(prev => [newTool, ...prev]);
    setIsAddToolOpen(false);
    setNewToolDesc('');
    setNewToolTypeSize('');
    setNewToolQty(1);

    try {
      await saveToolStockItem(newTool);
    } catch (err) {
      console.error("Error adding tool:", err);
    }
  };

  const handleRequestDeleteTool = (tool: ToolStockItem) => {
    setDeleteTarget({
      type: 'tool',
      id: tool.id,
      description: `${tool.description} (${tool.typeSize})`
    });
  };

  const handleRequestDeleteConsumable = (consumable: ConsumableItem) => {
    setDeleteTarget({
      type: 'consumable',
      id: consumable.id,
      description: `${consumable.description} (${consumable.typeSize})`
    });
  };

  const handleRequestDeleteLog = (log: ConsumableAllocationLog) => {
    setDeleteTarget({
      type: 'log',
      id: log.id,
      description: `${log.consumableDescription} (${log.quantityAllocated} units signed out by Clock #${log.clockNumber})`
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const { type, id } = deleteTarget;

    try {
      if (type === 'tool') {
        setTools(prev => prev.filter(t => t.id !== id));
        await deleteToolStockItem(id);
      } else if (type === 'consumable') {
        setConsumables(prev => prev.filter(c => c.id !== id));
        await deleteConsumableItem(id);
      } else if (type === 'log') {
        setAllocationLogs(prev => prev.filter(l => l.id !== id));
        await deleteConsumableAllocationLog(id);
      }
    } catch (err) {
      console.error("Error executing delete:", err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ---------------- SCREEN 2 & 3: CONSUMABLE ALLOCATION ACTIONS ----------------
  const handleOpenAllocateModal = (consumableId?: string) => {
    if (consumables.length === 0) {
      alert("No consumables in stock. Please add consumables first.");
      return;
    }
    setSelectedConsumableId(consumableId || consumables[0]?.id || '');
    setAllocClockNumber('');
    setAllocJobNumber('General');
    setAllocMachineNumber('N/A');
    setAllocQty(1);
    setIsAllocateConsumableOpen(true);
  };

  const handleConfirmConsumableAllocation = async (e: FormEvent) => {
    e.preventDefault();
    const item = consumables.find(c => c.id === selectedConsumableId);
    if (!item) {
      alert("Please select a valid consumable item.");
      return;
    }

    if (!allocClockNumber.trim() || !allocJobNumber.trim()) {
      alert("Employee Clock Number and Job Number are required.");
      return;
    }

    const qtyToTake = Number(allocQty);
    if (isNaN(qtyToTake) || qtyToTake <= 0) {
      alert("Please enter a valid allocation quantity greater than 0.");
      return;
    }

    // 1. Deduct quantity from consumable item
    const updatedConsumable: ConsumableItem = {
      ...item,
      quantity: Math.max(0, item.quantity - qtyToTake),
      updatedAt: new Date().toISOString()
    };

    // 2. Create allocation log
    const newLog: ConsumableAllocationLog = {
      id: `alloc-${Date.now()}`,
      consumableId: item.id,
      consumableDescription: item.description,
      consumableTypeSize: item.typeSize,
      clockNumber: allocClockNumber.trim().toUpperCase(),
      jobNumber: allocJobNumber.trim().toUpperCase(),
      machineNumber: allocMachineNumber.trim() ? allocMachineNumber.trim().toUpperCase() : 'N/A',
      quantityAllocated: qtyToTake,
      allocatedAt: new Date().toISOString(),
      loggedBy: currentUser?.displayName || currentUser?.email || 'Stores Controller'
    };

    // Optimistic UI update
    setConsumables(prev => prev.map(c => c.id === updatedConsumable.id ? updatedConsumable : c));
    setAllocationLogs(prev => [newLog, ...prev]);
    setIsAllocateConsumableOpen(false);

    try {
      await Promise.all([
        saveConsumableItem(updatedConsumable),
        saveConsumableAllocationLog(newLog)
      ]);
    } catch (err) {
      console.error("Error saving consumable allocation:", err);
    }
  };

  const handleAddConsumable = async (e: FormEvent) => {
    e.preventDefault();
    if (!newConsDesc.trim() || !newConsTypeSize.trim()) {
      alert("Please fill in Description and Type/Size");
      return;
    }

    const newCons: ConsumableItem = {
      id: `cons-${Date.now()}`,
      description: newConsDesc.trim(),
      typeSize: newConsTypeSize.trim(),
      quantity: Number(newConsQty) || 1,
      addedDate: newConsDate || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    };

    setConsumables(prev => [newCons, ...prev]);
    setIsAddConsumableOpen(false);
    setNewConsDesc('');
    setNewConsTypeSize('');
    setNewConsQty(10);

    try {
      await saveConsumableItem(newCons);
    } catch (err) {
      console.error("Error adding consumable:", err);
    }
  };

  // Filtered lists for search
  const filteredTools = tools.filter(t => {
    const q = searchTerm.toLowerCase();
    return !q || 
      t.description.toLowerCase().includes(q) ||
      t.typeSize.toLowerCase().includes(q) ||
      t.employeeNumber.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q);
  });

  const filteredConsumables = consumables.filter(c => {
    const q = searchTerm.toLowerCase();
    return !q || 
      c.description.toLowerCase().includes(q) ||
      c.typeSize.toLowerCase().includes(q);
  });

  const filteredLogs = allocationLogs.filter(l => {
    const q = searchTerm.toLowerCase();
    return !q || 
      l.consumableDescription.toLowerCase().includes(q) ||
      l.consumableTypeSize.toLowerCase().includes(q) ||
      l.clockNumber.toLowerCase().includes(q) ||
      l.jobNumber.toLowerCase().includes(q) ||
      (l.machineNumber && l.machineNumber.toLowerCase().includes(q));
  });

  // KPI calculations
  const totalToolsCount = tools.length;
  const signedOutToolsCount = tools.filter(t => t.status === 'Signed Out').length;
  const inStockToolsCount = tools.filter(t => t.status === 'In Stock').length;

  const totalConsumableItems = consumables.length;
  const totalConsumablesQuantity = consumables.reduce((acc, c) => acc + c.quantity, 0);
  const totalAllocationsCount = allocationLogs.length;

  return (
    <div className="space-y-6 text-left" id="stores-dashboard-root">
      {/* Header Banner & Slider Switcher */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-display flex items-center justify-center gap-2">
          <Boxes className="w-6 h-6 text-blue-600" />
          Stores Inventory
        </h1>

        {/* STORES TOP SLIDER SWITCHER */}
        <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex flex-wrap sm:flex-nowrap items-center gap-1 shrink-0">
          {/* Screen 1: Tools Stock */}
          <button
            onClick={() => { setActiveStoresMode('tools'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeStoresMode === 'tools'
                ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-700/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Tools Stock</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              activeStoresMode === 'tools' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {totalToolsCount}
            </span>
          </button>

          {/* Screen 2: All Consumables */}
          <button
            onClick={() => { setActiveStoresMode('consumables'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeStoresMode === 'consumables'
                ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-700/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>All Consumables</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              activeStoresMode === 'consumables' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {totalConsumableItems}
            </span>
          </button>

          {/* Screen 3: Consumables Log */}
          <button
            onClick={() => { setActiveStoresMode('log'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeStoresMode === 'log'
                ? 'bg-slate-900 text-white shadow-xs ring-1 ring-slate-800/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-amber-400" />
            <span>Consumables Log</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              activeStoresMode === 'log' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {totalAllocationsCount}
            </span>
          </button>
        </div>
      </div>

      {/* SEARCH AND ACTION BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={
              activeStoresMode === 'tools' 
                ? "Search tools by description, clock #, status..." 
                : activeStoresMode === 'consumables'
                ? "Search consumables..."
                : "Search logs by clock #, job #, machine #..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={loadStoresData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Stores Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {activeStoresMode === 'tools' && (
            <button
              onClick={() => setIsAddToolOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Tool Stock</span>
            </button>
          )}

          {activeStoresMode === 'consumables' && (
            <button
              onClick={() => setIsAddConsumableOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Consumable</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SCREEN 1: TOOLS STOCK TABLE                                            */}
      {/* ===================================================================== */}
      {activeStoresMode === 'tools' && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tool Items</p>
                <p className="text-lg font-black text-slate-900">{totalToolsCount} Tools</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Stock (Stores)</p>
                <p className="text-lg font-black text-emerald-700">{inStockToolsCount} Items</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Currently Signed Out</p>
                <p className="text-lg font-black text-blue-700">{signedOutToolsCount} Items</p>
              </div>
            </div>
          </div>

          {/* Tools Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 pl-5">Description</th>
                    <th className="p-3.5">Type/Size</th>
                    <th className="p-3.5 text-center">Quantity</th>
                    <th className="p-3.5">Added Date</th>
                    <th className="p-3.5">Employee Number</th>
                    <th className="p-3.5">Sign Out Date</th>
                    <th className="p-3.5">Date Return</th>
                    <th className="p-3.5 text-center">Stock Status / Action</th>
                    <th className="p-3.5 pr-5 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {filteredTools.length > 0 ? (
                    filteredTools.map((tool) => {
                      const isInStock = tool.status === 'In Stock';
                      return (
                        <tr key={tool.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 pl-5 font-bold text-slate-900">
                            {tool.description}
                          </td>
                          <td className="p-3.5 text-slate-600 font-semibold">
                            {tool.typeSize}
                          </td>
                          <td className="p-3.5 text-center font-bold text-slate-800">
                            {tool.quantity}
                          </td>
                          <td className="p-3.5 text-slate-500 font-mono">
                            {tool.addedDate || 'N/A'}
                          </td>
                          <td className="p-3.5">
                            {isInStock ? (
                              <span className="font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                Stores
                              </span>
                            ) : (
                              <span className="font-mono font-extrabold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1 w-fit">
                                <HardHat className="w-3.5 h-3.5 text-blue-600" />
                                {tool.employeeNumber}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-slate-700">
                            {tool.signOutDate ? (
                              <span className="text-blue-700 font-bold">{tool.signOutDate}</span>
                            ) : (
                              <span className="text-slate-300 italic">—</span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-slate-700">
                            {tool.dateReturn ? (
                              <span className="text-slate-800 font-bold">{tool.dateReturn}</span>
                            ) : (
                              <span className="text-slate-300 italic">—</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {isInStock ? (
                              /* GREEN IN STOCK BUTTON -> Clicking opens Sign Out Modal */
                              <button
                                onClick={() => handleOpenSignOutToolModal(tool)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 mx-auto hover:scale-102"
                                title="Click to Sign Out Tool"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>In Stock (Sign Out)</span>
                              </button>
                            ) : (
                              /* BLUE SIGNED OUT BUTTON -> Clicking slides/toggles back to In Stock */
                              <button
                                onClick={() => handleReturnTool(tool)}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 mx-auto hover:scale-102"
                                title="Click to Return Tool to Stores"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>Signed Out (Return Tool)</span>
                              </button>
                            )}
                          </td>
                          <td className="p-3.5 pr-5 text-right">
                            <button
                              onClick={() => handleRequestDeleteTool(tool)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Tool Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400 space-y-2">
                        <Wrench className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="font-bold text-slate-700 text-xs">No Tool Stock Items Found</p>
                        <p className="text-xs text-slate-500">Click "Add Tool Stock" to create new tool items.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN 2: ALL CONSUMABLES LIST                                        */}
      {/* ===================================================================== */}
      {activeStoresMode === 'consumables' && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-5 rounded-2xl shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Consumables Inventory & Allocation</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Sign out workshop consumables directly from any line item in the table below.
                </p>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unique Consumables</p>
                <p className="text-lg font-black text-slate-900">{totalConsumableItems} Line Items</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Quantity in Stores</p>
                <p className="text-lg font-black text-blue-800">{totalConsumablesQuantity} Units</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Allocations Logged</p>
                <p className="text-lg font-black text-amber-800">{totalAllocationsCount} Sign-outs</p>
              </div>
            </div>
          </div>

          {/* Consumables Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 pl-5">Description</th>
                    <th className="p-3.5">Type / Size</th>
                    <th className="p-3.5 text-center">Available Quantity</th>
                    <th className="p-3.5">Added Date</th>
                    <th className="p-3.5 text-center">Action</th>
                    <th className="p-3.5 pr-5 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {filteredConsumables.length > 0 ? (
                    filteredConsumables.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 pl-5 font-bold text-slate-900">
                          {c.description}
                        </td>
                        <td className="p-3.5 text-slate-600 font-semibold">
                          {c.typeSize}
                        </td>
                        <td className="p-3.5 text-center font-black text-sm text-slate-900">
                          <span className={`px-2.5 py-1 rounded-lg border ${
                            c.quantity > 10 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : c.quantity > 0 
                              ? 'bg-amber-50 text-amber-800 border-amber-200' 
                              : 'bg-red-50 text-red-800 border-red-200'
                          }`}>
                            {c.quantity} Units
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 font-mono">
                          {c.addedDate || 'N/A'}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleOpenAllocateModal(c.id)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 mx-auto"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            <span>Sign Out Consumable</span>
                          </button>
                        </td>
                        <td className="p-3.5 pr-5 text-right">
                          <button
                            onClick={() => handleRequestDeleteConsumable(c)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Consumable Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 space-y-2">
                        <Package className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="font-bold text-slate-700 text-xs">No Consumable Items Found</p>
                        <p className="text-xs text-slate-500">Click "Add Consumable" to register new workshop supplies.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN 3: CONSUMABLES LOG                                             */}
      {/* ===================================================================== */}
      {activeStoresMode === 'log' && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-500" />
                Consumables Log
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of all consumable items signed out and assigned to employees, job cards, and machines.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 pl-5">Date & Time</th>
                    <th className="p-3.5">Consumable Item</th>
                    <th className="p-3.5">Type / Size</th>
                    <th className="p-3.5 text-center">Qty Taken</th>
                    <th className="p-3.5">Employee Clock #</th>
                    <th className="p-3.5">Job Number</th>
                    <th className="p-3.5">Machine Number</th>
                    <th className="p-3.5">Logged By</th>
                    <th className="p-3.5 pr-5 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 pl-5 font-mono text-slate-600">
                          {new Date(log.allocatedAt).toLocaleString()}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">
                          {log.consumableDescription}
                        </td>
                        <td className="p-3.5 text-slate-600 font-semibold">
                          {log.consumableTypeSize}
                        </td>
                        <td className="p-3.5 text-center font-black text-amber-800">
                          <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200">
                            {log.quantityAllocated} Units
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono font-extrabold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            {log.clockNumber}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            {log.jobNumber}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono text-slate-600">
                            {log.machineNumber || 'N/A'}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 font-medium">
                          {log.loggedBy || 'Stores'}
                        </td>
                        <td className="p-3.5 pr-5 text-right">
                          <button
                            onClick={() => handleRequestDeleteLog(log)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Allocation Log Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400 space-y-2">
                        <ClipboardList className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="font-bold text-slate-700 text-xs">No Consumable Allocations Logged Yet</p>
                        <p className="text-xs text-slate-500">Sign out consumables from Screen 2 to create log entries.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: SIGN OUT TOOL POPUP                                           */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {selectedToolForSignOut && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Sign Out Tool Stock</h3>
                    <p className="text-xs text-slate-500">Enter employee clock number and sign-out date</p>
                  </div>
                </div>
                <button onClick={() => setSelectedToolForSignOut(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs">
                <p className="font-bold text-slate-800">{selectedToolForSignOut.description}</p>
                <p className="text-slate-500 font-medium">Type / Size: {selectedToolForSignOut.typeSize}</p>
              </div>

              <form onSubmit={handleConfirmToolSignOut} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employee Clock Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CLK-104 or 88412"
                    value={toolClockNumber}
                    onChange={(e) => setToolClockNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sign Out Date *</label>
                  <input
                    type="date"
                    required
                    value={toolSignOutDate}
                    onChange={(e) => setToolSignOutDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedToolForSignOut(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Confirm Sign Out</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* MODAL 2: ADD TOOL STOCK POPUP                                          */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isAddToolOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Add New Tool Stock</h3>
                    <p className="text-xs text-slate-500">Register new equipment in stores</p>
                  </div>
                </div>
                <button onClick={() => setIsAddToolOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddTool} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tool Description *</label>
                  <input
                    type="text"
                    required
                    placeholder='e.g. Pneumatic Impact Wrench 1/2"'
                    value={newToolDesc}
                    onChange={(e) => setNewToolDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Type / Size *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1/2 Sq Dr"
                      value={newToolTypeSize}
                      onChange={(e) => setNewToolTypeSize(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newToolQty}
                      onChange={(e) => setNewToolQty(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Added Date *</label>
                  <input
                    type="date"
                    required
                    value={newToolDate}
                    onChange={(e) => setNewToolDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddToolOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Save Tool Stock
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* MODAL 3: ALLOCATE CONSUMABLE POPUP                                     */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isAllocateConsumableOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Sign Out / Allocate Consumable</h3>
                    <p className="text-xs text-slate-500">Record consumable distribution for job, employee & machine</p>
                  </div>
                </div>
                <button onClick={() => setIsAllocateConsumableOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmConsumableAllocation} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Consumable Item *</label>
                  <select
                    required
                    value={selectedConsumableId}
                    onChange={(e) => setSelectedConsumableId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                  >
                    {consumables.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.description} ({c.typeSize}) — Stock: {c.quantity} available
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Employee Clock Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CLK-208"
                      value={allocClockNumber}
                      onChange={(e) => setAllocClockNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Job Number *</label>
                    <select
                      required
                      value={allocJobNumber}
                      onChange={(e) => setAllocJobNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                    >
                      <option value="General">General (No Specific Job)</option>
                      {activeJobsWithJobCards.map((j) => {
                        const jobNo = j.jobCardDetails!.jobCardNumber;
                        return (
                          <option key={j.id} value={jobNo}>
                            {jobNo} — {j.customerName} ({j.componentType})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Machine Number</label>
                    <select
                      value={allocMachineNumber}
                      onChange={(e) => setAllocMachineNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                    >
                      <option value="N/A">N/A (No Machine Linked)</option>
                      {operatingMachines.map((m) => {
                        const machineNo = m.serialNumber || m.machineName || m.id;
                        return (
                          <option key={m.id} value={machineNo}>
                            {machineNo} — {m.machineName} {m.location ? `(${m.location})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Quantity Taking *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={allocQty}
                      onChange={(e) => setAllocQty(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-black text-amber-800 text-sm focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAllocateConsumableOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>Confirm Allocation Log</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* MODAL 4: ADD NEW CONSUMABLE ITEM                                       */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isAddConsumableOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Add Consumable Item</h3>
                    <p className="text-xs text-slate-500">Add shop supplies or consumables to stores</p>
                  </div>
                </div>
                <button onClick={() => setIsAddConsumableOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddConsumable} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ultra Thin Grinding Discs"
                    value={newConsDesc}
                    onChange={(e) => setNewConsDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Type / Size *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 115mm x 1.0mm"
                      value={newConsTypeSize}
                      onChange={(e) => setNewConsTypeSize(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Initial Quantity *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newConsQty}
                      onChange={(e) => setNewConsQty(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Added Date *</label>
                  <input
                    type="date"
                    required
                    value={newConsDate}
                    onChange={(e) => setNewConsDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddConsumableOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Save Consumable
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL 5: DELETE CONFIRMATION MODAL */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Confirm Deletion</h3>
                  <p className="text-xs text-slate-500">
                    {deleteTarget.type === 'tool' ? 'Remove Tool Stock item' : deleteTarget.type === 'consumable' ? 'Remove Consumable item' : 'Remove Allocation Log entry'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700">
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Target Item:</p>
                <p className="font-extrabold text-slate-900">{deleteTarget.description}</p>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to permanently delete this item? It will be removed from database persistence immediately.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>{isDeleting ? "Deleting..." : "Delete Permanently"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
