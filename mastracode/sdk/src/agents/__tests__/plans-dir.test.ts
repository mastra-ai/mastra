import { WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';

// Keep prompt tests independent from optional web-search package artifacts.
vi.mock('../../tools/index.js', () => ({
  hasParallelKey: () => false,
  hasTavilyKey: () => false,
}));

import { MC_TOOLS } from '../../tool-names.js';
import { getDynamicInstructions } from '../instructions.js';
import { createMastraCodeWorkspaceTools } from '../tool-availability.js';

// A Factory user session: Factory-hosted, but its state carries no factoryProjectId.
function requestContextFor(modeId: string) {
  const controller = {
    getState: () => ({ projectPath: '', projectName: 'workspace', permissionRules: { tools: {} } }),
    session: { modeId },
  };
  return { get: (key: string) => (key === 'controller' ? controller : undefined) };
}

describe('host-configured plansDir', () => {
  it('tells a build-mode session without factoryProjectId to write plans under the host plans dir', async () => {
    const prompt = await getDynamicInstructions({
      requestContext: requestContextFor('build'),
      plansDir: '.artifacts/plans',
    });

    expect(prompt).toContain('Write plan files under `.artifacts/plans/`');
    expect(prompt).toContain('never under `.mastracode/plans/`');
  });

  it('uses the host plans dir in plan-mode prompts instead of the per-session default', async () => {
    const prompt = await getDynamicInstructions({
      requestContext: requestContextFor('plan'),
      plansDir: '.artifacts/plans/',
    });

    expect(prompt).toContain('`.artifacts/plans/add-dark-mode.md`');
    expect(prompt).not.toContain('.mastracode/plans/');
  });

  it('adds no build-mode plan path guidance when the default plans dir is in use', async () => {
    const prompt = await getDynamicInstructions({ requestContext: requestContextFor('build') });

    expect(prompt).not.toContain('Write plan files under');
  });

  it('omits the build-mode plan path guidance when submit_plan is disabled', async () => {
    const prompt = await getDynamicInstructions({
      requestContext: requestContextFor('build'),
      plansDir: '.artifacts/plans',
      disabledBuiltinTools: ['submit_plan'],
    });

    expect(prompt).not.toContain('Write plan files under');
  });

  it('lets the plan-mode write guard allow the host plans dir and refuse the default one', () => {
    const guard = createMastraCodeWorkspaceTools(false, '.artifacts/plans').hooks!.beforeToolCall!;
    const projectPath = '/tmp/mastracode-plans-dir-guard';
    const context = {
      requestContext: {
        harness: { session: { modeId: 'plan', state: { get: () => ({ projectPath }) } } },
      },
    };
    const write = (path: string) =>
      guard({
        toolName: MC_TOOLS.WRITE_FILE,
        workspaceToolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
        input: { path },
        context,
      } as Parameters<typeof guard>[0]);

    expect(write('.artifacts/plans/add-dark-mode.md')).toBeUndefined();
    expect(write('.mastracode/plans/add-dark-mode.md')).toMatchObject({
      proceed: false,
      output:
        'Plan mode can only write plan files inside .artifacts/plans/. Refusing to edit .mastracode/plans/add-dark-mode.md.',
    });
  });
});
