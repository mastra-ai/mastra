// @vitest-environment jsdom
import { cleanup, render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type StoredAgentMock = {
  id: string;
  name: string;
  instructions: string;
  visibility: 'public' | 'private';
  authorId?: string;
  browser?: unknown;
};

const navigateMock = vi.fn();
let browserFeatureEnabled = false;

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/domains/agent-builder/hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => ({
    tools: false,
    memory: false,
    workflows: false,
    agents: false,
    skills: false,
    browser: browserFeatureEnabled,
  }),
}));

vi.mock('@/domains/agent-builder/components/agent-edit/agent-chat-panel', () => ({
  AgentChatPanelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ViewPageProvider, useViewPage } from '../view-page-context';

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

const renderProbe = ({ storedAgent, currentUserId = 'owner-1', canWrite = true }: RenderOpts = {}) =>
  render(
    <MemoryRouter>
      <ViewPageProvider
        agentId="agent-1"
        storedAgent={{ ...baseAgent, ...(storedAgent ?? {}) } as never}
        currentUserId={currentUserId ?? undefined}
        canWrite={canWrite}
      >
        <Probe />
      </ViewPageProvider>
    </MemoryRouter>,
  );

describe('ViewPageProvider', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    browserFeatureEnabled = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('marks the page as publishable only when the saved visibility is public', () => {
    const first = renderProbe({ storedAgent: { visibility: 'public' } });
    expect(first.getByTestId('is-publishable').textContent).toBe('true');
    cleanup();

    const second = renderProbe({ storedAgent: { visibility: 'private' } });
    expect(second.getByTestId('is-publishable').textContent).toBe('false');
  });

  it('grants canModify only when canWrite AND isOwner are both true', () => {
    const first = renderProbe({ canWrite: false });
    expect(first.getByTestId('is-owner').textContent).toBe('true');
    expect(first.getByTestId('can-modify').textContent).toBe('false');
    cleanup();

    const second = renderProbe({ storedAgent: { authorId: 'someone-else' } });
    expect(second.getByTestId('is-owner').textContent).toBe('false');
    expect(second.getByTestId('can-modify').textContent).toBe('false');
  });

  it('exposes a mode-toggle that navigates to the edit page for owners', () => {
    const { getByTestId } = renderProbe();
    expect(getByTestId('has-mode-toggle').textContent).toBe('true');
    fireEvent.click(getByTestId('toggle-btn'));
    expect(navigateMock).toHaveBeenLastCalledWith('/agent-builder/agents/agent-1/edit', { viewTransition: true });
  });

  it('returns no mode-toggle for non-owners', () => {
    const { getByTestId } = renderProbe({ storedAgent: { authorId: 'someone-else' } });
    expect(getByTestId('has-mode-toggle').textContent).toBe('false');
  });

  it('hasBrowser stays false when the browser feature is off, even if the agent has a browser config', () => {
    browserFeatureEnabled = false;
    const { getByTestId } = renderProbe({ storedAgent: { browser: { sessionId: 'sess-1' } } });
    expect(getByTestId('has-browser').textContent).toBe('false');
  });

  it('hasBrowser is true only when the feature is on AND the agent has a browser config', () => {
    browserFeatureEnabled = true;
    const { getByTestId } = renderProbe({ storedAgent: { browser: { sessionId: 'sess-1' } } });
    expect(getByTestId('has-browser').textContent).toBe('true');
  });

  it('threadId falls back to the agent id when there is no current user id', () => {
    const { getByTestId } = renderProbe({ currentUserId: null });
    expect(getByTestId('thread-id').textContent).toBe('agent-1');
  });

  it('threadId combines current user id and agent id when available', () => {
    const { getByTestId } = renderProbe({ currentUserId: 'user-7' });
    expect(getByTestId('thread-id').textContent).toBe('user-7-agent-1');
  });
});
