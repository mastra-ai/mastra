// @vitest-environment jsdom
import type { GetWorkflowResponse, GetWorkflowRunByIdResponse, ListWorkflowRunsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef, useContext, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { emptyWorkflowRuns, oneSuccessfulRun, runWithTimedSteps } from '../../runs/__tests__/fixtures/workflow-runs';
import { WorkflowInformation } from '../workflow-information';
import { fullAccessAuthCapabilities } from './fixtures/auth';
import { baseWorkflow, workflowWithRequestContext } from './fixtures/workflow';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
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

function stubCapabilities() {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(fullAccessAuthCapabilities)));
}

function stubWorkflow(workflow: GetWorkflowResponse) {
  server.use(http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(workflow)));
}

function stubRuns(response: ListWorkflowRunsResponse) {
  server.use(http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs`, () => HttpResponse.json(response)));
}

function stubRunById(
  runId: string,
  result?: Record<string, unknown>,
  overrides: Partial<Omit<GetWorkflowRunByIdResponse, 'result'>> = {},
) {
  server.use(
    http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs/${runId}`, () =>
      HttpResponse.json({
        runId,
        workflowName: WORKFLOW_ID,
        status: 'success',
        createdAt: new Date(2026, 4, 29, 16, 19, 44),
        updatedAt: new Date(2026, 4, 29, 16, 19, 44),
        steps: {},
        serializedStepGraph: [],
        ...(result !== undefined ? { result } : {}),
        ...overrides,
      } satisfies GetWorkflowRunByIdResponse),
    ),
  );
}

function CurrentRunSetter({ runId }: { runId?: string }) {
  const { setRunId } = useContext(WorkflowRunContext);

  useEffect(() => {
    if (runId) {
      setRunId(runId);
    }
  }, [runId, setRunId]);

  return null;
}

