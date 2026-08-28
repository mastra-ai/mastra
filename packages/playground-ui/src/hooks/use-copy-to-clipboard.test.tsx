// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sonnerMock } = vi.hoisted(() => ({
  sonnerMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), dismiss: vi.fn(), promise: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: Object.assign((..._args: unknown[]) => undefined, sonnerMock),
  Toaster: () => null,
}));

import { useCopyToClipboard } from './use-copy-to-clipboard';

beforeEach(() => {
  Object.values(sonnerMock).forEach(fn => fn.mockClear());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(document, 'execCommand');
});

const mockClipboard = (writeText: ReturnType<typeof vi.fn>) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
};

const mockExecCommand = (execCommand: ReturnType<typeof vi.fn>) => {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: execCommand,
  });
};

describe('useCopyToClipboard', () => {
  it('copies configured text through handleCopy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    const { result } = renderHook(() => useCopyToClipboard({ text: 'copy me', showToast: false }));

    act(() => {
      result.current.handleCopy();
    });

    expect(writeText).toHaveBeenCalledWith('copy me');
    await waitFor(() => expect(result.current.isCopied).toBe(true));
  });

  it('falls back when the browser blocks async clipboard writes', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('Write permission denied', 'NotAllowedError'));
    const execCommand = vi.fn(() => true);
    mockClipboard(writeText);
    mockExecCommand(execCommand);

    const { result } = renderHook(() => useCopyToClipboard({ showToast: false }));

    expect('handleCopy' in result.current).toBe(false);

    act(() => {
      result.current.copyToClipboard('fallback copy text');
    });

    expect(writeText).toHaveBeenCalledWith('fallback copy text');
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'));
    await waitFor(() => expect(result.current.isCopied).toBe(true));
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when the browser exposes no async clipboard at all', async () => {
    const execCommand = vi.fn(() => true);
    mockExecCommand(execCommand);

    const { result } = renderHook(() => useCopyToClipboard({ showToast: false }));

    act(() => {
      result.current.copyToClipboard('no clipboard api');
    });

    await waitFor(() => expect(result.current.isCopied).toBe(true));
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('selects the whole value in an off-screen textarea it then removes', async () => {
    let snapshot: Record<string, unknown> | undefined;
    mockExecCommand(
      vi.fn(function execCommand() {
        const textarea = document.querySelector('textarea');
        snapshot = textarea
          ? {
              inDocument: textarea.isConnected,
              focused: document.activeElement === textarea,
              value: textarea.value,
              selectionStart: textarea.selectionStart,
              selectionEnd: textarea.selectionEnd,
              readonly: textarea.getAttribute('readonly'),
              ariaHidden: textarea.getAttribute('aria-hidden'),
              position: textarea.style.position,
              top: textarea.style.top,
              left: textarea.style.left,
              width: textarea.style.width,
              height: textarea.style.height,
              opacity: textarea.style.opacity,
              pointerEvents: textarea.style.pointerEvents,
            }
          : undefined;
        return true;
      }),
    );

    const { result } = renderHook(() => useCopyToClipboard({ showToast: false }));

    act(() => {
      result.current.copyToClipboard('the whole value');
    });

    await waitFor(() => expect(result.current.isCopied).toBe(true));

    // The textarea has to be in the document and focused for execCommand to
    // read it, and invisible so it never flashes or takes layout space.
    expect(snapshot).toEqual({
      inDocument: true,
      focused: true,
      value: 'the whole value',
      selectionStart: 0,
      selectionEnd: 'the whole value'.length,
      readonly: '',
      ariaHidden: 'true',
      position: 'fixed',
      top: '0px',
      left: '0px',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
    });
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('reports a failure when neither path is available', async () => {
    const { result } = renderHook(() => useCopyToClipboard({ showToast: false }));

    await act(async () => {
      result.current.copyToClipboard('nowhere to put it');
    });

    expect(result.current.isCopied).toBe(false);
  });

  it('reports a failure when the copy command itself throws', async () => {
    mockExecCommand(
      vi.fn(() => {
        throw new Error('copy blocked');
      }),
    );

    const { result } = renderHook(() => useCopyToClipboard({ showToast: false }));

    await act(async () => {
      result.current.copyToClipboard('will not copy');
    });

    expect(result.current.isCopied).toBe(false);
    // The textarea is still cleaned up on the way out.
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('gives focus back to the element that had it', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    mockExecCommand(vi.fn(() => true));

    const { result } = renderHook(() => useCopyToClipboard({ showToast: false }));

    act(() => {
      result.current.copyToClipboard('focus me back');
    });

    await waitFor(() => expect(result.current.isCopied).toBe(true));
    expect(document.activeElement).toBe(input);

    input.remove();
  });

  it('reports nothing copied for an empty value', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    const { result } = renderHook(() => useCopyToClipboard({ showToast: false }));

    await act(async () => {
      result.current.copyToClipboard('');
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(result.current.isCopied).toBe(false);
  });

  it('restores focus without scrolling the page to it', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const focus = vi.spyOn(input, 'focus');
    mockExecCommand(vi.fn(() => true));

    const { result } = renderHook(() => useCopyToClipboard({ showToast: false }));

    act(() => {
      result.current.copyToClipboard('focus me back');
    });

    await waitFor(() => expect(result.current.isCopied).toBe(true));
    // Refocusing must not yank the viewport back to wherever the element sits.
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });

    input.remove();
  });

  it('copies fine while something other than an HTML element holds focus', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('tabindex', '0');
    document.body.appendChild(svg);
    svg.focus();
    expect(document.activeElement).toBe(svg);

    mockExecCommand(vi.fn(() => true));

    const { result } = renderHook(() => useCopyToClipboard({ showToast: false }));

    act(() => {
      result.current.copyToClipboard('focus is elsewhere');
    });

    // There is nothing to hand focus back to, and that is not a failure.
    await waitFor(() => expect(result.current.isCopied).toBe(true));

    svg.remove();
  });

  it('does nothing when handleCopy has no text configured', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    const { result } = renderHook(() => useCopyToClipboard({ text: '', showToast: false }));

    act(() => {
      result.current.handleCopy();
    });

    expect(writeText).not.toHaveBeenCalled();
  });

  describe('toasts', () => {
    it('announces a successful copy by default', async () => {
      mockClipboard(vi.fn().mockResolvedValue(undefined));

      const { result } = renderHook(() => useCopyToClipboard({ text: 'copy me' }));

      act(() => {
        result.current.handleCopy();
      });

      await waitFor(() => expect(sonnerMock.success).toHaveBeenCalledWith('Copied to clipboard!', {}));
    });

    it('uses the caller message', async () => {
      mockClipboard(vi.fn().mockResolvedValue(undefined));

      const { result } = renderHook(() => useCopyToClipboard({ text: 'copy me', copyMessage: 'Trace ID copied' }));

      act(() => {
        result.current.handleCopy();
      });

      await waitFor(() => expect(sonnerMock.success).toHaveBeenCalledWith('Trace ID copied', {}));
    });

    it('announces a failure when neither path can copy', async () => {
      mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
      mockExecCommand(vi.fn(() => false));

      const { result } = renderHook(() => useCopyToClipboard({ text: 'copy me' }));

      act(() => {
        result.current.handleCopy();
      });

      await waitFor(() => expect(sonnerMock.error).toHaveBeenCalledWith('Failed to copy to clipboard.', {}));
      expect(result.current.isCopied).toBe(false);
    });

    it('says nothing at all when there is no configured text to copy', async () => {
      mockClipboard(vi.fn().mockResolvedValue(undefined));

      const { result } = renderHook(() => useCopyToClipboard({ text: '' }));

      await act(async () => {
        result.current.handleCopy();
      });

      // Nothing was attempted, so there is no failure to report either.
      expect(sonnerMock.error).not.toHaveBeenCalled();
      expect(sonnerMock.success).not.toHaveBeenCalled();
    });

    it('stays silent about a successful copy when the caller asked it to', async () => {
      mockClipboard(vi.fn().mockResolvedValue(undefined));

      const { result } = renderHook(() => useCopyToClipboard({ text: 'copy me', showToast: false }));

      await act(async () => {
        result.current.handleCopy();
      });

      expect(result.current.isCopied).toBe(true);
      expect(sonnerMock.success).not.toHaveBeenCalled();
    });

    it('follows a change of message or of whether to speak at all', async () => {
      mockClipboard(vi.fn().mockResolvedValue(undefined));

      const { result, rerender } = renderHook(props => useCopyToClipboard(props), {
        initialProps: { text: 'copy me', copyMessage: 'First message', showToast: true },
      });

      await act(async () => {
        result.current.handleCopy();
      });
      expect(sonnerMock.success).toHaveBeenCalledWith('First message', {});

      rerender({ text: 'copy me', copyMessage: 'Second message', showToast: true });
      await act(async () => {
        result.current.handleCopy();
      });
      expect(sonnerMock.success).toHaveBeenLastCalledWith('Second message', {});

      rerender({ text: 'copy me', copyMessage: 'Second message', showToast: false });
      sonnerMock.success.mockClear();
      await act(async () => {
        result.current.handleCopy();
      });
      expect(sonnerMock.success).not.toHaveBeenCalled();
    });

    it('follows a change of the text it was configured with', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      mockClipboard(writeText);

      const { result, rerender } = renderHook(props => useCopyToClipboard(props), {
        initialProps: { text: 'first text', showToast: false },
      });

      await act(async () => {
        result.current.handleCopy();
      });
      expect(writeText).toHaveBeenLastCalledWith('first text');

      rerender({ text: 'second text', showToast: false });
      await act(async () => {
        result.current.handleCopy();
      });
      expect(writeText).toHaveBeenLastCalledWith('second text');
    });

    it('stays silent when the caller asked it to', async () => {
      mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
      mockExecCommand(vi.fn(() => false));

      const { result } = renderHook(() => useCopyToClipboard({ text: 'copy me', showToast: false }));

      act(() => {
        result.current.handleCopy();
      });

      await waitFor(() => expect(result.current.isCopied).toBe(false));
      expect(sonnerMock.error).not.toHaveBeenCalled();
      expect(sonnerMock.success).not.toHaveBeenCalled();
    });
  });

  describe('the copied flag', () => {
    // Fake timers without shouldAdvanceTime: the clipboard write settles on a
    // microtask, so flushing act() is enough and the clock stays exactly where
    // the test puts it.
    const copyAndFlush = async (copy: () => void) => {
      await act(async () => {
        copy();
      });
    };

    it('clears itself after the default two seconds', async () => {
      vi.useFakeTimers();
      mockClipboard(vi.fn().mockResolvedValue(undefined));

      const { result } = renderHook(() => useCopyToClipboard({ text: 'copy me', showToast: false }));

      await copyAndFlush(() => result.current.handleCopy());
      expect(result.current.isCopied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1999);
      });
      expect(result.current.isCopied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.isCopied).toBe(false);
    });

    it('honours a caller duration', async () => {
      vi.useFakeTimers();
      mockClipboard(vi.fn().mockResolvedValue(undefined));

      const { result } = renderHook(() =>
        useCopyToClipboard({ text: 'copy me', showToast: false, copiedDuration: 500 }),
      );

      await copyAndFlush(() => result.current.handleCopy());
      expect(result.current.isCopied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(499);
      });
      expect(result.current.isCopied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.isCopied).toBe(false);
    });

    it('restarts the countdown when copied again', async () => {
      vi.useFakeTimers();
      mockClipboard(vi.fn().mockResolvedValue(undefined));

      const { result } = renderHook(() =>
        useCopyToClipboard({ text: 'copy me', showToast: false, copiedDuration: 1000 }),
      );

      await copyAndFlush(() => result.current.handleCopy());

      act(() => {
        vi.advanceTimersByTime(800);
      });
      await copyAndFlush(() => result.current.handleCopy());

      // The first timer must have been cleared, not left to fire at 1000ms.
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(result.current.isCopied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(result.current.isCopied).toBe(false);
    });
  });
});
