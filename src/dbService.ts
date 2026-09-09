import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Customer, Machine, ComponentMatrix, Job, CustomColumn, UserProfile, UserPermissions, JobCardFormatConfig, DEFAULT_JOB_CARD_FORMAT, ToolStockItem, ConsumableItem, ConsumableAllocationLog, ToolLog, WorksheetEntry, AppNotification, ChatMessage } from './types';
import { sanitizeJobForFirestoreAsync, compressDataUrl } from './utils/imageCompressor';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Recursively cleans an object for Firestore by removing all `undefined` values,
 * preventing Firestore "Unsupported field value: undefined" runtime errors.
 */
export function cleanForFirestore<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? cleanForFirestore(item) : item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = typeof value === 'object' && value !== null ? cleanForFirestore(value) : value;
    }
  }
  return result as T;
}

// ==========================================
// 1. CONFIG / CUSTOM COLUMNS SERVICE
// ==========================================
const CONFIG_DOC_ID = 'job_custom_fields';
const JOB_CARD_FORMAT_DOC_ID = 'job_card_format';

export async function getCustomColumns(): Promise<CustomColumn[]> {
  try {
    const configDoc = await getDoc(doc(db, 'config', CONFIG_DOC_ID));
    if (configDoc.exists()) {
      const cols = (configDoc.data().customColumns as CustomColumn[]) || [];
      return cols.filter(c => c.id !== 'damage_severity' && c.label !== 'Damage Severity Level');
    }
    // Seed default custom columns if empty
    const defaultCols: CustomColumn[] = [
      { id: 'transport_sheet_no', label: 'Transport Sheet Number', type: 'text' }
    ];
    await setDoc(doc(db, 'config', CONFIG_DOC_ID), { customColumns: defaultCols });
    return defaultCols;
  } catch (error) {
    console.error("Error fetching custom columns:", error);
    return [];
  }
}

export async function saveCustomColumns(columns: CustomColumn[]): Promise<void> {
  await setDoc(doc(db, 'config', CONFIG_DOC_ID), cleanForFirestore({ customColumns: columns }));
}

const FORMAT_STORAGE_KEY = 'job_card_format_config_v1';

export async function getJobCardFormatConfig(): Promise<JobCardFormatConfig> {
  try {
    const formatDoc = await getDoc(doc(db, 'config', JOB_CARD_FORMAT_DOC_ID));
    if (formatDoc.exists()) {
      const data = formatDoc.data() as JobCardFormatConfig;
      // Merge with default format in case new fields/sections were added
      const merged: JobCardFormatConfig = {
        ...DEFAULT_JOB_CARD_FORMAT,
        ...data,
        labels: {
          ...DEFAULT_JOB_CARD_FORMAT.labels,
          ...(data.labels || {})
        },
        sections: data.sections && data.sections.length > 0 ? data.sections : DEFAULT_JOB_CARD_FORMAT.sections
      };
      try {
        localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {
        // ignore localStorage write errors
      }
      return merged;
    }

    // Check local cache if Firestore doc doesn't exist
    const cached = localStorage.getItem(FORMAT_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as JobCardFormatConfig;
      const merged: JobCardFormatConfig = {
        ...DEFAULT_JOB_CARD_FORMAT,
        ...parsed,
        labels: {
          ...DEFAULT_JOB_CARD_FORMAT.labels,
          ...(parsed.labels || {})
        },
        sections: parsed.sections && parsed.sections.length > 0 ? parsed.sections : DEFAULT_JOB_CARD_FORMAT.sections
      };
      await setDoc(doc(db, 'config', JOB_CARD_FORMAT_DOC_ID), cleanForFirestore(merged));
      return merged;
    }

    // Seed default format if empty
    await setDoc(doc(db, 'config', JOB_CARD_FORMAT_DOC_ID), cleanForFirestore(DEFAULT_JOB_CARD_FORMAT));
    return DEFAULT_JOB_CARD_FORMAT;
  } catch (error) {
    console.error("Error fetching Job Card format config:", error);
    try {
      const cached = localStorage.getItem(FORMAT_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as JobCardFormatConfig;
        return {
          ...DEFAULT_JOB_CARD_FORMAT,
          ...parsed,
          labels: {
            ...DEFAULT_JOB_CARD_FORMAT.labels,
            ...(parsed.labels || {})
          },
          sections: parsed.sections && parsed.sections.length > 0 ? parsed.sections : DEFAULT_JOB_CARD_FORMAT.sections
        };
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_JOB_CARD_FORMAT;
  }
}

export async function saveJobCardFormatConfig(config: JobCardFormatConfig): Promise<void> {
  let configToSave = { ...config };
  if (configToSave.logoUrl && configToSave.logoUrl.startsWith('data:image')) {
    try {
      configToSave.logoUrl = await compressDataUrl(configToSave.logoUrl, 400, 0.8);
    } catch (e) {
      console.error("Error compressing format logoUrl:", e);
    }
  }

  try {
    localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify(configToSave));
  } catch (e) {
    console.error("Error writing format config to localStorage:", e);
  }
  try {
    await setDoc(doc(db, 'config', JOB_CARD_FORMAT_DOC_ID), cleanForFirestore({
      ...configToSave,
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error("Error saving Job Card format config to Firestore:", error);
    handleFirestoreError(error, OperationType.WRITE, `config/${JOB_CARD_FORMAT_DOC_ID}`);
  }
}


// ==========================================
// 2. CUSTOMER SERVICE
// ==========================================
export async function getCustomers(): Promise<Customer[]> {
  try {
    const snapshot = await getDocs(collection(db, 'customers'));
    const list: Customer[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as Customer);
    });
    return list;
  } catch (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
}

export async function saveCustomer(customer: Customer): Promise<void> {
  await setDoc(doc(db, 'customers', customer.id), cleanForFirestore({
    ...customer,
    updatedAt: new Date().toISOString()
  }));
}

export async function deleteCustomer(id: string): Promise<void> {
  await deleteDoc(doc(db, 'customers', id));
}

// ==========================================
// 2B. MACHINES SERVICE
// ==========================================
export async function getMachines(): Promise<Machine[]> {
  try {
    const snapshot = await getDocs(collection(db, 'machines'));
    const list: Machine[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as Machine);
    });
    return list;
  } catch (error) {
    console.error("Error fetching machines:", error);
    return [];
  }
}

export async function saveMachine(machine: Machine): Promise<void> {
  await setDoc(doc(db, 'machines', machine.id), cleanForFirestore({
    ...machine,
    updatedAt: new Date().toISOString()
  }));
}

export async function deleteMachine(id: string): Promise<void> {
  await deleteDoc(doc(db, 'machines', id));
}

export async function deleteAllMachines(): Promise<void> {
  try {
    const snapshot = await getDocs(collection(db, 'machines'));
    const promises: Promise<void>[] = [];
    snapshot.forEach(d => {
      promises.push(deleteDoc(doc(db, 'machines', d.id)));
    });
    await Promise.all(promises);
  } catch (error) {
    console.error("Error deleting all machines:", error);
  }
}

// ==========================================
// 3. COMPONENT PRICING MATRIX SERVICE
// ==========================================
export async function getComponentMatrices(): Promise<ComponentMatrix[]> {
  try {
    const snapshot = await getDocs(collection(db, 'components'));
    const list: ComponentMatrix[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as ComponentMatrix);
    });
    return list;
  } catch (error) {
    console.error("Error fetching components:", error);
    return [];
  }
}

