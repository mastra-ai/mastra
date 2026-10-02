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

    expect(highlighter.highlight).toHaveBeenCalledTimes(1);
    for (let value = 1; value <= 10; value++) {
      await advance(10);
      const code = `const value = ${value};`;
      rerender(<Code code={code} lang="typescript" />);
      expect(container.querySelector('pre')?.textContent).toBe(code);
    }

    expect(highlighter.highlight).toHaveBeenCalledTimes(2);
    expect(highlighter.highlight).toHaveBeenLastCalledWith('const value = 7;', 'typescript');

    await advance(75);
    expect(highlighter.highlight).toHaveBeenCalledTimes(3);
    expect(highlighter.highlight).toHaveBeenLastCalledWith('const value = 10;', 'typescript');
    expect(container.querySelector('code')?.textContent).toBe('const value = 10;');

    await advance(150);
    expect(highlighter.highlight).toHaveBeenCalledTimes(3);
  });

  it('keeps the highlighted prefix while an appended tail waits for the trailing pass', async () => {
    const { container, rerender } = render(<Code code="const value" lang="typescript" />);
    await advance(0);

    rerender(<Code code="const value = 1;" lang="typescript" />);

    expect(container.querySelector('pre')?.textContent).toBe('const value = 1;');
    expect(container.querySelector('code')?.lastChild?.textContent).toBe(' = 1;');
    expect(highlighter.highlight).toHaveBeenCalledTimes(1);

    await advance(75);
    expect(container.querySelector('code')?.lastChild?.textContent).toBe('const value = 1;');
    expect(highlighter.highlight).toHaveBeenCalledTimes(2);
  });

  it('cancels queued work and immediately highlights a new language', async () => {
    const { container, rerender } = render(<Code code="const value" lang="typescript" />);
    await advance(0);
    rerender(<Code code="const value = 1;" lang="typescript" />);
    rerender(<Code code="value = 1" lang="python" />);
    await advance(0);

    expect(highlighter.highlight).toHaveBeenCalledTimes(2);
    expect(highlighter.highlight).toHaveBeenLastCalledWith('value = 1', 'python');
    expect(container.querySelector('pre')?.textContent).toBe('value = 1');

    await advance(150);
    expect(highlighter.highlight).toHaveBeenCalledTimes(2);
  });

  it('cancels queued work when the language is removed', async () => {
    const { container, rerender } = render(<Code code="const value" lang="typescript" />);
    await advance(0);
    rerender(<Code code="const value = 1;" lang="typescript" />);
    rerender(<Code code="const value = 1;" />);
    await advance(150);

    expect(highlighter.highlight).toHaveBeenCalledTimes(1);
    expect(container.querySelector('code')).toBeNull();
    expect(container.querySelector('pre')?.textContent).toBe('const value = 1;');
  });

  it('cancels queued work on unmount', async () => {
    const { rerender, unmount } = render(<Code code="const value" lang="typescript" />);
    await advance(0);
    rerender(<Code code="const value = 1;" lang="typescript" />);
    unmount();
    await advance(150);

    expect(highlighter.highlight).toHaveBeenCalledTimes(1);
  });
});
