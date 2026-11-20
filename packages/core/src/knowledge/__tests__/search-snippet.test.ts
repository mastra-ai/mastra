import { knowledgeSearchWords } from '@internal/core/knowledge-compat';
import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_SNIPPET_MAX_CHARS, knowledgeBodySnippet, knowledgeSearchQuery } from '../search-snippet';

const filler = (words: number, word = 'lorem') => Array.from({ length: words }, () => word).join(' ');
const text = (snippet: string | undefined) => snippet!.replace(/^…|…$/g, '');

describe('knowledgeBodySnippet', () => {
  it('returns the text around a word that only the body contains', () => {
    const body = `${filler(80)} Refunds over $500 need a manager's approval. ${filler(80)}`;
    const snippet = knowledgeBodySnippet(body, 'approval');
    expect(snippet).toContain("manager's approval");
    expect(snippet!.startsWith('…')).toBe(true);
    expect(snippet!.endsWith('…')).toBe(true);
    expect(text(snippet).length).toBeLessThanOrEqual(KNOWLEDGE_SNIPPET_MAX_CHARS);
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
    expect(text(snippet).length).toBeLessThanOrEqual(KNOWLEDGE_SNIPPET_MAX_CHARS);
    expect(noMatchMs).toBeLessThan(500);
    expect(lateMs).toBeLessThan(500);
  });

  it('samples a bounded number of occurrences per word on a body full of matches', () => {
    const body = filler(200_000, 'refund');
    const snippet = knowledgeBodySnippet(body, 'refund');
    expect(snippet).toContain('refund');
    expect(text(snippet).length).toBeLessThanOrEqual(KNOWLEDGE_SNIPPET_MAX_CHARS);
  });
});
