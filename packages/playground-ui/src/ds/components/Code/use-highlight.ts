import { useEffect, useRef, useState } from 'react';
import { useDebounce } from 'use-debounce';

import { highlight } from '../CodeEditor/highlight';
import type { HighlightResult } from '../CodeEditor/highlight';

export interface Highlighted extends HighlightResult {
  lang: string;
}

const HIGHLIGHT_SAMPLE_INTERVAL_MS = 75;

/** Tokens land a pass behind the code, so the value may still describe the previous code. */
export function useHighlight(code: string, lang: string | undefined): Highlighted | null {
  const [highlighted, setHighlighted] = useState<Highlighted | null>(null);
  // Read by the next pass so a streaming block re-parses only its new tail.
  const latest = useRef<Highlighted | null>(null);
  // maxWait equal to the delay turns the debounce into a throttle.
  const [sampledCode, sampler] = useDebounce(code, HIGHLIGHT_SAMPLE_INTERVAL_MS, {
    leading: true,
    maxWait: HIGHLIGHT_SAMPLE_INTERVAL_MS,
  });

  // With `leading`, use-debounce's pending timer still calls setState after unmount.
  useEffect(() => () => sampler.cancel(), [sampler]);

  useEffect(() => {
    if (!lang) return;

    let cancelled = false;
    const previous = latest.current?.lang === lang ? latest.current : undefined;

    void highlight(sampledCode, lang, previous)
      .then(result => {
        if (cancelled || !result?.tokens.length) return;
        latest.current = { ...result, lang };
        setHighlighted(latest.current);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [sampledCode, lang]);

  return lang ? highlighted : null;
}
