// @vitest-environment jsdom
import type { ListWorkspacesResponse, WorkspaceInfoResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { forwardRef } from 'react';
import { Link as RouterLink, Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import Workspace from '../index';
import {
  gatingFsListing,
  gatingSkills,
  gatingWorkspaceWritableList,
  listWithoutGatingWorkspace,
  readOnlyGatingWorkspaceInfo,
  writableGatingWorkspaceInfo,
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

const useGatingHandlers = (list: ListWorkspacesResponse, info: WorkspaceInfoResponse) => {
  server.use(
    http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(list)),
    http.get(`${BASE_URL}/api/workspaces/gating-ws`, () => HttpResponse.json(info)),
    http.get(`${BASE_URL}/api/workspaces/gating-ws/skills`, () => HttpResponse.json(gatingSkills)),
    http.get(`${BASE_URL}/api/workspaces/gating-ws/fs/list`, () => HttpResponse.json(gatingFsListing)),
  );
};

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
        children: [{ path: 'workspaces/:workspaceId', element: <Workspace />, handle: navHandle('/workspaces') }],
      },
    ],
    { initialEntries: ['/workspaces/gating-ws'] },
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

describe('WorkspacePage read-only gating', () => {
  describe('when the by-id workspace info reports read-only and the list omits the workspace', () => {
    it('does not render the create directory action', async () => {
      useGatingHandlers(listWithoutGatingWorkspace, readOnlyGatingWorkspaceInfo);

      renderEditor();

      // The file tree renders once fs/list resolves.
      expect(await screen.findByText('README.md')).not.toBeNull();
      await waitFor(() =>
        expect(screen.queryByLabelText('Create folder at workspace root')).toBeNull(),
      );
    });

    it('does not render the delete action', async () => {
      useGatingHandlers(listWithoutGatingWorkspace, readOnlyGatingWorkspaceInfo);

      renderEditor();

      expect(await screen.findByText('README.md')).not.toBeNull();
      await waitFor(() => expect(screen.queryByLabelText('Delete README.md')).toBeNull());
    });

    it('does not render the add skill action', async () => {
      useGatingHandlers(listWithoutGatingWorkspace, readOnlyGatingWorkspaceInfo);

      renderEditor();

      expect(await screen.findByText('README.md')).not.toBeNull();
      await waitFor(() => expect(screen.queryByLabelText('Add skill')).toBeNull());
    });
  });

  describe('when the by-id workspace info reports writable', () => {
    it('renders create directory, delete, and add skill actions', async () => {
      useGatingHandlers(listWithoutGatingWorkspace, writableGatingWorkspaceInfo);

      renderEditor();

      // Wait for the file tree to resolve before asserting the write controls.
      expect(await screen.findByText('README.md')).not.toBeNull();
      expect(await screen.findByLabelText('Create folder at workspace root')).not.toBeNull();
      expect(await screen.findByLabelText('Add skill')).not.toBeNull();
      expect(await screen.findByLabelText('Delete README.md')).not.toBeNull();
    });
  });

  describe('when the by-id workspace info reports read-only but the list says writable', () => {
    it('does not render the create/write actions', async () => {
      useGatingHandlers(gatingWorkspaceWritableList, readOnlyGatingWorkspaceInfo);

      renderEditor();

      expect(await screen.findByText('README.md')).not.toBeNull();
      await waitFor(() => {
        expect(screen.queryByLabelText('Create folder at workspace root')).toBeNull();
        expect(screen.queryByLabelText('Delete README.md')).toBeNull();
        expect(screen.queryByLabelText('Add skill')).toBeNull();
      });
    });
  });
});
