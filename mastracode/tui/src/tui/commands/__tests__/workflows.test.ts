import { describe, expect, it, vi } from 'vitest';
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
  it.each(['help', '?', '--help'])('shows %s without requiring a Mastra instance', async subcommand => {
    const ctx = createCtx();

    await handleWorkflowsCommand(ctx, [subcommand]);

    expect(ctx.controller.getMastra).not.toHaveBeenCalled();
    expect(ctx.showError).not.toHaveBeenCalled();
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Dynamic Workflows'));
  });
});
