// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { forwardRef } from 'react';
import { Link as RouterLink, Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import Workspace from '../index';
import {
  codeReviewSkillDetails,
  configuredSkills,
  skillFileContent,
  skillsFsListing,
  skillsSearchWorkspaceInfo,
  skillsSearchWorkspacesList,
} from './fixtures/workspace-editor';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProps } from '@/lib/framework';
import { navHandle } from '@/lib/nav';
import { RouteHeader, RouteHeaderActionsProvider, RouteHeaderCrumbsProvider } from '@/lib/route-header';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const Link = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ href = '', ...props }, ref) => (
  <RouterLink ref={ref} to={href} {...props} />
));
Link.displayName = 'TestLink';

const paths = {
  workspaceLink: (workspaceId?: string) => (workspaceId ? `/workspaces/${workspaceId}` : `/workspaces`),
  agentLink: (agentId: string) => `/agents/${agentId}/chat/new`,
} as unknown as React.ComponentProps<typeof LinkComponentProvider>['paths'];

const useSkillsWorkspaceHandlers = () => {
  server.use(
    http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(skillsSearchWorkspacesList)),
    http.get(`${BASE_URL}/api/workspaces/skills-ws`, () => HttpResponse.json(skillsSearchWorkspaceInfo)),
    http.get(`${BASE_URL}/api/workspaces/skills-ws/skills`, () => HttpResponse.json(configuredSkills)),
    http.get(`${BASE_URL}/api/workspaces/skills-ws/fs/list`, () => HttpResponse.json(skillsFsListing)),
    http.get(`${BASE_URL}/api/workspaces/skills-ws/fs/read`, () => HttpResponse.json(skillFileContent)),
    // Skill details endpoint backing the overview pane.
    http.get(`${BASE_URL}/api/workspaces/skills-ws/skills/code-review`, () =>
      HttpResponse.json(codeReviewSkillDetails),
    ),
  );
};

const renderEditor = (initialEntry: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <RouteHeaderActionsProvider>
            <RouteHeaderCrumbsProvider>
              <RouteHeader />
              <Outlet />
            </RouteHeaderCrumbsProvider>
          </RouteHeaderActionsProvider>
        ),
        children: [{ path: 'workspaces/:workspaceId', element: <Workspace />, handle: navHandle('/workspaces') }],
      },
    ],
    { initialEntries: [initialEntry] },
  );

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={Link} navigate={() => {}} paths={paths}>
          <RouterProvider router={router} />
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('Workspace skill overview pane', () => {
  it('renders the rich skill view when a skill SKILL.md is opened', async () => {
    useSkillsWorkspaceHandlers();

    renderEditor('/workspaces/skills-ws?file=.agents/skills/code-review/SKILL.md');

    // The skill name renders as the overview heading (the rich pane, not the file viewer).
    expect(await screen.findByRole('heading', { name: 'code-review' })).not.toBeNull();
    // The empty preview state is replaced by the overview.
    await waitFor(() => expect(screen.queryByText('Select a file to preview its contents')).toBeNull());
    // The plain file viewer's copy-content action is NOT shown for a skill's SKILL.md.
    expect(screen.queryByLabelText('Copy to clipboard')).toBeNull();
  });

  it('opens a non-skill file in the plain file viewer, not the rich view', async () => {
    useSkillsWorkspaceHandlers();

    renderEditor('/workspaces/skills-ws?file=README.md');

    // A regular file shows the file viewer (its copy-content action).
    expect(await screen.findByLabelText('Copy to clipboard')).not.toBeNull();
  });
});