export async function saveComponentMatrix(matrix: ComponentMatrix): Promise<void> {
  await setDoc(doc(db, 'components', matrix.id), cleanForFirestore({
    ...matrix,
    updatedAt: new Date().toISOString()
  }));
}

export async function deleteComponentMatrix(id: string): Promise<void> {
  await deleteDoc(doc(db, 'components', id));
}

// ==========================================
// 4. USER PERMISSIONS AND PROFILE SERVICE
// ==========================================

export interface MetalogikUserConfig {
  name: string;
  email: string;
  roleTitle: string;
  roleBadge: string;
  color: string;
  perms: UserPermissions;
}

export const METALOGIK_DEFAULT_USERS: MetalogikUserConfig[] = [
  {
    name: 'Paulo',
    email: 'paulo@metalogik.co.za',
    roleTitle: 'Full Admin Access',
    roleBadge: 'Admin',
    color: 'bg-slate-800 hover:bg-slate-900 text-white',
    perms: {
      canReceive: true,
      canInspect: true,
      canQuote: true,
      canCreateJobCard: true,
      canStores: true,
      canWorksheet: true,
      canReporting: true,
      canClose: true,
      isAdmin: true
    }
  },
  {
    name: 'Renier',
    email: 'renier@metalogik.co.za',
    roleTitle: 'Full Admin Access',
    roleBadge: 'Admin',
    color: 'bg-slate-800 hover:bg-slate-900 text-white',
    perms: {
      canReceive: true,
      canInspect: true,
      canQuote: true,
      canCreateJobCard: true,
      canStores: true,
      canWorksheet: true,
      canReporting: true,
      canClose: true,
      isAdmin: true
    }
  },
  {
    name: 'Francisca',
    email: 'reception@metalogik.co.za',
    roleTitle: 'Job Admin',
    roleBadge: 'Job Admin',
    color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    perms: {
      canReceive: true,
      canInspect: false,
      canQuote: false,
      canCreateJobCard: true,
      canStores: false,
      canWorksheet: false,
      canReporting: false,
      canClose: true,
      isAdmin: false
    }
  },
  {
    name: 'Natasha',
    email: 'office@metalogi.co.za',
    roleTitle: 'Worksheets',
    roleBadge: 'Worksheets',
    color: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    perms: {
      canReceive: false,
      canInspect: false,
      canQuote: false,
      canCreateJobCard: false,
      canStores: false,
      canWorksheet: true,
      canReporting: false,
      canClose: false,
      isAdmin: false
    }
  },
  {
    name: 'Diane',
    email: 'metalogik@metalogik.co.za',
    roleTitle: 'Admin Access',
    roleBadge: 'Admin',
    color: 'bg-blue-800 hover:bg-blue-900 text-white',
    perms: {
      canReceive: true,
      canInspect: true,
      canQuote: true,
      canCreateJobCard: true,
      canStores: true,
      canWorksheet: true,
      canReporting: true,
      canClose: true,
      isAdmin: true
    }
  },
  {
    name: 'Cyril',
    email: 'stores@metalogik.co.za',
    roleTitle: 'Stores',
    roleBadge: 'Stores',
    color: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    perms: {
      canReceive: false,
      canInspect: false,
      canQuote: false,
      canCreateJobCard: false,
      canStores: true,
      canWorksheet: false,
      canReporting: false,
      canClose: false,
      isAdmin: false
    }
  },
  {
    name: 'Jaco',
    email: 'jaco@metalogik.co.za',
    roleTitle: 'Prequote',
    roleBadge: 'Prequote',
    color: 'bg-purple-600 hover:bg-purple-700 text-white',
    perms: {
      canReceive: false,
      canInspect: false,
      canQuote: true,
      canCreateJobCard: false,
      canStores: false,
      canWorksheet: false,
      canReporting: false,
      canClose: false,
      isAdmin: false
    }
  },
  {
    name: 'Christopher',
    email: 'inspection@metalogik.co.za',
    roleTitle: 'Inspection',
    roleBadge: 'Inspection',
    color: 'bg-amber-600 hover:bg-amber-700 text-white',
    perms: {
      canReceive: true,
      canInspect: true,
      canQuote: false,
      canCreateJobCard: false,
      canStores: false,
      canWorksheet: false,
      canReporting: false,
      canClose: false,
      isAdmin: false
    }
  },
  {
    name: 'Nick',
    email: 'nick@metalogik.co.za',
    roleTitle: 'Inspection',
    roleBadge: 'Inspection',
    color: 'bg-amber-600 hover:bg-amber-700 text-white',
    perms: {
      canReceive: true,
      canInspect: true,
      canQuote: false,
      canCreateJobCard: false,
      canStores: false,
      canWorksheet: false,
      canReporting: false,
      canClose: false,
      isAdmin: false
    }
  }
];

