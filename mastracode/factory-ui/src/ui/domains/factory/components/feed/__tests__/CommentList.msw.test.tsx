import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import type { WorkItemComment } from '../../../services/commentsWire';
import type { WorkItem } from '../../../services/workItems';
import { CommentList } from '../CommentList';

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const ITEM_ID = 'item-1';
const COMMENTS_URL = `${TEST_BASE_URL}/web/factory/work-items/${ITEM_ID}/comments`;

const item: WorkItem = {
  id: ITEM_ID,
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: 'project-1',
  source: 'manual',
  sourceKey: null,
  parentWorkItemId: null,
  title: 'The card',
  url: null,
  stages: ['triage'],
  stageHistory: [],
  sessions: {},
  metadata: {},
  triageType: null,
  acceptedAt: null,
  commentCount: 2,
  feedActivityAt: null,
  revision: 1,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
};

function comment(id: string, body: string, overrides: Partial<WorkItemComment> = {}): WorkItemComment {
  return {
    id,
    workItemId: ITEM_ID,
    kind: 'comment',
    bodyFormat: 'markdown',
    body,
    author: { kind: 'user', id: 'user-1', displayName: 'Ada' },
    mentions: [],
    occurredAt: '2026-08-26T10:00:00.000Z',
    revision: 1,
    ...overrides,
  };
}

function renderList(props: Partial<Parameters<typeof CommentList>[0]> = {}) {
  const onQuote = vi.fn();
  const utils = renderWithProviders(
    <CommentList
      item={item}
      factoryProjectId={undefined}
      currentUser={{ userId: 'user-1', name: 'Ada' }}
      onQuote={onQuote}
      {...props}
    />,
  );
  return { onQuote, ...utils };
}

