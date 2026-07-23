import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { 
  UserProfile, 
  Job, 
  Customer, 
  ComponentMatrix, 
  CustomColumn, 
  UserPermissions,
  JobCardFormatConfig,
  DEFAULT_JOB_CARD_FORMAT 
} from './types';
import { 
  getJobs, 
  getCustomers, 
  getComponentMatrices, 
  getCustomColumns, 
  getAllUsers, 
  getUserProfile,
  seedDatabaseIfEmpty,
  saveJob,
  saveCustomer,
  saveCustomColumns,
  saveComponentMatrix,
  updateUserPermissions,
  deleteCustomer,
  deleteComponentMatrix,
  saveUserProfile,
  getJobCardFormatConfig,
  saveJobCardFormatConfig
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
  Search
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Core ERP State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [componentsList, setComponentsList] = useState<ComponentMatrix[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [jobCardFormat, setJobCardFormat] = useState<JobCardFormatConfig>(DEFAULT_JOB_CARD_FORMAT);

  // Navigation & Toggle State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showInactiveJobs, setShowInactiveJobs] = useState(false);

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

  // 2. Fetch all ERP database data when user logs in
  useEffect(() => {
    if (user && userProfile) {
      loadAllERPData();
    }
  }, [user, userProfile?.uid]);

  const loadAllERPData = async () => {
    setDataLoading(true);
    try {
      const fetchedJobs = await getJobs();
      const fetchedCustomers = await getCustomers();
      const fetchedComponents = await getComponentMatrices();
      const fetchedCustomCols = await getCustomColumns();
      const fetchedFormat = await getJobCardFormatConfig();

      setJobs(fetchedJobs);
      setCustomers(fetchedCustomers);
      setComponentsList(fetchedComponents);
      setCustomColumns(fetchedCustomCols);
      setJobCardFormat(fetchedFormat);

      // Load all users for the admin center if user is Admin
      if (userProfile?.permissions.isAdmin) {
        const fetchedUsers = await getAllUsers();
        setUsersList(fetchedUsers);
      }
    } catch (e) {
      console.error("Error loading ERP data:", e);
    } finally {
      setDataLoading(false);
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

  // 4. Handle Save Actions (Refreshes data immediately!)
  const handleSaveJobs = async (newJobs: Job[]) => {
    for (const job of newJobs) {
      await saveJob(job);
    }
    await loadAllERPData();
    setActiveTab('dashboard'); // Redirect to dashboard to see newly captured jobs
  };

  const handleUpdateJob = async (updatedJob: Job) => {
    await saveJob(updatedJob);
    await loadAllERPData();
  };

  const handleSaveCustomer = async (cust: Customer) => {
    await saveCustomer(cust);
    await loadAllERPData();
  };

  const handleDeleteCustomer = async (id: string) => {
    await deleteCustomer(id);
    await loadAllERPData();
  };

  const handleSaveCustomColumns = async (cols: CustomColumn[]) => {
    await saveCustomColumns(cols);
    await loadAllERPData();
  };

  const handleSaveComponentMatrix = async (matrix: ComponentMatrix) => {
    await saveComponentMatrix(matrix);
    await loadAllERPData();
  };

  const handleDeleteComponentMatrix = async (id: string) => {
    await deleteComponentMatrix(id);
    await loadAllERPData();
  };

  const handleUpdateUserPermissions = async (uid: string, perms: UserPermissions) => {
    await updateUserPermissions(uid, perms);
    await loadAllERPData();
  };

  const handleSaveJobCardFormat = async (config: JobCardFormatConfig) => {
    await saveJobCardFormatConfig(config);
    await loadAllERPData();
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

    switch(tabName) {
      case 'dashboard': return true;
      case 'receiving': return p.canReceive;
      case 'inspection': return p.canInspect;
      case 'quoting': return p.canQuote;
      case 'jobcard': return p.canCreateJobCard;
      case 'enquiries':
      case 'closing': return true; // All users can search & enquire jobs! Only authorized operators can sign off.
      case 'admin': return p.isAdmin;
      default: return false;
    }
  };

  // Loading Screens
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans">
        <Wrench className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800 font-display">Initializing MES Workshop3...</h2>
        <p className="text-xs text-slate-400 mt-1">Connecting to secure Cloud Run server...</p>
      </div>
    );
  }

  // If not logged in, show login page
  if (!user || !userProfile) {
    return <LoginView onLoginSuccess={(profile) => setUserProfile(profile)} />;
  }

  // Sidebar Menu Definitions
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'receiving', label: '1. Job Receiving', icon: FileSpreadsheet, stage: 'Stage 1' },
    { id: 'inspection', label: '2. QC / Inspection', icon: ClipboardCheck, stage: 'Stage 2' },
    { id: 'quoting', label: '3. Pre Quote', icon: Calculator, stage: 'Stage 3' },
    { id: 'jobcard', label: '4. Job Card Creation', icon: CalendarRange, stage: 'Stage 4' },
    { id: 'enquiries', label: '5. Job Enquiries', icon: Search, stage: 'Stage 5' },
    { id: 'admin', label: 'Admin Center', icon: Lock, isAdminOnly: true },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-slate-50 font-sans" id="app-container">
      {/* SIDEBAR NAVIGATION PANEL */}
      <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-850 flex-shrink-0 h-full" id="sidebar-panel">
        {/* Sidebar Header / Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-xl">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight font-display text-white">MES Workshop3</h2>
            <p className="text-[10px] text-slate-400 font-medium">Repair Tracking ERP</p>
          </div>
        </div>

        {/* Current User Profile Summary */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 text-left flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center text-slate-200 font-extrabold text-sm uppercase">
            {userProfile.displayName ? userProfile.displayName[0] : userProfile.email[0]}
          </div>
          <div className="truncate flex-1">
            <p className="text-xs font-bold text-slate-200 truncate">{userProfile.displayName || 'Operator'}</p>
            <p className="text-[10px] text-slate-400 font-mono truncate">{userProfile.email}</p>
            <span className="inline-block mt-1 text-[9px] font-extrabold text-blue-400 bg-blue-900/40 border border-blue-800 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
              {userProfile.permissions.isAdmin ? 'Administrator' : 'Operator'}
            </span>
          </div>
        </div>

        {/* Navigation Sidebar List */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto text-left">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            const isSelected = activeTab === item.id;
            const permitted = hasAccess(item.id);

            return (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedJobContext(null); // Clear context on tab change
                  setActiveTab(item.id);
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
                {!permitted && (
                  <span className="text-[9px] font-bold text-red-400/80 uppercase tracking-widest">Locked</span>
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
            className="w-full flex items-center gap-2.5 justify-center py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? 'animate-spin' : ''}`} />
            {dataLoading ? 'Syncing...' : 'Force Sync Server'}
          </button>
          
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 justify-center py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-slate-800 hover:border-red-900 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out of ERP
          </button>
        </div>
      </aside>

      {/* MAIN ERP WORKPLACE AREA */}
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full h-full">
        {dataLoading && (
          <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 py-1.5 px-4 rounded-full w-fit flex items-center gap-2 mb-4">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Syncing database records with MES Workshop7...
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
                currentUser={userProfile} 
                onSelectJob={handleSelectJobFromDashboard}
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
              />
            )}

            {activeTab === 'quoting' && (
              <PreQuoteView 
                jobs={selectedJobContext ? [selectedJobContext, ...jobs.filter(j => j.id !== selectedJobContext.id)] : jobs}
                componentsList={componentsList}
                onUpdateJob={handleUpdateJob}
                currentUser={userProfile}
              />
            )}

            {activeTab === 'jobcard' && (
              <JobCardView 
                jobs={selectedJobContext ? [selectedJobContext, ...jobs.filter(j => j.id !== selectedJobContext.id)] : jobs}
                onUpdateJob={handleUpdateJob}
                currentUser={userProfile}
                jobCardFormat={jobCardFormat}
              />
            )}

            {(activeTab === 'enquiries' || activeTab === 'closing') && (
              <JobEnquiriesView 
                jobs={selectedJobContext ? [selectedJobContext, ...jobs.filter(j => j.id !== selectedJobContext.id)] : jobs}
                customColumns={customColumns}
                onUpdateJob={handleUpdateJob}
                currentUser={userProfile}
                jobCardFormat={jobCardFormat}
              />
            )}

            {activeTab === 'admin' && (
              <AdminCenterView 
                users={usersList}
                customers={customers}
                componentsList={componentsList}
                customColumns={customColumns}
                jobCardFormat={jobCardFormat}
                onUpdateUserPermissions={handleUpdateUserPermissions}
                onSaveCustomColumns={handleSaveCustomColumns}
                onSaveCustomer={handleSaveCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onSaveComponentMatrix={handleSaveComponentMatrix}
                onDeleteComponentMatrix={handleDeleteComponentMatrix}
                onSaveJobCardFormat={handleSaveJobCardFormat}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
