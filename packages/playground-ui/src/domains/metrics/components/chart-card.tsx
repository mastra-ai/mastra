import { Maximize2Icon } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { Button } from '@/ds/components/Button/Button';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type {
  MetricsCardDragHandleProps,
  MetricsCardTitleMenuProps,
  MetricsCardTotalPart,
} from '@/ds/components/MetricsCard';
import { Skeleton } from '@/ds/components/Skeleton';
import type { LinkComponentProps } from '@/lib/framework';
import { cn } from '@/lib/utils';

/** What `LinkComponent` gets: anchor props, with `href` always set. */
type ChartCardLinkProps = LinkComponentProps & { href: string };

export type ChartCardProps<V extends string = string> = {
  /**
   * Card layout. `default` and `compact` share one header: the title over `total`, with the
   * toolbar on the total's row, on the right.
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
   * A link to a fuller view of the chart (e.g. the chart in an explorer): an expand button in the
   * card's top-right corner, or the title itself on a card with no `total`. Ignored on `hero` cards,
   * and on the title when it has a `titleMenu`.
   */
  href?: string;
  /** Renders `href` links, e.g. the app's router link; it gets anchor props. Default `a`. */
  LinkComponent?: ElementType<ChartCardLinkProps>;
  /**
   * Makes the title a dropdown of the card's views (e.g. "Agent latency", "Tool latency"), in
   * place of tabs. `title` is the picked view's label. Ignored on `hero` cards.
   */
  titleMenu?: Omit<MetricsCardTitleMenuProps<V>, 'title' | 'className'>;
  /** A grip left of the title that drags the card, e.g. while a dashboard is being arranged. Ignored on `hero` cards. */
  dragHandle?: MetricsCardDragHandleProps;
  /**
   * The card's headline number: under the title, or the large value on `hero` cards. A card
   * charting a few different things can pass one total each, marked with its series' color.
   */
  total?: string | readonly MetricsCardTotalPart[];
  /** `hero` cards: the change against the previous period, e.g. "+71.4%". */
  change?: string;
  /** A skeleton in place of `total`. */
  isLoading?: boolean;
  /** Top-bar buttons, e.g. "View in traces": revealed on hover, except on `hero` cards. */
  actions?: ReactNode;
  /** Top-bar buttons always shown, after `actions`: ones that show a state, e.g. a pinned widget's unpin button. */
  persistentActions?: ReactNode;
  /**
   * Legend and controls above the body; they stay in every state. Pass `false` or `null` while
   * there's nothing to show yet, and the row keeps its height.
   */
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
export function ChartCard<V extends string = string>({
  variant = 'default',
  title,
  href,
  LinkComponent,
  titleMenu,
  dragHandle,
  total,
  change,
  isLoading = false,
  actions,
  persistentActions,
  toolbar,
  isUpdating = false,
  bodyHeight = 'fixed',
  className,
  children,
}: ChartCardProps<V>) {
  const fade = cn('transition-opacity duration-200', isUpdating && 'opacity-50');
  const compact = variant === 'compact';
  const hero = variant === 'hero';
  const chart = !hero && bodyHeight === 'fixed';
  const legend =
    toolbar && !hero ? <div className="flex min-w-0 justify-end [&>*]:justify-end">{toolbar}</div> : toolbar;
  // Legends a chart draws itself (Requests) align with the toolbar's.
  // Chart cards sit 8px under the header; table cards (`fit`) keep 16px.
  const legendClass =
    !hero &&
    cn(
      bodyHeight !== 'fit' && 'gap-y-2',
      '[&_[data-slot=chart-legend]]:justify-end',
      // No legend over a chart that is loading or has nothing to show; it keeps its room.
      '[&:has([data-slot=chart-skeleton])_[data-slot=chart-legend]]:invisible',
      '[&:has([data-chart-empty])_[data-slot=chart-legend]]:invisible',
    );
  if (!hero && total !== undefined) {
    const Anchor = LinkComponent ?? 'a';
    return (
      <MetricsCard className={cn('min-h-0! min-w-0! grid-cols-1', compact && 'h-84', legendClass, className)}>
        {/* Title over the value on the left; the card's buttons in the top-right corner; with
            the legend on the value's row, on the right (a long one wraps down there). */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-6 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {dragHandle && <MetricsCard.DragHandle {...dragHandle} />}
            {titleMenu ? (
              // A card with views keeps its title dropdown, in the label's size and tone.
              <MetricsCard.TitleMenu title={title} {...titleMenu} className="text-body-sm text-muted-foreground" />
            ) : (
              <h3 className="text-body-sm font-medium text-muted-foreground">{title}</h3>
            )}
          </div>
          {/* Pulled up and right by the same 8px, so the expand icon sits as far from the card's
              top as from its right edge. Actions show on hover, persistent actions and the expand
              link always. */}
          <div className="-my-1 -mr-2 flex items-center gap-1 justify-self-end">
            {actions && (
              <MetricsCard.Actions reveal="hover" className="my-0">
                {actions}
              </MetricsCard.Actions>
            )}
            {persistentActions}
            {href ? (
              <Button
                variant="ghost"
                size="icon-sm"
                tooltip="Expand"
                aria-label={`Expand ${title}`}
                render={<Anchor href={href} />}
              >
                <Maximize2Icon />
              </Button>
            ) : null}
          </div>
          <span
            className={cn(
              'relative w-fit text-heading text-foreground tabular-nums [text-box:trim-both_cap_alphabetic]',
              isLoading && 'min-w-20',
              fade,
            )}
          >
            {isLoading ? (
              <>
                <span className="invisible">0</span>
                <Skeleton className="absolute inset-0" />
              </>
            ) : typeof total === 'string' ? (
              total
            ) : (
              <MetricsCard.Total value={total} className="font-normal text-inherit" />
            )}
          </span>
          {toolbar ? (
            // A toolbar row's 24px minimum is for rows under the header; here it would push the legend down.
            <div className="flex min-w-0 justify-end [&_[data-slot=chart-legend]]:justify-end [&>*]:min-h-0">
              {toolbar}
            </div>
          ) : null}
        </div>
        <MetricsCard.Content className={cn('flex flex-col gap-4 overflow-visible', compact && 'min-h-0')}>
          <div className={cn('relative flex min-h-0 min-w-0 flex-col', bodyClass(variant, bodyHeight), fade)}>
            {children}
          </div>
        </MetricsCard.Content>
      </MetricsCard>
    );
  }
  return (
    <MetricsCard className={cn('min-h-0! min-w-0! grid-cols-1', compact && 'h-84', legendClass, className)}>
      {/* `hero` cards, and cards with no total: the title, then the actions. */}
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
          <ChartCardHeading
            title={title}
            href={href}
            LinkComponent={LinkComponent}
            titleMenu={titleMenu}
            dragHandle={dragHandle}
          />
        )}
        {persistentActions ? (
          // One group, so the buttons keep their spacing; only `actions` wait for hover.
          <MetricsCard.Actions className={cn(hero && 'my-0 self-center')}>
            {actions &&
              (hero ? (
                actions
              ) : (
                <MetricsCard.Actions reveal="hover" className="my-0">
                  {actions}
                </MetricsCard.Actions>
              ))}
            {persistentActions}
          </MetricsCard.Actions>
        ) : (
          actions && (
            <MetricsCard.Actions reveal={hero ? 'always' : 'hover'} className={cn(hero && 'my-0 self-center')}>
              {actions}
            </MetricsCard.Actions>
          )
        )}
      </MetricsCard.TopBar>
      <MetricsCard.Content className={cn('flex flex-col gap-4 overflow-visible', compact && 'min-h-0')}>
        {/* A card with a toolbar keeps its row while the toolbar is empty (`false` or `null` while
            loading, empty or on error), so its plot starts where its neighbours' do. A card that
            passes no toolbar (a legend drawn by the chart itself) gets no row. */}
        {legend || (chart && toolbar !== undefined && <div aria-hidden className="min-h-6" />)}
        <div
          className={cn(
            'relative flex min-h-0 min-w-0 flex-col',
            // A chart fills the card, so a card stretched to its row's height draws a taller chart, not a gap.
            bodyClass(variant, bodyHeight),
            fade,
          )}
        >
          {children}
        </div>
      </MetricsCard.Content>
    </MetricsCard>
  );
}

/** The body's height: compact cards fill what the toolbar leaves; charts fill the card, at least 240px. */
function bodyClass(variant: ChartCardProps['variant'], bodyHeight: ChartCardProps['bodyHeight']) {
  if (variant === 'compact') return 'flex-1';
  if (variant === 'hero') return undefined;
  if (bodyHeight === 'fit') return 'min-h-60';
  return 'min-h-60 flex-1';
}

/** The title, after the drag handle when there is one. */
function ChartCardHeading<V extends string>({
  dragHandle,
  ...title
}: Pick<ChartCardProps<V>, 'title' | 'href' | 'LinkComponent' | 'titleMenu' | 'dragHandle'>) {
  if (!dragHandle) return <ChartCardTitle {...title} />;
  // One wrapper, so the top bar stretches it as its first child rather than the handle.
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <MetricsCard.DragHandle {...dragHandle} />
      <ChartCardTitle {...title} />
    </div>
  );
}

/** The title: a view menu, a link to a fuller view, or plain. */
function ChartCardTitle<V extends string>({
  title,
  href,
  LinkComponent,
  titleMenu,
}: Pick<ChartCardProps<V>, 'title' | 'href' | 'LinkComponent' | 'titleMenu'>) {
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
