import { ArrowLeftIcon } from 'lucide-react';
import React from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useSidebarNewNavStack } from './sidebar-new-nav-stack-context';
import { sidebarNewNavStackPageClasses } from './sidebar-new-nav-stack-page-classes';
import { useMainSidebar } from '@/ds/components/MainSidebar/main-sidebar-context';
import { navItemClasses } from '@/ds/components/MainSidebar/main-sidebar-nav-item-classes';
import { cn } from '@/lib/utils';

export type SidebarNewNavStackViewProps = ComponentPropsWithoutRef<'div'> & {
  value: string;
  title: string;
  backLabel?: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  onBack?: () => void;
};

export function SidebarNewNavStackView({
  value,
  title,
  backLabel = 'Back to main navigation',
  returnFocusRef,
  onBack,
  children,
  className,
  ...props
}: SidebarNewNavStackViewProps) {
  const { state } = useMainSidebar();
  const { activeValue, closeView } = useSidebarNewNavStack();
  const active = state !== 'collapsed' && activeValue === value;
  const backRef = React.useRef<HTMLButtonElement>(null);
  const wasActiveRef = React.useRef(active);

  React.useEffect(() => {
    if (active && !wasActiveRef.current) backRef.current?.focus();
    wasActiveRef.current = active;
  }, [active]);

  React.useEffect(() => {
    if (!active) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      closeView(returnFocusRef);
      onBack?.();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, closeView, onBack, returnFocusRef]);

  function handleBack() {
    closeView(returnFocusRef);
    onBack?.();
  }

  return (
    <div
      {...props}
      data-slot="sidebar-new-nav-stack-view"
      data-value={value}
      aria-hidden={!active}
      inert={!active}
      className={sidebarNewNavStackPageClasses(active, 'view', className)}
    >
      <button
        ref={backRef}
        type="button"
        aria-label={`${backLabel}: ${title}`}
        onClick={handleBack}
        className={cn(
          navItemClasses(),
          'mb-2 grid grid-cols-[2rem_1fr_2rem] px-1 text-muted-foreground hover:text-foreground',
        )}
      >
        <ArrowLeftIcon className="justify-self-center" aria-hidden="true" />
        <span className="min-w-0 truncate text-center">{title}</span>
        <span aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}
