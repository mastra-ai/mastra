import { submitPlanTool } from '@mastra/core/tools';
import { describe, expect, it, vi } from 'vitest';

import { createSubmitPlanTool } from '../submit-plan.js';

const PROJECT_PATH = '/workspace';
const PLANS_DIR = '.artifacts/plans';

const PLAN_MARKDOWN = ['# Fail fast on unrenderable plan paths', '', 'Read the plan at suspend time.'].join('\n');

function createAgentControllerCtx(state: Record<string, unknown> = {}) {
  const getState = () => ({ projectPath: PROJECT_PATH, ...state });
  return {
    getState,
    setState: vi.fn(),
    session: {
      state: {
        get: getState,
        set: vi.fn(),
      },
    },
  };
}

function createFilesystem(files: Record<string, string> = {}) {
  const readFile = vi.fn(async (target: string) => {
    const content = files[target];
    if (content === undefined) {
      throw new Error(`File not found: ${target}`);
    }
    return content;
  });
  return { readFile };
}

/**
 * The tool pauses via the native tool-suspension primitive. The first pass calls
 * `suspend({ toolId, path, title, plan })` and returns; the host resumes the tool with the
 * user's decision as `resumeData`.
 */
function suspendPass(agentControllerCtx: any, filesystem?: any) {
  const suspend = vi.fn();
  const context = {
    agent: { suspend },
    requestContext: { get: (key: string) => (key === 'controller' ? agentControllerCtx : undefined) },
    workspace: filesystem ? { filesystem } : {},
  };
  return { context, suspend };
}

function resumePass(resumeData: Record<string, unknown>, agentControllerCtx: any, filesystem?: any) {
  const context = {
    agent: { resumeData },
    requestContext: { get: (key: string) => (key === 'controller' ? agentControllerCtx : undefined) },
    workspace: filesystem ? { filesystem } : {},
  };
  return { context };
}

function tool() {
  return createSubmitPlanTool({ plansDir: PLANS_DIR });
}