export function getMetalogikDefaultPermissions(email: string): UserPermissions | null {
  const normalized = (email || '').toLowerCase().trim();
  const matched = METALOGIK_DEFAULT_USERS.find(u => u.email.toLowerCase() === normalized);
  return matched ? matched.perms : null;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const list: UserProfile[] = [];
    snapshot.forEach(doc => {
      list.push(doc.data() as UserProfile);
    });
    return list;
  } catch (error) {
    console.error("Error fetching all users:", error);
    return [];
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', profile.uid), cleanForFirestore(profile));
}

export async function deleteUserProfile(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    console.error(`Error deleting user profile ${uid}:`, error);
    throw error;
  }
}

export async function updateUserPermissions(uid: string, permissions: UserPermissions): Promise<void> {
  await updateDoc(doc(db, 'users', uid), cleanForFirestore({ permissions }));
}

/**
 * Removes all non-Metalogik users from the Firestore users collection
 * and seeds/updates the 9 official Metalogik users with their exact access levels.
 */
export async function resetAndSeedMetalogikUsers(): Promise<void> {
  try {
    if (!auth.currentUser) {
      return;
    }
    const snapshot = await getDocs(collection(db, 'users'));
    const metalogikEmails = new Set(METALOGIK_DEFAULT_USERS.map(u => u.email.toLowerCase()));
    
    // 1. Delete all users who do not belong to the Metalogik roster
    for (const d of snapshot.docs) {
      const data = d.data() as UserProfile;
      const userEmail = (data.email || '').toLowerCase().trim();
      if (!metalogikEmails.has(userEmail)) {
        console.log(`Removing non-metalogik user: ${data.displayName || userEmail} (${d.id})`);
        await deleteDoc(doc(db, 'users', d.id));
      }
    }

    // 2. Ensure each of the 9 Metalogik users has a corresponding document
    const refreshedSnapshot = await getDocs(collection(db, 'users'));
    const existingByEmail = new Map<string, UserProfile>();
    refreshedSnapshot.forEach(d => {
      const u = d.data() as UserProfile;
      if (u.email) {
        existingByEmail.set(u.email.toLowerCase().trim(), u);
      }
    });

    for (const metalogikUser of METALOGIK_DEFAULT_USERS) {
      const key = metalogikUser.email.toLowerCase().trim();
      const existing = existingByEmail.get(key);
      
      if (existing) {
        // Update permissions to match requested specification
        await setDoc(doc(db, 'users', existing.uid), cleanForFirestore({
          ...existing,
          displayName: metalogikUser.name,
          permissions: metalogikUser.perms
        }), { merge: true });
      } else {
        // Create deterministic placeholder profile (will link upon authentication)
        const placeholderUid = `metalogik-${metalogikUser.name.toLowerCase()}`;
        const newProfile: UserProfile = {
          uid: placeholderUid,
          email: metalogikUser.email,
          displayName: metalogikUser.name,
          permissions: metalogikUser.perms,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', placeholderUid), cleanForFirestore(newProfile));
      }
    }
  } catch (error) {
    console.error("Error resetting and seeding Metalogik users:", error);
  }
}

// ==========================================
// 5. JOBS SERVICE
// ==========================================
export async function getJobs(): Promise<Job[]> {
  try {
    const snapshot = await getDocs(collection(db, 'jobs'));
    const list: Job[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as Job);
    });
    return list;
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }
}

export async function saveJob(job: Job): Promise<void> {
  const sanitizedJob = await sanitizeJobForFirestoreAsync(job);
  await setDoc(doc(db, 'jobs', sanitizedJob.id), cleanForFirestore({
    ...sanitizedJob,
    updatedAt: new Date().toISOString()
  }));
}

export async function deleteJob(id: string): Promise<void> {
  await deleteDoc(doc(db, 'jobs', id));
}

export async function deleteAllJobs(): Promise<void> {
  try {
    const snapshot = await getDocs(collection(db, 'jobs'));
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log(`Deleted ${snapshot.docs.length} job entries from database.`);
  } catch (error) {
    console.error("Error deleting all jobs:", error);
    handleFirestoreError(error, OperationType.DELETE, 'jobs');
  }
}

