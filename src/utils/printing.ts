import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

declare global {
  interface Window {
    assurePos?: {
      printSilently: (options: { pageWidthMm: number; pageHeightMm: number }) => Promise<{ success: boolean; reason?: string }>;
      saveAsPdf: (options: { fileName: string; pageWidthMm: number; pageHeightMm: number; pageMarginMm: number }) => Promise<{ success: boolean; cancelled?: boolean; path?: string; reason?: string }>;
    };
  }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function normalizeCssColors(value: string): string {
  return value.replace(/oklch\(\s*([-+]?[\d.]+%?)\s+([-+]?[\d.]+%?)\s+([-+]?[\d.]+)(deg|rad|turn)?(?:\s*\/\s*([-+]?[\d.]+%?))?\s*\)/gi,
    (_color, lightnessText: string, chromaText: string, hueText: string, hueUnit = 'deg', alphaText?: string) => {
      const lightness = parseFloat(lightnessText) / (lightnessText.endsWith('%') ? 100 : 1);
      const chroma = parseFloat(chromaText) * (chromaText.endsWith('%') ? 0.004 : 1);
      let hue = parseFloat(hueText);
      if (hueUnit === 'rad') hue = hue * 180 / Math.PI;
      else if (hueUnit === 'turn') hue *= 360;
      const alpha = alphaText ? parseFloat(alphaText) / (alphaText.endsWith('%') ? 100 : 1) : 1;
      const radians = hue * Math.PI / 180;
      const a = chroma * Math.cos(radians);
      const b = chroma * Math.sin(radians);
      const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
      const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
      const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
      const l = lRoot ** 3;
      const m = mRoot ** 3;
      const s = sRoot ** 3;
      const channels = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
      ].map((channel) => {
        const clipped = Math.max(0, Math.min(1, channel));
        const srgb = clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
        return Math.round(srgb * 255);
      });
      return alpha < 1 ? `rgba(${channels.join(', ')}, ${Math.max(0, Math.min(1, alpha))})` : `rgb(${channels.join(', ')})`;
    });
}

