import React, { useRef, useState, useEffect } from 'react';
import { JobCardFormatConfig, DEFAULT_JOB_CARD_FORMAT } from '../types';

interface PreQuoteDocumentPreviewProps {
  format?: JobCardFormatConfig;
  isPrint?: boolean;
}

export default function PreQuoteDocumentPreview({ 
  format = DEFAULT_JOB_CARD_FORMAT,
  isPrint = false 
}: PreQuoteDocumentPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetWidth = 794;
  const targetHeight = 1123;
  const [scale, setScale] = useState<number>(0.65);

  useEffect(() => {
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  const borderClass = format.borderWidth === 'thin' ? 'border' : format.borderWidth === 'thick' ? 'border-[3px]' : 'border-2';
  const accentColor = format.accentColor || '#dc2626';

  const documentContent = (
    <div
      style={{
        width: isPrint ? '210mm' : `${targetWidth}px`,
        height: isPrint ? '297mm' : `${targetHeight}px`,
        boxSizing: 'border-box'
      }}
      className={`bg-white ${borderClass} border-slate-900 p-5 sm:p-6 text-slate-900 font-sans relative flex flex-col justify-between shadow-xs overflow-hidden shrink-0 w-full h-full text-left`}
    >
      <div>
        {/* TOP HEADER TABLE */}
        <table className="w-full border-collapse border border-slate-900 text-xs font-sans">
          <tbody>
            <tr>
              {/* Top Left: Logo */}
              <td className="p-2 border border-slate-900 w-1/3 align-middle bg-white">
                {format.showCompanyLogo && format.logoUrl ? (
                  <img src={format.logoUrl} alt="Logo" className="max-h-12 object-contain" />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-emerald-700 text-amber-300 font-black flex items-center justify-center rounded-lg text-lg border border-slate-800 shrink-0">
                      M
                    </div>
                    <div>
                      <div className="font-black text-slate-900 tracking-tight text-xs uppercase">{format.companyName}</div>
                      <div className="text-[9px] text-slate-600 font-bold uppercase">{format.companySubtitle}</div>
                    </div>
                  </div>
                )}
              </td>

              {/* Top Middle: Document Title */}
              <td className="p-2 border border-slate-900 w-1/3 text-center align-middle bg-slate-50">
                <h2 className="font-extrabold text-sm text-slate-900 tracking-wide uppercase">
                  {format.documentTitle && format.documentTitle !== "Job Card" ? format.documentTitle : "OFFICIAL PRE-QUOTE ESTIMATION"}
                </h2>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">ESTIMATION & SCOPE BREAKDOWN</p>
              </td>

              {/* Top Right: Company Address / Info */}
              <td className="p-2 border border-slate-900 w-1/3 text-right text-[10px] align-middle bg-white font-medium">
                <div className="font-bold text-slate-900">{format.companyName} {format.companySubtitle}</div>
                <div>12 Industrial Road, Workshop Complex</div>
                <div>Tel: +27 (0) 11 824 1500</div>
                <div>Email: quotes@metalogik.co.za</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* CUSTOMER & PREQUOTE METADATA GRID */}
        <table className="w-full border-collapse border-x border-b border-slate-900 text-xs mt-[-1px]">
          <tbody>
            <tr className="bg-slate-100/80">
              <td className="p-1.5 border border-slate-900 font-bold w-1/6">CUSTOMER:</td>
              <td className="p-1.5 border border-slate-900 font-bold text-purple-900 w-2/6">BHP Billiton / Mining Ops</td>
              <td className="p-1.5 border border-slate-900 font-bold w-1/6">QUOTATION DATE:</td>
              <td className="p-1.5 border border-slate-900 font-mono w-2/6">2026-08-05</td>
            </tr>
            <tr>
              <td className="p-1.5 border border-slate-900 font-bold">DELIVERY NOTE(S):</td>
              <td className="p-1.5 border border-slate-900 font-mono text-slate-800">DN-99482, DN-99483</td>
              <td className="p-1.5 border border-slate-900 font-bold">PREQUOTE NO:</td>
              <td className="p-1.5 border border-slate-900 font-mono font-black" style={{ color: accentColor }}>PQ-88301</td>
            </tr>
            <tr className="bg-slate-100/80">
              <td className="p-1.5 border border-slate-900 font-bold">ESTIMATOR:</td>
              <td className="p-1.5 border border-slate-900 font-semibold">J. Botha</td>
              <td className="p-1.5 border border-slate-900 font-bold">VALIDITY:</td>
              <td className="p-1.5 border border-slate-900 font-medium">30 Days from issue</td>
            </tr>
          </tbody>
        </table>

        {/* SCOPE & PRICING MATRIX TABLE */}
        <table className="w-full border-collapse border border-slate-900 text-xs mt-3">
          <thead>
            <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
              <th className="p-2 border border-slate-900 w-1/6 text-left">Our Job Number</th>
              <th className="p-2 border border-slate-900 w-1/4 text-left">Part Description</th>
              <th className="p-2 border border-slate-900 text-left">Repair Procedure</th>
              <th className="p-2 border border-slate-900 w-12 text-center">Qty</th>
              <th className="p-2 border border-slate-900 w-24 text-right">Price/Each</th>
              <th className="p-2 border border-slate-900 w-28 text-right">Customer Price (Incl 15% VAT)</th>
            </tr>
          </thead>
          <tbody>
            {/* Component 1 */}
            <tr className="bg-slate-50 font-bold border-t-2 border-slate-900">
              <td className="p-2 border border-slate-900 font-mono text-blue-700">J00042 (C00001)</td>
              <td className="p-2 border border-slate-900 text-slate-900">Hydraulic Cylinder Rod - CAT 349</td>
              <td className="p-2 border border-slate-900 italic text-slate-600 font-normal">S/N: CAT-HYD-99812 • DN: DN-99482</td>
              <td className="p-2 border border-slate-900 text-center font-mono">1</td>
              <td className="p-2 border border-slate-900 text-right font-mono text-slate-400">-</td>
              <td className="p-2 border border-slate-900 text-right font-mono font-bold text-slate-900">{formatCurrency(14375)}</td>
            </tr>
            <tr>
              <td className="p-1.5 border border-slate-900 font-mono text-slate-400 text-[10px] text-center">-</td>
              <td className="p-1.5 border border-slate-900 text-slate-500 italic text-[11px]">Sub-procedure</td>
              <td className="p-1.5 border border-slate-900 font-medium">Strip, clean & non-destructive Crack Test (NDT)</td>
              <td className="p-1.5 border border-slate-900 text-center font-mono">1</td>
              <td className="p-1.5 border border-slate-900 text-right font-mono">{formatCurrency(2500)}</td>
              <td className="p-1.5 border border-slate-900 text-right font-mono text-slate-700">{formatCurrency(2875)}</td>
            </tr>
            <tr>
              <td className="p-1.5 border border-slate-900 font-mono text-slate-400 text-[10px] text-center">-</td>
              <td className="p-1.5 border border-slate-900 text-slate-500 italic text-[11px]">Sub-procedure</td>
              <td className="p-1.5 border border-slate-900 font-medium">Hard Chrome Plating & Precision Cylindrical Grind</td>
              <td className="p-1.5 border border-slate-900 text-center font-mono">1</td>
              <td className="p-1.5 border border-slate-900 text-right font-mono">{formatCurrency(10000)}</td>
              <td className="p-1.5 border border-slate-900 text-right font-mono text-slate-700">{formatCurrency(11500)}</td>
            </tr>

            {/* Spacer row */}
            <tr className="h-3 bg-white"><td colSpan={6} className="border border-slate-900"></td></tr>

            {/* Component 2 */}
            <tr className="bg-slate-50 font-bold border-t-2 border-slate-900">
              <td className="p-2 border border-slate-900 font-mono text-blue-700">J00043 (C00002)</td>
              <td className="p-2 border border-slate-900 text-slate-900">Piston Head Assembly</td>
              <td className="p-2 border border-slate-900 italic text-slate-600 font-normal">S/N: PST-8812 • DN: DN-99482</td>
              <td className="p-2 border border-slate-900 text-center font-mono">1</td>
              <td className="p-2 border border-slate-900 text-right font-mono text-slate-400">-</td>
              <td className="p-2 border border-slate-900 text-right font-mono font-bold text-slate-900">{formatCurrency(5175)}</td>
            </tr>
            <tr>
              <td className="p-1.5 border border-slate-900 font-mono text-slate-400 text-[10px] text-center">-</td>
              <td className="p-1.5 border border-slate-900 text-slate-500 italic text-[11px]">Sub-procedure</td>
              <td className="p-1.5 border border-slate-900 font-medium">Re-machine Seal Grooves & Fit Polyurethane Seals</td>
              <td className="p-1.5 border border-slate-900 text-center font-mono">1</td>
              <td className="p-1.5 border border-slate-900 text-right font-mono">{formatCurrency(4500)}</td>
              <td className="p-1.5 border border-slate-900 text-right font-mono text-slate-700">{formatCurrency(5175)}</td>
            </tr>
          </tbody>
        </table>

        {/* NOTES TABLE */}
        <table className="w-full border-collapse border border-slate-900 text-[10px] mt-3 font-sans">
          <tbody>
            <tr>
              <td className="p-1 font-bold bg-slate-100 border-r border-slate-900 w-12">NOTE</td>
              <td className="p-1 font-semibold border-r border-slate-900 w-48">EST TIME: INSPECTION</td>
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

        {/* SUMMARY BANNER */}
        <div className="border border-slate-900 bg-amber-400 p-2 flex flex-wrap items-center justify-between text-slate-900 font-extrabold text-xs mt-3 shadow-xs">
          <span>PQ No: PQ-88301</span>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span>Excl VAT: <strong className="font-mono text-slate-900">{formatCurrency(17000)}</strong></span>
            <span>VAT (15%): <strong className="font-mono text-slate-900">{formatCurrency(2550)}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="uppercase tracking-wider text-xs">Total (Incl 15% VAT):</span>
            <span className="font-mono text-base font-black text-slate-950">{formatCurrency(19550)}</span>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t border-slate-300 pt-2 flex items-center justify-between text-[9px] font-bold mt-4">
        <span className="text-red-700 uppercase tracking-tight">
          THIS DOCUMENT IS THE SOLE PROPERTY OF {format.companyName || "Metalogik Engineering Services"} PTY LTD
        </span>
        <span className="text-slate-600">1 OF 1</span>
      </div>
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
