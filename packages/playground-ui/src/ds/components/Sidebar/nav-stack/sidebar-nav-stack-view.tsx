import { Tabs } from '@base-ui/react/tabs';
import React from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { navItemClasses } from '../nav/sidebar-nav-item-classes';
import { useSidebar } from '../root/sidebar-context';
import { useSidebarNavStack } from './sidebar-nav-stack-context';
import { sidebarNavStackPageClasses } from './sidebar-nav-stack-page-classes';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { cn } from '@/lib/utils';

export type SidebarNavStackViewProps = ComponentPropsWithoutRef<'div'> & {
  value: string;
  title: string;
  backLabel?: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  onBack?: () => void;
  /** Escape goes back, as it should from a menu. Turn it off for a view that accompanies a whole page. */
  closeOnEscape?: boolean;
};

export function SidebarNavStackView({
  value,
  title,
  backLabel = 'Back to main navigation',
  returnFocusRef,
  onBack,
  closeOnEscape = true,
  children,
  className,
  ...props
}: SidebarNavStackViewProps) {
  const { state } = useSidebar();
  const { activeValue, closeView } = useSidebarNavStack();
  const open = activeValue === value;
  const active = state !== 'collapsed' && open;
  const backRef = React.useRef<HTMLButtonElement>(null);
  const wasOpenRef = React.useRef(open);

  // Opening the view moves focus to its Back button. Expanding the sidebar onto a view that was already open doesn't:
  // focus stays where it was.
  React.useEffect(() => {
    if (active && !wasOpenRef.current) backRef.current?.focus();
    wasOpenRef.current = open;
  }, [active, open]);

  React.useEffect(() => {
    if (!active || !closeOnEscape) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      closeView(returnFocusRef);
      onBack?.();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, closeOnEscape, closeView, onBack, returnFocusRef]);

  function handleBack() {
    closeView(returnFocusRef);
    onBack?.();
  }

  return (
    <Tabs.Panel
      {...props}
      value={value}
      role={undefined}
      tabIndex={undefined}
      data-slot="sidebar-nav-stack-view"
      data-value={value}
      aria-hidden={!active}
      className={sidebarNavStackPageClasses('view', className)}
    >
      <button
        ref={backRef}
        type="button"
        aria-label={`${backLabel}: ${title}`}
        onClick={handleBack}
        className={cn(navItemClasses(), 'mb-2 grid grid-cols-[2rem_1fr_2rem] px-1')}
      >
        <IconArrowLeft className="justify-self-center" aria-hidden="true" />
        <span className="min-w-0 truncate text-center">{title}</span>
        <span aria-hidden="true" />
      </button>
      {children}
    </Tabs.Panel>
  );
}
