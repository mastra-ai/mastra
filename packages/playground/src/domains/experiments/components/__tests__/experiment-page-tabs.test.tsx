// @vitest-environment jsdom
import type { DatasetExperiment, DatasetExperimentResult } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callFlowResult,
  expectationFailedResult,
  failedAtSetupExperiment,
  functionMockExperiment,
  listExperimentsResponse,
  listResultsResponse,
  mockOnlyExperiment,
  mockOnlyWithConfigsExperiment,
  strictVersionedReplayExperiment,
  triggerExperimentResponse,
} from '../../__tests__/fixtures/tool-replay';
import { ExperimentPageTabs } from '../experiment-page-tabs';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

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

const emptyScoresResponse = { scores: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } };

/**
 * Registers every GET the tabs fire for one experiment, plus the trigger POST
 * capture: experiments list (review items), per-run scores, the experiment's
 * own results (replay aggregates), and — for replay runs — the source
 * experiment's results and the recording's light trace.
 */
function useTabsHandlers(experiment: DatasetExperiment, results: DatasetExperimentResult[]) {
  const capture = vi.fn();
  server.use(
    http.get(`${BASE_URL}/api/datasets/dataset-1/experiments`, () => HttpResponse.json(listExperimentsResponse([]))),
    http.get(`${BASE_URL}/api/scores/run/${experiment.id}`, () => HttpResponse.json(emptyScoresResponse)),
    http.get(`${BASE_URL}/api/datasets/dataset-1/experiments/${experiment.id}/results`, () =>
      HttpResponse.json(listResultsResponse(results)),
    ),
    http.get(`${BASE_URL}/api/datasets/dataset-1/experiments/exp-live-1/results`, () =>
      HttpResponse.json(listResultsResponse([])),
    ),
    http.get(`${BASE_URL}/api/observability/traces/trace-src-1/light`, () =>
      HttpResponse.json({ traceId: 'trace-src-1', spans: [] }),
    ),
    http.post(`${BASE_URL}/api/datasets/dataset-1/experiments`, async ({ request }) => {
      capture(await request.json());
      return HttpResponse.json(triggerExperimentResponse);
    }),
  );
  return capture;
}

function renderTabs(experiment: DatasetExperiment, results: DatasetExperimentResult[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
          <MemoryRouter>
            <ExperimentPageTabs
              experimentId={experiment.id}
              datasetId="dataset-1"
              experiment={experiment}
              experimentStatus={experiment.status}
              results={results}
              isLoading={false}
            />
          </MemoryRouter>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

/** Features one result: Results tab → click its row by item id. */
async function featureResult(itemId: string) {
  fireEvent.click(screen.getByRole('tab', { name: 'Results' }));
  fireEvent.click((await screen.findByText(itemId)).closest('button')!);
}

afterEach(cleanup);

describe('ExperimentPageTabs setup failure', () => {
  it('explains a failed-at-setup experiment on the Summary tab', async () => {
    useTabsHandlers(failedAtSetupExperiment, []);
    renderTabs(failedAtSetupExperiment, []);

    expect(await screen.findByText('Failed at setup')).toBeDefined();
    expect(screen.getByText(/Tool replay source experiment 'exp-gone' was not found\./)).toBeDefined();
    expect(screen.getByText(/EXPERIMENT_TOOL_REPLAY_SOURCE_NOT_FOUND/)).toBeDefined();
    expect(screen.getByText('No items ran — fix the setup issue and trigger the experiment again.')).toBeDefined();
  });

  it('renders no notice for user-owned junk under the failureReason key', async () => {
    const junkExperiment: DatasetExperiment = {
      ...failedAtSetupExperiment,
      metadata: { failureReason: 'it broke' },
    };
    useTabsHandlers(junkExperiment, []);
    renderTabs(junkExperiment, []);

    // Anchor on the rendered tab chrome — the notice is gated synchronously.
    expect(await screen.findByRole('tab', { name: 'Summary' })).toBeDefined();
    expect(screen.queryByText('Failed at setup')).toBeNull();
  });

  it('renders no notice once results exist — the per-result errors take over', async () => {
    const failedWithResults: DatasetExperiment = { ...failedAtSetupExperiment, totalItems: 2 };
    useTabsHandlers(failedWithResults, [callFlowResult]);
    renderTabs(failedWithResults, [callFlowResult]);

    expect(await screen.findByRole('tab', { name: 'Summary' })).toBeDefined();
    expect(screen.queryByText('Failed at setup')).toBeNull();
  });
});

describe('ExperimentPageTabs re-run item with replay', () => {
  it('re-triggers one item with the exact policy of a strict replay run', async () => {
    const capture = useTabsHandlers(strictVersionedReplayExperiment, [callFlowResult]);
    renderTabs(strictVersionedReplayExperiment, [callFlowResult]);

    await featureResult('item-5');
    fireEvent.click(await screen.findByRole('button', { name: 'Re-run item with replay' }));

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    // The exact wire payload: same source, same on-miss policy, same strict
    // matching, same dataset and agent versions — narrowed to this one item.
    expect(capture.mock.calls[0][0]).toEqual({
      targetType: 'agent',
      targetId: 'support-agent',
      itemIds: ['item-5'],
      toolReplay: { fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'strict' },
      version: 1,
      agentVersion: 'agent-v2',
    });
  });

  it('keeps the re-run disabled with the mock explanation on a legacy mock-only run (no mockConfigs)', async () => {
    const capture = useTabsHandlers(mockOnlyExperiment, [expectationFailedResult]);
    renderTabs(mockOnlyExperiment, [expectationFailedResult]);

    await featureResult('item-4');

    const button = (await screen.findByText('Re-run item with replay')).closest('button')!;
    const inertWrapper = button.closest('[aria-disabled="true"]');
    expect(inertWrapper).not.toBeNull();
    expect(inertWrapper!.className).toContain('pointer-events-none');

    fireEvent.click(button);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(capture).not.toHaveBeenCalled();
  });

  it('re-runs one item of a mock-only run with the exact persisted mocks — and no invented replay policy', async () => {
    const capture = useTabsHandlers(mockOnlyWithConfigsExperiment, [expectationFailedResult]);
    renderTabs(mockOnlyWithConfigsExperiment, [expectationFailedResult]);

    await featureResult('item-4');
    fireEvent.click(await screen.findByRole('button', { name: 'Re-run item with replay' }));

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    // The exact wire payload: the persisted mock configs verbatim (data mocks
    // and the expect-only entry), narrowed to this one item — no toolReplay.
    expect(capture.mock.calls[0][0]).toEqual({
      targetType: 'agent',
      targetId: 'support-agent',
      itemIds: ['item-4'],
      toolMocks: {
        weatherInfo: { output: { temp: 20, unit: 'C' } },
        sendEmail: { error: { name: 'MailError', message: 'mail service down' } },
        chargeCard: { expect: { calledTimes: 0 } },
      },
      version: 1,
    });
  });

  it('keeps the re-run disabled when the record holds a function-mock placeholder', async () => {
    const capture = useTabsHandlers(functionMockExperiment, [expectationFailedResult]);
    renderTabs(functionMockExperiment, [expectationFailedResult]);

    await featureResult('item-4');

    const button = (await screen.findByText('Re-run item with replay')).closest('button')!;
    expect(button.closest('[aria-disabled="true"]')).not.toBeNull();

    fireEvent.click(button);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(capture).not.toHaveBeenCalled();
  });
});
