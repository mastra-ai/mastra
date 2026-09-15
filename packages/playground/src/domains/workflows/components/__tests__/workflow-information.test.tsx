// @vitest-environment jsdom
import type { GetWorkflowResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef, useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useWorkflowSelectedStep } from '../../context/use-workflow-selected-step';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import type { WorkflowRunContextType } from '../../context/workflow-run-context';
import { WorkflowSelectedStepProvider } from '../../context/workflow-selected-step-context';
import { WorkflowInformation } from '../workflow-information';
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
  workflowsLink: () => '/workflows',
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
  workflowRunLink: (workflowId: string, runId: string) => `/workflows/${workflowId}/runs/${runId}`,
} as unknown as LinkComponentProviderProps['paths'];

const workflowDetails = {
  name: WORKFLOW_ID,
  stepGraph: [{ type: 'step', step: { id: 'step-a', description: '' } }],
  inputSchema: undefined,
} as unknown as GetWorkflowResponse;

// Reads the live selected-step context so the test can observe it before/after
// the "New workflow run" click, and seeds a selection on mount.
function SelectionProbe({ initial }: { initial: string }) {
  const { selectedStepId, setSelectedStepId } = useWorkflowSelectedStep();

  useEffect(() => {
    setSelectedStepId(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div data-testid="selected-step">{selectedStepId ?? ''}</div>;
}

function renderInformation() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  // A finished run makes the "New workflow run" button visible.
  const contextValue = {
    result: null,
    payload: undefined,
    clearData: () => {},
    setRunId: () => {},
    runId: '',
    workflowError: null,
    closeStreamsAndReset: () => {},
    streamResult: { status: 'success' },
    isStreamingWorkflow: false,
    createWorkflowRun: async () => ({ runId: 'r' }),
    streamWorkflow: () => {},
    resumeWorkflow: () => {},
    cancelWorkflowRun: () => {},
    isCancellingWorkflowRun: false,
    debugMode: false,
    setDebugMode: () => {},
    setResult: () => {},
    setPayload: () => {},
    timeTravelWorkflowStream: async () => {},
  } as unknown as WorkflowRunContextType;

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
          <WorkflowSelectedStepProvider>
            <WorkflowRunContext.Provider value={contextValue}>
              <SelectionProbe initial="step-a" />
              <WorkflowInformation workflowId={WORKFLOW_ID} />
            </WorkflowRunContext.Provider>
          </WorkflowSelectedStepProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(cleanup);

describe('WorkflowInformation', () => {
  describe('when "New workflow run" is pressed with a step selected', () => {
    it('clears the currently selected step', async () => {
      server.use(
        http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(workflowDetails)),
        http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs`, () => HttpResponse.json({ runs: [], total: 0 })),
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({})),
      );

      renderInformation();

      // The probe seeds a selection on mount.
      await waitFor(() => {
        expect(screen.getByTestId('selected-step').textContent).toBe('step-a');
      });

      const newRunButton = await screen.findByText('New workflow run');

      act(() => {
        fireEvent.click(newRunButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-step').textContent).toBe('');
      });
    });
  });
});
