// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useContext } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToolCard, ToolCardInner } from '../tool-card';
import type { ToolCardProps } from '../tool-card';
import { WorkflowRunContext, WorkflowRunProvider } from '@/domains/workflows';
import { WORKSPACE_TOOLS } from '@/domains/workspace/constants';
import { ArtifactPreviewProvider } from '@/lib/ai-ui/artifacts/artifact-preview-context';
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
            <ArtifactPreviewProvider>{children}</ArtifactPreviewProvider>
          </ToolCallProvider>
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
    expect(screen.getByText('searchDocs')).toBeTruthy();
  });

  it('renders an open artifact chip for completed workspace write_file calls with workspace metadata', () => {
    renderToolCard(
      baseProps({
        toolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
        input: { path: 'reports/output.pdf' },
        output: { path: 'reports/output.pdf', success: true, mimeType: 'application/pdf' },
        toolCallId: 'call-write',
        dataParts: [
          {
            type: 'data-workspace-metadata',
            data: {
              toolCallId: 'call-write',
              id: 'workspace-1',
              name: 'Workspace One',
            },
          },
        ],
      }),
    );

    expect(screen.getByTestId('workspace-artifact-chip').textContent).toContain('Open file');
    expect(screen.getByTestId('workspace-artifact-chip').textContent).toContain('output.pdf');
  });

  it('renders an open artifact chip for completed workspace read_file calls with workspace metadata', () => {
    renderToolCard(
      baseProps({
        toolName: WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
        input: JSON.stringify({ path: 'notes/brief.md' }),
        output: { path: 'notes/brief.md', content: '# Brief', mimeType: 'text/markdown' },
        toolCallId: 'call-read',
        dataParts: [
          {
            type: 'data',
            name: 'workspace-metadata',
            data: {
              toolCallId: 'call-read',
              id: 'workspace-1',
              name: 'Workspace One',
            },
          },
        ],
      }),
    );

    expect(screen.getByTestId('workspace-artifact-chip').textContent).toContain('brief.md');
  });

  it('does not render an artifact chip when workspace metadata or path is missing', () => {
    const { rerender } = render(
      <Providers>
        <ToolCard
          {...baseProps({
            toolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
            input: { path: 'reports/output.pdf' },
            output: { path: 'reports/output.pdf', success: true },
            toolCallId: 'call-missing-metadata',
          })}
        />
      </Providers>,
    );

    expect(screen.queryByTestId('workspace-artifact-chip')).toBeNull();

    rerender(
      <Providers>
        <ToolCard
          {...baseProps({
            toolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
            input: {},
            output: { path: 'reports/output.pdf', success: true },
            toolCallId: 'call-missing-path',
            dataParts: [
              {
                type: 'data-workspace-metadata',
                data: {
                  toolCallId: 'call-missing-path',
                  id: 'workspace-1',
                },
              },
            ],
          })}
        />
      </Providers>,
    );

    expect(screen.queryByTestId('workspace-artifact-chip')).toBeNull();
  });

  it('treats background-task string results as a generic tool badge', () => {
    renderToolCard(
      baseProps({
        toolName: 'startJob',
        output: 'Background task started with id abc',
      }),
    );
    expect(screen.getByText('startJob')).toBeTruthy();
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
