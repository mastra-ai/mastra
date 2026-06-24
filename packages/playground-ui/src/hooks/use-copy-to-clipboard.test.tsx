// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCopyToClipboard } from './use-copy-to-clipboard';

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(document, 'execCommand');
});

const mockClipboard = (writeText: ReturnType<typeof vi.fn>) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
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
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

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
});
