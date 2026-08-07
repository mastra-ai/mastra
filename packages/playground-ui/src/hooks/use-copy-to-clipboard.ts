import { useCallback, useRef, useState } from 'react';
import { toast } from '@/lib/toast';

type UseCopyToClipboardProps = {
  text: string;
  copyMessage?: string;
  copiedDuration?: number;
  showToast?: boolean;
};

type UseCopyToClipboardOptions = Omit<UseCopyToClipboardProps, 'text'>;

type UseCopyToClipboardDynamicResult = {
  isCopied: boolean;
  copyToClipboard: (value: string) => void;
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

export function useCopyToClipboard(props: UseCopyToClipboardProps): UseCopyToClipboardConfiguredResult;
export function useCopyToClipboard(props: UseCopyToClipboardOptions): UseCopyToClipboardDynamicResult;
export function useCopyToClipboard(props: UseCopyToClipboardProps | UseCopyToClipboardOptions) {
  const { copyMessage = 'Copied to clipboard!', copiedDuration = 2000, showToast = true } = props;
  const hasConfiguredText = 'text' in props;
  const text = hasConfiguredText ? props.text : undefined;
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const copyToClipboard = useCallback(
    (value: string) => {
      void copyTextToClipboard(value).then(copied => {
        if (!copied) {
          if (showToast) toast.error('Failed to copy to clipboard.');
          return;
        }

        if (showToast) toast.success(copyMessage);
        setIsCopied(true);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        timeoutRef.current = setTimeout(() => {
          setIsCopied(false);
        }, copiedDuration);
      });
    },
    [copiedDuration, copyMessage, showToast],
  );

  const handleCopy = useCallback(() => {
    if (!text) return;
    copyToClipboard(text);
  }, [copyToClipboard, text]);

  if (!hasConfiguredText) return { isCopied, copyToClipboard };

  return { isCopied, handleCopy, copyToClipboard };
}
