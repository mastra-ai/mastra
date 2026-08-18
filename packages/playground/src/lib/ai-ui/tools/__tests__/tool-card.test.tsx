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
import { ChatAgentContext } from '@/lib/ai-ui/chat/chat-context';
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
    const badge = screen.getByTestId('file-tree-badge');
    expect(badge.getAttribute('role')).toBe('group');
    expect(badge.getAttribute('aria-label')).toBe(`Tool: ${WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES}`);
    expect(badge.querySelector('.text-accent6')).toBeTruthy();
  });

  it('keeps the loading label when a network call has started without a result', () => {
    renderToolCard(
      baseProps({
        toolName: WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES,
        input: { path: '.' },
        output: undefined,
        state: 'input-available',
        metadata: { mode: 'network', hasMoreMessages: true },
      }),
    );

    const tool = screen.getByRole('group', { name: `Tool: ${WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES}` });
    expect(tool.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /List Files/ }));

    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(screen.queryByText('No files found.')).toBeNull();
  });

  describe('when list_files approval is pending', () => {
    it('exposes the approval controls without another user action', () => {
      const toolName = WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES;
      renderToolCard(
        baseProps({
          toolName,
          input: { path: '.' },
          output: undefined,
          state: 'input-available',
          metadata: {
            mode: 'stream',
            requireApprovalMetadata: {
              [toolName]: { toolCallId: 'call-1', toolName, args: { path: '.' } },
            },
          },
        }),
      );

      expect(screen.getByRole('button', { name: /List Files/ }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
    });

    it('opens when approval arrives and closes after an empty terminal result', () => {
      const toolName = WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES;
      const approvalMetadata = {
        mode: 'stream' as const,
        requireApprovalMetadata: {
          [toolName]: { toolCallId: 'call-1', toolName, args: { path: '.' } },
        },
      };
      const props = baseProps({
        toolName,
        input: { path: '.' },
        output: undefined,
        state: 'input-available',
        metadata: { mode: 'stream' },
      });
      const { rerender } = renderToolCard(props);
      const trigger = screen.getByRole('button', { name: /List Files/ });

      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      rerender(<ToolCard {...props} metadata={approvalMetadata} />);

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();

      rerender(<ToolCard {...props} output="" state="output-available" metadata={approvalMetadata} />);

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
      fireEvent.click(trigger);
      expect(screen.getByText('No files found.')).toBeTruthy();
    });
  });

  it('routes sandbox execute_command to a disclosure collapsed by default', () => {
    renderToolCard(
      baseProps({
        toolName: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
        input: { command: 'ls' },
        output: { stdout: 'a\nb' },
      }),
    );
    const badge = screen.getByTestId('sandbox-execution-badge');
    expect(badge.getAttribute('role')).toBe('group');
    expect(badge.getAttribute('aria-label')).toBe(`Tool: ${WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND}`);
    expect(badge.querySelector('.text-accent6')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Execute Command' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('$')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Execute Command' }));

    expect(screen.getByText('$')).toBeTruthy();
  });

  it.each([
    [WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT, 'Get Process Output'],
    [WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS, 'Kill Process'],
  ])('keeps %s collapsed by default', (toolName, label) => {
    renderToolCard(
      baseProps({
        toolName,
        input: { pid: 123 },
        output: 'done',
      }),
    );

    const trigger = screen.getByRole('button', { name: label });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('$')).toBeNull();
  });

  describe('when sandbox execution approval is pending', () => {
    it('exposes the approval controls without another user action', () => {
      const toolName = WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND;
      renderToolCard(
        baseProps({
          toolName,
          input: { command: 'ls' },
          output: undefined,
          state: 'input-available',
          metadata: {
            mode: 'stream',
            requireApprovalMetadata: {
              [toolName]: { toolCallId: 'call-1', toolName, args: { command: 'ls' } },
            },
          },
        }),
      );

      expect(screen.getByRole('button', { name: 'Execute Command' }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
    });

    it('opens when approval arrives and closes after an empty terminal result', () => {
      const toolName = WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND;
      const approvalMetadata = {
        mode: 'stream' as const,
        requireApprovalMetadata: {
          [toolName]: { toolCallId: 'call-1', toolName, args: { command: 'ls' } },
        },
      };
      const props = baseProps({
        toolName,
        input: { command: 'ls' },
        output: undefined,
        state: 'input-available',
        metadata: { mode: 'stream' },
      });
      const { rerender } = renderToolCard(props);
      const trigger = screen.getByRole('button', { name: 'Execute Command' });

      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      rerender(<ToolCard {...props} metadata={approvalMetadata} />);

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();

      rerender(<ToolCard {...props} output="" state="output-available" metadata={approvalMetadata} />);

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });
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
    renderToolCard(baseProps({ toolName: 'search_docs' }));
    expect(screen.getByRole('group', { name: 'Tool: search_docs' })).toBeTruthy();
    expect(screen.getByText('Search docs')).toBeTruthy();
  });

  it('treats background-task string results as a generic tool badge', () => {
    renderToolCard(
      baseProps({
        toolName: 'start_job',
        output: 'Background task started with id abc',
      }),
    );
    expect(screen.getByRole('group', { name: 'Tool: start_job' })).toBeTruthy();
    expect(screen.getByText('Start job')).toBeTruthy();
  });

  describe('when an agent suspend payload is keyed by toolCallId', () => {
    it('exposes the payload without another user action', () => {
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

      expect(screen.getByRole('button', { name: /billingAgent/ }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText('Agent suspend payload')).toBeTruthy();
      expect(screen.getByText('approve refund ord_2001?')).toBeTruthy();
    });
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

    expect(screen.getByRole('button', { name: /billingAgent/ }).getAttribute('aria-expanded')).toBe('true');
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
