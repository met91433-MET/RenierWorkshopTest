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
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Customer, Machine, ComponentMatrix, Job, CustomColumn, UserProfile, UserPermissions, JobCardFormatConfig, DEFAULT_JOB_CARD_FORMAT, ToolStockItem, ConsumableItem, ConsumableAllocationLog } from './types';
import { sanitizeJobForFirestoreAsync } from './utils/imageCompressor';

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
  await setDoc(doc(db, 'config', CONFIG_DOC_ID), { customColumns: columns });
}

export async function getJobCardFormatConfig(): Promise<JobCardFormatConfig> {
  try {
    const formatDoc = await getDoc(doc(db, 'config', JOB_CARD_FORMAT_DOC_ID));
    if (formatDoc.exists()) {
      const data = formatDoc.data() as JobCardFormatConfig;
      // Merge with default format in case new fields/sections were added
      return {
        ...DEFAULT_JOB_CARD_FORMAT,
        ...data,
        labels: {
          ...DEFAULT_JOB_CARD_FORMAT.labels,
          ...(data.labels || {})
        },
        sections: data.sections && data.sections.length > 0 ? data.sections : DEFAULT_JOB_CARD_FORMAT.sections
      };
    }
    // Seed default format if empty
    await setDoc(doc(db, 'config', JOB_CARD_FORMAT_DOC_ID), DEFAULT_JOB_CARD_FORMAT);
    return DEFAULT_JOB_CARD_FORMAT;
  } catch (error) {
    console.error("Error fetching Job Card format config:", error);
    return DEFAULT_JOB_CARD_FORMAT;
  }
}

export async function saveJobCardFormatConfig(config: JobCardFormatConfig): Promise<void> {
  await setDoc(doc(db, 'config', JOB_CARD_FORMAT_DOC_ID), {
    ...config,
    updatedAt: new Date().toISOString()
  });
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
  await setDoc(doc(db, 'customers', customer.id), {
    ...customer,
    updatedAt: new Date().toISOString()
  });
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
  await setDoc(doc(db, 'machines', machine.id), {
    ...machine,
    updatedAt: new Date().toISOString()
  });
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
  await setDoc(doc(db, 'components', matrix.id), {
    ...matrix,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteComponentMatrix(id: string): Promise<void> {
  await deleteDoc(doc(db, 'components', id));
}

// ==========================================
// 4. USER PERMISSIONS AND PROFILE SERVICE
// ==========================================
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
  await setDoc(doc(db, 'users', profile.uid), profile);
}

export async function updateUserPermissions(uid: string, permissions: UserPermissions): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { permissions });
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
  await setDoc(doc(db, 'jobs', sanitizedJob.id), {
    ...sanitizedJob,
    updatedAt: new Date().toISOString()
  });
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
          serialNumber: 'MC-2024-8891',
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
          serialNumber: '777D-SP-4402',
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
    await setDoc(doc(db, 'tool_stock', tool.id), {
      ...tool,
      updatedAt: new Date().toISOString()
    });
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
    await setDoc(doc(db, 'consumables', item.id), {
      ...item,
      updatedAt: new Date().toISOString()
    });
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
  await setDoc(doc(db, 'consumable_allocations', log.id), {
    ...log
  });
}

export async function deleteConsumableAllocationLog(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'consumable_allocations', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `consumable_allocations/${id}`);
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
  } catch (err) {
    console.error("Error seeding stores data:", err);
  }
}

