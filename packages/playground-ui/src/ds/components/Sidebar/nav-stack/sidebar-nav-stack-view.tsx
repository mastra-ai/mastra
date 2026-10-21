import { ArrowLeftIcon } from 'lucide-react';
import React from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { navItemClasses } from '../nav/sidebar-nav-item-classes';
import { useSidebar } from '../root/sidebar-context';
import { useSidebarNavStack } from './sidebar-nav-stack-context';
import { sidebarNavStackPageClasses } from './sidebar-nav-stack-page-classes';
import { cn } from '@/lib/utils';

export type SidebarNavStackViewProps = ComponentPropsWithoutRef<'div'> & {
  value: string;
  title: string;
  backLabel?: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  onBack?: () => void;
};

export function SidebarNavStackView({
  value,
  title,
  backLabel = 'Back to main navigation',
  returnFocusRef,
  onBack,
  children,
  className,
  ...props
}: SidebarNavStackViewProps) {
  const { state } = useSidebar();
  const { activeValue, closeView } = useSidebarNavStack();
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
      data-slot="sidebar-nav-stack-view"
      data-value={value}
      aria-hidden={!active}
      inert={!active}
      className={sidebarNavStackPageClasses(active, 'view', className)}
    >
      <button
        ref={backRef}
        type="button"
        aria-label={`${backLabel}: ${title}`}
        onClick={handleBack}
        className={cn(navItemClasses(), 'mb-2 grid grid-cols-[2rem_1fr_2rem] px-1')}
      >
        <ArrowLeftIcon className="justify-self-center" aria-hidden="true" />
        <span className="min-w-0 truncate text-center">{title}</span>
        <span aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}
