import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import type {
  FactoryActivityAttentionItem,
  FactoryAutomationFailedAttentionItem,
  FactoryAttentionView,
  FactoryMentionAttentionItem,
} from '../../domains/factory/services/attention';
import type { FactoryDecisionSummary } from '../../domains/factory/services/decisions';
import { AttentionContent } from '../AttentionPage';

const FACTORY_ID = 'factory-1';
/** One poll tick (5s) plus room for the request to land. */
const PAST_ONE_POLL_MS = 7_000;

function item(id: string, title: string, read: boolean): FactoryAutomationFailedAttentionItem {
  return {
    key: `factory:${FACTORY_ID}:attention:automation-failed:${id}:1`,
    kind: 'automation-failed',
    decisionId: id,
    occurrence: 1,
    workItemId: `item-${id}`,
    title,
    detail: `Failure for ${title}`,
    decisionType: 'sendMessage',
    failureCode: 'source_control_missing',
    canRetry: true,
    occurredAt: '2026-08-20T10:00:00.000Z',
    read,
    archived: false,
    target: { kind: 'work-item', workItemId: `item-${id}`, board: 'work' },
  };
}

function proposal(id: string, type: string, role: string, workItemId: string): FactoryDecisionSummary {
  return {
    id,
    evaluationId: `evaluation-${id}`,
    workItemId,
    type,
    role,
    status: 'proposed',
    attempts: 0,
    failureOccurrence: 0,
    failureCode: null,
    canRetry: false,
    lastError: null,
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    completedAt: null,
  };
}

function attentionView(value: string | null): FactoryAttentionView {
  return value === 'unread' || value === 'archived' ? value : 'open';
}

function mentionItem(commentId: string, title: string): FactoryMentionAttentionItem {
  return {
    key: `factory:${FACTORY_ID}:attention:mention:${commentId}:0`,
    kind: 'mention',
    commentId,
    authorId: 'user-2',
    authorName: 'Ada',
    occurrence: 0,
    workItemId: 'item-9',
    title,
    detail: 'Can you look at this?',
    occurredAt: '2026-08-21T10:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'work-item', workItemId: 'item-9', board: 'work', commentId },
  };
}

function activityItem(workItemId: string, title: string): FactoryActivityAttentionItem {
  return {
    key: `factory:${FACTORY_ID}:attention:activity:${workItemId}:2`,
    kind: 'activity',
    commentId: 'comment-7',
    authorId: 'user-3',
    authorName: 'Grace',
    occurrence: 2,
    workItemId,
    title,
    detail: 'Pushed the retry branch.',
    occurredAt: '2026-08-22T10:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'work-item', workItemId, board: 'work', commentId: 'comment-7' },
  };
}

