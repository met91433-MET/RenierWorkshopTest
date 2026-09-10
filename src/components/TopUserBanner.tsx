import React, { useState, useRef, useEffect } from 'react';
import { 
  UserProfile, 
  AppNotification, 
  ChatMessage, 
  UserPermissions,
  Job 
} from '../types';
import { 
  Bell, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Check, 
  ChevronDown, 
  LogOut, 
  RefreshCw, 
  Search, 
  Filter, 
  History, 
  Inbox, 
  CheckCheck, 
  ArrowUpRight, 
  Shield, 
  Sparkles,
  Layers,
  Wrench,
  AlertCircle,
  AlertTriangle,
  Lock,
  X,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Menu
} from 'lucide-react';
import { auth } from '../firebase';
import { updatePassword } from 'firebase/auth';

export interface NotifProcessCheck {
  isCompleted: boolean;
  requiredStageName: string;
  targetTab: string;
  reason: string;
  currentStatusLabel: string;
  jobFound?: Job;
}

export function checkNotificationProcess(notif: AppNotification, jobs: Job[] = []): NotifProcessCheck {
  if (!notif.jobId) {
    return {
      isCompleted: true,
      requiredStageName: '',
      targetTab: notif.targetTab || 'dashboard',
      reason: '',
      currentStatusLabel: 'General'
    };
  }

  // Look for matching job by id, delivery note number, or job card number
  const job = jobs.find(j => 
    j.id === notif.jobId || 
    j.deliveryNoteNumber === notif.jobId ||
    j.jobCardDetails?.jobCardNumber === notif.jobId || 
    (notif.jobNo && (j.id === notif.jobNo || j.deliveryNoteNumber === notif.jobNo || j.jobCardDetails?.jobCardNumber === notif.jobNo))
  );

  if (!job) {
    // If job does not exist in active records, allow dismissal
    return {
      isCompleted: true,
      requiredStageName: '',
      targetTab: notif.targetTab || 'dashboard',
      reason: '',
      currentStatusLabel: 'Archived/Deleted'
    };
  }

  const currentStatus = job.status || 'Received';

  // 1. Stage: Technical Inspection (triggered on arrival/receiving)
  if (notif.type === 'job_received' || notif.targetPermission === 'canInspect' || notif.targetTab === 'inspection') {
    const isInspected = currentStatus !== 'Received' || Boolean(
      job.inspectionDetails?.inspectorName ||
      job.inspectionDetails?.inspectedAt ||
      (job.inspectionDetails?.findings && job.inspectionDetails.findings.trim() !== '')
    );

    return {
      isCompleted: isInspected,
      requiredStageName: 'Technical Inspection',
      targetTab: 'inspection',
      reason: isInspected
        ? 'Technical Inspection has been completed.'
        : `Job #${notif.jobNo || job.id} is currently in "${currentStatus}" status. The Technical Inspection must be completed in the Inspection desk before checking off this alert.`,
      currentStatusLabel: currentStatus,
      jobFound: job
    };
  }

  // 2. Stage: Pre-Quote (triggered when inspection is done)
  if (notif.type === 'inspection_needed' || notif.targetPermission === 'canQuote' || notif.targetTab === 'quoting') {
    const isPreQuoted = (currentStatus === 'PreQuoted' || currentStatus === 'JobCardCreated' || currentStatus === 'Closed') ||
      Boolean(
        job.preQuoteDetails?.preQuoteId ||
        (job.preQuoteDetails?.steps && job.preQuoteDetails.steps.length > 0) ||
        (job.preQuoteDetails?.totalCost && job.preQuoteDetails.totalCost > 0)
      );

    return {
      isCompleted: isPreQuoted,
      requiredStageName: 'Pre-Quote Calculation',
      targetTab: 'quoting',
      reason: isPreQuoted
        ? 'Pre-Quote calculation has been completed.'
        : `Job #${notif.jobNo || job.id} is currently in "${currentStatus}" status. The Pre-Quote calculation must be completed in the Pre-Quote desk before checking off this alert.`,
      currentStatusLabel: currentStatus,
      jobFound: job
    };
  }

  // 3. Stage: Job Card Creation (triggered when pre-quote is completed)
  if (notif.type === 'quote_needed' || notif.targetPermission === 'canCreateJobCard' || notif.targetTab === 'jobcard') {
    const isJobCardCreated = currentStatus === 'JobCardCreated' || currentStatus === 'Closed' ||
      Boolean(job.jobCardDetails?.jobCardNumber && job.jobCardDetails.jobCardNumber.trim() !== '');

    return {
      isCompleted: isJobCardCreated,
      requiredStageName: 'Job Card Creation',
      targetTab: 'jobcard',
      reason: isJobCardCreated
        ? 'Job Card has been created.'
        : `Job #${notif.jobNo || job.id} is currently in "${currentStatus}" status. The Job Card must be generated in the Job Card Creator before checking off this alert.`,
      currentStatusLabel: currentStatus,
      jobFound: job
    };
  }

  // 4. Stage: Active Workshop / Worksheet
  if (notif.type === 'job_card_ready' || notif.targetPermission === 'canWorksheet' || notif.targetTab === 'worksheet') {
    const isClosed = currentStatus === 'Closed';
    return {
      isCompleted: isClosed,
      requiredStageName: 'Workshop QC Sign-Off & Job Close',
      targetTab: 'worksheet',
      reason: isClosed
        ? 'Job has completed all workshop procedures.'
        : `Job Card #${notif.jobNo || job.id} is active in production. Finalize timesheets and close out the job to complete this workflow.`,
      currentStatusLabel: currentStatus,
      jobFound: job
    };
  }

  return {
    isCompleted: true,
    requiredStageName: '',
    targetTab: notif.targetTab || 'dashboard',
    reason: '',
    currentStatusLabel: currentStatus,
    jobFound: job
  };
}

