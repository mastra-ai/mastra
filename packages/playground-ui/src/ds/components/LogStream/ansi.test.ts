import { describe, expect, it } from 'vitest';
import { hasAnsi, parseAnsi, stripAnsi } from './ansi';

const ESC = String.fromCharCode(27);

describe('parseAnsi', () => {
  it('turns color and bold codes into styled segments without the escape codes', () => {
    expect(parseAnsi(`${ESC}[1;31merror${ESC}[0m plain ${ESC}[32mok`)).toEqual([
      { text: 'error', bold: true, color: 'text-badge-red-indicator' },
      { text: ' plain ', bold: false },
      { text: 'ok', bold: false, color: 'text-badge-green-indicator' },
    ]);
  });

  it('maps 256-color and truecolor codes to the closest theme color', () => {
    expect(parseAnsi(`${ESC}[38;5;33mblue`)[0]?.color).toBe('text-badge-blue-indicator');
    expect(parseAnsi(`${ESC}[38;2;250;200;40mamber`)[0]?.color).toBe('text-badge-amber-indicator');
    expect(parseAnsi(`${ESC}[38;5;244mgray`)[0]?.color).toBe('text-muted-foreground');
  });

  it('drops cursor and erase codes it cannot show', () => {
    expect(stripAnsi(`${ESC}[2K${ESC}[1Gdone`)).toBe('done');
    expect(parseAnsi(`${ESC}[2Kdone`)).toEqual([{ text: 'done', bold: false }]);
  });

  it('only reports ANSI when an escape character is present', () => {
    expect(hasAnsi('plain')).toBe(false);
    expect(hasAnsi(`${ESC}[0m`)).toBe(true);
  });
});
