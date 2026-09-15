import type { StoredSkillResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { usePlaygroundStore } from '@mastra/playground-ui/store/playground-store';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AgentBuilderSkillsView from '../view';
import type { CurrentUser } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const setCurrentUser = (user: CurrentUser) => {
  server.use(http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(user)));
};

const setStoredSkill = (id: string, skill: StoredSkillResponse | null) => {
  server.use(http.get(`${BASE_URL}/api/stored/skills/${id}`, () => HttpResponse.json(skill)));
};

const buildSkill = (
  overrides: Partial<StoredSkillResponse> & Pick<StoredSkillResponse, 'id'>,
): StoredSkillResponse => ({
  name: 'Skill',
  instructions: '',
  status: 'active',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

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
  usePlaygroundStore.setState({ requestContext: {} });
  setCurrentUser({ id: 'viewer-1' });
  server.use(
    http.get(`${BASE_URL}/api/stored/skills`, () =>
      HttpResponse.json({ skills: [], total: 0, page: 1, perPage: 50, hasMore: false }),
    ),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
    // RBAC disabled → every permission check passes.
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AgentBuilderSkillsView', () => {
  describe('when the viewer is not the owner', () => {
    beforeEach(() => {
      setStoredSkill(
        'skill-pub',
        buildSkill({
          id: 'skill-pub',
          name: 'Public Skill',
          description: 'A shared skill',
          instructions: 'How to use it',
          visibility: 'public',
          authorId: 'someone-else',
        }),
      );
    });

    it('renders the public skill view with its title and description', async () => {
      renderPage('skill-pub');

      expect(await screen.findByTestId('skill-view-page')).toBeTruthy();
      expect(screen.getByTestId('skill-view-title').textContent).toBe('Public Skill');
      expect(screen.getByTestId('skill-view-description').textContent).toContain('A shared skill');
    });

    it('offers a copy action to the non-owner', async () => {
      renderPage('skill-pub');

      expect(await screen.findByTestId('skill-view-copy-button')).toBeTruthy();
    });
  });

  describe('when the viewer owns the skill', () => {
    it('redirects to the edit page', async () => {
      setStoredSkill(
        'skill-own',
        buildSkill({ id: 'skill-own', name: 'Mine', description: 'Mine', visibility: 'private', authorId: 'viewer-1' }),
      );

      renderPage('skill-own');

      await waitFor(() => expect(screen.getByTestId('skills-edit-page')).toBeTruthy());
      expect(screen.queryByTestId('skill-view-page')).toBeNull();
    });
  });

  describe('when the skill does not exist', () => {
    it('redirects to the skills list', async () => {
      setStoredSkill('missing', null);

      renderPage('missing');

      await waitFor(() => expect(screen.getByTestId('skills-list-page')).toBeTruthy());
    });
  });
});
