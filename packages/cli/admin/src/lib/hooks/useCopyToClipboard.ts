'use client';

import { SetStateAction, useEffect, useState } from 'react';

type CopiedValue = string | null;
type CopyFn = (text: string) => Promise<boolean>; // Return success
type SetCopied = React.Dispatch<SetStateAction<boolean>>;

export function useCopyToClipboard(): [CopiedValue, CopyFn, boolean] {
  const [copiedText, setCopiedText] = useState<CopiedValue>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    timeoutId = setTimeout(() => {
      setCopied(false);
      setCopiedText('');
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [copiedText, copied]);

  const copy: CopyFn = async text => {
    if (!navigator?.clipboard) {
      // console.warn('Clipboard not supported');
      return false;
    }

    // Try to save to clipboard then save it in the state if worked
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setCopied(true);
      return true;
    } catch (error) {
      // console.warn('Copy failed', error);
      setCopiedText(null);
      setCopied(false);
      return false;
    }
  };

  return [copiedText, copy, copied];
}
