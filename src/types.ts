export interface UserPermissions {
  canReceive: boolean;
  canInspect: boolean;
  canQuote: boolean;
  canCreateJobCard: boolean;
  canStores: boolean;
  canWorksheet?: boolean;
  canReporting?: boolean;
  canClose: boolean;
  isAdmin: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  permissions: UserPermissions;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

export interface MachineServiceLog {
  id: string;
  date: string; // YYYY-MM-DD format
  orderNumber: string; // Repair / Order number
  issue: string; // Issue or repair details
  loggedAt?: string;
  loggedBy?: string;
}

export interface MachineTimesheetBook {
  id: string;
  bookNumber: string; // e.g. "301-360"
  startPage: number; // e.g. 301
  endPage: number; // e.g. 360
  dateAppointed: string; // YYYY-MM-DD
  status?: 'Active' | 'Completed' | 'Archived' | string;
  notes?: string;
  loggedAt?: string;
}

export interface Machine {
  id: string;
  machineName: string;
  serialNumber: string; // Machine Number / Identifying Field
  make?: string;
  machineType?: string;
  model?: string;
  location?: string;
  customerName?: string;
  category?: string;
  specs?: Record<string, string>;
  notes?: string;
  status?: 'Operational' | 'Active' | 'In Maintenance' | 'Under Repair' | 'Decommissioned' | string;
  files?: JobFile[];
  linkedJobIds?: string[];
  serviceLogs?: MachineServiceLog[];
  timesheetBooks?: MachineTimesheetBook[];
  createdAt: string;
  updatedAt?: string;
}

// Stores Dashboard Types
export interface ToolStockItem {
  id: string;
  description: string;
  typeSize: string;
  quantity: number;
  addedDate: string; // YYYY-MM-DD
  employeeNumber: string; // "Stores" when in stock, clock number when signed out
  signOutDate: string; // YYYY-MM-DD or empty
  dateReturn: string; // YYYY-MM-DD or empty
  status: 'In Stock' | 'Signed Out';
  createdAt?: string;
  updatedAt?: string;
}

export interface ConsumableItem {
  id: string;
  description: string;
  typeSize: string;
  quantity: number;
  addedDate: string; // YYYY-MM-DD
  createdAt?: string;
  updatedAt?: string;
}

export interface ConsumableAllocationLog {
  id: string;
  consumableId: string;
  consumableDescription: string;
  consumableTypeSize: string;
  clockNumber: string;
  jobNumber: string;
  machineNumber?: string;
  quantityAllocated: number;
  allocatedAt: string; // ISO or formatted date string
  loggedBy?: string;
}

export interface ToolLog {
  id: string;
  toolId?: string;
  toolDescription: string;
  toolTypeSize: string;
  action: 'Signed Out' | 'Returned' | 'Added' | 'Deleted' | string;
  clockNumber?: string;
  actionDate: string; // ISO timestamp
  loggedBy?: string;
}

// Worksheet Dashboard Types
export interface WorksheetEntry {
  id: string;
  pageNumber: number; // e.g. 305
  bookNumber?: string; // e.g. "301-360"
  machineId?: string; // Machine ID
  machineSerialNumber?: string; // Serial / equipment tag
  machineName?: string; // e.g. "Lathe #1"
  clockNumber: string; // Employee / Operator clock number
  operatorName?: string; // Operator name
  jobDate: string; // YYYY-MM-DD
  jobNumber: string; // e.g. "JOB-2026-001" or "JC-2026-001"
  startTime: string; // HH:mm e.g. "07:30"
  endTime: string; // HH:mm e.g. "11:45"
  durationMinutes?: number; // Calculated elapsed time in minutes
  durationHours?: number; // Calculated elapsed time in decimal hours
  operation: string; // e.g. "Machining", "Turning", "Grinding", "Boring", "Fitting"
  notes?: string;
  capturedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ComponentStep {
  stepName: string;
  prices: { [modelName: string]: number };
}

export interface ComponentMatrix {
  id: string; // e.g., 'Spindle'
  name: string; // e.g., 'Spindle'
  models: string[]; // e.g., ['777 Rear', '630 Front']
  steps: ComponentStep[]; // List of steps and their price mappings
  updatedAt: string;
}

export interface JobFile {
  name: string;
  type: string;
  size: number;
  dataUrl: string; // Base64 data url for preview and persistence
  uploadedAt: string;
  category?: 'delivery' | 'job' | 'inspection' | string;
}

export function deduplicateJobFiles(files: JobFile[]): JobFile[] {
  if (!files || !Array.isArray(files)) return [];
  const seen = new Set<string>();
  const result: JobFile[] = [];

  for (const f of files) {
    if (!f) continue;
    const dataKey = f.dataUrl ? f.dataUrl.slice(0, 300) : '';
    const key = `${f.name}_${f.size}_${dataKey}`;
      
    if (!seen.has(key)) {
      seen.add(key);
      result.push(f);
    }
  }

  return result;
}

export interface JobInspection {
  inspectorName?: string;
  inspectedAt?: string;
  customerInstructions?: string;
  inspectorNotes?: string;
  findings?: string;
}

export interface JobQuoteStep {
  stepName: string;
  price: number;
  quantity?: number;
  isCustom?: boolean;
}

export interface JobPreQuote {
  preQuoteId?: string;
  steps?: JobQuoteStep[];
  totalCost?: number;
  quotedAt?: string;
  quotedBy?: string;
}

export function getPreQuoteId(job: Job, allJobs?: Job[]): string {
  if (job.preQuoteDetails?.preQuoteId) {
    return job.preQuoteDetails.preQuoteId;
  }
  if (allJobs && Array.isArray(allJobs)) {
    const preQuotedJobs = allJobs
      .filter(j => j.status === 'PreQuoted' || Boolean(j.preQuoteDetails?.steps && j.preQuoteDetails.steps.length > 0))
      .sort((a, b) => (a.createdAt || a.id).localeCompare(b.createdAt || b.id));
    const idx = preQuotedJobs.findIndex(j => j.id === job.id);
    if (idx >= 0) {
      return `PQ${String(idx + 1).padStart(5, '0')}`;
    }
  }
  const digits = job.id.replace(/\D/g, '');
  const num = digits ? parseInt(digits, 10) : 1;
  return `PQ${String(num).padStart(5, '0')}`;
}

export interface JobCardDetails {
  jobCardNumber?: string;
  assignedTechnician?: string;
  scheduledDate?: string;
  requiredParts?: string;
  instructions?: string;
  jobCardCreatedAt?: string;
  jobCardCreatedBy?: string;
  orderNumber?: string;
  yourRef?: string;
  customerJobNumber?: string;
  dueDate?: string;
  workshopArea?: string;
}

export interface JobClosingDetails {
  closedAt?: string;
  closedBy?: string;
  closingNotes?: string;
  qualityReleaseSign?: string;
  closeReason?: 'completed' | 'returned';
}

/**
 * Checks whether a job has received customer Go-Ahead / Order Number approval.
 */
export function hasJobGoAhead(job: Job | null | undefined): boolean {
  if (!job) return false;
  const orderNo = (job.jobCardDetails?.orderNumber || job.customerOrderNo || job.purchaseOrderNumber)?.trim();
  return Boolean(
    orderNo &&
    orderNo !== '' &&
    orderNo.toUpperCase() !== 'NONE' &&
    orderNo.toUpperCase() !== 'PENDING' &&
    orderNo.toUpperCase() !== 'NA' &&
    orderNo.toUpperCase() !== 'N/A'
  );
}

export interface Job {
  id: string;
  deliveryNoteNumber: string;
  customerId: string;
  customerName: string;
  customerBranch?: string;
  customerOrderNo?: string;
  purchaseOrderNumber?: string;
  componentType: string;
  modelName: string;
  serialNumber: string;
  partNumber?: string;
  customerJobNo?: string;
  partDescription?: string;
  qty?: number;
  status: 'Received' | 'Inspected' | 'PreQuoted' | 'JobCardCreated' | 'Closed';
  customFields?: { [columnId: string]: string | number | boolean };
  files?: JobFile[];
  dateReceived: string;
  capturedBy: string;
  inspectionDetails?: JobInspection;
  preQuoteDetails?: JobPreQuote;
  jobCardDetails?: JobCardDetails;
  closingDetails?: JobClosingDetails;
  createdAt: string;
  updatedAt: string;
}

export interface CustomColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
}

export interface JobCardSectionConfig {
  id: string; // e.g. 'header', 'customer_info', 'job_specs', 'qc_inspection', 'quoted_steps', 'materials_required', 'technician_routing', 'signoff'
  title: string;
  enabled: boolean;
  order: number;
  customTitle?: string;
}

export interface JobCardFormatLabels {
  orderNumber: string;
  yourRef: string;
  customerJobNumber: string;
  deliveryNoteNumber: string;
  leadTechnician: string;
  workshopArea: string;
  dueDate: string;
  scheduledDate: string;
  specialInstructions: string;
  requiredParts: string;
  approvalSignature: string;
  hardStampDate: string;
  consumablesTitle: string;
  outsourcingTitle: string;
  page2Warning: string;
  preQuoteNumberLabel?: string;
  quotationDateLabel?: string;
  estimatorLabel?: string;
  validityLabel?: string;
  repairScopeHeader?: string;
  customerPriceHeader?: string;
}

export interface JobCardFormatConfig {
  companyName: string;
  companySubtitle: string;
  companyTagline: string;
  documentTitle: string;
  isoCertText: string;
  sabsBadgeText: string;
  
  // Logo customization
  showCompanyLogo: boolean;
  logoUrl?: string;
  logoAlignment: 'left' | 'center' | 'right';
  logoSize: 'small' | 'medium' | 'large';

  // Aesthetic styling & colors
  accentColor: string; // e.g. #dc2626 (Job # and accent lines)
  customerTextColor: string; // e.g. #c026d3 (pink/magenta)
  consumablesHeaderBg: string; // e.g. #e0f2fe (cyan/light blue)
  outsourcingHeaderBg: string; // e.g. #fef08a (yellow/amber)
  stampBoxBorderColor: string; // e.g. #22c55e (green)
  borderWidth: 'thin' | 'normal' | 'thick';

  // Element visibility toggles
  showSabsBadge: boolean;
  showIsoBadge: boolean;
  showAreaBadge: boolean;
  showHardStampBox: boolean;
  showConsumablesTable: boolean;
  showOutsourcingTable: boolean;
  showApprovalSignature: boolean;
  showDueDate: boolean;

  labels: JobCardFormatLabels;
  sections: JobCardSectionConfig[];
  footerNotePage1: string;
  footerNotePage2: string;
  updatedAt?: string;
}

export const DEFAULT_JOB_CARD_FORMAT: JobCardFormatConfig = {
  companyName: "METALOGIK",
  companySubtitle: "ENGINEERING SERVICES (Pty) Ltd",
  companyTagline: "OMNI NOTE",
  documentTitle: "Job Card",
  isoCertText: "ISO 9001",
  sabsBadgeText: "SABS",
  showCompanyLogo: true,
  logoUrl: "/metalogik_logo.png",
  logoAlignment: 'left',
  logoSize: 'medium',
  accentColor: "#dc2626",
  customerTextColor: "#c026d3",
  consumablesHeaderBg: "#e0f2fe",
  outsourcingHeaderBg: "#fef08a",
  stampBoxBorderColor: "#22c55e",
  borderWidth: "normal",
  showSabsBadge: true,
  showIsoBadge: true,
  showAreaBadge: true,
  showHardStampBox: false,
  showConsumablesTable: true,
  showOutsourcingTable: true,
  showApprovalSignature: true,
  showDueDate: true,
  labels: {
    orderNumber: "Order #",
    yourRef: "Your Ref. 1",
    customerJobNumber: "Customer Job #",
    deliveryNoteNumber: "Delivery / RFQ #",
    leadTechnician: "Status",
    workshopArea: "AREA",
    dueDate: "Due Date",
    scheduledDate: "Scheduled Start",
    specialInstructions: "Approved Repair Work Procedures",
    requiredParts: "Parts & Materials Required",
    approvalSignature: "Approval Signature",
    hardStampDate: "HARD STAMP DATE",
    consumablesTitle: "Consumables",
    outsourcingTitle: "Outsourcing",
    page2Warning: "DOCUMENT NOT to be copied for customer"
  },
  sections: [
    { id: 'header', title: 'Header & Company Branding', enabled: true, order: 1 },
    { id: 'customer_info', title: 'Customer & Reference Table', enabled: true, order: 2 },
    { id: 'model_sub_bar', title: 'Model & Description Bar', enabled: true, order: 3 },
    { id: 'work_instructions', title: 'Technical Procedure Box & Area Badge', enabled: true, order: 4 },
    { id: 'tables_grid', title: 'Consumables, Outsourcing & Hard Stamp Grid', enabled: true, order: 5 }
  ],
  footerNotePage1: "CONFIDENTIAL - WORKSHOP FLOOR ROUTING SLIP",
  footerNotePage2: "QUALITY CONTROL SIGN-OFF REQUIRED UPON COMPLETION"
};

/**
 * Standard Machine Display Name Formatter
 * Requirement: "When displaying machine name anywhere in dropdowns or labels, use the Machine number with Machine type, so if we are displaying M1, it should show M1 - Compressor."
 */
export function formatMachineDisplayName(machine?: {
  serialNumber?: string;
  machineNumber?: string;
  machineName?: string;
  machineType?: string;
  make?: string;
  model?: string;
} | null): string {
  if (!machine) return '';
  const num = (machine.serialNumber || machine.machineNumber || '').trim();
  const type = (machine.machineType || machine.machineName || machine.make || '').trim();
  
  if (num && type) {
    if (type.toLowerCase().startsWith(num.toLowerCase())) {
      return type;
    }
    return `${num} - ${type}`;
  }
  return num || type || 'Machine';
}

export function getMachineLabelByIdOrNumber(
  identifier: string | undefined | null,
  machines: Machine[] = []
): string {
  if (!identifier || identifier === 'ALL' || identifier === 'N/A') return identifier || '';
  const found = machines.find(
    (m) =>
      m.id === identifier ||
      m.serialNumber?.toLowerCase() === identifier.toLowerCase() ||
      m.machineName?.toLowerCase() === identifier.toLowerCase()
  );
  if (found) {
    return formatMachineDisplayName(found);
  }
  return identifier;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'job_received' | 'inspection_needed' | 'quote_needed' | 'job_card_ready' | 'stores_alert' | 'worksheet_logged' | 'general';
  targetPermission?: keyof UserPermissions | 'all';
  jobId?: string;
  jobNo?: string;
  customerName?: string;
  componentName?: string;
  targetTab?: string;
  createdAt: string; // ISO string
  createdByUid?: string;
  createdByName?: string;
  readBy?: string[]; // Array of user UIDs who have marked it read
  dismissedBy?: string[]; // Array of user UIDs who ticked/dismissed it
  dismissedAt?: Record<string, string>; // uid -> ISO date
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderEmail: string;
  senderRole?: string;
  text: string;
  imageUrl?: string;
  createdAt: string; // ISO string
  reactions?: Record<string, string[]>; // emoji -> array of uids
}