describe('AttentionPage', () => {
  it('filters, marks read, archives, and restores attention items', async () => {
    let items = [item('decision-1', 'Fix the loader', false), item('decision-2', 'Repair auth', true)];
    let markAllRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) => {
        const view = attentionView(new URL(request.url).searchParams.get('view'));
        const visible = items.filter(attentionItem => {
          if (view === 'archived') return attentionItem.archived;
          if (view === 'unread') return !attentionItem.read && !attentionItem.archived;
          return !attentionItem.archived;
        });
        return HttpResponse.json({
          items: visible,
          openCount: items.filter(attentionItem => !attentionItem.archived).length,
          approvalCount: 0,
          badgeCount: items.filter(attentionItem => !attentionItem.read && !attentionItem.archived).length,
          unreadCount: items.filter(attentionItem => !attentionItem.read && !attentionItem.archived).length,
          hasMore: false,
        });
      }),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention/read-all`, ({ request }) => {
        markAllRequests += 1;
        const before = new URL(request.url).searchParams.get('before');
        if (!before) return HttpResponse.json({ ok: true, hasMore: true, nextCursor: 'older-failures' });
        items = items.map(attentionItem => (attentionItem.archived ? attentionItem : { ...attentionItem, read: true }));
        return HttpResponse.json({ ok: true, hasMore: false });
      }),
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention/automation-failed/:decisionId/:occurrence/:action`,
        ({ params }) => {
          items = items.map(attentionItem => {
            if (attentionItem.decisionId !== params.decisionId) return attentionItem;
            if (params.action === 'archive') return { ...attentionItem, read: true, archived: true };
            if (params.action === 'restore') return { ...attentionItem, read: true, archived: false };
            return { ...attentionItem, read: true };
          });
          return HttpResponse.json({ receipt: { state: params.action === 'archive' ? 'archived' : 'read' } });
        },
      ),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/attention`]}>
        <AttentionContent factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Fix the loader')).toBeVisible();
    expect(screen.getByText('Repair auth')).toBeVisible();
    const [goTo] = screen.getAllByRole('link', { name: /View card for/ });
    if (!goTo) throw new Error('Expected a work-item destination');
    expect(goTo).toHaveAttribute('href', `/factories/${FACTORY_ID}/work?item=item-decision-1`);
    await user.click(screen.getByRole('button', { name: 'Mark all open as read' }));
    await waitFor(() => expect(markAllRequests).toBe(2));
    await waitForMutationsIdle(client);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Mark all open as read' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Archive Fix the loader' }));
    await waitForMutationsIdle(client);
    await waitFor(() => expect(screen.queryByText('Fix the loader')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Archived' }));
    expect(await screen.findByText('Fix the loader')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Restore Fix the loader' }));
    await waitForMutationsIdle(client);
    expect(await screen.findByText('No archived attention items.')).toBeVisible();
  });

  it('groups the approval queue by role and runs one proposal from the inbox', async () => {
    let proposals = [
      proposal('decision-9', 'invokeSkill', 'review', 'item-1'),
      proposal('decision-8', 'invokeSkill', 'triage', 'item-2'),
      proposal('decision-7', 'invokeSkill', 'triage', 'item-3'),
    ];
    const approved: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, () =>
        HttpResponse.json({
          items: [],
          openCount: proposals.length,
          approvalCount: proposals.length,
          badgeCount: proposals.length,
          unreadCount: 0,
          hasMore: false,
          latestOccurrenceKey: null,
          latestOccurrenceAt: null,
          latestOccurrenceUnread: false,
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [
            { id: 'item-1', title: 'Bump vite to 7', stage: 'review', stageHistory: [], metadata: {} },
            { id: 'item-2', title: 'Fix the flaky auth test', stage: 'triage', stageHistory: [], metadata: {} },
            { id: 'item-3', title: 'Drop the dead flag', stage: 'triage', stageHistory: [], metadata: {} },
          ],
          runningSessionIds: [],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
        HttpResponse.json({ decisions: proposals }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/:decisionId/approve`, ({ params }) => {
        approved.push(String(params.decisionId));
        proposals = proposals.filter(decision => decision.id !== params.decisionId);
        return HttpResponse.json({ decision: { ...proposals[0], status: 'pending' } });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/attention`]}>
        <AttentionContent factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    // Three proposals, two shapes: the queue reads as two rows, not three.
    const triage = await screen.findByRole('button', { name: /2 triage runs/ });
    expect(screen.getByRole('button', { name: /1 review run/ })).toBeVisible();
    expect(screen.queryByText('Fix the flaky auth test')).not.toBeInTheDocument();

    await user.click(triage);
    expect(await screen.findByText('Fix the flaky auth test')).toBeVisible();
    expect(screen.getByText('Drop the dead flag')).toBeVisible();
    expect(screen.queryByText('Bump vite to 7')).not.toBeInTheDocument();

    const row = screen.getByText('Fix the flaky auth test').closest('li');
    await user.click(within(row!).getByRole('button', { name: 'Run' }));
    await waitForMutationsIdle(client);
    expect(approved).toEqual(['decision-8']);
    await waitFor(() => expect(screen.getByRole('button', { name: /1 triage run/ })).toBeVisible());
  });

  it('clears a whole proposal group only after the dismissal is confirmed', async () => {
    let proposals = [
      proposal('decision-8', 'invokeSkill', 'triage', 'item-2'),
      proposal('decision-7', 'invokeSkill', 'triage', 'item-3'),
    ];
    const dismissed: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, () =>
        HttpResponse.json({
          items: [],
          openCount: proposals.length,
          approvalCount: proposals.length,
          badgeCount: proposals.length,
          unreadCount: 0,
          hasMore: false,
          latestOccurrenceKey: null,
          latestOccurrenceAt: null,
          latestOccurrenceUnread: false,
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
        HttpResponse.json({ decisions: proposals }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/:decisionId/dismiss`, ({ params }) => {
        dismissed.push(String(params.decisionId));
        proposals = proposals.filter(decision => decision.id !== params.decisionId);
        return HttpResponse.json({
          decision: { ...proposal('x', 'invokeSkill', 'triage', 'item-2'), status: 'dismissed' },
        });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/attention`]}>
        <AttentionContent factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    // First click only arms the confirmation: 2 runs cannot go on one stray click.
    await user.click(await screen.findByRole('button', { name: 'Dismiss all' }));
    expect(dismissed).toEqual([]);

    await user.click(await screen.findByRole('button', { name: 'Dismiss 2?' }));
    await waitForMutationsIdle(client);
    expect(dismissed).toEqual(['decision-8', 'decision-7']);
    await waitFor(() => expect(screen.queryByText(/triage runs/)).not.toBeInTheDocument());
  });

  it('renders mentions beside failures, deep-links to the comment, and pages with the cursor', async () => {
    const KIND_CURSOR = 'mention=2026-08-21T10:00:00.000Z_comment-1;automation-failed=2026-08-20T10:00:00.000Z_1';
    const requestedCursors: (string | null)[] = [];
    const receiptCalls: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) => {
        const before = new URL(request.url).searchParams.get('before');
        requestedCursors.push(before);
        const firstPage = [mentionItem('comment-1', 'Fix login bug'), item('decision-1', 'Fix the loader', false)];
        const secondPage = [item('decision-2', 'Repair auth', false)];
        return HttpResponse.json({
          items: before === KIND_CURSOR ? secondPage : firstPage,
          openCount: 3,
          approvalCount: 0,
          badgeCount: 3,
          unreadCount: 3,
          hasMore: before !== KIND_CURSOR,
          ...(before !== KIND_CURSOR ? { nextCursor: KIND_CURSOR } : {}),
        });
      }),
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention/:kind/:sourceId/:occurrence/:action`,
        ({ params }) => {
          receiptCalls.push(`${params.kind}/${params.sourceId}/${params.occurrence}/${params.action}`);
          return HttpResponse.json({ receipt: { state: 'archived' } });
        },
      ),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/attention`]}>
        <AttentionContent factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('mention')).toBeVisible();
    expect(screen.getByRole('link', { name: /View card for Fix login bug/ })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work?item=item-9&comment=comment-1`,
    );

    await user.click(screen.getByRole('button', { name: 'Archive Fix login bug' }));
    await waitForMutationsIdle(client);
    expect(receiptCalls).toEqual(['mention/comment-1/0/archive']);

    await user.click(screen.getByRole('button', { name: 'Load more attention items' }));
    await waitForMutationsIdle(client);
    expect(await screen.findByText('Repair auth')).toBeVisible();
    expect(requestedCursors.filter(cursor => cursor !== null)).toEqual([KIND_CURSOR]);
  });

  it('searches the server before pagination', async () => {
    const allItems = Array.from({ length: 26 }, (_, index) =>
      item(`decision-${index}`, index === 25 ? 'Needle on page two' : `Routine failure ${index}`, false),
    );
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) => {
        const search = new URL(request.url).searchParams.get('search')?.toLowerCase();
        const matching = search
          ? allItems.filter(attentionItem => attentionItem.title.toLowerCase().includes(search))
          : allItems;
        return HttpResponse.json({
          items: matching.slice(0, 25),
          openCount: allItems.length,
          approvalCount: 0,
          badgeCount: allItems.length,
          unreadCount: allItems.length,
          hasMore: matching.length > 25,
          ...(matching.length > 25 ? { nextCursor: 'page-2' } : {}),
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/attention`]}>
        <AttentionContent factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Routine failure 0');
    expect(screen.queryByText('Needle on page two')).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search attention items' }), 'Needle');
    expect(await screen.findByText('Needle on page two')).toBeVisible();
  });

  it('files activity under its own section, below what needs an answer', async () => {
    const receiptCalls: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, () =>
        HttpResponse.json({
          items: [
            activityItem('item-4', 'Loader retry landed'),
            mentionItem('comment-1', 'Fix login bug'),
            item('decision-1', 'Fix the loader', false),
          ],
          openCount: 2,
          approvalCount: 0,
          badgeCount: 2,
          unreadCount: 2,
          activityUnreadCount: 1,
          hasMore: false,
        }),
      ),
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention/:kind/:sourceId/:occurrence/:action`,
        ({ params }) => {
          receiptCalls.push(`${params.kind}/${params.sourceId}/${params.occurrence}/${params.action}`);
          return HttpResponse.json({ receipt: { state: 'read' } });
        },
      ),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/attention`]}>
        <AttentionContent factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    const activity = await screen.findByRole('region', { name: 'Activity' });
    expect(within(activity).getByText('comment')).toBeVisible();
    expect(within(activity).getByText('1')).toBeVisible();
    expect(within(activity).queryByText('Fix login bug')).not.toBeInTheDocument();

    const mention = screen.getByText('Fix login bug');
    const activityComesLast = Boolean(activity.compareDocumentPosition(mention) & Node.DOCUMENT_POSITION_PRECEDING);
    expect(activityComesLast).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Mark Loader retry landed as read' }));
    await waitForMutationsIdle(client);
    expect(receiptCalls).toEqual(['activity/item-4/2/read']);
  });
  it('shows a mention that lands while the page is open', async () => {
    let items: (FactoryAutomationFailedAttentionItem | FactoryMentionAttentionItem)[] = [
      item('decision-1', 'Fix the loader', false),
    ];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, () =>
        HttpResponse.json({
          items,
          openCount: items.length,
          approvalCount: 0,
          badgeCount: items.length,
          unreadCount: items.length,
          activityUnreadCount: 0,
          hasMore: false,
        }),
      ),
    );
    renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/attention`]}>
        <AttentionContent factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Fix the loader');
    items = [mentionItem('comment-1', 'Fix login bug'), ...items];
    expect(await screen.findByText('mention', undefined, { timeout: PAST_ONE_POLL_MS })).toBeVisible();
  });
});
