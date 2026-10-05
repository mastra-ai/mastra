import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ThemedToken } from 'shiki/core';
import { useDebounce } from 'use-debounce';

import { highlight } from '../CodeEditor/highlight';

export interface Highlighted {
  code: string;
  lang: string;
  tokens: ThemedToken[][];
}

const HIGHLIGHT_SAMPLE_INTERVAL_MS = 75;

/** Tokens land a pass behind the code, so the value may still describe the previous code. */
export function useHighlight(code: string, lang: string | undefined): Highlighted | null {
  const [highlighted, setHighlighted] = useState<Highlighted | null>(null);
  // maxWait equal to the delay turns the debounce into a throttle.
  const [sampledCode] = useDebounce(code, HIGHLIGHT_SAMPLE_INTERVAL_MS, {
    leading: true,
    maxWait: HIGHLIGHT_SAMPLE_INTERVAL_MS,
  });

  useEffect(() => {
    if (!lang) return;

    let cancelled = false;

    void highlight(sampledCode, lang)
      .then(tokens => {
        if (!cancelled && tokens?.length) setHighlighted({ code: sampledCode, lang, tokens });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [sampledCode, lang]);

  return lang ? highlighted : null;
}

export function tokenStyle(token: ThemedToken): CSSProperties | undefined {
  if (token.htmlStyle && typeof token.htmlStyle === 'object') {
    return token.htmlStyle as CSSProperties;
  }

  return token.color ? { color: token.color } : undefined;
}
