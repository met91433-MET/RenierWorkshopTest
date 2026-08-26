import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { 
  UserProfile, 
  Job, 
  Customer, 
  Machine,
  ComponentMatrix, 
  CustomColumn, 
  UserPermissions,
  JobCardFormatConfig,
  DEFAULT_JOB_CARD_FORMAT,
  AppNotification,
  ChatMessage
} from './types';
import { playChatNotificationSound } from './utils/soundEffects';
import { 
  getJobs, 
  getCustomers, 
  getMachines,
  getComponentMatrices, 
  getCustomColumns, 
  getAllUsers, 
  getUserProfile,
  seedDatabaseIfEmpty,
  saveJob,
  saveCustomer,
  saveMachine,
  deleteMachine,
  deleteAllMachines,
  deleteJob,
  deleteAllJobs,
  saveCustomColumns,
  saveComponentMatrix,
  updateUserPermissions,
  deleteCustomer,
  deleteComponentMatrix,
  saveUserProfile,
  getJobCardFormatConfig,
  saveJobCardFormatConfig,
  subscribeJobs,
  subscribeCustomers,
  subscribeMachines,
  subscribeComponentMatrices,
  subscribeCustomColumns,
  subscribeJobCardFormatConfig,
  subscribeUsers,
  subscribeNotifications,
  subscribeChatMessages,
  markNotificationDismissed,
  markAllNotificationsDismissed,
  sendChatMessage,
  toggleChatReaction,
  createNotification
} from './dbService';

import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import ReceivingView from './components/ReceivingView';
import InspectionView from './components/InspectionView';
import PreQuoteView from './components/PreQuoteView';
import JobCardView from './components/JobCardView';
import JobEnquiriesView from './components/JobEnquiriesView';
import AllJobsView from './components/AllJobsView';
import AdminCenterView from './components/AdminCenterView';
import StoresDashboardView from './components/StoresDashboardView';
import WorksheetDashboardView from './components/WorksheetDashboardView';
import WorksheetReportsView from './components/WorksheetReportsView';
import TopUserBanner from './components/TopUserBanner';
import CompanyChatDrawer from './components/CompanyChatDrawer';

