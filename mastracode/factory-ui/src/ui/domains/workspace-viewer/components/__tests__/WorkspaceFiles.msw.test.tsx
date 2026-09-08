import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { WorkspaceFilesProvider } from '../../context/WorkspaceFilesProvider';
import { useWorkspacePanel } from '../../context/useWorkspacePanel';
import { WorkspaceFilesSurface } from '../WorkspaceFilesSurface';
import { WorkspaceFilesToggle } from '../WorkspaceFilesToggle';

const LIST_URL = `${TEST_BASE_URL}/web/workspace/files`;
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

function renderPanel() {
  const listRequests: Array<{ workspacePath: string | null; threadId: string | null }> = [];
  server.use(
    http.get(LIST_URL, ({ request }) => {
      const url = new URL(request.url);
      listRequests.push({
        workspacePath: url.searchParams.get('workspacePath'),
        threadId: url.searchParams.get('threadId'),
      });
      return HttpResponse.json({
        workspacePath: WORKSPACE,
        threadId: 'thread-1',
        files: [],
      });
    }),
    http.get(CHANGES_URL, () =>
      HttpResponse.json({ workspacePath: WORKSPACE, available: true, additions: 0, deletions: 0, changes: [] }),
    ),
  );

  const { client } = renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/factory-1/workspaces/${WORKSPACE}/threads/thread-1`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
          element={
            <WorkspaceFilesProvider>
              <WorkspaceFilesToggle />
              <WorkspaceFilesSurface />
              <ExpansionProbe />
            </WorkspaceFilesProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

  return { client, listRequests };
}

describe('WorkspaceFiles', () => {
  describe('given a chat wide enough for the card beside the transcript', () => {
    it('leaves the card closed and off the network until the header toggle asks for it', async () => {
      stubContainerWidth(1200);
      const user = userEvent.setup();
      const { client, listRequests } = renderPanel();

      const card = await screen.findByTestId('workspace-files-card');
      const toggle = screen.getByRole('button', { name: 'Workspace files' });
      expect(card).toHaveAttribute('inert');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(listRequests).toEqual([]);

      await user.click(toggle);

      expect(card).not.toHaveAttribute('inert');
      expect(await screen.findByRole('button', { name: /^Files No files/ })).toBeInTheDocument();
      await waitForMutationsIdle(client);
      expect(listRequests).toEqual([{ workspacePath: WORKSPACE, threadId: 'thread-1' }]);
    });
  });

  describe('when the chat crosses the dock threshold', () => {
    it('resets the popover to the compact overview', async () => {
      stubContainerWidth(1200);
      const user = userEvent.setup();
      const { client } = renderPanel();

      await user.click(screen.getByRole('button', { name: 'Workspace files' }));
      await waitForMutationsIdle(client);
      await user.click(await screen.findByRole('button', { name: /^Changes/ }));
      await waitForMutationsIdle(client);
      expect(screen.getByTestId('workspace-panel-size')).toHaveTextContent('full');

      const observer = PanelResizeObserver.instances.find(instance => instance.observed.size > 0);
      const container = observer ? Array.from(observer.observed).at(0) : undefined;
      if (!observer || !container) throw new Error('Workspace panel container was not observed');

      act(() => observer.resize(container, 900));

      expect(screen.getByTestId('workspace-panel-size')).toHaveTextContent('compact');
      expect(screen.getByRole('button', { name: 'Workspace files' })).toHaveAttribute('aria-pressed', 'false');

      await user.click(screen.getByRole('button', { name: 'Workspace files' }));

      expect(await screen.findByRole('button', { name: /^Changes No changes/ })).toBeInTheDocument();
      expect(screen.getByTestId('workspace-panel-size')).toHaveTextContent('compact');
    });
  });

  describe('given a chat too narrow to hold both', () => {
    it('overlays the files in a popover instead of taking the transcript width', async () => {
      stubContainerWidth(900);
      const user = userEvent.setup();
      renderPanel();

      expect(screen.queryByTestId('workspace-files-card')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Files/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Workspace files' }));

      expect(await screen.findByRole('button', { name: /^Files No files/ })).toBeInTheDocument();
    });
  });
});
