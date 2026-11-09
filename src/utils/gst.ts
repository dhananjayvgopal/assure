/** GST helpers for the garment POS. Rates follow the apparel thresholds effective 22 Sep 2025. */
export const APPAREL_GST_THRESHOLD = 2500;

export function getGstRate(hsnCode: string | undefined, saleValuePerPiece: number, configuredRate: number): number {
  const hsn = (hsnCode || '').replace(/\D/g, '');
  const chapter = Number(hsn.slice(0, 2));
  const isApparelChapter = [61, 62].includes(chapter) || (chapter === 63 && !['63053200', '63053300', '6309'].includes(hsn));
  if (isApparelChapter) return saleValuePerPiece > APPAREL_GST_THRESHOLD ? 18 : 5;
  return configuredRate;
}

export function isValidIndianGstin(value: string): boolean {
  return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value.trim().toUpperCase());
}

export const GST_STATE_NAMES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '97': 'Other Territory', '99': 'Centre Jurisdiction',
};
