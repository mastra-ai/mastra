import { Maximize2Icon } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsCardTitleMenuProps } from '@/ds/components/MetricsCard';
import type { LinkComponentProps } from '@/lib/framework';
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
  /**
   * Makes the title a link, marked by an expand icon, to a fuller view of the chart (e.g. the
   * chart in an explorer). Ignored with `titleMenu`.
   */
  href?: string;
  /** Renders `href` links, e.g. the app's router link; it gets anchor props. Default `a`. */
  LinkComponent?: ElementType<LinkComponentProps>;
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
  href,
  LinkComponent,
  titleMenu,
  total,
  isLoading = false,
  description,
  summary,
  actions,
  toolbar,
  isUpdating = false,
  className,
  children,
}: ChartCardProps) {
  const fade = cn('transition-opacity duration-200', isUpdating && 'opacity-50');
  const compact = variant === 'compact';
  return (
    <MetricsCard className={cn('min-h-0! min-w-0!', compact && 'h-84', className)}>
      <MetricsCard.TopBar>
        <ChartCardHeading
          title={title}
          href={href}
          LinkComponent={LinkComponent}
          description={description}
          titleMenu={titleMenu}
          compact={compact}
        />
        {actions && <MetricsCard.Actions reveal="hover">{actions}</MetricsCard.Actions>}
        {compact && total !== undefined && <MetricsCard.Total value={total} isLoading={isLoading} className={fade} />}
        {!compact && summary && <div className={cn('order-last flex w-24 shrink-0 justify-end', fade)}>{summary}</div>}
      </MetricsCard.TopBar>
      <MetricsCard.Content className={cn('flex flex-col gap-4 overflow-visible', compact && 'min-h-0')}>
        {toolbar}
        <div className={cn('relative flex min-h-0 min-w-0 flex-col', compact ? 'flex-1' : 'h-60', fade)}>
          {children}
        </div>
      </MetricsCard.Content>
    </MetricsCard>
  );
}

/** The title: a view menu, a lone compact title, or the default title, each with the description on default cards. */
function ChartCardHeading({
  title,
  href,
  LinkComponent,
  description,
  titleMenu,
  compact,
}: Pick<ChartCardProps, 'title' | 'href' | 'LinkComponent' | 'description' | 'titleMenu'> & { compact: boolean }) {
  if (titleMenu) {
    return (
      <div className="flex flex-col">
        <MetricsCard.TitleMenu title={title} {...titleMenu} />
        {!compact && description && <MetricsCard.Description>{description}</MetricsCard.Description>}
      </div>
    );
  }
  if (href) {
    const Heading = compact ? 'h3' : 'h2';
    return (
      <div className="flex flex-col items-start">
        <Heading>
          <ChartCardTitleLink href={href} LinkComponent={LinkComponent} medium={compact}>
            {title}
          </ChartCardTitleLink>
        </Heading>
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

/** The title as a link to a fuller view, with an expand icon after it; hover fills its own box, not the row. */
function ChartCardTitleLink({
  href,
  LinkComponent,
  medium,
  children,
}: {
  href: string;
  LinkComponent?: ElementType<LinkComponentProps>;
  medium: boolean;
  children: string;
}) {
  const Anchor = LinkComponent ?? 'a';
  return (
    <Anchor
      href={href}
      className={cn(
        '-mx-1.5 -my-0.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-body text-foreground hover:bg-fill-subtle',
        'focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-border-focus focus-visible:outline-solid',
        medium && 'font-medium',
      )}
    >
      {children}
      <Maximize2Icon aria-hidden className="size-3.5 text-muted-foreground" />
    </Anchor>
  );
}
