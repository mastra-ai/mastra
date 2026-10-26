// Sonner 2.0.7 measures scaled cards and misses height changes (emilkowalski/sonner#337); toaster.css uses these.

type Card = { height: number; type: string | undefined; animations: Animation[] };

const layoutUnitsPerPixel = 64;

function toastHeight(notification: HTMLElement) {
  const style = getComputedStyle(notification);
  if (notification.style.height && notification.style.height !== 'auto') return Number.parseFloat(style.height);
  const bounds = notification.getBoundingClientRect();
  const scale = style.transform === 'none' ? 1 : new DOMMatrixReadOnly(style.transform).d;
  const children = Array.from(notification.children);
  const bottom = children.reduce((height, child) => {
    const childStyle = getComputedStyle(child);
    if (childStyle.position === 'absolute' || childStyle.position === 'fixed' || childStyle.display === 'none') {
      return height;
    }
    const margin = childStyle.marginBottom === 'auto' ? 0 : Number.parseFloat(childStyle.marginBottom);
    const childBounds = child.getBoundingClientRect();
    const bottom =
      scale > 0
        ? (childBounds.bottom - bounds.top) / scale
        : scale < 0
          ? (bounds.bottom - childBounds.top) / -scale
          : child instanceof HTMLElement
            ? child.offsetTop + child.offsetHeight
            : 0;
    return Math.max(height, bottom + margin);
  }, 0);
  const minimum = Number.parseFloat(style.minHeight);
  const maximum = Number.parseFloat(style.maxHeight);
  return Math.max(
    Number.isFinite(minimum) ? minimum : 0,
    Math.min(
      Number.isFinite(maximum) ? maximum : Infinity,
      bottom + Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderBottomWidth),
    ),
  );
}

function revealsSettledPromise(notification: HTMLElement, previous: Card, interrupted: boolean, reveal: number) {
  return (
    notification.dataset.promise === 'true' &&
    notification.dataset.front === 'true' &&
    (notification.dataset.type === 'success' || notification.dataset.type === 'error') &&
    (previous.type === 'loading' || interrupted) &&
    reveal > 0.5
  );
}

function revealSettledPromise(notification: HTMLElement, reveal: number, radius: string) {
  const style = getComputedStyle(notification);
  const duration = Number.parseFloat(style.getPropertyValue('--duration-normal'));
  const easing = style.getPropertyValue('--toast-settle-ease').trim();
  const animations = [
    notification.animate(
      [
        {
          translate: `0 ${notification.dataset.yPosition === 'bottom' ? reveal : 0}px`,
          clipPath: `inset(0 0 ${reveal}px 0 round ${radius})`,
        },
        { translate: '0 0', clipPath: `inset(0 round ${radius})` },
      ],
      { duration, easing },
    ),
  ];
  for (const detail of notification.querySelectorAll('[data-description], :scope > [data-content] ~ *')) {
    animations.push(detail.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing }));
  }
  return animations;
}

export function createToastStackLayout(reduceMotion: MediaQueryList) {
  const cards = new Map<HTMLElement, Card>();

  const cancelAnimations = () => {
    for (const card of cards.values()) {
      for (const animation of card.animations) animation.cancel();
    }
  };

  const measure = (root: HTMLElement) => {
    const stacks = Array.from(root.querySelectorAll<HTMLElement>('[data-sonner-toaster]'), stack => {
      const gap = Number.parseFloat(getComputedStyle(stack).getPropertyValue('--gap'));
      let offset = 0;
      const notifications = Array.from(stack.querySelectorAll<HTMLElement>(':scope > [data-sonner-toast]'))
        .filter(notification => notification.dataset.removed !== 'true' && notification.getClientRects().length > 0)
        .map(notification => {
          const height = Math.round(toastHeight(notification) * layoutUnitsPerPixel) / layoutUnitsPerPixel;
          const position = offset;
          offset += height + gap;
          const previous = cards.get(notification);
          const style = getComputedStyle(notification);
          const translation = style.translate === 'none' ? 0 : Number.parseFloat(style.translate.split(' ')[1] ?? '0');
          const reveal = previous ? height - previous.height + translation : 0;
          return { notification, height, position, previous, reveal, radius: style.borderRadius };
        });
      return { stack, notifications };
    });

    return () => {
      for (const { stack, notifications } of stacks) {
        stack.style.setProperty('--mastra-front-height', `${notifications[0]?.height ?? 0}px`);
        stack.setAttribute('data-mastra-measured', '');
        for (const { notification, height, position, previous, reveal, radius } of notifications) {
          notification.style.setProperty('--mastra-toast-height', `${height}px`);
          notification.style.setProperty('--mastra-toast-offset', `${position}px`);
          notification.setAttribute('data-mastra-measured', '');
          if (previous?.height === height && previous.type === notification.dataset.type) continue;
          const interrupted = previous?.animations.some(animation => animation.playState === 'running') ?? false;
          for (const animation of previous?.animations ?? []) animation.cancel();
          const animations =
            previous && !reduceMotion.matches && revealsSettledPromise(notification, previous, interrupted, reveal)
              ? revealSettledPromise(notification, reveal, radius)
              : [];
          cards.set(notification, { height, type: notification.dataset.type, animations });
        }
      }
      for (const [notification, card] of cards) {
        if (root.contains(notification) && notification.dataset.removed !== 'true') continue;
        for (const animation of card.animations) animation.cancel();
        cards.delete(notification);
      }
    };
  };

  return { measure, cancelAnimations };
}
