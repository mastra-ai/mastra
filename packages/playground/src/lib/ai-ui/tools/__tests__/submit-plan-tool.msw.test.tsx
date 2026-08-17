// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubmitPlanTool } from '../submit-plan-tool';
import type { SubmitPlanToolProps } from '../submit-plan-tool';
import { submittedPlanFile, submittedPlanPath } from './fixtures/submit-plan';
import { ToolCallProvider } from '@/services/tool-call-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const toolCallId = 'submit-plan-call';

const pendingProps: SubmitPlanToolProps = {
  agentId: 'plan-agent',
  toolName: 'submit_plan',
  toolCallId,
  output: undefined,
  metadata: {
    suspendedTools: {
      [toolCallId]: {
        suspendPayload: { path: submittedPlanPath },
      },
    },
  },
};

function renderSubmitPlan(props: SubmitPlanToolProps) {
  const approveToolcall = vi.fn<(toolCallId: string, resumeData?: unknown) => void>();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ToolCallProvider
          approveToolcall={approveToolcall}
          declineToolcall={vi.fn()}
          approveToolcallGenerate={vi.fn()}
          declineToolcallGenerate={vi.fn()}
          approveNetworkToolcall={vi.fn()}
          declineNetworkToolcall={vi.fn()}
          isRunning={false}
          toolCallApprovals={{}}
          networkToolCallApprovals={{}}
        >
          <SubmitPlanTool {...props} />
        </ToolCallProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { approveToolcall };
}

function usePlanFileHandler() {
  server.use(
    http.get(`${BASE_URL}/api/agents/:agentId/plans/file`, ({ params, request }) => {
      const path = new URL(request.url).searchParams.get('path');
      if (params.agentId !== 'plan-agent' || path !== submittedPlanPath) {
        return HttpResponse.json({ message: 'Plan not found' }, { status: 404 });
      }
      return HttpResponse.json(submittedPlanFile);
    }),
  );
}

afterEach(() => cleanup());

describe('SubmitPlanTool', () => {
  describe('when submit_plan is suspended with a plan path', () => {
    it('reads suspend metadata keyed by the canonical tool name', async () => {
      usePlanFileHandler();

      renderSubmitPlan({
        ...pendingProps,
        metadata: {
          suspendedTools: {
            submit_plan: {
              suspendPayload: { path: submittedPlanPath },
            },
          },
        },
      });

      expect(await screen.findByRole('heading', { name: 'Add dark mode' })).not.toBeNull();
    });

    it('renders the markdown returned by the agent plan endpoint', async () => {
      usePlanFileHandler();

      renderSubmitPlan(pendingProps);

      expect(await screen.findByRole('heading', { name: 'Add dark mode' })).not.toBeNull();
      expect(screen.getByText('Use semantic color tokens throughout the interface.')).not.toBeNull();
    });

    it('prevents approval until the plan content has loaded', async () => {
      server.use(
        http.get(`${BASE_URL}/api/agents/:agentId/plans/file`, async () => {
          await delay(50);
          return HttpResponse.json(submittedPlanFile);
        }),
      );

      renderSubmitPlan(pendingProps);

      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Approve the plan and switch to build' }).disabled).toBe(
        true,
      );
      await screen.findByRole('heading', { name: 'Add dark mode' });
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Approve the plan and switch to build' }).disabled).toBe(
        false,
      );
    });

    it('keeps the approval action on one line without shrinking', async () => {
      usePlanFileHandler();

      renderSubmitPlan(pendingProps);

      await screen.findByRole('heading', { name: 'Add dark mode' });
      const approveButton = screen.getByRole('button', { name: 'Approve the plan and switch to build' });

      expect(approveButton.classList.contains('shrink-0')).toBe(true);
      expect(approveButton.classList.contains('whitespace-nowrap')).toBe(true);
    });

    it('resumes the tool with the displayed plan when approved', async () => {
      usePlanFileHandler();
      const { approveToolcall } = renderSubmitPlan(pendingProps);

      await screen.findByRole('heading', { name: 'Add dark mode' });
      fireEvent.click(screen.getByRole('button', { name: 'Approve the plan and switch to build' }));

      expect(approveToolcall).toHaveBeenCalledWith(toolCallId, {
        action: 'approved',
        path: submittedPlanPath,
        title: 'Add dark mode',
        plan: submittedPlanFile.content,
      });
    });

    it('resumes the tool with a rejected action when rejected', async () => {
      usePlanFileHandler();
      const { approveToolcall } = renderSubmitPlan(pendingProps);

      await screen.findByRole('heading', { name: 'Add dark mode' });
      fireEvent.click(screen.getByRole('button', { name: 'Reject the plan' }));

      expect(approveToolcall).toHaveBeenCalledWith(toolCallId, {
        action: 'rejected',
        path: submittedPlanPath,
        title: 'Add dark mode',
        plan: submittedPlanFile.content,
      });
    });
  });

  describe('when submit_plan has already resolved', () => {
    it('renders the persisted submittedPlan without requesting the file again', async () => {
      const onPlanRequest = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/agents/:agentId/plans/file`, () => {
          onPlanRequest();
          return HttpResponse.json(submittedPlanFile);
        }),
      );

      renderSubmitPlan({
        agentId: 'plan-agent',
        toolName: 'submit_plan',
        toolCallId,
        output: {
          content: 'Plan approved.',
          isError: false,
          submittedPlan: {
            title: 'Persisted plan',
            path: submittedPlanPath,
            plan: '## Persisted step\n\nThis content came from the transcript.',
          },
        },
      });

      expect(await screen.findByRole('heading', { name: 'Persisted plan' })).not.toBeNull();
      expect(screen.getByText('This content came from the transcript.')).not.toBeNull();
      expect(onPlanRequest).not.toHaveBeenCalled();
    });
  });

  describe('when the plan endpoint cannot load the file', () => {
    it('keeps approval controls available beside an inline error', async () => {
      server.use(
        http.get(`${BASE_URL}/api/agents/:agentId/plans/file`, () =>
          HttpResponse.json({ message: 'Plan not found' }, { status: 404 }),
        ),
      );

      renderSubmitPlan(pendingProps);

      expect(await screen.findByText('Unable to load the submitted plan.')).not.toBeNull();
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Approve the plan and switch to build' }).disabled).toBe(
        false,
      );
    });
  });
});
