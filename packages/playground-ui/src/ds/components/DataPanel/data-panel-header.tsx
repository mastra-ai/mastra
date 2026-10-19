import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface DataPanelHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataPanelHeader({ className, children }: DataPanelHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  useWrapMetadataWhenCrowded(ref);

  return (
    <div
      ref={ref}
      data-slot="data-panel-header"
      className={cn(
        'group/data-panel-header',
        // Same box as the app `Header`. Leading `CloseButton`, then the heading
        // (+ inline metadata via `HeaderContent`), then `HeaderActions` pushed to the right edge.
        // `flex-wrap` drops the actions onto a second row when the panel is too narrow for one.
        // `gap-0.5` is the slight gap between the close arrow and the heading.
        // `py-1` keeps 28px controls + border within the 40px min height, so the divider
        // lines up with an adjacent app `Header` instead of sitting 1px lower.
        'flex min-h-header-default w-full flex-wrap items-center gap-0.5 px-2 py-1',
        // Wrapped (`data-wrapped`, see `useWrapMetadataWhenCrowded`): heading and actions share the first row, the metadata
        // takes a full-width row below them. `HeaderContent`, `Heading` and `Metadata` style themselves.
        'data-wrapped:gap-x-2 data-wrapped:gap-y-0',
        // Bottom border only when something follows the header (i.e. the panel is expanded).
        // When the panel is collapsed and the header is the only child, the border auto-hides.
        // Same edge color as the app `Header` it docks beside.
        'not-last:border-b not-last:border-surface-rim',
        className,
      )}
    >
      {children}
    </div>
  );
}

// Laid out at natural width: nothing shrinks, clips or wraps, so the measure doesn't depend on the current layout.
const PROBE_CLASSES =
  'invisible pointer-events-none absolute top-0 left-0 flex w-max items-center gap-0.5 **:max-w-none! **:flex-none! **:overflow-visible!';

/**
 * Sets `data-wrapped` on the header while its heading, every metadata pill and the actions don't fit
 * side by side, so CSS moves the metadata to its own row. Measured on a hidden copy of the header,
 * again whenever the header resizes or its content changes. Only CSS reads the attribute, so it's
 * set on the element directly instead of re-rendering the header.
 */
function useWrapMetadataWhenCrowded(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const header = ref.current;
    if (!header || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      if (!header.querySelector('[data-slot="data-panel-metadata"]')) {
        header.removeAttribute('data-wrapped');
        return;
      }
      const probe = document.createElement('div');
      probe.className = PROBE_CLASSES;
      probe.setAttribute('aria-hidden', 'true');
      for (const child of header.children) probe.appendChild(child.cloneNode(true));
      // Next to the header (same styles) but outside it, so the content observer doesn't see it.
      header.after(probe);
      const style = getComputedStyle(header);
      const needed =
        probe.getBoundingClientRect().width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      probe.remove();
      header.toggleAttribute('data-wrapped', needed > header.clientWidth);
    };

    // One check covers a burst of changes; re-queueing on every change could keep pushing it back.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        measure();
      }, 16);
    };

    const resize = new ResizeObserver(schedule);
    resize.observe(header);
    const content = new MutationObserver(schedule);
    content.observe(header, { childList: true, subtree: true, characterData: true });
    measure();

    return () => {
      clearTimeout(timer);
      resize.disconnect();
      content.disconnect();
    };
  }, [ref]);
}
