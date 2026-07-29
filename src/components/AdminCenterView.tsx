import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Customer, 
  ComponentMatrix, 
  CustomColumn, 
  UserProfile, 
  UserPermissions,
  ComponentStep,
  JobCardFormatConfig,
  DEFAULT_JOB_CARD_FORMAT,
  JobCardSectionConfig,
  JobCardFormatLabels 
} from '../types';
import JobCardDocument from './JobCardDocument';
import { 
  Shield, 
  UserPlus, 
  Key, 
  Settings, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Save, 
  Users, 
  Briefcase, 
  Grid,
  CheckCircle,
  XCircle,
  HelpCircle,
  DollarSign,
  AlertCircle,
  Layout,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Palette,
  RotateCcw,
  Sparkles,
  Type,
  Image as ImageIcon,
  Upload,
  Download,
  Move,
  Sliders,
  Square,
  Search,
  X
} from 'lucide-react';

interface AdminCenterViewProps {
  users: UserProfile[];
  customers: Customer[];
  componentsList: ComponentMatrix[];
  customColumns: CustomColumn[];
  jobCardFormat?: JobCardFormatConfig;
  onUpdateUserPermissions: (uid: string, permissions: UserPermissions) => Promise<void>;
  onSaveCustomColumns: (columns: CustomColumn[]) => Promise<void>;
  onSaveCustomer: (customer: Customer) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onSaveComponentMatrix: (matrix: ComponentMatrix) => Promise<void>;
  onDeleteComponentMatrix: (id: string) => Promise<void>;
  onSaveJobCardFormat?: (config: JobCardFormatConfig) => Promise<void>;
}

