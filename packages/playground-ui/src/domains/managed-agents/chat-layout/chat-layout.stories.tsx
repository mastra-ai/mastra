import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import attio from '../../../../.storybook/fixtures/integration-logos/attio.svg';
import { AgentEditMenu, AgentTabs } from '../agent-tabs';
import { DetailsCard } from '../details-card';
import { ThreadsCard } from '../threads-card';
import type { ThreadFilterAgent, ThreadVisibilityFilter } from '../threads-card';
import { CHAT_LAYOUT_SHORTCUTS, ChatLayout } from './index';
import { Badge } from '@/ds/components/Badge';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { Button } from '@/ds/components/Button';
import { Combobox } from '@/ds/components/Combobox';
import {
  Composer,
  ComposerActions,
  ComposerActionsEnd,
  ComposerActionsStart,
  ComposerBox,
  ComposerInput,
  ComposerRing,
  ComposerStatus,
  ComposerStatusEnd,
  ComposerStatusStart,
} from '@/ds/components/Composer';
import { ShortcutHint } from '@/ds/components/Kbd/shortcut-hint';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { PageLayout } from '@/ds/components/PageLayout';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import { SearchInput } from '@/ds/components/SearchInput';
import { Txt } from '@/ds/components/Txt';
import { IconArrowUp } from '@/ds/icons/central/IconArrowUp';
import { IconChainLink3 } from '@/ds/icons/central/IconChainLink3';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';
import { IconMicrophone } from '@/ds/icons/central/IconMicrophone';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { MemoryIcon } from '@/ds/icons/MemoryIcon';
import { SlackIcon } from '@/ds/icons/SlackIcon';
import { MainCard } from '@/ds/new/layout/app-shell/main-card';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { PanelEdgeIcon } from '@/lib/resize/panel-edge-icon';

const ASSETS = 'https://app.paper.design/file-assets/01M84Q55NFTYG5W3M672A4JPGJ';
const KIT: ThreadFilterAgent = { id: 'kit', name: 'Kit', avatar: `${ASSETS}/0RQED4BN1QGR0N14VJFQP2YFQS.png` };
const TRIAGE: ThreadFilterAgent = { id: 'triage', name: 'Triage', avatar: `${ASSETS}/07RK8ZDJR82M57Y729SVHW1BF2.png` };
const RELEASE: ThreadFilterAgent = {
  id: 'release-notes',
  name: 'Release notes',
  avatar: `${ASSETS}/2HNT3WRVCATE4AJHGZWKJR42S0.png`,
};
const AGENTS = [KIT, TRIAGE, RELEASE];

const THREADS = [
  { id: 'deals', title: 'Which deals close this week?', updated: '4m', agents: [KIT], private: true },
  { id: 'desk', title: 'Deal desk', updated: '12m', agents: [KIT, TRIAGE] },
  { id: 'acme', title: 'Draft a follow-up for Acme', updated: '1h', agents: [KIT], private: true },
  { id: 'linear', title: 'Sort the new Linear issues', updated: '3h', agents: [TRIAGE] },
  { id: 'q4', title: 'Q4 launch prep', updated: 'Yesterday', agents: [KIT, RELEASE] },
  { id: 'globex', title: 'Summarize the Globex renewal', updated: 'Tue', agents: [KIT], private: true },
  { id: 'bugs', title: 'Close duplicate bugs', updated: 'Mon', agents: [TRIAGE] },
];

const REPLY = `Four deals are set to close by Friday:

1. Acme, $48k, contract out for signature
2. Globex renewal, $120k, waiting on legal
3. Initech expansion, $22k, verbal yes
4. Umbrella pilot, $9k, no reply since Tuesday

Umbrella is the one at risk. Want me to draft a nudge?`;

const ORGS = [
  { value: 'acme', label: 'Acme' },
  { value: 'mastra', label: 'Mastra' },
];
const PROJECTS = [
  { value: 'sales-assistant', label: 'sales-assistant' },
  { value: 'support-bot', label: 'support-bot' },
];

