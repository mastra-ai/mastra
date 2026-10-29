import { Maximize2Icon } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsCardTitleMenuProps, MetricsCardTotalPart } from '@/ds/components/MetricsCard';
import type { LinkComponentProps } from '@/lib/framework';

/** What `LinkComponent` gets: anchor props, with `href` always set. */
type ChartCardLinkProps = LinkComponentProps & { href: string };
import { cn } from '@/lib/utils';

export type ChartCardProps = {
  /**
   * Card layout. `default` and `compact` share one header: the title, and `total` on the right.
   * - `default`: a 240px body.
   * - `compact`: one card height, so cards in a grid line up; the chart fills what the toolbar
   *   leaves. For small cards in a grid.
   * - `hero`: one large chart that is the page's subject (an explorer): the title as a label over
   *   a large `total`, with `change` beside it, and `actions` always shown. The body is as tall
   *   as its content.
   */
  variant?: 'default' | 'compact' | 'hero';
  title: string;
  /**
   * Makes the title a link, marked by an expand icon, to a fuller view of the chart (e.g. the
   * chart in an explorer). Ignored with `titleMenu` and on `hero` cards.
   */
  href?: string;
  /** Renders `href` links, e.g. the app's router link; it gets anchor props. Default `a`. */
  LinkComponent?: ElementType<ChartCardLinkProps>;
  /**
   * Makes the title a dropdown of the card's views (e.g. "Agent latency", "Tool latency"), in
   * place of tabs. `title` is the picked view's label. Ignored on `hero` cards.
   */
  titleMenu?: Omit<MetricsCardTitleMenuProps<string>, 'title' | 'className'>;
  /**
   * The card's headline number: right of the title, or the large value on `hero` cards. A card
   * charting a few different things can pass one total each, marked with its series' color.
   */
  total?: string | readonly MetricsCardTotalPart[];
  /** `hero` cards: the change against the previous period, e.g. "+71.4%". */
  change?: string;
  /** A skeleton in place of `total`. */
  isLoading?: boolean;
  /** Top-bar buttons, e.g. "View in traces": revealed on hover, except on `hero` cards. */
  actions?: ReactNode;
  /** Legend and controls above the body; they stay in every state. */
  toolbar?: ReactNode;
  /** Previous data stays on screen, dimmed, while a new range or filter loads. */
  isUpdating?: boolean;
  /**
   * `default` cards. `fixed` (default): a chart, at least 240px high in every state and filling
   * the card when the card is taller (a grid row). `fit`: at least that high, and as tall as the
   * content needs, for lists that grow with "Show more".
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
  href,
  LinkComponent,
  titleMenu,
  total,
  change,
  isLoading = false,
  actions,
  toolbar,
  isUpdating = false,
  bodyHeight = 'fixed',
  className,
  children,
}: ChartCardProps) {
  const fade = cn('transition-opacity duration-200', isUpdating && 'opacity-50');
  const compact = variant === 'compact';
  const hero = variant === 'hero';
  const chart = !hero && bodyHeight === 'fixed';
  return (
    <MetricsCard className={cn('min-h-0! min-w-0! grid-cols-1', compact && 'h-84', className)}>
      <MetricsCard.TopBar>
        {hero ? (
          <MetricsCard.Headline
            label={title}
            value={typeof total === 'string' ? total : '—'}
            change={change}
            isLoading={isLoading}
            className={fade}
          />
        ) : (
          <ChartCardHeading title={title} href={href} LinkComponent={LinkComponent} titleMenu={titleMenu} />
        )}
        {actions && (
          <MetricsCard.Actions reveal={hero ? 'always' : 'hover'} className={cn(hero && 'my-0 self-center')}>
            {actions}
          </MetricsCard.Actions>
        )}
        {!hero && total !== undefined && <MetricsCard.Total value={total} isLoading={isLoading} className={fade} />}
      </MetricsCard.TopBar>
      <MetricsCard.Content className={cn('flex flex-col gap-4 overflow-visible', compact && 'min-h-0')}>
        {/* A chart keeps its legend row while it has no legend yet (loading, empty, error), so its
            plot starts where its neighbours' do. */}
        {toolbar || (chart && <div aria-hidden className="min-h-6" />)}
        <div
          className={cn(
            'relative flex min-h-0 min-w-0 flex-col',
            // A chart fills the card, so a card stretched to its row's height draws a taller chart, not a gap.
            compact ? 'flex-1' : hero ? undefined : bodyHeight === 'fit' ? 'min-h-60' : 'min-h-60 flex-1',
            fade,
          )}
        >
          {children}
        </div>
      </MetricsCard.Content>
    </MetricsCard>
  );
}

/** The title: a view menu, a link to a fuller view, or plain. */
function ChartCardHeading({
  title,
  href,
  LinkComponent,
  titleMenu,
}: Pick<ChartCardProps, 'title' | 'href' | 'LinkComponent' | 'titleMenu'>) {
  if (titleMenu) return <MetricsCard.TitleMenu title={title} {...titleMenu} />;
  if (href) {
    return (
      <h3 className="flex">
        <ChartCardTitleLink href={href} LinkComponent={LinkComponent}>
          {title}
        </ChartCardTitleLink>
      </h3>
    );
  }
  return <MetricsCard.Title>{title}</MetricsCard.Title>;
}

/** The title as a link to a fuller view, with an expand icon after it; hover fills its own box, not the row. */
function ChartCardTitleLink({
  href,
  LinkComponent,
  children,
}: {
  href: string;
  LinkComponent?: ElementType<ChartCardLinkProps>;
  children: string;
}) {
  const Anchor = LinkComponent ?? 'a';
  return (
    <Anchor
      href={href}
      className={cn(
        '-mx-1.5 -my-0.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-body font-medium text-foreground hover:bg-fill-subtle',
        'focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-border-focus focus-visible:outline-solid',
      )}
    >
      {children}
      <Maximize2Icon aria-hidden className="size-3.5 text-muted-foreground" />
    </Anchor>
  );
}
