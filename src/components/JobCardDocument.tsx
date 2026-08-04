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
  const isLandscape = page === 'page2';
  const targetWidth = isLandscape ? 1123 : 794;
  const targetHeight = isLandscape ? 794 : 1123;
  const [scale, setScale] = React.useState<number>(0.65);

  React.useEffect(() => {
    if (isPrint) return;
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setScale(width / targetWidth);
      }
    };

    updateScale();

    const ro = new ResizeObserver(updateScale);
    ro.observe(el);

    return () => ro.disconnect();
  }, [isPrint, targetWidth]);

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

  // Logo size classes
  const logoSizeClass = format.logoSize === 'small' ? 'h-10 max-w-[140px]' : format.logoSize === 'large' ? 'h-20 max-w-[240px]' : 'h-14 max-w-[180px]';

  // Customer 3-letter code helper
  const getCustomerCode = (name?: string) => {
    if (!name) return 'NA';
    const clean = name.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length === 0) return 'NA';
    return clean.substring(0, 3).toUpperCase();
  };

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
              <span className="font-bold text-[15px]">{jobData.modelName} {jobData.componentType}</span>
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
              {Array.from({ length: 15 }).map((_, i) => (
                <tr key={i} className="flex-1 flex divide-x divide-black/30 min-h-[26px]">
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
                <img src={format.logoUrl || "/metalogik_logo.png"} alt="METALOGIK Logo" className="w-full h-full object-contain" />
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
              <span className="text-blue-700 font-mono font-black">{getCustomerCode(jobData.customerName)}</span>
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
              <div className="p-1.5 font-bold text-slate-600 uppercase text-[11px] flex items-center bg-slate-50">{format.labels.leadTechnician || "Status"}</div>
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
          <span className="uppercase font-display tracking-widest text-[16px]">{jobData.modelName || ''} {jobData.componentType || ''}</span>
        </div>
      )}

      {/* SECTION 4: WORKSHOP PROCEDURE / INSTRUCTIONS BOX */}
      {format.sections.find(s => s.id === 'work_instructions')?.enabled !== false && (
        <div className={`border-x-2 border-b-2 border-black p-4 bg-white flex-1 flex flex-col justify-between min-h-[280px] relative overflow-hidden`}>
          <div>
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-[14px] font-extrabold text-slate-600 tracking-wider uppercase">
                {format.labels.specialInstructions || "APPROVED REPAIR WORK PROCEDURES"}
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

                    {displaySteps.length === 0 && (
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

      {/* SECTION 5: TABLES GRID (CONSUMABLES & OUTSOURCING) */}
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
                  {Array.from({ length: 4 }).map((_, i) => (
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

          {/* Right Column: Consumables #2 + Outsourcing */}
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
                      {Array.from({ length: 2 }).map((_, i) => (
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
                      {Array.from({ length: 2 }).map((_, i) => (
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
        width: isPrint ? (isLandscape ? '297mm' : '210mm') : `${targetWidth}px`,
        height: isPrint ? (isLandscape ? '210mm' : '297mm') : `${targetHeight}px`,
        boxSizing: 'border-box'
      }}
      className={`bg-white ${borderClass} border-black p-4 md:p-5 text-black font-sans relative flex flex-col justify-between shadow-xs overflow-hidden shrink-0 w-full h-full`}
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
      style={{ height: `${targetHeight * scale}px` }}
    >
      <div
        style={{
          width: `${targetWidth}px`,
          height: `${targetHeight}px`,
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
