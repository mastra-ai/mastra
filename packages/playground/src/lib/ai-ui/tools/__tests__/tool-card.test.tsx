import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useContext } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToolCard, ToolCardInner } from '../tool-card';
import type { ToolCardProps } from '../tool-card';
import { WorkflowRunContext, WorkflowRunProvider } from '@/domains/workflows';
import { WORKSPACE_TOOLS } from '@/domains/workspace/constants';
import { ChatAgentContext, ChatRunningContext } from '@/lib/ai-ui/chat/chat-context';
import { ToolCallProvider } from '@/services/tool-call-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const mcpEmptyHandlers = [
  http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
];

beforeEach(() => {
  server.use(...mcpEmptyHandlers);
});

afterEach(() => cleanup());

const Providers = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChatAgentContext.Provider value={{ agentId: 'test-agent' }}>
            <ToolCallProvider
              approveToolcall={() => {}}
              declineToolcall={() => {}}
              approveToolcallGenerate={() => {}}
              declineToolcallGenerate={() => {}}
              approveNetworkToolcall={() => {}}
              declineNetworkToolcall={() => {}}
              isRunning={false}
              toolCallApprovals={{}}
              networkToolCallApprovals={{}}
            >
              {children}
            </ToolCallProvider>
          </ChatAgentContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const renderToolCard = (props: ToolCardProps) => render(<ToolCard {...props} />, { wrapper: Providers });

/** Reads the live WorkflowRunContext result so the streaming wiring is observable. */
const WorkflowResultProbe = ({ onResult }: { onResult: (r: unknown) => void }) => {
  const { result } = useContext(WorkflowRunContext);
  onResult(result);
  return null;
};

const baseProps = (over: Partial<ToolCardProps>): ToolCardProps => ({
  toolName: 'genericTool',
  input: { q: 'x' },
  output: { ok: true },
  toolCallId: 'call-1',
  state: 'output-available',
  metadata: { mode: 'stream' },
  ...over,
});

