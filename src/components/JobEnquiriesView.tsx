import React, { useState, useEffect } from 'react';
import { Job, JobFile, CustomColumn, ComponentMatrix, JobCardFormatConfig, DEFAULT_JOB_CARD_FORMAT, deduplicateJobFiles, ConsumableAllocationLog } from '../types';
import { getConsumableAllocationLogs } from '../dbService';
import { compressFile } from '../utils/imageCompressor';
import JobCardDocument from './JobCardDocument';
import CameraCaptureModal from './CameraCaptureModal';
import { openInNewWindow } from '../utils/printDoc';
import { 
  Archive, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  UserCheck, 
  Lock, 
  ClipboardCheck, 
  Wrench, 
  Calculator, 
  Layers, 
  UserX, 
  FileDown, 
  Paperclip, 
  Activity, 
  X,
  Printer,
  Edit2,
  Save,
  Check,
  Eye,
  Clock,
  Camera,
  Image as ImageIcon,
  Upload,
  Trash2,
  Download,
  ZoomIn,
  Plus,
  Truck,
  FileImage,
  RotateCcw,
  AlertTriangle,
  ClipboardList,
  PackageCheck
} from 'lucide-react';

interface JobEnquiriesViewProps {
  jobs: Job[];
  customColumns: CustomColumn[];
  componentsList?: ComponentMatrix[];
  onUpdateJob: (job: Job) => Promise<void>;
  onDeleteJob?: (id: string) => Promise<void>;
  onDeleteAllJobs?: () => Promise<void>;
  currentUser: any;
  jobCardFormat?: JobCardFormatConfig;
}

