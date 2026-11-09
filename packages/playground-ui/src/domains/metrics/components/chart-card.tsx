import { Maximize2Icon } from 'lucide-react';
import { createContext, useContext } from 'react';
import type { ElementType, ReactNode } from 'react';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type {
  MetricsCardDragHandleProps,
  MetricsCardTitleMenuProps,
  MetricsCardTotalPart,
} from '@/ds/components/MetricsCard';
import { passwordManagerOptOutProps } from '@/ds/primitives/password-manager-autofill';
import type { LinkComponentProps } from '@/lib/framework';

/** What `LinkComponent` gets: anchor props, with `href` always set. */
type ChartCardLinkProps = LinkComponentProps & { href: string };
import { cn } from '@/lib/utils';

export type ChartCardProps<V extends string = string> = {
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
  titleMenu?: Omit<MetricsCardTitleMenuProps<V>, 'title' | 'className'>;
  /** A grip left of the title that drags the card, e.g. while a dashboard is being arranged. Ignored on `hero` cards. */
  dragHandle?: MetricsCardDragHandleProps;
  /**
   * Makes a plain title editable in place: it reads as the title until hovered or focused. Enter or
   * blur commits the trimmed title, when it changed; Escape reverts. The caller stores it and passes
   * it back as `title`. Ignored with `titleMenu` or `href`, and on `hero` cards.
   */
  onTitleChange?: (title: string) => void;
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

type ChartCardHeader = {
  /** Drawn in place of the title, e.g. an input to rename the card. */
  heading: ReactNode;
  /** Top-bar buttons shown in every state, before the card's own. */
  actions?: ReactNode;
};

const ChartCardHeaderContext = createContext<ChartCardHeader | undefined>(undefined);

/**
 * Overrides the header of every `default` and `compact` card inside, for a host that draws a card
 * it doesn't render itself, e.g. a widget editor drawing a dashboard widget as it edits it.
 */
export const ChartCardHeaderProvider = ChartCardHeaderContext.Provider;

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
  onTitleChange,
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
  const header = useContext(ChartCardHeaderContext);
  const override = hero ? undefined : header;
  return (
    <MetricsCard
      className={cn(
        'min-h-0! min-w-0! grid-cols-1',
        // No legend over a chart that is loading or has nothing to show; it keeps its room.
        '[&:has([data-slot=chart-skeleton])_[data-slot=chart-legend]]:invisible',
        '[&:has([data-chart-empty])_[data-slot=chart-legend]]:invisible',
        compact && 'h-84',
        className,
      )}
    >
      <MetricsCard.TopBar>
        {hero ? (
          <MetricsCard.Headline
            label={title}
            value={typeof total === 'string' ? total : '—'}
            change={change}
            isLoading={isLoading}
            className={fade}
          />
        ) : override ? (
          <div className="min-w-0">{override.heading}</div>
        ) : (
          <ChartCardHeading
            title={title}
            href={href}
            LinkComponent={LinkComponent}
            titleMenu={titleMenu}
            dragHandle={dragHandle}
            onTitleChange={onTitleChange}
          />
        )}
        {override?.actions && <MetricsCard.Actions reveal="always">{override.actions}</MetricsCard.Actions>}
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
        {!hero && total !== undefined && <MetricsCard.Total value={total} isLoading={isLoading} className={fade} />}
      </MetricsCard.TopBar>
      <MetricsCard.Content className={cn('flex flex-col gap-4 overflow-visible', compact && 'min-h-0')}>
        {/* A card with a toolbar keeps its row while the toolbar is empty (`false` or `null` while
            loading, empty or on error), so its plot starts where its neighbours' do. A card that
            passes no toolbar (a legend drawn by the chart itself) gets no row. */}
        {toolbar || (chart && toolbar !== undefined && <div aria-hidden className="min-h-6" />)}
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
}: Pick<ChartCardProps<V>, 'title' | 'href' | 'LinkComponent' | 'titleMenu' | 'dragHandle' | 'onTitleChange'>) {
  if (!dragHandle) return <ChartCardTitle {...title} />;
  // One wrapper, so the top bar stretches it as its first child rather than the handle.
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <MetricsCard.DragHandle {...dragHandle} />
      <ChartCardTitle {...title} />
    </div>
  );
}

/** The title: a view menu, a link to a fuller view, editable, or plain. */
function ChartCardTitle<V extends string>({
  title,
  href,
  LinkComponent,
  titleMenu,
  onTitleChange,
}: Pick<ChartCardProps<V>, 'title' | 'href' | 'LinkComponent' | 'titleMenu' | 'onTitleChange'>) {
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
  if (onTitleChange) return <ChartCardTitleInput title={title} onTitleChange={onTitleChange} />;
  return <MetricsCard.Title>{title}</MetricsCard.Title>;
}

/**
 * The title as an input that looks like it until hovered or focused. Uncontrolled, so blur is the one
 * exit: Enter blurs, Escape restores the title first, blur commits. Keyed on `title`, so a title the
 * caller changes replaces what's typed.
 */
function ChartCardTitleInput({ title, onTitleChange }: { title: string; onTitleChange: (title: string) => void }) {
  return (
    <h3 className="flex min-w-0">
      <input
        key={title}
        aria-label="Widget title"
        defaultValue={title}
        {...passwordManagerOptOutProps}
        onBlur={event => {
          const next = event.currentTarget.value.trim();
          event.currentTarget.value = next;
          if (next !== title) onTitleChange(next);
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') event.currentTarget.value = title;
          if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className={cn(
          // The link's box, so the text sits where a plain title's does.
          '-mx-1.5 -my-0.5 field-sizing-content min-w-12 truncate rounded-md bg-transparent px-1.5 py-0.5',
          'text-body zoom-safe-text font-medium text-foreground',
          // An outline takes no room, so showing it moves nothing.
          'outline-1 -outline-offset-1 outline-transparent outline-dashed hover:outline-border-strong focus:outline-border-focus',
        )}
      />
    </h3>
  );
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
