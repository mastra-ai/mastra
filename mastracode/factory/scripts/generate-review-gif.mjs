#!/usr/bin/env node
// Generates assets/review-status/reviewing.gif: the animated ASCII-terminal
// spinner the Factory review-status comment shows while a review runs.
// Dependency-free (hand-rolled GIF89a + LZW) so the asset can be regenerated
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
  g: ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '\\': ['#....', '#....', '.#...', '..#..', '...#.', '....#', '....#'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
};

// GitHub-dark terminal palette, legible on both light and dark themes.
const PALETTE = [
  [0x0d, 0x11, 0x17], // 0 background
  [0x48, 0x4f, 0x58], // 1 dim
  [0xe6, 0xed, 0xf3], // 2 text
  [0x3f, 0xb9, 0x50], // 3 green
];
const SCALE = 3;
const CELL_W = 6;
const CELL_H = 10;
const COLS = 21;
const ROWS = 4;
const WIDTH = COLS * CELL_W * SCALE;
const HEIGHT = ROWS * CELL_H * SCALE;
const BAR = 12;
const SPINNER = ['|', '/', '-', '\\'];
const FRAMES = 2 * (BAR - 3);

function frame(index) {
  const pixels = new Uint8Array(WIDTH * HEIGHT);
  const draw = (text, col, row, colors) => {
    [...text].forEach((char, offset) => {
      const glyph = FONT[char];
      const color = typeof colors === 'number' ? colors : colors[offset];
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 5; x++) {
          if (glyph[y][x] !== '#') continue;
          const px = ((col + offset) * CELL_W + x) * SCALE;
          const py = (row * CELL_H + 2 + y) * SCALE;
          for (let dy = 0; dy < SCALE; dy++) pixels.fill(color, (py + dy) * WIDTH + px, (py + dy) * WIDTH + px + SCALE);
        }
      }
    });
  };
  const dots = '.'.repeat(Math.floor(index / 3) % 4).padEnd(3, ' ');
  draw('$', 1, 1, 3);
  draw(`reviewing${dots}`, 3, 1, 2);
  // A three-cell comet bouncing across the bar, head pointing the way it moves.
  const forward = index < BAR - 3;
  const start = forward ? index : 2 * (BAR - 3) - index;
  let bar = '';
  const colors = [1];
  for (let cell = 0; cell < BAR; cell++) {
    const lit = cell >= start && cell < start + 3;
    const head = forward ? cell === start + 2 : cell === start;
    bar += lit ? (head ? (forward ? '>' : '<') : '=') : '.';
    colors.push(lit ? 3 : 1);
  }
  colors.push(1, 1, 3);
  draw(`[${bar}] ${SPINNER[index % SPINNER.length]}`, 1, 2, colors);
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

function gif() {
  const out = [];
  const u16 = value => out.push(value & 0xff, value >> 8);
  out.push(...Buffer.from('GIF89a'));
  u16(WIDTH);
  u16(HEIGHT);
  out.push(0b10000001, 0, 0); // global color table, 4 entries
  for (const color of PALETTE) out.push(...color);
  out.push(0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0); // loop forever
  for (let index = 0; index < FRAMES; index++) {
    out.push(0x21, 0xf9, 4, 0b00000100, 0, 0, 0, 0); // graphic control: delay below
    out[out.length - 4] = 9; // 90 ms per frame
    out.push(0x2c);
    u16(0);
    u16(0);
    u16(WIDTH);
    u16(HEIGHT);
    out.push(0);
    const data = lzw(frame(index), 2);
    out.push(2);
    for (let offset = 0; offset < data.length; offset += 255) {
      const block = data.slice(offset, offset + 255);
      out.push(block.length, ...block);
    }
    out.push(0);
  }
  out.push(0x3b);
  return Buffer.from(out);
}

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'review-status', 'reviewing.gif');
mkdirSync(dirname(target), { recursive: true });
const data = gif();
writeFileSync(target, data);
console.log(`wrote ${target} (${data.length} bytes, ${WIDTH}x${HEIGHT}, ${FRAMES} frames)`);
