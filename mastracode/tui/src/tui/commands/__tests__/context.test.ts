import { describe, expect, it, vi } from 'vitest';

import { handleContextCommand } from '../context.js';

function createCtx(
  overrides: { skills?: any; mcpManager?: any; cumulativePromptTokens?: number; latestPromptTokens?: number } = {},
) {
  const session = {
    state: { get: () => ({}) },
    mode: { get: () => 'build' },
    model: { get: () => 'anthropic/claude-sonnet-4-5' },
    displayState: {
      get: () => ({
        tokenUsage: { promptTokens: overrides.cumulativePromptTokens ?? 0, completionTokens: 0, totalTokens: 0 },
        omProgress: { observationTokens: 0 },
      }),
    },
  };

  return {
    state: { session, latestRequestPromptTokens: overrides.latestPromptTokens ?? 0 },
    showInfo: vi.fn(),
    showError: vi.fn(),
    getResolvedWorkspace: () => (overrides.skills ? { skills: overrides.skills } : undefined),
    controller: { hasWorkspace: () => false, resolveWorkspace: vi.fn() },
    mcpManager: overrides.mcpManager,
  } as any;
}

const mcpManagerWith = (tools: Record<string, unknown>, statuses: { name: string; toolNames: string[] }[]) => ({
  getTools: () => tools,
  getServerStatuses: () => statuses,
});

describe('handleContextCommand', () => {
  function reportOf(ctx: any): string {
    return ctx.showInfo.mock.calls[0][0] as string;
  }

  it('reports a startup breakdown before any request has been made', async () => {
    const ctx = createCtx();

    await handleContextCommand(ctx);

    expect(ctx.showError).not.toHaveBeenCalled();
    const report = reportOf(ctx);
    expect(report).toContain('Context Audit');
    expect(report).toContain('Startup context');
  });

  it('attributes tool definitions to the MCP server that provides them', async () => {
    const ctx = createCtx({
      mcpManager: mcpManagerWith(
        {
          github_create_issue: { description: 'Create an issue', inputSchema: { type: 'object' } },
          github_list_prs: { description: 'List pull requests', inputSchema: { type: 'object' } },
          linear_search: { description: 'Search issues', inputSchema: { type: 'object' } },
        },
        [
          { name: 'github', toolNames: ['github_create_issue', 'github_list_prs'] },
          { name: 'linear', toolNames: ['linear_search'] },
        ],
      ),
    });

    await handleContextCommand(ctx);

    // The whole point of the command is telling a user which server to disable,
    // so servers must be named and rolled up rather than listed tool by tool.
    const report = reportOf(ctx);
    expect(report).toContain('github (2 tools)');
    expect(report).toContain('linear (1 tool)');
    expect(report).not.toContain('github_create_issue');
  });

  it('uses the latest request instead of cumulative prompt usage after multiple steps', async () => {
    const firstRequest = createCtx({ cumulativePromptTokens: 50_000, latestPromptTokens: 50_000 });
    await handleContextCommand(firstRequest);

    const secondRequest = createCtx({ cumulativePromptTokens: 140_000, latestPromptTokens: 90_000 });
    await handleContextCommand(secondRequest);

    const latestOnly = createCtx({ cumulativePromptTokens: 90_000, latestPromptTokens: 90_000 });
    await handleContextCommand(latestOnly);

    expect(reportOf(secondRequest)).toBe(reportOf(latestOnly));
    expect(reportOf(secondRequest)).not.toBe(reportOf(firstRequest));
    expect(reportOf(secondRequest)).toContain('Conversation');
  });

  it('still reports when the workspace cannot provide skills', async () => {
    const ctx = createCtx({
      skills: {
        list: vi.fn().mockRejectedValue(new Error('workspace unavailable')),
      },
    });

    await handleContextCommand(ctx);

    expect(ctx.showError).not.toHaveBeenCalled();
    expect(reportOf(ctx)).toContain('Startup context');
  });

  it('measures the skills catalog the agent actually injects', async () => {
    const skill = {
      name: 'mastra-docs',
      description: 'Documentation guidelines for Mastra.',
      path: '/repo/.claude/skills/mastra-docs',
      source: { type: 'local' },
    };
    const ctx = createCtx({
      skills: {
        list: vi.fn().mockResolvedValue([skill]),
        get: vi.fn().mockResolvedValue(skill),
      },
    });

    await handleContextCommand(ctx);

    expect(reportOf(ctx)).toContain('Skills catalog');
  });

  it('renders through showInfo so the audit never enters the context it describes', async () => {
    const ctx = createCtx();
    ctx.addUserMessage = vi.fn();

    await handleContextCommand(ctx);

    expect(ctx.showInfo).toHaveBeenCalledTimes(1);
    expect(ctx.addUserMessage).not.toHaveBeenCalled();
  });

  it('surfaces a failure instead of rendering a misleading half-audit', async () => {
    const ctx = createCtx();
    ctx.state.session.state.get = () => {
      throw new Error('session gone');
    };

    await handleContextCommand(ctx);

    expect(ctx.showInfo).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('session gone'));
  });
});
