import { useState, useCallback } from 'react';

interface UseCopyToClipboardResult {
  copiedMap: Record<string | number, boolean>;
  copyToClipboard: (text: string, key?: string | number) => Promise<void>;
}

export function useCopyToClipboard(timeout = 2000): UseCopyToClipboardResult {
  const [copiedMap, setCopiedMap] = useState<Record<string | number, boolean>>({});

  const copyToClipboard = useCallback(
    async (text: string, key: string | number = 'default') => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedMap(prev => ({ ...prev, [key]: true }));

        setTimeout(() => {
          setCopiedMap(prev => ({ ...prev, [key]: false }));
        }, timeout);
      } catch (error) {
        console.error('Failed to copy text:', error);
      }
    },
    [timeout],
  );

  return { copiedMap, copyToClipboard };
}
