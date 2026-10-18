import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { attentionKindSummaries, itemsOfRequestedKinds } from '../../../../../../../e2e/ui/attention';
import { server } from '../../../../../../../e2e/ui/msw-server';
import { pickPropertyOption } from '../../../../../../../e2e/ui/properties-menu';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import type {
  FactoryActivityAttentionItem,
  FactoryAttentionItem,
  FactoryAutomationFailedAttentionItem,
  FactoryAutomationProposedAttentionItem,
  FactoryMentionAttentionItem,
} from '../../../services/attention';
import { NeedsYou } from './NeedsYou';

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

function proposedItem(id: string, title: string): FactoryAutomationProposedAttentionItem {
  return {
    key: `factory:${FACTORY_ID}:attention:automation-proposed:${id}:0`,
    kind: 'automation-proposed',
    decisionId: id,
    occurrence: 0,
    workItemId: `item-${id}`,
    title,
    detail: 'Waiting for approval to run triage',
    decisionType: 'invokeSkill',
    occurredAt: '2026-08-20T10:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'work-item', workItemId: `item-${id}`, board: 'work' },
  };
}

function renderNeedsYou() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/activity`]}>
      <NeedsYou factoryId={FACTORY_ID} />
    </MemoryRouter>,
  );
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

/** An attention row of a kind this client does not render. */
function retiredKindItem() {
  return {
    key: `factory:${FACTORY_ID}:attention:retired-kind:finding-1:0`,
    kind: 'retired-kind',
    occurrence: 0,
    workItemId: null,
    title: 'Retired kind row',
    detail: 'A server older than this client still reports it.',
    occurredAt: '2026-08-22T10:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'rules' },
  };
}

describe('Needs you', () => {
  it('saves repository choice by work-item ID before retrying without loading the board', async () => {
    const events: string[] = [];
    const failure = {
      ...item('decision-1', 'Fix the loader', false),
      failureCode: 'source_repository_ambiguous' as const,
    };
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'connection-1',
              installationId: 'installation-1',
              repositories: [
                { id: 'repo-2', branch: 'main', repository: { slug: 'acme/other', defaultBranch: 'main' } },
                { id: 'repo-1', branch: 'main', repository: { slug: 'acme/app', defaultBranch: 'main' } },
              ],
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) =>
        HttpResponse.json({
          items: itemsOfRequestedKinds(request, [failure]),
          kinds: attentionKindSummaries([failure]),
          hasMore: false,
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => {
        events.push('board-fetch');
        return HttpResponse.json({ workItems: [] });
      }),
      http.patch(`${TEST_BASE_URL}/web/factory/work-items/item-decision-1`, async ({ request }) => {
        events.push(`patch:${JSON.stringify(await request.json())}`);
        return HttpResponse.json({ workItem: { id: 'item-decision-1' } });
      }),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/decision-1/retry`, () => {
        events.push('retry');
        return HttpResponse.json({ decision: { id: 'decision-1' } });
      }),
    );
    const user = userEvent.setup();
    renderNeedsYou();
    await user.click(await screen.findByRole('button', { name: 'Choose repository for Fix the loader' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose a repository' });
    await user.click(within(dialog).getByRole('button', { name: /acme\/app/ }));
    await waitFor(() => expect(events).toEqual(['patch:{"metadata":{"repository":"acme/app"}}', 'retry']));
  });

  it('acts on a row in place, archives it, and restores it from Archived', async () => {
    let items = [item('decision-1', 'Fix the loader', false), item('decision-2', 'Repair auth', true)];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) => {
        const archivedView = new URL(request.url).searchParams.get('view') === 'archived';
        const visible = items.filter(attentionItem => attentionItem.archived === archivedView);
        return HttpResponse.json({
          items: itemsOfRequestedKinds(request, visible),
          kinds: attentionKindSummaries(items),
          hasMore: false,
        });
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
    const { client } = renderNeedsYou();

    expect(await screen.findByText('Fix the loader')).toBeVisible();
    expect(screen.getByText('Repair auth')).toBeVisible();
    const [goTo] = screen.getAllByRole('link', { name: /View card for/ });
    if (!goTo) throw new Error('Expected a work-item destination');
    expect(goTo).toHaveAttribute('href', `/factories/${FACTORY_ID}/work?item=item-decision-1`);

    await user.click(screen.getByRole('button', { name: 'Archive Fix the loader' }));
    await waitForMutationsIdle(client);
    await waitFor(() => expect(screen.queryByText('Fix the loader')).not.toBeInTheDocument());

    await pickPropertyOption(user, 'Needs you properties', 'Show', 'Archived');
    expect(await screen.findByText('Fix the loader')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Restore Fix the loader' }));
    await waitForMutationsIdle(client);
    expect(await screen.findByText('Nothing archived.')).toBeVisible();
  });

  it('lists an archived followed discussion under Archived instead of saying nothing is archived', async () => {
    const archivedDiscussion = { ...activityItem('item-4', 'Loader retry landed'), read: true, archived: true };
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) => {
        const archivedView = new URL(request.url).searchParams.get('view') === 'archived';
        const visible = archivedView ? [archivedDiscussion] : [];
        return HttpResponse.json({
          items: itemsOfRequestedKinds(request, visible),
          kinds: attentionKindSummaries([archivedDiscussion]),
          hasMore: false,
        });
      }),
    );
    const user = userEvent.setup();
    renderNeedsYou();

    expect(await screen.findByText('Nothing needs you right now.')).toBeVisible();
    await pickPropertyOption(user, 'Needs you properties', 'Show', 'Archived');

    expect(await screen.findByText('Loader retry landed')).toBeVisible();
    expect(screen.queryByText('Nothing archived.')).not.toBeInTheDocument();
  });

  it('releases a suggested run from the inbox row', async () => {
    let items = [proposedItem('decision-8', 'Fix the flaky auth test')];
    const settled: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) =>
        HttpResponse.json({
          items: itemsOfRequestedKinds(request, items),
          kinds: attentionKindSummaries(items),
          hasMore: false,
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/:decisionId/:action`, ({ params }) => {
        settled.push(`${params.action}:${params.decisionId}`);
        items = items.filter(attentionItem => attentionItem.decisionId !== params.decisionId);
        return HttpResponse.json({ decision: { id: params.decisionId, status: 'pending' } });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderNeedsYou();

    expect(await screen.findByText('Fix the flaky auth test')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Run Fix the flaky auth test' }));
    await waitForMutationsIdle(client);

    expect(settled).toEqual(['approve:decision-8']);
    await waitFor(() => expect(screen.queryByText('Fix the flaky auth test')).not.toBeInTheDocument());
  });

  it('turns a suggested run down from the inbox row', async () => {
    let items = [proposedItem('decision-7', 'Drop the dead flag')];
    const settled: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) =>
        HttpResponse.json({
          items: itemsOfRequestedKinds(request, items),
          kinds: attentionKindSummaries(items),
          hasMore: false,
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/:decisionId/:action`, ({ params }) => {
        settled.push(`${params.action}:${params.decisionId}`);
        items = items.filter(attentionItem => attentionItem.decisionId !== params.decisionId);
        return HttpResponse.json({ decision: { id: params.decisionId, status: 'dismissed' } });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderNeedsYou();

    expect(await screen.findByText('Drop the dead flag')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Dismiss Drop the dead flag' }));
    await waitForMutationsIdle(client);

    expect(settled).toEqual(['dismiss:decision-7']);
    await waitFor(() => expect(screen.queryByText('Drop the dead flag')).not.toBeInTheDocument());
  });

  it('renders mentions beside failures, deep-links to the comment, and pages with the cursor', async () => {
    const KIND_CURSOR = 'mention=2026-08-21T10:00:00.000Z_comment-1;automation-failed=2026-08-20T10:00:00.000Z_1';
    const requestedCursors: (string | null)[] = [];
    const receiptCalls: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) => {
        const before = new URL(request.url).searchParams.get('before');
        const firstPage = [mentionItem('comment-1', 'Fix login bug'), item('decision-1', 'Fix the loader', false)];
        const secondPage = [item('decision-2', 'Repair auth', false)];
        const pagesOlder = before !== KIND_CURSOR && itemsOfRequestedKinds(request, secondPage).length > 0;
        requestedCursors.push(before);
        return HttpResponse.json({
          items: itemsOfRequestedKinds(request, before === KIND_CURSOR ? secondPage : firstPage),
          kinds: attentionKindSummaries([...firstPage, ...secondPage]),
          hasMore: pagesOlder,
          ...(pagesOlder ? { nextCursor: KIND_CURSOR } : {}),
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
    const { client } = renderNeedsYou();

    expect(await screen.findByText('mention')).toBeVisible();
    expect(screen.getByRole('link', { name: /View card for Fix login bug/ })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work?item=item-9&comment=comment-1`,
    );

    await user.click(screen.getByRole('button', { name: 'Archive Fix login bug' }));
    await waitForMutationsIdle(client);
    expect(receiptCalls).toEqual(['mention/comment-1/0/archive']);

    await user.click(screen.getByRole('button', { name: 'Load older' }));
    await waitForMutationsIdle(client);
    expect(await screen.findByText('Repair auth')).toBeVisible();
    expect(requestedCursors.filter(cursor => cursor !== null)).toEqual([KIND_CURSOR]);
  });

  it('lists followed discussions on their own, under what waits on a person even when newer', async () => {
    const items: FactoryAttentionItem[] = [
      activityItem('item-4', 'Loader retry landed'),
      mentionItem('comment-1', 'Fix login bug'),
      item('decision-1', 'Fix the loader', false),
    ];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) =>
        HttpResponse.json({
          items: itemsOfRequestedKinds(request, items),
          kinds: attentionKindSummaries(items),
          hasMore: false,
        }),
      ),
    );
    renderNeedsYou();

    const followed = await screen.findByRole('region', { name: 'Discussions you follow' });
    expect(within(followed).getByRole('link', { name: 'View card for Loader retry landed' })).toBeVisible();
    expect(screen.getAllByRole('link').map(link => link.getAttribute('aria-label'))).toEqual([
      'View card for Fix login bug',
      'View card for Fix the loader',
      'View card for Loader retry landed',
    ]);
    expect(within(screen.getByRole('region', { name: 'Needs you' })).getByText('2')).toBeVisible();
  });

  it('offers older items when a page comes back empty but the scan has more', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) => {
        const older = itemsOfRequestedKinds(request, [item('decision-3', 'Old failure', false)]);
        if (older.length === 0 || new URL(request.url).searchParams.get('before') === 'scan-200') {
          return HttpResponse.json({ items: older, kinds: attentionKindSummaries(older), hasMore: false });
        }
        return HttpResponse.json({
          items: [],
          kinds: attentionKindSummaries(older),
          hasMore: true,
          nextCursor: 'scan-200',
        });
      }),
    );
    const user = userEvent.setup();
    renderNeedsYou();

    await user.click(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByText('Old failure')).toBeVisible();
    expect(screen.queryByText('Nothing needs you right now.')).not.toBeInTheDocument();
  });

  it('marks everything read in one go, then drops the control', async () => {
    let items: FactoryAttentionItem[] = [item('decision-1', 'Fix the loader', false), mentionItem('c-1', 'Fix login')];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) =>
        HttpResponse.json({
          items: itemsOfRequestedKinds(request, items),
          kinds: attentionKindSummaries(items),
          hasMore: false,
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention/read-all`, () => {
        items = items.map(attentionItem => ({ ...attentionItem, read: true }));
        return HttpResponse.json({ ok: true, hasMore: false });
      }),
    );
    const user = userEvent.setup();
    renderNeedsYou();

    await user.click(await screen.findByRole('button', { name: 'Mark all read' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument());
    expect(screen.getByText('Fix the loader')).toBeVisible();
  });

  it('shows a mention that lands while the page is open', async () => {
    let items: (FactoryAutomationFailedAttentionItem | FactoryMentionAttentionItem)[] = [
      item('decision-1', 'Fix the loader', false),
    ];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) =>
        HttpResponse.json({
          items: itemsOfRequestedKinds(request, items),
          kinds: attentionKindSummaries(items),
          hasMore: false,
        }),
      ),
    );
    renderNeedsYou();

    await screen.findByText('Fix the loader');
    items = [mentionItem('comment-1', 'Fix login bug'), ...items];
    expect(await screen.findByText('mention', undefined, { timeout: PAST_ONE_POLL_MS })).toBeVisible();
  });

  it('skips attention kinds this client does not know and keeps rendering the rest', async () => {
    const known = [mentionItem('comment-1', 'Fix login bug')];
    const retiredKind = retiredKindItem();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, () =>
        HttpResponse.json({ items: [retiredKind, ...known], kinds: attentionKindSummaries(known), hasMore: false }),
      ),
    );
    renderNeedsYou();

    expect(await screen.findByText('Fix login bug')).toBeVisible();
    expect(screen.queryByText('Retired kind row')).not.toBeInTheDocument();
  });

  it('shows the empty state when every open item is of a kind this client does not know', async () => {
    const retiredKind = retiredKindItem();
    const retiredSummary = {
      open: 1,
      unread: 1,
      latest: { key: retiredKind.key, at: retiredKind.occurredAt, unread: true },
    };
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, () =>
        HttpResponse.json({
          items: [retiredKind],
          kinds: { ...attentionKindSummaries([]), 'retired-kind': retiredSummary },
          hasMore: false,
        }),
      ),
    );
    renderNeedsYou();

    expect(await screen.findByText('Nothing needs you right now.')).toBeVisible();
    expect(screen.queryByText('Retired kind row')).not.toBeInTheDocument();
  });

  it('asks the server only for the kinds this client renders', async () => {
    const requestedKinds: string[][] = [];
    const known = [mentionItem('comment-1', 'Fix login bug')];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, ({ request }) => {
        requestedKinds.push(new URL(request.url).searchParams.getAll('kind'));
        return HttpResponse.json({ items: known, kinds: attentionKindSummaries(known), hasMore: false });
      }),
    );
    renderNeedsYou();

    expect(await screen.findByText('Fix login bug')).toBeVisible();
    const knownKinds = Object.keys(attentionKindSummaries([]));
    expect(requestedKinds.length).toBeGreaterThan(0);
    for (const kinds of requestedKinds) {
      expect(kinds.length).toBeGreaterThan(0);
      for (const kind of kinds) expect(knownKinds).toContain(kind);
    }
  });
});
