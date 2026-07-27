interface PrintOptions {
  elementId: string;
  filename?: string;
  documentTitle?: string;
}

/**
 * Opens document in a new browser window formatted for printing/saving as PDF.
 * This opens a standalone window with clean styling where the browser's native print dialog
 * opens automatically, allowing the user to select "Save as PDF" or print to their device.
 */
export function openInNewWindow({ elementId = 'printable-jobcard-doc', documentTitle = 'Job Card Document' }: PrintOptions): boolean {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`Print element #${elementId} not found.`);
    return false;
  }

  // Clone element and make visible
  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.remove('hidden');
  clone.style.display = 'block';

  // Gather head styles
  const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
  let stylesHtml = '';
  styleNodes.forEach((node) => {
    stylesHtml += node.outerHTML + '\n';
  });

  // Open new browser window
  const printWindow = window.open('', '_blank', 'width=900,height=1000,scrollbars=yes,resizable=yes');

  if (!printWindow) {
    // If popups are blocked by browser iframe policies, fallback to in-page native print
    triggerNativePrint(elementId);
    return false;
  }

  try {
    const doc = printWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${documentTitle}</title>
        ${stylesHtml}
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
          body {
            background-color: #f1f5f9;
            margin: 0;
            padding: 24px;
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            color: #0f172a;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @media print {
            body {
              background-color: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            .document-container {
              max-width: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              margin: 0 !important;
              width: 100% !important;
            }
            .page-break {
              page-break-after: always;
              break-after: page;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="max-width: 210mm; margin: 0 auto 20px auto; background: #ffffff; padding: 16px 24px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; font-family: sans-serif;">
          <div>
            <div style="font-weight: 700; font-size: 16px; color: #0f172a; margin-bottom: 2px;">${documentTitle}</div>
            <div style="font-size: 13px; color: #64748b;">Click "Save as PDF / Print" to download or save this document to your device.</div>
          </div>
          <div style="display: flex; gap: 10px;">
            <button onclick="window.print()" style="background: #059669; color: #ffffff; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(5,150,105,0.2);">
              🖨️ Save as PDF / Print
            </button>
            <button onclick="window.close()" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer;">
              Close
            </button>
          </div>
        </div>
        <div class="document-container" style="max-width: 210mm; margin: 0 auto; background: #ffffff; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
          ${clone.outerHTML}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `);
    doc.close();
    return true;
  } catch (err) {
    console.error('Error opening print window:', err);
    triggerNativePrint(elementId);
    return false;
  }
}

/**
 * Native Browser Print fallback inside current window:
 * Temporarily reveals the printable element and triggers window.print().
 */
export function triggerNativePrint(elementId: string = 'printable-jobcard-doc') {
  const el = document.getElementById(elementId);
  if (!el) {
    try {
      window.print();
    } catch (e) {
      console.error('window.print failed:', e);
    }
    return;
  }

  // Make printable container active for media print
  el.classList.remove('hidden');
  el.classList.add('print-active');

  // Allow DOM repaint before invoking window.print
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('Print error:', err);
      } finally {
        // Clean up after print dialog closes or is dismissed
        setTimeout(() => {
          el.classList.add('hidden');
          el.classList.remove('print-active');
        }, 300);
      }
    }, 80);
  });
}

/**
 * Saves document as PDF by opening in a new browser window.
 */
export async function downloadPdf(options: PrintOptions): Promise<boolean> {
  return openInNewWindow(options);
}

/**
 * Main handle trigger: downloads PDF or triggers native print without blocking the UI thread
 */
export async function handlePrintAndSavePdf(options: PrintOptions) {
  openInNewWindow(options);
}
