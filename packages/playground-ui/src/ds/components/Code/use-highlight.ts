import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ThemedToken } from 'shiki/core';
import { useThrottledCallback } from 'use-debounce';

import { highlight } from '../CodeEditor/highlight';

export interface Highlighted {
  code: string;
  lang: string;
  tokens: ThemedToken[][];
}

/** Sample tokens every 75 ms; the trailing pass catches the final streamed text. */
export function useHighlight(code: string, lang: string | undefined): Highlighted | null {
  const [highlighted, setHighlighted] = useState<Highlighted | null>(null);
  const request = useRef({ id: 0 });

  const throttledHighlight = useThrottledCallback((code: string, lang: string) => {
    const id = ++request.current.id;

    void highlight(code, lang)
      .then(tokens => {
        if (id === request.current.id && tokens?.length) setHighlighted({ code, lang, tokens });
      })
      .catch(() => {});
  }, 75);

  useEffect(() => {
    const currentRequest = request.current;
    return () => {
      throttledHighlight.cancel();
      ++currentRequest.id;
    };
  }, [lang, throttledHighlight]);

  useEffect(() => {
    if (lang) throttledHighlight(code, lang);
  }, [code, lang, throttledHighlight]);

  return lang ? highlighted : null;
}

export function tokenStyle(token: ThemedToken): CSSProperties | undefined {
  if (token.htmlStyle && typeof token.htmlStyle === 'object') {
    return token.htmlStyle as CSSProperties;
  }

  return token.color ? { color: token.color } : undefined;
}
