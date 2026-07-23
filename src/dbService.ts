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
import { db } from './firebase';
import { Customer, ComponentMatrix, Job, CustomColumn, UserProfile, UserPermissions, JobCardFormatConfig, DEFAULT_JOB_CARD_FORMAT } from './types';

// ==========================================
// 1. CONFIG / CUSTOM COLUMNS SERVICE
// ==========================================
const CONFIG_DOC_ID = 'job_custom_fields';
const JOB_CARD_FORMAT_DOC_ID = 'job_card_format';

export async function getCustomColumns(): Promise<CustomColumn[]> {
  try {
    const configDoc = await getDoc(doc(db, 'config', CONFIG_DOC_ID));
    if (configDoc.exists()) {
      return (configDoc.data().customColumns as CustomColumn[]) || [];
    }
    // Seed default custom columns if empty
    const defaultCols: CustomColumn[] = [
      { id: 'transport_sheet_no', label: 'Transport Sheet Number', type: 'text' },
      { id: 'damage_severity', label: 'Damage Severity Level', type: 'text' }
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
  await setDoc(doc(db, 'jobs', job.id), {
    ...job,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteJob(id: string): Promise<void> {
  await deleteDoc(doc(db, 'jobs', id));
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
        { id: 'transport_sheet_no', label: 'Transport Sheet Number', type: 'text' },
        { id: 'damage_severity', label: 'Damage Severity Level', type: 'text' }
      ];
      await setDoc(doc(db, 'config', CONFIG_DOC_ID), { customColumns: defaultCols });
    }

    // 4. Seed sample jobs if empty
    const jobsSnap = await getDocs(collection(db, 'jobs'));
    if (jobsSnap.empty) {
      console.log("Seeding default jobs...");
      const defaultJobs: Job[] = [
        {
          id: 'C00001',
          deliveryNoteNumber: 'DN-9941',
          customerId: 'cust-cat',
          customerName: 'Caterpillar Mining Division',
          componentType: 'Spindle',
          modelName: '777 Rear',
          serialNumber: 'SN-CAT-88912',
          status: 'Received',
          customFields: {
            transport_sheet_no: 'TR-502',
            damage_severity: 'Medium'
          },
          dateReceived: new Date().toISOString().split('T')[0],
          capturedBy: 'Default Receiver',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'C00002',
          deliveryNoteNumber: 'DN-9941',
          customerId: 'cust-cat',
          customerName: 'Caterpillar Mining Division',
          componentType: 'Wheel Hub',
          modelName: 'H100 Heavy',
          serialNumber: 'SN-CAT-4451A',
          status: 'Inspected',
          customFields: {
            transport_sheet_no: 'TR-502',
            damage_severity: 'High'
          },
          dateReceived: new Date().toISOString().split('T')[0],
          capturedBy: 'Default Receiver',
          inspectionDetails: {
            inspectorName: 'Bob Inspector',
            inspectedAt: new Date().toISOString().split('T')[0],
            customerInstructions: 'Perform full bearing refit and CNC lathe rework.',
            findings: 'Spigot face is worn down by 1.2mm, microcracks detected near inner flange ring.',
            inspectorNotes: 'Needs 2 hours lathe machining plus standard steps.'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'C00003',
          deliveryNoteNumber: 'DN-8872',
          customerId: 'cust-bw',
          customerName: 'Barloworld Equipment',
          componentType: 'Spindle',
          modelName: '630 Front',
          serialNumber: 'SN-BAR-771',
          status: 'PreQuoted',
          customFields: {
            transport_sheet_no: 'TR-211',
            damage_severity: 'Low'
          },
          dateReceived: new Date(Date.now() - 48 * 3600 * 1000).toISOString().split('T')[0],
          capturedBy: 'Default Receiver',
          inspectionDetails: {
            inspectorName: 'Bob Inspector',
            inspectedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
            customerInstructions: 'Standard re-chrome and grinding.',
            findings: 'Minor corrosion on journal sleeve, dimensions are salvageable.',
            inspectorNotes: 'Journals show light galling, standard re-chrome required.'
          },
          preQuoteDetails: {
            steps: [
              { stepName: 'Sandblasting', price: 120 },
              { stepName: 'Crack Detection', price: 200 },
              { stepName: 'Hard Chrome Plating', price: 950 },
              { stepName: 'Precision Grinding', price: 400 },
              { stepName: 'Final Micro Inspection', price: 100 }
            ],
            totalCost: 1770,
            quotedAt: new Date().toISOString().split('T')[0],
            quotedBy: 'Sarah Quoter'
          },
          createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      for (const job of defaultJobs) {
        await setDoc(doc(db, 'jobs', job.id), job);
      }
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
