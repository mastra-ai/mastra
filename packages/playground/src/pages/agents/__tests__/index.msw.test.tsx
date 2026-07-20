// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import AgentsPage from '..';
import {
  agentsList,
  agentsListWithLongInstructions,
  agentsListWithLongName,
  agentsListWithoutConfiguration,
  agentsListWithoutInstructions,
  agentsListWithUnicodeBoundaryInstructions,
  builderDisabled,
  longAgentInstructions,
  longAgentName,
  unicodeBoundaryInstructions,
} from './fixtures/agents';
import type { AuthCapabilities } from '@/domains/auth/types';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const StubLink = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  function StubLink(props, ref) {
    return <a ref={ref} {...props} />;
  },
);

const paths = {
  agentLink: (agentId: string) => `/agents/${agentId}`,
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
  workspaceLink: (workspaceId?: string) => `/workspaces/${workspaceId ?? ''}`,
  workspaceSkillLink: (skillName: string) => `/workspace/skills/${skillName}`,
  processorsLink: () => '/processors',
  processorLink: (processorId: string) => `/processors/${processorId}`,
  mcpServerLink: (serverId: string) => `/mcps/${serverId}`,
  mcpServerToolLink: (serverId: string, toolId: string) => `/mcps/${serverId}/${toolId}`,
  workflowRunLink: (workflowId: string, runId: string) => `/workflows/${workflowId}/runs/${runId}`,
  datasetLink: (datasetId: string) => `/datasets/${datasetId}`,
  datasetItemLink: (datasetId: string, itemId: string) => `/datasets/${datasetId}/items/${itemId}`,
  datasetExperimentLink: (datasetId: string, experimentId: string) =>
    `/datasets/${datasetId}/experiments/${experimentId}`,
  experimentLink: (experimentId: string) => `/experiments/${experimentId}`,
} satisfies LinkComponentProviderProps['paths'];

const authDisabled = { enabled: false } satisfies AuthCapabilities;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
            <AgentsPage />
          </LinkComponentProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function useAgentsResponse(response = agentsList) {
  server.use(
    http.get(`${BASE_URL}/api/agents`, () => HttpResponse.json(response)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderDisabled)),
  );
}

afterEach(() => cleanup());

