/** Build a compact, readable mark from the shop's configured name. */
export function storeBrandMark(storeName: string): string {
  const words = storeName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'POS';

  // Preserve a short leading shop acronym when a trade name includes one.
  if (words[0].length <= 3) return words[0].toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join('').toUpperCase();
}
