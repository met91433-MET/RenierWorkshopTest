import React, { useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  Mail, 
  FileText, 
  Send, 
  Copy, 
  Check, 
  ExternalLink,
  Download,
  Calculator,
  Building2,
  Calendar,
  User,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { Job, getPreQuoteId } from '../types';

export interface PreQuoteGroup {
  preQuoteId: string;
  jobs: Job[];
  customerName: string;
  deliveryNotes: string[];
  totalCost: number;
  quotedBy: string;
  quotedAt: string;
  hasJobCard: boolean;
  jobCardNumbers: string[];
}

interface PreQuoteDocumentModalProps {
  group: PreQuoteGroup;
  initialMode?: 'view' | 'print' | 'email';
  onClose: () => void;
}

export default function PreQuoteDocumentModal({
  group,
  initialMode = 'view',
  onClose
}: PreQuoteDocumentModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'view' | 'print' | 'email'>(initialMode);
  const [copied, setCopied] = useState(false);
  const [emailSentNotice, setEmailSentNotice] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);

  // Helper currency formatter
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  const deliveryNotesText = group.deliveryNotes.length > 0 
    ? group.deliveryNotes.join(', ') 
    : 'N/A';

  // Email template content for Outlook
  const emailSubject = `PreQuote ${group.preQuoteId} - Official Quotation from Metalogik Engineering`;
  const emailBody = `Dear ${group.customerName},\n\nPlease find the details for your official repair estimation below:\n\n` +
    `========================================\n` +
    `PREQUOTE ID: ${group.preQuoteId}\n` +
    `CUSTOMER: ${group.customerName}\n` +
    `DELIVERY NOTE(S): ${deliveryNotesText}\n` +
    `QUOTATION DATE: ${group.quotedAt || new Date().toISOString().split('T')[0]}\n` +
    `ESTIMATOR: ${group.quotedBy}\n` +
    `========================================\n\n` +
    `COMPONENT BREAKDOWN:\n` +
    group.jobs.map((job, idx) => {
      const steps = job.preQuoteDetails?.steps || [];
      const stepsText = steps.length > 0 
        ? steps.map(s => `    - ${s.stepName}: ${formatCurrency(s.price)}`).join('\n')
        : '    - Standard repair steps pending';
      const jobCost = job.preQuoteDetails?.totalCost || 0;
      return `${idx + 1}. ${job.componentType} (${job.modelName || 'Standard'}) [Job #${job.id}, S/N: ${job.serialNumber || 'N/A'}]\n` +
             `   Delivery Note: ${job.deliveryNoteNumber || 'N/A'}\n` +
             `${stepsText}\n` +
             `   Component Subtotal: ${formatCurrency(jobCost)}\n`;
    }).join('\n') +
    `\n----------------------------------------\n` +
    `GRAND TOTAL: ${formatCurrency(group.totalCost)}\n` +
    `----------------------------------------\n\n` +
    `Terms & Conditions:\n` +
    `- Quotation is valid for 30 days from issue date.\n` +
    `- Work will commence upon receipt of approved Purchase Order.\n\n` +
    `Kind regards,\n` +
    `${group.quotedBy || 'Estimations Dept'}\n` +
    `Metalogik Engineering Workshops`;

  const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  const webOutlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipientEmail)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyEmailText = () => {
    navigator.clipboard.writeText(emailBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadEmlFile = () => {
    // Generate native Microsoft Outlook .eml draft file
    const emlLines = [
      `To: ${recipientEmail || ''}`,
      `Subject: ${emailSubject}`,
      `X-Unsent: 1`,
      `Content-Type: text/plain; charset="utf-8"`,
      ``,
      emailBody
    ];
    const emlContent = emlLines.join('\r\n');
    const blob = new Blob([emlContent], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PreQuote_${group.preQuoteId}.eml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setEmailSentNotice(true);
    setTimeout(() => setEmailSentNotice(false), 6000);
  };

  const handleOpenOutlookDevice = () => {
    // Copy full body text to clipboard as safety backup
    navigator.clipboard.writeText(emailBody);

    // Keep mailto body concise so OS protocol handlers do not reject or truncate long URLs
    const shortSummary = `Dear ${group.customerName},\n\nPlease find attached the official quotation details for PreQuote ${group.preQuoteId}.\n\nTotal Quoted Amount: ${formatCurrency(group.totalCost)}\n\n(Full quotation text has been copied to your clipboard — press Ctrl+V to paste if needed).\n\nKind regards,\nMetalogik Engineering`;
    
    const safeMailto = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(shortSummary)}`;
    
    // Trigger via invisible link element with target="_blank" to bypass iframe navigation restrictions
    const a = document.createElement('a');
    a.href = safeMailto;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setEmailSentNotice(true);
    setTimeout(() => setEmailSentNotice(false), 6000);
  };

  const handleOpenOutlookWeb = () => {
    window.open(webOutlookUrl, '_blank');
    setEmailSentNotice(true);
    setTimeout(() => setEmailSentNotice(false), 5000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fade-in overflow-y-auto">
      {/* Container card */}
      <div className="bg-slate-100 rounded-3xl border border-slate-300 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-left my-auto">
        
        {/* Modal Header & Navigation Bar */}
        <div className="bg-slate-900 text-white p-4 sm:px-6 sm:py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center font-black">
              <Calculator className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black font-mono text-purple-300 tracking-wide">
                  {group.preQuoteId}
                </span>
                <span className="text-xs bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/30 font-semibold">
                  Official Quotation
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {group.customerName} • DN: {deliveryNotesText}
              </p>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('view')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'view'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Document</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('print');
                setTimeout(() => window.print(), 300);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'print'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print PreQuote</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'email'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email Outlook</span>
            </button>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email Outlook Sidebar Panel when Email tab is active */}
        {activeTab === 'email' && (
          <div className="bg-purple-900/95 text-white p-4 border-b border-purple-700/60 flex flex-col gap-3 shrink-0 print:hidden animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Send Quotation via Microsoft Outlook</span>
                    <span className="text-[10px] bg-purple-700 text-purple-200 px-2 py-0.5 rounded-md font-mono">Device Outlook</span>
                  </h4>
                  <p className="text-[11px] text-purple-200 mt-0.5">
                    Choose <strong>Outlook Draft (.eml)</strong> to open directly in desktop Microsoft Outlook, or click <strong>Launch Outlook App</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopyEmailText}
                  className="flex-1 sm:flex-none px-3 py-2 bg-purple-800 hover:bg-purple-700 text-purple-100 text-xs font-bold rounded-xl border border-purple-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Copy full quote text to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenOutlookWeb}
                  className="flex-1 sm:flex-none px-3 py-2 bg-purple-800/80 hover:bg-purple-700 text-white text-xs font-bold rounded-xl border border-purple-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Open in Outlook Web Browser"
                >
                  <span>Outlook Web</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenOutlookDevice}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold rounded-xl border border-purple-500 shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Trigger device default mail app"
                >
                  <Send className="w-3.5 h-3.5 text-purple-200" />
                  <span>Launch Outlook App</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadEmlFile}
                  className="flex-1 sm:flex-none px-4 py-2 bg-white text-purple-950 hover:bg-purple-50 text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white"
                  title="Download .eml file that opens directly in Microsoft Outlook desktop"
                >
                  <Download className="w-3.5 h-3.5 text-purple-700" />
                  <span>Outlook Draft File (.eml)</span>
                </button>
              </div>
            </div>

            {/* Recipient Email Address Input */}
            <div className="pt-2 border-t border-purple-800/80 flex flex-col sm:flex-row items-center gap-2">
              <label className="text-xs text-purple-200 font-medium shrink-0 flex items-center gap-1.5">
                <span>To (Customer Email):</span>
              </label>
              <input
                type="email"
                placeholder={`Enter recipient email for ${group.customerName}...`}
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full bg-purple-950/80 border border-purple-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-purple-400 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>
        )}

        {emailSentNotice && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 animate-fade-in print:hidden">
            <CheckCircle2 className="w-4 h-4" />
            <span>Microsoft Outlook draft prepared! Opening in desktop Outlook application.</span>
          </div>
        )}

        {/* DOCUMENT PREVIEW CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/70">
          
          {/* Pure Printable Paper Document */}
          <div 
            ref={documentRef}
            className="bg-white rounded-xl border border-slate-300 shadow-xl max-w-3xl mx-auto p-6 sm:p-10 text-slate-800 font-sans print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none"
          >
            {/* DOCUMENT HEADER */}
            <div className="border-b-2 border-slate-900 pb-6 mb-6">
              <div className="flex items-start justify-between gap-4">
                {/* Company Logo & Branding */}
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl tracking-tighter">
                      M
                    </div>
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-slate-900 font-display">
                        METALOGIK ENGINEERING
                      </h1>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                        Precision Component Reconditioning & Machining
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">
                    12 Industrial Park Way, Engineering Zone • Tel: +27 11 982 0000 • quote@metalogik.co.za
                  </p>
                </div>

                {/* PreQuote Main Identifier Stamp */}
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-50 px-3 py-1 rounded-md border border-purple-200 tracking-wider">
                    Official Quotation
                  </span>
                  <h2 className="text-2xl font-black text-purple-900 font-mono tracking-tight mt-1">
                    {group.preQuoteId}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Date: <span className="font-bold text-slate-800">{group.quotedAt || new Date().toISOString().split('T')[0]}</span>
                  </p>
                </div>
              </div>

              {/* Customer & Delivery Information Block */}
              <div className="grid grid-cols-2 gap-4 mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Details</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">{group.customerName}</p>
                  <p className="text-slate-600 mt-0.5 font-medium">
                    Delivery Note Ref: <strong className="text-slate-900 font-mono">{deliveryNotesText}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimator & Status</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">Prepared By: {group.quotedBy}</p>
                  <p className="text-xs font-bold text-purple-800 mt-0.5">
                    Status: {group.hasJobCard ? 'Job Card Issued' : 'PreQuote Estimation Complete'}
                  </p>
                </div>
              </div>
            </div>

            {/* DOCUMENT COMPONENT LINES & STEPS BREAKDOWN */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Quoted Components & Standard Repair Operations
                </h3>
                <span className="text-xs text-slate-400 font-medium">
                  {group.jobs.length} Component{group.jobs.length > 1 ? 's' : ''} Included
                </span>
              </div>

              {group.jobs.map((job, jobIdx) => {
                const steps = job.preQuoteDetails?.steps || [];
                const jobCost = job.preQuoteDetails?.totalCost || 0;

                return (
                  <div key={job.id || jobIdx} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {/* Component Header Bar: Name/Model & Unique ID on the left */}
                    <div className="bg-slate-100 p-3 px-4 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-900 font-display">
                            {jobIdx + 1}. {job.componentType} {job.modelName ? `(${job.modelName})` : ''}
                          </span>
                          <span className="text-[10px] font-mono bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-bold">
                            Job ID: {job.id}
                          </span>
                          {job.serialNumber && (
                            <span className="text-[10px] font-mono bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md font-bold">
                              S/N: {job.serialNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Delivery Note #: <strong className="text-slate-700 font-mono">{job.deliveryNoteNumber || 'N/A'}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Component Subtotal</span>
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {formatCurrency(jobCost)}
                        </span>
                      </div>
                    </div>

                    {/* Under it: Steps linked to this job on the left, step prices on the right */}
                    <div className="p-4">
                      {steps.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No specific repair steps recorded for this component.</p>
                      ) : (
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="text-[10px] uppercase text-slate-400 font-bold border-b border-slate-100">
                              <th className="pb-2 w-12 text-center">Step</th>
                              <th className="pb-2">Operation / Repair Description</th>
                              <th className="pb-2 text-right pr-2">Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {steps.map((step, stepIdx) => (
                              <tr key={stepIdx} className="hover:bg-slate-50">
                                <td className="py-2 text-center font-mono text-slate-400 text-[11px]">
                                  {stepIdx + 1}
                                </td>
                                <td className="py-2 font-medium text-slate-800">
                                  {step.stepName}
                                  {step.isCustom && (
                                    <span className="ml-2 text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded-xs font-semibold">
                                      Custom Line
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 text-right pr-2 font-bold font-mono text-slate-900">
                                  {formatCurrency(step.price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* GRAND TOTAL SUMMARY BLOCK */}
            <div className="mt-8 border-t-2 border-slate-900 pt-6 flex flex-col sm:flex-row items-start justify-between gap-6">
              {/* Terms & Conditions Notes */}
              <div className="text-xs text-slate-500 max-w-sm space-y-1">
                <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Terms of Quotation</p>
                <p className="text-[11px]">1. Quotation is valid for 30 days from date of issue.</p>
                <p className="text-[11px]">2. Standard turnaround times apply upon Purchase Order receipt.</p>
                <p className="text-[11px]">3. All reconditioned components carry 6-month workshop warranty.</p>
              </div>

              {/* Totals */}
              <div className="w-full sm:w-72 bg-slate-900 text-white p-5 rounded-2xl shadow-md text-right space-y-2">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Components Total ({group.jobs.length}):</span>
                  <span>{formatCurrency(group.totalCost)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>VAT / Tax (0% Excl):</span>
                  <span>R 0.00</span>
                </div>
                <div className="border-t border-slate-700 pt-2.5 flex justify-between items-center">
                  <span className="text-xs font-extrabold uppercase text-purple-300">Grand Total</span>
                  <span className="text-xl font-black font-mono text-white">
                    {formatCurrency(group.totalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Signature Block */}
            <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-500">
              <div>
                <p className="font-bold text-slate-800">Authorized Estimator Signature:</p>
                <div className="h-10 border-b border-slate-300 mt-2"></div>
                <p className="text-[10px] mt-1">{group.quotedBy || 'Metalogik Representative'}</p>
              </div>
              <div>
                <p className="font-bold text-slate-800">Customer Authorization / PO #:</p>
                <div className="h-10 border-b border-slate-300 mt-2"></div>
                <p className="text-[10px] mt-1">Sign & Return to Approve Quotation</p>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-900 p-4 px-6 border-t border-slate-800 flex items-center justify-between shrink-0 print:hidden">
          <p className="text-xs text-slate-400">
            PreQuote Identifier: <strong className="text-purple-300 font-mono">{group.preQuoteId}</strong>
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleOpenOutlookDevice}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Mail className="w-4 h-4" />
              <span>Email Outlook</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
