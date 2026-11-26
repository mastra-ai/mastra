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
      // Non-ASCII initials must be treated like ASCII ones and stay with the name.
      expect(split('И. Иванов пришёл. Затем ушёл.')).toEqual(['И. Иванов пришёл.', 'Затем ушёл.']);
      expect(split('É. Dupont est arrivé. Ensuite.')).toEqual(['É. Dupont est arrivé.', 'Ensuite.']);
      expect(split('И. И. Иванов пришёл. Затем ушёл.')).toEqual(['И. И. Иванов пришёл.', 'Затем ушёл.']);
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

    it('keeps a colon-introduced numbered list whose next item follows immediately', () => {
      expect(split('Steps: 1. Open 2. Edit')).toEqual(['Steps: 1. Open 2. Edit']);
      expect(split('Steps: 1. Open 2. Edit 3. Save the file.')).toEqual(['Steps: 1. Open 2. Edit 3. Save the file.']);
    });

    it('still ends a sentence at a colon-labelled number', () => {
      // A colon label and a colon-introduced list are only distinguishable while the list
      // continues immediately, so the rule never looks at the number itself. All of the
      // shapes below therefore split: `Result: 5. The score was 6. Done.` and the same prose
      // with `1.`/`2.`, `Result: 1. The score was 2. Done.`, are the same shape.
      expect(split('Result: 5. Next sentence.')).toEqual(['Result: 5.', 'Next sentence.']);
      expect(split('Total: 5. Another line.')).toEqual(['Total: 5.', 'Another line.']);
      expect(split('Result: 5. The score was 6. Done.')).toEqual(['Result: 5.', 'The score was 6.', 'Done.']);
      expect(split('Result: 1. The score was 2. Done.')).toEqual(['Result: 1.', 'The score was 2.', 'Done.']);
      expect(split('Steps: 1. Open the file 2. Save it.')).toEqual(['Steps: 1.', 'Open the file 2.', 'Save it.']);
      expect(split('It was built in 2020. Then it grew.')).toEqual(['It was built in 2020.', 'Then it grew.']);
    });

    it('keeps the boundary when a number appears later in the paragraph', () => {
      // The later numbers are sentence-final, not markers continuing a list opened by the
      // colon label, so the boundary after `5.` must not be suppressed by the lookahead.
      expect(split('Result: 5. Next sentence. 1. First item.')).toEqual([
        'Result: 5.',
        'Next sentence. 1. First item.',
      ]);
      expect(split('Result: 1. Next sentence. 2. Second item.')).toEqual([
        'Result: 1.',
        'Next sentence. 2. Second item.',
      ]);
    });

    it('still requires whitespace after ASCII enders', () => {
      expect(split('Hello.World')).toEqual(['Hello.World']);
    });

    it('scans long newline runs without quadratic backtracking', () => {
      // Guards the blank-line check in the boundary predicate. The previous unanchored
      // `/(?:^|\n)\s*$/` was quadratic over newline runs: this input took >8s before the
      // change and ~10ms after it, so the timeout below is the assertion.
      const text = `a${'\n'.repeat(100_000)}X zz. Next.`;
      const chunks = new SentenceTransformer({
        maxSize: 1_000_000,
        minSize: 1,
        targetSize: 1,
        overlap: 0,
      }).splitText({ text });
      expect(chunks).toEqual([`a${'\n'.repeat(100_000)}X zz.`, 'Next.']);
    }, 5000);
  });
});
