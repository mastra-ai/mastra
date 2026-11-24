import { knowledgeSearchWords } from '@internal/core/knowledge-compat';
import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';
import { KnowledgeBodyLines } from '../page-body';
import { KNOWLEDGE_SNIPPET_TOKENS, knowledgeBodyHit, knowledgeSearchQuery } from '../search-snippet';

const filler = (words: number, word = 'lorem') => Array.from({ length: words }, () => word).join(' ');
// The excerpt's text: no `N│` line numbers, no optional `N│## Heading` first line, no `…` cut markers.
const excerpt = (snippet: string) =>
  snippet
    .replace(/^ *\d+│#[^\n]*\n/, '')
    .replace(/^ *\d+│/gm, '')
    .replace(/^…|…$/g, '');

describe('knowledgeBodyHit: token window', () => {
  it('names one token budget and keeps the excerpt inside it', () => {
    expect(KNOWLEDGE_SNIPPET_TOKENS).toBe(60);
    const body = `${filler(400)} the approval line ${filler(400, 'ipsum')}`;
    const hit = knowledgeBodyHit(body, 'approval')!;
    expect(estimateTokenCount(excerpt(hit.snippet))).toBeLessThanOrEqual(KNOWLEDGE_SNIPPET_TOKENS);
    expect(hit.snippet).toContain('the approval line');
  });

  it('keeps dense non-Latin text inside the token budget, where 240 characters would not', () => {
    const body = `${'漢字'.repeat(300)}needle${'語'.repeat(300)}`;
    const hit = knowledgeBodyHit(body, 'needle')!;
    expect(hit.snippet).toContain('needle');
    expect(estimateTokenCount(excerpt(hit.snippet))).toBeLessThanOrEqual(KNOWLEDGE_SNIPPET_TOKENS);
  });
});

describe('knowledgeBodyHit: heading above a far match', () => {
  const body = [
    '# Handbook',
    '',
    '## Payments',
    filler(200),
    '',
    '## Refunds',
    'Policy overview.',
    filler(200, 'ipsum'),
    'Any refund over $500 needs a manager.',
    filler(200, 'dolor'),
  ].join('\n');

  it('puts the nearest heading first, numbered the way knowledge_read numbers lines', () => {
    const hit = knowledgeBodyHit(body, 'manager')!;
    const heading = new KnowledgeBodyLines(body).lineAt(body.indexOf('## Refunds'));
    expect(heading).toBe(6);
    expect(hit.snippet).toMatch(/^ *6│## Refunds\n/);
    expect(hit.snippet).toContain('refund over $500 needs a manager');
  });

  it('adds no heading when the heading is inside the excerpt', () => {
    const near = '## Refunds\nA refund needs a manager.';
    expect(knowledgeBodyHit(near, 'manager')!.snippet).toBe('1│## Refunds\n2│A refund needs a manager.');
  });

  it('adds no heading when there is none above the match', () => {
    const hit = knowledgeBodyHit(`${filler(300)} manager ${filler(300)}`, 'manager')!;
    expect(hit.snippet.split('\n')).toHaveLength(1);
  });

  it('ignores a heading-looking line inside fenced code', () => {
    const fenced = ['## Real', 'text', '```', '## not a heading', filler(200), '```', filler(100), 'needle here'].join(
      '\n',
    );
    const hit = knowledgeBodyHit(fenced, 'needle')!;
    expect(hit.snippet.startsWith('1│## Real\n')).toBe(true);
  });

  it('cuts a very long heading line', () => {
    const long = `## ${'H'.repeat(2_000)}\n${filler(200)}\nneedle`;
    const hit = knowledgeBodyHit(long, 'needle')!;
    const first = hit.snippet.split('\n')[0]!;
    expect(first.startsWith('1│## HHH')).toBe(true);
    expect(first.length).toBeLessThan(400);
  });
});

describe('knowledgeBodyHit: line and matching lines', () => {
  it('reports the first matching line and how many lines match, with two matches far apart', () => {
    const body = [
      '# Title',
      'Intro.',
      'First refund mention.',
      filler(300),
      '## Later',
      filler(300),
      'A second refund rule, and one more refund on the same line.',
      'No match here.',
    ].join('\n');
    const hit = knowledgeBodyHit(body, 'refund')!;
    expect(hit.line).toBe(3);
    expect(hit.matchingLines).toBe(2);
  });

  it('counts a line once when several query words match it', () => {
    const hit = knowledgeBodyHit('alpha beta\ngamma\nalpha\nbeta', 'alpha beta')!;
    expect(hit.line).toBe(1);
    expect(hit.matchingLines).toBe(3);
  });

  it('counts every matching line, not only the sampled occurrences', () => {
    const body = Array.from({ length: 500 }, (_, i) => `row ${i} needle`).join('\n');
    const hit = knowledgeBodyHit(body, 'needle')!;
    expect(hit.matchingLines).toBe(500);
    expect(hit.line).toBe(1);
  });

  it('numbers lines as knowledge_read does, a final newline not adding one', () => {
    const hit = knowledgeBodyHit('a\nb\nneedle\n', 'needle')!;
    expect(hit.line).toBe(3);
    expect(hit.matchingLines).toBe(1);
  });

  it('matches as keyword search does: İ lowercases to i̇, ſ and ς do not fold to s and σ', () => {
    expect(knowledgeBodyHit('x\nFlew to İSTANBUL', 'i')).toMatchObject({ line: 2, matchingLines: 1 });
    expect(knowledgeBodyHit('Old Maſs at noon.', 'mass')).toBeUndefined();
    expect(knowledgeBodyHit('Ο κόσμος', 'κόσμοσ')).toBeUndefined();
    expect(knowledgeBodyHit('a\nΟ ΚΌΣΜΟΣ', 'κόσμος')).toMatchObject({ line: 2, matchingLines: 1 });
  });

  it('returns nothing when no word matches', () => {
    expect(knowledgeBodyHit('nothing here', 'refund')).toBeUndefined();
    expect(knowledgeBodyHit(undefined, 'refund')).toBeUndefined();
    expect(knowledgeBodyHit('refund', '  ')).toBeUndefined();
  });
});

// The reference is keyword search's own rule: lowercase the body, and a word matches where the
// lowercased body contains it. Line numbers split on `\n`, which lowercasing never changes.
describe('knowledgeBodyHit: 20,000 random bodies against the keyword-search rule', () => {
  it('agrees on whether a body matches, on the matching line it centres on and on how many lines match', () => {
    let seed = 20_261_124;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(list: T[]): T => list[Math.floor(next() * list.length)]!;
    const pieces = [
      'İ',
      'İİ',
      'ſ',
      'Σ',
      'ς',
      'σ',
      'ΚΌΣΜΟΣ',
      '😀',
      '漢字',
      'a',
      'I',
      'i',
      's',
      'S',
      'mass',
      'Mass',
      'word ',
      ' ',
      '\n',
      '\n\n',
      '## H\n',
      '```\n',
    ];
    const queries = ['i', 'mass', 's', 'σ', 'ς', 'İ', 'κόσμος', 'word', 'a i', 'ſ', '😀', 'ΣΜ'];
    let matched = 0;
    for (let round = 0; round < 20_000; round++) {
      let body = '';
      const length = Math.floor(next() * 40);
      for (let i = 0; i < length; i++) body += pick(pieces);
      const query = pick(queries);
      const words = knowledgeSearchWords(knowledgeSearchQuery(query));
      const lines = body.toLowerCase().split('\n');
      const matching = lines.flatMap((line, i) => (words.some(word => line.includes(word)) ? [i + 1] : []));
      const expectedWhole = words.some(word => body.toLowerCase().includes(word));
      const hit = knowledgeBodyHit(body, query);
      const label = `round ${round}: ${JSON.stringify({ body, query })}`;
      expect(Boolean(hit), label).toBe(expectedWhole);
      if (!hit) continue;
      matched++;
      expect(matching, label).toContain(hit.line);
      expect(
        hit.snippet.split('\n').some(row => row.replace(/^ */, '').startsWith(`${hit.line}│`)),
        label,
      ).toBe(true);
      expect(hit.matchingLines, label).toBe(matching.length);
      expect(estimateTokenCount(excerpt(hit.snippet)), label).toBeLessThanOrEqual(KNOWLEDGE_SNIPPET_TOKENS);
    }
    expect(matched).toBeGreaterThan(5_000);
  });
});
