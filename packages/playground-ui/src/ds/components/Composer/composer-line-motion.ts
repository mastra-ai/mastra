// The action groups are absent: CSS pins them to the box's bottom corners in both layouts.
const PARTS = '[data-slot="composer-box-content"] > :not([data-slot="composer-actions"])';
const DETAILS = '[data-slot="composer-actions-detail"] > *';
const GROUPS = '[data-slot="composer-actions-start"], [data-slot="composer-actions-end"]';
const LINE_HIDDEN = '[data-composer-line-hidden]';

interface Offset {
  x: number;
  y: number;
}

interface Presence {
  width: number;
  height: number;
  opacity: number;
  shown: boolean;
}

interface LineHidden {
  width: number;
  display: string;
}

interface Layout {
  boxHeight: number;
  parts: Map<HTMLElement, Offset>;
  details: Map<HTMLElement, Offset & Presence>;
  lineHidden: Map<HTMLElement, LineHidden>;
}

const isEndGroup = (element: Element) => element.getAttribute('data-slot') === 'composer-actions-end';

function offsetFrom(anchor: DOMRect, element: Element, fromEnd: boolean): Offset {
  const rect = element.getBoundingClientRect();
  return { x: fromEnd ? rect.right - anchor.right : rect.left - anchor.left, y: rect.top - anchor.top };
}

/**
 * Parts are placed by where their content starts, so a padding change between the two layouts never
 * jumps, and from the box's bottom edge, which holds still while the box grows upward.
 */
function partOffset(box: DOMRect, part: HTMLElement): Offset {
  const content = part.querySelector('[data-slot="composer-input"]') ?? part;
  const rect = content.getBoundingClientRect();
  const style = getComputedStyle(content);
  return {
    x: rect.left - box.left + Number.parseFloat(style.paddingLeft),
    y: rect.top - box.bottom + Number.parseFloat(style.paddingTop),
  };
}

function presence(element: HTMLElement): Presence {
  const style = getComputedStyle(element);
  const { width, height } = element.getBoundingClientRect();
  return {
    width,
    height,
    opacity: Number(style.opacity),
    shown: style.visibility !== 'hidden',
  };
}

function readLayout(box: HTMLElement): Layout {
  const boxRect = box.getBoundingClientRect();
  const parts = new Map<HTMLElement, Offset>();
  for (const part of box.querySelectorAll<HTMLElement>(PARTS)) parts.set(part, partOffset(boxRect, part));

  const details = new Map<HTMLElement, Offset & Presence>();
  for (const detail of box.querySelectorAll<HTMLElement>(DETAILS)) {
    const group = detail.closest(GROUPS);
    if (!group) continue;
    const offset = offsetFrom(group.getBoundingClientRect(), detail, isEndGroup(group));
    details.set(detail, { ...offset, ...presence(detail) });
  }

  const lineHidden = new Map<HTMLElement, LineHidden>();
  for (const element of box.querySelectorAll<HTMLElement>(LINE_HIDDEN)) {
    lineHidden.set(element, {
      width: element.getBoundingClientRect().width,
      display: getComputedStyle(element).display,
    });
  }

  return { boxHeight: boxRect.height, parts, details, lineHidden };
}

function cssTimeInMs(value: string) {
  const time = value.trim();
  return Number.parseFloat(time) * (time.endsWith('ms') ? 1 : 1000);
}

const px = (value: number) => `${value}px`;
const moved = (from: Offset, to: Offset) => Math.abs(from.x - to.x) >= 0.5 || Math.abs(from.y - to.y) >= 0.5;

function glideTiming(element: HTMLElement) {
  const style = getComputedStyle(element);
  const timing: KeyframeAnimationOptions = {
    duration: cssTimeInMs(style.getPropertyValue('--duration-slow')),
    easing: style.getPropertyValue('--ease-in-out-custom').trim(),
  };
  return { timing, glides: !window.matchMedia('(prefers-reduced-motion: reduce)').matches };
}

const styleHolders = new WeakMap<HTMLElement, Animation>();

/** Drops a style held for a glide once it ends. Cancel fires a task later, so a newer glide's hold is left alone. */
function releaseWhenDone(element: HTMLElement, property: string, animation: Animation) {
  styleHolders.set(element, animation);
  const release = () => {
    if (styleHolders.get(element) === animation) element.style.removeProperty(property);
  };
  animation.addEventListener('finish', release);
  animation.addEventListener('cancel', release);
}

