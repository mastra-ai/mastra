import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  availableProcessors,
  redactorDetail,
  processorSuccess,
  processorTripwire,
  availableScorers,
  availableTools,
  noTools,
  noProcessors,
  noScorers,
  noLogs,
  noWorkflowRuns,
  noWorkflowRunCounts,
  noStoredAgents,
  packagesWithPromptEditing,
} from './fixtures/studio-shell';
import { routes } from '@/App';
import { noMcpServers, noWorkspaces } from '@/components/ui/__tests__/fixtures/nav-more';
import { adminSidebarCapabilities } from '@/components/ui/__tests__/fixtures/sidebar-permissions';
import { authHandler, BASE_URL, builderHandler, systemPackagesHandler } from '@/components/ui/__tests__/render-sidebar';
import { RoleImpersonationProvider } from '@/domains/auth/context/role-impersonation-context';
import { emptyDatasetItems } from '@/domains/datasets/components/__tests__/fixtures/dataset-items';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  buildListExperimentsResponse,
  emptyReviewSummary,
} from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { legacyServer, toolList } from '@/domains/mcps/components/__tests__/fixtures/mcp-servers';
import { weatherWorkflow, WORKFLOW_ID, noSchedules } from '@/domains/workflows/__tests__/fixtures/workflow';
import { agentsList } from '@/pages/agents/__tests__/fixtures/agents';
import {
  emptyTags,
  emptyEntityNames,
  emptyServiceNames,
  emptyEnvironments,
} from '@/pages/metrics/__tests__/fixtures/metrics';
import { fewPromptBlocks } from '@/pages/prompt-blocks/__tests__/fixtures/prompt-blocks';
import {
  traceQueryCapabilities,
  traceQueryPage,
  emptyTraceQueryFields,
} from '@/pages/traces/__tests__/fixtures/trace-query';
import {
  rootListing,
  popularSkills,
  skillsList,
  workspaceId,
  workspaceInfo,
  workspacesList,
} from '@/pages/workspace/__tests__/fixtures/workspace-page';
import { server } from '@/test/msw-server';

