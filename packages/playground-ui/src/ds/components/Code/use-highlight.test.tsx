// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as highlighter from '../CodeEditor/highlight';
import { Code } from './code';
import type { Highlighted } from './use-highlight';

beforeEach(async () => {
  // Load the real grammars before fake timers so initialization doesn't affect timing assertions.
  await highlighter.highlight('const ready = true;', 'typescript');
  await highlighter.highlight('ready = True', 'python');
  vi.useFakeTimers();
  vi.spyOn(highlighter, 'highlight');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}

describe('streaming highlighting', () => {
  it('samples a continuous stream and highlights the final text without delaying any text', async () => {
    const { container, rerender } = render(<Code code="const value = 0;" lang="typescript" />);
    await advance(0);

    for (let value = 1; value <= 10; value++) {
      await advance(10);
      const code = `const value = ${value};`;
      rerender(<Code code={code} lang="typescript" />);
      expect(container.querySelector('pre')?.textContent).toBe(code);
    }

    await advance(75);
    const callsWhenSettled = vi.mocked(highlighter.highlight).mock.calls.length;
    expect(callsWhenSettled).toBeLessThanOrEqual(4);
    expect(highlighter.highlight).toHaveBeenLastCalledWith(
      'const value = 10;',
      'typescript',
      expect.objectContaining({ lang: 'typescript' }),
    );
    expect(container.querySelector('code')?.textContent).toBe('const value = 10;');

    await advance(150);
    expect(highlighter.highlight).toHaveBeenCalledTimes(callsWhenSettled);
  });

  it('highlights the latest code once the language changes mid-stream', async () => {
    const { container, rerender } = render(<Code code="const value" lang="typescript" />);
    await advance(0);
    rerender(<Code code="const value = 1;" lang="typescript" />);
    rerender(<Code code="value = 1" lang="python" />);
    await advance(75);

    expect(highlighter.highlight).toHaveBeenLastCalledWith('value = 1', 'python', expect.anything());
    // A tree from one grammar must never seed a parse in another.
    for (const [, lang, previous] of vi.mocked(highlighter.highlight).mock.calls) {
      if (previous) expect((previous as Highlighted).lang).toBe(lang);
    }
    expect(container.querySelector('code')?.textContent).toBe('value = 1');
  });

  it('hands each pass the previous one so an appending stream re-parses only its tail', async () => {
    const { container, rerender } = render(<Code code="const a" lang="typescript" />);
    await advance(0);
    rerender(<Code code={'const a = 1;\nconst b'} lang="typescript" />);
    await advance(75);

    expect(highlighter.highlight).toHaveBeenLastCalledWith(
      'const a = 1;\nconst b',
      'typescript',
      expect.objectContaining({ code: 'const a' }),
    );
    expect(container.querySelector('code')?.textContent).toBe('const a = 1;\nconst b');
  });

  it('leaves no sampling timer behind after unmount', async () => {
    const { rerender, unmount } = render(<Code code="const a" lang="typescript" />);
    await advance(0);
    rerender(<Code code="const ab" lang="typescript" />);
    rerender(<Code code="const abc" lang="typescript" />);
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
