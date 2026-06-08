import { describe, expect, it, vi } from 'vitest';
import { handleSkillCommand } from '../skills.js';

function createCtx(options?: {
  pendingNewThread?: boolean;
  skill?: any;
  skills?: any[];
  workspace?: any;
  hasWorkspace?: boolean;
}) {
  const skill = options?.skill ?? {
    name: 'github-triage',
    instructions: '# GitHub triage\n\nReview the issue.',
    references: ['checklist.md'],
    scripts: ['triage.ts'],
    assets: [],
  };
  const workspace =
    options?.workspace ??
    ({
      skills: {
        get: vi.fn().mockResolvedValue(skill),
        list: vi.fn().mockResolvedValue(options?.skills ?? [skill]),
      },
    } as any);
  const state = {
    pendingNewThread: options?.pendingNewThread ?? false,
    allSlashCommandComponents: [],
    chatContainer: { addChild: vi.fn() },
    ui: { requestRender: vi.fn() },
  };
  const harness = {
    hasWorkspace: vi.fn(() => options?.hasWorkspace ?? true),
    resolveWorkspace: vi.fn().mockResolvedValue(workspace),
    createThread: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  };

  return {
    ctx: {
      state,
      harness,
      getResolvedWorkspace: vi.fn(() => workspace),
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any,
    harness,
    state,
    workspace,
  };
}

describe('handleSkillCommand', () => {
  it('loads a named skill and sends its instructions to the agent', async () => {
    const { ctx, harness, state } = createCtx();

    await handleSkillCommand(ctx, 'github-triage', ['focus', 'tests']);

    expect(state.allSlashCommandComponents).toHaveLength(1);
    expect(state.chatContainer.addChild).toHaveBeenCalledWith(state.allSlashCommandComponents[0]);
    expect(state.ui.requestRender).toHaveBeenCalledTimes(1);
    expect(harness.sendMessage).toHaveBeenCalledWith({
      content:
        '<skill name="github-triage">\n' +
        '# GitHub triage\n\n' +
        'Review the issue.\n\n' +
        '## References\n' +
        '- references/checklist.md\n\n' +
        '## Scripts\n' +
        '- scripts/triage.ts\n\n' +
        'ARGUMENTS: focus tests\n' +
        '</skill>',
    });
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  it('preserves general XML/HTML in skill content but neutralizes the </skill> boundary token', async () => {
    const { ctx, harness } = createCtx({
      skill: {
        name: 'github-triage',
        instructions: 'Use <div>, A&B, "quotes". Embedded </skill> stays out of the way.',
        references: [],
        scripts: [],
        assets: [],
      },
    });

    await handleSkillCommand(ctx, 'github-triage', []);

    expect(harness.sendMessage).toHaveBeenCalledWith({
      content:
        '<skill name="github-triage">\n' +
        'Use <div>, A&B, "quotes". Embedded &lt;/skill&gt; stays out of the way.\n' +
        '</skill>',
    });
  });

  it('creates a pending new thread before sending the skill activation', async () => {
    const { ctx, harness, state } = createCtx({ pendingNewThread: true });

    await handleSkillCommand(ctx, 'github-triage', []);

    expect(harness.createThread).toHaveBeenCalledTimes(1);
    expect(state.pendingNewThread).toBe(false);
    expect(harness.createThread.mock.invocationCallOrder[0]).toBeLessThan(
      harness.sendMessage.mock.invocationCallOrder[0],
    );
  });

  it('shows available skills when the requested skill is not found', async () => {
    const workspace = {
      skills: {
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue([
          { name: 'review', path: '/skills/review' },
          { name: 'browse', path: '/skills/browse' },
        ]),
      },
    };
    const { ctx, harness } = createCtx({ workspace });

    await handleSkillCommand(ctx, 'missing', []);

    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith('Skill not found: missing. Available skills: review, browse');
  });

  it('shows an error when no skills are configured', async () => {
    const { ctx, harness } = createCtx({ workspace: {} });

    await handleSkillCommand(ctx, 'any', []);

    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith('No skills configured.');
  });

  it('rejects empty skill names', async () => {
    const { ctx, harness } = createCtx();

    await handleSkillCommand(ctx, '', []);

    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith('Usage: /skill/<name>');
  });

  it('refuses to activate a skill marked user-invocable: false', async () => {
    const workspace = {
      skills: {
        get: vi.fn().mockResolvedValue({
          name: 'internal-helper',
          instructions: 'should not be invoked',
          'user-invocable': false,
          references: [],
          scripts: [],
          assets: [],
        }),
        list: vi.fn().mockResolvedValue([
          { name: 'review', path: '/skills/review' },
          { name: 'internal-helper', path: '/skills/internal-helper', 'user-invocable': false },
        ]),
      },
    };
    const { ctx, harness } = createCtx({ workspace });

    await handleSkillCommand(ctx, 'internal-helper', []);

    expect(harness.sendMessage).not.toHaveBeenCalled();
    // The non-user-invocable skill must also be hidden from the "Available skills" hint.
    expect(ctx.showError).toHaveBeenCalledWith('Skill not found: internal-helper. Available skills: review');
  });
});
