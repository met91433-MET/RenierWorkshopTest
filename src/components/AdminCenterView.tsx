import React, { useState } from 'react';
import { 
  Customer, 
  ComponentMatrix, 
  CustomColumn, 
  UserProfile, 
  UserPermissions,
  ComponentStep 
} from '../types';
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
  AlertCircle
} from 'lucide-react';

interface AdminCenterViewProps {
  users: UserProfile[];
  customers: Customer[];
  componentsList: ComponentMatrix[];
  customColumns: CustomColumn[];
  onUpdateUserPermissions: (uid: string, permissions: UserPermissions) => Promise<void>;
  onSaveCustomColumns: (columns: CustomColumn[]) => Promise<void>;
  onSaveCustomer: (customer: Customer) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onSaveComponentMatrix: (matrix: ComponentMatrix) => Promise<void>;
  onDeleteComponentMatrix: (id: string) => Promise<void>;
}

export default function AdminCenterView({
  users,
  customers,
  componentsList,
  customColumns,
  onUpdateUserPermissions,
  onSaveCustomColumns,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveComponentMatrix,
  onDeleteComponentMatrix
}: AdminCenterViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'columns' | 'customers' | 'pricing'>('users');

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

  // ========================================================
  // 4. STATE FOR COMPONENT PRICING MATRICES (VERY CRITICAL!)
  // ========================================================
  const [selectedCompMatrixId, setSelectedCompMatrixId] = useState<string>(componentsList[0]?.id || '');
  const [newComponentName, setNewComponentName] = useState('');
  
  // Dynamic cells edit state inside the pricing sheet
  const activeMatrix = componentsList.find(c => c.id === selectedCompMatrixId);
  const [newModelColumnName, setNewModelColumnName] = useState('');
  const [newStepRowName, setNewStepRowName] = useState('');

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
          onClick={() => setActiveSubTab('columns')}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-xs rounded-t-xl tracking-tight transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'columns'
              ? 'border-blue-600 text-blue-600 bg-blue-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <Grid className="w-4 h-4" />
          Dynamic Receiving Columns
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
          Customer Accounts Directory
        </button>
      </div>

      {/* ========================================================
          TAB 1: USER PERMISSIONS
          ======================================================== */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
          <div className="p-5 border-b border-slate-200 bg-slate-50/40">
            <h2 className="text-sm font-bold text-slate-700">Workshop Users & Feature Clearances</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Toggle booleans to restrict actions. E.g. Unchecking 'Pre-Quoting' bars users from editing price lines.</p>
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
                {users.map((user) => {
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
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Create New Component Pricing Table</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. Steering Cylinder, Front Axel"
                  value={newComponentName}
                  onChange={(e) => setNewComponentName(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-4 py-2 text-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Create Table
                </button>
              </div>
            </form>
          </div>

          {/* SPREADSHEET MATRIX DESIGN */}
          {activeMatrix ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
              {/* Top Controls: Add Model Column / Add Step Row */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-display">Spreadsheet: {activeMatrix.name} Pricing Matrix</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Steps are rows, Models are columns. Cell intersections specify pre-quoted prices.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Add model column */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
                    <input
                      type="text"
                      placeholder="New Model Column"
                      value={newModelColumnName}
                      onChange={(e) => setNewModelColumnName(e.target.value)}
                      className="text-xs bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden w-28 font-semibold text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewModelColumn}
                      disabled={!newModelColumnName.trim()}
                      className="text-blue-600 hover:text-blue-700 disabled:opacity-55 font-bold text-[11px] bg-blue-50 border px-2 py-1 rounded-lg"
                    >
                      + Add Col
                    </button>
                  </div>

                  {/* Add step row */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
                    <input
                      type="text"
                      placeholder="New Step Row"
                      value={newStepRowName}
                      onChange={(e) => setNewStepRowName(e.target.value)}
                      className="text-xs bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden w-28 font-semibold text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewStepRow}
                      disabled={!newStepRowName.trim()}
                      className="text-purple-600 hover:text-purple-700 disabled:opacity-55 font-bold text-[11px] bg-purple-50 border px-2 py-1 rounded-lg"
                    >
                      + Add Row
                    </button>
                  </div>
                </div>
              </div>

              {/* SpreadSheet HTML Table */}
              <div className="p-4 overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-semibold text-left">
                      <th className="border border-slate-200 p-3 bg-slate-150 text-slate-700 font-bold w-48">Steps / Repair Operations</th>
                      {activeMatrix.models.map(model => (
                        <th key={model} className="border border-slate-200 p-3 bg-blue-50/40 text-blue-800 font-bold text-center min-w-32">
                          {model}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeMatrix.steps.map(step => (
                      <tr key={step.stepName} className="hover:bg-slate-50/50">
                        {/* Step Label Row */}
                        <td className="border border-slate-200 p-3 bg-slate-50 text-slate-700 font-bold">
                          {step.stepName}
                        </td>

                        {/* Cells corresponding to model columns */}
                        {activeMatrix.models.map(model => {
                          const val = step.prices[model] !== undefined ? step.prices[model] : '';
                          return (
                            <td key={model} className="border border-slate-200 p-2 text-center">
                              <div className="flex items-center gap-1.5 border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 justify-center max-w-[120px] mx-auto focus-within:border-blue-500 transition-colors">
                                <span className="text-slate-400 font-semibold font-sans">$</span>
                                <input
                                  type="number"
                                  value={val}
                                  onChange={(e) => handleMatrixCellPriceChange(step.stepName, model, e.target.value)}
                                  className="w-full bg-transparent border-0 p-0 text-center font-bold text-slate-800 text-xs focus:ring-0 focus:outline-hidden"
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {activeMatrix.steps.length === 0 && (
                      <tr>
                        <td colSpan={activeMatrix.models.length + 1} className="p-6 text-center text-slate-400 italic">
                          No step rows created yet. Use the control panel at the top right to create your first step row!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <h3 className="font-semibold text-slate-700">No Component Matrices Found</h3>
              <p className="text-xs mt-1">Please create a component matrix table above to start managing Repair steps and Model pricing.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 3: DYNAMIC RECEIVING COLUMNS
          ======================================================== */}
      {activeSubTab === 'columns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
          {/* Add column card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Add Custom Column</h2>
            <p className="text-xs text-slate-500">
              Create customizable text, number, or date attributes that are dynamically generated inside Job Receiving delivery forms.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Column Label / Field Title</label>
                <input
                  type="text"
                  placeholder="e.g. Transport Plate No"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Field Input Type</label>
                <select
                  value={newColType}
                  onChange={(e: any) => setNewColType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden"
                >
                  <option value="text">Single-line Text Input</option>
                  <option value="number">Numeric / Digits Only</option>
                  <option value="date">Calendar Date Picker</option>
                </select>
              </div>

              <button
                onClick={addCustomColumn}
                disabled={!newColLabel.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-55 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
              >
                Create Dynamic Field Column
              </button>
            </div>
          </div>

          {/* List existing columns card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Custom Receiving Columns</h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-200 text-[10px] uppercase">
                    <th className="p-3 pl-4">Backend ID</th>
                    <th className="p-3">Field Title (Form Label)</th>
                    <th className="p-3">Field Type</th>
                    <th className="p-3 text-right pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customColumns.map(col => (
                    <tr key={col.id} className="hover:bg-slate-50/50">
                      <td className="p-3 pl-4 font-mono text-slate-500 font-semibold text-[11px]">
                        {col.id}
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {col.label}
                      </td>
                      <td className="p-3 capitalize font-medium text-slate-500">
                        {col.type === 'text' ? 'Text String' : col.type === 'number' ? 'Numeric' : 'Date Picker'}
                      </td>
                      <td className="p-3 text-right pr-4">
                        <button
                          onClick={() => deleteCustomColumn(col.id)}
                          className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {customColumns.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                        No custom receiving columns configured. Create one using the form on the left!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
                    className="bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Customer list table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Registered Client Directories ({customers.length})</h2>
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
                  {customers.map(cust => (
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
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                        No registered customers found. Create your first client account on the left!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
