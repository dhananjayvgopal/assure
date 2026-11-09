const STANDARD_COLOR_HEX: Record<string, string> = {
  white: '#FFFFFF',
  black: '#171717',
  navy: '#1B2A4A',
  blue: '#2563EB',
  grey: '#6B7280',
  gray: '#6B7280',
  charcoal: '#374151',
  olive: '#556B2F',
  green: '#15803D',
  khaki: '#C3B091',
  beige: '#F5F5DC',
  brown: '#78350F',
  red: '#DC2626',
  burgundy: '#800020',
  pink: '#EC4899',
  yellow: '#FACC15',
  purple: '#7E22CE',
  violet: '#7C3AED',
  lavender: '#A78BFA',
  lilac: '#C4B5FD',
  orange: '#EA580C',
  rust: '#B45309',
  mustard: '#CA8A04',
  maroon: '#7F1D1D',
  teal: '#0F766E',
  turquoise: '#14B8A6',
  cyan: '#0891B2',
  aqua: '#06B6D4',
  cream: '#FFF7D6',
  ivory: '#FFFFF0',
  tan: '#D2B48C',
  camel: '#C19A6B',
  gold: '#D4A017',
  silver: '#A8A8A8',
  denim: '#3B5F8A',
  indigo: '#4338CA',
  peach: '#FDBA8C',
  coral: '#F87171',
  mint: '#6EE7B7',
  sage: '#9CAF88',
  lime: '#84CC16',
  magenta: '#DB2777',
  plum: '#6B214F',
  copper: '#B87333',
};

export const STANDARD_GARMENT_COLORS = Object.keys(STANDARD_COLOR_HEX).map((name) =>
  name.charAt(0).toUpperCase() + name.slice(1)
);

export function garmentColorHex(name: string, savedHex?: string, fallback = '#A3A3A3') {
  const normalized = name.toLowerCase().trim();
  const standard = Object.entries(STANDARD_COLOR_HEX).find(([color]) =>
    normalized === color || normalized.includes(`${color} `) || normalized.includes(` ${color}`)
  )?.[1];
  return standard || savedHex || fallback;
}
