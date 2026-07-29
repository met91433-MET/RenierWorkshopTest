import React from 'react';
import { Job, JobCardFormatConfig, DEFAULT_JOB_CARD_FORMAT } from '../types';

interface JobCardDocumentProps {
  job?: Partial<Job>;
  format?: JobCardFormatConfig;
  page?: 'page1' | 'page2';
  isPrint?: boolean;
  overrideFields?: {
    jobCardNumber?: string;
    assignedTechnician?: string;
    orderNumber?: string;
    yourRef?: string;
    customerJobNumber?: string;
    scheduledDate?: string;
    dueDate?: string;
    workshopArea?: string;
    requiredParts?: string;
    instructions?: string;
    sequenceString?: string;
  };
}

export default function JobCardDocument({
  job,
  format = DEFAULT_JOB_CARD_FORMAT,
  page = 'page1',
  isPrint = false,
  overrideFields
}: JobCardDocumentProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState<number>(0.65);

  React.useEffect(() => {
    if (isPrint) return;
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setScale(width / 794);
      }
    };

    updateScale();

    const ro = new ResizeObserver(updateScale);
    ro.observe(el);

    return () => ro.disconnect();
  }, [isPrint]);

  // Sample fallback data for editor preview
  const jobData = {
    id: job?.id || 'J22856',
    customerName: job?.customerName || 'CATERPILLAR MINING DIVISION',
    deliveryNoteNumber: job?.deliveryNoteNumber || 'DN-9941',
    modelName: job?.modelName || '960',
    componentType: job?.componentType || 'SPINDLE',
    status: job?.status || 'JobCardCreated',
    jobCardDetails: job?.jobCardDetails || {
      orderNumber: 'PO-7721',
      yourRef: 'RF-202',
      customerJobNumber: 'CJ-881',
      assignedTechnician: '2604 EDWARD',
      workshopArea: '9B',
      dueDate: '31 Dec 2025',
      jobCardCreatedAt: new Date().toISOString().split('T')[0]
    },
    preQuoteDetails: job?.preQuoteDetails
  };

  const details = {
    ...jobData.jobCardDetails,
    ...(overrideFields || {})
  };
  const accentColor = format.accentColor || '#dc2626';
  const customerTextColor = format.customerTextColor || '#c026d3';
  const consumablesHeaderBg = format.consumablesHeaderBg || '#e0f2fe';
  const outsourcingHeaderBg = format.outsourcingHeaderBg || '#fef08a';
  const stampBoxBorderColor = format.stampBoxBorderColor || '#22c55e';

  // Border thickness helper
  const borderClass = format.borderWidth === 'thin' ? 'border' : format.borderWidth === 'thick' ? 'border-[3px]' : 'border-2';

  // Logo size classes (Doubled size)
  const logoSizeClass = format.logoSize === 'small' ? 'w-12 h-12' : format.logoSize === 'large' ? 'w-24 h-24' : 'w-16 h-16';

  const renderPage2Content = () => (
    <div className="flex-1 flex flex-col min-h-0 justify-between">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top Warning Banner (Doubled Font) */}
        <div className="text-center font-black text-red-600 text-[18px] uppercase tracking-widest mb-3 flex-shrink-0">
          {format.labels.page2Warning || "DOCUMENT NOT to be copied for customer"}
        </div>

        {/* Top Header Summary Bar (Doubled Font) */}
        <div className={`${borderClass} border-black p-3.5 flex justify-between items-center bg-slate-50 mb-3 flex-shrink-0`}>
          <div className="text-left">
            <span className="text-[14px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Timesheet Record</span>
            <h2 className="text-xl font-black text-slate-800 tracking-wide mt-1">WORKSHOP MACHINING LOG</h2>
          </div>
          <div className="flex gap-6 text-[15px] font-semibold text-slate-700">
            <div className="border-r border-black/10 pr-4 leading-tight text-left">
              <span className="text-[12px] text-slate-400 uppercase block font-bold">Model</span>
              <span className="font-bold text-[15px]">{jobData.modelName}</span>
            </div>
            <div className="border-r border-black/10 pr-4 leading-tight text-left">
              <span className="text-[12px] text-slate-400 uppercase block font-bold">Item Description</span>
              <span className="font-bold text-[15px]">{jobData.modelName} {jobData.componentType} (F)-000</span>
            </div>
            <div className="leading-tight text-left">
              <span className="text-[12px] text-slate-400 uppercase block font-bold">Job Card #</span>
              <span className="font-mono font-black text-[18px]" style={{ color: accentColor }}>
                {details.jobCardNumber || (jobData.id.startsWith('C') ? 'J' + jobData.id.substring(1) : jobData.id)}
              </span>
            </div>
          </div>
        </div>

        {/* Full machining timesheet log grid filling the entire rest of the page (Doubled Font) */}
        <div className="border-2 border-black bg-white flex-1 flex flex-col min-h-0">
          <table className="w-full text-[13px] flex-1 flex flex-col">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-black text-slate-900 font-black text-center divide-x-2 divide-black flex-shrink-0 flex w-full">
                <th className="p-2 w-[8%] flex items-center justify-center">MC#</th>
                <th className="p-2 w-[24%] flex items-center justify-center">Operation</th>
                <th className="p-2 w-[8%] flex items-center justify-center">Clock No</th>
                <th className="p-2 w-[16%] flex items-center justify-center">Emp Name</th>
                <th className="p-2 w-[10%] flex items-center justify-center">Date</th>
                <th className="p-2 w-[8%] flex items-center justify-center">Time Start</th>
                <th className="p-2 w-[8%] flex items-center justify-center">Time End</th>
                <th className="p-2 w-[9%] flex items-center justify-center">Pick Up Size</th>
                <th className="p-2 w-[9%] flex items-center justify-center">Finished Size</th>
              </tr>
            </thead>
            <tbody className="flex-1 flex flex-col divide-y divide-black/30">
              {Array.from({ length: 18 }).map((_, i) => (
                <tr key={i} className="flex-1 flex divide-x divide-black/30 min-h-[30px]">
                  <td className="w-[8%]"></td>
                  <td className="w-[24%]"></td>
                  <td className="w-[8%]"></td>
                  <td className="w-[16%]"></td>
                  <td className="w-[10%]"></td>
                  <td className="w-[8%]"></td>
                  <td className="w-[8%]"></td>
                  <td className="w-[9%]"></td>
                  <td className="w-[9%]"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer disclaimer (Doubled Font) */}
      <div className="text-[13px] text-slate-500 text-center font-bold border-t border-slate-200 pt-2 mt-3 flex-shrink-0">
        {format.footerNotePage2 || "QUALITY CONTROL SIGN-OFF REQUIRED UPON COMPLETION"}
      </div>
    </div>
  );

  const renderPage1Content = () => (
    <div className="flex-1 flex flex-col min-h-0 justify-between gap-2.5">
      {/* SECTION 1: HEADER & COMPANY BRANDING */}
      {format.sections.find(s => s.id === 'header')?.enabled !== false && (
        <div className={`${borderClass} border-black p-4 flex justify-between items-center bg-white`}>
          {/* Logo / Company Info */}
          <div className={`flex items-center gap-3.5 ${format.logoAlignment === 'center' ? 'flex-1 justify-center' : ''}`}>
            {format.showCompanyLogo && (
              <div className={`relative ${logoSizeClass} flex-shrink-0 flex items-center justify-center`}>
                {format.logoUrl ? (
                  <img src={format.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-600 fill-current">
                    <path d="M50 35c-8.3 0-15 6.7-15 15s6.7 15 15 15 15-6.7 15-15-6.7-15-15-15zm0 25c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z" />
                    <path d="M91.5 44.5l-6.8-2.2c-.6-2.1-1.6-4.1-2.8-5.9l4.1-5.8c.8-1.1.7-2.6-.3-3.6l-5.7-5.7c-1-.1-2.5-.2-3.6.6l-5.8 4.1c-1.8-1.2-3.8-2.2-5.9-2.8l-2.2-6.8c-.4-1.3-1.6-2.2-3-2.2h-8c-1.4 0-2.6.9-3 2.2l-2.2 6.8c-2.1.6-4.1 1.6-5.9 2.8l-5.8-4.1c-1.1-.8-2.6-.7-3.6.3l-5.7 5.7c-1 1-1.1 2.5-.3 3.6l4.1 5.8c-1.2 1.8-2.2 3.8-2.8 5.9l-6.8 2.2c-1.3.4-2.2 1.6-2.2 3v8c0 1.4.9 2.6 2.2 3l6.8 2.2c.6 2.1 1.6 4.1 2.8 5.9l-4.1 5.8c-.8 1.1-.7 2.6.3 3.6l5.7 5.7c1 1 2.5 1.1 3.6.3l5.8-4.1c1.8 1.2 3.8 2.2 5.9 2.8l2.2 6.8c.4 1.3 1.6 2.2 3 2.2h8c1.4 0 2.6-.9 3-2.2l2.2-6.8c2.1-.6 4.1-1.6 5.9-2.8l5.8 4.1c1.1.8 2.6.7 3.6-.3l5.7-5.7c1-1 1.1-2.5.3-3.6l-4.1-5.8c1.2-1.8 2.2-3.8 2.8-5.9l6.8-2.2c1.3-.4 2.2-1.6 2.2-3v-8c0-1.4-.9-2.6-2.2-3zm-41.5 18c-7.2 0-13-5.8-13-13s5.8-13 13-13 13 5.8 13 13-5.8 13-13 13z" />
                  </svg>
                )}
              </div>
            )}
            <div className="text-left leading-tight">
              <div className="text-2xl font-black tracking-tight text-slate-900 font-display break-words">{format.companyName}</div>
              <div className="text-[12px] font-extrabold text-slate-600 uppercase mt-0.5">{format.companySubtitle}</div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">{format.companyTagline}</div>
            </div>
          </div>

          {/* Document Title & Quality Badges */}
          <div className="text-center px-3">
            <div className="flex items-center gap-1.5 justify-center">
              {format.showSabsBadge && (
                <span className="border text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-sans" style={{ borderColor: accentColor, color: accentColor }}>
                  {format.sabsBadgeText || "SABS"}
                </span>
              )}
              {format.showIsoBadge && (
                <span className="text-[10px] text-slate-500 font-bold">{format.isoCertText || "ISO 9001"}</span>
              )}
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight font-display mt-1">{format.documentTitle || "Job Card"}</h1>
          </div>

          {/* Job Number Box */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-bold text-slate-600">Job Card #</span>
              <div className="border-2 rounded-lg px-3 py-1.5 bg-white shadow-xs" style={{ borderColor: accentColor }}>
                <span className="text-2xl font-black font-mono tracking-wider" style={{ color: accentColor }}>
                  {details.jobCardNumber || overrideFields?.jobCardNumber || (jobData.id.startsWith('C') ? 'J' + jobData.id.substring(1) : jobData.id)}
                </span>
              </div>
            </div>
            {jobData.id && (
              <span className="text-[13px] font-bold text-slate-500 font-mono mt-1">
                Comp ID: {jobData.id}
              </span>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: CUSTOMER & REFERENCE DATA */}
      {format.sections.find(s => s.id === 'customer_info')?.enabled !== false && (
        <div className={`grid grid-cols-12 border-x-2 border-b-2 border-black bg-white`}>
          {/* Customer Identifier Block */}
          <div className="col-span-7 flex flex-col justify-between border-r-2 border-black">
            <div className="p-3 flex-1 flex flex-col justify-center items-center bg-slate-50/30 min-h-[65px]">
              <span className="text-[13px] font-extrabold text-slate-500 tracking-wider uppercase block mb-1">Customer Identifier</span>
              <span className="text-2xl font-black tracking-wider font-display text-center leading-snug uppercase break-words px-2" style={{ color: customerTextColor }}>
                {jobData.customerName}
              </span>
            </div>

            <div className="grid grid-cols-3 border-t-2 border-black text-[13px] font-bold text-slate-800">
              <div className="p-2 border-r-2 border-black text-center bg-slate-50/50">
                <span className="text-[11px] text-slate-500 block uppercase font-bold leading-tight mb-0.5">{format.labels.deliveryNoteNumber}</span>
                <span className="font-bold text-slate-900 font-mono text-[14px]">{jobData.deliveryNoteNumber || 'NONE'}</span>
              </div>
              <div className="p-2 border-r-2 border-black text-center bg-slate-50/50">
                <span className="text-[11px] text-slate-500 block uppercase font-bold leading-tight mb-0.5">{format.labels.yourRef}</span>
                <span className="font-bold text-slate-900 font-mono text-[14px]">{details.yourRef || 'NONE'}</span>
              </div>
              <div className="p-2 text-center bg-slate-50/50">
                <span className="text-[11px] text-slate-500 block uppercase font-bold leading-tight mb-0.5">{format.labels.customerJobNumber}</span>
                <span className="font-bold text-slate-900 font-mono text-[14px]">{details.customerJobNumber || 'NONE'}</span>
              </div>
            </div>
          </div>

          {/* Sub-Details Table */}
          <div className="col-span-5 flex flex-col text-[13px]">
            <div className="flex justify-between items-center px-2 py-1 bg-blue-50/80 border-b-2 border-black text-[11px] font-bold text-slate-600">
              <span className="text-blue-700 font-mono font-black">&lt;NA&gt;</span>
              <span>{details.jobCardCreatedAt || new Date().toISOString().split('T')[0]} 10:49:46</span>
            </div>

            <div className="grid grid-cols-3 border-b-2 border-black">
              <div className="p-1.5 font-bold text-slate-600 uppercase text-[11px] flex items-center bg-slate-50">{format.labels.orderNumber}</div>
              <div className="col-span-2 p-1.5 font-bold text-slate-900 border-l-2 border-black text-left font-mono text-[14px]">{details.orderNumber || 'NONE'}</div>
            </div>
            <div className="grid grid-cols-3 border-b-2 border-black">
              <div className="p-1.5 font-bold text-slate-600 uppercase text-[11px] flex items-center bg-slate-50">Model #</div>
              <div className="col-span-2 p-1.5 font-bold text-slate-900 border-l-2 border-black text-left font-mono text-[14px]">{jobData.modelName || '960'}</div>
            </div>
            <div className="grid grid-cols-3 border-b-2 border-black">
              <div className="p-1.5 font-bold text-slate-600 uppercase text-[11px] flex items-center bg-slate-50">{format.labels.leadTechnician}</div>
              <div className="col-span-2 p-1.5 font-bold border-l-2 border-black text-left font-mono text-[14px]" style={{ color: accentColor }}>
                {details.assignedTechnician ? details.assignedTechnician.toUpperCase() : '2604 EDWARD'}
              </div>
            </div>
            <div className="grid grid-cols-4 text-center">
              <div className="p-1.5 font-bold text-slate-600 uppercase text-[11px] bg-slate-50 border-r-2 border-black flex items-center justify-center">Qty</div>
              <div className="p-1.5 font-bold text-slate-900 border-r-2 border-black flex items-center justify-center text-[14px]">1</div>
              <div className="p-1.5 font-bold text-slate-600 uppercase text-[11px] bg-slate-50 border-r-2 border-black flex items-center justify-center">Go Ahead</div>
              <div className="p-1.5 font-bold text-blue-700 flex items-center justify-center font-mono text-[14px]">NA</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: MODEL & DESCRIPTION BAR */}
      {format.sections.find(s => s.id === 'model_sub_bar')?.enabled !== false && (
        <div className={`border-x-2 border-b-2 border-black bg-slate-100 flex justify-between items-center px-4 py-2 text-[16px] font-black text-slate-900 leading-none`}>
          <span className="font-mono font-black text-[18px]" style={{ color: accentColor }}>{jobData.modelName || '960'}</span>
          <span className="uppercase font-display tracking-widest text-[16px]">{jobData.modelName || '960'} {jobData.componentType.toUpperCase()} (F)-000</span>
        </div>
      )}

      {/* SECTION 4: WORKSHOP PROCEDURE / INSTRUCTIONS BOX */}
      {format.sections.find(s => s.id === 'work_instructions')?.enabled !== false && (
        <div className={`border-x-2 border-b-2 border-black p-4 bg-white flex-1 flex flex-col justify-between min-h-[220px] relative overflow-hidden`}>
          <div>
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-[14px] font-extrabold text-slate-600 tracking-wider uppercase">
                {format.labels.specialInstructions || "APPROVED REPAIR WORK PROCEDURES & SPECIAL TECHNICAL INSTRUCTIONS"}
              </h3>
              {format.showAreaBadge && (
                <div className="border-2 border-blue-600 rounded-lg p-1.5 text-center min-w-[65px] bg-white shadow-xs">
                  <span className="text-[10px] text-blue-600 font-extrabold uppercase tracking-tight block">{format.labels.workshopArea || "AREA"}</span>
                  <span className="text-xl font-black text-blue-700 font-mono leading-none">{details.workshopArea || '9B'}</span>
                </div>
              )}
            </div>

            {/* Procedures / Steps list */}
            <div className="space-y-2 text-[15px] text-slate-900">
              {(() => {
                const prefix = `${jobData.id} - `;
                const steps = jobData.preQuoteDetails?.steps?.filter(s => s.stepName.startsWith(prefix)) || [];
                const displaySteps = steps.length > 0 ? steps : (jobData.preQuoteDetails?.steps || []);
                
                return (
                  <div className="space-y-2">
                    {displaySteps.map((step, idx) => {
                      const cleanName = step.stepName.startsWith(prefix) ? step.stepName.substring(prefix.length) : step.stepName;
                      return (
                        <div key={idx} className="flex items-start gap-2 leading-snug">
                          <span className="text-[13px] text-slate-500 font-mono font-bold mt-0.5">[ ]</span>
                          <span><span className="font-bold mr-1.5">{idx + 1}.</span>{cleanName}</span>
                        </div>
                      );
                    })}

                    {details.instructions && (
                      <div className="mt-3 pt-3 border-t border-slate-300 text-slate-900 whitespace-pre-line leading-relaxed font-semibold text-[15px] break-words">
                        <span className="text-[12px] text-slate-500 uppercase font-black tracking-wider block mb-1">Special Technical Instructions:</span>
                        {details.instructions}
                      </div>
                    )}

                    {displaySteps.length === 0 && !details.instructions && (
                      <div className="font-bold text-slate-800 tracking-wider py-3 text-[16px]">
                        FOR TEST PURPOSES ONLY
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Bottom Row inside Instructions Box */}
          <div className="flex justify-between items-end border-t border-slate-200 pt-2.5 text-[14px] font-bold text-slate-700 mt-3">
            {format.showApprovalSignature && (
              <div>
                <span>{format.labels.approvalSignature || "Approval Signature"}: _______________________</span>
              </div>
            )}
            {format.showDueDate && (
              <div className="border border-slate-300 px-3 py-1 bg-slate-50 rounded-lg text-right flex flex-col leading-none">
                <span className="text-[10px] text-slate-500 uppercase font-black block mb-0.5">{format.labels.dueDate || "Due Date"}</span>
                <span className="font-bold text-slate-900 font-mono text-[14px]">{details.dueDate || '31 Dec 2025'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: TABLES GRID (CONSUMABLES, OUTSOURCING & HARD STAMP) */}
      {format.sections.find(s => s.id === 'tables_grid')?.enabled !== false && (
        <div className={`grid grid-cols-2 border-x-2 border-b-2 border-black bg-white`}>
          {/* Left Column: Consumables Table */}
          {format.showConsumablesTable && (
            <div className="border-r-2 border-black flex flex-col">
              <div className="border-b-2 border-black text-center py-1 font-bold text-slate-900 text-[13px] uppercase tracking-wider" style={{ backgroundColor: consumablesHeaderBg }}>
                {format.labels.consumablesTitle || "Consumables"}
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b-2 border-black/40 text-center font-bold">
                    <th className="p-1 border-r border-black/30 w-1/4">Supplier</th>
                    <th className="p-1 border-r border-black/30 w-1/2">Description</th>
                    <th className="p-1 border-r border-black/30 w-1/8">Size</th>
                    <th className="p-1 w-1/8">QTY</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="h-5 border-b border-black/20">
                      <td className="border-r border-black/20"></td>
                      <td className="border-r border-black/20"></td>
                      <td className="border-r border-black/20"></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Right Column: Consumables #2 + Outsourcing + Hard Stamp Box */}
          <div className="flex flex-col justify-between">
            <div>
              {/* Consumables #2 */}
              {format.showConsumablesTable && (
                <div className="flex flex-col border-b-2 border-black">
                  <div className="border-b-2 border-black text-center py-1 font-bold text-slate-900 text-[13px] uppercase tracking-wider" style={{ backgroundColor: consumablesHeaderBg }}>
                    {format.labels.consumablesTitle || "Consumables"}
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b-2 border-black/40 text-center font-bold">
                        <th className="p-1 border-r border-black/30 w-1/4">Supplier</th>
                        <th className="p-1 border-r border-black/30 w-1/2">Description</th>
                        <th className="p-1 border-r border-black/30 w-1/8">Size</th>
                        <th className="p-1 w-1/8">QTY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="h-5 border-b border-black/20">
                          <td className="border-r border-black/20"></td>
                          <td className="border-r border-black/20"></td>
                          <td className="border-r border-black/20"></td>
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Outsourcing Table */}
              {format.showOutsourcingTable && (
                <div className="flex flex-col">
                  <div className="border-b-2 border-black text-center py-1 font-bold text-slate-900 text-[13px] uppercase tracking-wider" style={{ backgroundColor: outsourcingHeaderBg }}>
                    {format.labels.outsourcingTitle || "Outsourcing"}
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b-2 border-black/40 text-center font-bold">
                        <th className="p-1 border-r border-black/30 w-1/4">Supplier</th>
                        <th className="p-1 border-r border-black/30 w-1/2">Material Spec</th>
                        <th className="p-1 border-r border-black/30 w-1/8">Hardness</th>
                        <th className="p-1 w-1/8">QTY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="h-5 border-b border-black/20">
                          <td className="border-r border-black/20"></td>
                          <td className="border-r border-black/20"></td>
                          <td className="border-r border-black/20"></td>
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Hard Stamp Date Box */}
            {format.showHardStampBox && (
              <div className="p-1.5 flex justify-end items-center bg-slate-50/50 mt-1">
                <div className="border-2 rounded-lg p-1.5 text-center min-w-[120px] bg-white flex flex-col leading-none shadow-xs" style={{ borderColor: stampBoxBorderColor }}>
                  <span className="text-[11px] font-bold uppercase tracking-tight block" style={{ color: stampBoxBorderColor }}>
                    {format.labels.hardStampDate || "HARD STAMP DATE"}
                  </span>
                  <div className="h-8 mt-1"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer disclaimer */}
      <div className="text-[13px] text-slate-500 text-center font-bold pt-2 border-t-2 border-slate-200">
        {format.footerNotePage1 || "CONFIDENTIAL - WORKSHOP FLOOR ROUTING SLIP"}
      </div>
    </div>
  );

  const documentContent = (
    <div
      style={{
        width: '794px',
        height: '1123px',
        boxSizing: 'border-box'
      }}
      className={`bg-white ${borderClass} border-black p-5 text-black font-sans relative flex flex-col justify-between shadow-xs overflow-hidden shrink-0`}
    >
      {page === 'page2' ? renderPage2Content() : renderPage1Content()}
    </div>
  );

  if (isPrint) {
    return documentContent;
  }

  return (
    <div
      ref={containerRef}
      className="w-full relative flex justify-center items-start overflow-hidden"
      style={{ height: `${1123 * scale}px` }}
    >
      <div
        style={{
          width: '794px',
          height: '1123px',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          boxSizing: 'border-box'
        }}
        className="shrink-0"
      >
        {documentContent}
      </div>
    </div>
  );
}
