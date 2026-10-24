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

// All theming lives in `.mastra-toaster` (see toast.css) — sonner reads --success-bg / --error-bg / etc.
// from richColors mode. `rest` is spread first so callers can't override the closeButton / richColors
// contract (sonner's per-type tinted colors only kick in with richColors, and the close button is the
// only built-in dismiss affordance we expose).
export const Toaster = ({ className, toastOptions, icons, variant = 'default', ...rest }: ToasterProps) => {
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const measurements = Array.from(root.querySelectorAll<HTMLElement>('[data-content]'), content => ({
        content,
        overflows: contentOverflows(content),
      }));
      for (const { content, overflows } of measurements) {
        if (overflows && content.tabIndex !== 0) content.tabIndex = 0;
        else if (!overflows && content.hasAttribute('tabindex')) content.removeAttribute('tabindex');
      }
    };
    const resize = new ResizeObserver(measure);
    const sync = () => {
      resize.disconnect();
      for (const content of root.querySelectorAll('[data-content]')) resize.observe(content);
      measure();
    };
    const mutations = new MutationObserver(sync);
    mutations.observe(root, { childList: true, subtree: true, characterData: true });
    sync();
    return () => {
      mutations.disconnect();
      resize.disconnect();
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
            <BrandLoader size="sm" className="w-5" />
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
