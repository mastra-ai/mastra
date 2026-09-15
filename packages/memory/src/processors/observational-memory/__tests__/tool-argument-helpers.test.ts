import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';

import { formatToolArgumentsForObserver } from '../tool-argument-helpers';

describe('formatToolArgumentsForObserver', () => {
  it('preserves small sibling fields before previewing a large early string', () => {
    const content = 'export const value = 1;\n'.repeat(2_000);
    const formatted = formatToolArgumentsForObserver({
      content,
      path: 'src/generated.ts',
      overwrite: true,
    });

    expect(formatted).toContain(`content: <string, ${content.length} characters; preview size-limited>`);
    expect(formatted).toContain('path: "src/generated.ts"');
    expect(formatted).toContain('overwrite: true');
    expect(formatted).toContain('Large string previews (size-limited):');
    expect(formatted.indexOf('path: "src/generated.ts"')).toBeLessThan(
      formatted.indexOf('Large string previews (size-limited):'),
    );
    expect(formatted).toContain('characters omitted]');
    expect(formatted).not.toContain(content);
  });

  it('renders nested objects and arrays breadth-first in a custom path format', () => {
    const formatted = formatToolArgumentsForObserver({
      request: {
        edits: [
          { old: 'before', replacement: 'after' },
          { old: 'left', replacement: 'right' },
        ],
        path: 'src/file.ts',
      },
      dryRun: false,
    });

    expect(formatted).toContain('request: <object>');
    expect(formatted).toContain('dryRun: false');
    expect(formatted).toContain('request.edits: <array, 2 items>');
    expect(formatted).toContain('request.path: "src/file.ts"');
    expect(formatted).toContain('request.edits[0].old: "before"');
    expect(formatted).toContain('request.edits[1].replacement: "right"');
    expect(formatted).not.toContain('{\n');
    expect(formatted).not.toContain('"request"');
  });

  it('marks omitted container entries and bounded aggregate output', () => {
    const value = {
      items: Array.from({ length: 30 }, (_, index) => `item-${index}`),
      payload: 'x'.repeat(20_000),
      trailing: 'still-visible',
    };
    const structurallyBounded = formatToolArgumentsForObserver(value);
    const sizeBounded = formatToolArgumentsForObserver(value, { maxTokens: 100 });

    expect(structurallyBounded).toContain('items: ... [additional entries omitted]');
    expect(sizeBounded).toContain('trailing: "still-visible"');
    expect(sizeBounded).toContain('fields omitted by size limit');
    expect(estimateTokenCount(sizeBounded)).toBeLessThanOrEqual(100);
  });

  it('handles cycles and depth limits without throwing', () => {
    const cyclic: Record<string, unknown> = { label: 'root' };
    cyclic.self = cyclic;
    let nested: Record<string, unknown> = cyclic;
    for (let index = 0; index < 8; index++) {
      const child: Record<string, unknown> = { level: index };
      nested.child = child;
      nested = child;
    }

    const formatted = formatToolArgumentsForObserver(cyclic);

    expect(formatted).toContain('self: [circular]');
    expect(formatted).toContain('[max depth reached]');
  });

  it('distinguishes shared references from cycles', () => {
    const shared = { value: 'visible-twice' };
    const formatted = formatToolArgumentsForObserver({ left: shared, right: shared });

    expect(formatted).toContain('left.value: "visible-twice"');
    expect(formatted).toContain('right.value: "visible-twice"');
    expect(formatted).not.toContain('[circular]');
  });

  it('represents sparse and unreadable entries without throwing', () => {
    const sparse = Array(3);
    sparse[2] = 'tail';
    const unreadable: Record<string, unknown> = {};
    Object.defineProperty(unreadable, 'broken', {
      enumerable: true,
      get() {
        throw new Error('no access');
      },
    });
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('cannot enumerate');
        },
      },
    );

    const formatted = formatToolArgumentsForObserver({ sparse, unreadable, hostile });

    expect(formatted).toContain('sparse[0]: [hole]');
    expect(formatted).toContain('sparse[1]: [hole]');
    expect(formatted).toContain('sparse[2]: "tail"');
    expect(formatted).toContain('unreadable.broken: [unreadable]');
    expect(formatted).toContain('hostile: [unavailable container]');
  });

  it('selects concise later fields instead of prefix-truncating the outline', () => {
    const formatted = formatToolArgumentsForObserver(
      { first: 'x'.repeat(1_000), later: 'small', finalFlag: true },
      { maxCharacters: 100 },
    );

    expect(formatted.length).toBeLessThanOrEqual(100);
    expect(formatted).toContain('first: <string, 1000 characters; preview size-limited>');
    expect(formatted).toContain('later: "small"');
    expect(formatted).toContain('finalFlag: true');
    expect(formatted).not.toContain('x'.repeat(1_000));
  });

  it('shares preview space across multiple multiline strings after framing', () => {
    const formatted = formatToolArgumentsForObserver(
      { first: 'first line\n'.repeat(2_000), second: 'second line\n'.repeat(2_000) },
      { maxTokens: 200 },
    );

    expect(estimateTokenCount(formatted)).toBeLessThanOrEqual(200);
    expect(formatted).toContain('first: <string,');
    expect(formatted).toContain('second: <string,');
    expect(formatted).toMatch(/first:\n  \|/);
    expect(formatted).toMatch(/second:\n  \|/);
  });

  it('caps a framed single preview at 500 tokens', () => {
    const formatted = formatToolArgumentsForObserver({ content: 'line\n'.repeat(10_000) });
    const previewHeader = 'Large string previews (size-limited):\n';
    const preview = formatted.slice(formatted.indexOf(previewHeader) + previewHeader.length);

    expect(preview).toMatch(/^content:\n  \|/);
    expect(estimateTokenCount(preview)).toBeLessThanOrEqual(500);
  });

  it('continues to later previews when an earlier path cannot fit its share', () => {
    const longKey = `${'segment'.repeat(40)}-first`;
    const formatted = formatToolArgumentsForObserver(
      { [longKey]: 'first\n'.repeat(2_000), short: 'second\n'.repeat(2_000) },
      { maxTokens: 150, maxCharacters: 500 },
    );

    expect(formatted.length).toBeLessThanOrEqual(500);
    expect(estimateTokenCount(formatted)).toBeLessThanOrEqual(150);
    expect(formatted).toContain('preview size-limited');
    expect(formatted).toMatch(/short:\n  \|/);
  });

  it('keeps long paths distinct when they differ only in the omitted middle', () => {
    const prefix = 'p'.repeat(100);
    const suffix = 's'.repeat(100);
    const formatted = formatToolArgumentsForObserver({
      [`${prefix}alpha${suffix}`]: 'one',
      [`${prefix}bravo${suffix}`]: 'two',
    });
    const lines = formatted.split('\n');
    const onePath = lines.find(line => line.endsWith(': "one"'));
    const twoPath = lines.find(line => line.endsWith(': "two"'));

    expect(onePath).toMatch(/…\[\d+ chars; [a-f0-9]{8}\]…/);
    expect(twoPath).toMatch(/…\[\d+ chars; [a-f0-9]{8}\]…/);
    expect(onePath).not.toBe(twoPath);
  });

  it('honors tiny aggregate limits for root strings', () => {
    const formatted = formatToolArgumentsForObserver('x'.repeat(1_000), { maxCharacters: 5, maxTokens: 5 });

    expect(formatted).toBe('…');
    expect(formatted.length).toBeLessThanOrEqual(5);
    expect(estimateTokenCount(formatted)).toBeLessThanOrEqual(5);
  });

  it.each([
    ['undefined', undefined, '<undefined>'],
    ['null', null, 'null'],
    ['false', false, 'false'],
    ['zero', 0, '0'],
    ['empty string', '', '""'],
  ])('renders a %s root argument', (_label, value, expected) => {
    expect(formatToolArgumentsForObserver(value)).toBe(expected);
  });

  it('never emits a lone surrogate from malformed or truncated large strings', () => {
    const formatted = formatToolArgumentsForObserver(`start\uD800\uD800middle\uDC00\uDC00end${'😀'.repeat(5_000)}`, {
      maxTokens: 50,
    });
    const serialized = JSON.stringify({ formatted });
    const loneHighSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;
    const loneLowSurrogate = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;

    expect(loneHighSurrogate.test(formatted)).toBe(false);
    expect(loneLowSurrogate.test(formatted)).toBe(false);
    expect(loneHighSurrogate.test(serialized)).toBe(false);
    expect(loneLowSurrogate.test(serialized)).toBe(false);
  });
});
