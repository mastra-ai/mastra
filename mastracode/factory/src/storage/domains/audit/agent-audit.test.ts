import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { observeAgentGitAction } from './agent-audit.js';
import type { AuditAgentEmitter } from './domain.js';

const THREAD = 'thread-42';
const PROJECT = '11111111-1111-4111-8111-111111111111';
const SCOPE = '/sandbox/mastra-worktrees/feat-audit';
const recorded: any[] = [];
let emitFailure: Error | undefined;

const audit: AuditAgentEmitter = {
  async emitAgent({ input }) {
    if (emitFailure) throw emitFailure;
    recorded.push({
      ...input,
      metadata: input.metadata ?? {},
    });
  },
};

function makeRequestContext() {
  const controller = {
    threadId: THREAD,
    scope: SCOPE,
    session: { id: 'session-1', ownerId: 'owner-1' },
    resourceId: 'resource-1',
    getState: () => ({ factoryProjectId: PROJECT, projectRepositoryId: 'project-repository-1' }),
  };
  return { get: (key: string) => (key === 'controller' ? controller : undefined) } as any;
}

function toolCall(command: string, extras: Record<string, unknown> = {}) {
  return {
    toolName: 'execute_command',
    input: { command },
    output: { stdout: '' },
    context: makeRequestContext(),
    ...extras,
  };
}

function observe(toolContext: Parameters<typeof observeAgentGitAction>[0]['toolContext']) {
  return observeAgentGitAction({ audit, toolContext });
}

beforeEach(() => {
  recorded.length = 0;
  emitFailure = undefined;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── observeAgentGitAction ────────────────────────────────────────────────
describe('observeAgentGitAction', () => {
  it('records a commit event with the worktree target', async () => {
    await observe(toolCall('git commit -m "feat: add audit trail"'));

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      action: 'factory.agent.commit',
      targets: [{ type: 'worktree', id: SCOPE }],
      metadata: {},
    });
  });

  it('never persists the raw command in event metadata', async () => {
    await observe(toolCall('git commit -m "x" && git push https://token@github.com/mastra-ai/mastra.git main'));
    expect(recorded.length).toBeGreaterThan(0);
    for (const row of recorded) {
      expect(row.metadata.command).toBeUndefined();
    }
  });

  it('records a push event with the branch parsed from the command', async () => {
    await observe(toolCall('git push origin feat/audit-logging'));

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      action: 'factory.agent.push',
      metadata: { branch: 'feat/audit-logging' },
    });
  });

  it('omits the branch when it is not parseable from the push command', async () => {
    await observe(toolCall('git push'));
    expect(recorded).toHaveLength(1);
    expect(recorded[0].action).toBe('factory.agent.push');
    expect(recorded[0].metadata.branch).toBeUndefined();
  });

  it('emits one event per matching command in a chained invocation', async () => {
    await observe(toolCall('git commit -m "x" && git push origin main'));

    expect(recorded.map(r => r.action)).toEqual(['factory.agent.commit', 'factory.agent.push']);
  });

  it('ignores git commands inside heredoc bodies', async () => {
    await observe(toolCall('cat > notes.md <<EOF\ngit push origin main\ngit commit -m "not real"\nEOF'));
    expect(recorded).toHaveLength(0);
  });

  it('ignores failed commands', async () => {
    await observe(toolCall('git push origin main', { error: new Error('exit 1') }));
    expect(recorded).toHaveLength(0);
  });

  it('ignores tools other than execute_command', async () => {
    await observe({
      toolName: 'view',
      input: { command: 'git push origin main' },
      context: makeRequestContext(),
    });
    expect(recorded).toHaveLength(0);
  });

  it('ignores unrelated commands', async () => {
    await observe(toolCall('git status && git log --oneline'));
    expect(recorded).toHaveLength(0);
  });

  it('never throws even when recording rejects', async () => {
    emitFailure = new Error('insert exploded');
    await expect(observe(toolCall('git commit -m "x"'))).resolves.toBeUndefined();
    expect(recorded).toHaveLength(0);
  });
});
