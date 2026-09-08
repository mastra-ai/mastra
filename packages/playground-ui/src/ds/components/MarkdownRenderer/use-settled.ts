import { useEffect, useRef, useState } from 'react';

import { useWatched } from '@/ds/components/Arrival';
import { ARRIVING_MS } from '@/ds/tokens';

interface Landing {
  words: number;
  at: number;
}

/**
 * How many of a reply's words have been on screen long enough that their entrance is over.
 *
 * The entrance plays on whatever mounts carrying the class, so it replays every time a
 * word's element is rebuilt — and markdown rebuilds a growing tail constantly: a `-`
 * turns a paragraph into a list item, a closing `**` splits it around a `<strong>`, the
 * stream ends and the mend comes off. Each of those swaps the element a settled word
 * lives in, which is what makes a word already read fade in again.
 *
 * Ageing them out is the whole answer: a word carries the class only while it is new,
 * so however often the tail is rebuilt, only what is genuinely arriving animates.
 *
 * What counts as new at mount is not this hook's call. A reply the reader was handed
 * is already there, and a block that mounts complete — a card's output, an expanded
 * body — enters with its container. Only a passage born streaming under the reader's
 * eyes is new from its first word: the reveal often lands several words in its first
 * commit, and they enter like every word after them.
 */
export function useSettledWords(words: number, streaming: boolean): number {
  const watched = useWatched();
  const [settled, setSettled] = useState(() => (watched && streaming ? 0 : words));
  const landings = useRef<Landing[]>([]);
  const recorded = useRef(settled);

  useEffect(() => {
    if (recorded.current !== words) {
      landings.current.push({ words, at: performance.now() });
      recorded.current = words;
    }

    const waiting = landings.current[0];
    if (!waiting) return;

    const timer = setTimeout(
      () => {
        landings.current.shift();
        setSettled(waiting.words);
      },
      Math.max(0, waiting.at + ARRIVING_MS - performance.now()),
    );

    return () => clearTimeout(timer);
  }, [settled, words]);

  // A shorter reply replacing the one on screen settles at once: nothing of it is new.
  return Math.min(settled, words);
}
