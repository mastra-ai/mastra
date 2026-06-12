// @vitest-environment jsdom
import type { DatasetExperiment } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockOnlyExperiment, replayExperiment } from '../../__tests__/fixtures/tool-replay';
import { ExperimentTopArea } from '../experiment-top-area';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

/** Strict replay run — the marker carries the full policy triple. */
const strictReplayExperiment: DatasetExperiment = {
  ...replayExperiment,
  id: 'exp-replay-strict',
  metadata: { toolReplay: { fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'strict' } },
};

const StubLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }>(
  ({ children, to, href, ...props }, ref) => (
    <a ref={ref} href={to ?? href} {...props}>
      {children}
    </a>
  ),
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

function renderTopArea(experiment: DatasetExperiment) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
          <ExperimentTopArea experiment={experiment} />
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

beforeEach(() => {
  // Target-name lookups the top area fires on mount.
  server.use(
    http.get(`${BASE_URL}/api/agents`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json({})),
  );
});

afterEach(cleanup);

describe('ExperimentTopArea tool replay row', () => {
  it('shows the full replay policy — source, on-miss, and matching', () => {
    renderTopArea(strictReplayExperiment);

    expect(screen.getByText('Tool replay')).toBeDefined();
    const sourceLink = screen.getByText('from exp-live · on miss: error · matching: strict');
    expect(sourceLink.closest('a')?.getAttribute('href')).toBe('/datasets/dataset-1/experiments/exp-live-1');
  });

  it('omits the matching segment when the marker has none (fifo default)', () => {
    renderTopArea(replayExperiment);

    expect(screen.getByText('from exp-live · on miss: error')).toBeDefined();
    expect(screen.queryByText(/matching:/)).toBeNull();
  });

  it('keeps the mock-only wording without inventing a matching policy', () => {
    renderTopArea(mockOnlyExperiment);

    expect(screen.getByText('mocked tools only')).toBeDefined();
    expect(screen.queryByText(/matching:/)).toBeNull();
  });
});
