import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendSlashCommandMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../send-slash-command-message.js', () => ({
  sendSlashCommandMessage: mocks.sendSlashCommandMessage,
}));

import { handleReportIssueCommand } from '../report-issue.js';

function createCtx(options?: { hasModelSelected?: boolean; pendingNewThread?: boolean }) {
  const state = {
    pendingNewThread: options?.pendingNewThread ?? false,
    harness: {
      session: { model: { hasSelection: vi.fn(() => options?.hasModelSelected ?? true) } },
      createThread: vi.fn().mockResolvedValue(undefined),
    },
  };
  return {
    ctx: {
      state,
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any,
    state,
  };
}

describe('handleReportIssueCommand', () => {
  it('gates report issue workflow until a model is selected', async () => {
    const { ctx, state } = createCtx({ hasModelSelected: false, pendingNewThread: true });

    await handleReportIssueCommand(ctx, ['crash', 'on', 'startup']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      'No model selected. Use /models to select a model, or /login to authenticate.',
    );
    expect(state.harness.createThread).not.toHaveBeenCalled();
    expect(mocks.sendSlashCommandMessage).not.toHaveBeenCalled();
  });

  it('creates a pending thread before sending the guided issue-reporting prompt', async () => {
    const { ctx, state } = createCtx({ pendingNewThread: true });

    await handleReportIssueCommand(ctx, ['startup', 'hangs']);

    expect(state.harness.createThread).toHaveBeenCalledTimes(1);
    expect(state.pendingNewThread).toBe(false);
    expect(mocks.sendSlashCommandMessage).toHaveBeenCalledTimes(1);
    expect(state.harness.createThread.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendSlashCommandMessage.mock.invocationCallOrder[0],
    );

    const [sentCtx, displayText, prompt] = mocks.sendSlashCommandMessage.mock.calls[0];
    expect(sentCtx).toBe(ctx);
    expect(displayText).toBe('/report-issue startup hangs');
    expect(prompt).toContain('The user wants to report a GitHub issue on mastra-ai/mastra');
    expect(prompt).toContain('The user provided this initial context: "startup hangs"');
    expect(prompt).toContain('gh issue list --repo mastra-ai/mastra --label mastracode');
    expect(prompt).toContain('gh search issues --repo mastra-ai/mastra');
    expect(prompt).toContain("Ask the user whether they'd like to add a comment on an existing issue");
    expect(prompt).toContain('show it to the user for approval');
    expect(prompt).toContain('ask for their approval before creating it');
    expect(prompt).toContain('gh issue create --repo mastra-ai/mastra --label mastracode');
  });
});