function Crumbs() {
  return (
    <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
      <Crumb
        as="a"
        href="#"
        action={
          <Combobox
            options={ORGS}
            value="acme"
            variant="ghost"
            size="icon-sm"
            align="end"
            aria-label="Switch organization"
          />
        }
      >
        Acme
      </Crumb>
      <Crumb
        as="a"
        href="#"
        action={
          <Combobox
            options={PROJECTS}
            value="sales-assistant"
            variant="ghost"
            size="icon-sm"
            align="end"
            aria-label="Switch project"
          />
        }
      >
        sales-assistant
      </Crumb>
      <Crumb as="a" href="#agents">
        Agents
      </Crumb>
      <Crumb as="span" isCurrent>
        Kit
      </Crumb>
    </Breadcrumb>
  );
}

function threadMatches(
  thread: (typeof THREADS)[number],
  { agentIds, query, visibility }: { agentIds: Set<string>; query: string; visibility: ThreadVisibilityFilter },
) {
  if (agentIds.size > 0 && !thread.agents.some(agent => agentIds.has(agent.id))) return false;
  if (visibility === 'private' && !('private' in thread)) return false;
  if (visibility === 'shared' && 'private' in thread) return false;
  return thread.title.toLowerCase().includes(query.trim().toLowerCase());
}

function Threads() {
  const [agentIds, setAgentIds] = useState<string[]>([KIT.id, TRIAGE.id]);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<ThreadVisibilityFilter>('all');
  const picked = new Set(agentIds);
  const shown = THREADS.filter(thread => threadMatches(thread, { agentIds: picked, query, visibility }));
  return (
    <ThreadsCard
      action={
        <Button variant="ghost" size="sm" icon={<IconPlusMedium />}>
          New agent
        </Button>
      }
      search={
        <SearchInput
          size="sm"
          label="Search threads"
          placeholder="Search threads"
          value={query}
          onValueChange={setQuery}
          action={
            <ThreadsCard.FilterMenu
              agents={AGENTS}
              agentIds={agentIds}
              onAgentIdsChange={setAgentIds}
              visibility={visibility}
              onVisibilityChange={setVisibility}
            />
          }
        />
      }
    >
      <ThreadsCard.List>
        {shown.map((thread, index) => (
          <ThreadsCard.Row
            key={thread.id}
            href={`#${thread.id}`}
            title={thread.title}
            updated={thread.updated}
            agents={thread.agents}
            current={index === 0}
            private={'private' in thread}
          />
        ))}
      </ThreadsCard.List>
      {shown.length === 0 ? (
        <Txt variant="body-sm" tone="muted" className="px-1.5">
          No threads match.
        </Txt>
      ) : null}
    </ThreadsCard>
  );
}

function Conversation() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 px-8">
      <div className="flex min-h-10 w-full max-w-170 items-center justify-end">
        <Button size="sm" icon={<IconPlusMedium />}>
          New thread
        </Button>
      </div>
      <ScrollArea autoScroll className="min-h-0 w-full max-w-170 flex-1">
        <ScrollAreaViewport contentClassName="flex min-h-full flex-col justify-end gap-5">
          <div className="self-end rounded-2xl bg-fill px-3.5 py-2">
            <Txt variant="body">Which deals close this week?</Txt>
          </div>
          <span className="flex items-center gap-2 self-start">
            <Badge variant="success" emphasis="subtle" size="sm" indicator="dot">
              attio-search
            </Badge>
            <Txt as="span" variant="caption" tone="muted">
              4 deals, 312 ms
            </Txt>
          </span>
          <MarkdownRenderer>{REPLY}</MarkdownRenderer>
          <div className="self-end rounded-2xl bg-fill px-3.5 py-2">
            <Txt variant="body">Yes, keep it short and mention the pilot results.</Txt>
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
      <div className="flex w-full max-w-170 flex-col pb-2">
        <Composer onSubmit={event => event.preventDefault()}>
          <ComposerRing>
            <ComposerBox>
              <ComposerInput
                aria-label="Message"
                placeholder="Message Kit"
                defaultValue="Also cc Charlie from their ops team"
              />
              <ComposerActions>
                <ComposerActionsStart>
                  <Button variant="ghost" size="icon-sm" aria-label="Attach">
                    <IconPlusMedium />
                  </Button>
                </ComposerActionsStart>
                <ComposerActionsEnd>
                  <Button variant="ghost" size="sm" iconEnd={<IconChevronDownMedium />}>
                    GPT-5 mini
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Dictate">
                    <IconMicrophone />
                  </Button>
                  <Button type="submit" variant="primary" size="icon-sm" aria-label="Send message">
                    <IconArrowUp />
                  </Button>
                </ComposerActionsEnd>
              </ComposerActions>
            </ComposerBox>
          </ComposerRing>
        </Composer>
        <ComposerStatus aria-label="Session status line">
          <ComposerStatusStart>
            <span>Production</span>
          </ComposerStatusStart>
          <ComposerStatusEnd>
            <span>1.2K tokens</span>
            <span>Memory on</span>
          </ComposerStatusEnd>
        </ComposerStatus>
      </div>
    </div>
  );
}

