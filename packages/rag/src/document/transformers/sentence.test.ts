import { describe, expect, it } from 'vitest';
import { SentenceTransformer } from './sentence';

const A = 'Aaaaaaaaaaaaa.';
const B = 'Bbbbbbbbbbbbb.';
const C = 'Ccccccccccccccccccccccccc.';

describe('SentenceTransformer overlap', () => {
  const make = (maxSize: number, overlap: number) => new SentenceTransformer({ maxSize, minSize: 1, overlap });

  it('does not emit a chunk made only of carried overlap', () => {
    expect(make(30, 15).splitText({ text: `${A} ${B}` })).toEqual([`${A} ${B}`]);
  });

  it('trims overlap so chunks never exceed maxSize', () => {
    const chunks = make(30, 15).splitText({ text: `${A} ${B} ${C}` });
    expect(chunks).toEqual([`${A} ${B}`, C]);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(30);
  });

  it('keeps overlap when it fits', () => {
    const chunks = make(20, 10).splitText({ text: 'One. Two. Three. Four. Five. Six. Seven.' });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      const prevLast = chunks[i - 1]!.split(' ').at(-1)!;
      expect(chunks[i]!.startsWith(prevLast)).toBe(true);
    }
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(20);
  });

  it('respects maxSize and never duplicates overlap across many inputs', () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (const [maxSize, overlap] of [
      [30, 15],
      [50, 20],
      [80, 40],
    ] as const) {
      for (let run = 0; run < 20; run++) {
        const sentences = Array.from(
          { length: 8 },
          (_, i) => 'W'.repeat(1 + Math.floor(rand() * (maxSize - 3))) + String.fromCharCode(97 + i) + '.',
        );
        const chunks = make(maxSize, overlap).splitText({ text: sentences.join(' ') });
        for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(maxSize);
        for (let i = 1; i < chunks.length; i++) expect(chunks[i - 1]!.endsWith(chunks[i]!)).toBe(false);
        // every sentence appears in output
        for (const s of sentences) expect(chunks.some(c => c.includes(s))).toBe(true);
      }
    }
  });
});
