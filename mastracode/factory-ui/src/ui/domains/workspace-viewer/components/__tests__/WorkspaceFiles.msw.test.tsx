import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { WorkspaceChangePatches } from '../../../../../api/types';
import { queryKeys } from '../../../../../api/keys';
import { ChatTranscriptContext } from '../../../chat/context/ChatTranscriptContext';
import type { ChatTranscriptApi } from '../../../chat/context/ChatTranscriptContext';
import { initialTranscript } from '../../../chat/services/transcript';
import type { FactoryUserSession } from '../../../workspaces/services/user-sessions';
import { WorkspaceFilesProvider } from '../../context/WorkspaceFilesProvider';
import { useWorkspacePanel } from '../../context/useWorkspacePanel';
import { WorkspaceFilesSurface } from '../WorkspaceFilesSurface';
import { WorkspaceFilesToggle } from '../WorkspaceFilesToggle';

const CHANGES_URL = `${TEST_BASE_URL}/web/workspace/changes`;
const WORKSPACE = 'session-1';

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
const originalResizeObserver = globalThis.ResizeObserver;

class PanelResizeObserver implements ResizeObserver {
  static instances: PanelResizeObserver[] = [];
  readonly observed = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    PanelResizeObserver.instances.push(this);
  }

  observe = (element: Element) => {
    this.observed.add(element);
  };
  unobserve = (element: Element) => {
    this.observed.delete(element);
  };
  disconnect = () => {
    this.observed.clear();
  };
  takeRecords = (): ResizeObserverEntry[] => [];

  resize(target: Element, width: number) {
    const size = { blockSize: 800, inlineSize: width };
    const entry = {
      target,
      contentRect: new DOMRect(0, 0, width, 800),
      borderBoxSize: [size],
      contentBoxSize: [size],
      devicePixelContentBoxSize: [size],
    } satisfies ResizeObserverEntry;
    this.callback([entry], this);
  }
}

function ExpansionProbe() {
  const { size } = useWorkspacePanel();
  return <output data-testid="workspace-panel-size">{size}</output>;
}

beforeEach(() => {
  PanelResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', PanelResizeObserver);
});

/** jsdom reports every box as 0×0, so the dock threshold needs a width to measure against. */
function stubContainerWidth(width: number) {
  HTMLElement.prototype.getBoundingClientRect = () => ({
    width,
    height: 800,
    top: 0,
    left: 0,
    right: width,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  vi.stubGlobal('ResizeObserver', originalResizeObserver);
});

function transcriptApi(busy: boolean): ChatTranscriptApi {
  return {
    transcript: initialTranscript,
    busy,
    phase: busy ? 'working' : 'awaiting',
    initializing: false,
    historyInitializing: false,
    initialHistoryReady: true,
    localUser: vi.fn(),
    failLocalUser: vi.fn(),
    reset: vi.fn(),
    resolvePrompt: vi.fn(),
    clearPending: vi.fn(),
    pushNotice: vi.fn(),
    loadMore: { hasMore: false, isLoading: false },
  };
}

function renderPanel({ busy = false }: { busy?: boolean } = {}) {
  const changesRequests: Array<string | null> = [];
  const session: FactoryUserSession = {
    id: 'row-1',
    sessionId: WORKSPACE,
    projectRepositoryId: 'link-1',
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    branch: 'factory/issue-1',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
  };
  server.use(
    http.get(`${TEST_BASE_URL}/web/user-sessions/${WORKSPACE}`, () => HttpResponse.json({ session })),
    http.get(CHANGES_URL, ({ request }) => {
      changesRequests.push(new URL(request.url).searchParams.get('workspacePath'));
      return HttpResponse.json({ workspacePath: WORKSPACE, available: true, additions: 0, deletions: 0, changes: [] });
    }),
    http.get(`${CHANGES_URL}/patches`, () =>
      HttpResponse.json<WorkspaceChangePatches>({
        workspacePath: WORKSPACE,
        available: true,
        scope: 'branch',
        changes: [],
        patches: {},
        omittedPatches: {},
      }),
    ),
  );

  const { client } = renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/factory-1/workspaces/${WORKSPACE}/threads/thread-1`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
          element={
            <ChatTranscriptContext.Provider value={transcriptApi(busy)}>
              <WorkspaceFilesProvider>
                <WorkspaceFilesToggle />
                <WorkspaceFilesSurface />
                <ExpansionProbe />
              </WorkspaceFilesProvider>
            </ChatTranscriptContext.Provider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

  return { client, changesRequests };
}

describe('WorkspaceFiles on a user session route', () => {
  it('offers Recreate sandbox when the session at user/threads/:threadId allows it', async () => {
    stubContainerWidth(1200);
    const sessionId = 'user-session-1';
    server.use(
      http.get(`${TEST_BASE_URL}/web/user-sessions/${sessionId}`, () =>
        HttpResponse.json({
          session: {
            id: 'row-1',
            sessionId,
            projectRepositoryId: 'link-1',
            orgId: 'org-1',
            userId: 'user-1',
            visibility: 'org',
            branch: `user/session-${sessionId}`,
            baseBranch: 'main',
            sandboxId: 'vm-1',
            sandboxWorkdir: '/home/user/repo',
            materializedAt: null,
            createdAt: '2026-10-15T00:00:00.000Z',
            updatedAt: '2026-10-15T00:00:00.000Z',
            capabilities: { recreateSandbox: true, takeOwnership: false },
          },
        }),
      ),
      http.get(CHANGES_URL, () =>
        HttpResponse.json({ workspacePath: sessionId, available: true, additions: 0, deletions: 0, changes: [] }),
      ),
    );
    renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/factory-1/user/threads/${sessionId}`]}>
        <Routes>
          <Route
            path="/factories/:factoryId/user/threads/:threadId"
            element={
              <WorkspaceFilesProvider>
                <WorkspaceFilesToggle />
                <WorkspaceFilesSurface />
              </WorkspaceFilesProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /Recreate sandbox/ })).toBeInTheDocument();
  });
});

