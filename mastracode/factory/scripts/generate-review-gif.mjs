#!/usr/bin/env node
// Generates the animation the Factory review-status comment shows while a
// review runs: an ASCII-art factory with smoke puffing up from its chimneys.
// Writes one variant per GitHub theme, assets/review-status/reviewing-light.gif
// and reviewing-dark.gif, which the comment switches between with <picture>.
// Dependency-free (hand-rolled GIF89a + LZW) so the assets can be regenerated
// anywhere: `node scripts/generate-review-gif.mjs`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FONT = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  n: ['.....', '.....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
  // g and y take an eighth row so their descenders don't read as 9 and 4.
  g: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  f: ['..##.', '.#..#', '.#...', '###..', '.#...', '.#...', '.#...'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '\\': ['#....', '#....', '.#...', '..#..', '...#.', '....#', '....#'],
};

// Color slots: 0 background, 1 faded, 2 building, 3 prompt, 4 lit window,
// 5 fresh smoke, 6 drifting smoke, 7 spare. Backgrounds match GitHub's themes.
const PALETTES = {
  light: ['#ffffff', '#d0d7de', '#1f2328', '#1a7f37', '#bf8700', '#57606a', '#8c959f', '#ffffff'],
  dark: ['#0d1117', '#30363d', '#c9d1d9', '#3fb950', '#e3b341', '#8b949e', '#6e7681', '#0d1117'],
};

// Rows 0-4 stay empty for the smoke; the chimney mouths open at the top of row 6.
const ART = [
  '',
  '',
  '',
  '',
  '',
  '   ___    ___',
  '   | |    | |',
  ' __| |____| |__________ ',
  '|/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\|',
  '|  []  []  []  []  []  |',
  '|__[]__[]__[]__[]__[]__|',
  '',
  '',
];
const CHIMNEYS = [5, 12];
const SCALE = 3;
const CELL_W = 6;
const CELL_H = 10;
const CAPTION = 'mastra factory reviewing';
// One blank column on each side of the 24-column art and caption.
const COLS = 26;
const ROWS = ART.length;
const WIDTH = COLS * CELL_W * SCALE;
const HEIGHT = ROWS * CELL_H * SCALE;
// One full puff cycle. Every periodic part below divides it, so the last frame
// flows straight back into the first.
const FRAMES = 24;
const PUFFS_PER_CHIMNEY = 4;
const DELAY_CS = 9;

function frame(index) {
  const pixels = new Uint8Array(WIDTH * HEIGHT);
  // Draws a glyph with its top-left corner at an unscaled pixel position, so
  // smoke can move smoothly between character cells.
  const glyph = (char, left, top, color) => {
    const rows = FONT[char];
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < 5; x++) {
        if (rows[y][x] !== '#') continue;
        const px = (left + x) * SCALE;
        const py = (top + y) * SCALE;
        if (px < 0 || py < 0 || px + SCALE > WIDTH || py + SCALE > HEIGHT) continue;
        for (let dy = 0; dy < SCALE; dy++) pixels.fill(color, (py + dy) * WIDTH + px, (py + dy) * WIDTH + px + SCALE);
      }
    }
  };
  const text = (line, col, row, color, top = 2) => {
    [...line].forEach((char, offset) => glyph(char, (col + offset) * CELL_W, row * CELL_H + top, color(char, offset)));
  };

  // Smoke: each chimney sends up evenly spaced puffs that grow, drift with the
  // wind and fade as they rise. The second chimney runs half a puff behind.
  CHIMNEYS.forEach((col, chimney) => {
    for (let puff = 0; puff < PUFFS_PER_CHIMNEY; puff++) {
      const phase =
        (index + (puff * FRAMES) / PUFFS_PER_CHIMNEY + (chimney * FRAMES) / (2 * PUFFS_PER_CHIMNEY)) % FRAMES;
      const age = phase / FRAMES;
      const color = age < 0.5 ? 5 : age < 0.8 ? 6 : 1;
      const left = col * CELL_W + Math.round(age * 10 + Math.sin(age * Math.PI * 3));
      const top = 50 - Math.round(age * 58);
      if (age < 0.55) glyph(age < 0.12 ? '.' : age < 0.3 ? 'o' : 'O', left, top, color);
      else {
        // A full-grown puff breaks up into a little cloud of bubbles.
        const spread = Math.round((age - 0.55) * 8);
        glyph('o', left - 3 - spread, top + 2, color);
        glyph('o', left + 3 + spread, top + 2, color);
        glyph('o', left, top - 3, color);
      }
    }
  });

  // The building, with a few windows dimming and relighting as the shift runs.
  let windowCell = 0;
  ART.forEach((line, row) =>
    text(line, 1, row, char => {
      if (char !== '[' && char !== ']') return 2;
      const pane = Math.floor(windowCell++ / 2);
      return (pane * 3 + Math.floor(index / 6)) % 4 === 0 ? 1 : 4;
    }),
  );

  // The name in the prompt green; raised a pixel so descenders fit the cell.
  text(CAPTION, 1, ROWS - 1, (_char, offset) => (offset < 'mastra factory'.length ? 3 : 2), 1);
  return pixels;
}

function lzw(pixels, minCodeSize) {
  const bytes = [];
  let bitBuffer = 0;
  let bitCount = 0;
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let table = new Map();
  const emit = code => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bytes.push(bitBuffer & 0xff);
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
  };
  emit(clear);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const key = (prefix << 8) | pixels[i];
    const found = table.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      table = new Map();
      codeSize = minCodeSize + 1;
      next = eoi + 1;
    } else {
      if (next >= 1 << codeSize) codeSize++;
      table.set(key, next++);
    }
    prefix = pixels[i];
  }
  emit(prefix);
  emit(eoi);
  if (bitCount > 0) bytes.push(bitBuffer & 0xff);
  return bytes;
}

function gif(palette) {
  const out = [];
  const u16 = value => out.push(value & 0xff, value >> 8);
  out.push(...Buffer.from('GIF89a'));
  u16(WIDTH);
  u16(HEIGHT);
  out.push(0b10000010, 0, 0); // global color table, 8 entries
  for (const hex of palette) out.push(...Buffer.from(hex.slice(1), 'hex'));
  out.push(0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0); // loop forever
  for (let index = 0; index < FRAMES; index++) {
    out.push(0x21, 0xf9, 4, 0b00000100, DELAY_CS, 0, 0, 0); // graphic control: keep frame, delay
    out.push(0x2c);
    u16(0);
    u16(0);
    u16(WIDTH);
    u16(HEIGHT);
    out.push(0);
    const data = lzw(frame(index), 3);
    out.push(3);
    for (let offset = 0; offset < data.length; offset += 255) {
      const block = data.slice(offset, offset + 255);
      out.push(block.length, ...block);
    }
    out.push(0);
  }
  out.push(0x3b);
  return Buffer.from(out);
}

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'review-status');
mkdirSync(assets, { recursive: true });
for (const [theme, palette] of Object.entries(PALETTES)) {
  const target = join(assets, `reviewing-${theme}.gif`);
  const data = gif(palette);
  writeFileSync(target, data);
  console.log(`wrote ${target} (${data.length} bytes, ${WIDTH}x${HEIGHT}, ${FRAMES} frames)`);
}
