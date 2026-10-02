// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as highlighter from '../CodeEditor/highlight';
import { Code } from './code';

beforeEach(async () => {
  // Load the real grammars before fake timers so initialization doesn't affect timing assertions.
  await highlighter.highlight('const ready = true;', 'typescript');
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

    expect(highlighter.highlight).toHaveBeenCalledTimes(3);

    await advance(75);
    expect(highlighter.highlight).toHaveBeenCalledTimes(4);
    expect(highlighter.highlight).toHaveBeenLastCalledWith('const value = 10;', 'typescript');
    expect(container.querySelector('code')?.textContent).toBe('const value = 10;');

    await advance(150);
    expect(highlighter.highlight).toHaveBeenCalledTimes(4);
  });

  it('highlights the latest code once the language changes mid-stream', async () => {
    const { container, rerender } = render(<Code code="const value" lang="typescript" />);
    await advance(0);
    rerender(<Code code="const value = 1;" lang="typescript" />);
    rerender(<Code code="value = 1" lang="python" />);
    await advance(75);

    expect(highlighter.highlight).toHaveBeenLastCalledWith('value = 1', 'python');
    expect(container.querySelector('code')?.textContent).toBe('value = 1');
  });
});