describe('WorkspaceFiles', () => {
  describe('given a chat wide enough for the card beside the transcript', () => {
    it('keeps the loaded workspace usable when refreshing session details fails', async () => {
      stubContainerWidth(1200);
      const { client } = renderPanel({ busy: true });
      expect(await screen.findByRole('button', { name: /^Changes\s?No changes/ })).toBeInTheDocument();
      await waitForMutationsIdle(client);

      server.use(
        http.get(`${TEST_BASE_URL}/web/user-sessions/${WORKSPACE}`, () =>
          HttpResponse.json({ error: 'Temporarily unavailable' }, { status: 500 }),
        ),
      );
      await act(() => client.invalidateQueries({ queryKey: queryKeys.userSession(WORKSPACE) }));
      await waitForMutationsIdle(client);

      expect(screen.getByRole('button', { name: 'Files' })).toBeEnabled();
      expect(screen.getByRole('button', { name: /^Changes\s?No changes/ })).toBeEnabled();
    });

    it('opens the overview immediately and lets the header toggle close it', async () => {
      stubContainerWidth(1200);
      const user = userEvent.setup();
      renderPanel();

      const card = await screen.findByTestId('workspace-files-card');
      const toggle = screen.getByRole('button', { name: 'Session panel' });
      expect(card).not.toHaveAttribute('inert');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await waitFor(() => expect(screen.getByRole('button', { name: /^Changes/ })).toBeEnabled());

      await user.click(toggle);
      expect(card).toHaveAttribute('inert');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('leaves an idle sandbox asleep until the viewer opens the panel', async () => {
      stubContainerWidth(1200);
      const user = userEvent.setup();
      const { client, changesRequests } = renderPanel();

      await waitFor(() => expect(screen.getByRole('button', { name: /^Changes/ })).toBeEnabled());
      await waitForMutationsIdle(client);
      expect(changesRequests).toEqual([]);

      const toggle = screen.getByRole('button', { name: 'Session panel' });
      await user.click(toggle);
      await user.click(toggle);

      expect(await screen.findByRole('button', { name: /^Changes\s?No changes/ })).toBeInTheDocument();
      expect(changesRequests).toEqual([WORKSPACE]);
    });

    it('reads changes on open while a run has the sandbox awake', async () => {
      stubContainerWidth(1200);
      const { changesRequests } = renderPanel({ busy: true });

      expect(await screen.findByRole('button', { name: /^Changes\s?No changes/ })).toBeInTheDocument();
      expect(changesRequests).toEqual([WORKSPACE]);
    });

    it('shows the branch change counts on the overview once the viewer has been to Changes', async () => {
      stubContainerWidth(1200);
      const user = userEvent.setup();
      const { client } = renderPanel();
      server.use(
        http.get(CHANGES_URL, () =>
          HttpResponse.json({
            workspacePath: WORKSPACE,
            available: true,
            additions: 3,
            deletions: 2,
            changes: [{ path: 'src/ui/AppSidebar.tsx', status: 'modified', additions: 3, deletions: 2 }],
          }),
        ),
      );

      await waitForMutationsIdle(client);
      await user.click(await screen.findByRole('button', { name: /^Changes/ }));
      await user.click(await screen.findByRole('button', { name: 'Back to workspace' }));

      const changesRow = await screen.findByRole('button', { name: /^Changes/ });
      await waitFor(() => expect(changesRow).toHaveTextContent(/\+3\s*−2/));
    });
  });

  describe('when the chat crosses the dock threshold', () => {
    it('resets the popover to the compact overview', async () => {
      stubContainerWidth(1200);
      const user = userEvent.setup();
      const { client } = renderPanel();

      await waitForMutationsIdle(client);
      await user.click(await screen.findByRole('button', { name: /^Changes/ }));
      await waitForMutationsIdle(client);
      expect(screen.getByTestId('workspace-panel-size')).toHaveTextContent('full');

      const observer = PanelResizeObserver.instances.find(instance => instance.observed.size > 0);
      const container = observer ? Array.from(observer.observed).at(0) : undefined;
      if (!observer || !container) throw new Error('Workspace panel container was not observed');

      act(() => observer.resize(container, 900));

      expect(screen.getByTestId('workspace-panel-size')).toHaveTextContent('compact');
      expect(screen.getByRole('button', { name: 'Session panel' })).toHaveAttribute('aria-pressed', 'false');

      await user.click(screen.getByRole('button', { name: 'Session panel' }));

      expect(await screen.findByRole('button', { name: /^Changes\s?No changes/ })).toBeInTheDocument();
      expect(screen.getByTestId('workspace-panel-size')).toHaveTextContent('compact');
    });
  });

  describe('given a chat too narrow to hold both', () => {
    it('overlays the files in a popover instead of taking the transcript width', async () => {
      stubContainerWidth(900);
      const user = userEvent.setup();
      const { changesRequests } = renderPanel();

      expect(screen.queryByTestId('workspace-files-card')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Files/ })).not.toBeInTheDocument();
      expect(changesRequests).toEqual([]);

      await user.click(screen.getByRole('button', { name: 'Session panel' }));

      expect(await screen.findByRole('button', { name: /^Changes\s?No changes/ })).toBeInTheDocument();
    });
  });
});