describe('submit_plan (host tool)', () => {
  it('keeps the builtin tool id so boards, approvals and rejection handling keep matching', () => {
    // The host tool replaces `controllerBuiltIn.submit_plan` by name; if the id drifted the
    // builtin would win and the plan body would never be enriched.
    expect(tool().id).toBe(submitPlanTool.id);
    expect(tool().id).toBe('submit_plan');
  });
  it('suspends with the plan title and body read at submit time', async () => {
    // The session filesystem is rooted at the session workdir, so it is read through the
    // workspace-relative path rather than the absolute host one.
    const filesystem = createFilesystem({ [`${PLANS_DIR}/issue-5.md`]: PLAN_MARKDOWN });
    const { context, suspend } = suspendPass(createAgentControllerCtx(), filesystem);

    await tool().execute({ path: `${PLANS_DIR}/issue-5.md` }, context);

    expect(filesystem.readFile).toHaveBeenCalledWith(`${PLANS_DIR}/issue-5.md`, { encoding: 'utf-8' });
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(suspend.mock.calls[0]?.[0]).toEqual({
      toolId: 'submit_plan',
      path: `${PLANS_DIR}/issue-5.md`,
      title: 'Fail fast on unrenderable plan paths',
      plan: 'Read the plan at suspend time.',
    });
  });

  it('keeps a plan without a heading usable and titles it from the body', async () => {
    const filesystem = createFilesystem({ [`${PLANS_DIR}/plain.md`]: 'Just the plan.\n' });
    const { context, suspend } = suspendPass(createAgentControllerCtx(), filesystem);

    await tool().execute({ path: `${PLANS_DIR}/plain.md` }, context);

    expect(suspend.mock.calls[0]?.[0]).toMatchObject({ title: '', plan: 'Just the plan.' });
  });

  it('fails fast without suspending when the path is inside a repository checkout', async () => {
    const filesystem = createFilesystem({});
    const { context, suspend } = suspendPass(createAgentControllerCtx(), filesystem);

    const result = await tool().execute({ path: 'mastra/.artifacts/plans/issue-5.md' }, context);

    expect(suspend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain(`${PROJECT_PATH}/${PLANS_DIR}/<name>.md`);
    expect(result.content).toContain('must not be prefixed with a repository directory name');
  });

  it('fails fast without suspending for an absolute path inside a checkout', async () => {
    const filesystem = createFilesystem({});
    const { context, suspend } = suspendPass(createAgentControllerCtx(), filesystem);

    const result = await tool().execute({ path: `${PROJECT_PATH}/mastra/.artifacts/plans/issue-5.md` }, context);

    expect(suspend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain(`${PROJECT_PATH}/${PLANS_DIR}/<name>.md`);
  });

  it('fails fast when the plan file cannot be read', async () => {
    const filesystem = createFilesystem({});
    const { context, suspend } = suspendPass(createAgentControllerCtx(), filesystem);

    const result = await tool().execute({ path: `${PLANS_DIR}/missing.md` }, context);

    expect(suspend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain('could not be read');
  });

  it('fails fast instead of suspending an empty plan', async () => {
    // An empty body would park a card with Approve disabled — the exact failure this fixes.
    const filesystem = createFilesystem({ [`${PLANS_DIR}/blank.md`]: '# Only a title\n\n   \n' });
    const { context, suspend } = suspendPass(createAgentControllerCtx(), filesystem);

    const result = await tool().execute({ path: `${PLANS_DIR}/blank.md` }, context);

    expect(suspend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain('is empty, so there is nothing to review');
  });

  it('fails fast when the session has no workspace filesystem', async () => {
    const { context, suspend } = suspendPass(createAgentControllerCtx());

    const result = await tool().execute({ path: `${PLANS_DIR}/issue-5.md` }, context);

    expect(suspend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain('session workspace filesystem is not available');
  });

  it('reports an approved resume with the reviewed plan', async () => {
    const at = new Date().toISOString();
    const reviewedPlan = {
      title: 'Fail fast on unrenderable plan paths',
      path: `${PLANS_DIR}/issue-5.md`,
      plan: 'Read the plan at suspend time.',
    };
    const { context } = resumePass({ action: 'approved', ...reviewedPlan, at }, createAgentControllerCtx());

    const result = await tool().execute({ path: `${PLANS_DIR}/issue-5.md` }, context);

    expect(result).toMatchObject({
      isError: false,
      content: 'Plan approved. Proceed with implementation following the approved plan.',
      submittedPlan: { ...reviewedPlan, action: 'approved' },
    });
  });

  it('reports a rejected resume with feedback', async () => {
    const { context } = resumePass(
      { action: 'rejected', feedback: 'Split phase 2 out.', path: `${PLANS_DIR}/issue-5.md` },
      createAgentControllerCtx(),
    );

    const result = await tool().execute({ path: `${PLANS_DIR}/issue-5.md` }, context);

    expect(result).toMatchObject({ isError: false, submittedPlan: { action: 'rejected' } });
    expect(result.content).toContain('Split phase 2 out.');
  });

  it('tells the agent to stop when a rejection carries no feedback', async () => {
    const { context } = resumePass({ action: 'rejected' }, createAgentControllerCtx());

    const result = await tool().execute({ path: `${PLANS_DIR}/issue-5.md` }, context);

    expect(result).toMatchObject({ isError: false, submittedPlan: { action: 'rejected' } });
    expect(result.content).toContain('Stop now and wait for the user to provide feedback');
  });

  it('surfaces the path when there is no suspension capability', async () => {
    const context = {
      requestContext: { get: () => undefined },
      workspace: {},
    };

    const result = await createSubmitPlanTool().execute({ path: `${PLANS_DIR}/issue-5.md` }, context);

    expect(result).toMatchObject({ isError: false });
    expect(result.content).toContain(`${PLANS_DIR}/issue-5.md`);
  });
});
