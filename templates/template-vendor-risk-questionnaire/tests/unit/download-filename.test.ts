import { expect, it } from 'vitest';
import { downloadFilename } from '../../demo_ui/src/download-filename.ts';

it.each([
  ['attachment; filename="completed.xlsx"', 'xlsx', 'completed.xlsx'],
  ['attachment; filename=completed.docx', 'docx', 'completed.docx'],
  ["attachment; filename=backup.xlsx; filename*=UTF-8''vendor%20review.xlsx", 'xlsx', 'vendor review.xlsx'],
  ["attachment; filename*=UTF-8''bad%ZZ", 'docx', 'answered.docx'],
  ['attachment; filename="completed"', 'xlsx', 'completed.xlsx'],
  ['', 'docx', 'answered.docx'],
  ['', 'xlsx', 'answered.xlsx'],
])('downloads %s with a usable filename', (disposition, format, expected) => {
  const headers = new Headers({
    'Content-Disposition': disposition,
    'Content-Type': `application/vnd.openxmlformats-officedocument.${format === 'xlsx' ? 'spreadsheetml.sheet' : 'wordprocessingml.document'}; charset=utf-8`,
  });
  expect(downloadFilename(headers)).toBe(expected);
});
