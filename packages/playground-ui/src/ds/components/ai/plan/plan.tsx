import { CheckIcon, ClipboardList, CopyIcon, Maximize2, Minimize2 } from 'lucide-react';
import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

const DEFAULT_COLLAPSED_HEIGHT = 220;

interface PlanContextValue {
  collapsedHeight: number;
  isExpanded: boolean;
  /** Whether the rendered content overflows the collapsed height (measured, not estimated). */
  isClipped: boolean;
  setClipped: (clipped: boolean) => void;
  toggleExpanded: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const usePlanContext = () => {
  const context = useContext(PlanContext);

  if (!context) {
    throw new Error('Plan compound components must be rendered inside <Plan>.');
  }

  return context;
};

export interface PlanProps extends ComponentProps<'div'> {
  collapsedHeight?: number;
}

export function Plan({ children, collapsedHeight = DEFAULT_COLLAPSED_HEIGHT, className, ...props }: PlanProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClipped, setClipped] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(current => !current);
  };

  const contextValue = {
    collapsedHeight,
    isExpanded,
    isClipped,
    setClipped,
    toggleExpanded,
  };

  return (
    <PlanContext.Provider value={contextValue}>
      <div data-slot="plan" className={cn('w-full overflow-hidden rounded-xl bg-surface3', className)} {...props}>
        {children}
      </div>
    </PlanContext.Provider>
  );
}

export type PlanHeaderProps = ComponentProps<'div'>;