function TintedLogo({ src }: { src: string }) {
  return <img src={src} alt="" className="size-full object-contain brightness-0 dark:invert" />;
}

function Details({ onClose }: { onClose: () => void }) {
  return (
    <DetailsCard onClose={onClose}>
      <DetailsCard.Section
        label="Instructions"
        onEdit={() => undefined}
        action={
          <Badge variant="info" emphasis="subtle" size="sm">
            Draft
          </Badge>
        }
      >
        <div className="flex flex-col gap-0.5">
          <Txt variant="label" tone="ink">
            Role
          </Txt>
          <Txt variant="caption" tone="muted" className="line-clamp-2">
            You help the sales team with deals in Attio. Look up the deal before you answer, and say which record you
            used.
          </Txt>
        </div>
        <Txt as="span" variant="caption" tone="muted">
          164 words, uses Tone of voice
        </Txt>
      </DetailsCard.Section>
      <DetailsCard.Section label="Last 7 days">
        <DetailsCard.Stats>
          <DetailsCard.Stat label="Runs" value="214" />
          <DetailsCard.Stat label="Cost" value="$3.80" />
          <DetailsCard.Stat label="Tokens" value="1.9M" />
        </DetailsCard.Stats>
      </DetailsCard.Section>
      <DetailsCard.Section label="Tools">
        <DetailsCard.Chips
          label="more tools"
          items={[
            'attio-search',
            'attio-update',
            'slack-post',
            'web-search',
            'github-pr',
            'linear-issue',
            'gmail-draft',
          ]}
        />
      </DetailsCard.Section>
      <DetailsCard.Section label="Channels">
        <DetailsCard.Fact icon={<SlackIcon />} label="Slack" value="#sales" />
        <DetailsCard.Fact icon={<TintedLogo src={attio} />} label="Attio" value="Connected" />
      </DetailsCard.Section>
      <DetailsCard.Section label="Memory">
        <DetailsCard.Fact
          icon={<MemoryIcon className="text-muted-foreground" />}
          label="Last 20 messages"
          value="Semantic recall on"
        />
      </DetailsCard.Section>
    </DetailsCard>
  );
}

function AgentChat({ initiallyOpen }: { initiallyOpen: boolean }) {
  const mobile = useIsMobile();
  const [detailsOpen, setDetailsOpen] = useState(initiallyOpen);
  const [threadsOpen, setThreadsOpen] = useState(() => !mobile);
  return (
    <div className="flex h-dvh bg-sidebar p-2">
      <MainCard>
        <PageLayout variant="page" body="fixed" breadcrumbs={<Crumbs />}>
          <h1 className="sr-only">Kit</h1>
          <div className="flex h-full min-h-0 flex-col">
            <AgentTabs
              active="chat"
              chatHref="#chat"
              tracesHref="#traces"
              versionsHref="#versions"
              actions={
                <>
                  <AgentEditMenu
                    instructionsHref="#instructions"
                    toolsHref="#tools"
                    skillsHref="#skills"
                    channelsHref="#channels"
                    settingsHref="#settings"
                  />
                  <Button variant="ghost" size="icon-sm" aria-label="Copy link">
                    <IconChainLink3 />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Threads"
                    aria-pressed={threadsOpen}
                    tooltip={
                      <ShortcutHint
                        label={threadsOpen ? 'Hide threads' : 'Show threads'}
                        shortcut={CHAT_LAYOUT_SHORTCUTS.threads}
                      />
                    }
                    onClick={() => setThreadsOpen(!threadsOpen)}
                  >
                    <PanelEdgeIcon side="left" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Details"
                    aria-pressed={detailsOpen}
                    tooltip={
                      <ShortcutHint
                        label={detailsOpen ? 'Hide details' : 'Show details'}
                        shortcut={CHAT_LAYOUT_SHORTCUTS.details}
                      />
                    }
                    onClick={() => setDetailsOpen(!detailsOpen)}
                  >
                    <PanelEdgeIcon side="right" />
                  </Button>
                </>
              }
            />
            <div className="min-h-0 flex-1">
              <ChatLayout
                threads={<Threads />}
                threadsOpen={threadsOpen}
                onThreadsOpenChange={setThreadsOpen}
                details={<Details onClose={() => setDetailsOpen(false)} />}
                detailsOpen={detailsOpen}
                onDetailsOpenChange={setDetailsOpen}
              >
                <Conversation />
              </ChatLayout>
            </div>
          </div>
        </PageLayout>
      </MainCard>
    </div>
  );
}

