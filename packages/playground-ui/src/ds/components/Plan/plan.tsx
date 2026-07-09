import { CheckIcon, ClipboardList, CopyIcon, Maximize2, Minimize2 } from 'lucide-react';
import { createContext, Fragment, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode, RefObject } from 'react';

import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

const DEFAULT_COLLAPSED_HEIGHT = 220;
const TITLE_CODE_SPAN_PATTERN = /(`[^`]+`)/g;

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

interface PlanContextValue {
  canExpand: boolean;
  collapsedHeight: number;
  isExpanded: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  setCanExpand: (canExpand: boolean) => void;
  toggleExpanded: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const usePlanContext = () => {
  const context = use(PlanContext);

  if (!context) {
    throw new Error('Plan compound components must be rendered inside <Plan>.');
  }

  return context;
};

export interface PlanRootProps extends ComponentProps<'div'> {
  collapsedHeight?: number;
}

export function PlanRoot({ children, collapsedHeight = DEFAULT_COLLAPSED_HEIGHT, className, ...props }: PlanRootProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = useCallback(() => {
    if (!canExpand) return;

    setIsExpanded(current => !current);
  }, [canExpand]);

  const contextValue = useMemo(
    () => ({
      canExpand,
      collapsedHeight,
      isExpanded,
      contentRef,
      setCanExpand,
      toggleExpanded,
    }),
    [canExpand, collapsedHeight, isExpanded, toggleExpanded],
  );

  return (
    <PlanContext.Provider value={contextValue}>
      <div
        data-slot="plan"
        className={cn('w-full max-w-full overflow-hidden rounded-xl bg-surface3', className)}
        {...props}
      >
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

export interface PlanLabelProps extends Omit<ComponentProps<'div'>, 'children'> {
  children?: ReactNode;
}

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

export interface PlanStatusProps extends Omit<ComponentProps<typeof Badge>, 'icon' | 'size'> {
  variant?: BadgeVariant;
}

export function PlanStatus({ children, variant = 'default', ...props }: PlanStatusProps) {
  return (
    <Badge variant={variant} size="xs" icon={<span className="size-1 rounded-full bg-current" />} {...props}>
      {children}
    </Badge>
  );
}

export interface PlanCopyButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'children' | 'onClick' | 'size' | 'tooltip' | 'variant'
> {
  content: string;
}

export function PlanCopyButton({ content, ...props }: PlanCopyButtonProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 1500, showToast: false });

  const handleCopy = useCallback(() => {
    copyToClipboard(content);
  }, [content, copyToClipboard]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      tooltip="Copy plan"
      aria-label="Copy plan"
      onClick={handleCopy}
      {...props}
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

const renderStringTitle = (title: string) => {
  let offset = 0;

  return title.split(TITLE_CODE_SPAN_PATTERN).flatMap(part => {
    const key = `${offset}:${part}`;
    offset += part.length;

    if (!part) return [];

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} className="rounded-md bg-surface4 px-1.5 py-0.5 font-mono text-ui-sm text-neutral6">
          {part.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
};

const renderTitle = (title: ReactNode) => {
  if (typeof title === 'string') return renderStringTitle(title);

  return title;
};

export function PlanTitle({ children, className, ...props }: PlanTitleProps) {
  return (
    <Txt as="h3" variant="header-sm" className={cn('font-semibold text-neutral7', className)} {...props}>
      {renderTitle(children)}
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
      as="p"
      variant="ui-xs"
      font="mono"
      title={children}
      className={cn('max-w-full overflow-hidden truncate text-neutral3', className)}
      {...props}
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
  const { canExpand, collapsedHeight, contentRef, isExpanded, setCanExpand, toggleExpanded } = usePlanContext();
  const shouldClipContent = canExpand && !isExpanded;
  const isContentClickable = shouldClipContent;

  const handleContentKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      toggleExpanded();
    },
    [toggleExpanded],
  );

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      setCanExpand(content.scrollHeight > collapsedHeight);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(content);

    return () => observer.disconnect();
  }, [children, collapsedHeight, contentRef, setCanExpand]);

  return (
    <div
      data-slot="plan-content"
      role={isContentClickable ? 'button' : undefined}
      tabIndex={isContentClickable ? 0 : undefined}
      aria-label={isContentClickable ? 'Expand plan' : undefined}
      onClick={isContentClickable ? toggleExpanded : undefined}
      onKeyDown={isContentClickable ? handleContentKeyDown : undefined}
      className={cn(
        'relative outline-none',
        shouldClipContent && 'overflow-hidden pb-16',
        isContentClickable && 'cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-border2',
        className,
      )}
      style={shouldClipContent ? { ...style, maxHeight: collapsedHeight } : style}
      {...props}
    >
      <div ref={contentRef}>
        <div className="text-neutral6 [&_code]:bg-surface4 [&_h1]:text-header-md [&_h1]:leading-header-md [&_h2]:text-header-sm [&_h2]:leading-header-sm [&_h3]:text-ui-lg [&_h3]:leading-ui-lg [&_p]:text-ui-md [&_p]:leading-6">
          <MarkdownRenderer>{children}</MarkdownRenderer>
        </div>
      </div>

      {shouldClipContent && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent via-surface3/90 to-surface3"
        />
      )}
    </div>
  );
}

export interface PlanFileProps extends Omit<ComponentProps<'div'>, 'children'> {
  children: string;
}

export function PlanFile({ children, className, ...props }: PlanFileProps) {
  return (
    <div data-slot="plan-file" className={className} {...props}>
      <Txt as="p" variant="ui-xs" className="mb-2 text-neutral3">
        Plan file
      </Txt>
      <Txt as="p" variant="ui-sm" className="break-all font-mono text-neutral6">
        {children}
      </Txt>
    </div>
  );
}

export type PlanControlsProps = ComponentProps<'div'>;

export function PlanControls({ children, className, ...props }: PlanControlsProps) {
  const { canExpand, isExpanded } = usePlanContext();
  const shouldClipContent = canExpand && !isExpanded;
  const controls = children ?? <PlanExpandButton />;
  const hasActions = Boolean(children);
  const shouldRender = canExpand || hasActions;

  if (!shouldRender) return null;

  return (
    <div
      data-slot="plan-controls"
      className={cn('relative z-10 flex justify-center', shouldClipContent ? '-mt-14 pb-1' : 'mt-4', className)}
      onClick={event => event.stopPropagation()}
      {...props}
    >
      <div
        className={cn(
          'grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-2',
          !hasActions && 'max-w-max',
          hasActions && 'px-10',
        )}
      >
        {controls}
      </div>
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

export interface PlanExpandButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'aria-label' | 'children' | 'onClick' | 'size' | 'variant'
> {}

export function PlanExpandButton(props: PlanExpandButtonProps) {
  const { canExpand, isExpanded, toggleExpanded } = usePlanContext();

  if (!canExpand) return <span aria-hidden="true" />;

  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      aria-label={isExpanded ? 'Collapse plan' : 'Expand plan'}
      onClick={toggleExpanded}
      {...props}
    >
      {isExpanded ? <Minimize2 /> : <Maximize2 />}
      {isExpanded ? 'Collapse plan' : 'Expand plan'}
    </Button>
  );
}
