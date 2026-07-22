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
