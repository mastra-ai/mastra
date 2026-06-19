// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AgentBuilderSkillsCreate from '../create';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    usePlaygroundStore: () => ({ requestContext: undefined }),
  };
});

const { hasPermissionMock, rbacEnabledMock } = vi.hoisted(() => ({
  hasPermissionMock: vi.fn(),
  rbacEnabledMock: { value: false },
}));

vi.mock('@/domains/auth/hooks/use-permissions', () => ({
  usePermissions: () => ({ hasPermission: hasPermissionMock, rbacEnabled: rbacEnabledMock.value }),
}));

vi.mock('@/domains/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'user-1' }, isLoading: false }),
  isUnauthenticatedError: () => false,
}));

// The starter renders a chat-driven builder that boots an SSE stream. Stub it
// out and just verify the create page mounts it once permissions allow.
vi.mock('@/domains/agent-builder/components/skill-starter/skill-builder-starter', () => ({
  SkillBuilderStarter: () => <div data-testid="skill-builder-starter-stub" />,
}));

const renderPage = (initialPath = '/agent-builder/skills/create') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/agent-builder/skills/create" element={<AgentBuilderSkillsCreate />} />
              <Route path="/agent-builder/skills" element={<div data-testid="skills-list-page" />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

beforeEach(() => {
  hasPermissionMock.mockReset();
  rbacEnabledMock.value = false;
  // The page warms several caches; provide neutral handlers so they don't 404.
  server.use(
    http.get(`${BASE_URL}/api/stored/skills`, () =>
      HttpResponse.json({ skills: [], total: 0, page: 1, perPage: 50, hasMore: false }),
    ),
    http.get(`${BASE_URL}/api/stored/workspaces`, () =>
      HttpResponse.json({ workspaces: [], total: 0, page: 1, perPage: 50, hasMore: false }),
    ),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AgentBuilderSkillsCreate', () => {
  it('renders the starter when the user can create skills', async () => {
    hasPermissionMock.mockReturnValue(true);
    renderPage();

    expect(await screen.findByTestId('skill-builder-starter-stub')).toBeTruthy();
  });

  it('redirects to the skills list when RBAC denies stored-skills:write', async () => {
    rbacEnabledMock.value = true;
    hasPermissionMock.mockImplementation((perm: string) => perm !== 'stored-skills:write');

    renderPage();

    await waitFor(() => expect(screen.getByTestId('skills-list-page')).toBeTruthy());
    expect(screen.queryByTestId('skill-builder-starter-stub')).toBeNull();
  });
});
