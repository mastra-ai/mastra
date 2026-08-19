import * as React from 'react';
import type { ThemedToken } from 'shiki/core';

import { highlight } from '../CodeEditor/highlight';

export interface HighlightedCode {
  code: string;
  lang: string;
  tokens: ThemedToken[][];
}

/** Colors from an earlier pass still hold when the new code only appends to the old. */
function usableHighlight(highlighted: HighlightedCode | null, code: string, lang?: string): HighlightedCode | null {
  if (!highlighted || highlighted.lang !== lang) return null;
  return code.startsWith(highlighted.code) ? highlighted : null;
}

export function useHighlightedCode(code: string, lang?: string): HighlightedCode | null {
  const [highlighted, setHighlighted] = React.useState<HighlightedCode | null>(null);

  React.useEffect(() => {
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

  return usableHighlight(highlighted, code, lang);
}