export default function JobEnquiriesView({
  jobs,
  customColumns,
  componentsList = [],
  onUpdateJob,
  onDeleteJob,
  onDeleteAllJobs,
  currentUser,
  jobCardFormat
}: JobEnquiriesViewProps) {
  const format = jobCardFormat || DEFAULT_JOB_CARD_FORMAT;

  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmDeleteAllModal, setShowConfirmDeleteAllModal] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  // Default filter: 'WaitingGoAhead' (Jobs with job cards waiting for customer's go-ahead / order)
  const [statusFilter, setStatusFilter] = useState<string>('WaitingGoAhead');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Modal active sub-tab: 'overview' | 'pictures' | 'reprint' | 'edit' | 'close' | 'goAhead'
  const [modalTab, setModalTab] = useState<'overview' | 'pictures' | 'reprint' | 'edit' | 'close' | 'goAhead'>('overview');

  // Consumable Allocation Logs State for Job Cards
  const [consumableLogs, setConsumableLogs] = useState<ConsumableAllocationLog[]>([]);
  const [loadingConsumables, setLoadingConsumables] = useState<boolean>(false);

  useEffect(() => {
    if (selectedJob) {
      setLoadingConsumables(true);
      getConsumableAllocationLogs()
        .then(logs => setConsumableLogs(logs))
        .catch(err => console.error("Error fetching consumable logs:", err))
        .finally(() => setLoadingConsumables(false));
    }
  }, [selectedJob]);

  // Helper to match consumable allocation logs linked to the selected job card
  const getLinkedConsumables = (job: Job | null): ConsumableAllocationLog[] => {
    if (!job) return [];
    const cardNo = job.jobCardDetails?.jobCardNumber?.trim().toUpperCase();
    const jobId = job.id?.trim().toUpperCase();
    const dnNo = job.deliveryNoteNumber?.trim().toUpperCase();

    return consumableLogs.filter(log => {
      if (!log.jobNumber) return false;
      const jNo = log.jobNumber.trim().toUpperCase();
      return Boolean(
        (cardNo && jNo === cardNo) ||
        (jobId && jNo === jobId) ||
        (dnNo && jNo === dnNo)
      );
    });
  };

  const linkedConsumables = getLinkedConsumables(selectedJob);

  // Job Pictures State
  const [pictureCategoryFilter, setPictureCategoryFilter] = useState<'all' | 'delivery' | 'job' | 'inspection'>('all');
  const [uploadCategory, setUploadCategory] = useState<'delivery' | 'job' | 'inspection'>('job');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraOverrideCategory, setCameraOverrideCategory] = useState<'delivery' | 'job' | 'inspection' | undefined>(undefined);
  const [deletingFileIndex, setDeletingFileIndex] = useState<number | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; name: string; category?: string; uploadedAt?: string; size?: number; originalIdx?: number } | null>(null);

  // Helper to test if a file is a photo
  const isPictureFile = (file: JobFile): boolean => {
    return (
      file.type?.startsWith('image/') ||
      file.dataUrl?.startsWith('data:image/') ||
      /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(file.name)
    );
  };

  // Helper to categorize photos
  const getPhotoCategory = (file: JobFile): 'delivery' | 'job' | 'inspection' => {
    if (file.category === 'delivery' || file.category === 'job' || file.category === 'inspection') {
      return file.category;
    }
    const nameLower = (file.name || '').toLowerCase();
    if (nameLower.includes('delivery') || nameLower.includes('received') || nameLower.includes('pod') || nameLower.includes('dn')) {
      return 'delivery';
    }
    if (nameLower.includes('inspect') || nameLower.includes('qc') || nameLower.includes('finding')) {
      return 'inspection';
    }
    return 'job';
  };

  const processPhotoFiles = async (fileList: File[], categoryOverride?: 'delivery' | 'job' | 'inspection') => {
    if (!fileList || fileList.length === 0 || !selectedJob) return;

    const targetCat = categoryOverride || uploadCategory;
    setIsUploadingPhoto(true);
    const newFiles: JobFile[] = [];

    for (const file of fileList) {
      const { dataUrl, size } = await compressFile(file, 1024, 0.65);
      newFiles.push({
        name: file.name,
        type: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
        size: size || file.size,
        dataUrl: dataUrl,
        uploadedAt: new Date().toISOString(),
        category: targetCat
      });
    }

    if (newFiles.length > 0) {
      try {
        if (targetCat === 'delivery') {
          // Sync delivery photo across all jobs on this delivery
          const deliveryJobs = jobs.filter(j => j.deliveryNoteNumber === selectedJob.deliveryNoteNumber);
          for (const dJob of deliveryJobs) {
            const updatedJob: Job = {
              ...dJob,
              files: deduplicateJobFiles([...(dJob.files || []), ...newFiles]),
              updatedAt: new Date().toISOString()
            };
            await onUpdateJob(updatedJob);
            if (dJob.id === selectedJob.id) {
              setSelectedJob(updatedJob);
            }
          }
        } else {
          const updatedJob: Job = {
            ...selectedJob,
            files: deduplicateJobFiles([...(selectedJob.files || []), ...newFiles]),
            updatedAt: new Date().toISOString()
          };
          await onUpdateJob(updatedJob);
          setSelectedJob(updatedJob);
        }
      } catch (err) {
        console.error("Failed to update job with new pictures:", err);
        alert("Failed to save uploaded picture(s).");
      }
    }
    setIsUploadingPhoto(false);
  };

  const handleUploadPictures = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedJob) return;

    await processPhotoFiles(Array.from(files));
    e.target.value = '';
  };

  // Keep selectedJob synchronized when jobs array updates in background
  React.useEffect(() => {
    if (selectedJob) {
      const updated = jobs.find(j => j.id === selectedJob.id);
      if (updated) {
        setSelectedJob(updated);
      }
    }
  }, [jobs]);

  const handleDeletePicture = async (fileIndexInAllFiles: number) => {
    if (!selectedJob || !selectedJob.files) return;

    try {
      setIsDeletingPhoto(true);
      const updatedFiles = selectedJob.files.filter((_, idx) => idx !== fileIndexInAllFiles);
      const updatedJob: Job = {
        ...selectedJob,
        files: updatedFiles,
        updatedAt: new Date().toISOString()
      };
      await onUpdateJob(updatedJob);
      setSelectedJob(updatedJob);
      setDeletingFileIndex(null);
      if (lightboxPhoto) {
        setLightboxPhoto(null);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete picture.");
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  // Closing Form State
  const [closedBy, setClosedBy] = useState(currentUser?.displayName || currentUser?.email || '');
  const [closedAt, setClosedAt] = useState(new Date().toISOString().split('T')[0]);
  const [closingNotes, setClosingNotes] = useState('');
  const [qualityReleaseSign, setQualityReleaseSign] = useState('');
  const [closeReasonOption, setCloseReasonOption] = useState<'completed' | 'returned'>('completed');
  const [isClosingSubmitting, setIsClosingSubmitting] = useState(false);

  // Edit Job Form State
  const [editTechnician, setEditTechnician] = useState('');
  const [editScheduledDate, setEditScheduledDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editWorkshopArea, setEditWorkshopArea] = useState('');
  const [editOrderNumber, setEditOrderNumber] = useState('');
  const [editYourRef, setEditYourRef] = useState('');
  const [editRequiredParts, setEditRequiredParts] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editSerialNumber, setEditSerialNumber] = useState('');
  const [editModelName, setEditModelName] = useState('');
  const [editComponentType, setEditComponentType] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Go-Ahead Capture Form State
  const [goAheadOrderNumber, setGoAheadOrderNumber] = useState('');
  const [goAheadYourRef, setGoAheadYourRef] = useState('');
  const [goAheadTechnician, setGoAheadTechnician] = useState('');
  const [goAheadScheduledDate, setGoAheadScheduledDate] = useState('');
  const [goAheadDueDate, setGoAheadDueDate] = useState('');
  const [isGoAheadSubmitting, setIsGoAheadSubmitting] = useState(false);

  // Helper to determine Job sequence (e.g. Job 1 of 3)
  const getJobSequenceString = (job: Job, allJobs: Job[]): string => {
    const deliveryJobs = allJobs.filter(j => j.deliveryNoteNumber === job.deliveryNoteNumber);
    const total = deliveryJobs.length;
    const sorted = [...deliveryJobs].sort((a, b) => {
      const timeA = a.createdAt || '';
      const timeB = b.createdAt || '';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return a.id.localeCompare(b.id);
    });
    const index = sorted.findIndex(j => j.id === job.id) + 1;
    return total === 1 ? "1 of 1" : `Job ${index} of ${total}`;
  };

  const handleSelectJob = (job: Job, defaultModalTab: 'overview' | 'reprint' | 'edit' | 'close' | 'goAhead' = 'overview') => {
    setSelectedJob(job);
    setModalTab(defaultModalTab);

    // Initialize Closing Form
    setClosedBy(currentUser?.displayName || currentUser?.email || 'Quality Inspector');
    setClosedAt(new Date().toISOString().split('T')[0]);
    setClosingNotes(job.closingDetails?.closingNotes || '');
    setQualityReleaseSign(job.closingDetails?.qualityReleaseSign || currentUser?.displayName || currentUser?.email || 'Quality Inspector');
    setCloseReasonOption(job.closingDetails?.closeReason || 'completed');

    // Helper for 1-month default due date
    const getDefaultDueDateForJob = (job: Job) => {
      if (job.jobCardDetails?.dueDate) return job.jobCardDetails.dueDate;
      const base = new Date(job.dateReceived || Date.now());
      if (isNaN(base.getTime())) {
        const fallback = new Date();
        fallback.setMonth(fallback.getMonth() + 1);
        return fallback.toISOString().split('T')[0];
      }
      base.setMonth(base.getMonth() + 1);
      return base.toISOString().split('T')[0];
    };

    // Initialize Edit Form
    setEditTechnician(job.jobCardDetails?.assignedTechnician || '');
    setEditScheduledDate(job.jobCardDetails?.scheduledDate || new Date().toISOString().split('T')[0]);
    setEditDueDate(getDefaultDueDateForJob(job));
    setEditWorkshopArea(job.jobCardDetails?.workshopArea || '9B');
    setEditOrderNumber(job.jobCardDetails?.orderNumber || '');
    setEditYourRef(job.jobCardDetails?.yourRef || '');
    setEditRequiredParts(job.jobCardDetails?.requiredParts || '');
    setEditInstructions(job.jobCardDetails?.instructions || '');
    setEditSerialNumber(job.serialNumber || '');
    setEditModelName(job.modelName || '');
    setEditComponentType(job.componentType || '');

    // Initialize Go-Ahead Form
    const existingOrder = job.jobCardDetails?.orderNumber || '';
    const isPlaceholder = !existingOrder || ['NONE', 'PENDING', 'NA', 'N/A'].includes(existingOrder.trim().toUpperCase());
    setGoAheadOrderNumber(isPlaceholder ? '' : existingOrder);
    setGoAheadYourRef(job.jobCardDetails?.yourRef || '');
    setGoAheadTechnician(job.jobCardDetails?.assignedTechnician || '');
    setGoAheadScheduledDate(job.jobCardDetails?.scheduledDate || new Date().toISOString().split('T')[0]);
    setGoAheadDueDate(getDefaultDueDateForJob(job));
  };

  const handleSaveGoAhead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!goAheadOrderNumber.trim()) {
      alert("Please enter the Customer Order Number / PO Number to confirm Go-Ahead.");
      return;
    }

    setIsGoAheadSubmitting(true);
    try {
      const updatedJob: Job = {
        ...selectedJob,
        jobCardDetails: {
          ...selectedJob.jobCardDetails,
          orderNumber: goAheadOrderNumber.trim(),
          yourRef: goAheadYourRef.trim() || selectedJob.jobCardDetails?.yourRef,
          assignedTechnician: goAheadTechnician.trim() || selectedJob.jobCardDetails?.assignedTechnician || '',
          scheduledDate: goAheadScheduledDate || selectedJob.jobCardDetails?.scheduledDate || new Date().toISOString().split('T')[0],
          dueDate: goAheadDueDate || selectedJob.jobCardDetails?.dueDate || '31 Dec 2025',
          createdBy: selectedJob.jobCardDetails?.createdBy || currentUser?.displayName || currentUser?.email || 'Operator',
          createdAt: selectedJob.jobCardDetails?.createdAt || new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      };

      await onUpdateJob(updatedJob);
      setSelectedJob(updatedJob);
      alert(`Job ${selectedJob.id} has received Customer Go-Ahead (Order #${goAheadOrderNumber.trim()}).`);
      setModalTab('overview');
    } catch (err) {
      console.error(err);
      alert("Failed to save Customer Go-Ahead order number.");
    } finally {
      setIsGoAheadSubmitting(false);
    }
  };

  const handleSaveEditedJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    setIsEditSubmitting(true);
    try {
      const updatedJob: Job = {
        ...selectedJob,
        serialNumber: editSerialNumber,
        modelName: editModelName,
        componentType: editComponentType,
        jobCardDetails: {
          ...selectedJob.jobCardDetails,
          assignedTechnician: editTechnician,
          scheduledDate: editScheduledDate,
          dueDate: editDueDate,
          workshopArea: editWorkshopArea,
          orderNumber: editOrderNumber,
          yourRef: editYourRef,
          requiredParts: editRequiredParts,
          instructions: editInstructions,
          createdBy: selectedJob.jobCardDetails?.createdBy || currentUser?.displayName || currentUser?.email || 'Operator',
          createdAt: selectedJob.jobCardDetails?.createdAt || new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      };

      await onUpdateJob(updatedJob);
      setSelectedJob(updatedJob);
      alert(`Job ${selectedJob.id} details successfully updated.`);
      setModalTab('overview');
    } catch (err) {
      console.error(err);
      alert("Failed to save edited job details.");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDirectInspectionPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedJob) return;

    await processPhotoFiles(Array.from(files), 'inspection');
    e.target.value = '';
  };

  const handleCloseJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!qualityReleaseSign.trim()) {
      alert("Please sign off the quality release before closing the job.");
      return;
    }

    const currentInspectionPhotosCount = (selectedJob.files || [])
      .filter(isPictureFile)
      .filter(f => getPhotoCategory(f) === 'inspection')
      .length;

    if (closeReasonOption === 'completed' && currentInspectionPhotosCount < 2) {
      alert(`Cannot close job under "Option 1 - Job Completed". At least 2 inspection photos (Pre-Inspection and Final Inspection) are required. Found: ${currentInspectionPhotosCount} of 2 inspection photos. Please attach the required photos before closing.`);
      return;
    }

    setIsClosingSubmitting(true);
    try {
      const updatedJob: Job = {
        ...selectedJob,
        status: 'Closed',
        closingDetails: {
          closedAt,
          closedBy,
          closingNotes,
          qualityReleaseSign,
          closeReason: closeReasonOption
        },
        updatedAt: new Date().toISOString()
      };

      await onUpdateJob(updatedJob);
      setSelectedJob(updatedJob);
      const reasonLabel = closeReasonOption === 'completed' ? 'Option 1 - Job Completed' : 'Option 2 - Job Returned Unrepaired';
      alert(`Job ${selectedJob.id} has been successfully closed as [${reasonLabel}].`);
      setModalTab('overview');
    } catch (error) {
      console.error(error);
      alert("Error closing job.");
    } finally {
      setIsClosingSubmitting(false);
    }
  };

  const handleOpenPrint = () => {
    openInNewWindow({
      elementId: 'printable-jobcard-doc',
      documentTitle: `Job Card - ${selectedJob?.jobCardDetails?.jobCardNumber || selectedJob?.id || 'Doc'}`
    });
  };

  // Helper to check if a job card has received customer order/go-ahead
  const hasGoAhead = (job: Job): boolean => {
    const orderNo = job.jobCardDetails?.orderNumber?.trim();
    return Boolean(
      orderNo &&
      orderNo !== '' &&
      orderNo.toUpperCase() !== 'NONE' &&
      orderNo.toUpperCase() !== 'PENDING' &&
      orderNo.toUpperCase() !== 'NA' &&
      orderNo.toUpperCase() !== 'N/A'
    );
  };

  // Filter & Search Logic: Only include jobs with job cards assigned to them
  const jobsWithJobCards = jobs.filter(job => 
    Boolean(job.jobCardDetails?.jobCardNumber) || job.status === 'JobCardCreated' || job.status === 'Closed'
  );

  const filteredJobs = jobsWithJobCards.filter(job => {
    const matchesSearch = 
      job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.jobCardDetails?.jobCardNumber && job.jobCardDetails.jobCardNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job.jobCardDetails?.orderNumber && job.jobCardDetails.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.componentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.serialNumber && job.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      job.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.jobCardDetails?.assignedTechnician && job.jobCardDetails.assignedTechnician.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesStatus = true;
    if (statusFilter === 'WaitingGoAhead') {
      matchesStatus = job.status !== 'Closed' && !hasGoAhead(job);
    } else if (statusFilter === 'GoAhead') {
      matchesStatus = job.status !== 'Closed' && hasGoAhead(job);
    } else if (statusFilter === 'Closed') {
      matchesStatus = job.status === 'Closed';
    } else if (statusFilter === 'ALL') {
      matchesStatus = true;
    } else {
      matchesStatus = job.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (job: Job) => {
    if (job.status === 'Closed') {
      return (
        <span className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full font-bold">
          Closed &amp; Archived
        </span>
      );
    }

    if (hasGoAhead(job)) {
      return (
        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Go-Ahead ({job.jobCardDetails?.orderNumber})</span>
        </span>
      );
    }

    return (
      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        <span>Waiting Go-Ahead</span>
      </span>
    );
  };

  const getStepProgressIndex = (status: Job['status']): number => {
    switch (status) {
      case 'Received': return 1;
      case 'Inspected': return 2;
      case 'PreQuoted': return 3;
      case 'JobCardCreated': return 4;
      case 'Closed': return 5;
      default: return 0;
    }
  };

  // Metrics
  const waitingGoAheadCount = jobsWithJobCards.filter(j => j.status !== 'Closed' && !hasGoAhead(j)).length;
  const goAheadCount = jobsWithJobCards.filter(j => j.status !== 'Closed' && hasGoAhead(j)).length;
  const closedJobsCount = jobsWithJobCards.filter(j => j.status === 'Closed').length;
  const totalJobCardsCount = jobsWithJobCards.length;

  return (
    <div className="space-y-6 text-left" id="job-enquiries-view-root">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 font-display flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-600" />
            Job Enquiries &amp; Active Workshop
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Central repository to view and filter jobs with assigned job cards, edit records, reprint job card documents, and close completed jobs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-bold text-amber-800">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Waiting Go-Ahead: {waitingGoAheadCount}</span>
          </div>
          <div className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Go-Ahead: {goAheadCount}</span>
          </div>
          <div className="flex items-center gap-2 text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700">
            <Archive className="w-3.5 h-3.5 text-slate-500" />
            <span>Closed: {closedJobsCount}</span>
          </div>
          <div className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl font-bold text-indigo-800">
            <Search className="w-3.5 h-3.5 text-indigo-600" />
            <span>Total Assigned: {totalJobCardsCount}</span>
          </div>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Job Card # (J00001), Order #, Component ID (C00001), Customer, Serial #, Delivery Note, Technician..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Status filter bar & Delete All */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 border border-slate-200/60 p-1 rounded-xl shadow-xs">
              {[
                { id: 'WaitingGoAhead', label: `Waiting Go-Ahead (${waitingGoAheadCount})` },
                { id: 'GoAhead', label: `Go-Ahead (${goAheadCount})` },
                { id: 'Closed', label: `Closed Jobs (${closedJobsCount})` },
                { id: 'ALL', label: `All Assigned (${totalJobCardsCount})` }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {onDeleteAllJobs && jobs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowConfirmDeleteAllModal(true)}
                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Delete all captured component entries"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All Captured ({jobs.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Jobs Table List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <th className="p-4 pl-6">Job Card &amp; Comp ID</th>
                <th className="p-4">Customer Name</th>
                <th className="p-4">Component &amp; Model</th>
                <th className="p-4">Serial Number</th>
                <th className="p-4">Technician / DN</th>
                <th className="p-4">Date Received</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right pr-6">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">No matching jobs found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {statusFilter === 'WaitingGoAhead' && 'No job cards are currently waiting for customer go-ahead / order.'}
                      {statusFilter === 'GoAhead' && 'No job cards currently have a customer order / go-ahead recorded.'}
                      {statusFilter === 'Closed' && 'No closed or archived jobs found.'}
                      {statusFilter === 'ALL' && 'No jobs with assigned job cards match your search.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => (
                  <tr 
                    key={job.id} 
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer font-medium"
                    onClick={() => handleSelectJob(job, 'overview')}
                  >
                    <td className="p-4 pl-6 font-bold text-slate-900 font-mono tracking-wider">
                      {job.jobCardDetails?.jobCardNumber ? (
                        <div className="text-indigo-600 font-extrabold text-sm flex items-center gap-1.5">
                          <span>Card #{job.jobCardDetails.jobCardNumber}</span>
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs font-normal">No Job Card</div>
                      )}
                      <div className="text-[11px] text-slate-500 font-mono">
                        Comp ID: {job.id}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-slate-800">
                      {job.customerName}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{job.modelName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{job.componentType}</div>
                    </td>
                    <td className="p-4 font-mono font-medium text-slate-700">
                      {job.serialNumber || 'N/A'}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{job.jobCardDetails?.assignedTechnician || 'Unassigned'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">DN: {job.deliveryNoteNumber}</div>
                    </td>
                    <td className="p-4 font-medium text-slate-600">
                      {new Date(job.dateReceived).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-center">
                      {getStatusBadge(job)}
                    </td>
                    <td className="p-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Add to Go-Ahead Button */}
                        {job.status !== 'Closed' && !hasGoAhead(job) && (
                          <button
                            onClick={() => handleSelectJob(job, 'goAhead')}
                            className="p-1.5 text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors font-bold text-[10px] px-2.5 py-1 flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Capture Customer Order # & Move to Go-Ahead"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Add to Go-Ahead</span>
                          </button>
                        )}

                        {/* Enquire / View */}
                        <button
                          onClick={() => handleSelectJob(job, 'overview')}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Enquire / View Job Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Reprint Job Card */}
                        {(job.jobCardDetails || job.status === 'JobCardCreated' || job.status === 'Closed') && (
                          <button
                            onClick={() => handleSelectJob(job, 'reprint')}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                            title="Reprint Job Card Document"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit Job Details */}
                        <button
                          onClick={() => handleSelectJob(job, 'edit')}
                          className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Edit Job Parameters"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Single Job */}
                        {onDeleteJob && (
                          <button
                            type="button"
                            onClick={() => setJobToDelete(job)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
                            title="Delete Captured Component Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Close / Sign Off */}
                        {job.status === 'JobCardCreated' && (
                          <button
                            onClick={() => handleSelectJob(job, 'close')}
                            className="p-1.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors font-bold text-[10px] px-2 py-1 flex items-center gap-1 cursor-pointer"
                            title="Close & Sign Off Job"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Close</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPREHENSIVE JOB ENQUIRY MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in text-left">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-md">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display flex items-center gap-2 text-white">
                    {selectedJob.jobCardDetails?.jobCardNumber ? (
                      <span className="text-emerald-400 font-mono font-black">
                        Job Card #{selectedJob.jobCardDetails.jobCardNumber}
                      </span>
                    ) : (
                      <span>Job Enquiry</span>
                    )}
                    <span className="text-xs text-slate-400 font-mono font-normal">
                      (Component ID: {selectedJob.id})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedJob.customerName} • {selectedJob.modelName} ({selectedJob.componentType}) • Serial: {selectedJob.serialNumber || 'N/A'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tab Navigation Bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center justify-between gap-2 flex-shrink-0 overflow-x-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalTab('overview')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    modalTab === 'overview'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Job Details
                </button>

                <button
                  onClick={() => setModalTab('pictures')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    modalTab === 'pictures'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Job Pictures</span>
                  {selectedJob?.files && selectedJob.files.filter(isPictureFile).length > 0 && (
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                      {selectedJob.files.filter(isPictureFile).length}
                    </span>
                  )}
                </button>

                {(selectedJob.jobCardDetails || selectedJob.status === 'JobCardCreated' || selectedJob.status === 'Closed') && (
                  <button
                    onClick={() => setModalTab('reprint')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      modalTab === 'reprint'
                        ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Reprint Job Card
                  </button>
                )}

                <button
                  onClick={() => setModalTab('edit')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    modalTab === 'edit'
                      ? 'bg-white text-amber-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Job Parameters
                </button>

                <button
                  onClick={() => setModalTab('close')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    modalTab === 'close'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  QC Sign-Off &amp; Closure
                </button>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {getStatusBadge(selectedJob)}
              </div>
            </div>

            {/* Modal Body depending on selected sub-tab */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 space-y-6">
              
              {/* SUB-TAB 1: JOB DETAILS OVERVIEW */}
              {modalTab === 'overview' && (
                <div className="space-y-6">
                  {/* Customer Order & Go-Ahead Details Block */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${hasGoAhead(selectedJob) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Customer Authorization</h4>
                          <h3 className="text-xs font-bold text-slate-800">Order &amp; Go-Ahead Details</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasGoAhead(selectedJob) ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Go-Ahead Active</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>Waiting Customer Go-Ahead</span>
                          </span>
                        )}
                        {selectedJob.status !== 'Closed' && (
                          <button
                            type="button"
                            onClick={() => setModalTab('goAhead')}
                            className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ml-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>{!hasGoAhead(selectedJob) ? 'Add Order #' : 'Edit Order #'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-600">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Customer Order Number</p>
                        <p className="font-mono font-extrabold text-slate-900 mt-0.5">
                          {selectedJob.jobCardDetails?.orderNumber && hasGoAhead(selectedJob) ? (
                            <span className="text-emerald-700">{selectedJob.jobCardDetails.orderNumber}</span>
                          ) : (
                            <span className="text-amber-600 italic font-normal">Awaiting Order #</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Order / Scheduled Date</p>
                        <p className="font-semibold text-slate-800 mt-0.5">
                          {selectedJob.jobCardDetails?.scheduledDate || 
                           (selectedJob.jobCardDetails?.jobCardCreatedAt ? new Date(selectedJob.jobCardDetails.jobCardCreatedAt).toLocaleDateString() : new Date(selectedJob.dateReceived).toLocaleDateString())}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Customer Reference</p>
                        <p className="font-semibold text-slate-800 mt-0.5">
                          {selectedJob.jobCardDetails?.yourRef || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Target Due Date</p>
                        <p className="font-semibold text-slate-800 mt-0.5">
                          {selectedJob.jobCardDetails?.dueDate || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Production Lifecycle Stage Progress</span>
                    <div className="flex items-center gap-1.5 w-full">
                      {[1, 2, 3, 4, 5].map((stageNum) => {
                        const activeIndex = getStepProgressIndex(selectedJob.status);
                        const isPassed = stageNum <= activeIndex;
                        const isCurrent = stageNum === activeIndex;
                        return (
                          <div key={stageNum} className="flex-1 flex flex-col gap-1">
                            <div className={`h-2.5 rounded-full transition-all ${
                              isCurrent 
                                ? 'bg-indigo-600 shadow-sm' 
                                : isPassed 
                                ? 'bg-emerald-500' 
                                : 'bg-slate-200'
                            }`} />
                            <span className={`text-[9px] font-bold text-center ${
                              isCurrent ? 'text-indigo-600 font-extrabold' : isPassed ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                              Stage {stageNum}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stage Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* STAGE 1: RECEIVING */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                          <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Stage 1</h4>
                            <h3 className="text-xs font-bold text-slate-800">Job Receiving Demographics</h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs text-slate-600">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Customer</p>
                            <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.customerName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Delivery Note #</p>
                            <p className="font-mono font-bold text-slate-800 mt-0.5">{selectedJob.deliveryNoteNumber}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Component Type</p>
                            <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.componentType}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Model Name</p>
                            <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.modelName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Part Number</p>
                            <p className="font-mono font-bold text-slate-800 mt-0.5">{selectedJob.serialNumber || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Date Received</p>
                            <p className="font-medium mt-0.5">{new Date(selectedJob.dateReceived).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* STAGE 2: QC / INSPECTION */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                          <div className="bg-amber-50 p-1.5 rounded-lg text-amber-600">
                            <ClipboardCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Stage 2</h4>
                            <h3 className="text-xs font-bold text-slate-800">QC Technical Assessment</h3>
                          </div>
                        </div>

                        {selectedJob.inspectionDetails ? (
                          <div className="space-y-3 text-xs text-slate-600">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Inspector</p>
                                <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.inspectionDetails.inspectorName || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Inspection Date</p>
                                <p className="font-semibold text-slate-800 mt-0.5">
                                  {selectedJob.inspectionDetails.inspectedAt ? new Date(selectedJob.inspectionDetails.inspectedAt).toLocaleDateString() : 'N/A'}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Findings &amp; Failure Mode</p>
                              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1 text-[11px] font-medium leading-relaxed max-h-20 overflow-y-auto">
                                {selectedJob.inspectionDetails.findings || 'No findings recorded.'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-slate-400">
                            <p className="text-xs font-semibold">Stage Pending</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STAGE 3: ESTIMATING / PRE-QUOTE */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                          <div className="bg-purple-50 p-1.5 rounded-lg text-purple-600">
                            <Calculator className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Stage 3</h4>
                            <h3 className="text-xs font-bold text-slate-800">Pre-Quote Estimation</h3>
                          </div>
                        </div>

                        {selectedJob.preQuoteDetails && selectedJob.preQuoteDetails.steps ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Prepared By</p>
                                <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.preQuoteDetails.quotedBy || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Total Estimated Cost</p>
                                <p className="font-mono font-bold text-purple-700 mt-0.5">
                                  ${selectedJob.preQuoteDetails.steps.reduce((sum, s) => sum + s.price, 0)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-slate-400">
                            <p className="text-xs font-semibold">Stage Pending</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STAGE 4: WORKSHOP ROUTING & JOB CARD */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                          <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600">
                            <Wrench className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Stage 4</h4>
                            <h3 className="text-xs font-bold text-slate-800">Workshop Routing &amp; Job Card</h3>
                          </div>
                        </div>

                        {selectedJob.jobCardDetails ? (
                          <div className="space-y-3 text-xs text-slate-600">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Job Card Number</p>
                                <p className="font-mono font-extrabold text-emerald-700 mt-0.5">{selectedJob.jobCardDetails.jobCardNumber || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Workshop Area</p>
                                <p className="font-mono font-bold text-slate-800 mt-0.5">{selectedJob.jobCardDetails.workshopArea || '9B'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Customer Ref</p>
                                <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.jobCardDetails.yourRef || 'NONE'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Target Due Date</p>
                                <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.jobCardDetails.dueDate || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-slate-400">
                            <p className="text-xs font-semibold">Stage Pending</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* STAGE 5 ARCHIVE & CLOSING DETAILS */}
                  {selectedJob.status === 'Closed' && selectedJob.closingDetails && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                      <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Archive className="w-4 h-4 text-slate-600" />
                        Stage 5 Quality Release &amp; Archive Certificate
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Date Closed</p>
                          <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.closingDetails.closedAt}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Released By</p>
                          <p className="font-semibold text-slate-800 mt-0.5">{selectedJob.closingDetails.closedBy}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Authorized Quality Signature</p>
                          <p className="font-serif font-bold text-emerald-800 mt-0.5">✓ {selectedJob.closingDetails.qualityReleaseSign}</p>
                        </div>
                      </div>
                      {selectedJob.closingDetails.closingNotes && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Release Notes</p>
                          <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            {selectedJob.closingDetails.closingNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* LINKED CONSUMABLE LOGS SECTION IN OVERVIEW */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="bg-amber-50 p-2 rounded-xl text-amber-600 border border-amber-200/60">
                          <ClipboardList className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Stores Sign-Out Audit</h4>
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <span>Linked Consumables Log</span>
                            {(selectedJob.jobCardDetails?.jobCardNumber || selectedJob.id) && (
                              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-mono px-2 py-0.5 rounded-md font-bold">
                                Job #{selectedJob.jobCardDetails?.jobCardNumber || selectedJob.id}
                              </span>
                            )}
                          </h3>
                        </div>
                      </div>

                      {linkedConsumables.length > 0 && (
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-xl">
                            {linkedConsumables.length} {linkedConsumables.length === 1 ? 'Entry' : 'Entries'}
                          </span>
                          <span className="bg-slate-100 text-slate-800 border border-slate-200 px-3 py-1 rounded-xl">
                            {linkedConsumables.reduce((sum, item) => sum + (item.quantityAllocated || 0), 0)} Units Issued
                          </span>
                        </div>
                      )}
                    </div>

                    {loadingConsumables ? (
                      <div className="text-center py-6 text-slate-400 text-xs font-medium">
                        Loading linked consumable allocation logs...
                      </div>
                    ) : linkedConsumables.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-4">
                        <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-xs font-bold text-slate-600">No consumables signed out for this job card yet</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                          When consumables are signed out in Stores referencing Job #{selectedJob.jobCardDetails?.jobCardNumber || selectedJob.id}, they will automatically appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs text-slate-600 border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                              <th className="p-3">Consumable Item</th>
                              <th className="p-3 text-center">Qty Issued</th>
                              <th className="p-3">Employee Clock #</th>
                              <th className="p-3">Machine #</th>
                              <th className="p-3">Issued By</th>
                              <th className="p-3 text-right">Date &amp; Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {linkedConsumables.map((log) => (
                              <tr key={log.id} className="hover:bg-amber-50/20 transition-colors">
                                <td className="p-3">
                                  <div className="font-bold text-slate-800">{log.consumableDescription}</div>
                                  {log.consumableTypeSize && (
                                    <div className="text-[10px] text-slate-400 font-mono">{log.consumableTypeSize}</div>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <span className="font-mono font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
                                    {log.quantityAllocated}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                    {log.clockNumber}
                                  </span>
                                </td>
                                <td className="p-3 font-mono font-semibold text-slate-700">
                                  {log.machineNumber || 'N/A'}
                                </td>
                                <td className="p-3 text-slate-600 font-medium">
                                  {log.loggedBy || 'Stores Operator'}
                                </td>
                                <td className="p-3 text-right text-slate-500 font-mono text-[11px]">
                                  {log.allocatedAt ? new Date(log.allocatedAt).toLocaleString() : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-TAB: JOB PICTURES GALLERY */}
              {modalTab === 'pictures' && (() => {
                const pictures = (selectedJob.files || [])
                  .map((file, originalIdx) => ({ file, originalIdx }))
                  .filter(item => isPictureFile(item.file));

                const deliveryPhotos = pictures.filter(item => getPhotoCategory(item.file) === 'delivery');
                const jobPhotos = pictures.filter(item => getPhotoCategory(item.file) === 'job');
                const inspectionPhotos = pictures.filter(item => getPhotoCategory(item.file) === 'inspection');

                const displayedPhotos = pictures.filter(item => {
                  if (pictureCategoryFilter === 'all') return true;
                  return getPhotoCategory(item.file) === pictureCategoryFilter;
                });

                return (
                  <div className="space-y-6">
                    {/* Header Banner & Filters */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <FileImage className="w-5 h-5 text-blue-600" />
                            Job Pictures Repository
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Centralized gallery for delivery photos, job component photos, and inspection report photos.
                          </p>
                        </div>

                        {/* Quick Upload Action */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setCameraOverrideCategory(uploadCategory);
                              setIsCameraModalOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Take Photo</span>
                          </button>

                          <label className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm">
                            <Upload className="w-4 h-4" />
                            <span>Upload Photos</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleUploadPictures}
                              className="hidden"
                              disabled={isUploadingPhoto}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Category Filter Pills & Target Upload Selector */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPictureCategoryFilter('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              pictureCategoryFilter === 'all'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <span>All Pictures</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${pictureCategoryFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                              {pictures.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPictureCategoryFilter('delivery')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              pictureCategoryFilter === 'delivery'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                            }`}
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Delivery Photos</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${pictureCategoryFilter === 'delivery' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-800'}`}>
                              {deliveryPhotos.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPictureCategoryFilter('job')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              pictureCategoryFilter === 'job'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                            }`}
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Job Photos</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${pictureCategoryFilter === 'job' ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
                              {jobPhotos.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPictureCategoryFilter('inspection')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              pictureCategoryFilter === 'inspection'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                            }`}
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            <span>Inspection Photos</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${pictureCategoryFilter === 'inspection' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'}`}>
                              {inspectionPhotos.length}
                            </span>
                          </button>
                        </div>

                        {/* Upload Category Selector */}
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">Target Category:</span>
                          <select
                            value={uploadCategory}
                            onChange={(e) => setUploadCategory(e.target.value as any)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800 focus:outline-hidden text-xs"
                          >
                            <option value="job">Job / Component Photo</option>
                            <option value="delivery">Delivery Photo</option>
                            <option value="inspection">Inspection Report Photo</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Pictures Grid / Empty State */}
                    {displayedPhotos.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {displayedPhotos.map(({ file, originalIdx }) => {
                          const cat = getPhotoCategory(file);
                          return (
                            <div
                              key={originalIdx}
                              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all group flex flex-col justify-between"
                            >
                              <div
                                className="relative aspect-4/3 bg-slate-900 overflow-hidden group cursor-pointer"
                                onClick={() => setLightboxPhoto({ url: file.dataUrl, name: file.name, category: cat, uploadedAt: file.uploadedAt, size: file.size, originalIdx })}
                              >
                                <img
                                  src={file.dataUrl}
                                  alt={file.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />

                                {/* Category Badge */}
                                <div className="absolute top-2 left-2 z-10">
                                  {cat === 'delivery' && (
                                    <span className="bg-blue-600/90 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-xs flex items-center gap-1">
                                      <Truck className="w-3 h-3" /> Delivery
                                    </span>
                                  )}
                                  {cat === 'job' && (
                                    <span className="bg-indigo-600/90 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-xs flex items-center gap-1">
                                      <Wrench className="w-3 h-3" /> Job Photo
                                    </span>
                                  )}
                                  {cat === 'inspection' && (
                                    <span className="bg-amber-600/90 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-xs flex items-center gap-1">
                                      <ClipboardCheck className="w-3 h-3" /> Inspection
                                    </span>
                                  )}
                                </div>

                                {/* Zoom Overlay */}
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="bg-white text-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5">
                                    <ZoomIn className="w-4 h-4 text-indigo-600" /> View Full
                                  </span>
                                </div>
                              </div>

                              {/* Card Meta & Actions */}
                              <div className="p-3 bg-white space-y-2">
                                <p className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                                  {file.name}
                                </p>

                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                  <span>{file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : 'N/A'}</span>
                                  <span>{Math.round(file.size / 1024)} KB</span>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                  <a
                                    href={file.dataUrl}
                                    download={file.name}
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                    title="Download Image"
                                  >
                                    <Download className="w-3.5 h-3.5" /> Download
                                  </a>

                                  {deletingFileIndex === originalIdx ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-rose-600 font-bold">Delete?</span>
                                      <button
                                        type="button"
                                        disabled={isDeletingPhoto}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePicture(originalIdx);
                                        }}
                                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                      >
                                        {isDeletingPhoto ? '...' : 'Yes'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isDeletingPhoto}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingFileIndex(null);
                                        }}
                                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingFileIndex(originalIdx);
                                      }}
                                      className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                                      title="Delete Picture"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">No Pictures Found</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                          {pictureCategoryFilter === 'all'
                            ? 'No photos have been uploaded for this job yet.'
                            : `No ${pictureCategoryFilter} photos recorded for this job.`}
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setCameraOverrideCategory(pictureCategoryFilter !== 'all' ? pictureCategoryFilter : uploadCategory);
                              setIsCameraModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-xs transition-all"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Take Photo Now</span>
                          </button>

                          <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-xs transition-all">
                            <Upload className="w-4 h-4" />
                            <span>Upload {pictureCategoryFilter !== 'all' ? pictureCategoryFilter : 'Job'} Photo</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleUploadPictures}
                              className="hidden"
                              disabled={isUploadingPhoto}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SUB-TAB 2: REPRINT JOB CARD DOCUMENT */}
              {modalTab === 'reprint' && (
                <div className="space-y-6 flex flex-col items-center">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Printer className="w-4 h-4 text-emerald-600" />
                        Official Job Card Document Preview &amp; Reprint
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Reprint official Page 1 Workshop Routing Card and Page 2 Machining Log.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenPrint}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                        title="Open print / save PDF window"
                      >
                        <Printer className="w-4 h-4" />
                        Print Document
                      </button>
                    </div>
                  </div>

                  {/* Document Preview Container */}
                  <div className="w-full max-w-2xl flex flex-col items-center gap-8 my-2">
                    {/* Page 1 */}
                    <div className="w-full bg-slate-200/80 p-4 rounded-2xl shadow-inner border border-slate-300 flex flex-col items-center">
                      <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">A4 Portrait Sheet — Page 1 (Workshop Job Card)</div>
                      <div className="w-full max-w-[560px] bg-white shadow-xl border border-slate-300">
                        <JobCardDocument
                          format={format}
                          page="page1"
                          job={selectedJob}
                          overrideFields={{
                            jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber,
                            assignedTechnician: selectedJob.jobCardDetails?.assignedTechnician,
                            orderNumber: selectedJob.jobCardDetails?.orderNumber,
                            yourRef: selectedJob.jobCardDetails?.yourRef,
                            scheduledDate: selectedJob.jobCardDetails?.scheduledDate,
                            dueDate: selectedJob.jobCardDetails?.dueDate,
                            workshopArea: selectedJob.jobCardDetails?.workshopArea,
                            requiredParts: selectedJob.jobCardDetails?.requiredParts,
                            instructions: selectedJob.jobCardDetails?.instructions,
                          }}
                        />
                      </div>
                    </div>

                    {/* Page 2 */}
                    <div className="w-full bg-slate-200/80 p-4 rounded-2xl shadow-inner border border-slate-300 flex flex-col items-center">
                      <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">A4 Landscape Sheet — Page 2</div>
                      <div className="w-full max-w-[760px] bg-white shadow-xl border border-slate-300">
                        <JobCardDocument
                          format={format}
                          page="page2"
                          job={selectedJob}
                          overrideFields={{
                            jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber,
                            assignedTechnician: selectedJob.jobCardDetails?.assignedTechnician,
                            orderNumber: selectedJob.jobCardDetails?.orderNumber,
                            yourRef: selectedJob.jobCardDetails?.yourRef,
                            scheduledDate: selectedJob.jobCardDetails?.scheduledDate,
                            dueDate: selectedJob.jobCardDetails?.dueDate,
                            workshopArea: selectedJob.jobCardDetails?.workshopArea,
                            requiredParts: selectedJob.jobCardDetails?.requiredParts,
                            instructions: selectedJob.jobCardDetails?.instructions,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: EDIT JOB PARAMETERS */}
              {modalTab === 'edit' && (
                <form onSubmit={handleSaveEditedJob} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
                      <Edit2 className="w-4 h-4 text-amber-600" />
                      Edit Job &amp; Routing Parameters
                    </h4>
                    <p className="text-xs text-slate-500">
                      Update component descriptions or workshop routing details directly in Stage 5 Enquiries.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Component Type</label>
                      {componentsList.length > 0 ? (
                        <select
                          value={editComponentType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            setEditComponentType(newType);
                            const matched = componentsList.find(c => c.id === newType || c.name === newType);
                            if (matched && matched.models && matched.models.length > 0) {
                              setEditModelName(matched.models[0]);
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                        >
                          {componentsList.map(comp => (
                            <option key={comp.id} value={comp.id || comp.name}>{comp.name || comp.id}</option>
                          ))}
                          {!componentsList.some(c => c.id === editComponentType || c.name === editComponentType) && editComponentType && (
                            <option value={editComponentType}>{editComponentType}</option>
                          )}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={editComponentType}
                          onChange={(e) => setEditComponentType(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Model Name</label>
                      {(() => {
                        const matched = componentsList.find(c => c.id === editComponentType || c.name === editComponentType);
                        if (matched && matched.models && matched.models.length > 0) {
                          return (
                            <select
                              value={editModelName}
                              onChange={(e) => setEditModelName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                            >
                              {matched.models.map((m, mIdx) => (
                                <option key={`${m}-${mIdx}`} value={m}>{m}</option>
                              ))}
                              {!matched.models.includes(editModelName) && editModelName && (
                                <option value={editModelName}>{editModelName}</option>
                              )}
                            </select>
                          );
                        }
                        return (
                          <input
                            type="text"
                            value={editModelName}
                            onChange={(e) => setEditModelName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                          />
                        );
                      })()}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Part Number</label>
                      <input
                        type="text"
                        value={editSerialNumber}
                        onChange={(e) => setEditSerialNumber(e.target.value)}
                        placeholder="e.g. PN-552A"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Workshop Area</label>
                      <input
                        type="text"
                        value={editWorkshopArea}
                        onChange={(e) => setEditWorkshopArea(e.target.value)}
                        placeholder="e.g. Bay 9B"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Due Date</label>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Order / Account Number</label>
                      <input
                        type="text"
                        value={editOrderNumber}
                        onChange={(e) => setEditOrderNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Your Reference</label>
                      <input
                        type="text"
                        value={editYourRef}
                        onChange={(e) => setEditYourRef(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setModalTab('overview')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isEditSubmitting}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isEditSubmitting ? 'Saving Changes...' : 'Save Job Updates'}
                    </button>
                  </div>
                </form>
              )}

              {/* SUB-TAB 4: QC SIGN-OFF & CLOSURE */}
              {modalTab === 'close' && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Stage 5 Quality Release &amp; Job Closure</h4>
                      <p className="text-xs text-slate-500">Sign off quality inspection pass or return job unrepaired to archive.</p>
                    </div>
                  </div>

                  {selectedJob.status === 'Closed' ? (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-700 space-y-2">
                      <div className="flex items-center gap-2">
                        {selectedJob.closingDetails?.closeReason === 'returned' ? (
                          <span className="bg-amber-100 text-amber-900 text-xs font-extrabold px-3 py-1 rounded-xl flex items-center gap-1.5 border border-amber-300">
                            <RotateCcw className="w-4 h-4 text-amber-600" />
                            Option 2 — Job Returned (Unrepaired)
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-900 text-xs font-extrabold px-3 py-1 rounded-xl flex items-center gap-1.5 border border-emerald-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Option 1 — Job Completed (Passed QC)
                          </span>
                        )}
                      </div>
                      <p className="pt-2 text-slate-600">
                        Closed on <strong className="text-slate-900">{selectedJob.closingDetails?.closedAt || 'N/A'}</strong> by <strong className="text-slate-900">{selectedJob.closingDetails?.closedBy || 'Authorized Operator'}</strong>.
                      </p>
                      {selectedJob.closingDetails?.closingNotes && (
                        <p className="bg-white p-3 rounded-lg border border-slate-200 text-slate-700 font-medium">
                          {selectedJob.closingDetails.closingNotes}
                        </p>
                      )}
                      <p className="font-serif italic font-bold text-slate-800">Authorized Signature: ✓ {selectedJob.closingDetails?.qualityReleaseSign}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleCloseJobSubmit} className="space-y-5">
                      {/* 2 Closure Options Selector */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Select Job Closure Option *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Option 1: Job Completed */}
                          <div
                            onClick={() => setCloseReasonOption('completed')}
                            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                              closeReasonOption === 'completed'
                                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`p-2 rounded-xl ${closeReasonOption === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <CheckCircle2 className="w-5 h-5" />
                              </span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${closeReasonOption === 'completed' ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-100 text-slate-500'}`}>
                                Option 1
                              </span>
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-900">Job Completed</h5>
                              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                Work finished &amp; QC passed. Requires <strong>2 inspection photos</strong> (Pre &amp; Final Inspection).
                              </p>
                            </div>
                          </div>

                          {/* Option 2: Job Returned */}
                          <div
                            onClick={() => setCloseReasonOption('returned')}
                            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                              closeReasonOption === 'returned'
                                ? 'border-amber-600 bg-amber-50/50 shadow-xs ring-1 ring-amber-600'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`p-2 rounded-xl ${closeReasonOption === 'returned' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <RotateCcw className="w-5 h-5" />
                              </span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${closeReasonOption === 'returned' ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-500'}`}>
                                Option 2
                              </span>
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-900">Job Returned</h5>
                              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                Returned unrepaired or unserviceable. No additional photo validation required.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Option 1 Photo Validation Callout */}
                      {closeReasonOption === 'completed' && (() => {
                        const currentInspectionPhotosCount = (selectedJob.files || [])
                          .filter(isPictureFile)
                          .filter(f => getPhotoCategory(f) === 'inspection')
                          .length;

                        const isMet = currentInspectionPhotosCount >= 2;

                        return isMet ? (
                          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900">
                            <div className="flex items-center gap-2.5">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                              <div>
                                <p className="font-bold">Inspection Photo Requirement Met ({currentInspectionPhotosCount} photos attached)</p>
                                <p className="text-[11px] text-emerald-700">Pre-inspection &amp; Final inspection photos confirmed.</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPictureCategoryFilter('inspection');
                                setModalTab('pictures');
                              }}
                              className="bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer shrink-0"
                            >
                              View Photos
                            </button>
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-3">
                            <div className="flex items-start gap-2.5">
                              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <h5 className="text-xs font-bold text-amber-950">Pre &amp; Final Inspection Photos Required</h5>
                                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                                  Option 1 (Job Completed) can only be closed when there are at least <strong>2 photos</strong> in the Inspection Photos section (Pre-Inspection &amp; Final Inspection).
                                  Currently attached: <strong className="text-amber-950">{currentInspectionPhotosCount} of 2</strong>.
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                              <button
                                type="button"
                                onClick={() => {
                                  setCameraOverrideCategory('inspection');
                                  setIsCameraModalOpen(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Take Inspection Photo</span>
                              </button>

                              <label className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs">
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload File</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handleDirectInspectionPhotoUpload}
                                  className="hidden"
                                  disabled={isUploadingPhoto}
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() => {
                                  setPictureCategoryFilter('inspection');
                                  setModalTab('pictures');
                                }}
                                className="bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                              >
                                Go to Job Pictures Gallery
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Closed By *</label>
                          <input
                            type="text"
                            required
                            value={closedBy}
                            onChange={(e) => setClosedBy(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date Completed *</label>
                          <input
                            type="date"
                            required
                            value={closedAt}
                            onChange={(e) => setClosedAt(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-indigo-500" />
                          Authorized Quality Release Sign-off *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Enter full name for signature validation (e.g. Quality Mgr S. Sarah)"
                          value={qualityReleaseSign}
                          onChange={(e) => setQualityReleaseSign(e.target.value)}
                          className="w-full bg-white border-2 border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Closing Release Notes / Work Summary</label>
                        <textarea
                          rows={3}
                          required
                          placeholder={
                            closeReasonOption === 'completed'
                              ? "Provide final summary of steps completed, micron checks, and packaging release notes..."
                              : "Provide reason for returning job unrepaired..."
                          }
                          value={closingNotes}
                          onChange={(e) => setClosingNotes(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium focus:outline-hidden focus:border-indigo-500 text-slate-700"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        {currentUser?.permissions.canClose || currentUser?.permissions.isAdmin ? (() => {
                          const currentInspectionPhotosCount = (selectedJob.files || [])
                            .filter(isPictureFile)
                            .filter(f => getPhotoCategory(f) === 'inspection')
                            .length;

                          const isBlocked = closeReasonOption === 'completed' && currentInspectionPhotosCount < 2;

                          return (
                            <button
                              type="submit"
                              disabled={isClosingSubmitting || isBlocked}
                              className={`inline-flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer disabled:opacity-55 ${
                                closeReasonOption === 'completed'
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-amber-600 hover:bg-amber-700 text-white'
                              }`}
                            >
                              {isClosingSubmitting
                                ? 'Archiving Job...'
                                : isBlocked
                                ? 'Requires 2 Inspection Photos to Complete'
                                : closeReasonOption === 'completed'
                                ? 'Complete Job & Authorize QC Pass'
                                : 'Close Job as Returned Unrepaired'}
                              <Lock className="w-3.5 h-3.5 opacity-80" />
                            </button>
                          );
                        })() : (
                          <div className="flex items-center gap-1.5 text-red-500 bg-red-50 border border-red-100 px-3.5 py-2 rounded-xl text-xs font-bold">
                            <Lock className="w-4 h-4" />
                            <span>Your account lacks Stage 5 closing clearance permissions</span>
                          </div>
                        )}
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* SUB-TAB 5: ADD TO GO-AHEAD / CUSTOMER ORDER CAPTURE */}
              {modalTab === 'goAhead' && (
                <form onSubmit={handleSaveGoAhead} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                  <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                    <div className="bg-emerald-600 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                        Record Customer Order &amp; Confirm Go-Ahead
                      </h4>
                      <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                        Entering the customer&apos;s purchase order number or official order reference will record authorization and transition this job into active <strong>Go-Ahead</strong> status.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                        Customer Order Number / PO Number *
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. PO-99820, LPO-4512, ORDER-2026-A"
                        value={goAheadOrderNumber}
                        onChange={(e) => setGoAheadOrderNumber(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-emerald-300 focus:border-emerald-600 rounded-xl px-4 py-3 text-sm font-bold font-mono text-slate-900 focus:outline-hidden"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        This order number will be attached to Job Card #{selectedJob.jobCardDetails?.jobCardNumber || selectedJob.id} and printed on official documentation.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          Customer Reference / Your Ref
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Attn: John Smith / Dept 4"
                          value={goAheadYourRef}
                          onChange={(e) => setGoAheadYourRef(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          Target Completion Due Date
                        </label>
                        <input
                          type="date"
                          value={goAheadDueDate}
                          onChange={(e) => setGoAheadDueDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setModalTab('overview')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isGoAheadSubmitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isGoAheadSubmitting ? 'Saving Order #' : 'Confirm Go-Ahead & Save Order #'}
                    </button>
                  </div>
                </form>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-100 flex justify-between items-center flex-shrink-0">
              <div>
                {selectedJob.status !== 'Closed' && (
                  <button
                    type="button"
                    onClick={() => setModalTab('goAhead')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      modalTab === 'goAhead'
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/50'
                        : !hasGoAhead(selectedJob)
                        ? 'bg-amber-500 hover:bg-amber-600 text-white font-extrabold shadow-sm'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {!hasGoAhead(selectedJob) ? 'Add to Go-Ahead' : 'Go-Ahead Order Info'}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Enquiry View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print container containing BOTH pages for physical browser print */}
      {selectedJob && (
        <div id="printable-jobcard-doc" className="hidden print:block">
          <div className="print-page flex flex-col font-sans text-black bg-white">
            <JobCardDocument
              format={format}
              page="page1"
              job={selectedJob}
              isPrint={true}
              overrideFields={{
                jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber,
                assignedTechnician: selectedJob.jobCardDetails?.assignedTechnician,
                orderNumber: selectedJob.jobCardDetails?.orderNumber,
                yourRef: selectedJob.jobCardDetails?.yourRef,
                scheduledDate: selectedJob.jobCardDetails?.scheduledDate,
                dueDate: selectedJob.jobCardDetails?.dueDate,
                workshopArea: selectedJob.jobCardDetails?.workshopArea,
                requiredParts: selectedJob.jobCardDetails?.requiredParts,
                instructions: selectedJob.jobCardDetails?.instructions,
              }}
            />
          </div>
          <div className="print-page-landscape flex flex-col font-sans text-black bg-white">
            <JobCardDocument
              format={format}
              page="page2"
              job={selectedJob}
              isPrint={true}
              overrideFields={{
                jobCardNumber: selectedJob.jobCardDetails?.jobCardNumber,
                assignedTechnician: selectedJob.jobCardDetails?.assignedTechnician,
                orderNumber: selectedJob.jobCardDetails?.orderNumber,
                yourRef: selectedJob.jobCardDetails?.yourRef,
                scheduledDate: selectedJob.jobCardDetails?.scheduledDate,
                dueDate: selectedJob.jobCardDetails?.dueDate,
                workshopArea: selectedJob.jobCardDetails?.workshopArea,
                requiredParts: selectedJob.jobCardDetails?.requiredParts,
                instructions: selectedJob.jobCardDetails?.instructions,
              }}
            />
          </div>
        </div>
      )}
      {/* Photo Lightbox Preview Modal */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightboxPhoto(null)}>
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                  {lightboxPhoto.name}
                </h4>
                {lightboxPhoto.uploadedAt && (
                  <p className="text-[10px] text-slate-400">
                    Uploaded: {new Date(lightboxPhoto.uploadedAt).toLocaleString()} • Category: {lightboxPhoto.category || 'General'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxPhoto.url}
                  download={lightboxPhoto.name}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                {typeof lightboxPhoto.originalIdx === 'number' && (
                  <button
                    type="button"
                    disabled={isDeletingPhoto}
                    onClick={() => {
                      if (typeof lightboxPhoto.originalIdx === 'number') {
                        handleDeletePicture(lightboxPhoto.originalIdx);
                      }
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {isDeletingPhoto ? 'Deleting...' : 'Delete'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/50">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.name}
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        title="Take Job Photo"
        categoryName={cameraOverrideCategory || uploadCategory}
        onPhotosCaptured={(files) => {
          processPhotoFiles(files, cameraOverrideCategory);
        }}
      />

      {/* Delete Single Job Modal */}
      {jobToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 text-left">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-extrabold text-slate-900">Delete Captured Component</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete captured component <strong className="text-slate-900">{jobToDelete.id}</strong> ({jobToDelete.componentType} - {jobToDelete.modelName})? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setJobToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = jobToDelete.id;
                  setJobToDelete(null);
                  if (onDeleteJob) {
                    await onDeleteJob(targetId);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Jobs Modal */}
      {showConfirmDeleteAllModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 text-left">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-extrabold text-slate-900">Delete All Captured Components ({jobs.length})</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete <strong>ALL {jobs.length} captured component entries</strong>? This will purge all jobs, receiving details, and inspection reports and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteAllModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmDeleteAllModal(false);
                  if (onDeleteAllJobs) {
                    await onDeleteAllJobs();
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Delete All Captured Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
