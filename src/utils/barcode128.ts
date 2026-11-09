/**
 * Pure TypeScript Code 128 (Subset B) Barcode Generator.
 * Converts any text/SKU/barcode string into a crisp, high-resolution SVG or Data URL
 * suitable for thermal hangtags, product labels, and checkout receipts.
 * No external dependencies required.
 */

// Code 128 Code Set B patterns (index 0 to 106).
// Each 6-digit string represents the widths of alternating bars and spaces (e.g. '212222' = bar 2, space 1, bar 2, space 2, bar 2, space 2).
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (106 is STOP pattern)
];

const START_B = 104;
const STOP = 106;

/**
 * Encodes text into Code 128B module widths
 */
export function encodeCode128(text: string): number[] {
  const clean = text.replace(/[^\x20-\x7E]/g, ''); // ASCII printable range 32-126
  if (!clean) return [];

  const charCodes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i) - 32; // ASCII 32 (' ') is index 0
    charCodes.push(code);
    checksum += code * (i + 1);
  }

  const checkDigit = checksum % 103;
  charCodes.push(checkDigit);
  charCodes.push(STOP);

  // Expand into array of 1s (bar) and 0s (space)
  const modules: number[] = [];
  // Quiet zone: 10 units
  for (let q = 0; q < 10; q++) modules.push(0);

  for (const code of charCodes) {
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) continue;
    let isBar = true;
    for (const widthChar of pattern) {
      const width = parseInt(widthChar, 10);
      for (let w = 0; w < width; w++) {
        modules.push(isBar ? 1 : 0);
      }
      isBar = !isBar;
    }
  }

  // Final quiet zone
  for (let q = 0; q < 10; q++) modules.push(0);

  return modules;
}

/**
 * Generate an SVG string representing the barcode.
 */
export function generateBarcodeSvg(
  text: string,
  options?: {
    height?: number;
    moduleWidth?: number;
    showText?: boolean;
    fontSize?: number;
    className?: string;
  }
): string {
  const height = options?.height ?? 50;
  const moduleWidth = options?.moduleWidth ?? 1.5;
  const showText = options?.showText ?? true;
  const fontSize = options?.fontSize ?? 11;
  const modules = encodeCode128(text);

  if (modules.length === 0) return '';

  const totalWidth = modules.length * moduleWidth;
  const totalHeight = showText ? height + fontSize + 4 : height;

  // Build SVG rects
  let rects = '';
  let currentRun = 0;
  let startX = 0;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 1) {
      if (currentRun === 0) startX = i * moduleWidth;
      currentRun++;
    } else {
      if (currentRun > 0) {
        rects += `<rect x="${startX.toFixed(1)}" y="0" width="${(currentRun * moduleWidth).toFixed(1)}" height="${height}" fill="#111827"/>`;
        currentRun = 0;
      }
    }
  }
  if (currentRun > 0) {
    rects += `<rect x="${startX.toFixed(1)}" y="0" width="${(currentRun * moduleWidth).toFixed(1)}" height="${height}" fill="#111827"/>`;
  }

  const textElement = showText
    ? `<text x="${(totalWidth / 2).toFixed(1)}" y="${height + fontSize + 1}" font-family="'Space Mono', monospace" font-size="${fontSize}" font-weight="600" text-anchor="middle" fill="#1f2937">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="${totalHeight}" preserveAspectRatio="xMidYMid meet" class="${options?.className ?? ''}">
    <rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff"/>
    ${rects}
    ${textElement}
  </svg>`;
}
