import { useCallback, useRef, useState } from 'react';
import { toast } from '@/lib/toast';

type UseCopyToClipboardProps = {
  text: string;
  copyMessage?: string;
};

function copyViaExecCommand(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // Keep the textarea off-screen so it doesn't flash visible
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

export function useCopyToClipboard({ text, copyMessage = 'Copied to clipboard!' }: UseCopyToClipboardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onSuccess = useCallback(() => {
    toast.success(copyMessage);
    setIsCopied(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  }, [copyMessage]);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(onSuccess)
      .catch(() => {
        // navigator.clipboard requires the Clipboard permission, which browsers
        // like Arc or Firefox in strict mode may deny. Fall back to the older
        // execCommand approach which works without explicit permission.
        const ok = copyViaExecCommand(text);
        if (ok) {
          onSuccess();
        } else {
          toast.error('Failed to copy to clipboard.');
        }
      });
  }, [text, onSuccess]);

  return { isCopied, handleCopy };
}
