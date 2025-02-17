import { useCallback, useRef, useState } from 'react';

type UseCopyToClipboardProps = {
  text: string;
  copyMessage?: string;
};

export function useCopyToClipboard({ text, copyMessage = 'Copied to clipboard!' }: UseCopyToClipboardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState('');

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setIsCopied(true);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        timeoutRef.current = setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      })
      .catch(() => {
        setError('Failed to copy to clipboard.');
      });
  }, [text, copyMessage]);

  return { isCopied, handleCopy, error };
}
