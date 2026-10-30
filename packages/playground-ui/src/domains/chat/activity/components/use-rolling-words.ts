import { useLayoutEffect, useRef } from 'react';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const ROLL_MS = 460;
const LEAVE_MS = 320;
const WRITE_MS = 640;
const WRITE_MASK = {
  maskImage: 'linear-gradient(90deg, #000 45%, transparent 55%)',
  maskSize: '250% 100%',
  maskRepeat: 'no-repeat',
};
const IN_PLACE: Keyframe = { opacity: 1, transform: 'none', filter: 'none' };

interface Said {
  key: string;
  words: Node;
  width: number;
}

interface Motion {
  glide?: Animation;
  rise?: Animation;
}

function moves(element: HTMLElement): boolean {
  return typeof element.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function running(animation: Animation | undefined): boolean {
  return animation?.playState === 'running';
}

function writeIn(words: HTMLElement) {
  words.animate(
    [
      { ...WRITE_MASK, maskPosition: '100% 0' },
      { ...WRITE_MASK, maskPosition: '0 0' },
    ],
    { duration: WRITE_MS, easing: EASE },
  );
}

function leave(box: HTMLElement, leaving: Node, width: number, from: Keyframe) {
  if (!(leaving instanceof HTMLElement)) return;
  leaving.setAttribute('aria-hidden', 'true');
  Object.assign(leaving.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: `${width}px`,
    pointerEvents: 'none',
  });
  box.append(leaving);
  leaving
    .animate([from, { opacity: 0, transform: 'translateY(-70%)', filter: 'blur(3px)' }], {
      duration: LEAVE_MS,
      easing: EASE,
      fill: 'forwards',
    })
    .finished.finally(() => leaving.remove())
    .catch(() => {});
}

/** Rolls to the new words from wherever the last roll had got to, and returns the width they settle at. */
function roll(box: HTMLElement, words: HTMLElement, before: Said, motion: Motion): number {
  const shownWidth = running(motion.glide) ? box.getBoundingClientRect().width : before.width;
  const style = getComputedStyle(words);
  const shown = running(motion.rise)
    ? { opacity: style.opacity, transform: style.transform, filter: style.filter }
    : IN_PLACE;
  motion.glide?.cancel();
  motion.rise?.cancel();

  leave(box, before.words, shownWidth, shown);
  motion.rise = words.animate([{ opacity: 0, transform: 'translateY(70%)', filter: 'blur(3px)' }, IN_PLACE], {
    duration: ROLL_MS,
    easing: EASE,
  });
  const width = box.offsetWidth;
  if (width !== shownWidth) {
    motion.glide = box.animate([{ width: `${shownWidth}px` }, { width: `${width}px` }], {
      duration: ROLL_MS,
      easing: EASE,
    });
  }
  return width;
}

/**
 * What a line says, moved like a thought changing: new words rise into place while the old ones rise and blur
 * away, and the box glides to the new width. Only a line the reader `watched` being written moves: it writes its
 * first words in from the left, and rolls each time `words`, the key of what is said, changes.
 */
export function useRollingWords(words: string, watched: boolean) {
  const box = useRef<HTMLSpanElement>(null);
  const said = useRef<HTMLSpanElement>(null);
  const before = useRef<Said | undefined>(undefined);
  const motion = useRef<Motion>({});

  useLayoutEffect(() => {
    const boxElement = box.current;
    const saidElement = said.current;
    const previous = before.current;
    if (!boxElement || !saidElement || previous?.key === words) return;

    const clone = saidElement.cloneNode(true);
    const moving = watched && moves(saidElement);
    if (moving && !previous) writeIn(saidElement);
    const width = moving && previous ? roll(boxElement, saidElement, previous, motion.current) : boxElement.offsetWidth;
    before.current = { key: words, words: clone, width };
  }, [words, watched]);

  return { box, said };
}
