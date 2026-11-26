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
/** A path an agent can submit from inside a repo checkout: served from that checkout's `.artifacts` root. */
const REPO_PREFIXED_PLAN_PATH = 'mastra/.artifacts/plans/issue-5.md';
/** The same plan submitted as an absolute path, which needs the server's checkout root to normalize. */
const ABSOLUTE_CHECKOUT_PLAN_PATH = '/sandbox/ws/mastra/.artifacts/plans/issue-5.md';
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

/** Stubs the rendered-list route so absolute paths can be normalized against `rootPath`.
 *
 * A string serves every requested root; a map serves `rootPath` per `root` query
 * value, which is how a multi-repository layout answers (`<repo>.artifacts`).
 * With `hold`, responses wait until `release()` so a test can observe the card
 * before the checkout root is known.
 */
function stubRenderedList(rootPath: string | Record<string, string>, { hold = false }: { hold?: boolean } = {}) {
  const pending: Array<() => void> = [];
  const requests: URLSearchParams[] = [];
  let released = !hold;
  server.use(
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, async ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      if (!released) await new Promise<void>(resolve => pending.push(resolve));
      const root = params.get('root') ?? '.artifacts';
      return HttpResponse.json({
        workspacePath: params.get('workspacePath') ?? '',
        root,
        rootPath: typeof rootPath === 'string' ? rootPath : (rootPath[root] ?? ''),
        entries: [],
      });
    }),
  );
  return {
    requests,
    release: () => {
      released = true;
      pending.splice(0).forEach(resolve => resolve());
    },
  };
}

