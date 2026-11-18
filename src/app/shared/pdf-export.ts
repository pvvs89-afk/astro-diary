// Turns a part of the page into an A4 PDF (as pictures, so Telugu / Hindi /
// Tamil / Malayalam text looks exactly like on screen). Same method as the
// customer app.s kundli page (copy of the admin panel helper). The libraries load only when a PDF is made.

export interface PdfOptions {
  /** PDF title (shown in PDF viewers). */
  title: string;
  /** Width in px the copy is laid out at before drawing. */
  width?: number;
  /** CSS selector of good places to start a new page. */
  breakAt?: string;
}

/**
 * Draws a copy of `area` (with class "pdf-print" added) and returns the PDF.
 * The copy is placed directly in <body> behind the app, because html2canvas
 * draws content inside Ionic's scrolling page as blank.
 */
export async function elementToPdf(area: HTMLElement, opts: PdfOptions): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const width = opts.width ?? 760;

  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:0;top:0;width:${width}px;z-index:-1;pointer-events:none;background:#fff;`;
  const copy = area.cloneNode(true) as HTMLElement;
  copy.classList.add('pdf-print');
  holder.appendChild(copy);
  document.body.appendChild(holder);

  try {
    await Promise.all(
      Array.from(copy.querySelectorAll('img')).map((img) =>
        img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)),
      ),
    );
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

    const scale = 2;
    const top = copy.getBoundingClientRect().top;
    const breaks = Array.from(
      copy.querySelectorAll<HTMLElement>(opts.breakAt ?? 'h3, h4, .card, .chart, .table-wrap, tr'),
    )
      .map((el) => Math.round((el.getBoundingClientRect().top - top) * scale))
      .filter((y) => y > 0)
      .sort((a, b) => a - b);

    const canvas = await html2canvas(copy, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: width,
      windowHeight: Math.max(copy.scrollHeight + 40, window.innerHeight),
    });
    if (!canvas.width || !canvas.height) throw new Error('Empty capture');

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const margin = 10;
    const pageW = 210 - margin * 2;
    const pageH = 297 - margin * 2;
    const pxPerMm = canvas.width / pageW;
    const pagePx = Math.floor(pageH * pxPerMm);

    let y = 0;
    let first = true;
    while (y < canvas.height - 2) {
      let end = Math.min(y + pagePx, canvas.height);
      if (end < canvas.height) {
        // Start the next page at a section start, never through a chart.
        const cut = breaks.filter((b) => b > y + pagePx * 0.4 && b <= end).pop();
        if (cut) end = cut;
      }
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = end - y;
      slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, pageW, (end - y) / pxPerMm);
      first = false;
      y = end;
    }
    pdf.setProperties({ title: opts.title, creator: 'Astro Diary' });
    return pdf.output('blob');
  } finally {
    holder.remove();
  }
}

/** Saves a Blob to the computer's Downloads folder. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "Ravi Kumar" -> "Ravi-Kumar" (letters in any language kept). */
export function safeFileName(name: string): string {
  return (name || 'customer').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'customer';
}