import { 
  Wrench, 
  LayoutDashboard, 
  FileSpreadsheet, 
  ClipboardCheck, 
  Calculator, 
  CalendarRange, 
  Archive, 
  ShieldAlert, 
  LogOut, 
  User, 
  RefreshCw, 
  Clock,
  Lock,
  Search,
  Menu,
  X,
  Boxes,
  BookOpen,
  BarChart3
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Core ERP State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [componentsList, setComponentsList] = useState<ComponentMatrix[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [jobCardFormat, setJobCardFormat] = useState<JobCardFormatConfig>(() => {
    try {
      const saved = localStorage.getItem('job_card_format_config_v1');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error loading cached job card format:", e);
    }
    return DEFAULT_JOB_CARD_FORMAT;
  });

  // Notifications & Company Group Chat State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [lastReadChatTimestamp, setLastReadChatTimestamp] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('workshop_chat_last_read_active');
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Track known chat message IDs to play sound ONLY for newly received messages
  const knownChatMessageIdsRef = useRef<Set<string>>(new Set());
  const initialChatLoadedRef = useRef<boolean>(false);
  const isChatOpenRef = useRef<boolean>(false);
  isChatOpenRef.current = isChatOpen;

  // Navigation & Toggle State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showInactiveJobs, setShowInactiveJobs] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Shared Job context (when jumping from dashboard to inspection/quote, etc.)
  const [selectedJobContext, setSelectedJobContext] = useState<Job | null>(null);

  // 1. Listen to Firebase Auth and run database seeding
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        // Run database seeding if this is the first ever run
        await seedDatabaseIfEmpty();
        // Load user profile permissions
        const profile = await getUserProfile(firebaseUser.uid);
        
        if (profile) {
          setUserProfile(profile);
        } else {
          // If no profile exists yet in the database, check if we already have it in the state
          // (which can happen during registration's onLoginSuccess).
          setUserProfile((currentProfile) => {
            if (currentProfile && currentProfile.uid === firebaseUser.uid) {
              return currentProfile;
            }
            
            // Otherwise, dynamically create a safe fallback profile in Firestore
            const isEmailAdmin = firebaseUser.email?.toLowerCase().includes('admin') || false;
            const defaultPerms: UserPermissions = {
              canReceive: isEmailAdmin,
              canInspect: isEmailAdmin,
              canQuote: isEmailAdmin,
              canCreateJobCard: isEmailAdmin,
              canStores: isEmailAdmin,
              canWorksheet: isEmailAdmin,
              canReporting: isEmailAdmin,
              canClose: isEmailAdmin,
              isAdmin: isEmailAdmin
            };
            
            const fallbackProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Operator',
              permissions: defaultPerms,
              createdAt: new Date().toISOString()
            };
            
            // Save to Firestore in background
            saveUserProfile(fallbackProfile).catch(err => {
              console.error("Error creating fallback profile:", err);
            });
            
            return fallbackProfile;
          });
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-Time Auto-Sync Subscriptions for all ERP database data
  useEffect(() => {
    if (!user || !userProfile) return;

    let unsubs: (() => void)[] = [];
    setDataLoading(true);

    const initAndSubscribe = async () => {
      try {
        // Clean up test jobs if they were seeded in the previous test run
        const TEST_PURGE_KEY = 'mes_test_jobs_reverted_v1';
        if (!localStorage.getItem(TEST_PURGE_KEY)) {
          const testIds = ['JOB-2026-REC01', 'JOB-2026-INS02', 'JOB-2026-QUO03', 'JOB-2026-JCD04', 'JOB-2026-CLS05'];
          for (const tid of testIds) {
            try {
              await deleteJob(tid);
            } catch {
              // ignore
            }
          }
          localStorage.setItem(TEST_PURGE_KEY, 'true');
        }
      } catch (err) {
        console.error("Cleanup check error:", err);
      }

      // Establish real-time auto-sync listeners
      unsubs.push(subscribeJobs((fetchedJobs) => {
        setJobs(fetchedJobs);
        setDataLoading(false);
      }));

      unsubs.push(subscribeCustomers((fetchedCustomers) => {
        setCustomers(fetchedCustomers);
      }));

      unsubs.push(subscribeMachines((fetchedMachines) => {
        setMachines(fetchedMachines);
      }));

      unsubs.push(subscribeComponentMatrices((fetchedComponents) => {
        setComponentsList(fetchedComponents);
      }));

      unsubs.push(subscribeCustomColumns((fetchedCustomCols) => {
        setCustomColumns(fetchedCustomCols);
      }));

      unsubs.push(subscribeJobCardFormatConfig((fetchedFormat) => {
        setJobCardFormat(fetchedFormat);
      }));

      unsubs.push(subscribeNotifications((fetchedNotifs) => {
        setNotifications(fetchedNotifs);
      }));

      unsubs.push(subscribeChatMessages((fetchedMsgs) => {
        setChatMessages(fetchedMsgs);

        // First initial batch: record existing message IDs without playing sound
        if (!initialChatLoadedRef.current) {
          initialChatLoadedRef.current = true;
          fetchedMsgs.forEach(m => knownChatMessageIdsRef.current.add(m.id));
        } else {
          // Identify newly arrived messages
          const newMessages = fetchedMsgs.filter(m => !knownChatMessageIdsRef.current.has(m.id));
          if (newMessages.length > 0) {
            // Check if any newly arrived message was sent by someone other than current user
            const hasFromOtherUser = newMessages.some(m => !userProfile || m.senderUid !== userProfile.uid);
            if (hasFromOtherUser) {
              playChatNotificationSound();
            }
            // Update known messages set
            newMessages.forEach(m => knownChatMessageIdsRef.current.add(m.id));
          }
        }
      }));

      if (userProfile.permissions.isAdmin) {
        unsubs.push(subscribeUsers((fetchedUsers) => {
          setUsersList(fetchedUsers);
        }));
      }
    };

    initAndSubscribe();

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [user, userProfile?.uid, userProfile?.permissions.isAdmin]);

  // Sync lastReadChatTimestamp with user profile
  useEffect(() => {
    if (userProfile?.uid) {
      try {
        const stored = localStorage.getItem(`workshop_chat_last_read_${userProfile.uid}`);
        if (stored) {
          setLastReadChatTimestamp(parseInt(stored, 10));
        } else {
          // First time this user signs in, mark historical messages as read
          const now = Date.now();
          setLastReadChatTimestamp(now);
          localStorage.setItem(`workshop_chat_last_read_${userProfile.uid}`, now.toString());
        }
      } catch {
        // ignore
      }
    }
  }, [userProfile?.uid]);

  // When chat drawer is open, keep lastReadChatTimestamp updated to now
  useEffect(() => {
    if (isChatOpen) {
      const now = Date.now();
      setLastReadChatTimestamp(now);
      if (userProfile?.uid) {
        try {
          localStorage.setItem(`workshop_chat_last_read_${userProfile.uid}`, now.toString());
        } catch {}
      }
    }
  }, [isChatOpen, chatMessages.length, userProfile?.uid]);

  // Compute unread chat count - only counts messages from other users newer than lastReadChatTimestamp
  const unreadChatCount = isChatOpen
    ? 0
    : chatMessages.filter(m => {
        if (userProfile && m.senderUid === userProfile.uid) return false;
        const msgTime = new Date(m.createdAt).getTime();
        return !isNaN(msgTime) && msgTime > lastReadChatTimestamp;
      }).length;

  const loadAllERPData = async () => {
    setDataLoading(true);
    try {
      const [fetchedJobs, fetchedCustomers, fetchedMachines, fetchedComponents, fetchedCustomCols, fetchedFormat] = await Promise.all([
        getJobs(),
        getCustomers(),
        getMachines(),
        getComponentMatrices(),
        getCustomColumns(),
        getJobCardFormatConfig()
      ]);
      setJobs(fetchedJobs);
      setCustomers(fetchedCustomers);
      setMachines(fetchedMachines);
      setComponentsList(fetchedComponents);
      setCustomColumns(fetchedCustomCols);
      setJobCardFormat(fetchedFormat);

      if (userProfile?.permissions.isAdmin) {
        const fetchedUsers = await getAllUsers();
        setUsersList(fetchedUsers);
      }
    } catch (e) {
      console.error("Error force syncing ERP data:", e);
    } finally {
      setDataLoading(false);
    }
  };

  const handleDeleteJob = async (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    try {
      await deleteJob(id);
    } catch (err) {
      console.error("Error deleting job:", err);
    }
  };

  const handleDeleteAllJobs = async () => {
    setJobs([]);
    try {
      await deleteAllJobs();
    } catch (err) {
      console.error("Error deleting all jobs:", err);
    }
  };

  // 3. User Sign Out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setActiveTab('dashboard');
    } catch (e) {
      console.error("Error signing out:", e);
    }
  };

  // 4. Handle Save Actions with Stage-Transition Automated Workflow Notifications
  const handleSaveJobs = async (newJobs: Job[]) => {
    for (const job of newJobs) {
      await saveJob(job);
      const displayJobNo = job.jobCardDetails?.jobCardNumber || job.id;

      // Trigger automatic workflow notification for Inspectors
      await createNotification({
        type: 'job_received',
        targetPermission: 'canInspect',
        targetTab: 'inspection',
        jobId: job.id,
        jobNo: displayJobNo,
        customerName: job.customerName,
        componentName: job.componentType,
        title: 'New Component Arrived for Inspection',
        message: `Job #${displayJobNo} (${job.componentType || 'Component'}) for ${job.customerName || 'Customer'} has arrived from receiving and is awaiting technical inspection.`,
        createdByUid: userProfile?.uid || 'receiver',
        createdByName: userProfile?.displayName || userProfile?.email || 'Receiving Desk'
      }).catch(err => console.error("Notification creation failed:", err));
    }
    setActiveTab('dashboard'); // Redirect to dashboard to see newly captured jobs
  };

  const handleUpdateJob = async (updatedJob: Job) => {
    const previousJob = jobs.find(j => j.id === updatedJob.id);
    await saveJob(updatedJob);
    const displayJobNo = updatedJob.jobCardDetails?.jobCardNumber || updatedJob.id;

    // Check stage transitions to alert relevant roles:
    if (previousJob) {
      // 1. If moved to Inspected -> Alert Quoting Estimators
      if (previousJob.status !== 'Inspected' && updatedJob.status === 'Inspected') {
        await createNotification({
          type: 'inspection_needed',
          targetPermission: 'canQuote',
          targetTab: 'quoting',
          jobId: updatedJob.id,
          jobNo: displayJobNo,
          customerName: updatedJob.customerName,
          componentName: updatedJob.componentType,
          title: 'Inspection Completed - Pre-Quote Needed',
          message: `Job #${displayJobNo} inspection has been completed by ${userProfile?.displayName || 'Inspector'}. Ready for Pre-Quote calculation.`,
          createdByUid: userProfile?.uid || 'inspector',
          createdByName: userProfile?.displayName || userProfile?.email || 'Technical Inspector'
        }).catch(err => console.error("Notification creation failed:", err));
      }
      // 2. If moved to PreQuoted -> Alert Job Card Creators
      else if (previousJob.status !== 'PreQuoted' && updatedJob.status === 'PreQuoted') {
        await createNotification({
          type: 'quote_needed',
          targetPermission: 'canCreateJobCard',
          targetTab: 'jobcard',
          jobId: updatedJob.id,
          jobNo: displayJobNo,
          customerName: updatedJob.customerName,
          componentName: updatedJob.componentType,
          title: 'Pre-Quote Complete - Job Card Ready',
          message: `Pre-quote for Job #${displayJobNo} (${updatedJob.componentType || 'Component'}) is approved. Ready for Job Card creation.`,
          createdByUid: userProfile?.uid || 'quoter',
          createdByName: userProfile?.displayName || userProfile?.email || 'Estimating Desk'
        }).catch(err => console.error("Notification creation failed:", err));
      }
      // 3. If Job Card is created / active in workshop -> Alert Workshop and Stores
      else if (previousJob.status !== 'JobCardCreated' && updatedJob.status === 'JobCardCreated') {
        await createNotification({
          type: 'job_card_ready',
          targetPermission: 'canWorksheet',
          targetTab: 'worksheet',
          jobId: updatedJob.id,
          jobNo: displayJobNo,
          customerName: updatedJob.customerName,
          componentName: updatedJob.componentType,
          title: 'Job Card Active in Workshop',
          message: `Job Card #${displayJobNo} is now active in production. Operators can log machine timesheets and allocate parts.`,
          createdByUid: userProfile?.uid || 'planner',
          createdByName: userProfile?.displayName || userProfile?.email || 'Production Planner'
        }).catch(err => console.error("Notification creation failed:", err));
      }
    }
  };

  // Notification Dismissal Handlers
  const handleDismissNotification = async (notificationId: string) => {
    if (!userProfile) return;
    // Optimistic UI state update
    setNotifications(prev => prev.map(n => {
      if (n.id === notificationId) {
        const dismissedBy = Array.from(new Set([...(n.dismissedBy || []), userProfile.uid]));
        const dismissedAt = { ...(n.dismissedAt || {}), [userProfile.uid]: new Date().toISOString() };
        return { ...n, dismissedBy, dismissedAt };
      }
      return n;
    }));
    await markNotificationDismissed(notificationId, userProfile.uid);
  };

  const handleDismissAllNotifications = async (notificationIds: string[]) => {
    if (!userProfile) return;
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => {
      if (notificationIds.includes(n.id)) {
        const dismissedBy = Array.from(new Set([...(n.dismissedBy || []), userProfile.uid]));
        const dismissedAt = { ...(n.dismissedAt || {}), [userProfile.uid]: now };
        return { ...n, dismissedBy, dismissedAt };
      }
      return n;
    }));
    await markAllNotificationsDismissed(notificationIds, userProfile.uid);
  };

  // Navigation from Notification click
  const handleNavigateFromNotification = (targetTab: string, jobId?: string) => {
    if (jobId) {
      const foundJob = jobs.find(j => j.id === jobId || j.jobCardDetails?.jobCardNumber === jobId);
      if (foundJob) {
        setSelectedJobContext(foundJob);
      }
    }
    setActiveTab(targetTab);
  };

  // Company Group Chat Handlers
  const handleSendMessage = async ({ text, imageUrl }: { text: string; imageUrl?: string }) => {
    if (!userProfile) return;
    const roleName = userProfile.permissions.isAdmin 
      ? 'Administrator' 
      : userProfile.permissions.canInspect 
        ? 'Inspector' 
        : userProfile.permissions.canQuote 
          ? 'Estimator' 
          : userProfile.permissions.canStores
            ? 'Stores'
            : 'Operator';

    await sendChatMessage({
      senderUid: userProfile.uid,
      senderName: userProfile.displayName || userProfile.email.split('@')[0],
      senderEmail: userProfile.email,
      senderRole: roleName,
      text,
      imageUrl
    });
  };

  const handleToggleChatReaction = async (messageId: string, emoji: string) => {
    if (!userProfile) return;
    await toggleChatReaction(messageId, emoji, userProfile.uid);
  };

  const handleSaveCustomer = async (cust: Customer) => {
    await saveCustomer(cust);
  };

  const handleDeleteCustomer = async (id: string) => {
    await deleteCustomer(id);
  };

  const handleSaveMachine = async (mach: Machine) => {
    await saveMachine(mach);
  };

  const handleDeleteMachine = async (id: string) => {
    await deleteMachine(id);
  };

  const handleDeleteAllMachines = async () => {
    await deleteAllMachines();
  };

  const handleSaveCustomColumns = async (cols: CustomColumn[]) => {
    await saveCustomColumns(cols);
  };

  const handleSaveComponentMatrix = async (matrix: ComponentMatrix) => {
    await saveComponentMatrix(matrix);
  };

  const handleDeleteComponentMatrix = async (id: string) => {
    await deleteComponentMatrix(id);
  };

  const handleUpdateUserPermissions = async (uid: string, perms: UserPermissions) => {
    await updateUserPermissions(uid, perms);
  };

  const handleSaveJobCardFormat = async (config: JobCardFormatConfig) => {
    setJobCardFormat(config);
    await saveJobCardFormatConfig(config);
  };

  // Jump context from dashboard action buttons
  const handleSelectJobFromDashboard = (job: Job, targetTab: string) => {
    setSelectedJobContext(job);
    setActiveTab(targetTab);
  };

  // Helper check for authorization
  const hasAccess = (tabName: string): boolean => {
    if (!userProfile) return false;
    const p = userProfile.permissions;
    if (p.isAdmin) return true; // Admins have full override permission!

    switch (tabName) {
      case 'dashboard':
        return true; // Everyone can view the primary dashboard
      case 'receiving':
        return !!p.canReceive;
      case 'inspection':
        return !!p.canInspect;
      case 'quoting':
        return !!p.canQuote;
      case 'jobcard':
        return !!p.canCreateJobCard;
      case 'stores':
        return !!p.canStores;
      case 'worksheet':
        return !!p.canWorksheet;
      case 'reporting':
        return !!p.canReporting;
      case 'enquiries':
        return true; // Read-only enquiries open to all authenticated users
      case 'closing':
        return !!p.canClose;
      case 'admin':
        return !!p.isAdmin;
      default:
        return false;
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <div className="bg-blue-600 p-3 rounded-2xl mb-4 animate-bounce">
          <Wrench className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold font-display">MES Workshop3 Repair ERP</h2>
        <p className="text-slate-400 text-xs mt-2 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Connecting to secure workshop cloud...
        </p>
      </div>
    );
  }

  // If no authenticated user, render the Login/Registration view
  if (!user || !userProfile) {
    return (
      <LoginView 
        onLoginSuccess={(profile) => {
          setUserProfile(profile);
        }} 
      />
    );
  }

  // Navigation Items
  const navigationItems = [
    { id: 'dashboard', label: 'Workplace Overview', icon: LayoutDashboard },
    { id: 'receiving', label: '1. Receiving', icon: FileSpreadsheet, stage: 'Stage 1' },
    { id: 'inspection', label: '2. Inspection', icon: ClipboardCheck, stage: 'Stage 2' },
    { id: 'quoting', label: '3. Pre-Quote', icon: Calculator, stage: 'Stage 3' },
    { id: 'jobcard', label: '4. Job Card', icon: CalendarRange, stage: 'Stage 4' },
    { id: 'enquiries', label: 'Job Enquiries', icon: Search },
    { id: 'worksheet', label: 'Worksheet', icon: BookOpen, stage: 'Workshop' },
    { id: 'reporting', label: 'Reporting', icon: BarChart3, stage: 'Analytics' },
    { id: 'stores', label: 'Stores & Tool Stock', icon: Boxes, stage: 'Inventory' },
  ];

  // Only render menu items that the logged in user is authorized to access
  const visibleNavItems = navigationItems.filter(item => hasAccess(item.id));

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col md:flex-row bg-slate-50 font-sans" id="app-container">
      {/* MOBILE TOP NAVIGATION HEADER */}
      <header className="md:hidden bg-slate-900 text-slate-200 px-4 py-3 border-b border-slate-800 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight font-display text-white">MES Workshop3</h2>
            <p className="text-[9px] text-slate-400">Repair ERP</p>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* MOBILE MENU BACKDROP OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION PANEL (Responsive slide-over on mobile, fixed on desktop) */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-850 flex-shrink-0 h-full transform transition-transform duration-200 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`} 
        id="sidebar-panel"
      >
        {/* Sidebar Header / Logo */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight font-display text-white">MES Workshop3</h2>
              <p className="text-[10px] text-slate-400 font-medium">Repair Tracking ERP</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sidebar List */}
        <nav className="flex-1 p-3 md:p-4 space-y-1 overflow-y-auto text-left">
          {visibleNavItems.map((item) => {
            const IconComponent = item.icon;
            const isSelected = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedJobContext(null); // Clear context on tab change
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-xl tracking-tight transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <IconComponent className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.stage && !isSelected && (
                  <span className="text-[9px] font-bold bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-sm border border-slate-750">
                    {item.stage}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Refresh / Logout Footer */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={loadAllERPData}
            disabled={dataLoading}
            className="w-full flex items-center gap-2.5 justify-center py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 cursor-pointer min-h-[40px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? 'animate-spin' : ''}`} />
            {dataLoading ? 'Syncing...' : 'Force Sync Server'}
          </button>
          
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 justify-center py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-slate-800 hover:border-red-900 rounded-xl transition-all cursor-pointer min-h-[40px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out of ERP
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN WORKPLACE COLUMN (Top Banner + Content View) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full" id="main-workplace-container">
        {/* TOP BANNER: Logged in User + Role-Based Notification Bell & Center + Company Group Chat Button */}
        <TopUserBanner
          currentUser={userProfile}
          notifications={notifications}
          chatMessages={chatMessages}
          unreadChatCount={unreadChatCount}
          onDismissNotification={handleDismissNotification}
          onDismissAllNotifications={handleDismissAllNotifications}
          onNavigateToJob={handleNavigateFromNotification}
          onOpenChat={() => {
            setIsChatOpen(true);
            const now = Date.now();
            setLastReadChatTimestamp(now);
            if (userProfile?.uid) {
              try {
                localStorage.setItem(`workshop_chat_last_read_${userProfile.uid}`, now.toString());
              } catch {}
            }
          }}
          onSignOut={handleSignOut}
          onForceSync={loadAllERPData}
          isSyncing={dataLoading}
          activeTab={activeTab}
        />

        {/* SCROLLABLE MAIN VIEW AREA */}
        <main className="flex-1 p-3 sm:p-5 lg:p-7 overflow-y-auto w-full">
          {dataLoading && (
            <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 py-1.5 px-4 rounded-full w-fit flex items-center gap-2 mb-4">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Syncing database records with MES Workshop...
            </div>
          )}

          {/* 1. If tab is Gated and user lacks permission: Render Access Restricted warning */}
          {!hasAccess(activeTab) ? (
            <div className="bg-white rounded-2xl border-2 border-red-200 shadow-md p-12 text-center max-w-xl mx-auto mt-12 text-left">
              <div className="bg-red-50 text-red-600 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-5 border border-red-100 shadow-sm">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 font-display text-center">ERP Clearance Restricted</h2>
              <p className="text-slate-500 text-sm mt-3 leading-relaxed text-center">
                You are signed in as <strong>{userProfile.displayName || userProfile.email}</strong>, but your account lacks the authorized clearance flag required for this stage:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-5 space-y-2 text-xs text-slate-600">
                <p><strong>Attempted Stage Access:</strong> {activeTab.toUpperCase()}</p>
                <p><strong>Required Permissions:</strong> Contact an Administrator to enable the <strong>'{activeTab}'</strong> toggle in the Admin Center.</p>
              </div>
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            /* 2. Otherwise: Render authorized views */
            <div className="space-y-6">
              {activeTab === 'dashboard' && (
                <DashboardView 
                  jobs={jobs} 
                  machines={machines}
                  currentUser={userProfile} 
                  onSelectJob={handleSelectJobFromDashboard}
                  onNavigateToStores={() => setActiveTab('stores')}
                  onSaveMachine={handleSaveMachine}
                />
              )}

              {activeTab === 'worksheet' && (
                <WorksheetDashboardView
                  jobs={jobs}
                  machines={machines}
                  customers={customers}
                  componentsList={componentsList}
                  currentUser={userProfile}
                  onSaveMachine={handleSaveMachine}
                  onSelectJob={(job) => {
                    setSelectedJobContext(job);
                    setActiveTab('enquiries');
                  }}
                />
              )}

              {activeTab === 'reporting' && (
                <WorksheetReportsView
                  jobs={jobs}
                  machines={machines}
                  customers={customers}
                  componentsList={componentsList}
                  currentUser={userProfile}
                  onSelectJob={(job) => {
                    setSelectedJobContext(job);
                    setActiveTab('enquiries');
                  }}
                />
              )}

              {activeTab === 'stores' && (
                <StoresDashboardView
                  currentUser={userProfile}
                  jobs={jobs}
                  machines={machines}
                />
              )}

              {activeTab === 'receiving' && (
                <ReceivingView 
                  customers={customers} 
                  componentsList={componentsList} 
                  customColumns={customColumns} 
                  onSaveJobs={handleSaveJobs}
                  currentUser={userProfile}
                  existingJobs={jobs}
                />
              )}

              {activeTab === 'inspection' && (
                <InspectionView 
                  jobs={selectedJobContext ? [selectedJobContext, ...jobs.filter(j => j.id !== selectedJobContext.id)] : jobs}
                  onUpdateJob={handleUpdateJob}
                  currentUser={userProfile}
                  initialJob={selectedJobContext}
                />
              )}

              {activeTab === 'quoting' && (
                <PreQuoteView 
                  jobs={selectedJobContext ? [selectedJobContext, ...jobs.filter(j => j.id !== selectedJobContext.id)] : jobs}
                  componentsList={componentsList}
                  onUpdateJob={handleUpdateJob}
                  currentUser={userProfile}
                  initialJob={selectedJobContext}
                />
              )}

              {activeTab === 'jobcard' && (
                <JobCardView 
                  jobs={selectedJobContext ? [selectedJobContext, ...jobs.filter(j => j.id !== selectedJobContext.id)] : jobs}
                  onUpdateJob={handleUpdateJob}
                  currentUser={userProfile}
                  jobCardFormat={jobCardFormat}
                  initialJob={selectedJobContext}
                />
              )}

              {(activeTab === 'enquiries' || activeTab === 'closing') && (
                <JobEnquiriesView 
                  jobs={selectedJobContext ? [selectedJobContext, ...jobs.filter(j => j.id !== selectedJobContext.id)] : jobs}
                  customColumns={customColumns}
                  componentsList={componentsList}
                  onUpdateJob={handleUpdateJob}
                  onDeleteJob={handleDeleteJob}
                  onDeleteAllJobs={handleDeleteAllJobs}
                  currentUser={userProfile}
                  jobCardFormat={jobCardFormat}
                />
              )}

              {activeTab === 'admin' && (
                <AdminCenterView 
                  users={usersList}
                  customers={customers}
                  machines={machines}
                  jobs={jobs}
                  componentsList={componentsList}
                  customColumns={customColumns}
                  jobCardFormat={jobCardFormat}
                  onUpdateUserPermissions={handleUpdateUserPermissions}
                  onSaveCustomColumns={handleSaveCustomColumns}
                  onSaveCustomer={handleSaveCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                  onSaveMachine={handleSaveMachine}
                  onDeleteMachine={handleDeleteMachine}
                  onDeleteAllMachines={handleDeleteAllMachines}
                  onSaveComponentMatrix={handleSaveComponentMatrix}
                  onDeleteComponentMatrix={handleDeleteComponentMatrix}
                  onSaveJobCardFormat={handleSaveJobCardFormat}
                  onSelectJob={(job) => {
                    setSelectedJobContext(job);
                    setActiveTab('jobcard');
                  }}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* COMPANY GROUP CHAT DRAWER */}
      <CompanyChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        currentUser={userProfile}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        onToggleReaction={handleToggleChatReaction}
        allUsers={usersList}
      />
    </div>
  );
}
