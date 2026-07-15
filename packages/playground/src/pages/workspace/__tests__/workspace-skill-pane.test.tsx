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
import type { LinkComponentProps, LinkComponentProviderProps } from '@/lib/framework';
import { navHandle } from '@/lib/nav';
import { RouteHeader, RouteHeaderActionsProvider, RouteHeaderCrumbsProvider } from '@/lib/route-header';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const Link = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ href = '', ...props }, ref) => (
  <RouterLink ref={ref} to={href} {...props} />
));
Link.displayName = 'TestLink';

const paths = {
  agentLink: (agentId: string) => `/agents/${agentId}/chat/new`,
  agentsLink: () => '/agents',
  agentToolLink: (agentId: string, toolId: string) => `/agents/${agentId}/tools/${toolId}`,
  agentSkillLink: (agentId: string, skillName: string) => `/agents/${agentId}/skills/${skillName}`,
  agentThreadLink: (agentId: string, threadId: string) => `/agents/${agentId}/chat/${threadId}`,
  agentNewThreadLink: (agentId: string) => `/agents/${agentId}/chat/new`,
  workflowsLink: () => '/workflows',
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
  schedulesLink: () => '/schedules',
  scheduleLink: (scheduleId: string) => `/schedules/${scheduleId}`,
  networkLink: (networkId: string) => `/networks/${networkId}`,
  networkNewThreadLink: (networkId: string) => `/networks/${networkId}/chat/new`,
  networkThreadLink: (networkId: string, threadId: string) => `/networks/${networkId}/chat/${threadId}`,
  scorerLink: (scorerId: string) => `/scorers/${scorerId}`,
  cmsScorersCreateLink: () => '/cms/scorers/create',
  cmsScorerEditLink: (scorerId: string) => `/cms/scorers/${scorerId}`,
  cmsAgentCreateLink: () => '/cms/agents/create',
  cmsAgentEditLink: (agentId: string) => `/cms/agents/${agentId}`,
  promptBlockLink: (promptBlockId: string) => `/prompt-blocks/${promptBlockId}`,
  promptBlocksLink: () => '/prompt-blocks',
  cmsPromptBlockCreateLink: () => '/cms/prompt-blocks/create',
  cmsPromptBlockEditLink: (promptBlockId: string) => `/cms/prompt-blocks/${promptBlockId}`,
  toolLink: (toolId: string) => `/tools/${toolId}`,
  skillLink: (skillName: string) => `/skills/${skillName}`,
  workspacesLink: () => '/workspaces',
  workspaceLink: (workspaceId?: string) => (workspaceId ? `/workspaces/${workspaceId}` : `/workspaces`),
  workspaceSkillLink: (skillName: string) => `/workspaces/skills/${skillName}`,
  processorsLink: () => '/processors',
  processorLink: (processorId: string) => `/processors/${processorId}`,
  mcpServerLink: (serverId: string) => `/mcp/${serverId}`,
  mcpServerToolLink: (serverId: string, toolId: string) => `/mcp/${serverId}/tools/${toolId}`,
  workflowRunLink: (workflowId: string, runId: string) => `/workflows/${workflowId}/runs/${runId}`,
  datasetLink: (datasetId: string) => `/datasets/${datasetId}`,
  datasetItemLink: (datasetId: string, itemId: string) => `/datasets/${datasetId}/items/${itemId}`,
  datasetExperimentLink: (datasetId: string, experimentId: string) =>
    `/datasets/${datasetId}/experiments/${experimentId}`,
  experimentLink: (experimentId: string) => `/experiments/${experimentId}`,
} satisfies LinkComponentProviderProps['paths'];

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
  describe('when the workspace has installed skill fixtures', () => {
    it('renders the rich skill view when a skill SKILL.md is opened', async () => {
      useSkillsWorkspaceHandlers();

      renderEditor('/workspaces/skills-ws?file=.agents/skills/code-review/SKILL.md');

      // The skill name renders as the overview heading (the rich pane, not the file viewer).
      expect(await screen.findByRole('heading', { name: 'code-review' })).not.toBeNull();
      // The empty preview state is replaced by the overview.
      await waitFor(() => expect(screen.queryByText('Select a file to preview its contents')).toBeNull());
      // The plain file viewer's copy-content action is NOT shown for a skill's SKILL.md.
      expect(screen.queryByLabelText('Copy file content')).toBeNull();
    });

    it('opens a non-skill file in the plain file viewer, not the rich view', async () => {
      useSkillsWorkspaceHandlers();

      renderEditor('/workspaces/skills-ws?file=README.md');

      // A regular file exposes the file viewer's icon-only copy action.
      expect(await screen.findByRole('button', { name: 'Copy file content' })).not.toBeNull();
    });
  });
});
