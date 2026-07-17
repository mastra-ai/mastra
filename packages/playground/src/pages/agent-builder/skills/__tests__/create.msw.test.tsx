import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AgentBuilderSkillsCreate from '../create';
import { authDisabledCapabilities, currentUser, rbacCapabilities } from './fixtures/auth';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// The starter renders a chat-driven builder that boots an SSE stream and has
// its own dedicated test. Stub it as a thin seam and assert the create page
// mounts it once permissions allow.
vi.mock('@/domains/agent-builder/components/skill-starter/skill-builder-starter', () => ({
  SkillBuilderStarter: () => <div data-testid="skill-builder-starter-stub" />,
}));

const setCapabilities = (capabilities: AuthCapabilities) => {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)));
};

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
  // The page warms several caches; provide neutral handlers so they don't 404.
  server.use(
    http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(currentUser)),
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
  describe('when the user can create skills', () => {
    it('renders the skill builder starter', async () => {
      setCapabilities(authDisabledCapabilities);

      renderPage();

      expect(await screen.findByTestId('skill-builder-starter-stub')).toBeTruthy();
    });
  });

  describe('when RBAC denies stored-skills:write', () => {
    it('redirects to the skills list', async () => {
      setCapabilities(rbacCapabilities(['stored-skills:read']));

      renderPage();

      await waitFor(() => expect(screen.getByTestId('skills-list-page')).toBeTruthy());
    });

    it('does not render the skill builder starter', async () => {
      setCapabilities(rbacCapabilities(['stored-skills:read']));

      renderPage();

      await waitFor(() => expect(screen.getByTestId('skills-list-page')).toBeTruthy());
      expect(screen.queryByTestId('skill-builder-starter-stub')).toBeNull();
    });
  });
});
