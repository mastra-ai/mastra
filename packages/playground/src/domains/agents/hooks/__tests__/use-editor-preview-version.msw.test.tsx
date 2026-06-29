import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { agentVersionsResponse } from '../../components/__tests__/fixtures/agent-versions';
import { AgentSidebarViewProvider, useAgentSidebarView } from '../../context/agent-sidebar-view-context';
import { useEditorPreviewVersionId } from '../use-editor-preview-version';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <AgentSidebarViewProvider>{children}</AgentSidebarViewProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => cleanup());

// The version editor's test chat must resolve the latest saved version while the
// editor is open, so a draft "Save" is immediately testable without publishing.
describe('useEditorPreviewVersionId', () => {
  it('returns the latest version once the version editor is opened', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => HttpResponse.json(agentVersionsResponse)),
    );

    const { result } = renderHook(
      () => ({
        view: useAgentSidebarView(),
        preview: useEditorPreviewVersionId({ agentId: AGENT_ID, urlVersionId: undefined }),
      }),
      { wrapper: makeWrapper() },
    );

    // Editor closed (default 'threads') → no preview, falls back to normal resolution.
    expect(result.current.preview).toBeUndefined();

    act(() => result.current.view.openVersions());

    await waitFor(() => expect(result.current.preview).toBe('version-2'));
  });

  it('does not fetch versions or preview while the editor is closed', async () => {
    const onVersions = vi.fn<() => void>();
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => {
        onVersions();
        return HttpResponse.json(agentVersionsResponse);
      }),
    );

    const { result } = renderHook(() => useEditorPreviewVersionId({ agentId: AGENT_ID, urlVersionId: undefined }), {
      wrapper: makeWrapper(),
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(result.current).toBeUndefined();
    expect(onVersions).not.toHaveBeenCalled();
  });

  it('always honors an explicit URL version, even while the editor is open', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => HttpResponse.json(agentVersionsResponse)),
    );

    const { result } = renderHook(
      () => ({
        view: useAgentSidebarView(),
        preview: useEditorPreviewVersionId({ agentId: AGENT_ID, urlVersionId: 'version-1' }),
      }),
      { wrapper: makeWrapper() },
    );

    act(() => result.current.view.openVersions());

    // The explicit version the user navigated to wins over the latest draft.
    await waitFor(() => expect(result.current.preview).toBe('version-1'));
  });
});
