import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runWorkflow: vi.fn(),
}));

vi.mock('@mastra/code-sdk/workflows/service', () => ({
  deleteWorkflow: vi.fn(),
  getWorkflow: vi.fn(),
  listWorkflows: vi.fn(),
  runWorkflow: mocks.runWorkflow,
}));

import { handleWorkflowsCommand } from '../workflows.js';

function createCtx() {
  return {
    controller: {
      getMastra: vi.fn(() => undefined),
    },
    showError: vi.fn(),
    showInfo: vi.fn(),
  } as any;
}

describe('handleWorkflowsCommand', () => {
  beforeEach(() => {
    mocks.runWorkflow.mockReset();
  });

  it.each(['help', '?', '--help'])('shows %s without requiring a Mastra instance', async subcommand => {
    const ctx = createCtx();

    await handleWorkflowsCommand(ctx, [subcommand]);

    expect(ctx.controller.getMastra).not.toHaveBeenCalled();
    expect(ctx.showError).not.toHaveBeenCalled();
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Dynamic Workflows'));
  });

  it('preserves repeated spaces in workflow run JSON input', async () => {
    const mastra = {};
    const ctx = createCtx();
    ctx.controller.getMastra.mockReturnValue(mastra);
    mocks.runWorkflow.mockResolvedValue({ status: 'success', result: { greeting: 'Hello' } });

    await handleWorkflowsCommand(
      ctx,
      ['run', 'greeting', '{"name":"Ada', 'Lovelace"}'],
      'run greeting {"name":"Ada  Lovelace"}',
    );

    expect(mocks.runWorkflow).toHaveBeenCalledWith(
      mastra,
      'greeting',
      { name: 'Ada  Lovelace' },
      undefined,
      expect.any(Function),
    );
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  it('preserves non-Error workflow command failures', async () => {
    const ctx = createCtx();
    ctx.controller.getMastra.mockReturnValue({});
    mocks.runWorkflow.mockRejectedValue('connection lost');

    await handleWorkflowsCommand(ctx, ['run', 'greeting'], 'run greeting {}');

    expect(ctx.showError).toHaveBeenCalledWith('Workflow command failed: connection lost');
  });
});
