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
    let selectedValue: string | undefined;
    let selectionEnd: number | undefined;
    let wasInDocument = false;
    mockExecCommand(
      vi.fn(function execCommand(this: Document) {
        const textarea = document.querySelector('textarea');
        wasInDocument = Boolean(textarea?.isConnected);
        selectedValue = textarea?.value;
        selectionEnd = textarea?.selectionEnd ?? undefined;
        return true;
      }),
    );

    const { result } = renderHook(() => useCopyToClipboard({ showToast: false }));

    act(() => {
      result.current.copyToClipboard('the whole value');
    });

    await waitFor(() => expect(result.current.isCopied).toBe(true));
    expect(wasInDocument).toBe(true);
    expect(selectedValue).toBe('the whole value');
    expect(selectionEnd).toBe('the whole value'.length);
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

    act(() => {
      result.current.copyToClipboard('');
    });

    await waitFor(() => expect(writeText).not.toHaveBeenCalled());
    expect(result.current.isCopied).toBe(false);
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
