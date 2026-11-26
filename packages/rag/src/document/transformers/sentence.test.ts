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

describe('SentenceTransformer boundaries', () => {
  // targetSize 1 makes every detected boundary its own sentence, so the output is the
  // exact segmentation the transformer produced.
  const split = (text: string, sentenceEnders?: string[]) =>
    new SentenceTransformer({
      maxSize: 512,
      minSize: 1,
      targetSize: 1,
      overlap: 0,
      ...(sentenceEnders ? { sentenceEnders } : {}),
    }).splitText({ text });

  const positiveCases: Array<{ name: string; text: string; ends?: string[]; expected: string[] }> = [
    {
      name: 'an integer year',
      text: 'It was built in 2020. Then it grew.',
      expected: ['It was built in 2020.', 'Then it grew.'],
    },
    {
      name: 'a non-year integer',
      text: 'It took 5. Next.',
      expected: ['It took 5.', 'Next.'],
    },
    {
      name: 'a number followed by a question mark',
      text: 'Do you need 5? Yes, I do.',
      expected: ['Do you need 5?', 'Yes, I do.'],
    },
    {
      name: 'an initial followed by a question mark',
      text: 'What about vitamin C? It helps.',
      expected: ['What about vitamin C?', 'It helps.'],
    },
    {
      name: 'an initial followed by an exclamation mark',
      text: 'What about vitamin C! It helps.',
      expected: ['What about vitamin C!', 'It helps.'],
    },
    {
      name: 'an accented uppercase next start',
      text: 'Le projet est fini. Été arrive bientôt.',
      expected: ['Le projet est fini.', 'Été arrive bientôt.'],
    },
    {
      name: 'a Cyrillic uppercase next start',
      text: 'Компания была основана давно. Она привлекла деньги позже.',
      expected: ['Компания была основана давно.', 'Она привлекла деньги позже.'],
    },
    {
      name: 'a configured Unicode ender followed by whitespace',
      text: 'कंपनी की स्थापना हुई थी। बाद में उसने पैसा जुटाया।',
      ends: ['।'],
      expected: ['कंपनी की स्थापना हुई थी।', 'बाद में उसने पैसा जुटाया।'],
    },
    {
      name: 'a configured Unicode ender with no whitespace',
      text: 'कंपनी की स्थापना हुई थी।बाद में उसने पैसा जुटाया।',
      ends: ['।'],
      expected: ['कंपनी की स्थापना हुई थी।', 'बाद में उसने पैसा जुटाया।'],
    },
    {
      name: 'a no-whitespace CJK boundary',
      text: '第一句话。第二句话。',
      ends: ['。'],
      expected: ['第一句话。', '第二句话。'],
    },
  ];

  it.each(positiveCases)('recognizes a boundary after $name', ({ text, ends, expected }) => {
    expect(split(text, ends)).toEqual(expected);
  });

  describe('regression controls (unchanged behaviour)', () => {
    it('does not split decimals or versions', () => {
      expect(split('Version 2.5 is current. Next.')).toEqual(['Version 2.5 is current.', 'Next.']);
    });

    it('keeps titles and initials together', () => {
      expect(split('Dr. Smith arrived. Next.')).toEqual(['Dr. Smith arrived.', 'Next.']);
      expect(split('Dr. José arrived. Next.')).toEqual(['Dr. José arrived.', 'Next.']);
    });

    it('keeps multi-character abbreviations, initials and times together', () => {
      expect(split('The U.S.A. is large. Next.')).toEqual(['The U.S.A. is large.', 'Next.']);
      expect(split('J. K. Rowling wrote. Next.')).toEqual(['J. K. Rowling wrote.', 'Next.']);
      // `a.m.` is still treated as a time abbreviation, so the sentence is not split
      // between the time and `Tomorrow` (unchanged pre-existing behaviour).
      expect(split('Meet at 3:30 a.m. Tomorrow.')).toEqual(['Meet at 3:30 a.m. Tomorrow.']);
    });

    it('keeps inline and multiline numbered lists intact', () => {
      expect(split('1. First item 2. Second item')).toEqual(['1. First item 2. Second item']);
      expect(split('1. First item\n2. Second item')).toEqual(['1. First item\n2. Second item']);
    });

    it('still requires whitespace after ASCII enders', () => {
      expect(split('Hello.World')).toEqual(['Hello.World']);
    });
  });
});
