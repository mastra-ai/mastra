import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { WorkspaceFile } from '../../../../../api/types';
import type { FactoryUserSession } from '../../../workspaces/services/user-sessions';
import { SubmitPlanCard } from '../SubmitPlanCard';

const PLAN_PATH = '.artifacts/plans/add-dark-mode.md';
const WORKSPACE = 'sc-session-1';
const PLAN_MARKDOWN = '# Ship dark mode\n\n## Steps\n\n1. Add the toggle';

const stubContentHeight = (height: number) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => height,
  });
};

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
});

const userSession = {
  id: 'thread-1',
  sessionId: WORKSPACE,
  projectRepositoryId: 'repo-1',
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'private',
  title: 'Dark mode',
  branch: 'mastra/user/dark-mode',
  baseBranch: 'main',
  sandboxId: 'sb-1',
  sandboxWorkdir: '/workspaces/dark-mode',
  materializedAt: '2026-08-19T10:00:00.000Z',
  createdAt: '2026-08-19T10:00:00.000Z',
  updatedAt: '2026-08-19T10:00:00.000Z',
} satisfies FactoryUserSession;

function workspaceFile(params: URLSearchParams): WorkspaceFile {
  return {
    workspacePath: params.get('workspacePath') ?? '',
    path: params.get('path') ?? '',
    name: 'add-dark-mode.md',
    size: PLAN_MARKDOWN.length,
    updatedAt: '2026-08-19T10:05:00.000Z',
    contentType: 'text',
    content: PLAN_MARKDOWN,
  };
}

function stubUserSession() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/user-sessions/:threadId`, () => HttpResponse.json({ session: userSession })),
  );
}

/** Records plan-file reads; responds with the plan markdown unless `fail` is set. */
function stubPlanFile({ fail = false }: { fail?: boolean } = {}) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/workspace/file`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      if (fail) return HttpResponse.json({ error: 'Session workspace is not available' }, { status: 403 });
      return HttpResponse.json(workspaceFile(params));
    }),
  );
  return requests;
}

