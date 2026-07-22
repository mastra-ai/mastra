import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { FactoryThreadTaskContext } from '../../../../../../shared/api/types';
import { FactorySessionContextPanel, type FactorySessionContextTab } from '../FactorySessionContextPanel';

const PROJECT_ID = 'factory-project-1';
const THREAD_ID = 'factory-thread-1';
const RESOURCE_ID = 'resource-1';
const WORKSPACE = '/home/user/project';
const CONTEXT_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/threads/${THREAD_ID}/context`;
const LIST_URL = `${TEST_BASE_URL}/web/workspace/rendered/list`;
const FILE_URL = `${TEST_BASE_URL}/web/workspace/file`;

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(next => {
    resolve = next;
  });
  return { promise, resolve };
}

function liveContext(overrides: Partial<FactoryThreadTaskContext['task']> = {}): FactoryThreadTaskContext {
  return {
    task: {
      source: 'github-issue',
      identifier: '42',
      title: 'Fix session context',
      description: 'Render **basic task details**.',
      state: 'open',
      labels: ['bug', 'factory'],
      assignees: ['ada'],
      url: 'https://github.com/mastra-ai/mastra/issues/42',
      ...overrides,
    },
    resolution: { mode: 'live' },
  };
}

function installContext(context: FactoryThreadTaskContext | null) {
  server.use(http.get(CONTEXT_URL, () => HttpResponse.json({ context })));
}

function installWorkspace() {
  server.use(
    http.get(LIST_URL, () =>
      HttpResponse.json({
        workspacePath: WORKSPACE,
        root: '.artifacts',
        rootPath: `${WORKSPACE}/.artifacts`,
        entries: [
          {
            name: 'understand-pr',
            path: 'understand-pr',
            type: 'directory',
            size: 0,
            updatedAt: '2026-07-16T00:00:00.000Z',
          },
          {
            name: 'HISTORY.md',
            path: 'understand-pr/HISTORY.md',
            type: 'file',
            size: 7,
            updatedAt: '2026-07-16T00:00:00.000Z',
          },
        ],
      }),
    ),
    http.get(FILE_URL, ({ request }) => {
      const path = new URL(request.url).searchParams.get('path');
      return HttpResponse.json({
        workspacePath: WORKSPACE,
        path,
        name: 'HISTORY.md',
        size: 7,
        updatedAt: '2026-07-16T00:00:00.000Z',
        contentType: 'text',
        content: '# Session history',
      });
    }),
  );
}

function PanelHarness({ initialTab = 'task' }: { initialTab?: FactorySessionContextTab }) {
  const [tab, setTab] = useState<FactorySessionContextTab>(initialTab);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return <button onClick={() => setVisible(true)}>Open context</button>;
  }

  return (
    <FactorySessionContextPanel
      factoryProjectId={PROJECT_ID}
      threadId={THREAD_ID}
      resourceId={RESOURCE_ID}
      workspacePath={WORKSPACE}
      activeTab={tab}
      onTabChange={nextTab => {
        setExpanded(false);
        setTab(nextTab);
      }}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onCollapse={() => {
        setExpanded(false);
        setVisible(false);
      }}
    />
  );
}

describe('FactorySessionContextPanel', () => {
  it('given a linked GitHub issue, when Task loads, then it shows the approved basic fields', async () => {
    installContext(liveContext());
    renderWithProviders(<PanelHarness />);

    const task = await screen.findByRole('article', { name: 'Factory task context' });
    expect(within(task).getByText('GitHub issue')).toBeInTheDocument();
    expect(within(task).getByText('42')).toBeInTheDocument();
    expect(within(task).getByRole('heading', { name: 'Fix session context' })).toBeInTheDocument();
    expect(within(task).getByText('basic task details')).toBeInTheDocument();
    expect(within(task).getByText('open')).toBeInTheDocument();
    expect(within(task).getByText('bug')).toBeInTheDocument();
    expect(within(task).getByText('ada')).toBeInTheDocument();
    expect(within(task).getByRole('link', { name: 'Open source' })).toHaveAttribute(
      'href',
      'https://github.com/mastra-ai/mastra/issues/42',
    );
  });

  it('given a linked GitHub pull request, when Task loads, then it identifies the pull request', async () => {
    installContext(
      liveContext({
        source: 'github-pr',
        identifier: '77',
        title: 'Ship task context',
        state: 'merged',
        url: 'https://github.com/mastra-ai/mastra/pull/77',
      }),
    );
    renderWithProviders(<PanelHarness />);

    expect(await screen.findByText('GitHub pull request')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ship task context' })).toBeInTheDocument();
    expect(screen.getByText('merged')).toBeInTheDocument();
  });

  it('given a linked Linear issue, when Task loads, then it shows the Linear identity and fields', async () => {
    installContext(
      liveContext({
        source: 'linear-issue',
        identifier: 'ENG-42',
        title: 'Add a session panel',
        state: 'In Progress',
        labels: ['frontend'],
        assignees: ['Grace'],
        url: 'https://linear.app/mastra/issue/ENG-42',
      }),
    );
    renderWithProviders(<PanelHarness />);

    expect(await screen.findByText('Linear issue')).toBeInTheDocument();
    expect(screen.getByText('ENG-42')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add a session panel' })).toBeInTheDocument();
    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('Grace')).toBeInTheDocument();
  });

  it('given provider hydration failed, when Task loads, then it shows only the stored fallback and safe reason', async () => {
    installContext({
      task: {
        source: 'github-issue',
        title: 'Stored work item title',
        labels: [],
        assignees: [],
        url: 'https://github.com/mastra-ai/mastra/issues/42',
      },
      resolution: { mode: 'stored', reason: 'provider-unavailable' },
    });
    renderWithProviders(<PanelHarness />);

    expect(await screen.findByRole('heading', { name: 'Stored work item title' })).toBeInTheDocument();
    expect(screen.getByText(/provider could not be reached/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Task description' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Labels' })).not.toBeInTheDocument();
  });

  it('given duplicate thread linkage, when Task loads, then it shows the route error and can retry', async () => {
    const hit = vi.fn();
    server.use(
      http.get(CONTEXT_URL, () => {
        hit();
        return HttpResponse.json({ error: 'ambiguous_thread_context' }, { status: 409 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PanelHarness />);

    expect(await screen.findByText('ambiguous_thread_context')).toBeInTheDocument();
    const [retry] = screen.getAllByRole('button', { name: 'Try again' });
    if (!retry) throw new Error('Retry action was not rendered');
    await user.click(retry);
    await waitFor(() => expect(hit).toHaveBeenCalledTimes(2));
  });

  it('given no linked work item, when Task loads, then it shows the unlinked state', async () => {
    installContext(null);
    renderWithProviders(<PanelHarness />);

    expect(await screen.findByText('No Factory task is linked to this session.')).toBeInTheDocument();
  });

  it('given unsafe provider content, when Task renders, then raw HTML and unsafe links are inert', async () => {
    installContext(
      liveContext({
        description: '<script>window.evil = true</script>\n\n[unsafe](javascript:alert(1))',
        url: 'javascript:alert(1)',
      }),
    );
    renderWithProviders(<PanelHarness />);

    expect(await screen.findByText('unsafe')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('unsafe').closest('a')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open source' })).not.toBeInTheDocument();
  });

  it('given live data changes, when Refresh is pressed, then Task shows the replacement data', async () => {
    let requestCount = 0;
    server.use(
      http.get(CONTEXT_URL, () => {
        requestCount += 1;
        return HttpResponse.json({ context: liveContext({ title: `Task version ${requestCount}` }) });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PanelHarness />);
    expect(await screen.findByRole('heading', { name: 'Task version 1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Refresh task' }));

    expect(await screen.findByRole('heading', { name: 'Task version 2' })).toBeInTheDocument();
    expect(requestCount).toBe(2);
  });

  it('given Files is selected, when the panel mounts, then it makes zero task-context requests', async () => {
    const hit = vi.fn();
    server.use(
      http.get(CONTEXT_URL, () => {
        hit();
        return HttpResponse.json({ context: liveContext() });
      }),
      http.get(LIST_URL, () =>
        HttpResponse.json({
          workspacePath: WORKSPACE,
          root: '.artifacts',
          rootPath: `${WORKSPACE}/.artifacts`,
          entries: [],
        }),
      ),
    );
    renderWithProviders(<PanelHarness initialTab="files" />);

    expect(await screen.findByRole('tab', { name: 'Files' })).toHaveAttribute('aria-selected', 'true');
    expect(hit).not.toHaveBeenCalled();
  });

  it('given Task is loading, when Files is selected, then the task request is aborted', async () => {
    const started = deferred();
    const aborted = deferred();
    server.use(
      http.get(CONTEXT_URL, async ({ request }) => {
        request.signal.addEventListener('abort', () => aborted.resolve(), { once: true });
        started.resolve();
        await aborted.promise;
        return HttpResponse.json({ context: liveContext() });
      }),
    );
    installWorkspace();
    const user = userEvent.setup();
    renderWithProviders(<PanelHarness />);
    await started.promise;

    await user.click(screen.getByRole('tab', { name: 'Files' }));

    await expect(aborted.promise).resolves.toBeUndefined();
    expect(screen.getByRole('tab', { name: 'Files' })).toHaveAttribute('aria-selected', 'true');
  });

  it('given Task is loading, when the panel is closed, then the request is aborted and stays disabled', async () => {
    const started = deferred();
    const aborted = deferred();
    let requestCount = 0;
    server.use(
      http.get(CONTEXT_URL, async ({ request }) => {
        requestCount += 1;
        request.signal.addEventListener('abort', () => aborted.resolve(), { once: true });
        started.resolve();
        await aborted.promise;
        return HttpResponse.json({ context: liveContext() });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PanelHarness />);
    await started.promise;

    await user.click(screen.getByRole('button', { name: 'Close task and workspace context' }));

    await expect(aborted.promise).resolves.toBeUndefined();
    expect(screen.getByRole('button', { name: 'Open context' })).toBeInTheDocument();
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(requestCount).toBe(1);
  });

  it('given Task is active, when the tab list is used from the keyboard, then Files becomes active', async () => {
    installContext(liveContext());
    installWorkspace();
    const user = userEvent.setup();
    renderWithProviders(<PanelHarness />);
    await screen.findByRole('heading', { name: 'Fix session context' });

    const taskTab = screen.getByRole('tab', { name: 'Task' });
    taskTab.focus();
    await user.keyboard('{ArrowRight}{Enter}');

    expect(screen.getByRole('tab', { name: 'Files' })).toHaveAttribute('aria-selected', 'true');
  });

  it('given Files is selected, when an artifact opens, then expansion is reported and Files works after a Task round trip', async () => {
    installContext(liveContext());
    installWorkspace();
    const user = userEvent.setup();
    renderWithProviders(<PanelHarness initialTab="files" />);

    await user.click(await screen.findByRole('button', { name: 'Artifacts' }));
    await user.click(await screen.findByRole('button', { name: 'understand-pr' }));
    await user.click(await screen.findByText('HISTORY.md'));
    expect(await screen.findByLabelText('Workspace file viewer')).toBeInTheDocument();
    expect(screen.getByLabelText('Session task and workspace context')).toHaveAttribute('data-expanded', 'true');

    await user.click(screen.getByRole('tab', { name: 'Task' }));
    expect(await screen.findByRole('heading', { name: 'Fix session context' })).toBeInTheDocument();
    expect(screen.getByLabelText('Session task and workspace context')).toHaveAttribute('data-expanded', 'false');

    await user.click(screen.getByRole('tab', { name: 'Files' }));
    await user.click(await screen.findByRole('button', { name: 'Artifacts' }));
    expect(await screen.findByRole('button', { name: 'understand-pr' })).toBeInTheDocument();
  });
});
