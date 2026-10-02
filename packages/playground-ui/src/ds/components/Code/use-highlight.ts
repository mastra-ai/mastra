import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ThemedToken } from 'shiki/core';

import { highlight } from '../CodeEditor/highlight';

export interface Highlighted {
  code: string;
  lang: string;
  tokens: ThemedToken[][];
}

/** Tokens land a pass behind the code, so the value may still describe the previous code. */
export function useHighlight(code: string, lang: string | undefined): Highlighted | null {
  const [highlighted, setHighlighted] = useState<Highlighted | null>(null);

  useEffect(() => {
    if (!lang) {
      setHighlighted(null);
      return;
    }

    let cancelled = false;

    void highlight(code, lang)
      .then(tokens => {
        if (!cancelled && tokens?.length) setHighlighted({ code, lang, tokens });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  return highlighted;
}

export function tokenStyle(token: ThemedToken): CSSProperties | undefined {
  if (token.htmlStyle && typeof token.htmlStyle === 'object') {
    return token.htmlStyle as CSSProperties;
  }

  return token.color ? { color: token.color } : undefined;
}
