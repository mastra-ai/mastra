import { describe, expect, it } from 'vitest';
import { knowledgeBodyHit } from '../search-snippet';

const filler = (words: number, word = 'lorem') => Array.from({ length: words }, () => word).join(' ');

/** Each snippet line as `{ n, text }`, failing when one is not numbered like knowledge_read. */
function parse(snippet: string) {
  return snippet.split('\n').map(line => {
    const match = /^\s*(\d+)│(.*)$/s.exec(line);
    expect(match, `unnumbered snippet line: ${JSON.stringify(line)}`).not.toBeNull();
    return { n: Number(match![1]), text: match![2]! };
  });
}

describe('knowledgeBodyHit: line is where the excerpt is centred', () => {
  // `alpha` alone on line 1, then `alpha beta gamma` together far below: the dense window wins.
  const lines = ['alpha opens the page', ...Array.from({ length: 30 }, (_, i) => `${filler(12)} ${i}`)];
  lines.push('the dense part: alpha beta gamma are together here', 'closing line');
  const body = lines.join('\n');

  it('reports the line of the match the window was built around, not the first match', () => {
    const hit = knowledgeBodyHit(body, 'alpha beta gamma')!;
    expect(hit.snippet).toContain('alpha beta gamma are together');
    expect(hit.line).toBe(32);
    expect(hit.matchingLines).toBe(2);
  });

  it('keeps line on the match itself when the window is built around the first match', () => {
    const hit = knowledgeBodyHit(body, 'opens')!;
    expect(hit.line).toBe(1);
  });

  it('names a line whose numbered text is in the excerpt', () => {
    const hit = knowledgeBodyHit(body, 'alpha beta gamma')!;
    const shown = parse(hit.snippet);
    const centre = shown.find(l => l.n === hit.line);
    expect(centre?.text).toContain('alpha');
  });
});

describe('knowledgeBodyHit: every excerpt line is numbered like knowledge_read', () => {
  it('numbers each line of a multi-line excerpt with its real line number', () => {
    const body = ['one', 'two', 'three needle', 'four', 'five'].join('\n');
    const hit = knowledgeBodyHit(body, 'needle')!;
    expect(hit.snippet).toBe('1│one\n2│two\n3│three needle\n4│four\n5│five');
  });

  it('numbers a one-line body', () => {
    expect(knowledgeBodyHit('Our refund policy is simple.', 'refund')!.snippet).toBe('1│Our refund policy is simple.');
  });

  it('pads numbers to the widest one, as knowledge_read does', () => {
    const body = [...Array.from({ length: 8 }, (_, i) => `row ${i}`), 'needle', 'after'].join('\n');
    const shown = knowledgeBodyHit(body, 'needle')!.snippet.split('\n');
    expect(shown[0]).toMatch(/^ \d│/);
    expect(shown.at(-1)).toBe('10│after');
    expect(shown.at(-2)).toBe(' 9│needle');
  });

  it('keeps … on partial first and last lines and still numbers them', () => {
    const body = `intro\n${filler(200)} needle ${filler(200, 'ipsum')}\noutro`;
    const hit = knowledgeBodyHit(body, 'needle')!;
    const shown = parse(hit.snippet);
    expect(shown.every(l => l.n === 2)).toBe(true);
    expect(shown[0]!.text.startsWith('…')).toBe(true);
    expect(shown.at(-1)!.text.endsWith('…')).toBe(true);
    expect(hit.line).toBe(2);
  });

  it('numbers the heading and the excerpt in one column width', () => {
    const body = ['## Section', ...Array.from({ length: 12 }, () => filler(14)), 'the needle line', 'last'].join('\n');
    const hit = knowledgeBodyHit(body, 'needle')!;
    const shown = parse(hit.snippet);
    expect(shown[0]!.text).toBe('## Section');
    expect(shown[0]!.n).toBe(1);
    const widths = new Set(hit.snippet.split('\n').map(l => l.indexOf('│')));
    expect(widths.size).toBe(1);
    const rest = shown.slice(1);
    rest.forEach((l, i) => expect(l.n).toBe(rest[0]!.n + i));
    expect(rest.find(l => l.n === hit.line)?.text).toContain('needle');
  });
});