beforeEach(() => {
  window.localStorage.clear();
  server.use(
    authHandler({ enabled: false, login: { type: 'credentials' } }),
    builderHandler({ enabled: false }),
    systemPackagesHandler(),
    http.get(`${BASE_URL}/api/agents`, () => HttpResponse.json(agentsList)),
    http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json({ [WORKFLOW_ID]: weatherWorkflow })),
    http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(weatherWorkflow)),
    http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs`, () => HttpResponse.json(noWorkflowRuns)),
    http.get(`${BASE_URL}/api/tools`, () => HttpResponse.json(noTools)),
    http.get(`${BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(noMcpServers)),
    http.get(`${BASE_URL}/api/workspaces/${workspaceId}/skills-sh/popular`, () => HttpResponse.json(popularSkills)),
    http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(noWorkspaces)),
    http.get(`${BASE_URL}/api/stored/prompt-blocks`, () => HttpResponse.json(fewPromptBlocks)),
    http.get(`${BASE_URL}/api/stored/agents`, () => HttpResponse.json(noStoredAgents)),
    http.get(`${BASE_URL}/api/workflows/run-counts`, () => HttpResponse.json(noWorkflowRunCounts)),
    http.get(`${BASE_URL}/api/schedules`, () => HttpResponse.json(noSchedules)),
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse())),
    http.get(`${BASE_URL}/api/experiments`, () => HttpResponse.json(buildListExperimentsResponse([]))),
    http.get(`${BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(traceQueryCapabilities)),
    http.post(`${BASE_URL}/api/observability/traces/query`, () => HttpResponse.json(traceQueryPage)),
    http.post(`${BASE_URL}/api/observability/traces/query/fields`, () => HttpResponse.json(emptyTraceQueryFields)),
    http.get(`${BASE_URL}/api/observability/logs`, () => HttpResponse.json(noLogs)),
    http.get(`${BASE_URL}/api/observability/discovery/tags`, () => HttpResponse.json(emptyTags)),
    http.get(`${BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${BASE_URL}/api/observability/discovery/service-names`, () => HttpResponse.json(emptyServiceNames)),
    http.get(`${BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <RoleImpersonationProvider>
          <RouterProvider router={router} />
        </RoleImpersonationProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

async function findOnlyRail() {
  const rail = await screen.findByRole('complementary', { name: 'Studio navigation' });
  expect(screen.getAllByRole('complementary')).toEqual([rail]);
  return rail;
}

async function selectOption(name: string) {
  const option = await screen.findByRole('option', { name, exact: true });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
}

describe('Studio route shells', () => {
  describe('when navigating on mobile', () => {
    beforeEach(() => {
      const matchMedia = window.matchMedia;
      vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
        ...matchMedia(query),
        matches: query === '(max-width: 1023px)',
      }));
      server.use(
        http.get(`${BASE_URL}/api/tools`, () => HttpResponse.json(availableTools)),
        http.get(`${BASE_URL}/api/tools/weather`, () => HttpResponse.json(availableTools.weather)),
      );
    });
    it('keeps breadcrumbs and both navigation controls in one header', async () => {
      renderAt('/tools/weather');
      await screen.findByRole('textbox', { name: /city/i });
      const header = screen.getByRole('banner', { name: 'Studio header' });
      const breadcrumbs = within(header).getByRole('navigation', { name: 'Breadcrumb' });
      expect(breadcrumbs.textContent).toContain('weather');
      expect(within(header).getByRole('button', { name: 'Open navigation menu' })).toBeTruthy();
      expect(within(header).getByRole('button', { name: 'Tools navigation' })).toBeTruthy();
      expect(within(header).queryByText('Mastra Studio')).toBeNull();
      fireEvent.click(within(breadcrumbs).getByRole('link', { name: 'Tools' }));
      await screen.findByRole('searchbox', { name: 'Filter tools' });
      expect(within(header).getByRole('navigation', { name: 'Breadcrumb' }).textContent).toBe('Tools');
    });
    it('keeps permission-gated page actions available from the compact header', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)));
      renderAt('/prompts');
      await screen.findByText('Prompt Block 1');
      const header = screen.getByRole('banner', { name: 'Studio header' });
      fireEvent.click(within(header).getByRole('button', { name: 'Page actions' }));
      fireEvent.click(await screen.findByRole('link', { name: 'New prompt' }));
      await waitFor(() =>
        expect(within(header).getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('Create prompt'),
      );
      expect(within(header).getByRole('button', { name: 'Prompt navigation' })).toBeTruthy();
    });
  });
  describe('when moving between library pages', () => {
    it('opens the next page from More, full width', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)));
      renderAt('/prompts');
      await screen.findByText('Prompt Block 1');
      const rail = await findOnlyRail();
      expect(within(rail).getByRole('link', { name: 'Prompts' }).getAttribute('aria-current')).toBe('page');
      fireEvent.click(within(rail).getByRole('button', { name: 'More' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Tools' }));
      await waitFor(() =>
        expect(within(rail).getByRole('link', { name: 'Tools' }).getAttribute('aria-current')).toBe('page'),
      );
      expect(screen.getAllByRole('complementary')).toEqual([rail]);
    });
  });
  describe('when moving through evaluation features', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
        http.get(`${BASE_URL}/api/datasets/:datasetId`, () => HttpResponse.json(buildDataset())),
        http.get(`${BASE_URL}/api/datasets/:datasetId/items`, () => HttpResponse.json(emptyDatasetItems)),
      );
    });

    it('opens a dataset from the list below the experiments and review queue', async () => {
      renderAt('/datasets');
      const sidebar = await screen.findByRole('complementary', { name: 'Evaluate navigation' });
      const datasets = await within(sidebar).findByRole('navigation', { name: 'Datasets list' });
      await waitFor(() =>
        expect(within(datasets).getByRole('link', { name: 'Dataset 1' }).getAttribute('aria-current')).toBe('page'),
      );
      const features = within(sidebar).getByRole('navigation', { name: 'Evaluate features' });
      expect(within(features).queryByRole('link', { name: 'Datasets' })).toBeNull();
      expect(within(features).queryByRole('link', { name: 'Scorers' })).toBeNull();
      expect(await screen.findByRole('navigation', { name: 'Dataset views' })).toBeTruthy();
    });

    it('keeps the navigator mounted across experiments and review', async () => {
      renderAt('/experiments');
      const sidebar = await screen.findByRole('complementary', { name: 'Evaluate navigation' });
      const features = within(sidebar).getByRole('navigation', { name: 'Evaluate features' });
      for (const name of [/^Review Queue/, /^Experiments/]) {
        fireEvent.click(within(features).getByRole('link', { name }));
        await waitFor(() =>
          expect(within(features).getByRole('link', { name }).getAttribute('aria-current')).toBe('page'),
        );
        expect(screen.getByRole('complementary', { name: 'Evaluate navigation' })).toBe(sidebar);
      }
      expect(screen.queryByText('Something went wrong')).toBeNull();
    });
  });
  describe('when opening logs', () => {
    it('uses the full frame without a contextual sidebar', async () => {
      renderAt('/logs');
      const rail = await findOnlyRail();
      await waitFor(() =>
        expect(within(rail).getByRole('link', { name: 'Logs' }).getAttribute('aria-current')).toBe('page'),
      );
    });
  });
  describe('when opening metrics', () => {
    it('lives at the top of the agents sidebar without repeating the area name', async () => {
      renderAt('/metrics');
      const sidebar = await screen.findByRole('complementary', { name: 'Agents navigation' });
      await waitFor(() =>
        expect(
          within(sidebar)
            .getByRole('link', { name: /^Metrics/ })
            .getAttribute('aria-current'),
        ).toBe('page'),
      );
      expect(within(sidebar).queryByRole('link', { name: 'Agents', exact: true })).toBeNull();
      expect(await within(sidebar).findByRole('navigation', { name: 'Agents list' })).toBeTruthy();
    });
  });
  describe('when opening traces', () => {
    it('uses the full frame without a contextual sidebar', async () => {
      renderAt('/traces');
      const rail = await screen.findByRole('complementary', { name: 'Studio navigation' });
      await waitFor(() =>
        expect(within(rail).getByRole('link', { name: 'Traces' }).getAttribute('aria-current')).toBe('page'),
      );
      expect(screen.queryByRole('complementary', { name: 'Monitor navigation' })).toBeNull();
    });
  });
  describe('when only scores are permitted', () => {
    it('opens scorers without evaluation features the user cannot access', async () => {
      server.use(
        authHandler({ ...adminSidebarCapabilities, access: { roles: ['scorer-user'], permissions: ['scores:read'] } }),
      );
      renderAt('/scorers');
      const rail = await findOnlyRail();
      expect((await within(rail).findByRole('link', { name: 'Scorers' })).getAttribute('aria-current')).toBe('page');
      for (const name of ['Evaluate', 'Experiments', 'Datasets', 'Review Queue']) {
        expect(screen.queryByRole('link', { name })).toBeNull();
      }
    });
  });
  describe('when browsing MCP servers', () => {
    it('lists servers once, with Integrations pinned in the rail', async () => {
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)),
        http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [legacyServer] })),
      );
      renderAt('/mcps');
      await screen.findByText('Legacy Server');
      expect(screen.getAllByText('Legacy Server')).toHaveLength(1);
      const rail = await findOnlyRail();
      expect((await within(rail).findByRole('link', { name: 'Integrations' })).getAttribute('href')).toBe(
        '/integrations',
      );
    });
  });
  describe('when opening a workspace', () => {
    it('places the workspace picker and file tree in the shared sidebar', async () => {
      server.use(
        http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(workspacesList)),
        http.get(`${BASE_URL}/api/workspaces/${workspaceId}`, () => HttpResponse.json(workspaceInfo)),
        http.get(`${BASE_URL}/api/workspaces/${workspaceId}/skills`, () => HttpResponse.json(skillsList)),
        http.get(`${BASE_URL}/api/workspaces/${workspaceId}/fs/list`, () => HttpResponse.json(rootListing)),
      );
      renderAt(`/workspaces/${workspaceId}`);
      const sidebar = await screen.findByRole('complementary', { name: 'Workspace navigation' });
      expect(await within(sidebar).findByText('notes')).toBeTruthy();
      expect(within(sidebar).getByRole('combobox', { name: 'Workspace' })).toBeTruthy();
      expect(within(sidebar).getByRole('button', { name: 'New folder' })).toBeTruthy();
      expect(screen.getAllByText('notes')).toHaveLength(1);
      const rail = screen.getByRole('complementary', { name: 'Studio navigation' });
      expect(within(rail).getByRole('link', { name: 'Workspaces' }).getAttribute('aria-current')).toBe('page');
    });
  });
  describe('when browsing scorers', () => {
    it('lists scorers once, full width', async () => {
      server.use(http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json(availableScorers)));
      renderAt('/scorers');
      await screen.findByText('quality');
      expect(screen.getAllByText('quality')).toHaveLength(1);
      const rail = await findOnlyRail();
      expect(within(rail).getByRole('link', { name: 'Scorers' }).getAttribute('aria-current')).toBe('page');
    });
  });
  describe('when browsing processors', () => {
    it('lists processors once, with one search', async () => {
      server.use(http.get(`${BASE_URL}/api/processors`, () => HttpResponse.json(availableProcessors)));
      renderAt('/processors');
      await screen.findByText('PII redactor');
      expect(screen.getAllByText('PII redactor')).toHaveLength(1);
      const rail = await findOnlyRail();
      expect(within(rail).getByRole('link', { name: 'Processors' }).getAttribute('aria-current')).toBe('page');
      expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    });
  });
  describe('when tool access is denied', () => {
    it('explains the error in the content', async () => {
      server.use(http.get(`${BASE_URL}/api/tools`, () => HttpResponse.json({ error: 'Forbidden' }, { status: 403 })));
      renderAt('/tools');
      await screen.findByText(/permission to access/i);
      await findOnlyRail();
    });
  });
  describe('when browsing tools', () => {
    it('lists registered and agent tools once in the content', async () => {
      server.use(http.get(`${BASE_URL}/api/tools`, () => HttpResponse.json(availableTools)));
      renderAt('/tools');
      await screen.findByText('weather');
      expect(screen.getAllByText('weather')).toHaveLength(1);
      expect(screen.getAllByText('search')).toHaveLength(1);
      await findOnlyRail();
      expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    });
  });
  describe('when selecting a tool from the collection', () => {
    it('opens the tool list beside the main tool playground', async () => {
      server.use(
        http.get(`${BASE_URL}/api/tools`, () => HttpResponse.json(availableTools)),
        http.get(`${BASE_URL}/api/tools/weather`, () => HttpResponse.json(availableTools.weather)),
      );
      renderAt('/tools');
      fireEvent.click(await screen.findByText('weather'));
      const sidebar = await screen.findByRole('complementary', { name: 'Tools navigation' });
      expect(await screen.findByRole('button', { name: 'Run' })).toBeTruthy();
      expect(within(sidebar).queryByRole('button', { name: 'Run' })).toBeNull();
    });
  });
  describe('when tools are only attached to agents', () => {
    it('keeps those tools available in the collection', async () => {
      renderAt('/tools');
      expect(await screen.findByText('search')).toBeTruthy();
    });
  });
  describe('when opening a tool directly', () => {
    it('keeps navigation in the sidebar and execution in the main workspace', async () => {
      server.use(
        http.get(`${BASE_URL}/api/tools`, () => HttpResponse.json(availableTools)),
        http.get(`${BASE_URL}/api/tools/weather`, () => HttpResponse.json(availableTools.weather)),
      );
      renderAt('/tools/weather');
      const sidebar = await screen.findByRole('complementary', { name: 'Tools navigation' });
      expect(await screen.findByRole('button', { name: 'Run' })).toBeTruthy();
      expect(within(sidebar).queryByRole('button', { name: 'Run' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Request context' })).toBeTruthy();
      expect(within(sidebar).queryByRole('button', { name: 'Request context' })).toBeNull();
      expect(within(sidebar).getByRole('link', { name: 'All tools' })).toBeTruthy();
      expect(await within(sidebar).findByRole('link', { name: 'search', exact: true })).toBeTruthy();
      expect(within(sidebar).getByRole('link', { name: 'weather', exact: true }).getAttribute('aria-current')).toBe(
        'page',
      );
      fireEvent.change(within(sidebar).getByRole('searchbox', { name: 'Search tools' }), {
        target: { value: 'search' },
      });
      expect(within(sidebar).queryByRole('link', { name: 'weather', exact: true })).toBeNull();
      expect(screen.getAllByRole('button', { name: 'Run' })).toHaveLength(1);
    });
  });
  describe('when running a tool from its playground', () => {
    it('sends the form input and displays the response in the workspace', async () => {
      const onExecute = vi.fn<(input: unknown) => void>();
      server.use(
        http.get(`${BASE_URL}/api/tools/weather`, () => HttpResponse.json(availableTools.weather)),
        http.post(`${BASE_URL}/api/tools/weather/execute`, async ({ request }) => {
          onExecute(await request.json());
          return HttpResponse.json({ temperature: 21 });
        }),
      );
      renderAt('/tools/weather');
      await screen.findByRole('complementary', { name: 'Tools navigation' });
      fireEvent.change(await screen.findByRole('textbox', { name: /city/i }), { target: { value: 'Paris' } });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      const result = screen.getByRole('region', { name: 'Tool result' });
      expect(await within(result).findByText('Success')).toBeTruthy();
      expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ data: { city: 'Paris' } }));
      expect(result.textContent).toContain('21');
    });
  });
  describe('when opening an older agent tool URL', () => {
    it('keeps the tool selected in the agent drawer', async () => {
      const router = createMemoryRouter(routes, {
        initialEntries: ['/agents/weather/tools/search?resourceId=example'],
      });
      await waitFor(() => expect(router.state.location.pathname).toBe('/agents/weather/threads/new'));
      expect(new URLSearchParams(router.state.location.search).get('tool')).toBe('search');
      expect(new URLSearchParams(router.state.location.search).get('resourceId')).toBe('example');
      router.dispose();
    });
  });
  describe('when opening an older MCP tool URL', () => {
    it('keeps the tool selected in the server drawer', async () => {
      const router = createMemoryRouter(routes, { initialEntries: ['/mcps/legacy/tools/echo'] });
      await waitFor(() => expect(router.state.location.pathname).toBe('/mcps/legacy'));
      expect(new URLSearchParams(router.state.location.search).get('tool')).toBe('echo');
      router.dispose();
    });
  });
  describe('when testing a processor', () => {
    it('runs from the contextual sidebar and shows the response in the main pane', async () => {
      const execute = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/processors`, () => HttpResponse.json(availableProcessors)),
        http.get(`${BASE_URL}/api/processors/redactor`, () => HttpResponse.json(redactorDetail)),
        http.post(`${BASE_URL}/api/processors/redactor/execute`, async ({ request }) => {
          execute(await request.json());
          return HttpResponse.json(processorSuccess);
        }),
      );
      renderAt('/processors/redactor');
      const sidebar = await screen.findByRole('complementary', { name: 'Processors navigation' });
      const input = await within(sidebar).findByRole('textbox', { name: 'Test message' });
      fireEvent.change(input, { target: { value: 'A private message' } });
      fireEvent.click(within(sidebar).getByRole('button', { name: 'Run processor' }));
      await waitFor(() =>
        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            phase: 'input',
            messages: [
              expect.objectContaining({
                role: 'user',
                content: { format: 2, parts: [{ type: 'text', text: 'A private message' }] },
              }),
            ],
          }),
        ),
      );
      const result = await screen.findByRole('region', { name: 'Processor result' });
      expect(await within(result).findByText('Success')).toBeTruthy();
      expect(sidebar.contains(result)).toBe(false);
      expect(within(sidebar).queryByRole('searchbox')).toBeNull();
    });
  });
  describe('when selecting an output phase and agent configuration', () => {
    it('sends the selected configuration and assistant message to the processor', async () => {
      const execute = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/processors/redactor`, () => HttpResponse.json(redactorDetail)),
        http.post(`${BASE_URL}/api/processors/redactor/execute`, async ({ request }) => {
          execute(await request.json());
          return HttpResponse.json(processorSuccess);
        }),
      );
      renderAt('/processors/redactor');
      fireEvent.click(await screen.findByRole('combobox', { name: 'Phase' }));
      await selectOption('outputStep');
      fireEvent.click(screen.getByRole('combobox', { name: 'Agent configuration' }));
      await selectOption('Support Agent (output)');
      fireEvent.click(screen.getByRole('button', { name: 'Run processor' }));
      await waitFor(() =>
        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            phase: 'outputStep',
            agentId: 'support-agent',
            messages: [expect.objectContaining({ role: 'assistant' })],
          }),
        ),
      );
    });
  });
  describe('when a processor cannot be run manually', () => {
    it.each(['outputStream', 'llmRequest'])('disables execution for %s and explains why', async phase => {
      server.use(http.get(`${BASE_URL}/api/processors/redactor`, () => HttpResponse.json(redactorDetail)));
      renderAt('/processors/redactor');
      fireEvent.click(await screen.findByRole('combobox', { name: 'Phase' }));
      await selectOption(phase);
      expect(screen.getByRole('button', { name: 'Run processor' }).hasAttribute('disabled')).toBe(true);
      expect(screen.getByText(/cannot be executed directly/)).toBeTruthy();
    });
  });
  describe('when a processor trips a guardrail', () => {
    it('keeps the tripwire reason available with the result', async () => {
      server.use(
        http.get(`${BASE_URL}/api/processors/redactor`, () => HttpResponse.json(redactorDetail)),
        http.post(`${BASE_URL}/api/processors/redactor/execute`, () => HttpResponse.json(processorTripwire)),
      );
      renderAt('/processors/redactor');
      fireEvent.click(await screen.findByRole('button', { name: 'Run processor' }));
      const result = screen.getByRole('region', { name: 'Processor result' });
      expect(await within(result).findByText('Private data detected')).toBeTruthy();
      expect(within(result).getByText('Tripwire triggered')).toBeTruthy();
    });
  });
  describe('when a user can read but cannot execute processors', () => {
    it('keeps the controls visible with a disabled execution button', async () => {
      server.use(
        authHandler({ ...adminSidebarCapabilities, access: { roles: ['reader'], permissions: ['processors:read'] } }),
        http.get(`${BASE_URL}/api/processors/redactor`, () => HttpResponse.json(redactorDetail)),
      );
      renderAt('/processors/redactor');
      const button = await screen.findByRole('button', { name: 'Run processor' });
      expect(button.hasAttribute('disabled')).toBe(true);
      expect(screen.getByText("You don't have permission to execute processors.")).toBeTruthy();
    });
  });
  describe('when a user only has access to tools', () => {
    it('loads the tool collection without requesting agents', async () => {
      const agents = vi.fn();
      server.use(
        authHandler({ ...adminSidebarCapabilities, access: { roles: ['tool-user'], permissions: ['tools:read'] } }),
        http.get(`${BASE_URL}/api/tools`, () => HttpResponse.json(availableTools)),
        http.get(`${BASE_URL}/api/agents`, () => {
          agents();
          return HttpResponse.json({}, { status: 403 });
        }),
      );
      renderAt('/tools');
      await screen.findByText('weather');
      const rail = await findOnlyRail();
      expect(within(rail).getByRole('link', { name: 'Tools' }).getAttribute('aria-current')).toBe('page');
      expect(within(rail).queryByRole('link', { name: 'Agents' })).toBeNull();
      expect(agents).not.toHaveBeenCalled();
    });
  });
  describe('when opening an MCP server', () => {
    it('shows servers and the selected server’s tools in one contextual sidebar', async () => {
      server.use(
        http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [legacyServer] })),
        http.get(`${BASE_URL}/api/mcp/legacy/tools`, () => HttpResponse.json(toolList)),
      );
      renderAt('/mcps/legacy');
      const sidebar = await screen.findByRole('complementary', { name: 'MCP navigation' });
      const tool = await within(sidebar).findByRole('link', { name: 'echo' });
      expect(tool.getAttribute('href')).toBe('/mcps/legacy?tool=echo');
      expect(within(sidebar).getByRole('link', { name: 'Legacy Server' }).getAttribute('aria-current')).toBe('page');
      expect(within(sidebar).queryByRole('link', { name: 'Agents', exact: true })).toBeNull();
    });
  });
  describe('when loading the agents collection', () => {
    it('opens the overview from its sidebar card and keeps every agent listed below it', async () => {
      renderAt('/agents');
      const sidebar = await screen.findByRole('complementary', { name: 'Agents navigation' });
      const overviewCard = await within(sidebar).findByRole('link', { name: /^Overview/ });
      expect(overviewCard.getAttribute('href')).toBe('/agents');
      expect(overviewCard.getAttribute('aria-current')).toBe('page');
      expect(within(sidebar).queryByRole('button', { name: 'Expand agents' })).toBeNull();
      const list = await within(sidebar).findByRole('navigation', { name: 'Agents list' });
      expect(within(list).getByRole('link', { name: 'Research Agent' }).getAttribute('href')).toBe(
        '/agents/researcher/overview',
      );
      expect(await screen.findByRole('heading', { name: 'Agents' })).toBeTruthy();
      expect(within(sidebar).queryByRole('link', { name: 'Workflows' })).toBeNull();
      expect(within(sidebar).queryByRole('link', { name: 'Tools' })).toBeNull();
    });
    it('moves a pinned agent above the rest', async () => {
      renderAt('/agents');
      const sidebar = await screen.findByRole('complementary', { name: 'Agents navigation' });
      fireEvent.click(await within(sidebar).findByRole('button', { name: 'Pin Analysis Agent' }));
      const list = within(sidebar).getByRole('navigation', { name: 'Agents list' });
      expect(
        within(list)
          .getAllByRole('link')
          .map(link => link.textContent)[0],
      ).toBe('Analysis Agent');
      expect(within(sidebar).getByRole('button', { name: 'Unpin Analysis Agent' })).toBeTruthy();
    });
  });
  describe('when loading the workflows collection', () => {
    it('opens the workflows overview, each row opening its workflow', async () => {
      renderAt('/workflows');
      expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeTruthy();
      expect((await screen.findByRole('link', { name: 'Schedules' })).getAttribute('href')).toBe(
        '/workflows/schedules',
      );
      expect((await screen.findByRole('link', { name: new RegExp(WORKFLOW_ID) })).getAttribute('href')).toBe(
        `/workflows/${WORKFLOW_ID}`,
      );
      expect(screen.queryByRole('complementary', { name: 'Workflow navigation' })).toBeNull();
    });
    it('leads from an open workflow back to the overview instead of expanding the switcher', async () => {
      renderAt(`/workflows/${WORKFLOW_ID}/graph`);
      const sidebar = await screen.findByRole('complementary', { name: 'Workflow navigation' });
      expect(within(sidebar).getByRole('link', { name: 'All workflows' }).getAttribute('href')).toBe('/workflows');
      expect(within(sidebar).queryByRole('button', { name: 'Expand workflow list' })).toBeNull();
    });
  });
  describe('when loading a workflow graph directly', () => {
    it('places workflow navigation and run controls in a single sidebar', async () => {
      renderAt(`/workflows/${WORKFLOW_ID}/graph`);
      await screen.findByRole('tab', { name: 'Graph' });
      const rail = screen.getByRole('complementary', { name: 'Studio navigation' });
      expect(within(rail).getByRole('link', { name: 'Workflows' }).getAttribute('aria-current')).toBe('page');
      expect(screen.queryByRole('complementary', { name: 'Browse navigation' })).toBeNull();
      const sidebar = screen.getByRole('complementary', { name: 'Workflow navigation' });
      expect(await within(sidebar).findByTestId('workflow-information-panel')).toBeTruthy();
      expect(within(sidebar).getByLabelText('Switch workflow').textContent).toContain(WORKFLOW_ID);
      expect(screen.getAllByTestId('workflow-information-panel')).toHaveLength(1);
    });
  });
  describe('when creating a prompt', () => {
    it('keeps the prompt list and configuration in one sidebar', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)));
      renderAt('/cms/prompts/create');
      const sidebar = await screen.findByRole('complementary', { name: 'Prompt navigation' });
      expect(await within(sidebar).findByRole('link', { name: 'Prompt Block 1' })).toBeTruthy();
      expect(await within(sidebar).findByRole('textbox', { name: /Name/ })).toBeTruthy();
      expect(within(sidebar).getByRole('link', { name: 'Create prompt' }).getAttribute('aria-current')).toBe('page');
    });
  });
});
