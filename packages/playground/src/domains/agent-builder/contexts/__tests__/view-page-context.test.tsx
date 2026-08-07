import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ViewPageProvider, useViewPage } from '../view-page-context';
import { buildBuilderSettings } from './fixtures/builder';
import { server } from '@/test/msw-server';

type StoredAgentMock = {
  id: string;
  name: string;
  instructions: string;
  visibility: 'public' | 'private';
  authorId?: string;
  browser?: unknown;
};

const BASE_URL = 'http://localhost:4111';
const navigateMock = vi.fn();

// `useNavigate` is an allowed thin seam: we assert the redirect *target*, not
// real navigation. The agent chat panel is a heavy child with its own tests.
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/domains/agent-builder/components/agent-edit/agent-chat-panel', () => ({
  AgentChatPanelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const baseAgent: StoredAgentMock = {
  id: 'agent-1',
  name: 'My Agent',
  instructions: '',
  visibility: 'public',
  authorId: 'owner-1',
};

const Probe = () => {
  const ctx = useViewPage();
  return (
    <div>
      <div data-testid="agent-id">{ctx.agentId}</div>
      <div data-testid="is-owner">{String(ctx.isOwner)}</div>
      <div data-testid="can-modify">{String(ctx.canModify)}</div>
      <div data-testid="is-publishable">{String(ctx.isPublishable)}</div>
      <div data-testid="has-browser">{String(ctx.hasBrowser)}</div>
      <div data-testid="thread-id">{ctx.threadId}</div>
      <div data-testid="has-mode-toggle">{String(typeof ctx.onModeToggle === 'function')}</div>
      <button type="button" data-testid="toggle-btn" onClick={() => ctx.onModeToggle?.()} disabled={!ctx.onModeToggle}>
        toggle
      </button>
    </div>
  );
};

interface RenderOpts {
  storedAgent?: Partial<StoredAgentMock>;
  /** Pass `null` to simulate "no current user". Omit to default to the owner. */
  currentUserId?: string | null;
  canWrite?: boolean;
}

const renderProbe = ({ storedAgent, currentUserId = 'owner-1', canWrite = true }: RenderOpts = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Providers = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
  return render(
    <Providers>
      <ViewPageProvider
        agentId="agent-1"
        storedAgent={{ ...baseAgent, ...(storedAgent ?? {}) } as never}
        currentUserId={currentUserId ?? undefined}
        canWrite={canWrite}
      >
        <Probe />
      </ViewPageProvider>
    </Providers>,
  );
};

describe('ViewPageProvider', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    server.use(http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(buildBuilderSettings())));
  });

  afterEach(() => {
    cleanup();
  });

  describe('when computing publishability from saved visibility', () => {
    it('marks public agents as publishable', () => {
      const { getByTestId } = renderProbe({ storedAgent: { visibility: 'public' } });
      expect(getByTestId('is-publishable').textContent).toBe('true');
    });

    it('marks private agents as not publishable', () => {
      const { getByTestId } = renderProbe({ storedAgent: { visibility: 'private' } });
      expect(getByTestId('is-publishable').textContent).toBe('false');
    });
  });

  describe('when computing canModify from canWrite and ownership', () => {
    it('denies canModify when the owner lacks write access', () => {
      const { getByTestId } = renderProbe({ canWrite: false });
      expect(getByTestId('is-owner').textContent).toBe('true');
      expect(getByTestId('can-modify').textContent).toBe('false');
    });

    it('denies canModify when the writer is not the owner', () => {
      const { getByTestId } = renderProbe({ storedAgent: { authorId: 'someone-else' } });
      expect(getByTestId('is-owner').textContent).toBe('false');
      expect(getByTestId('can-modify').textContent).toBe('false');
    });
  });

  describe('when the viewer is the owner', () => {
    it('exposes a mode-toggle that navigates to the edit page', () => {
      const { getByTestId } = renderProbe();
      expect(getByTestId('has-mode-toggle').textContent).toBe('true');
      fireEvent.click(getByTestId('toggle-btn'));
      expect(navigateMock).toHaveBeenLastCalledWith('/agent-builder/agents/agent-1/edit', { viewTransition: true });
    });
  });

  describe('when the viewer is not the owner', () => {
    it('returns no mode-toggle', () => {
      const { getByTestId } = renderProbe({ storedAgent: { authorId: 'someone-else' } });
      expect(getByTestId('has-mode-toggle').textContent).toBe('false');
    });
  });

  describe('when the browser feature is disabled', () => {
    it('keeps hasBrowser false even if the agent has a browser config', async () => {
      const { getByTestId } = renderProbe({ storedAgent: { browser: { sessionId: 'sess-1' } } });
      // Settings resolve with browser off; hasBrowser must remain false.
      await waitFor(() => expect(getByTestId('agent-id').textContent).toBe('agent-1'));
      expect(getByTestId('has-browser').textContent).toBe('false');
    });
  });

  describe('when the browser feature is enabled', () => {
    it('sets hasBrowser true only when the agent also has a browser config', async () => {
      server.use(
        http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
          HttpResponse.json(buildBuilderSettings({ browser: true })),
        ),
      );
      const { getByTestId } = renderProbe({ storedAgent: { browser: { sessionId: 'sess-1' } } });
      await waitFor(() => expect(getByTestId('has-browser').textContent).toBe('true'));
    });
  });

  describe('when deriving the thread id', () => {
    it('falls back to the agent id when there is no current user', () => {
      const { getByTestId } = renderProbe({ currentUserId: null });
      expect(getByTestId('thread-id').textContent).toBe('agent-1');
    });

    it('combines the current user id and agent id when both are present', () => {
      const { getByTestId } = renderProbe({ currentUserId: 'user-7' });
      expect(getByTestId('thread-id').textContent).toBe('user-7-agent-1');
    });
  });
});
