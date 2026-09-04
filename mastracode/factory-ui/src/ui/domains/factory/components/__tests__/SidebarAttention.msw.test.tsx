import { MainSidebar, MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import {
  attentionItemSourceId,
  type FactoryAttentionItem,
  type FactoryAttentionView,
  type FactoryActivityAttentionItem,
  type FactoryAutomationFailedAttentionItem,
  type FactoryMentionAttentionItem,
  type FactorySupervisorFindingAttentionItem,
} from '../../services/attention';
import { playAttentionSoundOnce } from '../../services/attentionSound';
import { ATTENTION_PREVIEW_LIMIT, SidebarAttention } from '../SidebarAttention';

const FACTORY_ID = 'factory-1';
const DECISION_ID = 'decision-1';
const SOUND_STORAGE_KEY = 'mastracode.attentionNotified.v2';
const oscillatorStart = vi.fn();

// The default done sound is the chime, which reaches for the whole node graph —
// a stub short of one of these throws inside playDoneSound's silent catch and
// the sound assertions go quiet without saying why.
class AudioContextStub {
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = {};

  resume = vi.fn();

  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: oscillatorStart,
      stop: vi.fn(),
    };
  }

  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }

  createWaveShaper() {
    return { curve: null, oversample: 'none', connect: vi.fn() };
  }

  createBiquadFilter() {
    return { type: 'lowpass', frequency: { value: 0 }, connect: vi.fn() };
  }

  createConvolver() {
    return { normalize: true, buffer: null, connect: vi.fn() };
  }

  createBuffer(numberOfChannels: number, length: number) {
    const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    return { numberOfChannels, getChannelData: (channel: number) => channels[channel]! };
  }
}

function attentionItem(occurrence = 1): FactoryAutomationFailedAttentionItem {
  return {
    key: `factory:${FACTORY_ID}:attention:automation-failed:${DECISION_ID}:${occurrence}`,
    kind: 'automation-failed',
    decisionId: DECISION_ID,
    occurrence,
    workItemId: 'item-1',
    title: 'Fix the loader',
    detail: 'No active Factory binding for role work.',
    decisionType: 'sendMessage',
    failureCode: 'source_control_missing',
    canRetry: true,
    occurredAt: '2026-08-20T10:00:00.000Z',
    read: false,
    target: { kind: 'thread', sessionId: 'session-attention', threadId: 'thread-attention' },
    archived: false,
  };
}

function supervisorFindingItem(): FactorySupervisorFindingAttentionItem {
  return {
    key: `factory:${FACTORY_ID}:attention:supervisor-finding:decision-stuck:${DECISION_ID}:0`,
    kind: 'supervisor-finding',
    findingKey: `decision-stuck:${DECISION_ID}`,
    findingTitle: 'A decision is stuck',
    evidence: 'The decision has been retrying past its backoff.',
    ageMs: 15 * 60_000,
    suggestedRepair: { action: 'retry-decision', decisionId: DECISION_ID },
    occurrence: 0,
    workItemId: 'item-1',
    title: 'A decision is stuck',
    detail: 'The decision has been retrying past its backoff.',
    occurredAt: '2026-09-03T05:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'work-item', workItemId: 'item-1', board: 'work' },
  };
}

function mentionItem(): FactoryMentionAttentionItem {
  return {
    key: `factory:${FACTORY_ID}:attention:mention:comment-1:0`,
    kind: 'mention',
    commentId: 'comment-1',
    occurrence: 0,
    workItemId: 'item-1',
    title: 'Fix the loader',
    detail: 'Hey @you, can you check this?',
    authorId: 'user-2',
    authorName: 'Rita',
    occurredAt: '2026-08-20T10:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'work-item', workItemId: 'item-1', board: 'work', commentId: 'comment-1' },
  };
}

