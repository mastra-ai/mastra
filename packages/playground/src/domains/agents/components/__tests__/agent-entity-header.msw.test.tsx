// @vitest-environment jsdom
import type {
  GetAgentResponse,
  GetSystemPackagesResponse,
  ListAgentVersionsResponse,
  StoredAgentResponse,
} from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes, ReactNode, Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentSidebarVersionHeader } from '../agent-sidebar-version-header';
import { agentVersionsResponse } from './fixtures/agent-versions';
import { systemPackages } from './fixtures/channels';
import { v2Agent } from './fixtures/composer-model-settings';
import { AgentSidebarViewProvider, useAgentSidebarView } from '@/domains/agents/context/agent-sidebar-view-context';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

const storedAgentResponse = {
  id: AGENT_ID,
  status: 'published',
  activeVersionId: 'version-1',
  createdAt: '2026-06-21T10:00:00.000Z',
  updatedAt: '2026-06-22T10:00:00.000Z',
  name: 'Test Agent',
  instructions: 'You are a test agent.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  tools: {},
  workflows: {},
  agents: {},
  integrationTools: {},
  mcpClients: {},
  scorers: {},
  skills: {},
  requestContextSchema: { type: 'object', properties: {} },
} satisfies StoredAgentResponse;

function StubLink({
  children,
  to,
  href,
  ref,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; ref?: Ref<HTMLAnchorElement> }) {
  return (
    <a ref={ref} href={to ?? href} {...props}>
      {children}
    </a>
  );
}

const navigateSpy = vi.fn();

const paths = {
  agentLink: (agentId: string) => `/agents/${agentId}/chat/new`,
  agentsLink: () => '/agents',
  agentToolLink: (agentId: string, toolId: string) => `/agents/${agentId}/tools/${toolId}`,
  agentSkillLink: (agentId: string, skillName: string) => `/agents/${agentId}/skills/${skillName}`,
  agentThreadLink: (agentId: string, threadId: string) => `/agents/${agentId}/chat/${threadId}`,
  agentNewThreadLink: (agentId: string) => `/agents/${agentId}/chat/new`,
  agentVersionThreadLink: (agentId: string, versionId: string, threadId: string) =>
    `/agents/${agentId}/versions/${versionId}/chat/${threadId}`,
  agentVersionNewThreadLink: (agentId: string, versionId: string) =>
    `/agents/${agentId}/versions/${versionId}/chat/new`,
  workflowsLink: () => '/workflows',
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
  schedulesLink: () => '/schedules',
  scheduleLink: (scheduleId: string) => `/schedules/${scheduleId}`,
  networkLink: (networkId: string) => `/networks/${networkId}`,
  networkNewThreadLink: (networkId: string) => `/networks/${networkId}/chat/new`,
  networkThreadLink: (networkId: string, threadId: string) => `/networks/${networkId}/chat/${threadId}`,
  scorerLink: (scorerId: string) => `/scorers/${scorerId}`,
  cmsScorersCreateLink: () => '/cms/scorers/create',
  cmsScorerEditLink: (scorerId: string) => `/cms/scorers/${scorerId}/edit`,
  cmsAgentCreateLink: () => '/cms/agents/create',
  promptBlockLink: (promptBlockId: string) => `/prompts/${promptBlockId}`,
  promptBlocksLink: () => '/prompts',
  cmsPromptBlockCreateLink: () => '/cms/prompts/create',
  cmsPromptBlockEditLink: (promptBlockId: string) => `/cms/prompts/${promptBlockId}/edit`,
  toolLink: (toolId: string) => `/tools/${toolId}`,
  skillLink: (skillName: string) => `/skills/${skillName}`,
  workspacesLink: () => '/workspaces',
  workspaceLink: (workspaceId?: string) => `/workspaces/${workspaceId ?? ''}`,
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

function SidebarViewProbe() {
  const { selectedView } = useAgentSidebarView();
  return <span data-testid="sidebar-view">{selectedView}</span>;
}

function SidebarVersionHeaderHarness({ agentVersionId, threadId }: { agentVersionId?: string; threadId?: string }) {
  const { openVersions } = useAgentSidebarView();
  return (
    <AgentSidebarVersionHeader
      agentId={AGENT_ID}
      agentVersionId={agentVersionId}
      threadId={threadId}
      onCreateVersion={openVersions}
    />
  );
}

function renderWithProviders(
  children: ReactNode,
  { showSidebarViewProbe = false }: { showSidebarViewProbe?: boolean } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={navigateSpy} paths={paths}>
          <AgentSidebarViewProvider>
            {children}
            {showSidebarViewProbe ? <SidebarViewProbe /> : null}
          </AgentSidebarViewProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function useHandlers({
  agent = v2Agent,
  packages = systemPackages,
  versions,
  storedAgent = storedAgentResponse,
}: {
  agent?: GetAgentResponse;
  packages?: GetSystemPackagesResponse;
  versions?: ListAgentVersionsResponse;
  storedAgent?: StoredAgentResponse | null;
}) {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(agent)),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packages)),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () =>
      storedAgent ? HttpResponse.json(storedAgent) : HttpResponse.json({ message: 'Not found' }, { status: 404 }),
    ),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () =>
      HttpResponse.json(versions ?? { versions: [], total: 0, page: 1, perPage: 20, hasMore: false }),
    ),
  );
}

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

