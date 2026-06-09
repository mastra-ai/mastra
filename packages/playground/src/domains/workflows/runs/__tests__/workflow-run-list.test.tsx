// @vitest-environment jsdom
import type { GetWorkflowResponse, ListWorkflowRunsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { baseWorkflow } from '../../components/__tests__/fixtures/workflow';
import { WorkflowRunList } from '../workflow-run-list';
import { oneSuccessfulRun } from './fixtures/workflow-runs';
import { readOnlyAuthCapabilities } from '@/domains/agents/components/__tests__/fixtures/auth';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const WORKFLOW_ID = 'demo-workflow';

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

function renderRunList(runId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
          <WorkflowRunList workflowId={WORKFLOW_ID} runId={runId} />
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function stubCapabilities() {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(readOnlyAuthCapabilities)));
}

function stubRuns(response: ListWorkflowRunsResponse) {
  server.use(http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs`, () => HttpResponse.json(response)));
}

function stubWorkflow(workflow: GetWorkflowResponse) {
  server.use(http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(workflow)));
}

afterEach(cleanup);

describe('WorkflowRunList', () => {
  it('never renders the "New workflow run" button (it lives in the left panel now)', async () => {
    stubCapabilities();
    stubWorkflow(baseWorkflow);
    stubRuns(oneSuccessfulRun);

    renderRunList('run-success-1');

    expect(await screen.findByText('run-success-1')).not.toBeNull();
    expect(screen.queryByText('New workflow run')).toBeNull();
  });

  it('renders the status as an icon with the status exposed via aria-label/tooltip', async () => {
    stubCapabilities();
    stubWorkflow(baseWorkflow);
    stubRuns(oneSuccessfulRun);

    renderRunList();

    expect(await screen.findByText('run-success-1')).not.toBeNull();
    // Status icon trigger exposes the raw status for accessibility...
    expect(screen.getByLabelText('success')).not.toBeNull();
    // ...and the textual badge is gone.
    expect(screen.queryByText('SUCCESS')).toBeNull();
  });

  it('renders the "Workflow run history" panel title', async () => {
    stubCapabilities();
    stubWorkflow(baseWorkflow);
    stubRuns(oneSuccessfulRun);

    renderRunList();

    expect(await screen.findByText('Workflow run history')).not.toBeNull();
  });

  it('renders the workflow metadata header with title and badges above the run history', async () => {
    stubCapabilities();
    stubWorkflow(baseWorkflow);
    stubRuns(oneSuccessfulRun);

    renderRunList();

    // Workflow name as the header title
    expect(await screen.findByRole('heading', { name: baseWorkflow.name })).not.toBeNull();
    // Copy-ID badge exposes the workflow id
    expect(screen.getByText(WORKFLOW_ID)).not.toBeNull();
    // Step count badge derived from the workflow's steps (baseWorkflow has a single step)
    expect(screen.getByText('1 step')).not.toBeNull();
  });

  it('links each run row to its run detail path', async () => {
    stubCapabilities();
    stubWorkflow(baseWorkflow);
    stubRuns(oneSuccessfulRun);

    renderRunList();

    const runLabel = await screen.findByText('run-success-1');
    const link = runLabel.closest('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe(paths.workflowRunLink(WORKFLOW_ID, 'run-success-1'));
  });
});
