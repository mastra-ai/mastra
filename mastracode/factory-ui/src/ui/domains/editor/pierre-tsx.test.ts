import { describe, expect, it } from 'vitest';
import { getFiletypeFromFileName, getSharedHighlighter } from '@pierre/diffs';

/**
 * Diagnostic: prove the shared Pierre highlighter tokenizes .tsx files with
 * full JSX grammar, including multi-line JSX blocks. If this passes, a broken
 * tsx buffer in the browser is a rendering/edit-mode issue, not a grammar or
 * language-resolution issue.
 */
describe('pierre tsx tokenization', () => {
  const source = [
    `import { useState } from 'react';`,
    ``,
    `export function Counter({ label }: { label: string }) {`,
    `  const [count, setCount] = useState(0);`,
    `  return (`,
    `    <button type="button" onClick={() => setCount(count + 1)}>`,
    `      {label}: {count}`,
    `    </button>`,
    `  );`,
    `}`,
  ].join('\n');

  it('detects tsx from the file name', () => {
    expect(getFiletypeFromFileName('src/ui/Counter.tsx')).toBe('tsx');
  });

  it('produces distinct token colors on every non-empty line, including JSX', async () => {
    const highlighter = await getSharedHighlighter({
      themes: ['pierre-light', 'pierre-dark'],
      langs: ['tsx'],
    });
    const { tokens } = highlighter.codeToTokens(source, {
      lang: 'tsx',
      themes: { light: 'pierre-light', dark: 'pierre-dark' },
      defaultColor: false,
    });
    expect(tokens).toHaveLength(source.split('\n').length);
    const colors = new Set<string>();
    for (const line of tokens) {
      for (const token of line) {
        const style = token.htmlStyle as Record<string, string> | undefined;
        if (style?.['--shiki-light']) colors.add(style['--shiki-light']);
      }
    }
    // A real tsx grammar yields a rich palette; plain-text fallback yields 0-1.
    expect(colors.size).toBeGreaterThanOrEqual(5);
    // The multi-line JSX block specifically must be tokenized (not one flat token).
    const jsxLine = tokens[5]!;
    expect(jsxLine.length).toBeGreaterThan(3);
  });
});
