export interface UserPermissions {
  canReceive: boolean;
  canInspect: boolean;
  canQuote: boolean;
  canCreateJobCard: boolean;
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
  isCustom?: boolean;
}

export interface JobPreQuote {
  steps?: JobQuoteStep[];
  totalCost?: number;
  quotedAt?: string;
  quotedBy?: string;
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

export interface Job {
  id: string;
  deliveryNoteNumber: string;
  customerId: string;
  customerName: string;
  componentType: string;
  modelName: string;
  serialNumber: string;
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
  showHardStampBox: true,
  showConsumablesTable: true,
  showOutsourcingTable: true,
  showApprovalSignature: true,
  showDueDate: true,
  labels: {
    orderNumber: "Order #",
    yourRef: "Your Ref. 1",
    customerJobNumber: "Customer Job #",
    deliveryNoteNumber: "Delivery / RFQ #",
    leadTechnician: "Status / Tech",
    workshopArea: "AREA",
    dueDate: "Due Date",
    scheduledDate: "Scheduled Start",
    specialInstructions: "Special Technical Instructions",
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