function renderCard(props: Partial<Parameters<typeof SubmitPlanCard>[0]> = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/f-1/user/threads/thread-1']}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={<SubmitPlanCard toolCallId="call-1" input={{ toolId: 'submit_plan', path: PLAN_PATH }} {...props} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SubmitPlanCard', () => {
  describe('when a plan is pending approval', () => {
    it('reads the plan file from the session workspace and renders its title and body', async () => {
      stubUserSession();
      const requests = stubPlanFile();
      renderCard({ onRespond: () => {} });

      // The `# heading` becomes the card title, the rest the rendered body.
      expect(await screen.findByText('Ship dark mode')).toBeInTheDocument();
      expect(await screen.findByText('Add the toggle')).toBeInTheDocument();
      expect(screen.getByText('add-dark-mode.md')).toBeInTheDocument();

      // The read is scoped to this session's workspace, not a raw disk path.
      expect(requests).toHaveLength(1);
      expect(requests[0].get('workspacePath')).toBe(WORKSPACE);
      expect(requests[0].get('path')).toBe(PLAN_PATH);
    });

    it('back-fills the rendered plan into the approval resume data for durable history', async () => {
      stubUserSession();
      stubPlanFile();
      const onRespond = vi.fn();
      const user = userEvent.setup();
      renderCard({ onRespond });

      await screen.findByText('Ship dark mode');
      await user.click(screen.getByRole('button', { name: 'Approve the plan and switch to build' }));

      expect(onRespond).toHaveBeenCalledWith({
        action: 'approved',
        path: PLAN_PATH,
        title: 'Ship dark mode',
        plan: '## Steps\n\n1. Add the toggle',
      });
    });

    it('blocks copy and responses while the plan file is loading', async () => {
      stubUserSession();
      let releasePlan: (() => void) | undefined;
      server.use(
        http.get(`${TEST_BASE_URL}/web/workspace/file`, async ({ request }) => {
          await new Promise<void>(resolve => {
            releasePlan = resolve;
          });
          const params = new URL(request.url).searchParams;
          return HttpResponse.json(workspaceFile(params));
        }),
      );
      const onRespond = vi.fn();
      renderCard({ onRespond });

      expect(await screen.findByLabelText('Loading plan')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Copy plan' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Approve the plan and switch to build' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reject the plan' })).toBeDisabled();
      expect(onRespond).not.toHaveBeenCalled();

      await waitFor(() => expect(releasePlan).toBeTypeOf('function'));
      releasePlan?.();
      await screen.findByText('Ship dark mode');
      expect(screen.getByRole('button', { name: 'Copy plan' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Approve the plan and switch to build' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Reject the plan' })).toBeEnabled();
    });

    it('keeps approve and reject usable when the plan file cannot be read', async () => {
      stubUserSession();
      stubPlanFile({ fail: true });
      const onRespond = vi.fn();
      const user = userEvent.setup();
      renderCard({ onRespond });

      expect(await screen.findByRole('note')).toHaveTextContent('The plan could not be loaded');

      const reject = screen.getByRole('button', { name: 'Reject the plan' });
      expect(reject).toBeEnabled();
      await user.click(reject);

      // No content to back-fill — only the action and path travel.
      expect(onRespond).toHaveBeenCalledWith({ action: 'rejected', path: PLAN_PATH });
    });

    it('does not fetch paths outside the workspace artifacts root', async () => {
      stubUserSession();
      const requests = stubPlanFile();
      renderCard({ input: { toolId: 'submit_plan', path: '.mastracode/plans/local.md' }, onRespond: () => {} });

      expect(await screen.findByRole('note')).toHaveTextContent('The plan could not be loaded');
      expect(requests).toHaveLength(0);
    });
  });

  describe('expand affordance', () => {
    it('hides the expand control for a plan that fits the collapsed card', async () => {
      stubUserSession();
      stubPlanFile();
      renderCard({ onRespond: () => {} });

      await screen.findByText('Ship dark mode');
      expect(screen.queryByRole('button', { name: 'Expand plan' })).not.toBeInTheDocument();
    });

    it('offers expansion when the rendered plan overflows the collapsed card', async () => {
      stubContentHeight(1000);
      stubUserSession();
      stubPlanFile();
      renderCard({
        onRespond: () => {},
        // Inline plan: no fetch needed; the layout stub reports actual overflow.
        input: { path: PLAN_PATH, title: 'Long plan', plan: `detailed step\n`.repeat(60) },
      });

      expect(await screen.findByText('Long plan')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Expand plan' })).toBeInTheDocument();
    });

    it('hides the expand control on a resolved short plan (after approve or reject)', async () => {
      stubUserSession();
      renderCard({
        input: { path: PLAN_PATH },
        output: {
          toolId: 'submit_plan',
          content: 'Plan rejected.',
          submittedPlan: { title: 'Ship dark mode', path: PLAN_PATH, plan: 'Persisted body' },
        },
      });

      expect(await screen.findByText('Ship dark mode')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Expand plan' })).not.toBeInTheDocument();
    });

    it('keeps the expand control on a resolved overflowing plan', async () => {
      stubContentHeight(1000);
      stubUserSession();
      renderCard({
        input: { path: PLAN_PATH },
        output: {
          toolId: 'submit_plan',
          content: 'Plan approved.',
          submittedPlan: { title: 'Long plan', path: PLAN_PATH, plan: `detailed step\n`.repeat(60) },
        },
      });

      expect(await screen.findByText('Long plan')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Expand plan' })).toBeInTheDocument();
    });
  });

  describe('when a resolved call carries the persisted plan', () => {
    it('renders revision feedback with the rejected plan', async () => {
      stubUserSession();
      renderCard({
        input: { path: PLAN_PATH },
        output: {
          toolId: 'submit_plan',
          content: 'Plan rejected.',
          submittedPlan: {
            title: 'Ship dark mode',
            path: PLAN_PATH,
            plan: 'Persisted body',
            feedback: 'Add a rollback step.',
          },
        },
      });

      expect(await screen.findByRole('note', { name: 'Plan feedback' })).toHaveTextContent('Add a rollback step.');
    });

    it('renders result.submittedPlan without refetching the plan file', async () => {
      stubUserSession();
      const requests = stubPlanFile();
      renderCard({
        input: { path: PLAN_PATH },
        output: {
          toolId: 'submit_plan',
          content: 'Plan approved.',
          submittedPlan: { title: 'Ship dark mode', path: PLAN_PATH, plan: 'Persisted body' },
        },
      });

      expect(await screen.findByText('Ship dark mode')).toBeInTheDocument();
      expect(screen.getByText('Persisted body')).toBeInTheDocument();
      await waitFor(() => expect(requests).toHaveLength(0));
    });
  });
});
