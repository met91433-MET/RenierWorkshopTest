import React, { useState, useRef, useEffect } from 'react';
import { 
  UserProfile, 
  AppNotification, 
  ChatMessage, 
  UserPermissions 
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
  X
} from 'lucide-react';

interface TopUserBannerProps {
  currentUser: UserProfile;
  notifications: AppNotification[];
  chatMessages: ChatMessage[];
  unreadChatCount?: number;
  onDismissNotification: (notificationId: string) => Promise<void>;
  onDismissAllNotifications: (notificationIds: string[]) => Promise<void>;
  onNavigateToJob: (tab: string, jobId?: string) => void;
  onOpenChat: () => void;
  onSignOut: () => void;
  onForceSync: () => void;
  isSyncing: boolean;
  activeTab: string;
}

export default function TopUserBanner({
  currentUser,
  notifications,
  chatMessages,
  unreadChatCount = 0,
  onDismissNotification,
  onDismissAllNotifications,
  onNavigateToJob,
  onOpenChat,
  onSignOut,
  onForceSync,
  isSyncing,
  activeTab
}: TopUserBannerProps) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<'active' | 'history'>('active');
  const [notifFilter, setNotifFilter] = useState<'all' | 'inspection' | 'quote' | 'jobcard' | 'stores' | 'worksheet'>('all');
  const [tickingId, setTickingId] = useState<string | null>(null);

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

  const handleTickNotification = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    setTickingId(notifId);
    try {
      await onDismissNotification(notifId);
    } finally {
      setTimeout(() => setTickingId(null), 300);
    }
  };

  const handleDismissAll = async () => {
    const ids = activeNotifs.map(n => n.id);
    if (ids.length === 0) return;
    await onDismissAllNotifications(ids);
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
    <div className="w-full bg-slate-900 border-b border-slate-800 text-slate-200 px-3 sm:px-5 py-2.5 shadow-sm sticky top-0 z-30 flex items-center justify-between gap-3 shrink-0">
      {/* LEFT: User Profile Info Pill */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-sm flex items-center justify-center shadow-inner border border-blue-400/30 shrink-0">
            {userInitial}
          </div>
          <span 
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" 
            title="Online & Real-time Connected" 
          />
        </div>

        <div className="text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs sm:text-sm text-white truncate max-w-[150px] sm:max-w-[220px]">
              {currentUser.displayName || 'Operator Account'}
            </span>
            {currentUser.permissions.isAdmin ? (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                <Shield className="w-3 h-3" />
                Administrator
              </span>
            ) : (
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[130px]">
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
            className={`relative p-2 sm:px-3 sm:py-1.5 rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${
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
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                    title="Acknowledge all notifications"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Tick All Done
                  </button>
                )}
              </div>

              {/* Tabs: Active vs History */}
              <div className="flex border-b border-slate-200 bg-slate-100/60 p-1 text-xs">
                <button
                  onClick={() => setNotifTab('active')}
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
                  onClick={() => setNotifTab('history')}
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

                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleNotifClick(notif)}
                          className={`p-3 transition-colors flex items-start gap-2.5 cursor-pointer group ${
                            isTicking ? 'bg-emerald-50/60 opacity-60' : 'hover:bg-blue-50/50'
                          }`}
                        >
                          {/* Tick / Mark as Done button */}
                          <button
                            type="button"
                            onClick={(e) => handleTickNotification(e, notif.id)}
                            className="mt-0.5 w-5 h-5 rounded-md border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-transparent hover:text-emerald-600 flex items-center justify-center transition-all shrink-0 cursor-pointer group/tick"
                            title="Tick to acknowledge & move to History Log"
                          >
                            <Check className="w-3.5 h-3.5 group-hover/tick:text-emerald-600 transition-colors" />
                          </button>

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
          className={`relative px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
            unreadChatCount > 0
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/40 shadow-xs ring-2 ring-blue-400/30'
              : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700 hover:border-slate-600'
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
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          title="Sync with Cloud Database"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
        </button>

        {/* 4. USER PROFILE QUICK MENU */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-1.5 p-1 sm:px-2 py-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-slate-200 transition-all cursor-pointer"
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
    </div>
  );
}