// ==========================================
// 6. DATABASE AUTO-SEEDING FOR FIRST RUN
// ==========================================
export async function seedDatabaseIfEmpty(): Promise<void> {
  try {
    // 1. Check if customers collection is empty
    const customersSnap = await getDocs(collection(db, 'customers'));
    if (customersSnap.empty) {
      console.log("Seeding default customers...");
      const defaultCustomers: Customer[] = [
        {
          id: 'cust-cat',
          name: 'Caterpillar Mining Division',
          contactPerson: 'Alex Mercer',
          email: 'alex.mercer@catmining.com',
          phone: '+1 555-0192',
          address: '45 Industrial Way, Peoriana, IL',
          createdAt: new Date().toISOString()
        },
        {
          id: 'cust-an',
          name: 'Anglo American Plat Reef',
          contactPerson: 'Sipho Ndlovu',
          email: 's.ndlovu@angloamerican.com',
          phone: '+27 11 638 1111',
          address: '55 Marshall St, Johannesburg, South Africa',
          createdAt: new Date().toISOString()
        },
        {
          id: 'cust-bw',
          name: 'Barloworld Equipment',
          contactPerson: 'Marthinus Coetzee',
          email: 'mcoetzee@barloworld-eq.com',
          phone: '+27 11 898 8500',
          address: '10 Grader Road, Spartan, Kempton Park',
          createdAt: new Date().toISOString()
        }
      ];
      for (const cust of defaultCustomers) {
        await setDoc(doc(db, 'customers', cust.id), cust);
      }
    }

    // 1B. Check if machines collection is empty
    const machinesSnap = await getDocs(collection(db, 'machines'));
    if (machinesSnap.empty) {
      console.log("Seeding default machines...");
      const defaultMachines: Machine[] = [
        {
          id: 'mach-haas-01',
          machineName: '5-Axis CNC Milling Center',
          serialNumber: 'M1',
          machineType: 'CNC Milling Center',
          model: 'VF-4SS',
          make: 'Haas Automation',
          customerName: 'Caterpillar Mining Division',
          location: 'Bay 2 - Heavy Machining Shop',
          category: 'CNC Milling',
          status: 'Operational',
          specs: {
            'Spindle Speed': '12,000 RPM',
            'Travel X/Y/Z': '1270 x 508 x 635 mm',
            'Tool Capacity': '30+1 Inline',
            'Power Rating': '22.4 kW'
          },
          notes: 'Regular 500hr spindle calibration completed. High priority component shop machine.',
          createdAt: new Date().toISOString()
        },
        {
          id: 'mach-cat-02',
          machineName: 'CAT 777D Heavy Haul Spindle Rig',
          serialNumber: 'M2',
          machineType: 'Compressor',
          model: '777D Series',
          make: 'Caterpillar',
          customerName: 'Anglo American Plat Reef',
          location: 'Site A - Mining Pit 3',
          category: 'Spindle Assembly',
          status: 'Under Repair',
          specs: {
            'Payload Capacity': '100 Ton',
            'Wheel Hub Spec': 'Dual Tapered Roller',
            'Operating Voltage': '24V DC'
          },
          notes: 'Arrived for full teardown, bearing replacement and pre-quote analysis.',
          createdAt: new Date().toISOString()
        }
      ];
      for (const m of defaultMachines) {
        await setDoc(doc(db, 'machines', m.id), m);
      }
    }

    // 2. Check if components matrix collection is empty
    const componentsSnap = await getDocs(collection(db, 'components'));
    if (componentsSnap.empty) {
      console.log("Seeding default components matrices (Spindle & Wheel Hub)...");
      const spindleMatrix: ComponentMatrix = {
        id: 'Spindle',
        name: 'Spindle',
        models: ['777 Rear', '630 Front', '930 Standard'],
        steps: [
          {
            stepName: 'Sandblasting',
            prices: { '777 Rear': 150, '630 Front': 120, '930 Standard': 180 }
          },
          {
            stepName: 'Crack Detection',
            prices: { '777 Rear': 250, '630 Front': 200, '930 Standard': 300 }
          },
          {
            stepName: 'Hard Chrome Plating',
            prices: { '777 Rear': 1200, '630 Front': 950, '930 Standard': 1500 }
          },
          {
            stepName: 'Precision Grinding',
            prices: { '777 Rear': 450, '630 Front': 400, '930 Standard': 500 }
          },
          {
            stepName: 'Final Micro Inspection',
            prices: { '777 Rear': 100, '630 Front': 100, '930 Standard': 120 }
          }
        ],
        updatedAt: new Date().toISOString()
      };

      const wheelHubMatrix: ComponentMatrix = {
        id: 'Wheel Hub',
        name: 'Wheel Hub',
        models: ['H100 Heavy', 'H50 Medium', 'H20 Light'],
        steps: [
          {
            stepName: 'Degreasing & Prep',
            prices: { 'H100 Heavy': 80, 'H50 Medium': 60, 'H20 Light': 40 }
          },
          {
            stepName: 'CNC Machining',
            prices: { 'H100 Heavy': 600, 'H50 Medium': 450, 'H20 Light': 300 }
          },
          {
            stepName: 'Bearing Seat Inspection',
            prices: { 'H100 Heavy': 150, 'H50 Medium': 120, 'H20 Light': 80 }
          },
          {
            stepName: 'Final Spray Painting',
            prices: { 'H100 Heavy': 150, 'H50 Medium': 120, 'H20 Light': 90 }
          }
        ],
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'components', spindleMatrix.id), spindleMatrix);
      await setDoc(doc(db, 'components', wheelHubMatrix.id), wheelHubMatrix);
    }

    // 3. Check if config collection is empty
    const configSnap = await getDoc(doc(db, 'config', CONFIG_DOC_ID));
    if (!configSnap.exists()) {
      const defaultCols: CustomColumn[] = [
        { id: 'transport_sheet_no', label: 'Transport Sheet Number', type: 'text' }
      ];
      await setDoc(doc(db, 'config', CONFIG_DOC_ID), { customColumns: defaultCols });
    }

    // 4. Ensure sample jobs are NOT auto-seeded and clear any default sample jobs
    // All captured jobs have been cleared as per user request.
    
    // Seed Stores Data if empty
    await seedStoresDataIfEmpty();

    // 5. Reset and sync official Metalogik team users
    await resetAndSeedMetalogikUsers();
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// ==========================================
// 8. STORES DASHBOARD SERVICE
// ==========================================

export async function getToolStockItems(): Promise<ToolStockItem[]> {
  try {
    const snapshot = await getDocs(collection(db, 'tool_stock'));
    const list: ToolStockItem[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as ToolStockItem);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'tool_stock');
    return [];
  }
}

