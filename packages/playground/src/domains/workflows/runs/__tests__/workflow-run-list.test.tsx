// @vitest-environment jsdom
import type { ListWorkflowRunsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowRecentRuns } from '../workflow-run-list';
import { emptyWorkflowRuns, oneSuccessfulRun, runsWithInput } from './fixtures/workflow-runs';
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
          <WorkflowRecentRuns workflowId={WORKFLOW_ID} runId={runId} />
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

afterEach(cleanup);

describe('WorkflowRecentRuns', () => {
  it('never renders the "New workflow run" button (it lives in the left panel now)', async () => {
    stubCapabilities();
    stubRuns(oneSuccessfulRun);

    renderRunList('run-success-1');

    expect(await screen.findByRole('link', { name: /run-success-1/ })).not.toBeNull();
    expect(screen.queryByText('New workflow run')).toBeNull();
  });

  it('renders the status as an icon with the status exposed via aria-label/tooltip', async () => {
    stubCapabilities();
    stubRuns(oneSuccessfulRun);

    renderRunList();

    expect(await screen.findByRole('link', { name: /run-success-1/ })).not.toBeNull();
    // Status icon trigger exposes the raw status for accessibility...
    expect(screen.getByLabelText('success')).not.toBeNull();
    // ...and the textual badge is gone.
    expect(screen.queryByText('SUCCESS')).toBeNull();
  });

  it('shows the run id and date in the same muted metadata row', async () => {
    stubCapabilities();
    stubRuns(oneSuccessfulRun);

    renderRunList();

    const link = await screen.findByRole('link', { name: /run-success-1/ });
    const runId = within(link).getByTitle('run-success-1');
    expect(runId.className).toContain('truncate');
    expect(within(link).getByText('May 29, 2026 4:19 PM').className).toContain('text-neutral3');
    expect(runId.parentElement?.className).toContain('flex');
    expect(runId.parentElement?.className).toContain('items-center');
    expect(runId.parentElement?.className).toContain('gap-2');
  });

  it('shows the input preview only for the active run', async () => {
    stubCapabilities();
    stubRuns(runsWithInput);

    renderRunList('run-with-input');

    const link = await screen.findByRole('link', { name: /run-with-input/ });
    expect(within(link).getByTitle('run-with-input')).not.toBeNull();
    expect(within(link).getByText('{"city":"Paris"}')).not.toBeNull();
  });

  it('does not show an input preview for inactive runs', async () => {
    stubCapabilities();
    stubRuns(runsWithInput);

    renderRunList();

    const link = await screen.findByRole('link', { name: /run-with-input/ });
    expect(within(link).getByTitle('run-with-input')).not.toBeNull();
    expect(within(link).queryByText('{"city":"Paris"}')).toBeNull();
  });

  it('renders the "Recent runs" section title', async () => {
    stubCapabilities();
    stubRuns(oneSuccessfulRun);

    renderRunList();

    expect(await screen.findByText('Recent runs')).not.toBeNull();
  });

  it('shows an empty state and no run rows when there are no runs', async () => {
    stubCapabilities();
    stubRuns(emptyWorkflowRuns);

    renderRunList();

    expect(await screen.findByText('Recent runs')).not.toBeNull();
    expect(screen.queryByText('run-success-1')).toBeNull();
    expect(screen.getByText('Your run history will appear here once you run the workflow')).not.toBeNull();
  });

  it('links each run row to its run detail path', async () => {
    stubCapabilities();
    stubRuns(oneSuccessfulRun);

    renderRunList();

    const link = await screen.findByRole('link', { name: /run-success-1/ });
    expect(link.getAttribute('href')).toBe(paths.workflowRunLink(WORKFLOW_ID, 'run-success-1'));
  });
});
