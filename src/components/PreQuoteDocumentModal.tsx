import React, { useRef } from 'react';
import { 
  X, 
  Printer, 
  Calculator
} from 'lucide-react';
import { Job } from '../types';
import { openInNewWindow, triggerNativePrint } from '../utils/printDoc';

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
  onClose
}: PreQuoteDocumentModalProps) {
  const documentRef = useRef<HTMLDivElement>(null);

  // Helper currency formatter
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  const deliveryNotesText = group.deliveryNotes.length > 0 
    ? group.deliveryNotes.join(', ') 
    : 'N/A';

  const handlePrint = () => {
    const success = openInNewWindow({
      elementId: 'printable-prequote-doc',
      documentTitle: `PreQuote Document ${group.preQuoteId}`
    });
    if (!success) {
      triggerNativePrint('printable-prequote-doc');
    }
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

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DOCUMENT PREVIEW CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/70">
          
          {/* Pure Printable Paper Document */}
          <div 
            id="printable-prequote-doc"
            ref={documentRef}
            className="bg-white rounded-xl border border-slate-900 shadow-xl max-w-3xl mx-auto p-4 sm:p-6 text-slate-900 font-sans print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none text-left"
          >
            {/* TOP HEADER TABLE */}
            <table className="w-full border-collapse border border-slate-900 text-xs font-sans">
              <tbody>
                <tr>
                  {/* Top Left: Logo */}
                  <td className="p-2 border border-slate-900 w-1/3 align-middle bg-white">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-emerald-700 text-amber-300 font-black flex items-center justify-center rounded-lg text-lg border border-slate-800 shrink-0">
                        M
                      </div>
                      <div>
                        <div className="text-[9px] font-black tracking-widest text-slate-500 uppercase">SABS ISO 9001</div>
                        <div className="text-xs font-black tracking-tight text-slate-900 uppercase">METALOGIK</div>
                        <div className="text-[8px] font-bold text-slate-600">ENGINEERING SERVICES (Pty) Ltd</div>
                        <div className="text-[7px] font-semibold text-emerald-700 uppercase tracking-widest">ADVANCED LOGIC</div>
                      </div>
                    </div>
                  </td>

                  {/* Top Right: Document Title & Metadata Table */}
                  <td className="p-0 border border-slate-900 w-2/3 align-top">
                    <div className="text-center font-bold text-xs py-1 border-b border-slate-900 bg-slate-100 text-slate-900">
                      Metalogik Engineering Services (PTY) Ltd
                    </div>
                    <table className="w-full text-[10px] border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-300">
                          <td className="p-1 font-bold bg-slate-50 w-28 border-r border-slate-300">Document Name:</td>
                          <td className="p-1 font-bold border-r border-slate-300">PRE QUOTE SHEET</td>
                          <td className="p-1 font-bold bg-slate-50 w-24 border-r border-slate-300">Document No:</td>
                          <td className="p-1 font-semibold">MET-FCR-PQS-01</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                          <td className="p-1 font-bold bg-slate-50 border-r border-slate-300">Organisational Area:</td>
                          <td className="p-1 border-r border-slate-300">SHEQ</td>
                          <td className="p-1 font-bold bg-slate-50 border-r border-slate-300">Effective Date:</td>
                          <td className="p-1">2022/07/01</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                          <td className="p-1 font-bold bg-slate-50 border-r border-slate-300">Document Type:</td>
                          <td className="p-1 border-r border-slate-300">Forms/Checklists/Registers</td>
                          <td className="p-1 font-bold bg-slate-50 border-r border-slate-300">Revision:</td>
                          <td className="p-1">Rev.1</td>
                        </tr>
                        <tr>
                          <td className="p-1 font-bold bg-slate-50 border-r border-slate-300">Document Owner:</td>
                          <td className="p-1 border-r border-slate-300">K. Govender</td>
                          <td className="p-1 font-bold bg-slate-50 border-r border-slate-300">Page:</td>
                          <td className="p-1">See Bottom of Page</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="text-[9px] text-slate-500 italic py-0.5 text-left">
              All printed copies are not controlled. For controlled version refer to electronic version
            </div>

            {/* YELLOW HEADING BANNER */}
            <div className="bg-amber-400 border border-slate-900 text-center py-1 my-1">
              <h2 className="text-xl font-black tracking-widest text-slate-900 uppercase">
                QUOTE SHEET
              </h2>
            </div>

            {/* DATE & REF ROW */}
            {(() => {
              const rawDate = group.quotedAt || new Date().toISOString().split('T')[0];
              const dateParts = rawDate.split('-');
              let formattedDateDigits = rawDate;
              if (dateParts.length === 3) {
                const [yyyy, mm, dd] = dateParts;
                formattedDateDigits = `${dd.padStart(2, '0')} - ${mm.padStart(2, '0')} - ${yyyy}`;
              }

              const customerBranch = group.jobs.find(j => j.customerBranch)?.customerBranch || 'N/A';
              const customerOrderNo = group.jobs.map(j => j.customerOrderNo || j.purchaseOrderNumber || j.jobCardDetails?.orderNumber).filter(Boolean).join(', ') || 'N/A';
              const modelsText = group.jobs.map(j => j.modelName).filter(Boolean).join(', ') || 'N/A';
              const partNosText = group.jobs.map(j => j.partNumber || j.serialNumber).filter(Boolean).join(', ') || 'N/A';
              const customerJobNosText = group.jobs.map(j => j.customerJobNo || j.jobCardDetails?.customerJobNumber || j.id).filter(Boolean).join(', ');
              const partDescriptionsText = group.jobs.map(j => j.partDescription || j.componentType).filter(Boolean).join(', ') || 'N/A';

              return (
                <>
                  <div className="grid grid-cols-2 border border-slate-900 bg-slate-100 text-xs font-bold text-slate-900 mb-2">
                    <div className="p-1.5 border-r border-slate-900 flex items-center gap-2">
                      <span>Date:</span>
                      <span className="font-mono text-xs tracking-widest px-2 py-0.5 bg-white border border-slate-400 rounded-xs">
                        {formattedDateDigits}
                      </span>
                    </div>
                    <div className="p-1.5 flex items-center gap-2 justify-end pr-3">
                      <span>REF:</span>
                      <span className="font-mono text-xs tracking-widest px-2 py-0.5 bg-white border border-slate-400 rounded-xs">
                        {group.preQuoteId}
                      </span>
                    </div>
                  </div>

                  {/* CUSTOMER DETAILS & JOB DETAILS TABLE */}
                  <table className="w-full border-collapse border border-slate-900 text-xs text-left mb-2">
                    <thead>
                      <tr className="bg-slate-700 text-white font-bold border-b border-slate-900">
                        <th className="p-1.5 w-1/2 border-r border-slate-900">Customer Details:</th>
                        <th className="p-1.5 w-1/2">Job Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      <tr>
                        <td className="p-1.5 border-r border-slate-900">
                          <span className="font-semibold text-slate-500">Customer Name:</span>{' '}
                          <strong className="text-slate-900 font-bold">{group.customerName}</strong>
                        </td>
                        <td className="p-1.5">
                          <span className="font-semibold text-slate-500">Customer Branch:</span>{' '}
                          <span className="text-slate-800">{customerBranch}</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 border-r border-slate-900">
                          <span className="font-semibold text-slate-500">Customer Order No:</span>{' '}
                          <span className="text-slate-800">{customerOrderNo}</span>
                        </td>
                        <td className="p-1.5">
                          <span className="font-semibold text-slate-500">Model:</span>{' '}
                          <span className="text-slate-800 font-bold">{modelsText}</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 border-r border-slate-900">
                          <span className="font-semibold text-slate-500">Customer Delivery No:</span>{' '}
                          <span className="text-slate-800 font-mono">{deliveryNotesText}</span>
                        </td>
                        <td className="p-1.5">
                          <span className="font-semibold text-slate-500">Part No:</span>{' '}
                          <span className="text-slate-800 font-mono">{partNosText}</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 border-r border-slate-900">
                          <span className="font-semibold text-slate-500">Customer Job No:</span>{' '}
                          <span className="text-slate-800 font-mono">{customerJobNosText}</span>
                        </td>
                        <td className="p-1.5">
                          <span className="font-semibold text-slate-500">Part Description:</span>{' '}
                          <span className="text-slate-800 font-bold">{partDescriptionsText}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* JOB REPAIR DETAILS BANNER */}
                  <div className="bg-slate-700 text-white font-bold text-center py-1 text-xs border border-slate-900 border-b-0 uppercase tracking-wider">
                    Job Repair Details
                  </div>

                  {/* JOB REPAIR DETAILS TABLE */}
                  <table className="w-full border-collapse border border-slate-900 text-xs text-left mb-3">
                    <thead>
                      <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-900">
                        <th className="p-1.5 border-r border-slate-900 w-24">Our Job No</th>
                        <th className="p-1.5 border-r border-slate-900 w-44">Part No /Part Description</th>
                        <th className="p-1.5 border-r border-slate-900">Repair Procedure</th>
                        <th className="p-1.5 border-r border-slate-900 text-center w-12">Qty</th>
                        <th className="p-1.5 border-r border-slate-900 text-right w-24">Price/Each</th>
                        <th className="p-1.5 text-right w-36 bg-emerald-800 text-white font-bold">Customer Price (Incl 15% VAT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {group.jobs.map((job, jobIdx) => {
                        const allSteps = job.preQuoteDetails?.steps || [];
                        const jobPrefix = `${job.id} - `;
                        let componentSteps = allSteps.filter(s => s.stepName.startsWith(jobPrefix));
                        
                        // Fallback if steps were saved without prefix tagging
                        if (componentSteps.length === 0 && (group.jobs.length === 1 || !allSteps.some(s => group.jobs.some(o => s.stepName.startsWith(`${o.id} - `))))) {
                          componentSteps = allSteps;
                        }

                        const cleanName = (name: string) => name.startsWith(jobPrefix) ? name.substring(jobPrefix.length) : name;
                        const partDesc = job.partDescription || job.partNumber || (job.modelName ? `${job.modelName} ${job.componentType}` : job.componentType);
                        
                        const compTotalExclVat = componentSteps.reduce((sum, s) => sum + (s.price * (s.quantity || 1)), 0) || (job.preQuoteDetails?.totalCost || 0);
                        const compTotalInclVat = compTotalExclVat * 1.15;
                        const compTotalQty = componentSteps.reduce((sum, s) => sum + (s.quantity || 1), 0) || (job.qty || 1);

                        return (
                          <React.Fragment key={job.id || jobIdx}>
                            {/* Component Main Row */}
                            <tr className="bg-slate-100/90 font-bold align-top border-t border-slate-900">
                              <td className="p-1.5 font-mono font-extrabold text-slate-900 border-r border-slate-900">
                                <div>{job.id}</div>
                                <div className="text-[9px] text-slate-500 font-sans uppercase font-semibold">Comp #{jobIdx + 1}</div>
                              </td>
                              <td className="p-1.5 font-extrabold text-slate-900 border-r border-slate-900 uppercase">
                                {partDesc}
                              </td>
                              <td className="p-1.5 border-r border-slate-900 font-black uppercase text-slate-900 text-[11px]">
                                TO REPAIR AS FOLLOWS:
                              </td>
                              <td className="p-1.5 text-center border-r border-slate-900"></td>
                              <td className="p-1.5 text-right border-r border-slate-900"></td>
                              <td className="p-1.5 text-right bg-emerald-50/30"></td>
                            </tr>

                            {/* Individual Repair Steps Rows */}
                            {componentSteps.length > 0 ? (
                              componentSteps.map((step, sIdx) => {
                                const stepQty = step.quantity || 1;
                                const unitPrice = step.price;
                                const stepSubtotalExclVat = unitPrice * stepQty;
                                const stepSubtotalInclVat = stepSubtotalExclVat * 1.15;

                                return (
                                  <tr key={`step-${sIdx}`} className="align-top border-t border-slate-200 hover:bg-slate-50">
                                    <td className="p-1.5 border-r border-slate-900"></td>
                                    <td className="p-1.5 border-r border-slate-900"></td>
                                    <td className="p-1.5 border-r border-slate-900 pl-4 font-semibold text-slate-800 text-[11px] uppercase">
                                      • {cleanName(step.stepName)}
                                    </td>
                                    <td className="p-1.5 text-center font-bold text-slate-900 border-r border-slate-900 text-xs">
                                      {stepQty}
                                    </td>
                                    <td className="p-1.5 text-right font-mono text-slate-900 border-r border-slate-900 text-xs">
                                      {formatCurrency(unitPrice)}
                                    </td>
                                    <td className="p-1.5 text-right font-mono font-bold text-slate-900 bg-emerald-50/50 text-xs">
                                      {formatCurrency(stepSubtotalInclVat)}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr className="align-top border-t border-slate-200">
                                <td className="p-1.5 border-r border-slate-900"></td>
                                <td className="p-1.5 border-r border-slate-900"></td>
                                <td className="p-1.5 border-r border-slate-900 italic text-slate-500 text-[10px]">
                                  Standard repair & reconditioning procedure
                                </td>
                                <td className="p-1.5 text-center font-bold text-slate-900 border-r border-slate-900">1</td>
                                <td className="p-1.5 text-right font-mono text-slate-900 border-r border-slate-900">
                                  {formatCurrency(job.preQuoteDetails?.totalCost || 0)}
                                </td>
                                <td className="p-1.5 text-right font-mono font-bold text-slate-900 bg-emerald-50/50">
                                  {formatCurrency((job.preQuoteDetails?.totalCost || 0) * 1.15)}
                                </td>
                              </tr>
                            )}

                            {/* Component Subtotal Summary Row */}
                            <tr className="bg-slate-100/70 font-bold border-t border-slate-400">
                              <td className="p-1.5 border-r border-slate-900"></td>
                              <td className="p-1.5 border-r border-slate-900"></td>
                              <td className="p-1.5 border-r border-slate-900 font-extrabold text-right pr-2 uppercase text-[10px] text-slate-700">
                                Subtotal Job {job.id}:
                              </td>
                              <td className="p-1.5 text-center font-black text-slate-900 border-r border-slate-900">
                                {compTotalQty}
                              </td>
                              <td className="p-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-900">
                                {formatCurrency(compTotalExclVat)}
                              </td>
                              <td className="p-1.5 text-right font-mono font-black text-slate-900 bg-emerald-100">
                                {formatCurrency(compTotalInclVat)}
                              </td>
                            </tr>

                            {/* Leave one space open before next component */}
                            {jobIdx < group.jobs.length - 1 && (
                              <tr className="h-6 bg-slate-50">
                                <td colSpan={6} className="p-2 border-y border-slate-300">
                                  &nbsp;
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* NOTES & ESTIMATED TIMES TABLE + PQ TOTAL BANNER */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end mb-3">
                    {/* Notes Table */}
                    <table className="border-collapse border border-slate-900 text-[9px] w-full text-left">
                      <tbody className="divide-y divide-slate-300">
                        <tr>
                          <td className="p-1 font-bold bg-slate-100 border-r border-slate-900 w-10">NOTE</td>
                          <td className="p-1 font-semibold border-r border-slate-900">Average days</td>
                          <td className="p-1">±____ working days to repair parts</td>
                        </tr>
                        <tr>
                          <td className="p-1 font-bold bg-slate-100 border-r border-slate-900">NOTE</td>
                          <td className="p-1 font-semibold border-r border-slate-900">EST TIME: STRIPPING</td>
                          <td className="p-1">±____ working days to repair parts</td>
                        </tr>
                        <tr>
                          <td className="p-1 font-bold bg-slate-100 border-r border-slate-900">NOTE</td>
                          <td className="p-1 font-semibold border-r border-slate-900">EST TIME: CLEANING</td>
                          <td className="p-1">±____ working days to repair parts</td>
                        </tr>
                        <tr>
                          <td className="p-1 font-bold bg-slate-100 border-r border-slate-900">NOTE</td>
                          <td className="p-1 font-semibold border-r border-slate-900">EST TIME: SANDBLAST</td>
                          <td className="p-1">±____ working days to repair parts</td>
                        </tr>
                        <tr>
                          <td className="p-1 font-bold bg-slate-100 border-r border-slate-900">NOTE</td>
                          <td className="p-1 font-semibold border-r border-slate-900">EST TIME: INSPECTION</td>
                          <td className="p-1">±____ working days to repair parts</td>
                        </tr>
                        <tr>
                          <td className="p-1 font-bold bg-slate-100 border-r border-slate-900">NOTE</td>
                          <td className="p-1 font-semibold border-r border-slate-900">BWE to Supply</td>
                          <td className="p-1">Re-Use & Salvage Guidelines</td>
                        </tr>
                        <tr>
                          <td className="p-1 font-bold bg-slate-100 border-r border-slate-900">NOTE</td>
                          <td className="p-1 font-semibold border-r border-slate-900">BWE to Supply</td>
                          <td className="p-1">Drawing</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* PQ No & Total Summary Banner */}
                    <div className="border border-slate-900 bg-amber-400 p-2 flex flex-wrap items-center justify-between text-slate-900 font-extrabold text-xs sm:text-sm shadow-xs gap-2">
                      <span>PQ No: {group.preQuoteId}</span>
                      <div className="flex items-center gap-4 text-xs font-bold">
                        <span>Excl VAT: <strong className="font-mono text-slate-900">{formatCurrency(group.totalCost)}</strong></span>
                        <span>VAT (15%): <strong className="font-mono text-slate-900">{formatCurrency(group.totalCost * 0.15)}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="uppercase tracking-wider text-xs">Total (Incl 15% VAT):</span>
                        <span className="font-mono text-base font-black text-slate-950">{formatCurrency(group.totalCost * 1.15)}</span>
                      </div>
                    </div>
                  </div>

                  {/* DOCUMENT FOOTER */}
                  <div className="border-t border-slate-300 pt-2 flex items-center justify-between text-[9px] font-bold">
                    <span className="text-red-700 uppercase tracking-tight">
                      THIS DOCUMENT IS THE SOLE PROPERTY OF Metalogik Engineering Services PTY LTD
                    </span>
                    <span className="text-slate-600">
                      1 OF 1
                    </span>
                  </div>
                </>
              );
            })()}
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
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>Print</span>
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
