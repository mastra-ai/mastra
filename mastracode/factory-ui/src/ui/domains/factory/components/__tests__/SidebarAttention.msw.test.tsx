import { MainSidebar, MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactoryAttentionItem, FactoryAttentionView } from '../../services/attention';
import { playAttentionSoundOnce } from '../../services/attentionSound';
import { SidebarAttention } from '../SidebarAttention';

const FACTORY_ID = 'factory-1';
const DECISION_ID = 'decision-1';
const SOUND_STORAGE_KEY = 'mastracode.attentionNotified.v2';
const oscillatorStart = vi.fn();

class AudioContextStub {
  state = 'running';
  currentTime = 0;
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
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }
}

function attentionItem(occurrence = 1): FactoryAttentionItem {
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
      const latest = items[0];
      return HttpResponse.json({
        items: visible.slice(0, limit),
        openCount: items.filter(item => !item.archived).length + approvalCount,
        approvalCount,
        badgeCount: items.filter(item => !item.read && !item.archived).length + approvalCount,
        unreadCount: items.filter(item => !item.read && !item.archived).length,
        latestOccurrenceKey: latest?.key ?? null,
        latestOccurrenceAt: latest?.occurredAt ?? null,
        latestOccurrenceUnread: latest !== undefined && !latest.read && !latest.archived,
        hasMore: visible.length > limit,
      });
    }),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention/automation-failed/:decisionId/:occurrence/:action`,
      ({ params }) => {
        const occurrence = Number(params.occurrence);
        items = items.map(item => {
          if (item.decisionId !== params.decisionId || item.occurrence !== occurrence) return item;
          if (params.action === 'archive') return { ...item, read: true, archived: true };
          if (params.action === 'restore') return { ...item, read: true, archived: false };
          return { ...item, read: true };
        });
        return HttpResponse.json({ receipt: { state: params.action === 'archive' ? 'archived' : 'read' } });
      },
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/:decisionId/retry`, ({ params }) => {
      retried.push(String(params.decisionId));
      items = items.filter(item => item.decisionId !== params.decisionId);
      return HttpResponse.json({ decision: { id: params.decisionId, status: 'retry' } });
    }),
  );
  return {
    setItems: (nextItems: FactoryAttentionItem[]) => {
      items = nextItems;
    },
    retried,
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

  it('does not sound when an old item enters the five-row preview', async () => {
    const items = Array.from({ length: 6 }, (_, index) => {
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

    const trigger = await screen.findByRole('button', { name: 'Needs attention, 6 unread, 6 open' });
    await user.click(trigger);
    await screen.findByText('Failure 0');
    expect(screen.queryByText('Failure 5')).not.toBeInTheDocument();
    expect(oscillatorStart).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Archive Failure 0' }));

    expect(await screen.findByText('Failure 5')).toBeVisible();
    await screen.findByRole('button', { name: 'Needs attention, 5 unread, 5 open' });
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

    expect(screen.getByRole('link', { name: /12 items waiting for approval/i })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/rules?group=proposed`,
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
});