describe('ToolCard dispatch', () => {
  it('hides updateWorkingMemory tool calls', () => {
    const { container } = renderToolCard(baseProps({ toolName: 'updateWorkingMemory' }));
    expect(container.textContent).toBe('');
  });

  describe('when the submit_plan tool has completed', () => {
    it('routes the result to the submitted plan card', () => {
      renderToolCard(
        baseProps({
          toolName: 'submit_plan',
          output: {
            content: 'Plan approved.',
            submittedPlan: {
              title: 'Ship the feature',
              path: '.mastracode/plans/ship-feature.md',
              plan: '## Implementation\n\nBuild and verify the feature.',
            },
          },
        }),
      );

      expect(screen.getByRole('group', { name: 'Submitted plan' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Ship the feature' })).toBeTruthy();
    });
  });

  describe('when an aliased submit_plan tool has completed', () => {
    it('routes the intrinsic tool result to the submitted plan card', () => {
      renderToolCard(
        baseProps({
          toolName: 'userDefinedAlias',
          output: {
            toolId: 'submit_plan',
            content: 'Plan approved.',
            submittedPlan: {
              title: 'Aliased plan',
              path: '.mastracode/plans/aliased.md',
              plan: '## Implementation\n\nRender the aliased plan.',
            },
          },
        }),
      );

      expect(screen.getByRole('group', { name: 'Submitted plan' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Aliased plan' })).toBeTruthy();
    });
  });

  describe('when an aliased submit_plan tool is suspended', () => {
    it('routes the intrinsic tool payload to the approval card', async () => {
      const path = '.mastracode/plans/aliased.md';
      server.use(
        http.get(`${BASE_URL}/api/agents/:agentId/plans/file`, ({ request }) => {
          if (new URL(request.url).searchParams.get('path') !== path) {
            return HttpResponse.json({ message: 'Plan not found' }, { status: 404 });
          }
          return HttpResponse.json({ path, content: '# Aliased plan\n\nRender it.' });
        }),
      );

      renderToolCard(
        baseProps({
          toolName: 'userDefinedAlias',
          toolCallId: 'aliased-call',
          output: undefined,
          metadata: {
            mode: 'stream',
            suspendedTools: {
              userDefinedAlias: { suspendPayload: { toolId: 'submit_plan', path } },
            },
          },
        }),
      );

      expect(await screen.findByRole('group', { name: 'Plan approval' })).toBeTruthy();
      expect(await screen.findByRole('heading', { name: 'Aliased plan' })).toBeTruthy();
    });
  });

  it('renders an observation marker for OM observation tool', () => {
    renderToolCard(
      baseProps({
        toolName: 'mastra-memory-om-observation',
        input: { cycleId: 'cycle-1' },
        output: undefined,
      }),
    );
    expect(document.querySelector('[data-om-badge="cycle-1"]')).toBeTruthy();
  });

  it('uses streaming OM output data for completed observation markers even when metadata has stale start data', () => {
    renderToolCard(
      baseProps({
        toolName: 'mastra-memory-om-observation',
        input: { cycleId: 'cycle-stream', _state: 'loading', operationType: 'observation' },
        output: {
          status: 'complete',
          omData: {
            cycleId: 'cycle-stream',
            _state: 'complete',
            operationType: 'observation',
            extractedValues: { workingMemory: { name: 'Tyler' } },
          },
        },
        metadata: {
          mode: 'stream',
          omData: { cycleId: 'cycle-stream', _state: 'loading', operationType: 'observation' },
        },
      }),
    );

    expect(screen.getByRole('button', { name: /observed/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /extractions \(1\)/i })).toBeTruthy();
  });

  it('routes agent-* tools to the agent badge wrapper', () => {
    renderToolCard(
      baseProps({
        toolName: 'agent-weatherAgent',
        output: { text: 'sunny' },
      }),
    );
    // Display name strips the agent- prefix.
    expect(screen.queryByText(/agent-weatherAgent/)).toBeNull();
  });

  it('routes workflow-* tools to the workflow badge', async () => {
    server.use(
      http.get(`${BASE_URL}/api/workflows/myFlow`, () =>
        HttpResponse.json({ name: 'My Flow', steps: {}, allSteps: {}, stepGraph: [] }),
      ),
    );
    renderToolCard(
      baseProps({
        toolName: 'workflow-myFlow',
        output: { runId: 'run-1', status: 'success' },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('workflow-badge')).toBeTruthy());
  });

  it('routes list_files to the file tree badge', () => {
    renderToolCard(
      baseProps({
        toolName: WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES,
        input: { path: '.' },
        output: { tree: [] },
      }),
    );
    expect(screen.getByTestId('file-tree-badge')).toBeTruthy();
  });

  it('routes sandbox execute_command to the sandbox execution badge', () => {
    renderToolCard(
      baseProps({
        toolName: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
        input: { command: 'ls' },
        output: { stdout: 'a\nb' },
      }),
    );
    expect(screen.getByTestId('sandbox-execution-badge')).toBeTruthy();
  });

  it('routes code-mode calls to the code mode badge', () => {
    renderToolCard(
      baseProps({
        toolName: 'execute_typescript',
        input: { code: 'return 1;' },
        output: { success: true, result: 1 },
      }),
    );
    expect(screen.getByText('execute_typescript')).toBeTruthy();
  });

  it('renders a generic tool badge as a fallback', () => {
    renderToolCard(baseProps({ toolName: 'searchDocs' }));
    expect(screen.getByText('SearchDocs')).toBeTruthy();
  });

  it('treats background-task string results as a generic tool badge', () => {
    renderToolCard(
      baseProps({
        toolName: 'startJob',
        output: 'Background task started with id abc',
      }),
    );
    expect(screen.getByText('StartJob')).toBeTruthy();
  });

  it('shimmers an unsettled call while the run is live, and marks a failed one', () => {
    const running = { isRunning: true, cancelRun: () => {}, canSendWhileStreaming: false };
    const { rerender } = render(
      <ChatRunningContext.Provider value={running}>
        <ToolCard {...baseProps({ toolName: 'searchDocs', state: 'input-available' })} />
      </ChatRunningContext.Provider>,
      { wrapper: Providers },
    );
    expect(screen.getByTestId('tool-badge').getAttribute('data-status')).toBe('running');

    rerender(
      <ChatRunningContext.Provider value={running}>
        <ToolCard {...baseProps({ toolName: 'searchDocs', state: 'output-error' })} />
      </ChatRunningContext.Provider>,
    );
    expect(screen.getByTestId('tool-badge').getAttribute('data-status')).toBe('error');
  });

  it('keeps an unsettled call from a finished run quiet', () => {
    renderToolCard(baseProps({ toolName: 'searchDocs', state: 'input-available' }));
    expect(screen.getByTestId('tool-badge').getAttribute('data-status')).toBe('idle');
  });

  it('surfaces the agent suspend payload when suspendedTools is keyed by toolCallId', () => {
    renderToolCard(
      baseProps({
        toolName: 'agent-billingAgent',
        toolCallId: 'call-abc',
        output: { text: 'pending approval' },
        metadata: {
          mode: 'stream',
          // New core format: suspendedTools keyed by toolCallId.
          suspendedTools: {
            'call-abc': { suspendPayload: 'approve refund ord_2001?' },
          },
        },
      }),
    );

    // Agent badge starts collapsed; expand it to reveal the suspend payload.
    fireEvent.click(screen.getByText('billingAgent'));
    expect(screen.getByText('Agent suspend payload')).toBeTruthy();
    expect(screen.getByText('approve refund ord_2001?')).toBeTruthy();
  });

  it('surfaces the agent suspend payload when suspendedTools is keyed by toolName (back-compat)', () => {
    renderToolCard(
      baseProps({
        toolName: 'agent-billingAgent',
        toolCallId: 'call-abc',
        output: { text: 'pending approval' },
        metadata: {
          mode: 'stream',
          // Legacy core format: suspendedTools keyed by toolName.
          suspendedTools: {
            'agent-billingAgent': { suspendPayload: 'approve refund ord_2001?' },
          },
        },
      }),
    );

    fireEvent.click(screen.getByText('billingAgent'));
    expect(screen.getByText('Agent suspend payload')).toBeTruthy();
    expect(screen.getByText('approve refund ord_2001?')).toBeTruthy();
  });

  it('resolves distinct suspend payloads for parallel delegations to the same sub-agent', () => {
    // Two delegations share the same toolName but have distinct toolCallIds.
    // The toolCallId-keyed lookup must surface each call's own payload.
    const sharedMetadata = {
      mode: 'stream' as const,
      suspendedTools: {
        'call-A': { suspendPayload: 'approve refund ord_2001?' },
        'call-B': { suspendPayload: 'approve refund ord_2003?' },
      },
    };

    const { unmount } = renderToolCard(
      baseProps({
        toolName: 'agent-billingAgent',
        toolCallId: 'call-A',
        output: { text: 'pending' },
        metadata: sharedMetadata,
      }),
    );
    fireEvent.click(screen.getByText('billingAgent'));
    expect(screen.getByText('approve refund ord_2001?')).toBeTruthy();
    expect(screen.queryByText('approve refund ord_2003?')).toBeNull();
    unmount();

    renderToolCard(
      baseProps({
        toolName: 'agent-billingAgent',
        toolCallId: 'call-B',
        output: { text: 'pending' },
        metadata: sharedMetadata,
      }),
    );
    fireEvent.click(screen.getByText('billingAgent'));
    expect(screen.getByText('approve refund ord_2003?')).toBeTruthy();
    expect(screen.queryByText('approve refund ord_2001?')).toBeNull();
  });

  it('pushes a streaming workflow output into WorkflowRunContext for the live graph', async () => {
    server.use(
      http.get(`${BASE_URL}/api/workflows/liveFlow`, () =>
        HttpResponse.json({ name: 'Live Flow', steps: {}, allSteps: {}, stepGraph: [] }),
      ),
    );
    const streamed = { runId: 'run-live', status: 'running', steps: {} };
    let received: unknown;

    // ToolCardInner consumes the ambient WorkflowRunProvider (instead of creating
    // its own) so the probe in the same provider can observe the streamed result
    // that useWorkflowStream(output) pushes in — this is the live-graph wiring.
    render(
      <Providers>
        <WorkflowRunProvider workflowId="" withoutTimeTravel>
          <WorkflowResultProbe onResult={r => (received = r)} />
          <ToolCardInner
            {...baseProps({
              toolName: 'workflow-liveFlow',
              output: streamed,
              metadata: { mode: 'stream' },
            })}
          />
        </WorkflowRunProvider>
      </Providers>,
    );

    await waitFor(() => expect(received).toEqual(streamed));
  });
});