export async function saveToolStockItem(tool: ToolStockItem): Promise<void> {
  try {
    await setDoc(doc(db, 'tool_stock', tool.id), cleanForFirestore({
      ...tool,
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tool_stock/${tool.id}`);
  }
}

export async function deleteToolStockItem(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tool_stock', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tool_stock/${id}`);
  }
}

export async function getConsumableItems(): Promise<ConsumableItem[]> {
  try {
    const snapshot = await getDocs(collection(db, 'consumables'));
    const list: ConsumableItem[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as ConsumableItem);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'consumables');
    return [];
  }
}

export async function saveConsumableItem(item: ConsumableItem): Promise<void> {
  try {
    await setDoc(doc(db, 'consumables', item.id), cleanForFirestore({
      ...item,
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `consumables/${item.id}`);
  }
}

export async function deleteConsumableItem(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'consumables', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `consumables/${id}`);
  }
}

export async function getConsumableAllocationLogs(): Promise<ConsumableAllocationLog[]> {
  try {
    const snapshot = await getDocs(collection(db, 'consumable_allocations'));
    const list: ConsumableAllocationLog[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as ConsumableAllocationLog);
    });
    // Sort newest first
    return list.sort((a, b) => new Date(b.allocatedAt).getTime() - new Date(a.allocatedAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'consumable_allocations');
    return [];
  }
}

export async function saveConsumableAllocationLog(log: ConsumableAllocationLog): Promise<void> {
  await setDoc(doc(db, 'consumable_allocations', log.id), cleanForFirestore({
    ...log
  }));
}

export async function deleteConsumableAllocationLog(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'consumable_allocations', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `consumable_allocations/${id}`);
  }
}

export async function getToolLogs(): Promise<ToolLog[]> {
  try {
    const snapshot = await getDocs(collection(db, 'tool_logs'));
    const list: ToolLog[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as ToolLog);
    });
    return list.sort((a, b) => new Date(b.actionDate).getTime() - new Date(a.actionDate).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'tool_logs');
    return [];
  }
}

export async function saveToolLog(log: ToolLog): Promise<void> {
  await setDoc(doc(db, 'tool_logs', log.id), cleanForFirestore({
    ...log
  }));
}

export async function deleteToolLog(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tool_logs', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tool_logs/${id}`);
  }
}

