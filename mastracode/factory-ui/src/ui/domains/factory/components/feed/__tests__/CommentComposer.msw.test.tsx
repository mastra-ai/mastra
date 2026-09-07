import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import type { WorkItemComment } from '../../../services/commentsWire';
import type { CommentQuoteDraft } from '../CommentQuote';
import { CommentComposer } from '../CommentComposer';

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const PROJECT_ID = 'project-1';
const ITEM_ID = 'item-1';
const COMMENTS_URL = `${TEST_BASE_URL}/web/factory/work-items/${ITEM_ID}/comments`;

function serverComment(body: string): WorkItemComment {
  return {
    id: 'comment-server',
    workItemId: ITEM_ID,
    kind: 'comment',
    bodyFormat: 'markdown',
    body,
    author: { kind: 'user', id: 'user-1', displayName: 'Ada' },
    mentions: [],
    occurredAt: '2026-08-26T10:00:00.000Z',
    revision: 1,
  };
}

function stubRoster() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/mention-roster`, () =>
      HttpResponse.json({
        members: [
          { id: 'user-ada', name: 'Ada' },
          { id: 'user-alan', name: 'Alan' },
        ],
      }),
    ),
  );
}

function stubCreate(posts: unknown[], status = 201) {
  server.use(
    http.post(COMMENTS_URL, async ({ request }) => {
      const body = await request.json();
      posts.push(body);
      if (status !== 201) return HttpResponse.json({ error: 'boom' }, { status });
      return HttpResponse.json({ comment: serverComment('posted') }, { status });
    }),
  );
}

function Harness({ initialQuote }: { initialQuote?: CommentQuoteDraft }) {
  const [quote, setQuote] = useState(initialQuote);
  return (
    <CommentComposer
      workItemId={ITEM_ID}
      factoryProjectId={PROJECT_ID}
      variant="thread"
      quote={quote}
      onDismissQuote={() => setQuote(undefined)}
    />
  );
}

describe('CommentComposer', () => {
  it('sends on Enter, and Shift+Enter inserts a newline instead', async () => {
    const posts: unknown[] = [];
    stubRoster();
    stubCreate(posts);
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    const input = screen.getByRole('textbox', { name: 'Comment' });
    await user.click(input);
    await user.keyboard('first line{Shift>}{Enter}{/Shift}second line');
    expect(posts).toEqual([]);

    await user.keyboard('{Enter}');
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ body: 'first line\nsecond line', mentions: [] });
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('mentions a member picked from the dropdown, and drops one whose name was deleted', async () => {
    const posts: unknown[] = [];
    stubRoster();
    stubCreate(posts);
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    const input = screen.getByRole('textbox', { name: 'Comment' });
    if (!(input instanceof HTMLTextAreaElement)) throw new Error('composer input is not a textarea');
    await user.click(input);
    await user.keyboard('ping @Al');
    await screen.findByRole('button', { name: 'Alan' });
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('ping @Alan ');
    // Role queries skip aria-hidden: the dropdown is closed once the pick lands.
    expect(screen.queryByRole('button', { name: 'Alan' })).not.toBeInTheDocument();
    expect(input.selectionStart).toBe('ping @Alan '.length);

    await user.keyboard('and @Ad');
    await screen.findByRole('button', { name: 'Ada' });
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('ping @Alan and @Ada ');
    expect(input.selectionStart).toBe('ping @Alan and @Ada '.length);

    // Deleting a name from the text must drop its mention from the POST.
    await user.clear(input);
    await user.keyboard('only @Alan stays');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      body: 'only @Alan stays',
      mentions: [{ kind: 'user', id: 'user-alan' }],
    });
  });

  it('closes only the dropdown on Escape', async () => {
    stubRoster();
    const outerKeyDown = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <div onKeyDown={outerKeyDown}>
        <Harness />
      </div>,
    );

    const input = screen.getByRole('textbox', { name: 'Comment' });
    await user.click(input);
    await user.keyboard('@A');
    await screen.findByRole('region', { name: 'Mentions options' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Mentions options' })).not.toBeInTheDocument());
    // The popover behind listens on bubbled keydown; the composer swallowed it.
    const escapes = outerKeyDown.mock.calls.filter(([event]) => event.key === 'Escape');
    expect(escapes).toEqual([]);
    expect(input).toHaveValue('@A');

    // Retyping the same query at the same spot asks again.
    await user.keyboard('{Backspace}A');
    expect(await screen.findByRole('region', { name: 'Mentions options' })).toBeInTheDocument();
  });

  it('mints a new client token when a failed send is edited before the retry', async () => {
    const posts: unknown[] = [];
    stubRoster();
    stubCreate(posts, 500);
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    const input = screen.getByRole('textbox', { name: 'Comment' });
    await user.click(input);
    await user.keyboard('first try');
    await user.keyboard('{Enter}');
    await screen.findByRole('alert');

    stubCreate(posts);
    await user.clear(input);
    await user.keyboard('changed my mind');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(posts).toHaveLength(2));

    // Reusing the token would recover the stored 'first try' and lose this text.
    const tokenOf = (post: unknown) =>
      typeof post === 'object' && post !== null && 'clientToken' in post ? post.clientToken : undefined;
    expect(tokenOf(posts[1])).not.toBe(tokenOf(posts[0]));
  });

  it('keeps the draft and quote when the server rejects', async () => {
    const posts: unknown[] = [];
    stubRoster();
    stubCreate(posts, 500);
    const user = userEvent.setup();
    renderWithProviders(
      <Harness initialQuote={{ commentId: 'comment-0', quote: 'earlier words', authorName: 'Ada' }} />,
    );

    const input = screen.getByRole('textbox', { name: 'Comment' });
    await user.click(input);
    await user.keyboard('my reply');
    await user.keyboard('{Enter}');

    await screen.findByRole('alert');
    expect(input).toHaveValue('my reply');
    expect(screen.getByText('earlier words')).toBeInTheDocument();
    expect(posts).toHaveLength(1);

    // Retry reuses the same client token, so the server can dedupe.
    stubCreate(posts);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(posts).toHaveLength(2));
    const tokenOf = (post: unknown) =>
      typeof post === 'object' && post !== null && 'clientToken' in post ? post.clientToken : undefined;
    expect(tokenOf(posts[1])).toBe(tokenOf(posts[0]));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.queryByText('earlier words')).not.toBeInTheDocument();
  });
});
