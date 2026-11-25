export interface AnsiSegment {
  text: string;
  bold: boolean;
  color?: string;
}

type AnsiStyle = Omit<AnsiSegment, 'text'>;

const ANSI_SGR_RE = new RegExp(String.raw`${String.fromCharCode(27)}\[([0-9;]*)m`, 'g');
const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ANSI_ANY_RE = new RegExp(String.raw`${ESC}(?:\[[0-9;?]*[A-Za-z]|\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\))`, 'g');

const BASE_COLORS = [
  'text-subtle-foreground',
  'text-badge-red-indicator',
  'text-badge-green-indicator',
  'text-badge-amber-indicator',
  'text-badge-blue-indicator',
  'text-badge-purple-indicator',
  'text-badge-cyan-indicator',
  'text-foreground',
] as const;

const BRIGHT_COLORS = ['text-muted-foreground', ...BASE_COLORS.slice(1)] as const;

function grayColor(level: number) {
  if (level < 85) return 'text-subtle-foreground';
  if (level < 170) return 'text-muted-foreground';
  return 'text-foreground';
}

function rgbColor(red: number, green: number, blue: number): string | undefined {
  if (![red, green, blue].every(value => Number.isInteger(value) && value >= 0 && value <= 255)) return undefined;
  const max = Math.max(red, green, blue);
  if (max - Math.min(red, green, blue) < 32) return grayColor(max);
  if (red >= green && red >= blue) {
    if (green > 140 && blue < 120) return 'text-badge-amber-indicator';
    if (blue > 140 && green < 140) return 'text-badge-purple-indicator';
    return 'text-badge-red-indicator';
  }
  if (green >= red && green >= blue) {
    return blue > 140 && red < 140 ? 'text-badge-cyan-indicator' : 'text-badge-green-indicator';
  }
  return 'text-badge-blue-indicator';
}

function indexedColor(code: number | undefined): string | undefined {
  if (code === undefined || !Number.isInteger(code) || code < 0 || code > 255) return undefined;
  if (code < 8) return BASE_COLORS[code];
  if (code < 16) return BRIGHT_COLORS[code - 8];
  if (code >= 232) return grayColor((code - 232) * 11);
  const offset = code - 16;
  return rgbColor(Math.floor(offset / 36) * 51, Math.floor((offset % 36) / 6) * 51, (offset % 6) * 51);
}

function applyCodes(style: AnsiStyle, codes: number[]): AnsiStyle {
  let next = style;
  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i] ?? 0;
    if (code === 0) next = { bold: false };
    else if (code === 1) next = { ...next, bold: true };
    else if (code === 22) next = { ...next, bold: false };
    else if (code === 39) next = { bold: next.bold };
    else if (code >= 30 && code <= 37) next = { ...next, color: BASE_COLORS[code - 30] };
    else if (code >= 90 && code <= 97) next = { ...next, color: BRIGHT_COLORS[code - 90] };
    else if ((code === 38 || code === 48) && codes[i + 1] === 5) {
      if (code === 38) next = { ...next, color: indexedColor(codes[i + 2]) ?? next.color };
      i += 2;
    } else if ((code === 38 || code === 48) && codes[i + 1] === 2) {
      if (code === 38) {
        next = { ...next, color: rgbColor(codes[i + 2] ?? -1, codes[i + 3] ?? -1, codes[i + 4] ?? -1) ?? next.color };
      }
      i += 4;
    }
  }
  return next;
}

export function hasAnsi(text: string): boolean {
  return text.includes(ESC);
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ANY_RE, '');
}

export function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  let style: AnsiStyle = { bold: false };
  let lastIndex = 0;
  for (const match of text.matchAll(ANSI_SGR_RE)) {
    const chunk = stripAnsi(text.slice(lastIndex, match.index));
    if (chunk) segments.push({ text: chunk, ...style });
    const codes = match[1] ? match[1].split(';').map(code => Number.parseInt(code, 10)) : [0];
    style = applyCodes(style, codes);
    lastIndex = match.index + match[0].length;
  }
  const rest = stripAnsi(text.slice(lastIndex));
  if (rest) segments.push({ text: rest, ...style });
  return segments;
}