/** Prints only the selected receipt/tag through the installed Windows printer driver. */
export async function printDocument(targetId: string, options: { saveAsPdf?: boolean; fileName?: string } = {}): Promise<void> {
  const target = document.getElementById(targetId);
  if (!target) {
    window.alert('The print preview could not be found. Close it and try again.');
    return;
  }

  const selectedWidth = target.getAttribute('data-paper-width') || '80mm';
  const isTagPrint = targetId === 'printable-hangtags';
  const isInvoiceA4 = targetId === 'thermal-receipt' && target.getAttribute('data-invoice-format') === 'a4';
  const printLayout = target.getAttribute('data-print-layout') || 'roll-100mm-2up';
  const isA4Layout = isTagPrint && printLayout === 'a4';
  // Thermal PDF/print pages use the physical roll width. Keep the receipt
  // content at its printable width (70 mm for 80 mm rolls) and center it.
  const pageWidthMm = isTagPrint ? (isA4Layout ? 210 : 100) : isInvoiceA4 ? 210 : selectedWidth === '58mm' ? 58 : 80;
  const targetWidthMm = isTagPrint
    ? (isA4Layout ? 200 : 100)
    : isInvoiceA4 ? 190 : selectedWidth === '58mm' ? 56 : 70;
  const originalTargetStyles = {
    width: target.style.width,
    height: target.style.height,
    maxHeight: target.style.maxHeight,
    minHeight: target.style.minHeight,
    overflow: target.style.overflow,
    flex: target.style.flex,
    alignSelf: target.style.alignSelf,
    boxSizing: target.style.boxSizing,
  };
  const enforceThermalTextStyle = !options.saveAsPdf && !isInvoiceA4 && (targetId === 'thermal-receipt' || targetId === 'printable-hangtags');
  const receiptElements = enforceThermalTextStyle
    ? [target, ...target.querySelectorAll<HTMLElement | SVGElement>('*')]
    : [];
  const originalThermalStyles = receiptElements.map((element) => ({
    element,
    fontSize: element.style.getPropertyValue('font-size'),
    fontSizePriority: element.style.getPropertyPriority('font-size'),
    fontFamily: element.style.getPropertyValue('font-family'),
    fontFamilyPriority: element.style.getPropertyPriority('font-family'),
    color: element.style.getPropertyValue('color'),
    colorPriority: element.style.getPropertyPriority('color'),
  }));
  const minimumFontSizePx = 3 * 96 / 25.4;
  receiptElements.forEach((element) => {
    element.style.setProperty('font-family', 'Arial, Helvetica, sans-serif', 'important');
    element.style.setProperty('color', '#000000', 'important');
    const computedFontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
    if (Number.isFinite(computedFontSize) && computedFontSize < minimumFontSizePx) {
      element.style.setProperty('font-size', '3mm', 'important');
    }
  });
  document.body.dataset.printTarget = targetId;
  document.documentElement.dataset.printTarget = targetId;
  if (!isTagPrint && !isInvoiceA4) {
    document.documentElement.dataset.printPaperWidth = selectedWidth === '58mm' ? '58mm' : '80mm';
  }
  if (isTagPrint) {
    document.body.dataset.printLayout = printLayout;
    document.documentElement.dataset.printLayout = printLayout;
  } else if (isInvoiceA4) {
    document.body.dataset.printLayout = 'invoice-a4';
    document.documentElement.dataset.printLayout = 'invoice-a4';
  }
  target.style.width = `${targetWidthMm}mm`;
  target.style.boxSizing = 'border-box';
  target.style.height = 'auto';
  target.style.maxHeight = 'none';
  target.style.minHeight = '0';
  target.style.overflow = 'visible';
  target.style.flex = 'none';
  target.style.alignSelf = 'flex-start';
  await nextFrame();
  await nextFrame();

  const tagLabelHeightMm = target.getAttribute('data-label-format') === '50x30mm' ? 30 : 74;
  const tagCount = target.children.length;
  const tagColumns = isA4Layout
    ? target.getAttribute('data-label-format') === '50x30mm' ? 2 : 3
    : target.getAttribute('data-label-format') === '50x30mm' ? 2 : 1;
  const tagRows = Math.ceil(tagCount / tagColumns);
  const heightMm = isInvoiceA4
    ? 297
    : isTagPrint
    ? isA4Layout
      ? 297
      : Math.max(tagLabelHeightMm + 2, tagRows * tagLabelHeightMm + Math.max(0, tagRows - 1) + 2)
    : Math.max(35, Math.ceil(target.scrollHeight * 25.4 / 96 + 2));
  const pageMarginMm = isA4Layout ? 5 : isInvoiceA4 ? 10 : 0;
  const pageRule = document.createElement('style');
  pageRule.dataset.posPrintPage = 'true';
  pageRule.textContent = `@page { size: ${pageWidthMm}mm ${heightMm}mm; margin: ${pageMarginMm}mm; }`;
  document.head.appendChild(pageRule);

  let cleanupTimer: number | undefined;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
    delete document.body.dataset.printTarget;
    delete document.documentElement.dataset.printTarget;
    delete document.documentElement.dataset.printPaperWidth;
    delete document.body.dataset.printLayout;
    delete document.documentElement.dataset.printLayout;
    Object.assign(target.style, originalTargetStyles);
    originalThermalStyles.forEach((saved) => {
      const restoreProperty = (name: string, value: string, priority: string) => {
        if (value) saved.element.style.setProperty(name, value, priority);
        else saved.element.style.removeProperty(name);
      };
      restoreProperty('font-size', saved.fontSize, saved.fontSizePriority);
      restoreProperty('font-family', saved.fontFamily, saved.fontFamilyPriority);
      restoreProperty('color', saved.color, saved.colorPriority);
    });
    pageRule.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });

  try {
    // Gift vouchers use the canvas/PDF path below so their custom-length page
    // is one page in both browser and desktop builds.
    if (options.saveAsPdf && window.assurePos?.saveAsPdf && targetId !== 'thermal-voucher') {
      const result = await window.assurePos.saveAsPdf({
        fileName: options.fileName || 'invoice.pdf',
        pageWidthMm,
        pageHeightMm: heightMm,
        pageMarginMm,
      });
      cleanup();
      if (result.success && result.path) window.alert(`PDF saved: ${result.path}`);
      else if (!result.cancelled) window.alert(result.reason || 'Could not save the PDF.');
      return;
    }
    if (options.saveAsPdf) {
      const pdfWidthMm = isInvoiceA4 ? 190 : targetWidthMm;
      const originalInline = {
        width: target.style.width,
        maxWidth: target.style.maxWidth,
        height: target.style.height,
        minHeight: target.style.minHeight,
        overflow: target.style.overflow,
      };
      const captureElements = [target, ...target.querySelectorAll<HTMLElement | SVGElement>('*')];
      const inlineSnapshots = captureElements.map((element) => ({ element, cssText: element.getAttribute('style') }));
      try {
        target.style.width = `${pdfWidthMm}mm`;
        target.style.maxWidth = 'none';
        target.style.boxSizing = 'border-box';
        target.style.height = 'auto';
        target.style.minHeight = '0';
        target.style.overflow = 'visible';
        // html2canvas cannot parse Tailwind v4's oklch() palette. Freeze the
        // receipt's resolved styles inline, then remove app stylesheets from
        // its isolated clone so unrelated palette tokens are never parsed.
        captureElements.forEach((element) => {
          const computed = window.getComputedStyle(element);
          for (let index = 0; index < computed.length; index += 1) {
            const property = computed.item(index);
            const value = normalizeCssColors(computed.getPropertyValue(property));
            if (value) element.style.setProperty(property, value);
          }
        });
        if (!isInvoiceA4) target.style.setProperty('padding', '1mm', 'important');
        await nextFrame();
        const canvas = await html2canvas(target, {
          scale: 4,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDocument) => {
            clonedDocument.querySelectorAll('style, link[rel="stylesheet"]').forEach((styleNode) => styleNode.remove());
            const clonedTarget = clonedDocument.getElementById(targetId) as HTMLElement | null;
            if (clonedTarget) {
              clonedTarget.style.setProperty('display', 'block', 'important');
              clonedTarget.style.setProperty('position', 'static', 'important');
              clonedTarget.style.setProperty('height', 'auto', 'important');
              clonedTarget.style.setProperty('max-height', 'none', 'important');
              clonedTarget.style.setProperty('min-height', '0', 'important');
              clonedTarget.style.setProperty('overflow', 'visible', 'important');
              clonedTarget.style.setProperty('flex', 'none', 'important');
              clonedTarget.style.setProperty('align-self', 'flex-start', 'important');
              clonedTarget.style.setProperty('box-sizing', 'border-box', 'important');
              clonedTarget.style.setProperty('transform', 'none', 'important');
              clonedDocument.body.appendChild(clonedTarget);
            }
            clonedDocument.querySelectorAll<HTMLElement>('[style]').forEach((styledElement) => {
              styledElement.setAttribute('style', normalizeCssColors(styledElement.getAttribute('style')!));
            });
          },
        });
        const safeName = (options.fileName || 'invoice.pdf').replace(/[<>:"/\\|?*]/g, '_').replace(/\.pdf$/i, '') + '.pdf';
        const isA4Pdf = isInvoiceA4;
        const pageWidth = isA4Pdf ? 210 : (selectedWidth === '58mm' ? 58 : 80);
        const pageHeight = isA4Pdf ? 297 : Math.max(35, canvas.height / (canvas.width / pdfWidthMm) + 2);
        const printableWidth = isA4Pdf ? 190 : pdfWidthMm;
        const printableHeight = isA4Pdf ? 277 : pageHeight - 2;
        const pxPerMm = canvas.width / pdfWidthMm;
        const imageWidth = Math.min(printableWidth, canvas.width / pxPerMm);
        const imageHeight = canvas.height / pxPerMm;
        const fit = isA4Pdf ? Math.min(1, printableWidth / imageWidth, printableHeight / imageHeight) : Math.min(1, printableWidth / imageWidth);
        const placedWidth = imageWidth * fit;
        const placedHeight = imageHeight * fit;
        const offsetX = (pageWidth - placedWidth) / 2;
        const offsetY = isA4Pdf ? (pageHeight - placedHeight) / 2 : 1;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: isA4Pdf ? 'a4' : [pageWidth, pageHeight],
          compress: true,
        });
        pdf.setProperties({ title: safeName, subject: 'POS receipt' });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', offsetX, offsetY, placedWidth, placedHeight, undefined, 'FAST');
        pdf.save(safeName);
      } finally {
        inlineSnapshots.forEach(({ element, cssText }) => {
          if (cssText === null) element.removeAttribute('style');
          else element.setAttribute('style', cssText);
        });
        Object.assign(target.style, originalInline);
      }
      cleanup();
      return;
    }
    // Tag jobs can go either to a 100 mm label printer or to A4; keep the
    // printer dialog available so staff can select the matching destination.
    if (window.assurePos?.printSilently && !isTagPrint && !options.saveAsPdf) {
      const result = await window.assurePos.printSilently({ pageWidthMm, pageHeightMm: heightMm });
      if (!result.success) window.alert(result.reason || 'Printing failed. Check the POS-80 printer and its paper settings.');
      cleanup();
      return;
    }
    // Keep the print-only layout and @page rule in place until the browser has
    // finished spooling. Cleaning immediately after window.print() can race
    // dialog-free/kiosk printing and send the unstyled page to the printer.
    cleanupTimer = window.setTimeout(cleanup, 60000);
    window.print();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'The POS could not print this document.');
    cleanup();
  }
}
