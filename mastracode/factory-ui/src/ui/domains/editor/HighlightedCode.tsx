import { useEffect, useRef } from 'react';

import { highlightToFragment } from './editor-highlight';

interface HighlightedCodeProps {
  code: string;
  /** Drives language selection by extension. */
  path: string;
  className?: string;
}

/**
 * A short code snippet highlighted with the shared Pierre/Shiki highlighter.
 * Renders plain text immediately and swaps in highlighted spans once the
 * (cached) highlighter resolves.
 */
export function HighlightedCode({ code, path, className }: HighlightedCodeProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    void highlightToFragment(code, path).then(fragment => {
      if (!cancelled && fragment) el.replaceChildren(fragment);
    });
    return () => {
      cancelled = true;
    };
  }, [code, path]);

  return (
    <span ref={ref} className={className ? `editor-hl ${className}` : 'editor-hl'}>
      {code}
    </span>
  );
}