function renderInformation(initialRunId?: string, currentRunId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
          <TracingSettingsProvider entityId={WORKFLOW_ID} entityType="workflow">
            <SchemaRequestContextProvider>
              <WorkflowRunProvider workflowId={WORKFLOW_ID} initialRunId={initialRunId}>
                <CurrentRunSetter runId={currentRunId} />
                <WorkflowInformation workflowId={WORKFLOW_ID} initialRunId={initialRunId} />
              </WorkflowRunProvider>
            </SchemaRequestContextProvider>
          </TracingSettingsProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(cleanup);

describe('WorkflowInformation', () => {
  describe('New workflow run button gating', () => {
    it('hides the "New workflow run" button when there are no runs and no active runId', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      expect(await screen.findByRole('button', { name: 'Run' })).not.toBeNull();
      expect(screen.queryByText('New workflow run')).toBeNull();
    });

    it('hides the "New workflow run" button when past runs exist but no run is active or finished', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(oneSuccessfulRun);

      renderInformation();

      expect(await screen.findByRole('button', { name: 'Run' })).not.toBeNull();
      expect(screen.queryByText('New workflow run')).toBeNull();
    });

    it('shows the "New workflow run" button linking to the workflow when viewing a specific run', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(oneSuccessfulRun);
      stubRunById('run-success-1');

      renderInformation('run-success-1');

      const button = await screen.findByText('New workflow run');
      expect(button.closest('a')?.getAttribute('href')).toBe(paths.workflowLink(WORKFLOW_ID));
    });

    it('shows the "New workflow run" button while the sidebar is showing the current execution', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation(undefined, 'current-run-1');

      const button = await screen.findByText('New workflow run');
      expect(button.closest('a')?.getAttribute('href')).toBe(paths.workflowLink(WORKFLOW_ID));
    });
  });

  describe('no tabs', () => {
    it('renders the trigger content directly without a Current Run tab', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      // Trigger form submit button is visible immediately (no tab interaction required)
      expect(await screen.findByRole('button', { name: 'Run' })).not.toBeNull();
      // No tab chrome
      expect(screen.queryByRole('tablist')).toBeNull();
      expect(screen.queryByText('Current Run')).toBeNull();
    });
  });

  describe('Request Context dialog', () => {
    it('does not show the Request Context button when the workflow has no schema', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      expect(await screen.findByRole('button', { name: 'Run' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Request Context' })).toBeNull();
    });

    it('opens a Request Context dialog from an icon button when the workflow has a schema', async () => {
      stubCapabilities();
      stubWorkflow(workflowWithRequestContext);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      const trigger = await screen.findByRole('button', { name: 'Request Context' });
      expect(screen.queryByRole('dialog')).toBeNull();

      fireEvent.click(trigger);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog.textContent).toContain('Request Context');
      });
    });
  });

  describe('Run Options dialog', () => {
    it('opens a Run Options dialog from an icon button', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      const trigger = await screen.findByRole('button', { name: 'Run Options' });
      expect(screen.queryByRole('dialog')).toBeNull();

      fireEvent.click(trigger);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog.textContent).toContain('Tracing Options');
      });
    });
  });

  describe('action button placement', () => {
    it('renders Request Context and Run Options inline with the Run button', async () => {
      stubCapabilities();
      stubWorkflow(workflowWithRequestContext);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      const run = await screen.findByRole('button', { name: 'Run' });
      const requestContext = screen.getByRole('button', { name: 'Request Context' });
      const runOptions = screen.getByRole('button', { name: 'Run Options' });

      // The icon buttons share the Run button's action row, not a separate top row.
      const actionRow = run.parentElement;
      expect(actionRow).not.toBeNull();
      expect(actionRow?.contains(requestContext)).toBe(true);
      expect(actionRow?.contains(runOptions)).toBe(true);
    });
  });

  describe('input type toggle', () => {
    it('renders a segmented Form/JSON toggle defaulting to Form (no dropdown)', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      const toggle = await screen.findByRole('radiogroup', { name: 'Input type' });
      const formOption = within(toggle).getByRole('radio', { name: 'Form' });
      const jsonOption = within(toggle).getByRole('radio', { name: 'JSON' });

      expect(formOption.getAttribute('aria-checked')).toBe('true');
      expect(jsonOption.getAttribute('aria-checked')).toBe('false');
      // No dropdown chrome for the input type control
      expect(screen.queryByRole('combobox', { name: 'Input type' })).toBeNull();
    });

    it('switches to JSON when the JSON segment is clicked', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      const toggle = await screen.findByRole('radiogroup', { name: 'Input type' });
      const jsonOption = within(toggle).getByRole('radio', { name: 'JSON' });

      fireEvent.click(jsonOption);

      expect(within(toggle).getByRole('radio', { name: 'JSON' }).getAttribute('aria-checked')).toBe('true');
      expect(within(toggle).getByRole('radio', { name: 'Form' }).getAttribute('aria-checked')).toBe('false');
    });
  });

  describe('sections', () => {
    it('renders the trigger and recent runs headers as non-collapsible sections', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      // The trigger header is no longer a collapsible section; it shows the workflow name.
      expect(await screen.findByText('Demo Workflow')).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Trigger a run' })).toBeNull();

      expect(await screen.findByRole('heading', { name: 'Recent runs' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Recent runs' })).toBeNull();

      // The trigger input content is visible.
      expect(await screen.findByRole('radiogroup', { name: 'Input type' })).not.toBeNull();
    });

    it('caps the top section at half of the established panel height and scrolls its contents', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      expect(await screen.findByText('Demo Workflow')).not.toBeNull();
      expect(screen.getByTestId('workflow-information-panel').className).toContain('h-full');
      expect(screen.getByTestId('workflow-information-top-section').className).toContain('max-h-[50%]');
      expect(screen.getByTestId('workflow-information-top-section').className).toContain('overflow-hidden');
      expect(screen.getByTestId('workflow-information-top-scroll-area').className).toContain('min-h-0');
      expect(screen.getByTestId('workflow-information-top-scroll-area').className).toContain('flex-1');
      expect(
        screen.getByTestId('workflow-information-top-scroll-area').querySelector('[style*="overflow-y: scroll"]'),
      ).not.toBeNull();
    });

    it('keeps the trigger input content visible (the header does not collapse)', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      // Clicking the workflow name does not collapse the input content.
      const triggerHeader = await screen.findByText('Demo Workflow');
      expect(await screen.findByRole('radiogroup', { name: 'Input type' })).not.toBeNull();

      fireEvent.click(triggerHeader);

      expect(screen.getByRole('radiogroup', { name: 'Input type' })).not.toBeNull();
    });
  });

  describe('input section heading', () => {
    it('shows the workflow name and "Run input" label when there is no active run', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      expect(await screen.findByText('Demo Workflow')).not.toBeNull();
      expect(await screen.findByText('Run input')).not.toBeNull();
    });

    it('shows the run status, run ID, duration, and relative age when viewing a specific run', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(oneSuccessfulRun);
      stubRunById('run-success-1', undefined, {
        ...runWithTimedSteps,
        runId: 'run-success-1',
        status: 'success',
      });

      renderInformation('run-success-1');

      const inputButton = await screen.findByRole('button', { name: 'Run input' });
      expect(inputButton.className).toContain('w-full');
      expect(inputButton.className).toContain('justify-start');
      expect(inputButton.querySelector('svg')).not.toBeNull();
      expect(within(screen.getByTestId('workflow-information-top-section')).queryByRole('radiogroup', { name: 'Input type' })).toBeNull();

      fireEvent.click(inputButton);

      const inputDialog = await screen.findByRole('dialog', { name: 'Workflow input' });
      expect(inputDialog).not.toBeNull();
      expect(within(inputDialog).getByRole('radiogroup', { name: 'Input type' })).not.toBeNull();
      expect(within(inputDialog).getByText('Input')).not.toBeNull();
      const statusTitle = await screen.findByText('Success');
      expect(statusTitle.nextElementSibling?.textContent).toBe('run-success-1');
      expect(await screen.findByText('3s')).not.toBeNull();
      expect(await screen.findByText(/ago$/)).not.toBeNull();
    });

    it('shows both finished-run dialog buttons when the run has a result', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(oneSuccessfulRun);
      stubRunById('run-success-1', { greeting: 'done' });

      renderInformation('run-success-1');

      expect(await screen.findByRole('button', { name: 'Run input' })).not.toBeNull();
      expect(await screen.findByRole('button', { name: 'Entire workflow execution (JSON)' })).not.toBeNull();
      expect(await screen.findByRole('button', { name: 'Run output' })).not.toBeNull();
      expect(screen.queryByText('Input')).toBeNull();
      expect(screen.queryByText('Output')).toBeNull();

      for (const button of [
        screen.getByRole('button', { name: 'Run input' }),
        screen.getByRole('button', { name: 'Entire workflow execution (JSON)' }),
        screen.getByRole('button', { name: 'Run output' }),
      ]) {
        expect(button.className).toContain('w-full');
        expect(button.className).toContain('justify-start');
        expect(button.querySelector('svg')).not.toBeNull();
      }
    });

    it('shows only the entire-execution button when the run has no result', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(oneSuccessfulRun);
      stubRunById('run-success-1');

      renderInformation('run-success-1');

      expect(await screen.findByRole('button', { name: 'Entire workflow execution (JSON)' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Run output' })).toBeNull();
    });

    it('copies the workflow name to the clipboard via the copy button', async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      const copyButton = await screen.findByRole('button', { name: 'Copy to clipboard' });
      fireEvent.click(copyButton);

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('Demo Workflow'));
    });
  });

  describe('Recent runs', () => {
    it('renders a "Recent runs" section below the trigger form', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(oneSuccessfulRun);

      renderInformation();

      expect(await screen.findByRole('button', { name: 'Run' })).not.toBeNull();
      expect(await screen.findByText('Recent runs')).not.toBeNull();
    });

    it('renders a recent run row with its status icon linking to the run detail path', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(oneSuccessfulRun);

      renderInformation();

      const runLabel = await screen.findByText('run-success-1');
      expect(screen.getByLabelText('success')).not.toBeNull();
      const link = runLabel.closest('a');
      expect(link?.getAttribute('href')).toBe(paths.workflowRunLink(WORKFLOW_ID, 'run-success-1'));
    });

    it('shows an empty state and no run rows when there are no runs', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      expect(await screen.findByText('Recent runs')).not.toBeNull();
      expect(screen.queryByText('run-success-1')).toBeNull();
      expect(screen.getByText('Your run history will appear here once you run the workflow')).not.toBeNull();
    });

    it('highlights the active run row when viewing a specific run', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(oneSuccessfulRun);
      stubRunById('run-success-1');

      renderInformation('run-success-1');

      const runLabels = await screen.findAllByText('run-success-1');
      const link = runLabels
        .map(label => label.closest('a'))
        .find(anchor => anchor?.getAttribute('href') === paths.workflowRunLink(WORKFLOW_ID, 'run-success-1'));
      expect(link?.className).toContain('bg-surface4');
    });
  });

  describe('Toggle debug switch', () => {
    it('renders the "Toggle debug" switch on the left of the trigger action row', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      const run = await screen.findByRole('button', { name: 'Run' });
      const toggle = screen.getByRole('switch', { name: 'Toggle debug' });
      expect(toggle).not.toBeNull();

      // The toggle is on the left of the same action row, not inside the
      // right-hand group that holds the Run button.
      const rightGroup = run.parentElement;
      expect(rightGroup?.contains(toggle)).toBe(false);
      const actionRow = rightGroup?.parentElement;
      expect(actionRow?.contains(toggle)).toBe(true);
      expect(actionRow?.contains(run)).toBe(true);
    });

    it('does not render the "Toggle debug" switch when viewing a specific run', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(oneSuccessfulRun);
      stubRunById('run-success-1');

      renderInformation('run-success-1');

      expect(await screen.findByRole('button', { name: 'Run input' })).not.toBeNull();
      expect(screen.queryByRole('switch', { name: 'Toggle debug' })).toBeNull();
    });

    it('toggles checked state when clicked', async () => {
      stubCapabilities();
      stubWorkflow(baseWorkflow);
      stubRuns(emptyWorkflowRuns);

      renderInformation();

      const toggle = await screen.findByRole('switch', { name: 'Toggle debug' });
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByRole('switch', { name: 'Toggle debug' }).getAttribute('aria-checked')).toBe('true');
      });
    });
  });
});