function renderCard(props: Partial<Parameters<typeof SubmitPlanCard>[0]> = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/f-1/user/threads/${WORKSPACE}`]}>
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

      expect(await screen.findByText('Ship dark mode')).toBeInTheDocument();
      expect(await screen.findByText('Add the toggle')).toBeInTheDocument();
      expect(screen.getByText('add-dark-mode.md')).toBeInTheDocument();

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
      await user.click(screen.getByRole('button', { name: 'Approve the plan and build it' }));

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
      expect(screen.getByRole('button', { name: 'Approve the plan and build it' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reject the plan' })).toBeDisabled();
      expect(onRespond).not.toHaveBeenCalled();

      await waitFor(() => expect(releasePlan).toBeTypeOf('function'));
      releasePlan?.();
      await screen.findByText('Ship dark mode');
      expect(screen.getByRole('button', { name: 'Copy plan' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Approve the plan and build it' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Reject the plan' })).toBeEnabled();
    });

    it('disables approve but keeps reject usable when the plan file cannot be read', async () => {
      stubUserSession();
      stubPlanFile({ fail: true });
      const onRespond = vi.fn();
      const user = userEvent.setup();
      renderCard({ onRespond });

      expect(await screen.findByRole('note')).toHaveTextContent('The plan could not be loaded');

      expect(screen.getByRole('button', { name: 'Approve the plan and build it' })).toBeDisabled();

      const reject = screen.getByRole('button', { name: 'Reject the plan' });
      expect(reject).toBeEnabled();
      await user.click(reject);

      expect(onRespond).toHaveBeenCalledWith({ action: 'rejected', path: PLAN_PATH });
    });

    it('normalizes an absolute artifact path against the workspace root before fetching', async () => {
      stubUserSession();
      stubRenderedList('/leadrvision/.artifacts');
      const requests = stubPlanFile();
      renderCard({
        input: { toolId: 'submit_plan', path: '/leadrvision/.artifacts/plans/add-dark-mode.md' },
        onRespond: () => {},
      });

      expect(await screen.findByText('Ship dark mode')).toBeInTheDocument();
      expect(requests).toHaveLength(1);
      expect(requests[0].get('path')).toBe('.artifacts/plans/add-dark-mode.md');
      expect(screen.getByRole('button', { name: 'Approve the plan and build it' })).toBeEnabled();
    });

    it('reads a plan submitted from a repository checkout in a multi-repository workspace', async () => {
      stubUserSession();
      const roots: string[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, ({ request }) => {
          const params = new URL(request.url).searchParams;
          const root = params.get('root') ?? '';
          roots.push(root);
          return HttpResponse.json({
            workspacePath: params.get('workspacePath') ?? '',
            root,
            rootPath: root === 'mastra/.artifacts' ? '/workspace/mastra/.artifacts' : '/workspace/.artifacts',
            entries: [],
          });
        }),
      );
      const requests = stubPlanFile();
      const onRespond = vi.fn();
      const user = userEvent.setup();
      const path = '/workspace/mastra/.artifacts/plans/issue-30361.md';
      renderCard({ input: { toolId: 'submit_plan', path }, onRespond });

      expect(await screen.findByText('Ship dark mode')).toBeInTheDocument();
      expect(roots).toContain('mastra/.artifacts');
      expect(requests).toHaveLength(1);
      expect(requests[0].get('workspacePath')).toBe(WORKSPACE);
      expect(requests[0].get('path')).toBe('mastra/.artifacts/plans/issue-30361.md');
      expect(screen.getByRole('button', { name: 'Approve the plan and build it' })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Reject the plan' }));
      expect(onRespond).toHaveBeenCalledWith({
        action: 'rejected',
        path,
        title: 'Ship dark mode',
        plan: '## Steps\n\n1. Add the toggle',
      });
    });

    it('does not fetch an absolute path outside the workspace artifacts root', async () => {
      stubUserSession();
      stubRenderedList('/leadrvision/.artifacts');
      const requests = stubPlanFile();
      renderCard({
        input: { toolId: 'submit_plan', path: '/leadrvision/secrets/plan.md' },
        onRespond: () => {},
      });

      expect(await screen.findByRole('note')).toHaveTextContent('The plan could not be loaded');
      expect(requests).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Approve the plan and build it' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reject the plan' })).toBeEnabled();
    });

    it('disables Approve for a whitespace-only inline plan', async () => {
      stubUserSession();
      stubPlanFile();
      renderCard({
        input: { toolId: 'submit_plan', path: PLAN_PATH, title: 'Blank plan', plan: '   \n\t  ' },
        onRespond: () => {},
      });

      await screen.findByText('Blank plan');
      expect(screen.getByRole('button', { name: 'Approve the plan and build it' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reject the plan' })).toBeEnabled();
    });

    it('does not fetch paths outside the workspace artifacts root', async () => {
      stubUserSession();
      const requests = stubPlanFile();
      renderCard({ input: { toolId: 'submit_plan', path: '.mastracode/plans/local.md' }, onRespond: () => {} });

      expect(await screen.findByRole('note')).toHaveTextContent('The plan could not be loaded');
      expect(requests).toHaveLength(0);
    });

    it('renders a repo-prefixed path inline, without fetching it, when the host enriched the submission', async () => {
      stubUserSession();
      const failedRequests = stubPlanFile({ fail: true });
      const onRespond = vi.fn();
      const user = userEvent.setup();
      renderCard({
        input: {
          toolId: 'submit_plan',
          path: REPO_PREFIXED_PLAN_PATH,
          title: 'Read the plan at suspend time',
          plan: 'Read the file when the run suspends.',
        },
        onRespond,
      });

      expect(await screen.findByText('Read the plan at suspend time')).toBeInTheDocument();
      expect(screen.getByText('Read the file when the run suspends.')).toBeInTheDocument();
      expect(screen.queryByRole('note')).not.toBeInTheDocument();
      expect(failedRequests).toHaveLength(0);

      await user.click(screen.getByRole('button', { name: 'Approve the plan and build it' }));

      expect(onRespond).toHaveBeenCalledWith({
        action: 'approved',
        path: REPO_PREFIXED_PLAN_PATH,
        title: 'Read the plan at suspend time',
        plan: 'Read the file when the run suspends.',
      });
    });

    it('reads a relative repo-prefixed path directly, without asking for a checkout root', async () => {
      stubUserSession();
      const listing = stubRenderedList('/unused/.artifacts');
      const requests = stubPlanFile();
      const onRespond = vi.fn();
      const user = userEvent.setup();
      renderCard({ input: { toolId: 'submit_plan', path: REPO_PREFIXED_PLAN_PATH }, onRespond });

      expect(await screen.findByText('Ship dark mode')).toBeInTheDocument();
      expect(screen.queryByRole('note')).not.toBeInTheDocument();
      // A relative path is already workspace-relative, so no root is needed.
      expect(listing.requests).toHaveLength(0);
      expect(requests).toHaveLength(1);
      expect(requests[0].get('path')).toBe(REPO_PREFIXED_PLAN_PATH);

      await user.click(screen.getByRole('button', { name: 'Approve the plan and build it' }));

      expect(onRespond).toHaveBeenCalledWith({
        action: 'approved',
        path: REPO_PREFIXED_PLAN_PATH,
        title: 'Ship dark mode',
        plan: '## Steps\n\n1. Add the toggle',
      });
    });

    it('waits for the checkout root before reading an absolute in-checkout path', async () => {
      stubUserSession();
      const listing = stubRenderedList(
        { '.artifacts': '/sandbox/ws/.artifacts', 'mastra/.artifacts': '/sandbox/ws/mastra/.artifacts' },
        { hold: true },
      );
      const requests = stubPlanFile();
      renderCard({ input: { toolId: 'submit_plan', path: ABSOLUTE_CHECKOUT_PLAN_PATH }, onRespond: () => {} });
      // Assert only once the card is blocked on the held listing, not while the session is still loading.
      await waitFor(() => expect(listing.requests.length).toBeGreaterThan(0));

      // The absolute path cannot be turned into a workspace-relative one until
      // the server names that checkout's `.artifacts` root, so the card shows
      // progress, reads no file, and offers no approval.
      expect(screen.getByLabelText('Loading plan')).toBeInTheDocument();
      expect(requests).toHaveLength(0);
      expect(screen.queryByRole('note')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Approve the plan and build it' })).toBeDisabled();

      listing.release();

      expect(await screen.findByText('Ship dark mode')).toBeInTheDocument();
      expect(requests).toHaveLength(1);
      expect(requests[0].get('path')).toBe(REPO_PREFIXED_PLAN_PATH);
    });

    it('keeps Approve disabled when the checkout file read fails', async () => {
      stubUserSession();
      stubRenderedList({
        '.artifacts': '/sandbox/ws/.artifacts',
        'mastra/.artifacts': '/sandbox/ws/mastra/.artifacts',
      });
      const requests = stubPlanFile({ fail: true });
      renderCard({ input: { toolId: 'submit_plan', path: ABSOLUTE_CHECKOUT_PLAN_PATH }, onRespond: () => {} });

      // Resolving the checkout root and reading the file both have to settle
      // before the card can say the plan is unloadable.
      expect(screen.getByLabelText('Loading plan')).toBeInTheDocument();
      expect(await screen.findByRole('note')).toHaveTextContent('The plan could not be loaded');
      expect(requests).toHaveLength(1);
      expect(requests[0].get('path')).toBe(REPO_PREFIXED_PLAN_PATH);
      expect(screen.getByRole('button', { name: 'Approve the plan and build it' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reject the plan' })).toBeEnabled();
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
