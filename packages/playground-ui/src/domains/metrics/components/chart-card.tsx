import type { ReactNode } from 'react';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { cn } from '@/lib/utils';

export type ChartCardProps = {
  title: string;
  description?: string;
  /** The headline number, top right: a `MetricsCard.Summary`. Its slot has a fixed width, so the title wraps the same loading or loaded. */
  summary?: ReactNode;
  /** Top-bar buttons revealed on hover, e.g. "View in Traces". */
  actions?: ReactNode;
  /** Tabs and legend above the body; they stay in every state. */
  toolbar?: ReactNode;
  /** Previous data stays on screen, dimmed, while a new range or filter loads. */
  isUpdating?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Pure layout for a metrics chart card. The body has a fixed height, so the loading,
 * error, empty and loaded states take the same room and nothing shifts around the card.
 */
export function ChartCard({
  title,
  description,
  summary,
  actions,
  toolbar,
  isUpdating = false,
  className,
  children,
}: ChartCardProps) {
  const fade = cn('transition-opacity duration-200', isUpdating && 'opacity-50');
  return (
    <MetricsCard className={cn('min-h-0! min-w-0!', className)}>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title={title} description={description} />
        {actions && <MetricsCard.Actions reveal="hover">{actions}</MetricsCard.Actions>}
        {summary && <div className={cn('order-last flex w-24 shrink-0 justify-end', fade)}>{summary}</div>}
      </MetricsCard.TopBar>
      <MetricsCard.Content className="flex flex-col gap-4 overflow-visible">
        {toolbar}
        <div className={cn('relative flex h-60 min-h-0 min-w-0 flex-col', fade)}>{children}</div>
      </MetricsCard.Content>
    </MetricsCard>
  );
}
