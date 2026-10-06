import type { ReactNode } from 'react';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { cn } from '@/lib/utils';

export type ChartCardProps = {
  title: string;
  description?: string;
  /** The card's headline number, top right. */
  summary?: { value: string; label?: string };
  /** Top-bar buttons revealed on hover, e.g. "Open in Traces". */
  actions?: ReactNode;
  /** First load: the summary shows a skeleton (charts take their own `isLoading`). */
  isLoading?: boolean;
  /** A new range or filter is loading: the previous data stays on screen, dimmed. */
  isUpdating?: boolean;
  /** The data failed to load: the summary hides (the chart's `ChartArea` says why). */
  isError?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * A chart card for the Observe pages: title, description, summary value and hover actions.
 * The content is a flex column (so `height="fill"` charts end cards in a row on one line) and
 * doesn't clip, so row hover insets and tooltips can reach past its edge.
 */
export function ChartCard({
  title,
  description,
  summary,
  actions,
  isLoading = false,
  isUpdating = false,
  isError = false,
  className,
  children,
}: ChartCardProps) {
  const fade = cn('transition-opacity duration-200', isUpdating && 'opacity-50');
  return (
    <MetricsCard className={cn('min-h-0! min-w-0!', className)}>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title={title} description={description} />
        {actions && <MetricsCard.Actions reveal="hover">{actions}</MetricsCard.Actions>}
        {summary && !isError && (
          <MetricsCard.Summary value={summary.value} label={summary.label} isLoading={isLoading} className={fade} />
        )}
      </MetricsCard.TopBar>
      <MetricsCard.Content className={cn('flex h-full flex-col gap-4 overflow-visible', fade)}>
        {children}
      </MetricsCard.Content>
    </MetricsCard>
  );
}
