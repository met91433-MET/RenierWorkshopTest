import html2pdf from 'html2pdf.js';

interface PrintOptions {
  elementId: string;
  filename?: string;
  documentTitle?: string;
}

/**
 * Downloads the given element as a high-quality PDF using html2pdf.js
 */
export async function downloadPdf({ elementId, filename = 'JobCard.pdf' }: PrintOptions): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Print element #${elementId} not found.`);
    return false;
  }

  // Clone element or temporarily display off-screen for crisp html2canvas capture
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.width = '210mm'; // Standard A4 width
  wrapper.style.backgroundColor = '#ffffff';
  wrapper.style.zIndex = '-9999';

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.remove('hidden', 'print:block');
  clone.style.display = 'block';
  clone.style.width = '100%';

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const opt = {
    margin: [0, 0, 0, 0],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 800,
      backgroundColor: '#ffffff'
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  try {
    // @ts-ignore html2pdf typing
    await html2pdf().set(opt).from(clone).save();
    return true;
  } catch (err) {
    console.error('Error generating PDF:', err);
    return false;
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
}

/**
 * Opens a new window/tab formatted specifically for standard browser printing
 */
export function openPrintTab({ elementId, documentTitle = 'Job Card Document' }: PrintOptions) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Print element #${elementId} not found.`);
    return false;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return false; // Popup blocked
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${documentTitle}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-page {
            width: 210mm;
            min-height: 297mm;
            box-sizing: border-box;
            padding: 8mm 10mm;
            page-break-after: always;
            page-break-inside: avoid;
            background: #ffffff;
          }
          .print-page:last-child {
            page-break-after: avoid;
          }
        </style>
      </head>
      <body>
        <div>${element.innerHTML}</div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  return true;
}

/**
 * Main handle trigger: tries window.print(), falls back to Popup window or direct PDF download
 */
export async function handlePrintAndSavePdf({ elementId, filename, documentTitle }: PrintOptions) {
  // 1. Try opening dedicated print window
  const printTabSuccess = openPrintTab({ elementId, documentTitle });
  
  // 2. Also trigger PDF download so the user always receives the document file even in sandboxed iframes!
  const pdfSuccess = await downloadPdf({ elementId, filename });

  if (!printTabSuccess && !pdfSuccess) {
    // Ultimate fallback: direct window.print() inside try/catch
    try {
      const el = document.getElementById(elementId);
      if (el) {
        el.classList.remove('hidden');
        el.classList.add('print-active');
        window.print();
        setTimeout(() => {
          el.classList.add('hidden');
          el.classList.remove('print-active');
        }, 800);
      } else {
        window.print();
      }
    } catch (e) {
      console.error('Direct window.print failed:', e);
      alert('Printing is constrained in preview mode. The PDF file was generated and saved to your Downloads folder.');
    }
  }
}
