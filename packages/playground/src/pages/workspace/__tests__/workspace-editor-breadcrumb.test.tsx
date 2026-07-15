// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { forwardRef } from 'react';
import { Link as RouterLink, Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import Workspace from '../index';
import { configuredWorkspaceInfo, emptySkills, workspacesList } from './fixtures/workspace-editor';
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

const renderEditor = () => {
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
        children: [
          {
            path: 'workspaces/:workspaceId',
            element: <Workspace />,
            handle: navHandle('/workspaces'),
          },
        ],
      },
    ],
    { initialEntries: ['/workspaces/global-ws'] },
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

describe('Workspace editor breadcrumb', () => {
  describe('when the workspace info fixture is configured', () => {
    it('shows "Workspaces > <workspace name>" in the route header', async () => {
    server.use(
      http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(workspacesList)),
      http.get(`${BASE_URL}/api/workspaces/global-ws`, () => HttpResponse.json(configuredWorkspaceInfo)),
      http.get(`${BASE_URL}/api/workspaces/global-ws/skills`, () => HttpResponse.json(emptySkills)),
    );

    renderEditor();

    const breadcrumb = await screen.findByRole('navigation', { name: /breadcrumb/i });

    await waitFor(() => expect(within(breadcrumb).getByText('Global Workspace')).not.toBeNull());

    // The workspaces list crumb links back to /workspaces.
    const workspacesCrumb = within(breadcrumb).getByText('Workspaces');
    expect(workspacesCrumb.closest('a')?.getAttribute('href')).toBe('/workspaces');
  });
  });
});
