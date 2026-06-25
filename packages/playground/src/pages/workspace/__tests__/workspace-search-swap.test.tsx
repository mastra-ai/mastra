// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { forwardRef } from 'react';
import { Link as RouterLink, Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import Workspace from '../index';
import {
  agentWorkspaceInfo,
  agentWorkspacesList,
  codeReviewSkillDetails,
  configuredSkills,
  emptySkills,
  searchableWorkspaceInfo,
  searchableWorkspacesList,
  skillFileContent,
  skillsSearchResponse,
  skillsSearchWorkspaceInfo,
  skillsSearchWorkspacesList,
  workspaceFsListing,
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

const useSearchableWorkspaceHandlers = () => {
  server.use(
    http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(searchableWorkspacesList)),
    http.get(`${BASE_URL}/api/workspaces/fs-ws`, () => HttpResponse.json(searchableWorkspaceInfo)),
    http.get(`${BASE_URL}/api/workspaces/fs-ws/skills`, () => HttpResponse.json(emptySkills)),
    http.get(`${BASE_URL}/api/workspaces/fs-ws/fs/list`, () => HttpResponse.json(workspaceFsListing)),
  );
};

const renderEditor = (workspaceId = 'fs-ws') => {
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
    { initialEntries: [`/workspaces/${workspaceId}`] },
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

describe('Workspace search swap (Finder-style)', () => {
  describe('when the workspace has searchable files', () => {
    it('shows the editor by default and not the search view', async () => {
    useSearchableWorkspaceHandlers();

    renderEditor();

    // The editor file-preview empty state proves the editor split is mounted.
    expect(await screen.findByText('Select a file to preview its contents')).not.toBeNull();
    // The search view is not mounted yet.
    expect(screen.queryByPlaceholderText('Search workspace files...')).toBeNull();
    // The toggle offers to open search.
    expect(screen.getByLabelText('Search workspace')).not.toBeNull();
  });

  it('opens the search view in the rail while the editor pane stays mounted', async () => {
    useSearchableWorkspaceHandlers();

    renderEditor();

    const searchButton = await screen.findByLabelText('Search workspace');
    fireEvent.click(searchButton);

    // Search view (initial state) is now shown with its input...
    expect(await screen.findByPlaceholderText('Search workspace files...')).not.toBeNull();
    // ...while the preview pane (right side) stays mounted.
    expect(screen.getByText('Select a file to preview its contents')).not.toBeNull();
    // The toggle now offers to close search.
    expect(screen.getByLabelText('Close search')).not.toBeNull();
  });

  it('restores the editor when search is toggled off', async () => {
    useSearchableWorkspaceHandlers();

    renderEditor();

    const searchButton = await screen.findByLabelText('Search workspace');
    fireEvent.click(searchButton);

    const closeButton = await screen.findByLabelText('Close search');
    fireEvent.click(closeButton);

    // Editor is back and the search view is unmounted.
    await waitFor(() => expect(screen.getByText('Select a file to preview its contents')).not.toBeNull());
    expect(screen.queryByPlaceholderText('Search workspace files...')).toBeNull();
  });

  it('swaps the file tree out for the search view in the rail (VS Code style)', async () => {
    useSearchableWorkspaceHandlers();

    renderEditor();

    // The file tree header is shown by default.
    expect(await screen.findByText('Files')).not.toBeNull();

    const searchButton = await screen.findByLabelText('Search workspace');
    fireEvent.click(searchButton);

    // Opening search swaps the rail: the search input replaces the file tree.
    expect(await screen.findByPlaceholderText('Search workspace files...')).not.toBeNull();
    expect(screen.queryByText('Files')).toBeNull();
  });

  });

  describe('when the workspace is attached to an agent', () => {
    it('renders the attached agent as a badge linking back to the agent', async () => {
    server.use(
      http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(agentWorkspacesList)),
      http.get(`${BASE_URL}/api/workspaces/agent-ws`, () => HttpResponse.json(agentWorkspaceInfo)),
      http.get(`${BASE_URL}/api/workspaces/agent-ws/skills`, () => HttpResponse.json(emptySkills)),
      http.get(`${BASE_URL}/api/workspaces/agent-ws/fs/list`, () => HttpResponse.json(workspaceFsListing)),
    );

    renderEditor('agent-ws');

    const badgeLink = await screen.findByRole('link', { name: /Weather Agent/ });
    expect(badgeLink.getAttribute('href')).toBe('/agents/weather-agent/chat/new');
  });

  });

  describe('when the workspace has searchable skills', () => {
    it('opens a skill search result as the rich skill view instead of navigating away', async () => {
    server.use(
      http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(skillsSearchWorkspacesList)),
      http.get(`${BASE_URL}/api/workspaces/skills-ws`, () => HttpResponse.json(skillsSearchWorkspaceInfo)),
      http.get(`${BASE_URL}/api/workspaces/skills-ws/skills`, () => HttpResponse.json(configuredSkills)),
      http.get(`${BASE_URL}/api/workspaces/skills-ws/fs/list`, () => HttpResponse.json(workspaceFsListing)),
      http.get(`${BASE_URL}/api/workspaces/skills-ws/skills/search`, () => HttpResponse.json(skillsSearchResponse)),
      http.get(`${BASE_URL}/api/workspaces/skills-ws/fs/read`, () => HttpResponse.json(skillFileContent)),
      http.get(`${BASE_URL}/api/workspaces/skills-ws/skills/code-review`, () =>
        HttpResponse.json(codeReviewSkillDetails),
      ),
    );

    renderEditor('skills-ws');

    const searchButton = await screen.findByLabelText('Search workspace');
    fireEvent.click(searchButton);

    // Before selecting, the preview pane shows its empty state.
    expect(screen.getByText('Select a file to preview its contents')).not.toBeNull();

    // Run a skills search to surface a result.
    const skillsInput = await screen.findByPlaceholderText('Search across skills...');
    fireEvent.change(skillsInput, { target: { value: 'review' } });

    const resultName = await screen.findByText('code-review', {}, { timeout: 2000 });
    fireEvent.click(resultName.closest('button')!);

    // Clicking the SKILL.md result opens the rich skill view (its heading),
    // rather than navigating away or showing the plain file viewer.
    await waitFor(() => expect(screen.queryByText('Select a file to preview its contents')).toBeNull());
    expect(await screen.findByRole('heading', { name: 'code-review' })).not.toBeNull();

    // The search panel stays open and the typed query is preserved.
    const stillOpen = screen.getByPlaceholderText('Search across skills...') as HTMLInputElement;
    expect(stillOpen).not.toBeNull();
    expect(stillOpen.value).toBe('review');
  });  });
});
