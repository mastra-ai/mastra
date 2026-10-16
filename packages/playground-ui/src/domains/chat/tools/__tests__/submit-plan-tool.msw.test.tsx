// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmitPlanTool } from '../submit-plan-tool';
import type { SubmitPlanToolProps } from '../submit-plan-tool';
import { submittedPlanFile, submittedPlanPath } from './fixtures/submit-plan';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const toolCallId = 'submit-plan-call';

const stubContentHeight = (height: number) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => height,
  });
};

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

function renderSubmitPlan(
  props: SubmitPlanToolProps,
  {
    toolCallApprovals = {},
    isContinuationBlocked = false,
  }: { toolCallApprovals?: Record<string, { status: 'approved' | 'declined' }>; isContinuationBlocked?: boolean } = {},
) {
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
          toolCallApprovals={toolCallApprovals}
          isContinuationBlocked={isContinuationBlocked}
          networkToolCallApprovals={{}}
        >
          <SubmitPlanTool {...props} />
        </ToolCallProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { approveToolcall };
}

function usePlanFileHandler(planFile = submittedPlanFile) {
  server.use(
    http.get(`${BASE_URL}/api/agents/:agentId/plans/file`, ({ params, request }) => {
      const path = new URL(request.url).searchParams.get('path');
      if (params.agentId !== 'plan-agent' || path !== submittedPlanPath) {
        return HttpResponse.json({ message: 'Plan not found' }, { status: 404 });
      }
      return HttpResponse.json(planFile);
    }),
  );
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
});

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

      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Approve the plan' }).disabled).toBe(true);
      await screen.findByRole('heading', { name: 'Add dark mode' });
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Approve the plan' }).disabled).toBe(false);
    });

    it('disables both plan decisions when the run continuation is fatally blocked', async () => {
      usePlanFileHandler();

      renderSubmitPlan(pendingProps, { isContinuationBlocked: true });

      await screen.findByRole('heading', { name: 'Add dark mode' });
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Approve the plan' }).disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Reject the plan' }).disabled).toBe(true);
    });

    it('does not submit either plan decision when the run continuation is fatally blocked', async () => {
      usePlanFileHandler();
      const { approveToolcall } = renderSubmitPlan(pendingProps, { isContinuationBlocked: true });

      await screen.findByRole('heading', { name: 'Add dark mode' });
      fireEvent.click(screen.getByRole('button', { name: 'Approve the plan' }));
      fireEvent.click(screen.getByRole('button', { name: 'Reject the plan' }));

      expect(approveToolcall).not.toHaveBeenCalled();
    });

    it('keeps the approval action on one line without shrinking', async () => {
      usePlanFileHandler();

      renderSubmitPlan(pendingProps);

      await screen.findByRole('heading', { name: 'Add dark mode' });
      const approveButton = screen.getByRole('button', { name: 'Approve the plan' });

      expect(approveButton.classList.contains('shrink-0')).toBe(true);
      expect(approveButton.classList.contains('whitespace-nowrap')).toBe(true);
    });

    it('offers expansion when a short plan overflows the collapsed height', async () => {
      stubContentHeight(221);
      const overflowingPlanFile = {
        ...submittedPlanFile,
        content: '# Short plan\n\nA tall rendered block.',
      };
      usePlanFileHandler(overflowingPlanFile);

      renderSubmitPlan(pendingProps);

      expect(await screen.findByRole('button', { name: 'Expand plan' })).not.toBeNull();
    });

    it('keeps the decisions right-aligned when a long plan does not overflow', async () => {
      server.use(
        http.get(`${BASE_URL}/api/agents/:agentId/plans/file`, () =>
          HttpResponse.json({
            path: submittedPlanPath,
            content: `# Long plan\n\n${'x'.repeat(501)}`,
          }),
        ),
      );

      renderSubmitPlan(pendingProps);

      await screen.findByRole('heading', { name: 'Long plan' });
      expect(screen.queryByRole('button', { name: 'Expand plan' })).toBeNull();

      const decisions = document.querySelector('[data-slot="plan-decisions"]');
      expect(decisions?.classList.contains('ml-auto')).toBe(true);
      expect(decisions?.children).toHaveLength(3);
    });

    it('resumes the tool with the displayed plan when approved', async () => {
      usePlanFileHandler();
      const { approveToolcall } = renderSubmitPlan(pendingProps);

      await screen.findByRole('heading', { name: 'Add dark mode' });
      fireEvent.click(screen.getByRole('button', { name: 'Approve the plan' }));

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

  describe('when the reviewer requests changes', () => {
    beforeEach(() => {
      usePlanFileHandler();
    });

    async function openFeedbackForm() {
      const rendered = renderSubmitPlan(pendingProps);
      await screen.findByRole('heading', { name: 'Add dark mode' });
      fireEvent.click(screen.getByRole('button', { name: 'Request changes' }));
      return rendered;
    }

    it('offers Request changes next to Approve and Reject', async () => {
      usePlanFileHandler();
      renderSubmitPlan(pendingProps);

      await screen.findByRole('heading', { name: 'Add dark mode' });

      expect(screen.getByRole('button', { name: 'Request changes' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Approve the plan' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Reject the plan' })).not.toBeNull();
      expect(screen.queryByRole('textbox', { name: 'Requested changes' })).toBeNull();
    });

    it('swaps the decisions for a separated feedback field', async () => {
      await openFeedbackForm();

      expect(screen.getByRole('separator')).not.toBeNull();
      expect(screen.getByRole('textbox', { name: 'Requested changes' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Send feedback' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Approve the plan' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reject the plan' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Request changes' })).toBeNull();
    });

    it('keeps Send feedback disabled until the feedback has content', async () => {
      await openFeedbackForm();
      const send = screen.getByRole<HTMLButtonElement>('button', { name: 'Send feedback' });

      expect(send.disabled).toBe(true);
      fireEvent.change(screen.getByRole('textbox', { name: 'Requested changes' }), { target: { value: '   ' } });
      expect(send.disabled).toBe(true);
      fireEvent.change(screen.getByRole('textbox', { name: 'Requested changes' }), { target: { value: 'Add tests' } });
      expect(send.disabled).toBe(false);
    });

    it('resumes the tool as rejected with the trimmed feedback', async () => {
      const { approveToolcall } = await openFeedbackForm();

      fireEvent.change(screen.getByRole('textbox', { name: 'Requested changes' }), {
        target: { value: '  Cover the settings page too  ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));

      expect(approveToolcall).toHaveBeenCalledWith(toolCallId, {
        action: 'rejected',
        feedback: 'Cover the settings page too',
        path: submittedPlanPath,
        title: 'Add dark mode',
        plan: submittedPlanFile.content,
      });
    });

    it('closes the feedback field on Cancel without resuming', async () => {
      const { approveToolcall } = await openFeedbackForm();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('textbox', { name: 'Requested changes' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Approve the plan' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Request changes' })).not.toBeNull();
      expect(approveToolcall).not.toHaveBeenCalled();
    });
  });

  describe('when the plan has already been answered', () => {
    it('disables every decision control', async () => {
      usePlanFileHandler();
      renderSubmitPlan(pendingProps, { toolCallApprovals: { [toolCallId]: { status: 'approved' } } });

      await screen.findByRole('heading', { name: 'Add dark mode' });

      for (const name of ['Approve the plan', 'Reject the plan', 'Request changes']) {
        expect(screen.getByRole<HTMLButtonElement>('button', { name }).disabled).toBe(true);
      }
    });
  });

  describe('when a resolved plan carries the reviewer decision', () => {
    function renderResolved(submittedPlan: Record<string, unknown>) {
      renderSubmitPlan({
        agentId: 'plan-agent',
        toolName: 'submit_plan',
        toolCallId,
        output: {
          content: 'Plan resolved.',
          isError: false,
          submittedPlan: { title: 'Persisted plan', path: submittedPlanPath, plan: 'Persisted body', ...submittedPlan },
        },
      });
    }

    it('shows Approved for an approved plan', async () => {
      renderResolved({ action: 'approved' });

      expect(await screen.findByText('Approved')).not.toBeNull();
    });

    it('shows Rejected for a plan rejected without feedback', async () => {
      renderResolved({ action: 'rejected' });

      expect(await screen.findByText('Rejected')).not.toBeNull();
    });

    it('shows Changes requested and the feedback when feedback was given', async () => {
      renderResolved({ action: 'rejected', feedback: 'Cover the settings page too' });

      expect(await screen.findByText('Changes requested')).not.toBeNull();
      expect(screen.getByText('Cover the settings page too')).not.toBeNull();
    });

    it('shows no status for legacy history without a decision', async () => {
      renderResolved({});

      await screen.findByRole('heading', { name: 'Persisted plan' });
      for (const label of ['Approved', 'Rejected', 'Changes requested']) {
        expect(screen.queryByText(label)).toBeNull();
      }
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

    it('offers expansion when short persisted content overflows the collapsed height', async () => {
      stubContentHeight(221);

      renderSubmitPlan({
        agentId: 'plan-agent',
        toolName: 'submit_plan',
        toolCallId,
        output: {
          content: 'Plan approved.',
          isError: false,
          submittedPlan: {
            title: 'Short persisted plan',
            path: submittedPlanPath,
            plan: 'A tall rendered block.',
          },
        },
      });

      expect(await screen.findByRole('button', { name: 'Expand plan' })).not.toBeNull();
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
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Approve the plan' }).disabled).toBe(false);
    });
  });
});
