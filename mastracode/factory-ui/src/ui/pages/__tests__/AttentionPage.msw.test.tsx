import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import type {
  FactoryAutomationFailedAttentionItem,
  FactoryAttentionView,
  FactoryMentionAttentionItem,
} from '../../domains/factory/services/attention';
import { AttentionContent } from '../AttentionPage';

const FACTORY_ID = 'factory-1';

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

  it('shows proposed work as one intake queue without receipts', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, () =>
        HttpResponse.json({
          items: [],
          openCount: 7,
          approvalCount: 7,
          badgeCount: 7,
          unreadCount: 0,
          hasMore: false,
          latestOccurrenceKey: null,
          latestOccurrenceAt: null,
          latestOccurrenceUnread: false,
        }),
      ),
    );
    renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/attention`]}>
        <AttentionContent factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: /7 items waiting for approval/i })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/rules?group=proposed`,
    );
    expect(screen.queryByRole('button', { name: 'Mark all open as read' })).not.toBeInTheDocument();
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

    expect(await screen.findByText(/Ada mentioned you/)).toBeVisible();
    expect(screen.getByRole('link', { name: /View card for Fix login bug/ })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work?item=item-9&comment=comment-1`,
    );

    await user.click(screen.getByRole('button', { name: 'Archive Fix login bug' }));
    await waitForMutationsIdle(client);
    expect(receiptCalls).toEqual(['mention/comment-1/0/archive']);

    await user.click(screen.getByRole('button', { name: 'Load more' }));
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
});
