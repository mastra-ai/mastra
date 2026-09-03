import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { WorkItemComment } from '../../../factory/services/commentsWire';
import type { WorkItem } from '../../../factory/services/workItems';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const WORKSPACE = 'session-1';
const THREAD = 'thread-1';
const FACTORY_ID = 'fp-1';
const ITEM_ID = 'item-1';
const COMMENTS_URL = `${TEST_BASE_URL}/web/factory/work-items/${ITEM_ID}/comments`;

function workItem(commentCount: number): WorkItem {
  return {
    id: ITEM_ID,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: FACTORY_ID,
    source: 'manual',
    sourceKey: null,
    parentWorkItemId: null,
    title: 'Fix login bug',
    url: null,
    stages: ['execute'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount,
    feedActivityAt: null,
    revision: 1,
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  };
}

function wireComment(id: string, body: string): WorkItemComment {
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
  };
}

function installWorkspaceHandlers() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/workspace/files`, () =>
      HttpResponse.json({ workspacePath: WORKSPACE, threadId: THREAD, files: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/workspace/changes`, () =>
      HttpResponse.json({ workspacePath: WORKSPACE, available: true, additions: 0, deletions: 0, changes: [] }),
    ),
  );
}

describe('workspace panel comment feed', () => {
  it('opens the feed at half height from the overview row, and comes back', async () => {
    installWorkspaceHandlers();
    server.use(
      http.get(COMMENTS_URL, () =>
        HttpResponse.json({
          comments: [wireComment('c2', 'second words'), wireComment('c1', 'first words')],
        }),
      ),
    );
    const onSizeChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceViewerPanel
        workspacePath={WORKSPACE}
        threadId={THREAD}
        workItem={workItem(2)}
        factoryProjectId={FACTORY_ID}
        onSizeChange={onSizeChange}
      />,
    );

    const row = await screen.findByRole('button', { name: /Comments/ });
    expect(row).toHaveTextContent('2');
    await user.click(row);
    expect(onSizeChange).toHaveBeenLastCalledWith('half');

    const feed = await screen.findByTestId('work-item-feed-panel');
    expect(within(feed).getByRole('textbox', { name: 'Comment' })).toHaveFocus();
    expect(await within(feed).findByText('first words')).toBeInTheDocument();
    expect(within(feed).getByText('second words')).toBeInTheDocument();
    expect(within(feed).getByText('2 comments')).toBeInTheDocument();

    await user.click(within(feed).getByRole('button', { name: 'Back to workspace' }));
    expect(onSizeChange).toHaveBeenLastCalledWith('compact');
    expect(await screen.findByRole('button', { name: /Comments/ })).toBeInTheDocument();
  });

  it('labels an empty feed row "None yet"', async () => {
    installWorkspaceHandlers();
    renderWithProviders(
      <WorkspaceViewerPanel
        workspacePath={WORKSPACE}
        threadId={THREAD}
        workItem={workItem(0)}
        factoryProjectId={FACTORY_ID}
      />,
    );

    expect(await screen.findByRole('button', { name: /Comments None yet/ })).toBeInTheDocument();
  });

  it('offers no comments row when the thread has no work item', async () => {
    installWorkspaceHandlers();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);

    await screen.findByRole('button', { name: /Files/ });
    expect(screen.queryByRole('button', { name: /Comments/ })).not.toBeInTheDocument();
  });

  it('fetches no comments while the panel is hidden', async () => {
    installWorkspaceHandlers();
    let commentRequests = 0;
    server.use(
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [] });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <WorkspaceViewerPanel
        workspacePath={WORKSPACE}
        threadId={THREAD}
        workItem={workItem(1)}
        factoryProjectId={FACTORY_ID}
        visible={false}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /Comments/ }));
    await screen.findByTestId('work-item-feed-panel');
    await waitForMutationsIdle(client);
    expect(commentRequests).toBe(0);
  });
});