describe('AgentSidebarVersionHeader', () => {
  it('shows disabled version discoverability when Editor is not configured', async () => {
    useHandlers({});

    renderWithProviders(<SidebarVersionHeaderHarness threadId="thread-1" />);

    const versions = (await screen.findAllByRole('button', { name: /versions/i })).find(
      element => element.tagName === 'BUTTON',
    );
    expect(versions).toBeDefined();
    expect(versions!.getAttribute('aria-disabled')).toBe('true');

    const trigger = versions!.closest('[data-base-ui-tooltip-trigger]') ?? versions!.parentElement ?? versions!;
    fireEvent.focus(trigger);
    fireEvent.pointerEnter(trigger);
    fireEvent.mouseMove(trigger);
    fireEvent.mouseOver(trigger);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Configure @mastra/editor');
    expect(
      within(tooltip)
        .getByRole('link', { name: /editor docs/i })
        .getAttribute('href'),
    ).toBe('https://mastra.ai/docs/editor/overview');
  });

  it('shows a create action when no versions exist', async () => {
    useHandlers({ agent: { ...v2Agent, source: 'code' }, packages: { ...systemPackages, cmsEnabled: true } });

    renderWithProviders(<SidebarVersionHeaderHarness threadId="thread-1" />, { showSidebarViewProbe: true });

    // Even with no saved versions the combobox is the entry point; "Create version" lives in its footer.
    fireEvent.click(await screen.findByRole('combobox', { name: /switch test agent version/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create version/i }));

    expect(screen.getByTestId('sidebar-view').textContent).toBe('versions');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('explains when the effective default agent is data-backed', async () => {
    const agentWithPublishedVersion: GetAgentResponse = {
      ...v2Agent,
      source: 'code',
    };

    useHandlers({
      agent: agentWithPublishedVersion,
      packages: { ...systemPackages, cmsEnabled: true },
      versions: agentVersionsResponse,
    });

    renderWithProviders(<SidebarVersionHeaderHarness threadId="thread-1" />);

    const versionSwitch = await screen.findByRole('combobox', { name: /switch test agent version/i });
    expect(versionSwitch.textContent).toContain('Default');
    expect(versionSwitch.textContent).toContain('Published v1');
    expect(screen.queryByText('Default uses Editor data')).toBeNull();

    const sourceBadge = within(versionSwitch).getByText('Published v1');
    fireEvent.focus(sourceBadge);
    fireEvent.pointerEnter(sourceBadge);
    fireEvent.mouseMove(sourceBadge);
    fireEvent.mouseOver(sourceBadge);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Default uses Editor data');
    expect(tooltip.textContent).toContain('code-only deploy');
  });

  it('switches to the selected explicit version route from the sidebar dropdown', async () => {
    const agentWithPublishedVersion: GetAgentResponse = {
      ...v2Agent,
      source: 'stored',
      activeVersionId: 'version-1',
    };

    useHandlers({
      agent: agentWithPublishedVersion,
      packages: { ...systemPackages, cmsEnabled: true },
      versions: agentVersionsResponse,
    });

    renderWithProviders(<SidebarVersionHeaderHarness threadId="thread-1" />);

    fireEvent.click(await screen.findByRole('combobox', { name: /switch test agent version/i }));
    const versionTwo = await screen.findByRole('option', { name: /v2/ });
    fireEvent.pointerDown(versionTwo, { pointerType: 'mouse' });
    fireEvent.click(versionTwo, { detail: 1 });

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/agents/agent-1/versions/version-2/chat/thread-1');
    });
  });

  it('keeps the new thread route when switching versions before the thread is created', async () => {
    const agentWithPublishedVersion: GetAgentResponse = {
      ...v2Agent,
      source: 'stored',
      activeVersionId: 'version-1',
    };

    useHandlers({
      agent: agentWithPublishedVersion,
      packages: { ...systemPackages, cmsEnabled: true },
      versions: agentVersionsResponse,
    });

    renderWithProviders(<SidebarVersionHeaderHarness threadId="new" />);

    fireEvent.click(await screen.findByRole('combobox', { name: /switch test agent version/i }));
    const versionTwo = await screen.findByRole('option', { name: /v2/ });
    fireEvent.pointerDown(versionTwo, { pointerType: 'mouse' });
    fireEvent.click(versionTwo, { detail: 1 });

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/agents/agent-1/versions/version-2/chat/new');
    });
  });

  it('can return from an explicit version route to the default agent route', async () => {
    const agentWithPublishedVersion: GetAgentResponse = {
      ...v2Agent,
      source: 'stored',
      activeVersionId: 'version-1',
    };

    useHandlers({
      agent: agentWithPublishedVersion,
      packages: { ...systemPackages, cmsEnabled: true },
      versions: agentVersionsResponse,
    });

    renderWithProviders(<SidebarVersionHeaderHarness agentVersionId="version-2" threadId="thread-1" />);

    fireEvent.click(await screen.findByRole('combobox', { name: /switch test agent version/i }));
    const defaultAgent = await screen.findByRole('option', { name: /Test Agent/ });
    fireEvent.pointerDown(defaultAgent, { pointerType: 'mouse' });
    fireEvent.click(defaultAgent, { detail: 1 });

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/agents/agent-1/chat/thread-1');
    });
  });

  it('publishes the selected explicit version when it is not active yet', async () => {
    const agentWithPublishedVersion: GetAgentResponse = {
      ...v2Agent,
      source: 'stored',
      activeVersionId: 'version-1',
    };
    let activatedVersionId: string | undefined;

    useHandlers({
      agent: agentWithPublishedVersion,
      packages: { ...systemPackages, cmsEnabled: true },
      versions: agentVersionsResponse,
    });
    server.use(
      http.post(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions/:versionId/activate`, ({ params }) => {
        activatedVersionId = String(params.versionId);
        return HttpResponse.json({
          success: true,
          message: 'Version activated',
          activeVersionId: activatedVersionId,
        });
      }),
    );

    renderWithProviders(<SidebarVersionHeaderHarness agentVersionId="version-2" threadId="thread-1" />);

    const publish = await screen.findByRole('button', { name: /publish v2/i });
    expect(publish.textContent).toBe('');
    expect(screen.queryByRole('button', { name: /about publishing versions/i })).toBeNull();

    fireEvent.click(publish);

    await waitFor(() => {
      expect(activatedVersionId).toBe('version-2');
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /publish v2/i })).toBeNull();
    });
    const versionSwitch = screen.getByRole('combobox', { name: /switch test agent version/i });
    expect(versionSwitch.textContent).toContain('v2');
    expect(versionSwitch.textContent).toContain('Published');
  });

  it('unpublishes the active version and shows the default route as code-backed', async () => {
    let activeVersionId: string | null = 'version-1';
    let unpublishRequested = false;

    useHandlers({
      agent: {
        ...v2Agent,
        source: 'stored',
        activeVersionId: 'version-1',
      },
      packages: { ...systemPackages, cmsEnabled: true },
      versions: agentVersionsResponse,
    });
    server.use(
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () =>
        HttpResponse.json({
          ...v2Agent,
          source: activeVersionId ? 'stored' : 'code',
          activeVersionId: activeVersionId ?? undefined,
        }),
      ),
      http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () =>
        HttpResponse.json({
          ...storedAgentResponse,
          status: activeVersionId ? 'published' : 'draft',
          activeVersionId,
        } satisfies StoredAgentResponse),
      ),
      http.post(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions/unpublish`, () => {
        activeVersionId = null;
        unpublishRequested = true;

        return HttpResponse.json({
          success: true,
          message: 'Published version cleared',
          activeVersionId: null,
        });
      }),
    );

    renderWithProviders(<SidebarVersionHeaderHarness threadId="thread-1" />);

    const unpublish = await screen.findByRole('button', { name: /unpublish version/i });
    fireEvent.click(unpublish);

    await waitFor(() => {
      expect(unpublishRequested).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /unpublish version/i })).toBeNull();
    });

    const versionSwitch = screen.getByRole('combobox', { name: /switch test agent version/i });
    expect(versionSwitch.textContent).toContain('Default');
    expect(versionSwitch.textContent).toContain('Code');
    expect(versionSwitch.textContent).not.toContain('Published v1');
  });

  it('opens the versions panel from the sidebar editor icon', async () => {
    const agentWithPublishedVersion: GetAgentResponse = {
      ...v2Agent,
      source: 'stored',
      activeVersionId: 'version-1',
    };

    useHandlers({
      agent: agentWithPublishedVersion,
      packages: { ...systemPackages, cmsEnabled: true },
      versions: agentVersionsResponse,
    });

    renderWithProviders(<SidebarVersionHeaderHarness threadId="thread-1" />, { showSidebarViewProbe: true });

    fireEvent.click(await screen.findByRole('button', { name: /open agent editor/i }));

    expect(screen.getByTestId('sidebar-view').textContent).toBe('versions');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('keeps the published version selectable as an exact version route', async () => {
    const agentWithPublishedVersion: GetAgentResponse = {
      ...v2Agent,
      source: 'stored',
      activeVersionId: 'version-1',
    };

    useHandlers({
      agent: agentWithPublishedVersion,
      packages: { ...systemPackages, cmsEnabled: true },
      versions: agentVersionsResponse,
    });

    renderWithProviders(<SidebarVersionHeaderHarness threadId="thread-1" />);

    fireEvent.click(await screen.findByRole('combobox', { name: /switch test agent version/i }));
    const options = await screen.findAllByRole('option');
    const publishedVersion = options.find(option => option.textContent?.startsWith('v1'));
    if (!publishedVersion) {
      throw new Error('Expected published v1 option to be rendered');
    }
    fireEvent.pointerDown(publishedVersion, { pointerType: 'mouse' });
    fireEvent.click(publishedVersion, { detail: 1 });

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/agents/agent-1/versions/version-1/chat/thread-1');
    });
  });

  it('marks an explicit published version route as published', async () => {
    const agentWithPublishedVersion: GetAgentResponse = {
      ...v2Agent,
      source: 'stored',
      activeVersionId: 'version-1',
    };

    useHandlers({
      agent: agentWithPublishedVersion,
      packages: { ...systemPackages, cmsEnabled: true },
      versions: agentVersionsResponse,
    });

    renderWithProviders(<SidebarVersionHeaderHarness agentVersionId="version-1" threadId="thread-1" />);

    const versionSwitch = await screen.findByRole('combobox', { name: /switch test agent version/i });
    expect(versionSwitch.textContent).toContain('v1');
    expect(versionSwitch.textContent).toContain('Published');
    expect(screen.queryByRole('button', { name: /publish v1/i })).toBeNull();
  });
});
