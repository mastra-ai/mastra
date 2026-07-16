import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
const recorded: any[] = [];
let recordFailure: Error | undefined;

vi.mock('./store', () => ({
  recordAuditEvent: vi.fn(async (input: any) => {
    if (recordFailure) throw recordFailure;
    recorded.push(input);
    return {
      id: `00000000-0000-4000-8000-${String(recorded.length).padStart(12, '0')}`,
      occurredAt: new Date('2026-07-16T10:00:00Z'),
      orgId: input.orgId,
      actorId: input.actorId,
      actorType: input.actorType ?? 'human',
      action: input.action,
      targets: input.targets,
      metadata: input.metadata ?? {},
      githubProjectId: input.githubProjectId ?? null,
      context: input.context ?? {},
    };
  }),
  listAuditEvents: vi.fn(async () => ({ events: [] })),
}));

const forwardToWorkOS = vi.fn(async (_row: unknown) => undefined);
vi.mock('./workos-sink', () => ({
  forwardToWorkOS: (row: unknown) => forwardToWorkOS(row),
}));

import { emitAgentAudit, observeAgentGitAction } from './agent-audit';

// ── Fixtures ─────────────────────────────────────────────────────────────
const THREAD = 'thread-42';
const PROJECT = '11111111-1111-4111-8111-111111111111';
const SCOPE = '/sandbox/mastra-worktrees/feat-audit';
const USER = { workosId: 'user_abc', id: 'user_abc', email: 'a@b.c', name: 'Abhi', organizationId: 'org_123' };

function makeRequestContext(overrides: { controller?: unknown; user?: unknown } = {}) {
  const controller =
    'controller' in overrides
      ? overrides.controller
      : {
          threadId: THREAD,
          scope: SCOPE,
          session: { id: 'session-1', ownerId: 'owner-1' },
          resourceId: 'resource-1',
          getState: () => ({ githubProjectId: PROJECT }),
        };
  const user = 'user' in overrides ? overrides.user : USER;
  const entries: Record<string, unknown> = { controller, user };
  return { get: (key: string) => entries[key] } as any;
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

beforeEach(() => {
  recorded.length = 0;
  recordFailure = undefined;
  forwardToWorkOS.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── emitAgentAudit ───────────────────────────────────────────────────────
describe('emitAgentAudit', () => {
  it('records an agent-attributed event chained back to the initiating human', async () => {
    await emitAgentAudit(makeRequestContext(), {
      action: 'factory.agent.commit',
      targets: [{ type: 'worktree', id: SCOPE }],
      metadata: { branch: 'main' },
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      orgId: 'org_123',
      actorId: `agent:${THREAD}`,
      actorType: 'agent',
      action: 'factory.agent.commit',
      githubProjectId: PROJECT,
      context: {},
      metadata: { branch: 'main', startedBy: 'user_abc' },
    });
    expect(forwardToWorkOS).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['controller missing', { controller: undefined }],
    ['user missing', { user: undefined }],
    ['thread missing', { controller: { scope: SCOPE, getState: () => ({ githubProjectId: PROJECT }) } }],
    ['github project missing', { controller: { threadId: THREAD, scope: SCOPE, getState: () => ({}) } }],
    ['org missing', { user: { ...USER, organizationId: undefined } }],
  ])('no-ops when the session context is incomplete (%s)', async (_label, overrides) => {
    await emitAgentAudit(makeRequestContext(overrides as any), {
      action: 'factory.agent.commit',
      targets: [],
    });
    expect(recorded).toHaveLength(0);
    expect(forwardToWorkOS).not.toHaveBeenCalled();
  });

  it('never throws when recording rejects', async () => {
    recordFailure = new Error('insert exploded');
    await expect(
      emitAgentAudit(makeRequestContext(), { action: 'factory.agent.commit', targets: [] }),
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      '[Audit] Failed to emit agent audit event',
      expect.objectContaining({ action: 'factory.agent.commit' }),
    );
  });
});

// ── observeAgentGitAction ────────────────────────────────────────────────
describe('observeAgentGitAction', () => {
  it('records a commit event with the worktree target', async () => {
    await observeAgentGitAction(toolCall('git commit -m "feat: add audit trail"'));

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      action: 'factory.agent.commit',
      actorId: `agent:${THREAD}`,
      actorType: 'agent',
      targets: [{ type: 'worktree', id: SCOPE }],
      metadata: { startedBy: 'user_abc' },
    });
  });

  it('never persists the raw command in event metadata', async () => {
    await observeAgentGitAction(
      toolCall('git commit -m "x" && git push https://token@github.com/mastra-ai/mastra.git main'),
    );
    expect(recorded.length).toBeGreaterThan(0);
    for (const row of recorded) {
      expect(row.metadata.command).toBeUndefined();
    }
  });

  it('records a push event with the branch parsed from the command', async () => {
    await observeAgentGitAction(toolCall('git push origin feat/audit-logging'));

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      action: 'factory.agent.push',
      metadata: { branch: 'feat/audit-logging' },
    });
  });

  it('omits the branch when it is not parseable from the push command', async () => {
    await observeAgentGitAction(toolCall('git push'));
    expect(recorded).toHaveLength(1);
    expect(recorded[0].action).toBe('factory.agent.push');
    expect(recorded[0].metadata.branch).toBeUndefined();
  });

  it('records a pr_opened event with the PR URL target from the command output', async () => {
    await observeAgentGitAction(
      toolCall('gh pr create --title "Audit" --body "..."', {
        output: { stdout: 'https://github.com/mastra-ai/mastra/pull/19500\n' },
      }),
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      action: 'factory.agent.pr_opened',
      targets: [{ type: 'pull_request', id: 'https://github.com/mastra-ai/mastra/pull/19500' }],
    });
  });

  it('emits one event per matching command in a chained invocation', async () => {
    await observeAgentGitAction(toolCall('git commit -m "x" && git push origin main'));

    expect(recorded.map(r => r.action)).toEqual(['factory.agent.commit', 'factory.agent.push']);
  });

  it('ignores git commands inside heredoc bodies', async () => {
    await observeAgentGitAction(toolCall('cat > notes.md <<EOF\ngit push origin main\ngit commit -m "not real"\nEOF'));
    expect(recorded).toHaveLength(0);
  });

  it('ignores failed commands', async () => {
    await observeAgentGitAction(toolCall('git push origin main', { error: new Error('exit 1') }));
    expect(recorded).toHaveLength(0);
  });

  it('ignores tools other than execute_command', async () => {
    await observeAgentGitAction({
      toolName: 'view',
      input: { command: 'git push origin main' },
      context: makeRequestContext(),
    });
    expect(recorded).toHaveLength(0);
  });

  it('ignores unrelated commands', async () => {
    await observeAgentGitAction(toolCall('git status && git log --oneline'));
    expect(recorded).toHaveLength(0);
  });

  it('no-ops when the session context is incomplete', async () => {
    await observeAgentGitAction({
      ...toolCall('git push origin main'),
      context: makeRequestContext({ controller: undefined }),
    });
    expect(recorded).toHaveLength(0);
  });

  it('never throws even when recording rejects', async () => {
    recordFailure = new Error('insert exploded');
    await expect(observeAgentGitAction(toolCall('git commit -m "x"'))).resolves.toBeUndefined();
    expect(recorded).toHaveLength(0);
  });
});