interface TopUserBannerProps {
  currentUser: UserProfile;
  notifications: AppNotification[];
  chatMessages: ChatMessage[];
  jobs?: Job[];
  unreadChatCount?: number;
  onDismissNotification: (notificationId: string) => Promise<void>;
  onDismissAllNotifications: (notificationIds: string[]) => Promise<void>;
  onNavigateToJob: (tab: string, jobId?: string) => void;
  onOpenChat: () => void;
  onSignOut: () => void;
  onForceSync: () => void;
  isSyncing: boolean;
  activeTab: string;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export default function TopUserBanner({
  currentUser,
  notifications,
  chatMessages,
  jobs = [],
  unreadChatCount = 0,
  onDismissNotification,
  onDismissAllNotifications,
  onNavigateToJob,
  onOpenChat,
  onSignOut,
  onForceSync,
  isSyncing,
  activeTab,
  onToggleMobileMenu,
  isMobileMenuOpen = false
}: TopUserBannerProps) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<'active' | 'history'>('active');
  const [notifFilter, setNotifFilter] = useState<'all' | 'inspection' | 'quote' | 'jobcard' | 'stores' | 'worksheet'>('all');
  const [tickingId, setTickingId] = useState<string | null>(null);
  const [blockedAlertId, setBlockedAlertId] = useState<string | null>(null);
  const [globalBannerMessage, setGlobalBannerMessage] = useState<string | null>(null);

  // Change Password state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordUpdateError, setPasswordUpdateError] = useState('');
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordUpdateError('');
    setPasswordUpdateSuccess('');

    if (newPassword.length < 6) {
      setPasswordUpdateError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordUpdateError('Passwords do not match.');
      return;
    }

