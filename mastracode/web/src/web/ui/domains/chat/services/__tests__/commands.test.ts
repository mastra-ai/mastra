/**
 * BDD coverage for the no-arg slash command dispatcher (`runNoArgCommand`).
 *
 * The dispatcher is a pure service so the palette/composer can share one
 * implementation without threading a giant switch through the composition
 * root. Session/transcript are stubbed via the narrow `NoArgCommandDeps`.
 */
import { describe, expect, it, vi } from 'vitest';

import type { NoArgCommandDeps } from '../commands';
import { runNoArgCommand, SLASH_COMMANDS } from '../commands';

interface DepsOverrides {
  session?: Partial<NoArgCommandDeps['session']>;
  transcript?: Partial<NoArgCommandDeps['transcript']>;
  activeProject?: NoArgCommandDeps['activeProject'];
}

function makeDeps(overrides: DepsOverrides = {}): NoArgCommandDeps {
  return {
    session: {
      clearGoal: vi.fn(async () => {}),
      pauseGoal: vi.fn(async () => {}),
      resumeGoal: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
      getPermissions: vi.fn(async () => ({ categories: {}, tools: {} })),
      setPermissionForCategory: vi.fn(async () => {}),
      pushNotice: vi.fn(),
      ...overrides.session,
    },
    transcript: {
      usage: undefined,
      omPhase: 'idle',
      modeId: undefined,
      modelId: undefined,
      threadId: undefined,
      running: false,
      ...overrides.transcript,
    },
    activeProject: overrides.activeProject ?? null,
  };
}

describe('runNoArgCommand', () => {
  it.each([
    ['goal-clear', 'clearGoal'],
    ['goal-pause', 'pauseGoal'],
    ['goal-resume', 'resumeGoal'],
    ['abort', 'abort'],
  ] as const)('given /%s, then it calls session.%s', async (name, method) => {
    const deps = makeDeps();
    await runNoArgCommand(name, deps);
    expect(deps.session[method]).toHaveBeenCalledOnce();
  });

  it('given /permissions with rules, then it prints categories and tools', async () => {
    const deps = makeDeps({
      session: {
        getPermissions: vi.fn(async () => ({
          categories: { read: 'allow' as const },
          tools: { view: 'ask' as const },
        })),
      },
    });
    await runNoArgCommand('permissions', deps);
    expect(deps.session.pushNotice).toHaveBeenCalledWith('Categories:\n  read: allow\nTools:\n  view: ask');
  });

  it('given /permissions with no rules, then it prints (none) placeholders', async () => {
    const deps = makeDeps();
    await runNoArgCommand('permissions', deps);
    expect(deps.session.pushNotice).toHaveBeenCalledWith('Categories:\n  (none)\nTools:\n  (none)');
  });

  it('given /yolo, then every tool category is set to allow and a notice is pushed', async () => {
    const deps = makeDeps();
    await runNoArgCommand('yolo', deps);
    for (const cat of ['read', 'edit', 'execute', 'mcp', 'other']) {
      expect(deps.session.setPermissionForCategory).toHaveBeenCalledWith(cat, 'allow');
    }
    expect(deps.session.pushNotice).toHaveBeenCalledWith('YOLO mode: all tool categories set to auto-allow');
  });

  it('given /cost with no usage, then it reports nothing recorded', async () => {
    const deps = makeDeps();
    await runNoArgCommand('cost', deps);
    expect(deps.session.pushNotice).toHaveBeenCalledWith('No token usage recorded yet.');
  });

  it('given /cost with usage, then it reports prompt/completion/total tokens', async () => {
    const deps = makeDeps({
      transcript: { usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, running: false },
    });
    await runNoArgCommand('cost', deps);
    expect(deps.session.pushNotice).toHaveBeenCalledWith('Tokens — prompt: 10, completion: 5, total: 15');
  });

  it('given /om, then it reports the observational memory phase (idle fallback)', async () => {
    const deps = makeDeps();
    await runNoArgCommand('om', deps);
    expect(deps.session.pushNotice).toHaveBeenCalledWith('Observational memory phase: idle');
  });

  it('given /settings, then it prints the session snapshot including the active project', async () => {
    const deps = makeDeps({
      transcript: { modeId: 'build', modelId: 'openai/gpt-4o-mini', threadId: 'thread-1', running: true },
      activeProject: { name: 'Demo', path: '/tmp/demo' },
    });
    await runNoArgCommand('settings', deps);
    expect(deps.session.pushNotice).toHaveBeenCalledWith(
      [
        'Project: Demo',
        'Path: /tmp/demo',
        'Mode: build',
        'Model: openai/gpt-4o-mini',
        'Thread: thread-1',
        'Running: true',
      ].join('\n'),
    );
  });

  it('given /settings with no project, then it prints the defaults', async () => {
    const deps = makeDeps();
    await runNoArgCommand('settings', deps);
    expect(deps.session.pushNotice).toHaveBeenCalledWith(
      ['Project: (none)', 'Path: (default workspace)', 'Mode: —', 'Model: —', 'Thread: —', 'Running: false'].join('\n'),
    );
  });

  it('given /help, then it lists every registered slash command', async () => {
    const deps = makeDeps();
    await runNoArgCommand('help', deps);
    const [text] = vi.mocked(deps.session.pushNotice).mock.calls[0]!;
    expect(text).toContain('Available commands:');
    for (const command of SLASH_COMMANDS) {
      expect(text).toContain(`/${command.name}`);
      expect(text).toContain(command.description);
    }
  });

  it('given /think, then it pushes the extended-thinking hint', async () => {
    const deps = makeDeps();
    await runNoArgCommand('think', deps);
    expect(deps.session.pushNotice).toHaveBeenCalledWith(
      'Extended thinking: steer the agent with "think step by step" or switch to a thinking-capable model.',
    );
  });

  it('given an unknown command, then it pushes an error notice', async () => {
    const deps = makeDeps();
    await runNoArgCommand('model', deps);
    expect(deps.session.pushNotice).toHaveBeenCalledWith(
      'Command /model needs arguments. Type it in the composer.',
      'error',
    );
  });
});
