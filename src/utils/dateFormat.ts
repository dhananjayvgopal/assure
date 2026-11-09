const indiaTimeZone = 'Asia/Kolkata';

export function formatDateDisplay(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}-${month}-${year}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: indiaTimeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('day')}-${get('month')}-${get('year')}`;
}

export function formatDateTimeDisplay(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: indiaTimeZone, hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
  return `${formatDateDisplay(date)} ${time}`;
}

export function parseDateDisplay(value: string): string | null {
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const candidate = new Date(Number(year), Number(month) - 1, Number(day));
  if (candidate.getFullYear() !== Number(year) || candidate.getMonth() !== Number(month) - 1 || candidate.getDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}