export async function seedStoresDataIfEmpty(): Promise<void> {
  try {
    const toolsSnap = await getDocs(collection(db, 'tool_stock'));
    if (toolsSnap.empty) {
      const defaultTools: ToolStockItem[] = [
        {
          id: 'tool-001',
          description: 'Pneumatic Impact Wrench 1/2"',
          typeSize: 'Heavy Duty 1/2 Sq Dr',
          quantity: 1,
          addedDate: '2026-01-10',
          employeeNumber: 'Stores',
          signOutDate: '',
          dateReturn: '2026-07-28',
          status: 'In Stock',
          createdAt: new Date().toISOString()
        },
        {
          id: 'tool-002',
          description: 'Digital Micrometer 0-25mm',
          typeSize: '0.001mm High Precision',
          quantity: 1,
          addedDate: '2026-01-15',
          employeeNumber: 'CLK-104',
          signOutDate: '2026-07-30',
          dateReturn: '',
          status: 'Signed Out',
          createdAt: new Date().toISOString()
        },
        {
          id: 'tool-003',
          description: 'Fluke True RMS Digital Multimeter',
          typeSize: 'CAT III 1000V',
          quantity: 1,
          addedDate: '2026-02-01',
          employeeNumber: 'Stores',
          signOutDate: '',
          dateReturn: '2026-07-25',
          status: 'In Stock',
          createdAt: new Date().toISOString()
        },
        {
          id: 'tool-004',
          description: 'Angle Grinder 125mm Heavy Duty',
          typeSize: '1000W 220V Corded',
          quantity: 2,
          addedDate: '2026-02-12',
          employeeNumber: 'CLK-208',
          signOutDate: '2026-07-29',
          dateReturn: '',
          status: 'Signed Out',
          createdAt: new Date().toISOString()
        },
        {
          id: 'tool-005',
          description: 'Hydraulic Tri-Jaw Gear Puller Set',
          typeSize: '10 Ton Capacity',
          quantity: 1,
          addedDate: '2026-03-05',
          employeeNumber: 'Stores',
          signOutDate: '',
          dateReturn: '2026-07-20',
          status: 'In Stock',
          createdAt: new Date().toISOString()
        }
      ];

      for (const tool of defaultTools) {
        await setDoc(doc(db, 'tool_stock', tool.id), tool);
      }
    }

    const consumablesSnap = await getDocs(collection(db, 'consumables'));
    if (consumablesSnap.empty) {
      const defaultConsumables: ConsumableItem[] = [
        {
          id: 'cons-001',
          description: 'Synthetic CNC Cutting Fluid Coolant',
          typeSize: '20 Litre Drum',
          quantity: 35,
          addedDate: '2026-01-20',
          createdAt: new Date().toISOString()
        },
        {
          id: 'cons-002',
          description: 'Ultra Thin Stainless Steel Grinding Discs',
          typeSize: '115mm x 1.0mm x 22.23mm',
          quantity: 120,
          addedDate: '2026-02-05',
          createdAt: new Date().toISOString()
        },
        {
          id: 'cons-003',
          description: 'Arc Welding Rods E6013 3.2mm',
          typeSize: '5kg Sealed Box (3.2mm x 350mm)',
          quantity: 22,
          addedDate: '2026-02-18',
          createdAt: new Date().toISOString()
        },
        {
          id: 'cons-004',
          description: 'Industrial Solvent Degreaser',
          typeSize: '5 Litre Can',
          quantity: 14,
          addedDate: '2026-03-01',
          createdAt: new Date().toISOString()
        },
        {
          id: 'cons-005',
          description: 'WD-40 Multi-Use Penetrating Lubricant',
          typeSize: '400ml Spray Can',
          quantity: 48,
          addedDate: '2026-03-10',
          createdAt: new Date().toISOString()
        },
        {
          id: 'cons-006',
          description: 'Heavy Duty Nitrile Workshop Gloves',
          typeSize: 'Box of 100 (Size XL)',
          quantity: 18,
          addedDate: '2026-03-15',
          createdAt: new Date().toISOString()
        }
      ];

      for (const item of defaultConsumables) {
        await setDoc(doc(db, 'consumables', item.id), item);
      }
    }

    const allocationsSnap = await getDocs(collection(db, 'consumable_allocations'));
    if (allocationsSnap.empty) {
      const defaultAllocations: ConsumableAllocationLog[] = [
        {
          id: 'alloc-001',
          consumableId: 'cons-002',
          consumableDescription: 'Ultra Thin Stainless Steel Grinding Discs',
          consumableTypeSize: '115mm x 1.0mm x 22.23mm',
          clockNumber: 'CLK-104',
          jobNumber: 'C00001',
          machineNumber: 'MCH-001',
          quantityAllocated: 5,
          allocatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          loggedBy: 'Stores Operator'
        },
        {
          id: 'alloc-002',
          consumableId: 'cons-005',
          consumableDescription: 'WD-40 Multi-Use Penetrating Lubricant',
          consumableTypeSize: '400ml Spray Can',
          clockNumber: 'CLK-208',
          jobNumber: 'C00002',
          machineNumber: 'MCH-002',
          quantityAllocated: 2,
          allocatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
          loggedBy: 'Stores Operator'
        }
      ];

      for (const alloc of defaultAllocations) {
        await setDoc(doc(db, 'consumable_allocations', alloc.id), alloc);
      }
    }

    const toolLogsSnap = await getDocs(collection(db, 'tool_logs'));
    if (toolLogsSnap.empty) {
      const defaultToolLogs: ToolLog[] = [
        {
          id: 'tlog-001',
          toolId: 'tool-002',
          toolDescription: 'Digital Micrometer 0-25mm',
          toolTypeSize: '0.001mm High Precision',
          action: 'Signed Out',
          clockNumber: 'CLK-104',
          actionDate: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          loggedBy: 'Stores Operator'
        },
        {
          id: 'tlog-002',
          toolId: 'tool-004',
          toolDescription: 'Angle Grinder 125mm Heavy Duty',
          toolTypeSize: '1000W 220V Corded',
          action: 'Signed Out',
          clockNumber: 'CLK-208',
          actionDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          loggedBy: 'Stores Operator'
        },
        {
          id: 'tlog-003',
          toolId: 'tool-001',
          toolDescription: 'Pneumatic Impact Wrench 1/2"',
          toolTypeSize: 'Heavy Duty 1/2 Sq Dr',
          action: 'Returned',
          clockNumber: 'Stores',
          actionDate: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
          loggedBy: 'Stores Operator'
        }
      ];

      for (const tlog of defaultToolLogs) {
        await setDoc(doc(db, 'tool_logs', tlog.id), tlog);
      }
    }

    // Seed default notifications if empty
    const notifsSnap = await getDocs(collection(db, 'notifications'));
    if (notifsSnap.empty) {
      const defaultNotifs: AppNotification[] = [
        {
          id: 'notif-seed-01',
          title: 'Component Arrived for Inspection',
          message: 'Job #C00001 (Hydraulic Cylinder) has been received and is waiting for technical inspection.',
          type: 'job_received',
          targetPermission: 'canInspect',
          targetTab: 'inspection',
          jobId: '1',
          jobNo: 'C00001',
          customerName: 'Anglo Platinum',
          componentName: 'Hydraulic Cylinder',
          createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          createdByUid: 'system',
          createdByName: 'Receiving Team',
          readBy: [],
          dismissedBy: [],
          dismissedAt: {}
        },
        {
          id: 'notif-seed-02',
          title: 'Inspection Complete - Pre-Quote Needed',
          message: 'Job #C00002 (Centrifugal Pump Casing) inspection finalized. Ready for Pre-Quote pricing.',
          type: 'inspection_needed',
          targetPermission: 'canQuote',
          targetTab: 'quoting',
          jobId: '2',
          jobNo: 'C00002',
          customerName: 'Sasol Synfuels',
          componentName: 'Centrifugal Pump Casing',
          createdAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
          createdByUid: 'system',
          createdByName: 'Lead Inspector',
          readBy: [],
          dismissedBy: [],
          dismissedAt: {}
        },
        {
          id: 'notif-seed-03',
          title: 'Pre-Quote Ready for Job Card Generation',
          message: 'Job #C00003 (Planetary Gearbox) pre-quote approved. Ready for Job Card creation.',
          type: 'quote_needed',
          targetPermission: 'canCreateJobCard',
          targetTab: 'jobcard',
          jobId: '3',
          jobNo: 'C00003',
          customerName: 'Glencore Operations',
          componentName: 'Planetary Gearbox',
          createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
          createdByUid: 'system',
          createdByName: 'Estimating Team',
          readBy: [],
          dismissedBy: [],
          dismissedAt: {}
        }
      ];

      for (const n of defaultNotifs) {
        await setDoc(doc(db, 'notifications', n.id), cleanForFirestore(n));
      }
    }

    // Seed default chat messages if empty
    const chatSnap = await getDocs(collection(db, 'chat_messages'));
    if (chatSnap.empty) {
      const defaultMessages: ChatMessage[] = [
        {
          id: 'msg-seed-01',
          senderUid: 'system-admin',
          senderName: 'Workshop Manager',
          senderEmail: 'manager@workshop.com',
          senderRole: 'Admin',
          text: 'Welcome to the MES Workshop company channel! Team members can post real-time updates on jobs, component arrivals, and technical queries here.',
          createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
          reactions: { '👍': ['system-admin'], '🔧': ['system-admin'] }
        },
        {
          id: 'msg-seed-02',
          senderUid: 'system-stores',
          senderName: 'Stores Department',
          senderEmail: 'stores@workshop.com',
          senderRole: 'Stores',
          text: 'Notice: New batch of cutting fluids and 115mm grinding discs have been restocked in Bay 2.',
          createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          reactions: { '✅': ['system-stores'] }
        }
      ];

      for (const msg of defaultMessages) {
        await setDoc(doc(db, 'chat_messages', msg.id), cleanForFirestore(msg));
      }
    }
  } catch (err) {
    console.error("Error seeding stores data:", err);
  }
}