const meta = {
  title: 'Managed agents/Chat',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A managed agent’s chat: the agent tabs with Edit, threads in a card on the left filtered by agent, Details in a card on the right, and the chat flat between them. The cards keep fixed widths. Opening or closing Details slides its card in or out while the chat narrows or widens to fit. Below 1024px, threads and Details open as drawers.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DetailsOpen: Story = { render: () => <AgentChat initiallyOpen /> };

export const DetailsClosed: Story = { render: () => <AgentChat initiallyOpen={false} /> };

export const FilterThreads: Story = {
  render: () => <AgentChat initiallyOpen={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(document.body);
    const threads = within(canvas.getByRole('navigation', { name: 'Threads' }));
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search threads' }), 'deal');
    await expect(threads.getAllByRole('link')).toHaveLength(2);
    await userEvent.clear(canvas.getByRole('searchbox', { name: 'Search threads' }));

    await userEvent.click(canvas.getByRole('button', { name: /^Filter threads/ }));
    await userEvent.click(await page.findByRole('menuitemcheckbox', { name: 'Triage' }));
    await expect(threads.getAllByRole('link')).toHaveLength(5);
    await userEvent.click(page.getByRole('menuitemradio', { name: 'Private' }));
    await expect(threads.getAllByRole('img', { name: 'Private' })).toHaveLength(threads.getAllByRole('link').length);
    await expect(canvas.getByRole('button', { name: /^Filter threads/ })).toHaveAccessibleName(
      'Filter threads, showing Kit, private only',
    );
  },
};

export const KeyboardShortcuts: Story = {
  render: () => <AgentChat initiallyOpen />,
  play: async ({ canvasElement }) => {
    const panel = (slot: string) => canvasElement.querySelector(`[data-slot="${slot}"]`);
    await userEvent.keyboard('{{}');
    await waitFor(() => expect(panel('chat-layout-threads')).toHaveAttribute('data-open', 'false'));
    await userEvent.keyboard(']');
    await waitFor(() => expect(panel('chat-layout-details')).toHaveAttribute('data-open', 'false'));
    await userEvent.keyboard('{{}]');
    await waitFor(() => expect(panel('chat-layout-threads')).toHaveAttribute('data-open', 'true'));
    await waitFor(() => expect(panel('chat-layout-details')).toHaveAttribute('data-open', 'true'));
  },
};

export const ToggleDetails: Story = {
  render: () => <AgentChat initiallyOpen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const main = canvasElement.querySelector<HTMLElement>('[data-slot="chat-layout-main"]');
    if (!main) throw new Error('Missing the chat column');
    const openWidth = main.getBoundingClientRect().width;

    await userEvent.click(canvas.getByRole('button', { name: 'Hide details' }));
    await expect(canvas.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(main.getBoundingClientRect().width).toBeGreaterThanOrEqual(openWidth + 300));

    await userEvent.click(canvas.getByRole('button', { name: 'Details' }));
    await waitFor(() => expect(main.getBoundingClientRect().width).toBeLessThanOrEqual(openWidth + 1));
  },
};
