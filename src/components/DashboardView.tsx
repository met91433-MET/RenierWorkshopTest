import { useState } from 'react';
import { Job, UserProfile } from '../types';
import { 
  Clipboard, 
  Search, 
  Filter, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Layers, 
  User, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardViewProps {
  jobs: Job[];
  currentUser: UserProfile | null;
  onSelectJob: (job: Job, targetTab: string) => void;
}

export default function DashboardView({ 
  jobs, 
  currentUser, 
  onSelectJob,
}: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Filter jobs to only show active ones on the dashboard
  const filteredByActive = jobs.filter(job => job.status !== 'Closed');

  // Filter by search and status dropdown
  const displayedJobs = filteredByActive.filter(job => {
    const matchesSearch = 
      job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.componentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Count metrics
  const activeJobsCount = jobs.filter(j => j.status !== 'Closed').length;
  const closedJobsCount = jobs.filter(j => j.status === 'Closed').length;
  const receivingCount = jobs.filter(j => j.status === 'Received').length;
  const qcCount = jobs.filter(j => j.status === 'Inspected').length;
  const quoteCount = jobs.filter(j => j.status === 'PreQuoted').length;
  const cardCount = jobs.filter(j => j.status === 'JobCardCreated').length;

  const stages = [
    { name: 'Received', label: 'Job Receiving', count: receivingCount, color: 'bg-blue-50 text-blue-700 border-blue-200', tab: 'receiving' },
    { name: 'Inspected', label: 'Inspection / QC', count: qcCount, color: 'bg-amber-50 text-amber-700 border-amber-200', tab: 'inspection' },
    { name: 'PreQuoted', label: 'Pre-Quote', count: quoteCount, color: 'bg-purple-50 text-purple-700 border-purple-200', tab: 'quoting' },
    { name: 'JobCardCreated', label: 'Job Card Created', count: cardCount, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', tab: 'jobcard' },
  ];

  return (
    <div className="space-y-6" id="dashboard-view-root">
      {/* Welcome Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-display text-slate-800">
            Welcome back, {currentUser?.displayName || currentUser?.email || 'Workshop Operator'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            MES Workshop3 — Real-time tracking of components, repairs, pricing, and job status.
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Jobs</p>
          <p className="text-3xl font-extrabold text-slate-800 mt-2 font-display">{activeJobsCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500 hover:border-slate-300 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receiving</p>
          <p className="text-3xl font-extrabold text-blue-600 mt-2 font-display">{receivingCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500 hover:border-slate-300 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality Check</p>
          <p className="text-3xl font-extrabold text-amber-600 mt-2 font-display">{qcCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-purple-500 hover:border-slate-300 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pre Quote</p>
          <p className="text-3xl font-extrabold text-purple-600 mt-2 font-display">{quoteCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 hover:border-slate-300 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Job Cards</p>
          <p className="text-3xl font-extrabold text-emerald-600 mt-2 font-display">{cardCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-slate-400 hover:border-slate-300 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Closed Jobs</p>
          <p className="text-3xl font-extrabold text-slate-600 mt-2 font-display">{closedJobsCount}</p>
        </div>
      </div>

      {/* Visual Workflow Steps */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-bold tracking-tight text-slate-800 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          Repair Process Flow Breakdown
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stages.map((stage, idx) => (
            <div 
              key={stage.name} 
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-200 ${stage.color} relative overflow-hidden shadow-sm`}
            >
              <div>
                <span className="text-xs font-bold text-slate-400/80 absolute right-3 top-2 text-2xl font-display">{idx + 1}</span>
                <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-75">{stage.name === 'PreQuoted' ? 'Quoted' : stage.name}</p>
                <h3 className="text-base font-bold tracking-tight mt-1 text-slate-800">{stage.label}</h3>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xl font-black text-slate-900 font-display">{stage.count} <span className="text-xs font-normal text-slate-500">jobs</span></span>
                <span className="text-xs font-semibold text-slate-500 bg-white/70 px-2 py-1 rounded-md border border-slate-200">Stage {idx + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Jobs Grid & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <h2 className="text-base font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Clipboard className="w-4.5 h-4.5 text-slate-500" />
            Active Workshop Jobs
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
              {displayedJobs.length} {displayedJobs.length === 1 ? 'Job' : 'Jobs'}
            </span>
          </h2>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search serial, DN, model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-full sm:w-60 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-hidden focus:border-blue-500"
              >
                <option value="All">All Stages</option>
                <option value="Received">Job Receiving</option>
                <option value="Inspected">QC / Inspection</option>
                <option value="PreQuoted">Pre-Quoted</option>
                <option value="JobCardCreated">Job Card Created</option>
              </select>
            </div>
          </div>
        </div>

        {/* Jobs List / Table */}
        {displayedJobs.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">No jobs found</h3>
            <p className="text-xs text-slate-400 mt-1">
              There are no active jobs matching your filter parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
                  <th className="p-4 pl-6">Job ID / Serial</th>
                  <th className="p-4">Delivery Sheet / DN</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Component & Model</th>
                  <th className="p-4">Status / Stage</th>
                  <th className="p-4">Date Recv</th>
                  <th className="p-4 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedJobs.map((job) => {
                  let statusBadge = '';
                  let statusText = '';
                  let nextActionTab = 'receiving';
                  let actionLabel = 'Open Job';

                  switch(job.status) {
                    case 'Received':
                      statusBadge = 'bg-blue-50 text-blue-700 border-blue-200';
                      statusText = 'Received';
                      nextActionTab = 'inspection';
                      actionLabel = 'Inspect Job';
                      break;
                    case 'Inspected':
                      statusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                      statusText = 'QC Done';
                      nextActionTab = 'quoting';
                      actionLabel = 'Add Quote';
                      break;
                    case 'PreQuoted':
                      statusBadge = 'bg-purple-50 text-purple-700 border-purple-200';
                      statusText = 'Quoted';
                      nextActionTab = 'jobcard';
                      actionLabel = 'Create Card';
                      break;
                    case 'JobCardCreated':
                      statusBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      statusText = 'In Service';
                      nextActionTab = 'closing';
                      actionLabel = 'Close Job';
                      break;
                    case 'Closed':
                      statusBadge = 'bg-slate-100 text-slate-600 border-slate-200';
                      statusText = 'Closed';
                      nextActionTab = 'dashboard';
                      actionLabel = 'View details';
                      break;
                  }

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Job ID / Serial */}
                      <td className="p-4 pl-6">
                        <div className="font-semibold text-slate-800 text-sm font-display">{job.id}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{job.serialNumber || 'No Serial'}</div>
                      </td>

                      {/* DN */}
                      <td className="p-4 text-sm font-medium text-slate-600">
                        {job.deliveryNoteNumber}
                      </td>

                      {/* Customer */}
                      <td className="p-4 text-sm">
                        <div className="font-medium text-slate-700">{job.customerName}</div>
                      </td>

                      {/* Component */}
                      <td className="p-4 text-sm">
                        <span className="font-medium text-slate-800">{job.componentType}</span>
                        <span className="text-slate-400 mx-1.5">•</span>
                        <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 text-xs">{job.modelName}</span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${statusBadge}`}>
                          {statusText}
                        </span>
                      </td>

                      {/* Date Recv */}
                      <td className="p-4 text-xs font-mono text-slate-500">
                        {job.dateReceived}
                      </td>

                      {/* Action */}
                      <td className="p-4 text-right pr-6">
                        <button
                          onClick={() => onSelectJob(job, nextActionTab)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
                        >
                          {actionLabel}
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