// ==========================================
// 9. REAL-TIME AUTO-SYNC SUBSCRIPTIONS
// ==========================================

export function subscribeJobs(onUpdate: (jobs: Job[]) => void): () => void {
  const path = 'jobs';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: Job[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as Job);
    });
    onUpdate(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export function subscribeCustomers(onUpdate: (customers: Customer[]) => void): () => void {
  const path = 'customers';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: Customer[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as Customer);
    });
    onUpdate(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export function subscribeMachines(onUpdate: (machines: Machine[]) => void): () => void {
  const path = 'machines';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: Machine[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as Machine);
    });
    onUpdate(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export function subscribeComponentMatrices(onUpdate: (matrices: ComponentMatrix[]) => void): () => void {
  const path = 'components';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: ComponentMatrix[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as ComponentMatrix);
    });
    onUpdate(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export function subscribeCustomColumns(onUpdate: (cols: CustomColumn[]) => void): () => void {
  const path = `config/${CONFIG_DOC_ID}`;
  return onSnapshot(doc(db, 'config', CONFIG_DOC_ID), (snapshot) => {
    if (snapshot.exists()) {
      const cols = (snapshot.data().customColumns as CustomColumn[]) || [];
      onUpdate(cols.filter(c => c.id !== 'damage_severity' && c.label !== 'Damage Severity Level'));
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export function subscribeJobCardFormatConfig(onUpdate: (config: JobCardFormatConfig) => void): () => void {
  const path = `config/${JOB_CARD_FORMAT_DOC_ID}`;
  return onSnapshot(doc(db, 'config', JOB_CARD_FORMAT_DOC_ID), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as JobCardFormatConfig;
      const merged: JobCardFormatConfig = {
        ...DEFAULT_JOB_CARD_FORMAT,
        ...data,
        labels: {
          ...DEFAULT_JOB_CARD_FORMAT.labels,
          ...(data.labels || {})
        },
        sections: data.sections && data.sections.length > 0 ? data.sections : DEFAULT_JOB_CARD_FORMAT.sections
      };
      try {
        localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {
        // ignore localStorage write errors
      }
      onUpdate(merged);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export function subscribeUsers(onUpdate: (users: UserProfile[]) => void): () => void {
  const path = 'users';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: UserProfile[] = [];
    snapshot.forEach(doc => {
      list.push(doc.data() as UserProfile);
    });
    onUpdate(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export function subscribeToolStockItems(onUpdate: (tools: ToolStockItem[]) => void): () => void {
  const path = 'tool_stock';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: ToolStockItem[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as ToolStockItem);
    });
    onUpdate(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export function subscribeConsumableItems(onUpdate: (items: ConsumableItem[]) => void): () => void {
  const path = 'consumables';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: ConsumableItem[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as ConsumableItem);
    });
    onUpdate(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export function subscribeConsumableAllocationLogs(onUpdate: (logs: ConsumableAllocationLog[]) => void): () => void {
  const path = 'consumable_allocations';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: ConsumableAllocationLog[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as ConsumableAllocationLog);
    });
    const sorted = list.sort((a, b) => new Date(b.allocatedAt).getTime() - new Date(a.allocatedAt).getTime());
    onUpdate(sorted);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export function subscribeToolLogs(onUpdate: (logs: ToolLog[]) => void): () => void {
  const path = 'tool_logs';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: ToolLog[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as ToolLog);
    });
    const sorted = list.sort((a, b) => new Date(b.actionDate).getTime() - new Date(a.actionDate).getTime());
    onUpdate(sorted);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

// ==========================================
// 9. WORKSHEET DASHBOARD SERVICE
// ==========================================

export async function getWorksheetEntries(): Promise<WorksheetEntry[]> {
  try {
    const snapshot = await getDocs(collection(db, 'worksheet_entries'));
    const list: WorksheetEntry[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as WorksheetEntry);
    });
    return list.sort((a, b) => {
      const dateDiff = new Date(b.jobDate).getTime() - new Date(a.jobDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.pageNumber || 0) - (a.pageNumber || 0);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'worksheet_entries');
    return [];
  }
}

export async function saveWorksheetEntry(entry: WorksheetEntry): Promise<void> {
  const path = `worksheet_entries/${entry.id}`;
  try {
    await setDoc(doc(db, 'worksheet_entries', entry.id), cleanForFirestore({
      ...entry,
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function deleteWorksheetEntry(id: string): Promise<void> {
  const path = `worksheet_entries/${id}`;
  try {
    await deleteDoc(doc(db, 'worksheet_entries', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeWorksheetEntries(onUpdate: (entries: WorksheetEntry[]) => void): () => void {
  const path = 'worksheet_entries';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: WorksheetEntry[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as WorksheetEntry);
    });
    const sorted = list.sort((a, b) => {
      const dateDiff = new Date(b.jobDate).getTime() - new Date(a.jobDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.pageNumber || 0) - (a.pageNumber || 0);
    });
    onUpdate(sorted);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

// ==========================================
// 10. NOTIFICATIONS SERVICE
// ==========================================

export async function getNotifications(): Promise<AppNotification[]> {
  try {
    const snapshot = await getDocs(collection(db, 'notifications'));
    const list: AppNotification[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as AppNotification);
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'notifications');
    return [];
  }
}

export function subscribeNotifications(onUpdate: (notifications: AppNotification[]) => void): () => void {
  const path = 'notifications';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: AppNotification[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as AppNotification);
    });
    const sorted = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onUpdate(sorted);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export async function createNotification(notif: Partial<AppNotification> & { title: string; message: string }): Promise<string> {
  const id = notif.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const fullNotif: AppNotification = {
    id,
    title: notif.title,
    message: notif.message,
    type: notif.type || 'general',
    targetPermission: notif.targetPermission || 'all',
    jobId: notif.jobId,
    jobNo: notif.jobNo,
    customerName: notif.customerName,
    componentName: notif.componentName,
    targetTab: notif.targetTab,
    createdAt: notif.createdAt || new Date().toISOString(),
    createdByUid: notif.createdByUid || auth.currentUser?.uid || 'system',
    createdByName: notif.createdByName || auth.currentUser?.displayName || auth.currentUser?.email || 'System',
    readBy: notif.readBy || [],
    dismissedBy: notif.dismissedBy || [],
    dismissedAt: notif.dismissedAt || {}
  };

  try {
    await setDoc(doc(db, 'notifications', id), cleanForFirestore(fullNotif));
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `notifications/${id}`);
    throw error;
  }
}

export async function markNotificationDismissed(notificationId: string, uid: string): Promise<void> {
  try {
    const notifRef = doc(db, 'notifications', notificationId);
    const snap = await getDoc(notifRef);
    if (!snap.exists()) return;
    const data = snap.data() as AppNotification;
    const dismissedBy = Array.from(new Set([...(data.dismissedBy || []), uid]));
    const dismissedAt = {
      ...(data.dismissedAt || {}),
      [uid]: new Date().toISOString()
    };
    const readBy = Array.from(new Set([...(data.readBy || []), uid]));

    await updateDoc(notifRef, cleanForFirestore({
      dismissedBy,
      dismissedAt,
      readBy
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsDismissed(notificationIds: string[], uid: string): Promise<void> {
  const now = new Date().toISOString();
  for (const notifId of notificationIds) {
    try {
      const notifRef = doc(db, 'notifications', notifId);
      const snap = await getDoc(notifRef);
      if (snap.exists()) {
        const data = snap.data() as AppNotification;
        const dismissedBy = Array.from(new Set([...(data.dismissedBy || []), uid]));
        const dismissedAt = { ...(data.dismissedAt || {}), [uid]: now };
        const readBy = Array.from(new Set([...(data.readBy || []), uid]));
        await updateDoc(notifRef, cleanForFirestore({ dismissedBy, dismissedAt, readBy }));
      }
    } catch (e) {
      console.error(`Error dismissing notification ${notifId}:`, e);
    }
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notifications/${notificationId}`);
  }
}

// ==========================================
// 11. COMPANY GROUP CHAT SERVICE
// ==========================================

export async function getChatMessages(): Promise<ChatMessage[]> {
  try {
    const snapshot = await getDocs(collection(db, 'chat_messages'));
    const list: ChatMessage[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
    });
    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'chat_messages');
    return [];
  }
}

export function subscribeChatMessages(onUpdate: (messages: ChatMessage[]) => void): () => void {
  const path = 'chat_messages';
  return onSnapshot(collection(db, path), (snapshot) => {
    const list: ChatMessage[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
    });
    const sorted = list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    onUpdate(sorted);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export async function sendChatMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<void> {
  const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const fullMsg: ChatMessage = {
    ...msg,
    id,
    createdAt: new Date().toISOString(),
    reactions: {}
  };

  try {
    await setDoc(doc(db, 'chat_messages', id), cleanForFirestore(fullMsg));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `chat_messages/${id}`);
    throw error;
  }
}

export async function toggleChatReaction(messageId: string, emoji: string, uid: string): Promise<void> {
  try {
    const msgRef = doc(db, 'chat_messages', messageId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;
    const data = snap.data() as ChatMessage;
    const reactions = { ...(data.reactions || {}) };
    const currentUsers = reactions[emoji] || [];
    if (currentUsers.includes(uid)) {
      reactions[emoji] = currentUsers.filter(u => u !== uid);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji] = [...currentUsers, uid];
    }
    await updateDoc(msgRef, cleanForFirestore({ reactions }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chat_messages/${messageId}`);
  }
}




