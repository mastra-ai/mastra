function spreadsheetCell(value: string): string {
  // Quoting alone does not stop spreadsheet apps from evaluating formulas.
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim());
  const formula = /^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(value);
  const controlPrefix = /^[\t\r\n]/.test(value);
  const safe = controlPrefix || (formula && !numeric) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function tableToCsv(rows: string[][]): string {
  return rows.map(row => row.map(spreadsheetCell).join(',')).join('\r\n');
}

export function downloadTableCsv(csv: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'table.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
