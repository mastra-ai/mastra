// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AgentBuilderSkillsView from '../view';
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

vi.mock('@/domains/auth/hooks/use-permissions', () => ({
  usePermissions: () => ({ hasPermission: () => true, rbacEnabled: false }),
}));

const { currentUserMock } = vi.hoisted(() => ({
  currentUserMock: { id: 'viewer-1' as string | undefined },
}));

vi.mock('@/domains/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: currentUserMock.id }, isLoading: false }),
}));

const renderPage = (skillId: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[`/agent-builder/skills/${skillId}`]}>
            <Routes>
              <Route path="/agent-builder/skills/:id" element={<AgentBuilderSkillsView />} />
              <Route path="/agent-builder/skills" element={<div data-testid="skills-list-page" />} />
              <Route path="/agent-builder/skills/:id/edit" element={<div data-testid="skills-edit-page" />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

beforeEach(() => {
  currentUserMock.id = 'viewer-1';
  server.use(
    http.get(`${BASE_URL}/api/stored/skills`, () =>
      HttpResponse.json({ skills: [], total: 0, page: 1, perPage: 50, hasMore: false }),
    ),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, capabilities: {} })),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AgentBuilderSkillsView', () => {
  it('renders the public skill view for a non-owner', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/skills/skill-pub`, () =>
        HttpResponse.json({
          id: 'skill-pub',
          name: 'Public Skill',
          description: 'A shared skill',
          instructions: 'How to use it',
          visibility: 'public',
          authorId: 'someone-else',
          status: 'active',
          createdAt: '',
          updatedAt: '',
        }),
      ),
    );

    renderPage('skill-pub');

    expect(await screen.findByTestId('skill-view-page')).toBeTruthy();
    expect(screen.getByTestId('skill-view-title').textContent).toBe('Public Skill');
    expect(screen.getByTestId('skill-view-description').textContent).toContain('A shared skill');
    // Non-owner can copy.
    expect(screen.getByTestId('skill-view-copy-button')).toBeTruthy();
  });

  it('redirects the owner to the edit page', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/skills/skill-own`, () =>
        HttpResponse.json({
          id: 'skill-own',
          name: 'Mine',
          description: 'Mine',
          instructions: '',
          visibility: 'private',
          authorId: 'viewer-1',
          status: 'active',
          createdAt: '',
          updatedAt: '',
        }),
      ),
    );

    renderPage('skill-own');

    await waitFor(() => expect(screen.getByTestId('skills-edit-page')).toBeTruthy());
    expect(screen.queryByTestId('skill-view-page')).toBeNull();
  });

  it('redirects to the skills list when the skill does not exist', async () => {
    server.use(http.get(`${BASE_URL}/api/stored/skills/missing`, () => HttpResponse.json(null)));

    renderPage('missing');

    await waitFor(() => expect(screen.getByTestId('skills-list-page')).toBeTruthy());
  });
});