describe('Agents page', () => {
  describe('when list view is selected', () => {
    it('shows the agent purpose in the table', async () => {
      useAgentsResponse();
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'List view' }));

      expect(await screen.findByText('Purpose')).not.toBeNull();
      expect(await screen.findByText('Find reliable sources and summarize the evidence.')).not.toBeNull();
    });

    it('shows the provider identity without the model ID', async () => {
      useAgentsResponse();
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'List view' }));

      expect(await screen.findByText('Provider')).not.toBeNull();
      expect(await screen.findByRole('img', { name: 'openai provider' })).not.toBeNull();
      expect(screen.queryByText('gpt-4o-mini')).toBeNull();
    });

    it('keeps the model ID in the agent preview', async () => {
      useAgentsResponse();
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'List view' }));

      const previewButton = await screen.findByRole('button', { name: 'Preview Research Agent' });
      expect(screen.queryByText('gpt-4o-mini')).toBeNull();

      fireEvent.click(previewButton);

      const preview = await screen.findByRole('dialog', { name: 'Research Agent' });
      expect(within(preview).getByText('gpt-4o-mini')).not.toBeNull();
      expect(within(preview).getByRole('img', { name: 'openai provider' })).not.toBeNull();
    });

    it('shows accessible fallbacks when preview configuration is absent', async () => {
      useAgentsResponse(agentsListWithoutConfiguration);
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Preview Research Agent' }));

      const preview = await screen.findByRole('dialog', { name: 'Research Agent' });
      const instructions = within(preview).getByLabelText('Research Agent instructions');
      instructions.focus();

      expect(within(preview).getByText('No model configured')).not.toBeNull();
      expect(instructions.textContent).toBe('No instructions provided.');
      expect(document.activeElement).toBe(instructions);
      expect(within(preview).getByText('0 workflows')).not.toBeNull();
      expect(within(preview).getByText('0 agents')).not.toBeNull();
      expect(within(preview).getByText('0 tools')).not.toBeNull();
    });
  });

  describe('when view controls are shown', () => {
    it('shows list before compact', async () => {
      useAgentsResponse();
      renderPage();

      const viewControls = await screen.findByRole('group', { name: 'Agents view' });
      const listButton = within(viewControls).getByRole('button', { name: 'List view' });
      const compactButton = within(viewControls).getByRole('button', { name: 'Compact view' });

      expect(within(viewControls).getAllByRole('button')).toEqual([listButton, compactButton]);
    });

    it('selects list view by default', async () => {
      useAgentsResponse();
      renderPage();

      const listButton = await screen.findByRole('button', { name: 'List view' });

      expect(listButton.getAttribute('aria-pressed')).toBe('true');
      expect(await screen.findByText('Purpose')).not.toBeNull();
    });
  });

  describe('when compact view is selected', () => {
    it('shows the agents in a compact grid', async () => {
      useAgentsResponse();
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Compact view' }));

      expect(await screen.findByRole('list', { name: 'Agents compact grid' })).not.toBeNull();
      expect((await screen.findByRole('link', { name: /Research Agent/ })).getAttribute('href')).toBe(
        '/agents/researcher',
      );
    });

    it('uses the instruction preview as the primary card description', async () => {
      useAgentsResponse();
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Compact view' }));

      const link = await screen.findByRole('link', { name: 'Open Research Agent' });
      const descriptionIds = link.getAttribute('aria-describedby')?.split(' ') ?? [];
      const primaryDescription = document.getElementById(descriptionIds[0] ?? '');

      expect(primaryDescription?.textContent).toBe('Find reliable sources and summarize the evidence.');
    });

    it('describes provider and capability labels without the model ID', async () => {
      useAgentsResponse();
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Compact view' }));

      const link = await screen.findByRole('link', { name: 'Open Research Agent' });
      const descriptionIds = link.getAttribute('aria-describedby')?.split(' ') ?? [];
      const metadata = document.getElementById(descriptionIds[1] ?? '');

      expect(metadata?.textContent).toBe('openai provider. 0 workflows, 0 agents, 1 tool.');
      expect(within(link).queryByText('gpt-4o-mini')).toBeNull();
    });
  });

  describe('when a compact card has a long agent name', () => {
    it('keeps the complete name available from the constrained heading', async () => {
      useAgentsResponse(agentsListWithLongName);
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Compact view' }));

      const heading = await screen.findByTitle(longAgentName);

      expect(heading.textContent).toBe(longAgentName);
    });
  });

  describe('when a compact card has no instructions', () => {
    it('shows an instructional fallback', async () => {
      useAgentsResponse(agentsListWithoutInstructions);
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Compact view' }));

      const link = await screen.findByRole('link', { name: 'Open Research Agent' });

      expect(within(link).getByText('No instructions provided.')).not.toBeNull();
    });
  });

  describe('when a compact card has long instructions', () => {
    it('shows a word-safe preview while retaining the complete instructions', async () => {
      useAgentsResponse(agentsListWithLongInstructions);
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Compact view' }));

      const description = await screen.findByTitle(longAgentInstructions);

      expect(description.textContent).toBe(
        'Investigate every available source and reconcile contradictory evidence before…',
      );
      expect(description.getAttribute('title')).toBe(longAgentInstructions);
    });
  });

  describe('when a compact card truncates a multi-code-point character', () => {
    it('keeps the complete grapheme in the instruction preview', async () => {
      useAgentsResponse(agentsListWithUnicodeBoundaryInstructions);
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Compact view' }));

      const description = await screen.findByTitle(unicodeBoundaryInstructions);

      expect(description.textContent).toBe(`${'a'.repeat(79)}👩‍💻…`);
    });
  });

  describe('when a list row has a long agent name', () => {
    it('keeps the complete name available from the constrained cell', async () => {
      useAgentsResponse(agentsListWithLongName);
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'List view' }));
      const name = await screen.findByTitle(longAgentName);

      expect(name.textContent).toBe(longAgentName);
    });
  });

  describe('when agents are sorted alphabetically', () => {
    it('shows agents from A to Z in the selected card view', async () => {
      useAgentsResponse();
      renderPage();

      fireEvent.click(await screen.findByRole('combobox', { name: 'Sort agents' }));
      const option = await screen.findByRole('option', { name: 'Name: A–Z' });
      fireEvent.pointerDown(option, { pointerType: 'mouse' });
      fireEvent.click(option, { detail: 1 });
      fireEvent.click(screen.getByRole('button', { name: 'Compact view' }));

      const grid = screen.getByRole('list', { name: 'Agents compact grid' });
      const cardLabels = within(grid)
        .getAllByRole('link')
        .map(link => link.getAttribute('aria-label'));

      expect(cardLabels).toEqual(['Open Analysis Agent', 'Open Research Agent']);
    });

    it('shows agents from Z to A in the selected card view', async () => {
      useAgentsResponse();
      renderPage();

      fireEvent.click(await screen.findByRole('combobox', { name: 'Sort agents' }));
      const option = await screen.findByRole('option', { name: 'Name: Z–A' });
      fireEvent.pointerDown(option, { pointerType: 'mouse' });
      fireEvent.click(option, { detail: 1 });
      fireEvent.click(screen.getByRole('button', { name: 'Compact view' }));

      const grid = screen.getByRole('list', { name: 'Agents compact grid' });
      const cardLabels = within(grid)
        .getAllByRole('link')
        .map(link => link.getAttribute('aria-label'));

      expect(cardLabels).toEqual(['Open Research Agent', 'Open Analysis Agent']);
    });
  });
});