function activityItem(workItemId = 'item-2', title = 'Ship the retry banner'): FactoryActivityAttentionItem {
  return {
    key: `factory:${FACTORY_ID}:attention:activity:${workItemId}:3`,
    kind: 'activity',
    commentId: 'comment-9',
    occurrence: 3,
    workItemId,
    title,
    detail: 'Pushed the retry branch.',
    authorId: 'user-3',
    authorName: 'Grace',
    occurredAt: '2026-08-21T10:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'work-item', workItemId, board: 'work', commentId: 'comment-9' },
  };
}

function renderAttention() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/overview`]}>
      <MainSidebarProvider storageKey="sidebar-attention-test" mobileBreakpoint={0}>
        <Routes>
          <Route
            path="/factories/:factoryId/*"
            element={
              <MainSidebar>
                <MainSidebar.Bottom>
                  <MainSidebar.NavList>
                    <SidebarAttention />
                  </MainSidebar.NavList>
                </MainSidebar.Bottom>
              </MainSidebar>
            }
          />
        </Routes>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}
function attentionView(value: string | null): FactoryAttentionView {
  return value === 'unread' || value === 'archived' ? value : 'open';
}
function stubAttention(initialItems: FactoryAttentionItem[], initialApprovalCount = 0) {
  let items = initialItems;
  let approvalCount = initialApprovalCount;
  const retried: string[] = [];
  const receipts: string[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) => {
      const url = new URL(request.url);
      const view = attentionView(url.searchParams.get('view'));
      const limit = Number(url.searchParams.get('limit') ?? 50);
      const visible = items.filter(item => {
        if (view === 'archived') return item.archived;
        if (view === 'unread') return !item.read && !item.archived;
        return !item.archived;
      });
      const unread = (rows: FactoryAttentionItem[]) => rows.filter(row => !row.read && !row.archived).length;
      const badge = items.filter(item => item.kind !== 'activity');
      const activity = items.filter(item => item.kind === 'activity');
      const latest = badge[0];
      const tierParam = url.searchParams.get('tier');
      const tiered = tierParam === 'badge' ? visible.filter(item => item.kind !== 'activity') : visible;
      return HttpResponse.json({
        items: tiered.slice(0, limit),
        openCount: badge.filter(item => !item.archived).length + approvalCount,
        approvalCount,
        badgeCount: unread(badge) + approvalCount,
        unreadCount: unread(badge),
        activityUnreadCount: unread(activity),
        latestOccurrenceKey: latest?.key ?? null,
        latestOccurrenceAt: latest?.occurredAt ?? null,
        latestOccurrenceUnread: latest !== undefined && !latest.read && !latest.archived,
        hasMore: tiered.length > limit,
      });
    }),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention/:kind/:sourceId/:occurrence/:action`,
      ({ params }) => {
        receipts.push(`${params.kind}/${params.sourceId}/${params.occurrence}/${params.action}`);
        const occurrence = Number(params.occurrence);
        items = items.map(item => {
          if (
            item.kind !== params.kind ||
            attentionItemSourceId(item) !== params.sourceId ||
            item.occurrence !== occurrence
          )
            return item;
          if (params.action === 'archive') return { ...item, read: true, archived: true };
          if (params.action === 'restore') return { ...item, read: true, archived: false };
          return { ...item, read: true };
        });
        return HttpResponse.json({ receipt: { state: params.action === 'archive' ? 'archived' : 'read' } });
      },
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/:decisionId/retry`, ({ params }) => {
      retried.push(String(params.decisionId));
      items = items.filter(item => item.kind !== 'automation-failed' || item.decisionId !== params.decisionId);
      return HttpResponse.json({ decision: { id: params.decisionId, status: 'retry' } });
    }),
  );
  return {
    setItems: (nextItems: FactoryAttentionItem[]) => {
      items = nextItems;
    },
    retried,
    receipts,
    setApprovalCount: (count: number) => {
      approvalCount = count;
    },
  };
}

beforeEach(() => {
  localStorage.removeItem(SOUND_STORAGE_KEY);
  oscillatorStart.mockClear();
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextStub });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: async (_name: string, callback: () => Promise<unknown>) => callback() },
  });
});

describe('Sidebar attention', () => {
  it('shows failed automation, links to the full page, and removes it after retry', async () => {
    const api = stubAttention([attentionItem()]);
    const user = userEvent.setup();
    const { client } = renderAttention();

    const trigger = await screen.findByRole('button', { name: 'Needs attention, 1 unread, 1 open' });
    await user.click(trigger);
    expect(screen.getByRole('link', { name: 'View all attention' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/attention`,
    );
    expect(await screen.findByText('Fix the loader')).toBeVisible();
    expect(screen.getByText('No active Factory binding for role work.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open thread for Fix the loader' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/workspaces/session-attention/threads/thread-attention`,
    );

    await user.click(screen.getByRole('button', { name: 'Retry Fix the loader' }));

    await waitFor(() => expect(api.retried).toEqual([DECISION_ID]));
    await waitForMutationsIdle(client);
    expect(await screen.findByText('Nothing needs attention.')).toBeVisible();
  });

  it('keeps read failures open and hides archived failures', async () => {
    stubAttention([attentionItem()]);
    const user = userEvent.setup();
    const { client } = renderAttention();

    await user.click(await screen.findByRole('button', { name: 'Needs attention, 1 unread, 1 open' }));
    await user.click(screen.getByRole('button', { name: 'Mark Fix the loader as read' }));
    await waitForMutationsIdle(client);

    await screen.findByRole('button', { name: 'Needs attention, 1 open' });
    const archive = screen.getByRole('button', { name: 'Archive Fix the loader' });
    await waitFor(() => expect(archive).toBeEnabled());
    await user.click(archive);
    await waitForMutationsIdle(client);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Needs attention' })).toBeInTheDocument());
  });

  it('does not sound when an old item enters the preview', async () => {
    const total = ATTENTION_PREVIEW_LIMIT + 1;
    const beyond = `Failure ${ATTENTION_PREVIEW_LIMIT}`;
    const items = Array.from({ length: total }, (_, index) => {
      const decisionId = `decision-${index}`;
      return {
        ...attentionItem(),
        key: `factory:${FACTORY_ID}:decision:${decisionId}:failure:1`,
        decisionId,
        title: `Failure ${index}`,
      };
    });
    stubAttention(items);
    const user = userEvent.setup();
    renderAttention();

    const trigger = await screen.findByRole('button', {
      name: `Needs attention, ${total} unread, ${total} open`,
    });
    await user.click(trigger);
    await screen.findByText('Failure 0');
    expect(screen.queryByText(beyond)).not.toBeInTheDocument();
    expect(oscillatorStart).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Archive Failure 0' }));

    expect(await screen.findByText(beyond)).toBeVisible();
    await screen.findByRole('button', {
      name: `Needs attention, ${ATTENTION_PREVIEW_LIMIT} unread, ${ATTENTION_PREVIEW_LIMIT} open`,
    });
    expect(oscillatorStart).not.toHaveBeenCalled();
  });
  it('plays a new failure occurrence only after the initial baseline', async () => {
    const api = stubAttention([]);
    const user = userEvent.setup();
    const { client } = renderAttention();
    const emptyTrigger = await screen.findByRole('button', { name: 'Needs attention' });
    await user.click(emptyTrigger);
    await screen.findByText('Nothing needs attention.');
    await user.click(emptyTrigger);
    expect(oscillatorStart).not.toHaveBeenCalled();

    const next = attentionItem(2);
    api.setItems([next]);
    await client.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(FACTORY_ID) });
    await waitForMutationsIdle(client);

    await screen.findByRole('button', { name: 'Needs attention, 1 unread, 1 open' });
    await waitFor(() => expect(localStorage.getItem(SOUND_STORAGE_KEY)).toContain(next.key));
    expect(oscillatorStart).toHaveBeenCalled();
  });

  it('sounds for a newer failure when the unread count stays flat', async () => {
    const api = stubAttention([attentionItem()]);
    const { client } = renderAttention();
    await screen.findByRole('button', { name: 'Needs attention, 1 unread, 1 open' });
    expect(oscillatorStart).not.toHaveBeenCalled();

    const next = {
      ...attentionItem(),
      key: `factory:${FACTORY_ID}:attention:automation-failed:decision-2:1`,
      decisionId: 'decision-2',
      title: 'Fix the worker',
      occurredAt: '2026-08-20T10:01:00.000Z',
    };
    api.setItems([next]);
    await client.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(FACTORY_ID) });
    await waitForMutationsIdle(client);

    await waitFor(() => expect(localStorage.getItem(SOUND_STORAGE_KEY)).toContain(next.key));
    expect(oscillatorStart).toHaveBeenCalled();
  });

  it('shows a mention linking to the comment and reads it through the mention receipt path', async () => {
    const api = stubAttention([mentionItem()]);
    const user = userEvent.setup();
    const { client } = renderAttention();

    await user.click(await screen.findByRole('button', { name: 'Needs attention, 1 unread, 1 open' }));

    expect(await screen.findByText('mention')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View card for Fix the loader' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work?item=item-1&comment=comment-1`,
    );

    await user.click(screen.getByRole('button', { name: 'Mark Fix the loader as read' }));
    await waitForMutationsIdle(client);

    expect(api.receipts).toEqual(['mention/comment-1/0/read']);
    await screen.findByRole('button', { name: 'Needs attention, 1 open' });
  });

  it('surfaces a supervisor finding in the badge and routes its receipt through the finding key', async () => {
    const api = stubAttention([supervisorFindingItem()]);
    const user = userEvent.setup();
    const { client } = renderAttention();

    await user.click(await screen.findByRole('button', { name: 'Needs attention, 1 unread, 1 open' }));

    expect(await screen.findByText('finding')).toBeVisible();
    expect(screen.getByText('The decision has been retrying past its backoff.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark A decision is stuck as read' }));
    await waitForMutationsIdle(client);

    expect(api.receipts).toEqual([`supervisor-finding/decision-stuck:${DECISION_ID}/0/read`]);
  });

  it('does not offer Retry for a deterministic failure', async () => {
    stubAttention([{ ...attentionItem(), failureCode: 'unsupported_provider_item', canRetry: false }]);
    const user = userEvent.setup();
    renderAttention();

    await user.click(await screen.findByRole('button', { name: 'Needs attention, 1 unread, 1 open' }));

    expect(screen.queryByRole('button', { name: 'Retry Fix the loader' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open thread for Fix the loader' })).toBeVisible();
  });

  it('shows proposed work as one project queue', async () => {
    stubAttention([], 12);
    const user = userEvent.setup();
    renderAttention();

    await user.click(await screen.findByRole('button', { name: 'Needs attention, 12 waiting for approval, 12 open' }));

    expect(screen.getByText('waiting for approval')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /items waiting for approval/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all attention' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/attention`,
    );
    expect(screen.queryByRole('button', { name: /mark/i })).not.toBeInTheDocument();
  });
  it('deduplicates persisted sound claims by scope and occurrence', async () => {
    await playAttentionSoundOnce('user-1:factory-1', 'failure-1');
    const notesPerPlayback = oscillatorStart.mock.calls.length;
    expect(notesPerPlayback).toBeGreaterThan(0);
    await playAttentionSoundOnce('user-1:factory-1', 'failure-1');

    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toContain('failure-1');
    expect(oscillatorStart).toHaveBeenCalledTimes(notesPerPlayback);
  });

  it('keeps the popover on the badge tier when newer activity fills the page', async () => {
    const chatter = ['item-2', 'item-3', 'item-4', 'item-5', 'item-6'].map(id => activityItem(id, `Chatter on ${id}`));
    stubAttention([...chatter, mentionItem()]);
    const user = userEvent.setup();
    renderAttention();

    await user.click(await screen.findByRole('button', { name: 'Needs attention, 1 unread, 1 open' }));

    expect(screen.getByText('Fix the loader')).toBeVisible();
    expect(screen.queryByText(/Chatter on/)).not.toBeInTheDocument();
  });
});