    if (!auth.currentUser) {
      setPasswordUpdateError('No active authentication session.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      setPasswordUpdateSuccess('Your password has been updated and saved successfully.');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setPasswordUpdateSuccess('');
      }, 2000);
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setPasswordUpdateError('For security, please sign out and sign back in before changing your password.');
      } else {
        setPasswordUpdateError(err.message || 'Failed to update password.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const notifMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter notifications relevant to current user's profile access
  const isRelevantForUser = (notif: AppNotification): boolean => {
    if (currentUser.permissions.isAdmin) return true;
    if (!notif.targetPermission || notif.targetPermission === 'all') return true;
    const permKey = notif.targetPermission as keyof UserPermissions;
    return Boolean(currentUser.permissions[permKey]);
  };

  const userRelevantNotifs = notifications.filter(isRelevantForUser);

  const activeNotifs = userRelevantNotifs.filter(
    n => !(n.dismissedBy || []).includes(currentUser.uid)
  );

  const historyNotifs = userRelevantNotifs.filter(
    n => (n.dismissedBy || []).includes(currentUser.uid)
  );

  // Apply sub-filter
  const filteredActiveNotifs = activeNotifs.filter(n => {
    if (notifFilter === 'all') return true;
    if (notifFilter === 'inspection') return n.type === 'job_received' || n.targetPermission === 'canInspect';
    if (notifFilter === 'quote') return n.type === 'quote_needed' || n.targetPermission === 'canQuote';
    if (notifFilter === 'jobcard') return n.type === 'job_card_ready' || n.targetPermission === 'canCreateJobCard';
    if (notifFilter === 'stores') return n.type === 'stores_alert' || n.targetPermission === 'canStores';
    if (notifFilter === 'worksheet') return n.type === 'worksheet_logged' || n.targetPermission === 'canWorksheet';
    return true;
  });

  const filteredHistoryNotifs = historyNotifs.filter(n => {
    if (notifFilter === 'all') return true;
    if (notifFilter === 'inspection') return n.type === 'job_received' || n.targetPermission === 'canInspect';
    if (notifFilter === 'quote') return n.type === 'quote_needed' || n.targetPermission === 'canQuote';
    if (notifFilter === 'jobcard') return n.type === 'job_card_ready' || n.targetPermission === 'canCreateJobCard';
    if (notifFilter === 'stores') return n.type === 'stores_alert' || n.targetPermission === 'canStores';
    if (notifFilter === 'worksheet') return n.type === 'worksheet_logged' || n.targetPermission === 'canWorksheet';
    return true;
  });

  const readyToDismissCount = filteredActiveNotifs.filter(n => checkNotificationProcess(n, jobs).isCompleted).length;

  const handleTickNotification = async (e: React.MouseEvent, notif: AppNotification) => {
    e.stopPropagation();
    const check = checkNotificationProcess(notif, jobs);
    
    if (!check.isCompleted) {
      setBlockedAlertId(prev => prev === notif.id ? null : notif.id);
      setGlobalBannerMessage(null);
      return;
    }

    setBlockedAlertId(null);
    setTickingId(notif.id);
    try {
      await onDismissNotification(notif.id);
    } finally {
      setTimeout(() => setTickingId(null), 300);
    }
  };

  const handleDismissAll = async () => {
    const dismissableNotifs = activeNotifs.filter(n => checkNotificationProcess(n, jobs).isCompleted);
    const incompleteCount = activeNotifs.length - dismissableNotifs.length;

    if (dismissableNotifs.length === 0) {
      setGlobalBannerMessage('Cannot clear alerts: All active tasks are still waiting for their respective workflow processes to be completed.');
      return;
    }

    const ids = dismissableNotifs.map(n => n.id);
    await onDismissAllNotifications(ids);

    if (incompleteCount > 0) {
      setGlobalBannerMessage(`Cleared ${dismissableNotifs.length} completed task${dismissableNotifs.length > 1 ? 's' : ''}. ${incompleteCount} task${incompleteCount > 1 ? 's are' : ' is'} still pending required workflow completion.`);
    } else {
      setGlobalBannerMessage(null);
    }
  };

  const handleNotifClick = (notif: AppNotification) => {
    if (notif.targetTab) {
      onNavigateToJob(notif.targetTab, notif.jobId);
      setIsNotifOpen(false);
    } else if (notif.jobId) {
      onNavigateToJob('enquiries', notif.jobId);
      setIsNotifOpen(false);
    }
  };

  // Helper for role pill labels
  const getClearanceTags = () => {
    const perms = currentUser.permissions;
    if (perms.isAdmin) return ['System Administrator'];
    const tags: string[] = [];
    if (perms.canReceive) tags.push('Receiving');
    if (perms.canInspect) tags.push('Inspection');
    if (perms.canQuote) tags.push('Pre-Quote');
    if (perms.canCreateJobCard) tags.push('Job Admin');
    if (perms.canStores) tags.push('Stores');
    if (perms.canWorksheet) tags.push('Worksheet');
    if (perms.canReporting) tags.push('Reporting');
    if (perms.canClose) tags.push('Job Enquiries');
    return tags.length > 0 ? tags : ['General Operator'];
  };

  const clearanceTags = getClearanceTags();

  // Helper for notification type colors and badges
  const getNotifBadge = (type: string) => {
    switch (type) {
      case 'job_received':
        return { label: 'Arrival / Inspection', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'inspection_needed':
        return { label: 'Pre-Quote Required', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'quote_needed':
        return { label: 'Job Card Pending', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'job_card_ready':
        return { label: 'Workshop Active', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'stores_alert':
        return { label: 'Stores Alert', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'worksheet_logged':
        return { label: 'Timesheet Entry', bg: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
      default:
        return { label: 'Notification', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoDate;
    }
  };

  const userInitial = (currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 text-slate-200 px-3 sm:px-6 h-14 sm:h-[73px] min-h-[56px] sm:min-h-[73px] shadow-sm sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
      {/* LEFT: Mobile Menu Toggle + App Branding + User Profile Info Pill */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu hamburger toggle button */}
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0 border border-slate-750"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-blue-400" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div className="relative shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-inner border border-blue-400/30 shrink-0">
            {userInitial}
          </div>
          <span 
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" 
            title="Online & Real-time Connected" 
          />
        </div>

        <div className="text-left min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="font-bold text-xs sm:text-sm text-white truncate max-w-[110px] xs:max-w-[140px] sm:max-w-[220px]">
              {currentUser.displayName || 'Operator Account'}
            </span>
            {currentUser.permissions.isAdmin ? (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs shrink-0">
                <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span>Admin</span>
              </span>
            ) : (
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md truncate max-w-[90px] sm:max-w-[130px] shrink-0">
                {clearanceTags[0] || 'Operator'}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-mono truncate hidden sm:block">
            {currentUser.email}
          </p>
        </div>
      </div>

      {/* RIGHT: Notifications, Company Chat, Sync, and User Menu */}
      <div className="flex items-center gap-2 shrink-0">
        {/* 1. NOTIFICATION DROPDOWN */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`relative p-2 sm:px-3.5 sm:py-2 rounded-xl border transition-all flex items-center gap-2 cursor-pointer h-9 sm:h-10 ${
              isNotifOpen || activeNotifs.length > 0
                ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750'
                : 'bg-slate-850 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Role-Specific Workflow Notifications"
          >
            <div className="relative">
              <Bell className="w-4 h-4 text-slate-200" />
              {activeNotifs.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-slate-900 animate-pulse">
                  {activeNotifs.length > 9 ? '9+' : activeNotifs.length}
                </span>
              )}
            </div>
            <span className="text-xs font-bold hidden sm:inline">
              Alerts
            </span>
            {activeNotifs.length > 0 && (
              <span className="hidden md:inline-block bg-blue-600/30 text-blue-300 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md border border-blue-500/30">
                {activeNotifs.length}
              </span>
            )}
          </button>

          {/* NOTIFICATION POPOVER PANEL */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-[340px] sm:w-[420px] max-w-[calc(100vw-24px)] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in-50 duration-150 text-left">
              {/* Header */}
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 leading-tight">Role Action Alerts</h3>
                    <p className="text-[10px] text-slate-500">Filtered for your profile permissions</p>
                  </div>
                </div>
                {activeNotifs.length > 0 && notifTab === 'active' && (
                  <button
                    onClick={handleDismissAll}
                    className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                      readyToDismissCount > 0
                        ? 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200'
                        : 'text-slate-400 bg-slate-100 border border-slate-200 hover:bg-slate-200'
                    }`}
                    title={
                      readyToDismissCount > 0
                        ? `Acknowledge ${readyToDismissCount} completed task${readyToDismissCount > 1 ? 's' : ''}`
                        : 'All active alerts have pending workflow steps that must be finished first'
                    }
                  >
                    <CheckCheck className="w-3 h-3" />
                    {readyToDismissCount > 0 ? `Tick Ready (${readyToDismissCount})` : 'Tick All Done'}
                  </button>
                )}
              </div>

              {/* Global Banner Notice (e.g. Incomplete alert notification) */}
              {globalBannerMessage && (
                <div className="p-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-tight font-medium">{globalBannerMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGlobalBannerMessage(null)}
                    className="text-amber-500 hover:text-amber-800 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Tabs: Active vs History */}
              <div className="flex border-b border-slate-200 bg-slate-100/60 p-1 text-xs">
                <button
                  onClick={() => {
                    setNotifTab('active');
                    setGlobalBannerMessage(null);
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    notifTab === 'active'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Inbox className="w-3.5 h-3.5" />
                  Active Tasks ({activeNotifs.length})
                </button>
                <button
                  onClick={() => {
                    setNotifTab('history');
                    setGlobalBannerMessage(null);
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    notifTab === 'history'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  History Log ({historyNotifs.length})
                </button>
              </div>

              {/* Notification Filter Chips */}
              <div className="p-2 border-b border-slate-100 bg-white flex items-center gap-1 overflow-x-auto text-[10px]">
                <span className="text-slate-400 font-bold px-1 shrink-0">Filter:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'inspection', label: 'Inspection' },
                  { id: 'quote', label: 'Pre-Quote' },
                  { id: 'jobcard', label: 'Job Card' },
                  { id: 'stores', label: 'Stores' },
                  { id: 'worksheet', label: 'Worksheets' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setNotifFilter(f.id as any)}
                    className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      notifFilter === f.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Notification List Body */}
              <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
                {notifTab === 'active' ? (
                  filteredActiveNotifs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 mx-auto flex items-center justify-center mb-2 border border-emerald-100">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">All caught up!</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">No pending action items for your role clearances.</p>
                    </div>
                  ) : (
                    filteredActiveNotifs.map(notif => {
                      const badge = getNotifBadge(notif.type);
                      const isTicking = tickingId === notif.id;
                      const processCheck = checkNotificationProcess(notif, jobs);
                      const isBlocked = blockedAlertId === notif.id;

                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleNotifClick(notif)}
                          className={`p-3 transition-colors flex items-start gap-2.5 cursor-pointer group ${
                            isTicking 
                              ? 'bg-emerald-50/60 opacity-60' 
                              : isBlocked 
                                ? 'bg-amber-50/40 border-l-3 border-amber-500' 
                                : 'hover:bg-blue-50/50'
                          }`}
                        >
                          {/* Tick / Mark as Done button */}
                          <button
                            type="button"
                            onClick={(e) => handleTickNotification(e, notif)}
                            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                              processCheck.isCompleted
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white shadow-2xs'
                                : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                            title={
                              processCheck.isCompleted
                                ? 'Tick to acknowledge and archive this completed task'
                                : `Process incomplete: ${processCheck.requiredStageName} must be completed before checking off`
                            }
                          >
                            {processCheck.isCompleted ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Lock className="w-3 h-3 text-amber-600" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-sm border ${badge.bg}`}>
                                {badge.label}
                              </span>

                              {processCheck.isCompleted ? (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.2 rounded-sm flex items-center gap-1">
                                  ✓ Completed
                                </span>
                              ) : (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold px-1.5 py-0.2 rounded-sm flex items-center gap-1">
                                  ⏳ Pending {processCheck.requiredStageName}
                                </span>
                              )}

                              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono shrink-0 ml-auto">
                                <Clock className="w-2.5 h-2.5" />
                                {formatTimeAgo(notif.createdAt)}
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-slate-800 mt-1 leading-snug group-hover:text-blue-600 transition-colors">
                              {notif.title}
                            </h4>
                            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                              {notif.message}
                            </p>

                            {/* Job link chip */}
                            {(notif.jobNo || notif.customerName) && (
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                {notif.jobNo && (
                                  <span className="bg-slate-100 text-slate-700 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-sm border border-slate-200">
                                    Job #{notif.jobNo}
                                  </span>
                                )}
                                {notif.customerName && (
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    • {notif.customerName}
                                  </span>
                                )}
                                <span className="text-[10px] text-blue-600 font-bold ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Open <ArrowUpRight className="w-3 h-3" />
                                </span>
                              </div>
                            )}

                            {/* Incomplete Process Warning Banner if blocked */}
                            {isBlocked && (
                              <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 text-xs flex flex-col gap-2">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <div className="leading-snug">
                                    <p className="font-bold text-amber-900">Process Incomplete</p>
                                    <p className="text-[11px] text-amber-800 mt-0.5">{processCheck.reason}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 justify-end pt-1.5 border-t border-amber-200/70">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBlockedAlertId(null);
                                    }}
                                    className="px-2 py-1 text-[10px] text-amber-800 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                                  >
                                    Dismiss Notice
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (processCheck.targetTab) {
                                        onNavigateToJob(processCheck.targetTab, notif.jobId);
                                        setIsNotifOpen(false);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                  >
                                    Open {processCheck.requiredStageName} <ArrowUpRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  filteredHistoryNotifs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-700">No History Records</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Acknowledged notifications will be archived here.</p>
                    </div>
                  ) : (
                    filteredHistoryNotifs.map(notif => {
                      const badge = getNotifBadge(notif.type);
                      const dismissedTime = notif.dismissedAt?.[currentUser.uid];

                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleNotifClick(notif)}
                          className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5 cursor-pointer opacity-75 hover:opacity-100"
                        >
                          <div className="mt-0.5 w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-sm border ${badge.bg}`}>
                                {badge.label}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono shrink-0">
                                <Clock className="w-2.5 h-2.5" />
                                {formatTimeAgo(notif.createdAt)}
                              </span>
                            </div>

                            <h4 className="text-xs font-semibold text-slate-700 mt-1 leading-snug">
                              {notif.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {notif.message}
                            </p>
                            {dismissedTime && (
                              <p className="text-[9px] text-emerald-600 font-medium mt-1">
                                ✓ Acknowledged {formatTimeAgo(dismissedTime)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>

              {/* Footer info */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400">
                Automatic synchronization across all workshop operators
              </div>
            </div>
          )}
        </div>

        {/* 2. COMPANY GROUP CHAT BUTTON */}
        <button
          onClick={onOpenChat}
          className={`relative px-3 sm:px-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 h-9 sm:h-10 ${
            unreadChatCount > 0
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/40 shadow-xs ring-2 ring-blue-400/30'
              : 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600'
          }`}
          title={unreadChatCount > 0 ? `${unreadChatCount} unread message${unreadChatCount > 1 ? 's' : ''} in Company Chat` : 'Open Workshop Company Group Chat'}
        >
          <div className="relative">
            <MessageSquare className="w-4 h-4" />
            {unreadChatCount > 0 ? (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
            ) : (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full ring-1 ring-slate-900" />
            )}
          </div>
          <span className="hidden sm:inline">
            Company Chat
          </span>
          {unreadChatCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-xs animate-pulse">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* 3. SYNC BUTTON */}
        <button
          onClick={onForceSync}
          disabled={isSyncing}
          className="h-9 sm:h-10 w-9 sm:w-10 flex items-center justify-center text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-slate-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          title="Sync with Cloud Database"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
        </button>

        {/* 4. USER PROFILE QUICK MENU */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="h-9 sm:h-10 flex items-center gap-1.5 px-2 sm:px-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-slate-700 rounded-xl text-slate-200 transition-all cursor-pointer"
          >
            <div className="w-6 h-6 rounded-lg bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center">
              {userInitial}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in-50 duration-150 text-left">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {currentUser.displayName || 'Operator Account'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                  {currentUser.email}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {clearanceTags.map((tag, i) => (
                    <span key={i} className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-2 space-y-1">
                {currentUser.permissions.isAdmin && (
                  <>
                    <div className="px-3 pt-1 pb-1 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Administration
                    </div>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        onNavigateToJob('admin');
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
                        activeTab === 'admin'
                          ? 'bg-blue-600 text-white'
                          : 'text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      <Shield className={`w-3.5 h-3.5 ${activeTab === 'admin' ? 'text-white' : 'text-blue-600'}`} />
                      Admin Center
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                  </>
                )}
                <div className="px-3 py-1.5 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Session & Account
                </div>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsChangePasswordOpen(true);
                    setPasswordUpdateError('');
                    setPasswordUpdateSuccess('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  Change Password
                </button>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onForceSync();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  Refresh Workshop Data
                </button>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onSignOut();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out of ERP
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-left animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-display">Change Password</h3>
                  <p className="text-xs text-slate-500 font-mono">{currentUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {passwordUpdateError && (
              <div className="bg-red-50 text-red-800 border border-red-200 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{passwordUpdateError}</span>
              </div>
            )}

            {passwordUpdateSuccess && (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{passwordUpdateSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password (Min 6 characters)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-9 pr-10 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                </div>
                {newPassword && confirmNewPassword && (
                  <p className={`text-[10px] font-bold mt-1 ${newPassword === confirmNewPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                    {newPassword === confirmNewPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword || (Boolean(newPassword) && Boolean(confirmNewPassword) && newPassword !== confirmNewPassword)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-55"
                >
                  {isUpdatingPassword ? 'Saving Password...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