function animateStatus(
  status: HTMLElement,
  first: Presence,
  last: Presence,
  timing: KeyframeAnimationOptions,
  glides: boolean,
): Animation | undefined {
  if (first.opacity === last.opacity && first.height === last.height) return undefined;
  const keyframes: PropertyIndexedKeyframes = {
    opacity: [first.opacity, last.opacity],
    visibility: ['visible', 'visible'],
  };
  if (glides) {
    keyframes.height = [px(first.height), px(last.height)];
    keyframes.minHeight = ['0px', '0px'];
  }
  status.style.overflow = 'hidden';
  const animation = status.animate(keyframes, timing);
  releaseWhenDone(status, 'overflow', animation);
  return animation;
}

/**
 * Text the one-line layout drops grows in and shrinks out in place, so it never lands on the input
 * mid-slide. Leaving, it stays laid out until the glide ends; a negative margin swallows its flex gap,
 * so neither end of the glide jumps by the gap.
 */
function glideLineHidden(
  element: HTMLElement,
  from: LineHidden,
  to: LineHidden,
  timing: KeyframeAnimationOptions,
  glides: boolean,
): Animation | undefined {
  const leaving = to.width < 0.5;
  if (leaving && !glides) return undefined;
  const keyframes: PropertyIndexedKeyframes = { opacity: leaving ? [1, 0] : [0, 1] };
  if (glides) {
    const parent = element.parentElement;
    const gap = parent ? Number.parseFloat(getComputedStyle(parent).columnGap) || 0 : 0;
    const shown = { width: px(leaving ? from.width : to.width), margin: '0px' };
    const gone = { width: '0px', margin: px(-gap) };
    const [start, end] = leaving ? [shown, gone] : [gone, shown];
    keyframes.width = [start.width, end.width];
    keyframes.marginInlineEnd = [start.margin, end.margin];
    keyframes.minWidth = ['0px', '0px'];
    keyframes.overflow = ['clip', 'clip'];
  }
  if (!leaving) return element.animate(keyframes, timing);

  element.style.display = from.display;
  const animation = element.animate(keyframes, timing);
  releaseWhenDone(element, 'display', animation);
  return animation;
}

/** Applies a change to the status footer alone, such as it emptying, and glides its row open or shut. */
export function glideComposerStatus(
  status: HTMLElement,
  apply: () => void,
  running: readonly Animation[],
): Animation[] {
  if (typeof status.animate !== 'function') {
    apply();
    return [];
  }
  const first = presence(status);
  for (const animation of running) animation.cancel();
  apply();
  const { timing, glides } = glideTiming(status);
  const animation = animateStatus(status, first, presence(status), timing, glides);
  return animation ? [animation] : [];
}

/**
 * Applies a change between the one-line and open layouts, then glides every part from where it was
 * drawn. Reads positions mid-flight, so a change that interrupts a running glide starts from there.
 * Returns the running animations, to be cancelled by the next change.
 */
export function morphComposerLine(root: HTMLElement, apply: () => void, running: readonly Animation[]): Animation[] {
  const box = root.querySelector<HTMLElement>('[data-slot="composer-box"]');
  if (!box || typeof box.animate !== 'function') {
    apply();
    return [];
  }
  const first = readLayout(box);
  for (const animation of running) animation.cancel();
  apply();
  const last = readLayout(box);

  const { timing, glides } = glideTiming(root);
  const animations: Animation[] = [];

  if (glides && first.boxHeight !== last.boxHeight) {
    animations.push(box.animate({ height: [px(first.boxHeight), px(last.boxHeight)] }, timing));
  }

  if (glides) {
    for (const [part, to] of last.parts) {
      const from = first.parts.get(part);
      if (!from || !moved(from, to)) continue;
      animations.push(part.animate({ translate: [`${px(from.x - to.x)} ${px(from.y - to.y)}`, '0 0'] }, timing));
    }
  }

  for (const [detail, to] of last.details) {
    const from = first.details.get(detail);
    if (!from || from.opacity === to.opacity) continue;
    if (to.shown) {
      animations.push(detail.animate({ opacity: [from.opacity, to.opacity] }, timing));
      continue;
    }
    // Leaving, it holds the spot and width it had in its group and is gone before the input slides over it.
    const held = `${px(from.x - to.x)} ${px(from.y - to.y)}`;
    animations.push(
      detail.animate(
        {
          opacity: [from.opacity, to.opacity],
          visibility: ['visible', 'visible'],
          translate: [held, held],
          width: [px(from.width), px(from.width)],
          maxWidth: ['none', 'none'],
        },
        { ...timing, duration: Number(timing.duration) / 2 },
      ),
    );
  }

  for (const [element, to] of last.lineHidden) {
    const from = first.lineHidden.get(element);
    if (!from || Math.abs(from.width - to.width) < 0.5) continue;
    const glide = glideLineHidden(element, from, to, timing, glides);
    if (glide) animations.push(glide);
  }

  return animations;
}