export function PlanHeader({ children, className, ...props }: PlanHeaderProps) {
  return (
    <div
      data-slot="plan-header"
      className={cn('flex min-h-10 items-center justify-between gap-3 px-4 pt-3', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type PlanLabelProps = ComponentProps<'div'>;

export function PlanLabel({ children = 'Plan', className, ...props }: PlanLabelProps) {
  return (
    <div data-slot="plan-label" className={cn('flex min-w-0 items-center gap-2', className)} {...props}>
      <Icon size="sm" className="text-icon3">
        <ClipboardList />
      </Icon>
      <Txt as="span" variant="ui-sm" className="text-neutral4">
        {children}
      </Txt>
    </div>
  );
}

export type PlanHeaderActionsProps = ComponentProps<'div'>;

export function PlanHeaderActions({ children, className, ...props }: PlanHeaderActionsProps) {
  return (
    <div data-slot="plan-header-actions" className={cn('flex shrink-0 items-center gap-1', className)} {...props}>
      {children}
    </div>
  );
}

export type PlanStatusProps = Omit<ComponentProps<typeof Badge>, 'icon' | 'indicator' | 'size'>;

export function PlanStatus({ children, variant = 'neutral', ...props }: PlanStatusProps) {
  return (
    <Badge {...props} variant={variant} size="xs" indicator="dot">
      {children}
    </Badge>
  );
}

export interface PlanCopyButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'aria-label' | 'children' | 'onClick' | 'size' | 'tooltip' | 'type' | 'variant'
> {
  content: string;
}

export function PlanCopyButton({ content, ...props }: PlanCopyButtonProps) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: content,
    copiedDuration: 1500,
    showToast: false,
  });

  return (
    <Button
      {...props}
      type="button"
      variant="ghost"
      size="icon-sm"
      tooltip="Copy plan"
      aria-label="Copy plan"
      onClick={handleCopy}
    >
      {isCopied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}

export type PlanBodyProps = ComponentProps<'div'>;

export function PlanBody({ children, className, ...props }: PlanBodyProps) {
  return (
    <div data-slot="plan-body" className={cn('px-5 pt-4 pb-5', className)} {...props}>
      {children}
    </div>
  );
}

export type PlanIntroProps = ComponentProps<'div'>;

export function PlanIntro({ children, className, ...props }: PlanIntroProps) {
  return (
    <div data-slot="plan-intro" className={cn('mb-5 space-y-1', className)} {...props}>
      {children}
    </div>
  );
}

export interface PlanTitleProps extends Omit<ComponentProps<typeof Txt>, 'as' | 'children' | 'variant'> {
  children: ReactNode;
}

export function PlanTitle({ children, className, ...props }: PlanTitleProps) {
  return (
    <Txt {...props} as="h3" variant="header-sm" className={cn('text-neutral7 font-semibold', className)}>
      {children}
    </Txt>
  );
}

export interface PlanPathProps extends Omit<
  ComponentProps<typeof Txt>,
  'as' | 'children' | 'font' | 'title' | 'variant'
> {
  children: string;
}

const getFileName = (path: string) => {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
};

export function PlanPath({ children, className, ...props }: PlanPathProps) {
  return (
    <Txt
      {...props}
      as="p"
      variant="ui-xs"
      font="mono"
      title={children}
      className={cn('max-w-full truncate overflow-hidden text-neutral3', className)}
    >
      {getFileName(children)}
    </Txt>
  );
}

export type PlanMainProps = ComponentProps<'div'>;

export function PlanMain({ children, className, ...props }: PlanMainProps) {
  return (
    <div data-slot="plan-main" className={cn('relative', className)} {...props}>
      {children}
    </div>
  );
}

export interface PlanContentProps extends Omit<ComponentProps<'div'>, 'children'> {
  children: string;
}

export function PlanContent({ children, className, style, ...props }: PlanContentProps) {
  const { collapsedHeight, isExpanded, isClipped, setClipped } = usePlanContext();
  const contentRef = useRef<HTMLDivElement>(null);

  // Measure the rendered content against the collapsed height so the clip hint
  // and expand control track actual overflow — not an estimate of it.
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const measure = () => setClipped(element.scrollHeight > collapsedHeight);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children, collapsedHeight, setClipped]);

  const showClipHint = !isExpanded && isClipped;

  return (
    <div
      data-slot="plan-content"
      // The clip hint masks the content itself, so it reads correctly on any card background.
      {...(showClipHint ? { 'data-clipped': '' } : {})}
      className={cn(
        'relative',
        !isExpanded && 'overflow-hidden',
        showClipHint && 'mask-b-from-60% mask-b-to-100%',
        className,
      )}
      style={!isExpanded ? { ...style, maxHeight: collapsedHeight } : style}
      {...props}
    >
      <div
        ref={contentRef}
        className="[&_code]:bg-surface4 [&_h1]:text-header-md [&_h1]:leading-header-md [&_h2]:text-header-sm [&_h2]:leading-header-sm [&_h3]:text-ui-lg [&_h3]:leading-ui-lg [&_p]:text-ui-md [&_p]:leading-6"
      >
        <MarkdownRenderer className="text-neutral6">{children}</MarkdownRenderer>
      </div>
    </div>
  );
}

export interface PlanFileProps extends Omit<ComponentProps<'div'>, 'children'> {
  children: string;
}

export function PlanFile({ children, className, ...props }: PlanFileProps) {
  return (
    <div data-slot="plan-file" className={className} {...props}>
      <Txt as="p" variant="ui-xs" className="text-neutral3 mb-2">
        Plan file
      </Txt>
      <Txt as="p" variant="ui-sm" className="text-neutral6 font-mono break-all">
        {children}
      </Txt>
    </div>
  );
}

export type PlanControlsProps = ComponentProps<'div'>;

export function PlanControls({ children, className, ...props }: PlanControlsProps) {
  const hasActions = Boolean(children);

  return (
    <div
      data-slot="plan-controls"
      className={cn('relative z-10 mt-4 flex justify-center empty:hidden', className)}
      {...props}
    >
      {hasActions ? (
        <div className="grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-2 px-10">{children}</div>
      ) : (
        <PlanExpandButton />
      )}
    </div>
  );
}

export type PlanActionGroupProps = ComponentProps<'div'>;

export function PlanActionGroup({ children, className, ...props }: PlanActionGroupProps) {
  return (
    <div data-slot="plan-action-group" className={cn('flex justify-start gap-2 empty:hidden', className)} {...props}>
      {children}
    </div>
  );
}

export type PlanExpandButtonProps = Omit<
  ComponentProps<typeof Button>,
  'aria-label' | 'children' | 'onClick' | 'size' | 'type' | 'variant'
>;

export function PlanExpandButton({ className, ...props }: PlanExpandButtonProps) {
  const { isExpanded, isClipped, toggleExpanded } = usePlanContext();

  // Nothing to expand: the collapsed card already shows the whole plan.
  if (!isClipped && !isExpanded) return null;

  return (
    <Button
      {...props}
      className={cn('shrink-0 whitespace-nowrap', className)}
      type="button"
      variant="default"
      size="sm"
      aria-label={isExpanded ? 'Collapse plan' : 'Expand plan'}
      onClick={toggleExpanded}
    >
      {isExpanded ? <Minimize2 /> : <Maximize2 />}
      {isExpanded ? 'Collapse plan' : 'Expand plan'}
    </Button>
  );
}
