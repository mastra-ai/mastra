import { Sidebar, SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../../../api/keys';
import { attentionKindSummaries } from '../../../../../../e2e/ui/attention';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type {
  FactoryAttentionItem,
  FactoryActivityAttentionItem,
  FactoryAutomationFailedAttentionItem,
  FactoryAutomationProposedAttentionItem,
  FactoryMentionAttentionItem,
} from '../../services/attention';
import { playAttentionSoundOnce } from '../../services/attentionSound';
import { OverlaysProvider } from '../../../../lib/overlays';
import { SidebarActivityLink } from '../SidebarActivityLink';

const FACTORY_ID = 'factory-1';
const DECISION_ID = 'decision-1';
const SOUND_STORAGE_KEY = 'mastracode.attentionNotified.v2';
const oscillatorStart = vi.fn();

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
    return { numberOfChannels, getChannelData: (channel: number) => channels[channel] };
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

function proposedItem(): FactoryAutomationProposedAttentionItem {
  return {
    key: `factory:${FACTORY_ID}:attention:automation-proposed:${DECISION_ID}:0`,
    kind: 'automation-proposed',
    decisionId: DECISION_ID,
    occurrence: 0,
    workItemId: 'item-1',
    title: 'Fix the loader',
    detail: 'Waiting for approval to run review',
    decisionType: 'invokeSkill',
    occurredAt: '2026-08-20T10:00:00.000Z',
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
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/work`]}>
      <SidebarProvider storageKey="sidebar-activity-test" mobileBreakpoint={0}>
        <OverlaysProvider>
          <Routes>
            <Route
              path="/factories/:factoryId/*"
              element={
                <Sidebar>
                  <Sidebar.Footer>
                    <Sidebar.NavList>
                      <SidebarActivityLink />
                    </Sidebar.NavList>
                  </Sidebar.Footer>
                </Sidebar>
              }
            />
          </Routes>
        </OverlaysProvider>
      </SidebarProvider>
    </MemoryRouter>,
  );
}
function stubAttention(initialItems: FactoryAttentionItem[]) {
  let items = initialItems;
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, () =>
      HttpResponse.json({ items: [], kinds: attentionKindSummaries(items), hasMore: false }),
    ),
  );
  return {
    setItems: (nextItems: FactoryAttentionItem[]) => {
      items = nextItems;
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

describe('Sidebar activity link', () => {
  it('links to the activity page and counts an unread failure', async () => {
    stubAttention([attentionItem()]);
    renderAttention();

    const link = await screen.findByRole('link', { name: 'Activity, 1 unread' });
    expect(link).toHaveAttribute('href', `/factories/${FACTORY_ID}/activity`);
    expect(link).toHaveTextContent('1');
  });

  it('counts failures and mentions, leaving proposals and followed discussions out of the number', async () => {
    stubAttention([attentionItem(), mentionItem(), proposedItem(), activityItem()]);
    renderAttention();

    expect(await screen.findByRole('link', { name: 'Activity, 2 unread' })).toBeVisible();
  });

  it('shows no unread count when only followed discussions are new', async () => {
    stubAttention([activityItem()]);
    renderAttention();

    const link = await screen.findByRole('link', { name: 'Activity' });
    expect(link).not.toHaveTextContent(/\d/);
  });

  it('drops the unread count once an open failure is read', async () => {
    const api = stubAttention([attentionItem()]);
    const { client } = renderAttention();
    await screen.findByRole('link', { name: 'Activity, 1 unread' });

    api.setItems([{ ...attentionItem(), read: true }]);
    await client.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(FACTORY_ID) });
    await waitForMutationsIdle(client);

    expect(await screen.findByRole('link', { name: 'Activity' })).toBeVisible();
  });

  it('plays a new failure occurrence only after the initial baseline', async () => {
    const api = stubAttention([]);
    const { client } = renderAttention();
    await screen.findByRole('link', { name: 'Activity' });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(oscillatorStart).not.toHaveBeenCalled();

    const next = attentionItem(2);
    api.setItems([next]);
    await client.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(FACTORY_ID) });
    await waitForMutationsIdle(client);

    await screen.findByRole('link', { name: 'Activity, 1 unread' });
    await waitFor(() => expect(localStorage.getItem(SOUND_STORAGE_KEY)).toContain(next.key));
    expect(oscillatorStart).toHaveBeenCalled();
  });

  it('does not sound for an unread failure already there on load', async () => {
    const api = stubAttention([attentionItem()]);
    const { client } = renderAttention();
    await screen.findByRole('link', { name: 'Activity, 1 unread' });

    api.setItems([attentionItem()]);
    await client.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(FACTORY_ID) });
    await waitForMutationsIdle(client);

    expect(oscillatorStart).not.toHaveBeenCalled();
  });

  it('sounds for a newer failure when the unread count stays flat', async () => {
    const api = stubAttention([attentionItem()]);
    const { client } = renderAttention();
    await screen.findByRole('link', { name: 'Activity, 1 unread' });
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

  it('does not sound when an older failure surfaces', async () => {
    const api = stubAttention([attentionItem()]);
    const { client } = renderAttention();
    await screen.findByRole('link', { name: 'Activity, 1 unread' });

    const older = {
      ...attentionItem(),
      key: `factory:${FACTORY_ID}:attention:automation-failed:decision-0:1`,
      decisionId: 'decision-0',
      title: 'Fix the parser',
      occurredAt: '2026-08-19T10:00:00.000Z',
    };
    api.setItems([older]);
    await client.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(FACTORY_ID) });
    await waitForMutationsIdle(client);

    expect(await screen.findByRole('link', { name: 'Activity, 1 unread' })).toBeVisible();
    expect(oscillatorStart).not.toHaveBeenCalled();
  });

  it('keeps a new approval out of the count and silent', async () => {
    const api = stubAttention([]);
    const { client } = renderAttention();
    await screen.findByRole('link', { name: 'Activity' });
    await waitFor(() => expect(client.isFetching()).toBe(0));

    api.setItems([proposedItem()]);
    await client.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(FACTORY_ID) });
    await waitFor(() => expect(client.isFetching()).toBe(0));

    const link = screen.getByRole('link', { name: 'Activity' });
    expect(link).not.toHaveTextContent('1');
    expect(oscillatorStart).not.toHaveBeenCalled();
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
