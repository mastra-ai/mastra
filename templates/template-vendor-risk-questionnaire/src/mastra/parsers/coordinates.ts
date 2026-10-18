export function columnIndex(c: string): number {
  let n = 0;
  for (const s of c.replace(/[0-9]/g, '')) n = n * 26 + s.charCodeAt(0) - 64;
  return n - 1;
}
export function columnName(i: number): string {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}
