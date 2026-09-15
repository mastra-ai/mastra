import { useEffect, useMemo, useRef, useState } from 'react';

/** How much of the reply the reveal aims to be holding back, as time at the speed it is playing. */
const BUFFER_MS = 1000;

/** How long it takes to work off a buffer that is too full or too empty. */
const CORRECT_MS = 1000;

/** How long a word keeps counting towards the speed the reply is arriving at. */
const FLOW_MS = 700;

/** How long the reveal takes to adopt a new speed, so a change of pace is never a jolt. */
const EASE_MS = 400;

/** Words per second it will not go below: a short burst between two tool calls still reads briskly. */
const SLOWEST = 10;

/** Words per second it will not go past: one word a frame, all a screen can draw. */
const FASTEST = 60;

/** Words it will never fall further behind than — about five seconds at full speed. */
const MAX_LAG = 300;

interface Flow {
  /** Words per second the reply is arriving at, as an exponential average. */
  rate: number;
  at: number;
}

/** Decays what earlier words still count for, then deposits the ones that just arrived. */
function measure(flow: Flow, now: number, gained: number): number {
  // rAF timestamps and performance.now() are sampled at different points of a
  // frame, so a fresh loop can read time slightly behind the last deposit.
  const elapsed = Math.max(0, now - flow.at);
  flow.rate = flow.rate * Math.exp(-elapsed / FLOW_MS) + gained / (FLOW_MS / 1000);
  flow.at = Math.max(flow.at, now);

  return flow.rate;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Where the reveal can cut the text: before the first word, then after each one. */
function wordStops(text: string): number[] {
  const stops = [0];
  const word = /\S+/g;

  for (let match = word.exec(text); match; match = word.exec(text)) stops.push(match.index + match[0].length);

  return stops;
}

/**
 * A jitter buffer for a streamed reply, counted in words. Chunks reach the
 * browser unevenly — a proxy flushes, a tool call ends, the model changes pace —
 * and drawing each one on arrival makes a reply lurch: ten words at once, then
 * nothing for a fifth of a second.
 *
 * So the reveal runs on its own clock: a frame loop that chunks never interrupt,
 * laying down at most one word per frame however far behind it is. It plays at
 * the speed the reply is arriving at, measured directly, and leans on that only
 * to work the buffer back to `BUFFER_MS` of held text when it drifts. Measuring
 * the speed rather than inferring it from the buffer is what lets the buffer stay
 * shallow: a reply that lasts two seconds still finds its pace in the first few
 * hundred milliseconds, where a deeper buffer would spend the whole reply filling
 * and then sprint to catch up.
 *
 * The reply it paces is whatever the caller hands it, so a caller with more than
 * prose to lay down — a tool row between two paragraphs — paces the whole of it
 * from one place and draws the rest against the same cursor.
 *
 * Nothing here reads `streaming` past the first render: a reply that stops
 * arriving is one whose measured speed decays, which winds the buffer down on its
 * own. Words, not characters, are what a reader sees land, and they are not the
 * same length: an even flow of characters still drops "and if we do" in one frame
 * and spends four on "implementation".
 */
export function useRevealedText(text: string, streaming: boolean): string {
  const [calm] = useState(prefersReducedMotion);
  const stops = useMemo(() => wordStops(text), [text]);
  const words = stops.length - 1;

  const [landed, setLanded] = useState(() => (streaming && !calm ? 0 : words));

  // Winds the cursor back when a shorter reply replaces the one on screen, which
  // no key can express: same element, same message, new text.
  const shown = calm ? words : Math.min(words, Math.max(landed, words - MAX_LAG));
  if (shown !== landed) setLanded(shown);

  const chasing = shown < words;
  const goal = useRef(words);
  const cursor = useRef(shown);
  const flow = useRef<Flow>({ rate: 0, at: 0 });
  const pace = useRef(SLOWEST);

  useEffect(() => {
    measure(flow.current, performance.now(), Math.max(0, words - goal.current));
    goal.current = words;

    if (cursor.current < shown || cursor.current > words) cursor.current = shown;
  });

  useEffect(() => {
    if (!chasing) return;

    let drawn = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const elapsed = Math.max(0, now - drawn);
      drawn = Math.max(drawn, now);

      const arriving = measure(flow.current, now, 0);
      const from = cursor.current;
      const behind = goal.current - from;

      if (behind > 0) {
        const held = (arriving * BUFFER_MS) / 1000;
        const aim = Math.min(FASTEST, Math.max(SLOWEST, arriving + ((behind - held) * 1000) / CORRECT_MS));

        pace.current += (aim - pace.current) * Math.min(1, elapsed / EASE_MS);
        cursor.current = Math.min(goal.current, Math.floor(from) + 1, from + (elapsed * pace.current) / 1000);

        if (Math.floor(cursor.current) !== Math.floor(from)) setLanded(Math.floor(cursor.current));
      }

      frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, [chasing]);

  if (!chasing) return text;

  return text.slice(0, stops[shown]);
}
