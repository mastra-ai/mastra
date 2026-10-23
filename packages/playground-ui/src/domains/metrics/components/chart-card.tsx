import type { ReactNode } from 'react';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsCardTitleMenuProps } from '@/ds/components/MetricsCard';
import { cn } from '@/lib/utils';

export type ChartCardProps = {
  /**
   * Card layout.
   * - `default`: title and description, the summary top right, a 240px body.
   * - `compact`: a one-line header (title, `total` on the right), and one card height, so cards
   *   in a grid line up; the chart fills what the toolbar leaves. For small cards in a grid.
   */
  variant?: 'default' | 'compact';
  title: string;
  /** Makes the title a dropdown of the card's views (e.g. by model, by provider). */
  titleMenu?: Omit<MetricsCardTitleMenuProps<string>, 'title' | 'className'>;
  /** Compact cards: the card's total, right of the title in the same type. */
  total?: string;
  /** Compact cards: a skeleton in place of `total`. */
  isLoading?: boolean;
  description?: string;
  /** The headline number, top right: a `MetricsCard.Summary`. Its slot has a fixed width, so the title wraps the same loading or loaded. */
  summary?: ReactNode;
  /** Top-bar buttons revealed on hover, e.g. "View in Traces". */
  actions?: ReactNode;
  /** Tabs and legend above the body; they stay in every state. */
  toolbar?: ReactNode;
  /** Previous data stays on screen, dimmed, while a new range or filter loads. */
  isUpdating?: boolean;
  /**
   * `fixed` (default): the body is one chart high in every state. `fit`: at least that high, and
   * taller when the content needs it, for lists that grow with "Show more".
   */
  bodyHeight?: 'fixed' | 'fit';
  className?: string;
  children: ReactNode;
};

/**
 * Pure layout for a metrics chart card. The body has a fixed height, so the loading,
 * error, empty and loaded states take the same room and nothing shifts around the card.
 */
export function ChartCard({
  variant = 'default',
  title,
  titleMenu,
  total,
  isLoading = false,
  description,
  summary,
  actions,
  toolbar,
  isUpdating = false,
  bodyHeight = 'fixed',
  className,
  children,
}: ChartCardProps) {
  const fade = cn('transition-opacity duration-200', isUpdating && 'opacity-50');
  const compact = variant === 'compact';
  return (
    <MetricsCard className={cn('min-h-0! min-w-0! grid-cols-1', compact && 'h-84', className)}>
      <MetricsCard.TopBar>
        <ChartCardHeading title={title} description={description} titleMenu={titleMenu} compact={compact} />
        {actions && <MetricsCard.Actions reveal="hover">{actions}</MetricsCard.Actions>}
        {compact && total !== undefined && <MetricsCard.Total value={total} isLoading={isLoading} className={fade} />}
        {!compact && summary && <div className={cn('order-last flex w-24 shrink-0 justify-end', fade)}>{summary}</div>}
      </MetricsCard.TopBar>
      <MetricsCard.Content className={cn('flex flex-col gap-4 overflow-visible', compact && 'min-h-0')}>
        {toolbar}
        <div
          className={cn(
            'relative flex min-h-0 min-w-0 flex-col',
            compact ? 'flex-1' : bodyHeight === 'fit' ? 'min-h-60' : 'h-60',
            fade,
          )}
        >
          {children}
        </div>
      </MetricsCard.Content>
    </MetricsCard>
  );
}

/** The title: a view menu, a lone compact title, or the default title, each with the description on default cards. */
function ChartCardHeading({
  title,
  description,
  titleMenu,
  compact,
}: Pick<ChartCardProps, 'title' | 'description' | 'titleMenu'> & { compact: boolean }) {
  if (titleMenu) {
    return (
      <div className="flex flex-col">
        <MetricsCard.TitleMenu title={title} {...titleMenu} />
        {!compact && description && <MetricsCard.Description>{description}</MetricsCard.Description>}
      </div>
    );
  }
  if (compact) {
    return (
      <MetricsCard.Title as="h3" weight="medium">
        {title}
      </MetricsCard.Title>
    );
  }
  return <MetricsCard.TitleAndDescription title={title} description={description} />;
}
