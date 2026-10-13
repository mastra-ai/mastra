import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runWorkflow: vi.fn(),
  getWorkflow: vi.fn(),
}));

vi.mock('@mastra/code-sdk/workflows/service', () => ({
  deleteWorkflow: vi.fn(),
  getWorkflow: mocks.getWorkflow,
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
    mocks.getWorkflow.mockReset();
  });

  it.each(['help', '?', '--help'])('shows %s without requiring a Mastra instance', async subcommand => {
    const ctx = createCtx();

    await handleWorkflowsCommand(ctx, [subcommand]);

    expect(ctx.controller.getMastra).not.toHaveBeenCalled();
    expect(ctx.showError).not.toHaveBeenCalled();
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Dynamic Workflows'));
  });

  it('shrinks the workflow diagram to fit a narrow terminal', async () => {
    const ctx = createCtx();
    ctx.controller.getMastra.mockReturnValue({});
    mocks.getWorkflow.mockResolvedValue({
      id: 'greeting',
      status: 'active',
      description: 'greets the user',
      inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { greeting: { type: 'string' } } },
      graph: [{ type: 'step', id: 'greeting', stepId: 'greeting' }],
    } as any);

    const originalColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, 'columns', { value: 40, writable: true, configurable: true });
    try {
      await handleWorkflowsCommand(ctx, ['show', 'greeting']);
    } finally {
      Object.defineProperty(process.stdout, 'columns', {
        value: originalColumns,
        writable: true,
        configurable: true,
      });
    }

    const diagram = ctx.showInfo.mock.calls.at(-1)![0] as string;
    expect(diagram).toContain('greeting');
    expect(Math.max(...diagram.split('\n').map(line => line.length))).toBeLessThanOrEqual(38);
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

  it.each([
    ['a string', 'connection lost'],
    ['an object with a message', { message: 'connection lost' }],
  ])('preserves non-Error workflow command failures from %s', async (_source, failure) => {
    const ctx = createCtx();
    ctx.controller.getMastra.mockReturnValue({});
    mocks.runWorkflow.mockRejectedValue(failure);

    await handleWorkflowsCommand(ctx, ['run', 'greeting'], 'run greeting {}');

    expect(ctx.showError).toHaveBeenCalledWith('Workflow command failed: connection lost');
  });
});
