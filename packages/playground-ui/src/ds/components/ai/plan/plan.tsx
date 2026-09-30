import { CheckIcon, ClipboardList, CopyIcon, Maximize2, Minimize2 } from 'lucide-react';
import { createContext, useContext } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { CollapsibleBox, DEFAULT_COLLAPSED_HEIGHT, useCollapsibleBox } from '@/ds/components/CollapsibleBox';
import type { CollapsibleBoxState } from '@/ds/components/CollapsibleBox';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

const PlanContext = createContext<CollapsibleBoxState | null>(null);

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
  const contextValue = useCollapsibleBox({ collapsedHeight });

  return (
    <PlanContext.Provider value={contextValue}>
      <div data-slot="plan" className={cn('w-full overflow-hidden rounded-xl bg-card', className)} {...props}>
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
      <Icon size="xs" className="text-muted-foreground">
        <ClipboardList />
      </Icon>
      <Txt as="span" variant="caption" tone="muted">
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
    <Txt {...props} as="h3" variant="heading" tone="ink" className={className}>
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
      variant="meta"
      tone="muted"
      font="mono"
      title={children}
      className={cn('max-w-full truncate overflow-hidden', className)}
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

export function PlanContent({ children, ...props }: PlanContentProps) {
  const state = usePlanContext();

  return (
    <CollapsibleBox data-slot="plan-content" state={state} {...props}>
      <div className="[&_code]:bg-muted [&_h1]:text-title [&_h2]:text-heading [&_h3]:text-subheading [&_p]:text-body">
        <MarkdownRenderer className="text-foreground">{children}</MarkdownRenderer>
      </div>
    </CollapsibleBox>
  );
}

export interface PlanFileProps extends Omit<ComponentProps<'div'>, 'children'> {
  children: string;
}

export function PlanFile({ children, className, ...props }: PlanFileProps) {
  return (
    <div data-slot="plan-file" className={className} {...props}>
      <Txt as="p" variant="meta" tone="muted" className="mb-2">
        Plan file
      </Txt>
      <Txt as="p" variant="caption" tone="ink" font="mono" className="break-all">
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
  'aria-label' | 'children' | 'onClick' | 'size' | 'type'
>;

export function PlanExpandButton({ className, variant = 'default', ...props }: PlanExpandButtonProps) {
  const { isExpanded, isClipped, toggleExpanded } = usePlanContext();

  // Nothing to expand: the collapsed card already shows the whole plan.
  if (!isClipped && !isExpanded) return null;

  return (
    <Button
      {...props}
      className={cn('shrink-0 whitespace-nowrap', className)}
      type="button"
      variant={variant}
      size="sm"
      aria-label={isExpanded ? 'Collapse plan' : 'Expand plan'}
      onClick={toggleExpanded}
      icon={isExpanded ? <Minimize2 /> : <Maximize2 />}
    >
      {isExpanded ? 'Collapse plan' : 'Expand plan'}
    </Button>
  );
}