describe('CommentList', () => {
  it('renders oldest to newest inside a live log', async () => {
    server.use(
      http.get(COMMENTS_URL, () =>
        HttpResponse.json({
          comments: [
            comment('c2', 'second words', { occurredAt: '2026-08-26T11:00:00.000Z' }),
            comment('c1', 'first words'),
          ],
        }),
      ),
    );
    renderList();

    const log = await screen.findByRole('log', { name: 'Activity' });
    const first = await within(log).findByText('first words');
    const second = within(log).getByText('second words');
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(log).toHaveAttribute('aria-live', 'polite');
  });

  it('collapses a quick follow-up by the same author into a continuation row', async () => {
    server.use(
      http.get(COMMENTS_URL, () =>
        HttpResponse.json({
          comments: [comment('c2', 'follow-up', { occurredAt: '2026-08-26T10:02:00.000Z' }), comment('c1', 'opener')],
        }),
      ),
    );
    renderList();

    await screen.findByText('follow-up');
    // One author header for the pair: the second row rides under the first.
    expect(screen.getAllByText('Ada')).toHaveLength(1);
  });

  it('renders a tombstone for a deleted comment and its quote for a reply', async () => {
    server.use(
      http.get(COMMENTS_URL, () =>
        HttpResponse.json({
          comments: [
            comment('c2', 'the reply', {
              occurredAt: '2026-08-26T11:00:00.000Z',
              author: { kind: 'user', id: 'user-2', displayName: 'Alan' },
              replyTo: { commentId: 'c1', quote: 'quoted words', authorName: 'Ada' },
            }),
            comment('c1', '', { deletedAt: '2026-08-26T10:30:00.000Z' }),
          ],
        }),
      ),
    );
    renderList();

    expect(await screen.findByText('Comment deleted')).toBeInTheDocument();
    expect(screen.getByText('quoted words')).toBeInTheDocument();
    expect(screen.getByText('the reply')).toBeInTheDocument();
  });

  it('quotes the whole body clamped to 500 chars when nothing is selected', async () => {
    const longBody = 'x'.repeat(600);
    server.use(http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [comment('c1', longBody)] })));
    const user = userEvent.setup();
    const { onQuote } = renderList();

    await user.click(await screen.findByRole('button', { name: 'Quote reply' }));
    expect(onQuote).toHaveBeenCalledWith({
      commentId: 'c1',
      quote: 'x'.repeat(500),
      authorName: 'Ada',
    });
  });

  it('quotes the selected text instead of the body when the selection sits in the row', async () => {
    server.use(http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [comment('c1', 'pick just these words')] })));
    const user = userEvent.setup();
    const { onQuote } = renderList();

    const body = await screen.findByText('pick just these words');
    const textNode = body.firstChild;
    if (!textNode) throw new Error('body text node missing');
    const range = document.createRange();
    range.setStart(textNode, 5);
    range.setEnd(textNode, 9);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    await user.click(screen.getByRole('button', { name: 'Quote reply' }));
    expect(onQuote).toHaveBeenCalledWith({ commentId: 'c1', quote: 'just', authorName: 'Ada' });
  });

  it('edits a row inline and drops the mentions the new body no longer names', async () => {
    const patches: unknown[] = [];
    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [comment('c1', 'original')] })),
      http.patch(`${COMMENTS_URL}/c1`, async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json({ comment: comment('c1', 'better', { editedAt: '2026-08-26T11:00:00.000Z' }) });
      }),
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole('button', { name: 'Edit comment' }));
    const editor = screen.getByRole('textbox', { name: 'Edit comment' });
    await user.clear(editor);
    await user.type(editor, 'better');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ body: 'better', expectedRevision: 1, mentions: [] });
  });

  it('saves an edit on Enter and keeps Shift+Enter for a new line', async () => {
    const patches: unknown[] = [];
    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [comment('c1', 'original')] })),
      http.patch(`${COMMENTS_URL}/c1`, async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json({ comment: comment('c1', 'first\nsecond') });
      }),
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole('button', { name: 'Edit comment' }));
    const editor = screen.getByRole('textbox', { name: 'Edit comment' });
    await user.clear(editor);
    await user.type(editor, 'first{Shift>}{Enter}{/Shift}second');
    expect(editor).toHaveValue('first\nsecond');
    expect(patches).toHaveLength(0);

    await user.type(editor, '{Enter}');

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ body: 'first\nsecond' });
  });

  it('refuses an emptied edit instead of closing on it', async () => {
    const patches: unknown[] = [];
    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [comment('c1', 'original')] })),
      http.patch(`${COMMENTS_URL}/c1`, async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json({ comment: comment('c1', 'unused') });
      }),
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole('button', { name: 'Edit comment' }));
    await user.clear(screen.getByRole('textbox', { name: 'Edit comment' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Comment body must not be empty.');
    expect(screen.getByRole('textbox', { name: 'Edit comment' })).toBeInTheDocument();
    expect(patches).toEqual([]);
  });

  it('keeps the editor and its draft when the save fails', async () => {
    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [comment('c1', 'original')] })),
      http.patch(`${COMMENTS_URL}/c1`, () => HttpResponse.json({ error: 'stale_revision' }, { status: 409 })),
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole('button', { name: 'Edit comment' }));
    const editor = screen.getByRole('textbox', { name: 'Edit comment' });
    await user.clear(editor);
    await user.type(editor, 'better');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: 'Edit comment' })).toHaveValue('better');
  });

  it('sends one edit at a time however often Save is pressed', async () => {
    let patches = 0;
    let release = () => {};
    const pending = new Promise<void>(resolve => {
      release = resolve;
    });
    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [comment('c1', 'original')] })),
      http.patch(`${COMMENTS_URL}/c1`, async () => {
        patches += 1;
        await pending;
        return HttpResponse.json({ comment: comment('c1', 'better') });
      }),
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole('button', { name: 'Edit comment' }));
    const editor = screen.getByRole('textbox', { name: 'Edit comment' });
    await user.clear(editor);
    await user.type(editor, 'better');
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled());
    await user.click(screen.getByRole('button', { name: 'Saving…' }));

    release();
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Edit comment' })).toBeNull());
    expect(patches).toBe(1);
  });

  it('recovers from a load error through Try again', async () => {
    let failing = true;
    server.use(
      http.get(COMMENTS_URL, () => {
        if (failing) return HttpResponse.json({ error: 'boom' }, { status: 500 });
        return HttpResponse.json({ comments: [comment('c1', 'finally here')] });
      }),
    );
    const user = userEvent.setup();
    renderList();

    await screen.findByText('Unable to load comments.');
    failing = false;
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('finally here')).toBeInTheDocument();
  });

  it('fetches nothing while disabled', async () => {
    let requests = 0;
    server.use(
      http.get(COMMENTS_URL, () => {
        requests += 1;
        return HttpResponse.json({ comments: [] });
      }),
    );
    const { client } = renderList({ enabled: false });

    await waitForMutationsIdle(client);
    expect(requests).toBe(0);
  });
});
