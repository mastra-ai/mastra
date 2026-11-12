import type { DashboardWidget } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LinkIcon, PinIcon, PinOffIcon, StarIcon } from 'lucide-react';
import { useState } from 'react';
import { dashboardStoryFetch, STORY_BASE_URL } from '../../../../.storybook/fixtures/dashboards';
import { MetricsProvider } from '../../metrics/hooks/use-metrics';
import { METRICS_DASHBOARD } from '../metrics-dashboard';
import { DashboardRenderer } from './dashboard-renderer';
import { MetricsCard, onCardHover } from '@/ds/components/MetricsCard';

type Args = { pin: boolean; share: boolean; favorite: boolean };

const nameOf = (widget: DashboardWidget) => widget.title?.trim() || 'widget';

/** A host composing its own buttons into each card through `widgetActions` as `MetricsCard.Action`s. */
function HostActionsHost({ pin, share, favorite }: Args) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [pinned, setPinned] = useState<string[]>(['agent-runs']);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [last, setLast] = useState<string>();

  // Each button decides whether it waits for the card's hover: a starred or pinned card keeps its button in view.
  const widgetActions = (widget: DashboardWidget) => {
    if (!pin && !share && !favorite) return undefined;
    const name = nameOf(widget);
    const isFavorite = favorites.includes(widget.id);
    const isPinned = pinned.includes(widget.id);
    return (
      <>
        {share && (
          <MetricsCard.Action
            label={`Copy link to ${name}`}
            onClick={() => setLast(`Copied a link to ${name}`)}
            className={onCardHover}
          >
            <LinkIcon />
          </MetricsCard.Action>
        )}
        {favorite && (
          <MetricsCard.Action
            label={`${isFavorite ? 'Unstar' : 'Star'} ${name}`}
            onClick={() => setFavorites(ids => (isFavorite ? ids.filter(id => id !== widget.id) : [...ids, widget.id]))}
            className={isFavorite ? undefined : onCardHover}
          >
            <StarIcon className={isFavorite ? 'fill-current' : undefined} />
          </MetricsCard.Action>
        )}
        {pin && (
          <MetricsCard.Action
            label={`${isPinned ? 'Unpin' : 'Pin'} ${name}`}
            onClick={() => setPinned(ids => (isPinned ? ids.filter(id => id !== widget.id) : [...ids, widget.id]))}
            className={isPinned ? undefined : onCardHover}
          >
            {isPinned ? <PinOffIcon /> : <PinIcon />}
          </MetricsCard.Action>
        )}
      </>
    );
  };

  return (
    <MastraReactProvider baseUrl={STORY_BASE_URL} customFetch={dashboardStoryFetch}>
      <QueryClientProvider client={queryClient}>
        <MetricsProvider preset="24h" filterTokens={[]} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
          <div className="space-y-3 p-4">
            <p className="text-ui-sm text-muted-foreground">
              {last ?? 'Hover a card for the host’s buttons. Pinned or starred cards keep theirs in view.'}
            </p>
            <DashboardRenderer
              definition={METRICS_DASHBOARD}
              scope="project"
              onDrilldown={() => {}}
              widgetActions={widgetActions}
            />
          </div>
        </MetricsProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

const meta: Meta<typeof HostActionsHost> = {
  title: 'Dashboards/DashboardRenderer/Host actions',
  component: HostActionsHost,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    pin: { description: 'Add a pin `MetricsCard.Action`: on hover, and always shown once pinned.' },
    share: { description: 'Add a "Copy link" `MetricsCard.Action` shown on hover.' },
    favorite: { description: 'Add a star `MetricsCard.Action`: on hover, and always shown once starred.' },
  },
  args: { pin: true, share: true, favorite: true },
};

export default meta;

type Story = StoryObj<typeof HostActionsHost>;

/** Share, star and pin from the host, after each card's own drilldown. Agent runs starts pinned. */
export const Default: Story = {};

/** Only the pin, as the Metrics page and the MCP app use it. */
export const PinOnly: Story = { args: { share: false, favorite: false } };

/** No host buttons: `widgetActions` returns nothing. */
export const NoHostActions: Story = { args: { pin: false, share: false, favorite: false } };
