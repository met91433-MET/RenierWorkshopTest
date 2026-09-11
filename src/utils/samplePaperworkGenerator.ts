/**
 * Utility to generate realistic synthetic document images (Delivery Notes & RFQs)
 * for testing the AI Paperwork Population OCR engine.
 */

export function generateSampleDeliveryNote(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1500;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background: off-white paper texture
  ctx.fillStyle = '#fbfbfb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle border / page edge
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Header band
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(60, 60, canvas.width - 120, 90);

  // Company Name & Document Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('PRECISION CNC ENGINEERING LTD', 90, 115);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('INDUSTRIAL MACHINING & COMPONENT SERVICES', 90, 140);

  // Document Type Banner
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(60, 170, canvas.width - 120, 50);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('CUSTOMER GOODS DELIVERY NOTE / DISPATCH ADVICE', 90, 203);

  // Header Info Box Grid
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.fillRect(60, 240, canvas.width - 120, 170);
  ctx.strokeRect(60, 240, canvas.width - 120, 170);

  // Divider lines in header box
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 240);
  ctx.lineTo(canvas.width / 2, 410);
  ctx.moveTo(60, 325);
  ctx.lineTo(canvas.width - 60, 325);
  ctx.stroke();

  // Left Column: Customer & Delivery Note
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('DELIVERY NOTE NUMBER:', 85, 275);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('DN-99481', 85, 305);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('CUSTOMER / SENDER NAME:', 85, 360);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Apex Aerospace Components Ltd', 85, 390);

  // Right Column: Customer Job Number & Date
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('CUSTOMER JOB NUMBER (CUST JOB #):', canvas.width / 2 + 30, 275);
  ctx.fillStyle = '#1d4ed8';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('CJ-2024-88A', canvas.width / 2 + 30, 305);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('DATE OF DISPATCH / RECEIVED:', canvas.width / 2 + 30, 360);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(new Date().toISOString().split('T')[0], canvas.width / 2 + 30, 390);

  // Summary / PO details bar
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(60, 430, canvas.width - 120, 50);
  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(60, 430, canvas.width - 120, 50);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('CUSTOMER PURCHASE ORDER: PO-77291', 85, 462);
  ctx.fillText('TOTAL AMOUNT OF COMPONENTS: 3 ITEMS', canvas.width - 480, 462);

  // Component Receiving Lines Table Header
  const tableTop = 510;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(60, tableTop, canvas.width - 120, 45);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('LINE #', 80, tableTop + 28);
  ctx.fillText('COMPONENT TYPE', 160, tableTop + 28);
  ctx.fillText('MODEL OF THE COMPONENT', 360, tableTop + 28);
  ctx.fillText('SERIAL / PART #', 760, tableTop + 28);
  ctx.fillText('QTY', 960, tableTop + 28);
  ctx.fillText('REMARKS / FAULT', 1030, tableTop + 28);

  // Table Rows (3 items)
  const items = [
    {
      line: '01',
      type: 'Spindle',
      model: 'HSD ES929 24000RPM ISO30',
      serial: 'SN-884912',
      qty: '1',
      remarks: 'Bearing noise, excessive runout on taper'
    },
    {
      line: '02',
      type: 'Motor',
      model: 'Siemens 1FK7060-5AF71-1AH0',
      serial: 'SN-049281',
      qty: '1',
      remarks: 'AC Servomotor - Intermittent resolver fault'
    },
    {
      line: '03',
      type: 'Pump',
      model: 'Rexroth A10VSO45 DFR1/31R-PPA12N00',
      serial: 'SN-552109',
      qty: '1',
      remarks: 'Hydraulic piston pump - low system pressure'
    }
  ];

  let currentY = tableTop + 45;
  items.forEach((item, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(60, currentY, canvas.width - 120, 95);

    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(60, currentY, canvas.width - 120, 95);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(item.line, 95, currentY + 45);

    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(item.type, 160, currentY + 45);

    // Model is highlighted
    ctx.font = 'bold 19px sans-serif';
    ctx.fillStyle = '#0369a1';
    ctx.fillText(item.model, 360, currentY + 42);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Customer Spec / Part Ref: ${item.serial}`, 360, currentY + 68);

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(item.serial, 760, currentY + 45);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(item.qty, 975, currentY + 45);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#dc2626';
    ctx.fillText(item.remarks.slice(0, 22), 1030, currentY + 45);

    currentY += 95;
  });

  // Footer / Instructions Box
  ctx.fillStyle = '#fffbeb';
  ctx.strokeStyle = '#fef08a';
  ctx.fillRect(60, currentY + 30, canvas.width - 120, 160);
  ctx.strokeRect(60, currentY + 30, canvas.width - 120, 160);

  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('SPECIAL RECEIVING & INSPECTION INSTRUCTIONS:', 85, currentY + 65);

  ctx.fillStyle = '#78350f';
  ctx.font = '16px sans-serif';
  ctx.fillText('• Please strip, inspect and submit formal quote referencing Customer Job Number CJ-2024-88A.', 85, currentY + 95);
  ctx.fillText('• All test certificates and dynamic balancing reports to be included upon return.', 85, currentY + 125);
  ctx.fillText('• Urgent turnaround requested for Line 01 (HSD ES929 spindle).', 85, currentY + 155);

  // Sign-off section
  const signY = canvas.height - 180;
  ctx.fillStyle = '#64748b';
  ctx.font = '14px sans-serif';
  ctx.fillText('Dispatched By: M. Taylor (Stores Lead)', 85, signY);
  ctx.fillText('Carrier / Vehicle: Direct Courier VAN #04', 85, signY + 30);

  ctx.fillText('Received By MES Workshop: _______________________', canvas.width / 2 + 30, signY);
  ctx.fillText('Date & Time: _______________________', canvas.width / 2 + 30, signY + 30);

  // Official Stamp Graphic
  ctx.save();
  ctx.translate(canvas.width - 240, canvas.height - 230);
  ctx.rotate(-0.15);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 180, 70);
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('GOODS DISPATCHED', 10, 28);
  ctx.font = 'bold 14px monospace';
  ctx.fillText('VERIFIED & SIGNED', 15, 52);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.88);
}

export function generateSampleRFQ(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1500;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.strokeRect(25, 25, canvas.width - 50, canvas.height - 50);

  // Header band (Deep Cyan / Navy)
  ctx.fillStyle = '#0e7490';
  ctx.fillRect(60, 60, canvas.width - 120, 90);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('QUANTUM ADVANCED MANUFACTURING CORP', 90, 115);

  ctx.fillStyle = '#cffafe';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PROCUREMENT & MAINTENANCE ENGINEERING DIVISION', 90, 140);

  // RFQ Title Banner
  ctx.fillStyle = '#0891b2';
  ctx.fillRect(60, 165, canvas.width - 120, 50);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('REQUEST FOR QUOTATION (RFQ) / REPAIR EVALUATION DISPATCH', 90, 198);

  // Info Box
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 235, canvas.width - 120, 170);

  // Left
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('DELIVERY NOTE / RFQ REF NUMBER:', 85, 270);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('RFQ-40892-DN', 85, 300);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('CLIENT / SENDER:', 85, 355);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Quantum Manufacturing Corp', 85, 385);

  // Right
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('CUSTOMER JOB NUMBER (CUST JOB #):', canvas.width / 2 + 30, 270);
  ctx.fillStyle = '#0e7490';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('WO-55120-QMC', canvas.width / 2 + 30, 300);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('DATE ISSUED:', canvas.width / 2 + 30, 355);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(new Date().toISOString().split('T')[0], canvas.width / 2 + 30, 385);

  // Subheader
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(60, 425, canvas.width - 120, 50);
  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(60, 425, canvas.width - 120, 50);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('REQUISITION / PO REF: PR-88201', 85, 457);
  ctx.fillText('AMOUNT OF COMPONENTS: 2 RECEIVING LINES', canvas.width - 500, 457);

  // Table
  const tableTop = 500;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(60, tableTop, canvas.width - 120, 45);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('LINE #', 80, tableTop + 28);
  ctx.fillText('COMPONENT TYPE', 160, tableTop + 28);
  ctx.fillText('MODEL OF THE COMPONENT', 360, tableTop + 28);
  ctx.fillText('SERIAL / PART #', 760, tableTop + 28);
  ctx.fillText('QTY', 960, tableTop + 28);
  ctx.fillText('TARGET SCOPE', 1030, tableTop + 28);

  const items = [
    {
      line: '01',
      type: 'Spindle',
      model: 'Fischer MFW-1224/24 High Speed',
      serial: 'F-990218',
      qty: '1',
      scope: 'Complete mechanical strip & overhaul'
    },
    {
      line: '02',
      type: 'Pump',
      model: 'Vickers PVB10-RS-31-CC-11',
      serial: 'VK-33411',
      qty: '1',
      scope: 'Seal kit replacement & pressure test'
    }
  ];

  let currentY = tableTop + 45;
  items.forEach((item, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f0fdf4';
    ctx.fillRect(60, currentY, canvas.width - 120, 95);

    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(60, currentY, canvas.width - 120, 95);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(item.line, 95, currentY + 45);

    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(item.type, 160, currentY + 45);

    ctx.font = 'bold 19px sans-serif';
    ctx.fillStyle = '#0f766e';
    ctx.fillText(item.model, 360, currentY + 42);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Part Identification: ${item.serial}`, 360, currentY + 68);

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(item.serial, 760, currentY + 45);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(item.qty, 975, currentY + 45);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#15803d';
    ctx.fillText(item.scope.slice(0, 22), 1030, currentY + 45);

    currentY += 95;
  });

  // Stamp
  ctx.save();
  ctx.translate(canvas.width - 240, canvas.height - 230);
  ctx.rotate(-0.12);
  ctx.strokeStyle = '#0e7490';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 190, 70);
  ctx.fillStyle = '#0e7490';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('APPROVED FOR QUOTE', 10, 28);
  ctx.font = 'bold 14px monospace';
  ctx.fillText('RFQ ENGINEERING', 15, 52);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.88);
}
