import { knowledgeSearchWords } from '@internal/core/knowledge-compat';
import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_SNIPPET_TOKENS, knowledgeBodyHit, knowledgeSearchQuery } from '../search-snippet';

// The excerpt's text without the `N│` line numbers (covered in search-snippet-centre.test.ts).
const knowledgeBodySnippet = (body: string | undefined, query: string) =>
  knowledgeBodyHit(body, query)?.snippet.replace(/^ *\d+│/gm, '');

const filler = (words: number, word = 'lorem') => Array.from({ length: words }, () => word).join(' ');
const text = (snippet: string | undefined) => snippet!.replace(/^…|…$/g, '');

describe('knowledgeBodySnippet', () => {
  it('returns the text around a word that only the body contains', () => {
    const body = `${filler(80)} Refunds over $500 need a manager's approval. ${filler(80)}`;
    const snippet = knowledgeBodySnippet(body, 'approval');
    expect(snippet).toContain("manager's approval");
    expect(snippet!.startsWith('…')).toBe(true);
    expect(snippet!.endsWith('…')).toBe(true);
    expect(estimateTokenCount(text(snippet))).toBeLessThanOrEqual(KNOWLEDGE_SNIPPET_TOKENS);
    expect(body).toContain(text(snippet));
  });

  it('matches case-insensitively and keeps the original casing', () => {
    expect(knowledgeBodySnippet('Escalate to the ON-CALL Engineer.', 'on-call')).toBe(
      'Escalate to the ON-CALL Engineer.',
    );
  });

  it('returns nothing when no query word is in the body', () => {
    expect(knowledgeBodySnippet('Shipping partners and couriers.', 'refund')).toBeUndefined();
    expect(knowledgeBodySnippet('', 'refund')).toBeUndefined();
    expect(knowledgeBodySnippet(undefined, 'refund')).toBeUndefined();
    expect(knowledgeBodySnippet('refund', '   ')).toBeUndefined();
  });

  it('prefers the window that holds the most distinct query words', () => {
    const body = [
      'refund mentioned alone here.',
      filler(120),
      'The refund window is 30 days and the approval comes from finance.',
      filler(120),
    ].join(' ');
    const snippet = knowledgeBodySnippet(body, 'refund approval');
    expect(snippet).toContain('refund window is 30 days and the approval');
  });

  it('breaks ties toward the earliest window', () => {
    const body = `first refund here. ${filler(150)} second refund here.`;
    expect(knowledgeBodySnippet(body, 'refund')).toContain('first refund');
  });

  it('uses the same words as keyword search, quotes removed', () => {
    expect(knowledgeSearchQuery('"refund" \u201Cpolicy\u201D `x`')).toBe('refund   policy   x');
    expect(knowledgeSearchWords(knowledgeSearchQuery('"refund" policy'))).toEqual(['refund', 'policy']);
    expect(knowledgeBodySnippet('Our refund policy is simple.', '"refund"')).toBe('Our refund policy is simple.');
  });

  it('slices the original body even when lowercasing changes its length', () => {
    // 'İ'.toLowerCase() is two code units, so lowercased offsets run ahead of the source.
    const body = `${'İ'.repeat(200)} the approval line ${filler(100)}`;
    const snippet = knowledgeBodySnippet(body, 'approval');
    expect(body).toContain(text(snippet));
    expect(snippet).toContain('the approval line');
  });

  it('maps offsets back across many length-changing characters, including after the match', () => {
    const body = `İx İy İz the needle sits here İa İb ${'İ'.repeat(50)} needle again`;
    const snippet = knowledgeBodySnippet(body, 'needle');
    expect(body).toContain(text(snippet));
    expect(snippet).toContain('the needle sits here');
    expect(knowledgeBodySnippet(`İ😀İ ${'w '.repeat(150)}needle 😀`, 'NEEDLE')).toMatch(/needle 😀$/);
  });

  it('slices the exact original text around matches anywhere in long, densely length-changing bodies', () => {
    // Seeded mix of characters whose lowercase is longer (İ), astral (😀), CJK and ASCII, across
    // many 4096-unit mapping chunks, with the matched word written in varying case.
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pieces = ['İ', 'İİİ', '😀', '漢字', 'a', ' ', 'word ', 'İ ', '\n'];
    const spellings = ['needle', 'NEEDLE', 'Needle', 'nEEDLE'];
    for (let round = 0; round < 40; round++) {
      let body = '';
      const target = Math.floor(next() * 30_000);
      while (body.length < target) body += pieces[Math.floor(next() * pieces.length)];
      const placed = spellings[round % spellings.length]!;
      const at = body.length;
      body += `${placed} `;
      while (body.length < target + 20_000) body += pieces[Math.floor(next() * pieces.length)];
      const snippet = knowledgeBodySnippet(body, 'needle');
      expect(snippet, `round ${round}`).toBeDefined();
      const window = text(snippet);
      expect(body).toContain(window);
      expect(window).toContain(placed);
      expect(body.indexOf(window)).toBeLessThanOrEqual(at);
    }
  });

  it('returns nothing for a long length-changing body without the words', () => {
    expect(knowledgeBodySnippet(`İ${'漢字'.repeat(100_000)}`, 'alpha beta')).toBeUndefined();
  });

  it('treats regex characters in query words literally', () => {
    expect(knowledgeBodySnippet('We moved the service to C++ (v2.1) last year.', 'c++ (v2.1)')).toContain('C++ (v2.1)');
    expect(knowledgeBodySnippet('version v2x1 only', 'v2.1')).toBeUndefined();
  });

  it('never splits a surrogate pair at either edge', () => {
    const emoji = '😀';
    const body = `${emoji.repeat(300)}approval${emoji.repeat(300)}`;
    const snippet = text(knowledgeBodySnippet(body, 'approval'));
    expect(snippet).toContain('approval');
    expect(snippet.charCodeAt(0)).not.toBeGreaterThanOrEqual(0xdc00);
    const last = snippet.charCodeAt(snippet.length - 1);
    expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    expect(body).toContain(snippet);
  });

  it('stays bounded on a 1 MB body with no match, and finds a match in its last 100 characters', () => {
    const big = 'x'.repeat(1_000_000);
    let started = performance.now();
    expect(knowledgeBodySnippet(big, 'alpha beta gamma delta')).toBeUndefined();
    const noMatchMs = performance.now() - started;

    const late = `${big}${'y'.repeat(50)} needle ${'z'.repeat(40)}`;
    started = performance.now();
    const snippet = knowledgeBodySnippet(late, 'needle');
    const lateMs = performance.now() - started;
    expect(snippet).toContain('needle');
    expect(estimateTokenCount(text(snippet))).toBeLessThanOrEqual(KNOWLEDGE_SNIPPET_TOKENS);
    expect(noMatchMs).toBeLessThan(500);
    expect(lateMs).toBeLessThan(500);
  });

  it('samples a bounded number of occurrences per word on a body full of matches', () => {
    const body = filler(200_000, 'refund');
    const snippet = knowledgeBodySnippet(body, 'refund');
    expect(snippet).toContain('refund');
    expect(estimateTokenCount(text(snippet))).toBeLessThanOrEqual(KNOWLEDGE_SNIPPET_TOKENS);
  });
});
