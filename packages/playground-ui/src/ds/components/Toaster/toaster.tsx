import { InfoIcon, LightbulbIcon, OctagonAlertIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ToasterProps as SonnerToasterProps } from 'sonner';
import { Toaster as SonnerToaster } from 'sonner';
import { BrandLoader } from '../BrandLoader/brand-loader';
import { buttonVariants } from '../Button/Button';
import { cn } from '@/lib/utils';
import '../../../lib/toast.css';

export interface ToasterProps extends SonnerToasterProps {
  variant?: 'default' | 'neutral';
}

function contentOverflows(content: HTMLElement) {
  const style = getComputedStyle(content);
  const childrenHeight = Array.from(content.children).reduce((height, child) => {
    const childStyle = getComputedStyle(child);
    return (
      height +
      Number.parseFloat(childStyle.height) +
      Number.parseFloat(childStyle.marginTop) +
      Number.parseFloat(childStyle.marginBottom)
    );
  }, 0);
  const contentHeight =
    childrenHeight +
    Number.parseFloat(style.rowGap) * Math.max(0, content.childElementCount - 1) +
    Number.parseFloat(style.paddingTop) +
    Number.parseFloat(style.paddingBottom);
  return Math.round(contentHeight) > content.clientHeight;
}

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

// All theming lives in `.mastra-toaster` (see toast.css) — sonner reads --success-bg / --error-bg / etc.
// from richColors mode. `rest` is spread first so callers can't override the closeButton / richColors
// contract (sonner's per-type tinted colors only kick in with richColors, and the close button is the
// only built-in dismiss affordance we expose).
export const Toaster = ({ className, toastOptions, icons, variant = 'default', ...rest }: ToasterProps) => {
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const cards = new Map<HTMLElement, { height: number; type: string | undefined; animations: Animation[] }>();
    const stopMotion = () => {
      for (const card of cards.values()) {
        for (const animation of card.animations) animation.cancel();
      }
    };
    reduceMotion.addEventListener('change', stopMotion);
    const measure = () => {
      const measurements = Array.from(root.querySelectorAll<HTMLElement>('[data-content]'), content => ({
        content,
        overflows: contentOverflows(content),
      }));
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
            const translation =
              style.translate === 'none' ? 0 : Number.parseFloat(style.translate.split(' ')[1] ?? '0');
            const reveal = previous ? height - previous.height + translation : 0;
            return { notification, height, position, previous, reveal, radius: style.borderRadius };
          });
        return { stack, notifications };
      });
      for (const { content, overflows } of measurements) {
        if (overflows && content.tabIndex !== 0) content.tabIndex = 0;
        else if (!overflows && content.hasAttribute('tabindex')) content.removeAttribute('tabindex');
      }
      for (const { stack, notifications } of stacks) {
        stack.style.setProperty('--mastra-front-height', `${notifications[0]?.height ?? 0}px`);
        stack.setAttribute('data-mastra-measured', '');
        for (const { notification, height, position, previous, reveal, radius } of notifications) {
          notification.style.setProperty('--mastra-toast-height', `${height}px`);
          notification.style.setProperty('--mastra-toast-offset', `${position}px`);
          notification.setAttribute('data-mastra-measured', '');
          if (previous?.height === height && previous.type === notification.dataset.type) continue;
          const interrupted = previous?.animations.some(animation => animation.playState === 'running');
          for (const animation of previous?.animations ?? []) animation.cancel();
          const animations: Animation[] = [];
          if (
            previous &&
            !reduceMotion.matches &&
            notification.dataset.promise === 'true' &&
            notification.dataset.front === 'true' &&
            (notification.dataset.type === 'success' || notification.dataset.type === 'error') &&
            (previous.type === 'loading' || interrupted) &&
            reveal > 0.5
          ) {
            const duration = Number.parseFloat(getComputedStyle(notification).getPropertyValue('--duration-normal'));
            const easing = 'cubic-bezier(0.645, 0.045, 0.355, 1)';
            animations.push(
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
            );
            for (const detail of notification.querySelectorAll('[data-description], :scope > [data-content] ~ *')) {
              animations.push(detail.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing }));
            }
          }
          cards.set(notification, { height, type: notification.dataset.type, animations });
        }
      }
      for (const [notification, card] of cards) {
        if (root.contains(notification) && notification.dataset.removed !== 'true') continue;
        for (const animation of card.animations) animation.cancel();
        cards.delete(notification);
      }
    };
    const resize = new ResizeObserver(measure);
    const sync = () => {
      resize.disconnect();
      for (const child of root.querySelectorAll('[data-sonner-toast] > *')) resize.observe(child);
      measure();
    };
    const mutations = new MutationObserver(sync);
    mutations.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-removed'],
    });
    sync();
    return () => {
      mutations.disconnect();
      resize.disconnect();
      reduceMotion.removeEventListener('change', stopMotion);
      stopMotion();
    };
  }, []);
  return (
    <SonnerToaster
      ref={rootRef}
      {...rest}
      closeButton
      richColors
      icons={{
        success: <LightbulbIcon aria-hidden />,
        error: <OctagonAlertIcon aria-hidden />,
        warning: <TriangleAlertIcon aria-hidden />,
        info: <InfoIcon aria-hidden />,
        loading: (
          <span aria-hidden className="flex">
            <BrandLoader
              size="sm"
              className={cn('toast-promise-loader w-5', {
                'toast-promise-success': icons?.success === undefined,
                'toast-promise-error': icons?.error === undefined,
              })}
            />
          </span>
        ),
        ...icons,
      }}
      className={cn('mastra-toaster', variant === 'neutral' && 'mastra-toaster-neutral', className)}
      toastOptions={{
        duration: 5000,
        ...toastOptions,
        classNames: {
          actionButton: buttonVariants({ variant: 'link' }),
          cancelButton: buttonVariants({ variant: 'link' }),
          ...toastOptions?.classNames,
        },
      }}
    />
  );
};
