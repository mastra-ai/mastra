import { useState } from 'react';

interface UseCopyToClipboardOptions {
  copiedDuration?: number;
}

/**
 * Hook for copying text to clipboard with visual feedback.
 *
 * @param options.copiedDuration - How long to show "copied" state in ms (default: 1500)
 * @returns { isCopied, copyToClipboard }
 */
export const useCopyToClipboard = ({ copiedDuration = 1500 }: UseCopyToClipboardOptions = {}) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};
