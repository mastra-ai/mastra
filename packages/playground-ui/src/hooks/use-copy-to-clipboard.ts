import { useCallback, useRef, useState } from 'react';
import { announce } from '@/lib/announce';

/** What the last copy did, for as long as it should show: back to `idle` after `copiedDuration`. */
export type CopyStatus = 'idle' | 'copied' | 'failed';

type UseCopyToClipboardOptions = {
  /** How long a copy shows as copied or failed, in milliseconds. Default `2000`. */
  copiedDuration?: number;
  /** What a screen reader hears once it's copied. Default `'Copied to clipboard'`. */
  announcement?: string;
  /** @deprecated Copying no longer shows a toast, so this does nothing. Show `status` where the copy happens. */
  copyMessage?: string;
  /** @deprecated Copying no longer shows a toast, so this does nothing. */
  showToast?: boolean;
};

type UseCopyToClipboardProps = UseCopyToClipboardOptions & { text: string };

type UseCopyToClipboardDynamicResult = {
  status: CopyStatus;
  isCopied: boolean;
  /** Copies `value`; resolves to whether it reached the clipboard. */
  copyToClipboard: (value: string) => Promise<boolean>;
};

type UseCopyToClipboardConfiguredResult = UseCopyToClipboardDynamicResult & {
  handleCopy: () => void;
};

const copyViaClipboardApi = async (value: string): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

const copyViaExecCommand = (value: string): boolean => {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;

  const textarea = document.createElement('textarea');
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    activeElement?.focus({ preventScroll: true });
  }
};

const copyTextToClipboard = async (value: string): Promise<boolean> => {
  if (!value) return false;

  if (await copyViaClipboardApi(value)) return true;

  return copyViaExecCommand(value);
};

/**
 * Copies text and reports how it went, so the control that copied can show it: `CopyIcon`, `CopyLabel` and
 * `CopyTooltip` draw each status, and `CopyButton` is all of them in one button. Screen readers hear the result.
 */
export function useCopyToClipboard(props: UseCopyToClipboardProps): UseCopyToClipboardConfiguredResult;
export function useCopyToClipboard(props?: UseCopyToClipboardOptions): UseCopyToClipboardDynamicResult;
export function useCopyToClipboard(props: UseCopyToClipboardProps | UseCopyToClipboardOptions = {}) {
  const { copiedDuration = 2000, announcement = 'Copied to clipboard' } = props;
  const hasConfiguredText = 'text' in props;
  const text = hasConfiguredText ? props.text : undefined;
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyToClipboard = useCallback(
    async (value: string) => {
      const copied = await copyTextToClipboard(value);

      announce(copied ? announcement : 'Couldn’t copy');
      setStatus(copied ? 'copied' : 'failed');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setStatus('idle'), copiedDuration);

      return copied;
    },
    [announcement, copiedDuration],
  );

  const handleCopy = useCallback(() => {
    if (!text) return;
    void copyToClipboard(text);
  }, [copyToClipboard, text]);

  const isCopied = status === 'copied';

  if (!hasConfiguredText) return { status, isCopied, copyToClipboard };

  return { status, isCopied, handleCopy, copyToClipboard };
}
