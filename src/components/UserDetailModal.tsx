import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  KeyRound, 
  ShieldCheck, 
  Check, 
  Trash2, 
  Save, 
  Send, 
  Sparkles, 
  Truck, 
  ClipboardCheck, 
  Calculator, 
  FileText, 
  Package, 
  Clock, 
  BarChart3, 
  Search, 
  ShieldAlert, 
  AlertCircle
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { UserProfile, UserPermissions } from '../types';

interface UserDetailModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  mode: 'edit' | 'create';
  onClose: () => void;
  onSave: (profile: UserProfile) => Promise<void>;
  onDelete?: (uid: string) => Promise<void>;
  existingEmails?: string[];
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  canReceive: false,
  canInspect: false,
  canQuote: false,
  canCreateJobCard: false,
  canStores: false,
  canWorksheet: false,
  canReporting: false,
  canClose: false,
  isAdmin: false
};

interface AccessAreaDef {
  key: keyof UserPermissions;
  title: string;
  stageName: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const ACCESS_AREAS: AccessAreaDef[] = [
  {
    key: 'canReceive',
    title: 'Job Receiving',
    stageName: 'Stage 1',
    description: 'Check in components, snap delivery photos, AI note parsing',
    icon: Truck,
    color: 'text-blue-600 bg-blue-50 border-blue-200'
  },
  {
    key: 'canInspect',
    title: 'Technical Inspection',
    stageName: 'Stage 2',
    description: 'Technical inspection findings, QA checklist, defect notes',
    icon: ClipboardCheck,
    color: 'text-amber-600 bg-amber-50 border-amber-200'
  },
  {
    key: 'canQuote',
    title: 'Pre-Quotation',
    stageName: 'Stage 3',
    description: 'Matrix price estimates, scope of work, customer quote approval',
    icon: Calculator,
    color: 'text-purple-600 bg-purple-50 border-purple-200'
  },
  {
    key: 'canCreateJobCard',
    title: 'Job Card Administration',
    stageName: 'Stage 4',
    description: 'Generate official job cards, barcode traveler, shopfloor dispatch',
    icon: FileText,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
  },
  {
    key: 'canStores',
    title: 'Stores & Tooling',
    stageName: 'Inventory',
    description: 'Tool inventory, stock checkout, allocation & store room logs',
    icon: Package,
    color: 'text-cyan-600 bg-cyan-50 border-cyan-200'
  },
  {
    key: 'canWorksheet',
    title: 'Worksheet Timesheets',
    stageName: 'Production',
    description: 'Operator timesheet logs, machine run hours, production steps',
    icon: Clock,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
  },
  {
    key: 'canReporting',
    title: 'Workshop Analytics',
    stageName: 'Reports',
    description: 'Machine utilization, scrap rates, turnaround times, export reports',
    icon: BarChart3,
    color: 'text-rose-600 bg-rose-50 border-rose-200'
  },
  {
    key: 'canClose',
    title: 'Job Enquiries & Closing',
    stageName: 'Enquiries',
    description: 'Search historical jobs, export work history, final job sign-off',
    icon: Search,
    color: 'text-slate-600 bg-slate-50 border-slate-200'
  },
  {
    key: 'isAdmin',
    title: 'Administrator Access',
    stageName: 'Admin Center',
    description: 'Full administrative control, user permissions, machine setup, pricing',
    icon: ShieldAlert,
    color: 'text-red-600 bg-red-50 border-red-200'
  }
];

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  isOpen,
  user,
  mode,
  onClose,
  onSave,
  onDelete,
  existingEmails = []
}) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [activeRolePreset, setActiveRolePreset] = useState<string>('custom');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Initialize or reset when modal opens or user changes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSuccessMessage('');
      setConfirmDelete(false);
      setShowPassword(false);

      if (user && mode === 'edit') {
        setDisplayName(user.displayName || '');
        setEmail(user.email || '');
        setPassword(user.password || '');
        setPermissions({
          canReceive: Boolean(user.permissions?.canReceive),
          canInspect: Boolean(user.permissions?.canInspect),
          canQuote: Boolean(user.permissions?.canQuote),
          canCreateJobCard: Boolean(user.permissions?.canCreateJobCard),
          canStores: Boolean(user.permissions?.canStores),
          canWorksheet: Boolean(user.permissions?.canWorksheet),
          canReporting: Boolean(user.permissions?.canReporting),
          canClose: Boolean(user.permissions?.canClose),
          isAdmin: Boolean(user.permissions?.isAdmin)
        });
        detectPresetFromPermissions(user.permissions);
      } else {
        setDisplayName('');
        setEmail('');
        setPassword('');
        setPermissions(DEFAULT_PERMISSIONS);
        setActiveRolePreset('custom');
      }
    }
  }, [isOpen, user, mode]);

  if (!isOpen) return null;

  function detectPresetFromPermissions(p?: UserPermissions) {
    if (!p) {
      setActiveRolePreset('custom');
      return;
    }
    if (p.isAdmin && p.canReceive && p.canInspect && p.canQuote && p.canCreateJobCard && p.canStores && p.canWorksheet && p.canReporting && p.canClose) {
      setActiveRolePreset('admin');
    } else if (p.canReceive && p.canCreateJobCard && p.canClose && !p.canInspect && !p.canQuote && !p.isAdmin) {
      setActiveRolePreset('jobadmin');
    } else if (p.canReceive && p.canInspect && !p.canQuote && !p.canCreateJobCard && !p.isAdmin) {
      setActiveRolePreset('inspection');
    } else if (p.canQuote && !p.canReceive && !p.canInspect && !p.canCreateJobCard && !p.isAdmin) {
      setActiveRolePreset('prequote');
    } else if (p.canStores && !p.canReceive && !p.canInspect && !p.canQuote && !p.isAdmin) {
      setActiveRolePreset('stores');
    } else if (p.canWorksheet && !p.canReceive && !p.canInspect && !p.canQuote && !p.isAdmin) {
      setActiveRolePreset('worksheets');
    } else {
      setActiveRolePreset('custom');
    }
  }

  const handleApplyPreset = (preset: string) => {
    setActiveRolePreset(preset);
    setErrorMessage('');

    if (preset === 'admin') {
      setPermissions({
        canReceive: true,
        canInspect: true,
        canQuote: true,
        canCreateJobCard: true,
        canStores: true,
        canWorksheet: true,
        canReporting: true,
        canClose: true,
        isAdmin: true
      });
    } else if (preset === 'jobadmin') {
      setPermissions({
        canReceive: true,
        canInspect: false,
        canQuote: false,
        canCreateJobCard: true,
        canStores: false,
        canWorksheet: false,
        canReporting: false,
        canClose: true,
        isAdmin: false
      });
    } else if (preset === 'inspection') {
      setPermissions({
        canReceive: true,
        canInspect: true,
        canQuote: false,
        canCreateJobCard: false,
        canStores: false,
        canWorksheet: false,
        canReporting: false,
        canClose: false,
        isAdmin: false
      });
    } else if (preset === 'prequote') {
      setPermissions({
        canReceive: false,
        canInspect: false,
        canQuote: true,
        canCreateJobCard: false,
        canStores: false,
        canWorksheet: false,
        canReporting: false,
        canClose: false,
        isAdmin: false
      });
    } else if (preset === 'stores') {
      setPermissions({
        canReceive: false,
        canInspect: false,
        canQuote: false,
        canCreateJobCard: false,
        canStores: true,
        canWorksheet: false,
        canReporting: false,
        canClose: false,
        isAdmin: false
      });
    } else if (preset === 'worksheets') {
      setPermissions({
        canReceive: false,
        canInspect: false,
        canQuote: false,
        canCreateJobCard: false,
        canStores: false,
        canWorksheet: true,
        canReporting: false,
        canClose: false,
        isAdmin: false
      });
    } else if (preset === 'receiving') {
      setPermissions({
        canReceive: true,
        canInspect: false,
        canQuote: false,
        canCreateJobCard: false,
        canStores: false,
        canWorksheet: false,
        canReporting: false,
        canClose: false,
        isAdmin: false
      });
    } else if (preset === 'clear') {
      setPermissions(DEFAULT_PERMISSIONS);
      setActiveRolePreset('custom');
    }
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    setActiveRolePreset('custom');
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let res = 'Metal#';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
    setShowPassword(true);
    setSuccessMessage(`Generated temporary password: ${res}`);
  };

  const handleSendResetEmail = async () => {
    if (!email.trim()) {
      setErrorMessage('Please provide a valid email address first.');
      return;
    }
    setIsSendingReset(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSuccessMessage(`Password reset email successfully sent to ${email.trim()}.`);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setErrorMessage(err.message || 'Could not send password reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!displayName.trim()) {
      setErrorMessage('User name cannot be blank.');
      return;
    }

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed || !emailTrimmed.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    // Check duplicate email
    if (mode === 'create' || (user && user.email.toLowerCase() !== emailTrimmed)) {
      const isDuplicate = existingEmails.some(
        em => em.toLowerCase() === emailTrimmed && (!user || em.toLowerCase() !== user.email.toLowerCase())
      );
      if (isDuplicate) {
        setErrorMessage(`An account with email "${emailTrimmed}" already exists.`);
        return;
      }
    }

    if (password && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsSaving(true);
    try {
      const uid = mode === 'edit' && user ? user.uid : `metalogik-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = mode === 'edit' && user?.createdAt ? user.createdAt : new Date().toISOString();

      const updatedProfile: UserProfile = {
        uid,
        email: emailTrimmed,
        displayName: displayName.trim(),
        permissions,
        password: password.trim() || undefined,
        createdAt,
        updatedAt: new Date().toISOString()
      };

      await onSave(updatedProfile);
      setSuccessMessage('User account and role clearances saved successfully.');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Error saving user profile:', err);
      setErrorMessage(err.message || 'Failed to save user account.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !onDelete) return;
    setIsSaving(true);
    try {
      await onDelete(user.uid);
      onClose();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setErrorMessage(err.message || 'Failed to delete user account.');
    } finally {
      setIsSaving(false);
    }
  };

  const countActivePermissions = Object.values(permissions).filter(Boolean).length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-inner">
              {(displayName || email || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-bold flex items-center gap-2">
                {mode === 'edit' ? 'Edit User Account & Roles' : 'Create New User Account'}
                {permissions.isAdmin && (
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    System Admin
                  </span>
                )}
              </h2>
              <p className="text-slate-400 text-xs">
                {mode === 'edit' 
                  ? `Manage profile credentials, password, and stage access areas for ${displayName || email}`
                  : 'Add a new team member and configure their workshop permissions'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Notifications / Feedback */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Section 1: User Profile & Credentials */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>User Information & Credentials</span>
              </h3>
              {mode === 'edit' && user && (
                <span className="text-[11px] font-mono text-slate-400">
                  UID: {user.uid}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* User Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>User Name / Display Name</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>Email Address</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. jaco@metalogik.co.za"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Password Management */}
            <div className="pt-2 border-t border-slate-200/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Account Password</span>
                  <span className="text-slate-400 font-normal text-[11px]">
                    (leave blank to keep unchanged)
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong Password</span>
                  </button>
                  {mode === 'edit' && email && (
                    <button
                      type="button"
                      onClick={handleSendResetEmail}
                      disabled={isSendingReset}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition-colors disabled:opacity-50"
                      title="Send official Firebase password reset link to user's email"
                    >
                      <Send className="w-3 h-3" />
                      <span>{isSendingReset ? 'Sending...' : 'Send Reset Link'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'edit' ? 'Enter new password to change...' : 'Set initial password (min 6 characters)...'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl pl-3 pr-10 py-2 text-slate-800 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Setting or changing a password here allows the user to log in immediately using these credentials.
              </p>
            </div>
          </div>

          {/* Section 2: Role Presets Quick Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Quick Role Presets</span>
              </label>
              <span className="text-[11px] font-medium text-slate-500">
                {countActivePermissions} of {ACCESS_AREAS.length} clearances active
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'admin', label: 'Administrator', icon: ShieldAlert, color: 'hover:border-purple-300' },
                { id: 'jobadmin', label: 'Job Card Admin', icon: FileText, color: 'hover:border-emerald-300' },
                { id: 'inspection', label: 'Inspection', icon: ClipboardCheck, color: 'hover:border-amber-300' },
                { id: 'prequote', label: 'Pre-Quote', icon: Calculator, color: 'hover:border-purple-300' },
                { id: 'stores', label: 'Stores Manager', icon: Package, color: 'hover:border-cyan-300' },
                { id: 'worksheets', label: 'Worksheet Operator', icon: Clock, color: 'hover:border-indigo-300' },
                { id: 'receiving', label: 'Receiving Clerk', icon: Truck, color: 'hover:border-blue-300' },
                { id: 'custom', label: 'Custom Clearance', icon: KeyRound, color: 'hover:border-slate-300' }
              ].map((preset) => {
                const Icon = preset.icon;
                const isSelected = activeRolePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Detailed Stage Access Areas Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Select Stage & Module Access Clearances
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('admin')}
                  className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('clear')}
                  className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {ACCESS_AREAS.map((area) => {
                const Icon = area.icon;
                const isChecked = Boolean(permissions[area.key]);

                return (
                  <div
                    key={area.key}
                    onClick={() => handleTogglePermission(area.key)}
                    className={`relative p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      isChecked
                        ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg border ${area.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-800 leading-tight">
                            {area.title}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {area.stageName}
                          </span>
                        </div>
                      </div>

                      {/* Checkbox indicator */}
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-300 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mt-0.5">
                      {area.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delete Confirmation Box */}
          {confirmDelete && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs">
              <p className="font-bold text-red-800">
                Are you sure you want to delete user "{displayName || email}"?
              </p>
              <p className="text-red-600">
                This will permanently revoke their access and remove their account profile.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  {isSaving ? 'Deleting...' : 'Yes, Delete Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="bg-white border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              {mode === 'edit' && onDelete && !confirmDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 font-bold text-xs px-3 py-2 rounded-xl border border-red-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete User</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving Changes...' : mode === 'edit' ? 'Save User Changes' : 'Create User Account'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