export default function AdminCenterView({
  users,
  customers,
  componentsList,
  customColumns,
  jobCardFormat,
  onUpdateUserPermissions,
  onSaveCustomColumns,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveComponentMatrix,
  onDeleteComponentMatrix,
  onSaveJobCardFormat
}: AdminCenterViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'columns' | 'customers' | 'pricing' | 'jobCard'>('users');

  // ========================================================
  // 1. STATE FOR USER ROLES & PERMISSIONS
  // ========================================================
  const [editingUserUid, setEditingUserUid] = useState<string | null>(null);
  const [tempPermissions, setTempPermissions] = useState<UserPermissions | null>(null);

  const startEditPermissions = (user: UserProfile) => {
    setEditingUserUid(user.uid);
    setTempPermissions({ ...user.permissions });
  };

  const handlePermissionToggle = (key: keyof UserPermissions) => {
    if (!tempPermissions) return;
    setTempPermissions(prev => ({
      ...prev!,
      [key]: !prev![key]
    }));
  };

  const savePermissions = async (uid: string) => {
    if (!tempPermissions) return;
    try {
      await onUpdateUserPermissions(uid, tempPermissions);
      setEditingUserUid(null);
      setTempPermissions(null);
      alert("User permissions successfully updated.");
    } catch (e) {
      alert("Error saving permissions.");
    }
  };

  // ========================================================
  // 2. STATE FOR DYNAMIC CUSTOM COLUMNS
  // ========================================================
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'date' | 'boolean'>('text');

  const addCustomColumn = async () => {
    if (!newColLabel.trim()) return;
    const colId = newColLabel.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    
    if (customColumns.some(c => c.id === colId)) {
      alert("A column with this label or ID already exists.");
      return;
    }

    const updatedCols: CustomColumn[] = [
      ...customColumns,
      { id: colId, label: newColLabel.trim(), type: newColType }
    ];

    await onSaveCustomColumns(updatedCols);
    setNewColLabel('');
    alert("Dynamic column added successfully.");
  };

  const deleteCustomColumn = async (colId: string) => {
    const updatedCols = customColumns.filter(c => c.id !== colId);
    await onSaveCustomColumns(updatedCols);
    alert("Column removed.");
  };

  // ========================================================
  // 3. STATE FOR CUSTOMER MANAGEMENT
  // ========================================================
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custName, setCustName] = useState('');
  const [custContact, setCustContact] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');

  const handleEditCustomer = (cust: Customer | null) => {
    setEditingCustomer(cust);
    if (cust) {
      setCustName(cust.name);
      setCustContact(cust.contactPerson || '');
      setCustEmail(cust.email || '');
      setCustPhone(cust.phone || '');
      setCustAddress(cust.address || '');
    } else {
      setCustName('');
      setCustContact('');
      setCustEmail('');
      setCustPhone('');
      setCustAddress('');
    }
  };

  const handleSaveCustomerForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;

    const targetId = editingCustomer ? editingCustomer.id : `cust-${Date.now()}`;
    const customerObj: Customer = {
      id: targetId,
      name: custName.trim(),
      contactPerson: custContact.trim() || undefined,
      email: custEmail.trim() || undefined,
      phone: custPhone.trim() || undefined,
      address: custAddress.trim() || undefined,
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString()
    };

    await onSaveCustomer(customerObj);
    handleEditCustomer(null);
    alert("Customer saved successfully.");
  };

  const handleDeleteCustomerClick = async (id: string) => {
    await onDeleteCustomer(id);
    alert("Customer deleted.");
  };

  const customerFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleCustomerExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        alert("The uploaded workbook appears to be empty.");
        return;
      }
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!jsonData || jsonData.length === 0) {
        alert("No valid customer rows found in the sheet.");
        return;
      }

      let count = 0;
      for (const row of jsonData) {
        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              if (rowKey.trim().toLowerCase() === k.toLowerCase()) {
                return String(row[rowKey] || '').trim();
              }
            }
          }
          return '';
        };

        const name = getVal('Company Name', 'CompanyName', 'Company', 'Customer Name', 'Customer', 'Name');
        const contactPerson = getVal('Contact Person', 'ContactPerson', 'Contact', 'Person');
        const email = getVal('Email', 'Email Address', 'EmailAddress', 'Mail');
        const phone = getVal('Phone Number', 'PhoneNumber', 'Phone', 'Tel', 'Telephone', 'Cell');
        const address = getVal('Address', 'Physical Address', 'PhysicalAddress', 'Location');

        if (name) {
          const newCust: Customer = {
            id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name,
            contactPerson: contactPerson || undefined,
            email: email || undefined,
            phone: phone || undefined,
            address: address || undefined,
            createdAt: new Date().toISOString()
          };
          await onSaveCustomer(newCust);
          count++;
        }
      }

      if (count > 0) {
        alert(`Successfully uploaded ${count} customer(s).`);
      } else {
        alert("No customers were imported. Please check that the sheet has a 'Company Name' column header.");
      }
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      alert("Failed to parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file.");
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Search states for tables
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [columnSearchQuery, setColumnSearchQuery] = useState('');

  // ========================================================
  // 4. STATE FOR COMPONENT PRICING MATRICES (VERY CRITICAL!)
  // ========================================================
  const [selectedCompMatrixId, setSelectedCompMatrixId] = useState<string>(componentsList[0]?.id || '');
  const [newComponentName, setNewComponentName] = useState('');
  
  // Dynamic cells edit state inside the pricing sheet
  const activeMatrix = componentsList.find(c => c.id === selectedCompMatrixId);
  const [newModelColumnName, setNewModelColumnName] = useState('');
  const [newStepRowName, setNewStepRowName] = useState('');
  const [addEntryType, setAddEntryType] = useState<'step' | 'model'>('step');
  const [addEntryValue, setAddEntryValue] = useState('');

  // Unified add entry (Step or Model) handler
  const handleUnifiedAddEntry = async () => {
    if (!addEntryValue.trim() || !activeMatrix) return;
    const cleanValue = addEntryValue.trim();

    if (addEntryType === 'model') {
      if (activeMatrix.models.some(m => m.toLowerCase() === cleanValue.toLowerCase())) {
        alert("This model already exists in the matrix.");
        return;
      }
      const updatedModels = [...activeMatrix.models, cleanValue];
      const updatedSteps = activeMatrix.steps.map(step => ({
        ...step,
        prices: {
          ...step.prices,
          [cleanValue]: 0
        }
      }));
      const updatedMatrix: ComponentMatrix = {
        ...activeMatrix,
        models: updatedModels,
        steps: updatedSteps,
        updatedAt: new Date().toISOString()
      };
      await onSaveComponentMatrix(updatedMatrix);
      setAddEntryValue('');
      alert(`Model '${cleanValue}' added.`);
    } else {
      if (activeMatrix.steps.some(s => s.stepName.toLowerCase() === cleanValue.toLowerCase())) {
        alert("This step row already exists.");
        return;
      }
      const initialPrices: { [model: string]: number } = {};
      activeMatrix.models.forEach(model => {
        initialPrices[model] = 0;
      });
      const newStepObj: ComponentStep = {
        stepName: cleanValue,
        prices: initialPrices
      };
      const updatedMatrix: ComponentMatrix = {
        ...activeMatrix,
        steps: [...activeMatrix.steps, newStepObj],
        updatedAt: new Date().toISOString()
      };
      await onSaveComponentMatrix(updatedMatrix);
      setAddEntryValue('');
      alert(`Step row '${cleanValue}' added.`);
    }
  };

  // Handle price edits in cell matrix
  const handleMatrixCellPriceChange = async (stepName: string, modelName: string, value: string) => {
    if (!activeMatrix) return;
    const priceNum = value === '' ? 0 : Number(value);

    const updatedSteps = activeMatrix.steps.map(step => {
      if (step.stepName === stepName) {
        return {
          ...step,
          prices: {
            ...step.prices,
            [modelName]: priceNum
          }
        };
      }
      return step;
    });

    const updatedMatrix: ComponentMatrix = {
      ...activeMatrix,
      steps: updatedSteps,
      updatedAt: new Date().toISOString()
    };

    await onSaveComponentMatrix(updatedMatrix);
  };

  // Add a new model column to this matrix
  const handleAddNewModelColumn = async () => {
    if (!activeMatrix || !newModelColumnName.trim()) return;
    const modelClean = newModelColumnName.trim();

    if (activeMatrix.models.includes(modelClean)) {
      alert("This model already exists as a column.");
      return;
    }

    // Add model to the model columns list
    const updatedModels = [...activeMatrix.models, modelClean];
    
    // Add price cell (initialized to 0) in each step for this model
    const updatedSteps = activeMatrix.steps.map(step => ({
      ...step,
      prices: {
        ...step.prices,
        [modelClean]: 0
      }
    }));

    const updatedMatrix: ComponentMatrix = {
      ...activeMatrix,
      models: updatedModels,
      steps: updatedSteps,
      updatedAt: new Date().toISOString()
    };

    await onSaveComponentMatrix(updatedMatrix);
    setNewModelColumnName('');
    alert(`Model column '${modelClean}' added. You can now enter pricing below.`);
  };

  // Add a new step row to this matrix
  const handleAddNewStepRow = async () => {
    if (!activeMatrix || !newStepRowName.trim()) return;
    const stepClean = newStepRowName.trim();

    if (activeMatrix.steps.some(s => s.stepName.toLowerCase() === stepClean.toLowerCase())) {
      alert("This step row already exists.");
      return;
    }

    // Prepare default prices of 0 for each model column
    const initialPrices: { [model: string]: number } = {};
    activeMatrix.models.forEach(model => {
      initialPrices[model] = 0;
    });

    const newStepObj: ComponentStep = {
      stepName: stepClean,
      prices: initialPrices
    };

    const updatedMatrix: ComponentMatrix = {
      ...activeMatrix,
      steps: [...activeMatrix.steps, newStepObj],
      updatedAt: new Date().toISOString()
    };

    await onSaveComponentMatrix(updatedMatrix);
    setNewStepRowName('');
    alert(`Step row '${stepClean}' added. Enter step pricing per model column.`);
  };

  // Add brand new component matrix table
  const handleCreateNewComponentTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComponentName.trim()) return;
    const compId = newComponentName.trim();

    if (componentsList.some(c => c.id.toLowerCase() === compId.toLowerCase())) {
      alert("A pricing table with this component name already exists.");
      return;
    }

    const newMatrix: ComponentMatrix = {
      id: compId,
      name: compId,
      models: ['Default Model'],
      steps: [
        {
          stepName: 'Sandblasting',
          prices: { 'Default Model': 150 }
        }
      ],
      updatedAt: new Date().toISOString()
    };

    await onSaveComponentMatrix(newMatrix);
    setSelectedCompMatrixId(compId);
    setNewComponentName('');
    alert(`New pricing table '${compId}' created!`);
  };

  const handleDeleteComponentTable = async (id: string) => {
    await onDeleteComponentMatrix(id);
    setSelectedCompMatrixId(componentsList[0]?.id || '');
    alert("Pricing table deleted.");
  };

  // Excel File Upload for Pricing Matrix
  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, createAsNew = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          alert("No sheets found in the Excel workbook.");
          return;
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawData || rawData.length < 2) {
          alert("The Excel sheet must contain at least a header row (for models) and one data row (for steps).");
          return;
        }

        // Row 0 is the header:
        // Col 0: Step Label (e.g. "Steps")
        // Col 1..N: Model names
        const headerRow = rawData[0] || [];
        const extractedModels: string[] = [];

        for (let col = 1; col < headerRow.length; col++) {
          const colVal = headerRow[col];
          if (colVal !== undefined && colVal !== null && String(colVal).trim() !== '') {
            extractedModels.push(String(colVal).trim());
          }
        }

        if (extractedModels.length === 0) {
          alert("No model names found in the first row starting from Column 2.");
          return;
        }

        // Row 1..N: Steps & prices
        const extractedSteps: ComponentStep[] = [];

        for (let rowIdx = 1; rowIdx < rawData.length; rowIdx++) {
          const row = rawData[rowIdx];
          if (!row || row.length === 0) continue;

          const rawStepName = row[0];
          if (rawStepName === undefined || rawStepName === null || String(rawStepName).trim() === '') {
            continue; // Skip empty rows
          }

          const stepName = String(rawStepName).trim();
          const prices: { [modelName: string]: number } = {};

          extractedModels.forEach((modelName, modelIdx) => {
            const colIdx = modelIdx + 1;
            const rawCellVal = row[colIdx];
            let numVal = 0;

            if (typeof rawCellVal === 'number') {
              numVal = isNaN(rawCellVal) ? 0 : rawCellVal;
            } else if (rawCellVal) {
              const cleanStr = String(rawCellVal).replace(/[^0-9.-]+/g, '');
              numVal = parseFloat(cleanStr) || 0;
            }

            prices[modelName] = numVal;
          });

          extractedSteps.push({
            stepName,
            prices
          });
        }

        if (extractedSteps.length === 0) {
          alert("No valid step rows found in the uploaded file.");
          return;
        }

        // Determine target matrix ID and name
        const fileNameNoExt = file.name.replace(/\.[^/.]+$/, "").trim();
        let targetId = activeMatrix && !createAsNew ? activeMatrix.id : (newComponentName.trim() || fileNameNoExt || `Matrix-${Date.now()}`);
        let targetName = activeMatrix && !createAsNew ? activeMatrix.name : (newComponentName.trim() || fileNameNoExt || "Uploaded Pricing Matrix");

        if (createAsNew && componentsList.some(c => c.id.toLowerCase() === targetId.toLowerCase())) {
          targetId = `${targetId}-${Date.now()}`;
        }

        const newMatrixObj: ComponentMatrix = {
          id: targetId,
          name: targetName,
          models: extractedModels,
          steps: extractedSteps,
          updatedAt: new Date().toISOString()
        };

        await onSaveComponentMatrix(newMatrixObj);
        setSelectedCompMatrixId(targetId);
        setNewComponentName('');
        alert(`Successfully imported Excel Pricing Table!\n\n• Table Name: ${targetName}\n• Models (Columns): ${extractedModels.length}\n• Steps (Rows): ${extractedSteps.length}`);
      } catch (err) {
        console.error("Error reading Excel file:", err);
        alert("Error parsing Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const downloadSampleExcelTemplate = () => {
    const sampleData = [
      ["Steps / Repair Operations", "CAT 320", "Komatsu PC200", "Hitachi ZX200", "Liebherr R924"],
      ["1. Disassembly & Wash", 1500, 1600, 1550, 1800],
      ["2. QC & Failure Analysis", 800, 850, 800, 950],
      ["3. Sandblasting & Pre-Clean", 1200, 1250, 1200, 1400],
      ["4. Cylindrical Honing", 2500, 2700, 2600, 3100],
      ["5. Hard Chrome Plating", 4500, 4800, 4600, 5200],
      ["6. Seal Kit Installation & Reassembly", 1800, 1950, 1850, 2100],
      ["7. Pressure Testing & Hard Stamp", 950, 1000, 950, 1100]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pricing Matrix");
    XLSX.writeFile(workbook, "Pricing_Matrix_Template.xlsx");
  };

  // ========================================================
  // 5. STATE FOR JOB CARD FORMAT EDITOR
  // ========================================================
  const [formatConfig, setFormatConfig] = useState<JobCardFormatConfig>(() => {
    return jobCardFormat || DEFAULT_JOB_CARD_FORMAT;
  });
  const [formatSaving, setFormatSaving] = useState(false);
  const [formatSuccessMsg, setFormatSuccessMsg] = useState(false);
  const [previewPage, setPreviewPage] = useState<'page1' | 'page2'>('page1');

  useEffect(() => {
    if (jobCardFormat) {
      setFormatConfig(jobCardFormat);
    }
  }, [jobCardFormat]);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setFormatConfig(prev => ({ ...prev, logoUrl: evt.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormatConfig(prev => ({ ...prev, logoUrl: undefined }));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...formatConfig.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;

    newSections.forEach((s, idx) => {
      s.order = idx + 1;
    });

    setFormatConfig(prev => ({
      ...prev,
      sections: newSections
    }));
  };

  const toggleSectionEnabled = (id: string) => {
    setFormatConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    }));
  };

  const updateSectionCustomTitle = (id: string, customTitle: string) => {
    setFormatConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? { ...s, customTitle } : s)
    }));
  };

  const updateLabel = (key: keyof JobCardFormatLabels, value: string) => {
    setFormatConfig(prev => ({
      ...prev,
      labels: {
        ...prev.labels,
        [key]: value
      }
    }));
  };

  const handleSaveFormat = async () => {
    if (!onSaveJobCardFormat) return;
    setFormatSaving(true);
    try {
      await onSaveJobCardFormat(formatConfig);
      setFormatSuccessMsg(true);
      setTimeout(() => setFormatSuccessMsg(false), 3000);
    } catch (e) {
      alert("Error saving Job Card format configuration.");
    } finally {
      setFormatSaving(false);
    }
  };

  const handleResetFormat = () => {
    setFormatConfig(DEFAULT_JOB_CARD_FORMAT);
  };

  return (
    <div className="space-y-6" id="admin-center-view-root">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 font-display flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-700" />
            ERP Workshop Administration Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage user permissions, configure dynamic receiving columns, update customer accounts, and customize repair pricing spreadsheets.
          </p>
        </div>
      </div>

      {/* Admin Subtabs Bar */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-xs rounded-t-xl tracking-tight transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'users'
              ? 'border-blue-600 text-blue-600 bg-blue-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <Users className="w-4 h-4" />
          User Roles & Access Control
        </button>
        <button
          onClick={() => setActiveSubTab('pricing')}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-xs rounded-t-xl tracking-tight transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'pricing'
              ? 'border-blue-600 text-blue-600 bg-blue-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Component Pricing Matrices (Excel Style)
        </button>
        <button
          onClick={() => setActiveSubTab('customers')}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-xs rounded-t-xl tracking-tight transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'customers'
              ? 'border-blue-600 text-blue-600 bg-blue-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Customers Directory
        </button>
        <button
          onClick={() => setActiveSubTab('jobCard')}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-xs rounded-t-xl tracking-tight transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'jobCard'
              ? 'border-blue-600 text-blue-600 bg-blue-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <Layout className="w-4 h-4" />
          Job Card Format Editor
        </button>
      </div>

      {/* ========================================================
          TAB 1: USER PERMISSIONS
          ======================================================== */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
          <div className="p-5 border-b border-slate-200 bg-slate-50/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-700">Workshop Users & Feature Clearances</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Toggle booleans to restrict actions. E.g. Unchecking 'Pre-Quoting' bars users from editing price lines.</p>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 shadow-2xs shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search user or email..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="text-xs bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden w-40 font-medium text-slate-700 placeholder:text-slate-400"
              />
              {userSearchQuery && (
                <button
                  type="button"
                  onClick={() => setUserSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-slate-200">
                  <th className="p-4 pl-6">Operator Account</th>
                  <th className="p-4 text-center">Job Recv</th>
                  <th className="p-4 text-center">QC / Inspect</th>
                  <th className="p-4 text-center">Pre-Quote</th>
                  <th className="p-4 text-center">Job Cards</th>
                  <th className="p-4 text-center">Close Job</th>
                  <th className="p-4 text-center">System Admin</th>
                  <th className="p-4 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.filter(u => {
                  if (!userSearchQuery.trim()) return true;
                  const q = userSearchQuery.toLowerCase();
                  return (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                }).map((user) => {
                  const isEditing = editingUserUid === user.uid;
                  const perms = isEditing ? tempPermissions! : user.permissions;

                  return (
                    <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <p className="font-semibold text-slate-800">{user.displayName || 'Unnamed Operator'}</p>
                        <p className="text-slate-400 font-mono mt-0.5">{user.email}</p>
                      </td>

                      {/* Recv */}
                      <td className="p-4 text-center">
                        <input 
                          type="checkbox" 
                          disabled={!isEditing}
                          checked={perms.canReceive}
                          onChange={() => handlePermissionToggle('canReceive')}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300 disabled:opacity-75"
                        />
                      </td>

                      {/* Inspect */}
                      <td className="p-4 text-center">
                        <input 
                          type="checkbox" 
                          disabled={!isEditing}
                          checked={perms.canInspect}
                          onChange={() => handlePermissionToggle('canInspect')}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300 disabled:opacity-75"
                        />
                      </td>

                      {/* Quote */}
                      <td className="p-4 text-center">
                        <input 
                          type="checkbox" 
                          disabled={!isEditing}
                          checked={perms.canQuote}
                          onChange={() => handlePermissionToggle('canQuote')}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300 disabled:opacity-75"
                        />
                      </td>

                      {/* Cards */}
                      <td className="p-4 text-center">
                        <input 
                          type="checkbox" 
                          disabled={!isEditing}
                          checked={perms.canCreateJobCard}
                          onChange={() => handlePermissionToggle('canCreateJobCard')}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300 disabled:opacity-75"
                        />
                      </td>

                      {/* Close */}
                      <td className="p-4 text-center">
                        <input 
                          type="checkbox" 
                          disabled={!isEditing}
                          checked={perms.canClose}
                          onChange={() => handlePermissionToggle('canClose')}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300 disabled:opacity-75"
                        />
                      </td>

                      {/* Admin */}
                      <td className="p-4 text-center">
                        <input 
                          type="checkbox" 
                          disabled={!isEditing}
                          checked={perms.isAdmin}
                          onChange={() => handlePermissionToggle('isAdmin')}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300 disabled:opacity-75"
                        />
                      </td>

                      {/* Action */}
                      <td className="p-4 text-right pr-6">
                        {isEditing ? (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => savePermissions(user.uid)}
                              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold px-2.5 py-1 rounded-md"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setEditingUserUid(null); setTempPermissions(null); }}
                              className="bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 font-semibold px-2.5 py-1 rounded-md"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditPermissions(user)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 font-semibold px-2.5 py-1 rounded-md transition-colors"
                          >
                            Edit Clearance
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: COMPONENT PRICING MATRIX SPREADSHEETS (EXCEL STYLE)
          ======================================================== */}
      {activeSubTab === 'pricing' && (
        <div className="space-y-6 text-left">
          {/* Header Row: Selecting Pricing Table & Creating Brand New Component */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Component matrix selector */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Component Matrix Table</h3>
              <select
                value={selectedCompMatrixId}
                onChange={(e) => setSelectedCompMatrixId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="">-- Select Table --</option>
                {componentsList.map(comp => (
                  <option key={comp.id} value={comp.id}>{comp.name} Table</option>
                ))}
              </select>
              {activeMatrix && (
                <button
                  type="button"
                  onClick={() => handleDeleteComponentTable(activeMatrix.id)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent rounded-lg px-2.5 py-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Entire Matrix Table
                </button>
              )}
            </div>

            {/* Create brand new component type */}
            <form onSubmit={handleCreateNewComponentTable} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Create New Component Pricing Table</h3>
                <button
                  type="button"
                  onClick={downloadSampleExcelTemplate}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3 h-3 text-emerald-600" />
                  Sample Excel Template
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="e.g. Steering Cylinder, Front Axel"
                  value={newComponentName}
                  onChange={(e) => setNewComponentName(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-4 py-2 text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Create Table
                </button>
                <label className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 select-none">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Upload Excel Table
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => handleExcelFileUpload(e, true)}
                    className="hidden"
                  />
                </label>
              </div>
            </form>
          </div>

          {/* SPREADSHEET MATRIX DESIGN */}
          {activeMatrix ? (() => {
            const query = matrixSearchQuery.trim().toLowerCase();

            let displayModels = activeMatrix.models;
            let displaySteps = activeMatrix.steps;

            if (query) {
              const modelMatches = activeMatrix.models.filter(m => m.toLowerCase().includes(query));
              const stepMatches = activeMatrix.steps.filter(s => {
                if (s.stepName.toLowerCase().includes(query)) return true;
                if (!isNaN(Number(query)) && Object.values(s.prices).some(p => p !== undefined && p !== null && p.toString().includes(query))) return true;
                return false;
              });

              const isModelMatch = modelMatches.length > 0;
              const isStepMatch = stepMatches.length > 0;

              if (isModelMatch) {
                // When query matches a model (e.g. "773"), show matching model column(s) with ALL step rows
                displayModels = modelMatches;
                displaySteps = activeMatrix.steps;
              } else if (isStepMatch) {
                // When query matches a step/operation, show matching step row(s) across ALL model columns
                displayModels = activeMatrix.models;
                displaySteps = stepMatches;
              } else {
                displayModels = [];
                displaySteps = [];
              }
            }

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
                {/* Top Controls: Search / Joined Add Slider */}
                <div className="p-5 border-b border-slate-200 bg-slate-50/40 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
                      Spreadsheet: {activeMatrix.name} Pricing Matrix
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Steps are rows, Models are columns. Cell intersections specify pre-quoted prices in Rand (R).</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Search Input for Model / Operation */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 shadow-2xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search model / operation..."
                        value={matrixSearchQuery}
                        onChange={(e) => setMatrixSearchQuery(e.target.value)}
                        className="text-xs bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden w-38 sm:w-44 font-medium text-slate-700 placeholder:text-slate-400"
                      />
                      {matrixSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMatrixSearchQuery('')}
                          className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Joined Add Control with Slider Toggle */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1.5 shadow-2xs">
                      {/* Segmented Slider Selector */}
                      <div className="relative flex items-center bg-slate-100 rounded-lg p-0.5 select-none font-bold text-[11px]">
                        <button
                          type="button"
                          onClick={() => setAddEntryType('step')}
                          className={`relative z-10 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            addEntryType === 'step'
                              ? 'bg-purple-600 text-white shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 font-semibold'
                          }`}
                        >
                          + Step
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddEntryType('model')}
                          className={`relative z-10 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            addEntryType === 'model'
                              ? 'bg-blue-600 text-white shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 font-semibold'
                          }`}
                        >
                          + Model
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder={addEntryType === 'step' ? "New Step Row..." : "New Model Col..."}
                        value={addEntryValue}
                        onChange={(e) => setAddEntryValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUnifiedAddEntry();
                          }
                        }}
                        className="text-xs bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden w-28 sm:w-36 font-semibold text-slate-700 placeholder:text-slate-400"
                      />

                      <button
                        type="button"
                        onClick={handleUnifiedAddEntry}
                        disabled={!addEntryValue.trim()}
                        className={`font-bold text-[11px] px-3 py-1 rounded-lg cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white shrink-0 ${
                          addEntryType === 'step' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Excel Format Instructions Banner */}
                <div className="px-5 py-2.5 bg-emerald-50/60 border-b border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-800">
                  <div className="flex items-center gap-2 font-medium text-[11px]">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Excel Format:</strong> Column 1 contains steps/operations. Columns 2+ contain model names. Cell intersections set prices in Rand (R).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={downloadSampleExcelTemplate}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Download className="w-3 h-3" /> Download Sample .xlsx
                  </button>
                </div>

                {/* SpreadSheet HTML Table - Scroll view showing ~15 steps at a time with sticky headers */}
                <div className="p-4">
                  <div className="max-h-[600px] overflow-auto border border-slate-200 rounded-xl shadow-2xs relative">
                    <table className="w-full border-collapse text-[10px]">
                      <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs">
                        <tr className="bg-slate-100 text-slate-600 font-semibold text-left">
                          <th className="border border-slate-200 p-2.5 bg-slate-150 text-slate-700 font-bold w-48 text-[10px] sticky top-0 left-0 z-30 shadow-2xs">
                            Steps / Repair Operations ({displaySteps.length})
                          </th>
                          {displayModels.map((model, mIdx) => (
                            <th key={`${model}-${mIdx}`} className="border border-slate-200 p-2.5 bg-blue-50/90 text-blue-900 font-bold text-center min-w-28 text-[10px] sticky top-0 z-20 backdrop-blur-xs">
                              {model}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displaySteps.map((step, sIdx) => (
                          <tr key={`${step.stepName}-${sIdx}`} className="hover:bg-slate-50/80 transition-colors">
                            {/* Step Label Row */}
                            <td className="border border-slate-200 p-2 bg-slate-50 text-slate-700 font-bold text-[10px] sticky left-0 z-10 shadow-2xs">
                              {step.stepName}
                            </td>

                            {/* Cells corresponding to model columns */}
                            {displayModels.map((model, mIdx) => {
                              const val = step.prices[model] !== undefined ? step.prices[model] : '';
                              return (
                                <td key={`${model}-${mIdx}`} className="border border-slate-200 p-1.5 text-center bg-white">
                                  <div className="flex items-center gap-1 border border-slate-200 bg-white rounded-md px-2 py-1 justify-center max-w-[105px] mx-auto focus-within:border-blue-500 transition-colors">
                                    <span className="text-slate-400 font-bold font-sans text-[10px]">R</span>
                                    <input
                                      type="number"
                                      value={val}
                                      onChange={(e) => handleMatrixCellPriceChange(step.stepName, model, e.target.value)}
                                      className="w-full bg-transparent border-0 p-0 text-center font-bold text-slate-800 text-[10px] focus:ring-0 focus:outline-hidden"
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {displaySteps.length === 0 && (
                          <tr>
                            <td colSpan={displayModels.length + 1} className="p-6 text-center text-slate-400 italic text-[11px]">
                              {query ? `No models or step operations found matching "${matrixSearchQuery}".` : 'No step rows created yet. Use "+ Add Step" above to create your first step row!'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <h3 className="font-semibold text-slate-700">No Component Matrices Found</h3>
              <p className="text-xs mt-1">Please create a component matrix table above to start managing Repair steps and Model pricing.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 4: CUSTOMERS DIRECTORY
          ======================================================== */}
      {activeSubTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
          {/* Add / Edit Customer Form */}
          <form onSubmit={handleSaveCustomerForm} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              {editingCustomer ? 'Edit Customer Account' : 'Register New Customer'}
            </h2>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Caterpillar Repairs"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Sipho Ndlovu"
                  value={custContact}
                  onChange={(e) => setCustContact(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. s.ndlovu@anglo.com"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +27 11 898 8500"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Physical Address</label>
                <textarea
                  rows={2}
                  placeholder="Street address or depot hub details..."
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-hidden"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    {editingCustomer ? 'Update Account' : 'Add Customer'}
                  </button>
                  {editingCustomer && (
                    <button
                      type="button"
                      onClick={() => handleEditCustomer(null)}
                      className="bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!editingCustomer && (
                  <div className="pt-2 border-t border-slate-100">
                    <input
                      type="file"
                      ref={customerFileInputRef}
                      onChange={handleCustomerExcelUpload}
                      accept=".xlsx, .xls, .csv"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => customerFileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                      Batch import via Excel (.xlsx). Columns: Company Name, Contact Person, Email, Phone Number, Address.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </form>

          {/* Customer list table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Customers Directory ({customers.length})</h2>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 shadow-2xs">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search company or contact..."
                  value={custSearchQuery}
                  onChange={(e) => setCustSearchQuery(e.target.value)}
                  className="text-xs bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden w-40 font-medium text-slate-700 placeholder:text-slate-400"
                />
                {custSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCustSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-200 text-[10px] uppercase">
                    <th className="p-3 pl-4">Company</th>
                    <th className="p-3">Contact Person</th>
                    <th className="p-3">Phone & Email</th>
                    <th className="p-3 text-right pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.filter(cust => {
                    if (!custSearchQuery.trim()) return true;
                    const q = custSearchQuery.toLowerCase();
                    return (
                      cust.name.toLowerCase().includes(q) ||
                      (cust.contactPerson || '').toLowerCase().includes(q) ||
                      (cust.email || '').toLowerCase().includes(q) ||
                      (cust.phone || '').toLowerCase().includes(q)
                    );
                  }).map(cust => (
                    <tr key={cust.id} className="hover:bg-slate-50/50">
                      <td className="p-3 pl-4">
                        <p className="font-bold text-slate-700">{cust.name}</p>
                        <p className="text-slate-400 font-mono text-[9px] truncate max-w-[150px] mt-0.5">{cust.address || 'No Address'}</p>
                      </td>
                      <td className="p-3 font-semibold text-slate-600">
                        {cust.contactPerson || '--'}
                      </td>
                      <td className="p-3">
                        <p className="font-mono text-slate-600">{cust.phone || 'No Phone'}</p>
                        <p className="text-slate-400 font-mono text-[10px] mt-0.5">{cust.email || 'No Email'}</p>
                      </td>
                      <td className="p-3 text-right pr-4">
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => handleEditCustomer(cust)}
                            className="text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-100 px-2 py-1 rounded-md text-[10px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCustomerClick(cust.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 5: JOB CARD FORMAT EDITOR
          ======================================================== */}
      {activeSubTab === 'jobCard' && (
        <div className="space-y-6">
          {/* Top Bar with Actions */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
                <Layout className="w-5 h-5 text-blue-600" />
                Job Card Layout &amp; A4 Portrait Editor
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize A4 Portrait format, move logo, adjust line weights and colors, toggle tables/badges, and configure field labels.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetFormat}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={handleSaveFormat}
                disabled={formatSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {formatSaving ? (
                  <Sparkles className="w-4 h-4 animate-spin" />
                ) : formatSuccessMsg ? (
                  <CheckCircle className="w-4 h-4 text-emerald-300" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {formatSaving ? 'Saving...' : formatSuccessMsg ? 'Saved Layout!' : 'Save Format Layout'}
              </button>
            </div>
          </div>

          {/* Grid Layout: Controls on Left, Live A4 Preview on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Controls Pane */}
            <div className="lg:col-span-6 space-y-5">
              {/* Card 1: Logo & Company Branding */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Logo &amp; Company Branding</h3>
                </div>
                <div className="p-4 space-y-4 text-xs">
                  {/* Upload Logo File */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Company Logo Image</label>
                    <div className="flex items-center gap-3">
                      {formatConfig.logoUrl ? (
                        <div className="relative w-12 h-12 p-1 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
                          <img src={formatConfig.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 bg-slate-50">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          Upload Logo
                          <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
                        </label>
                        {formatConfig.logoUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            Remove Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Logo Alignment & Size */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Logo Alignment</label>
                      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                        {(['left', 'center', 'right'] as const).map(align => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => setFormatConfig(prev => ({ ...prev, logoAlignment: align }))}
                            className={`py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${
                              formatConfig.logoAlignment === align ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Logo Size</label>
                      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                        {(['small', 'medium', 'large'] as const).map(size => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setFormatConfig(prev => ({ ...prev, logoSize: size }))}
                            className={`py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${
                              formatConfig.logoSize === size ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company Name</label>
                      <input
                        type="text"
                        value={formatConfig.companyName}
                        onChange={(e) => setFormatConfig(prev => ({ ...prev, companyName: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company Subtitle</label>
                      <input
                        type="text"
                        value={formatConfig.companySubtitle}
                        onChange={(e) => setFormatConfig(prev => ({ ...prev, companySubtitle: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company Tagline</label>
                      <input
                        type="text"
                        value={formatConfig.companyTagline}
                        onChange={(e) => setFormatConfig(prev => ({ ...prev, companyTagline: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Document Title</label>
                      <input
                        type="text"
                        value={formatConfig.documentTitle}
                        onChange={(e) => setFormatConfig(prev => ({ ...prev, documentTitle: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Line Styles & Color Themes */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Line Thickness &amp; Colors</h3>
                </div>
                <div className="p-4 space-y-4 text-xs">
                  {/* Border Width Selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Border &amp; Line Weight</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'thin', label: 'Thin (1px)', border: 'border' },
                        { id: 'normal', label: 'Normal (2px)', border: 'border-2' },
                        { id: 'thick', label: 'Thick (3px)', border: 'border-4' }
                      ].map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setFormatConfig(prev => ({ ...prev, borderWidth: w.id as any }))}
                          className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            formatConfig.borderWidth === w.id ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-xs' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-full bg-slate-800 rounded ${w.id === 'thin' ? 'h-[1px]' : w.id === 'normal' ? 'h-[2px]' : 'h-[3.5px]'}`}></div>
                          <span className="text-[10px] font-bold">{w.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accent & Highlights Colors */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Accent Color (Job #)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formatConfig.accentColor}
                          onChange={(e) => setFormatConfig(prev => ({ ...prev, accentColor: e.target.value }))}
                          className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                        />
                        <span className="font-mono text-slate-700 text-xs font-bold">{formatConfig.accentColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Customer Name Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formatConfig.customerTextColor || '#c026d3'}
                          onChange={(e) => setFormatConfig(prev => ({ ...prev, customerTextColor: e.target.value }))}
                          className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                        />
                        <span className="font-mono text-slate-700 text-xs font-bold">{formatConfig.customerTextColor || '#c026d3'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Table Header & Stamp Colors */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Consumables Bg</label>
                      <input
                        type="color"
                        value={formatConfig.consumablesHeaderBg || '#e0f2fe'}
                        onChange={(e) => setFormatConfig(prev => ({ ...prev, consumablesHeaderBg: e.target.value }))}
                        className="w-full h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Outsourcing Bg</label>
                      <input
                        type="color"
                        value={formatConfig.outsourcingHeaderBg || '#fef08a'}
                        onChange={(e) => setFormatConfig(prev => ({ ...prev, outsourcingHeaderBg: e.target.value }))}
                        className="w-full h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Stamp Box Border</label>
                      <input
                        type="color"
                        value={formatConfig.stampBoxBorderColor || '#22c55e'}
                        onChange={(e) => setFormatConfig(prev => ({ ...prev, stampBoxBorderColor: e.target.value }))}
                        className="w-full h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Element & Badge Toggles */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Element &amp; Badge Visibility</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-xs">
                  {[
                    { key: 'showSabsBadge', label: 'SABS Quality Badge' },
                    { key: 'showIsoBadge', label: 'ISO 9001 Badge' },
                    { key: 'showAreaBadge', label: 'Workshop AREA Badge' },
                    { key: 'showHardStampBox', label: 'Hard Stamp Date Box' },
                    { key: 'showConsumablesTable', label: 'Consumables Grid Table' },
                    { key: 'showOutsourcingTable', label: 'Outsourcing Table' },
                    { key: 'showApprovalSignature', label: 'Approval Signature Line' },
                    { key: 'showDueDate', label: 'Due Date Box' }
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/60 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <input
                        type="checkbox"
                        checked={Boolean((formatConfig as any)[item.key])}
                        onChange={(e) => setFormatConfig(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-700 text-xs">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Card 4: Custom Field Labels */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <Type className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Custom Field Labels</h3>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Order # Label</label>
                      <input
                        type="text"
                        value={formatConfig.labels.orderNumber}
                        onChange={(e) => updateLabel('orderNumber', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Your Ref. Label</label>
                      <input
                        type="text"
                        value={formatConfig.labels.yourRef}
                        onChange={(e) => updateLabel('yourRef', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer Job # Label</label>
                      <input
                        type="text"
                        value={formatConfig.labels.customerJobNumber}
                        onChange={(e) => updateLabel('customerJobNumber', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery / RFQ Label</label>
                      <input
                        type="text"
                        value={formatConfig.labels.deliveryNoteNumber}
                        onChange={(e) => updateLabel('deliveryNoteNumber', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status / Tech Label</label>
                      <input
                        type="text"
                        value={formatConfig.labels.leadTechnician}
                        onChange={(e) => updateLabel('leadTechnician', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Workshop Area Label</label>
                      <input
                        type="text"
                        value={formatConfig.labels.workshopArea}
                        onChange={(e) => updateLabel('workshopArea', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Consumables Title</label>
                      <input
                        type="text"
                        value={formatConfig.labels.consumablesTitle || "Consumables"}
                        onChange={(e) => updateLabel('consumablesTitle', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Outsourcing Title</label>
                      <input
                        type="text"
                        value={formatConfig.labels.outsourcingTitle || "Outsourcing"}
                        onChange={(e) => updateLabel('outsourcingTitle', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 5: Section Ordering */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Grid className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Section Ordering &amp; Titles</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Use arrows to reorder</span>
                </div>
                <div className="p-4 space-y-2 text-xs">
                  {formatConfig.sections.map((section, idx) => (
                    <div
                      key={section.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        section.enabled ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50 border-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 mr-3">
                        <button
                          type="button"
                          onClick={() => toggleSectionEnabled(section.id)}
                          className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                            section.enabled ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-200 hover:bg-slate-300'
                          }`}
                        >
                          {section.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={section.customTitle ?? section.title}
                            onChange={(e) => updateSectionCustomTitle(section.id, e.target.value)}
                            className="font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none text-xs w-full"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, 'up')}
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === formatConfig.sections.length - 1}
                          onClick={() => moveSection(idx, 'down')}
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Pane: Live A4 Portrait Sheet Preview */}
            <div className="lg:col-span-6 sticky top-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Live A4 Portrait Preview</h3>
                  </div>
                  <div className="flex bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPreviewPage('page1')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        previewPage === 'page1' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Page 1
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewPage('page2')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        previewPage === 'page2' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Page 2 (Timesheet Log)
                    </button>
                  </div>
                </div>

                {/* Simulated A4 Portrait Job Card Document */}
                <div className="p-4 bg-slate-200/80 overflow-y-auto max-h-[780px] flex justify-center">
                  <div className="w-full max-w-[580px]">
                    <JobCardDocument format={formatConfig} page={previewPage} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
