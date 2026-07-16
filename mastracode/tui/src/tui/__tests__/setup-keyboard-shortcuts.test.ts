import { execFileSync } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {},
}));

const autocompleteProviders: Array<{
  commands: Array<{
    name: string;
    description: string;
    getArgumentCompletions?: (prefix: string) => Array<{ value: string }>;
  }>;
  cwd: string;
  fdPath: string | null | undefined;
}> = [];

vi.mock('@earendil-works/pi-tui', () => ({
  Box: class {},
  CombinedAutocompleteProvider: class {
    constructor(
      commands: Array<{
        name: string;
        description: string;
        getArgumentCompletions?: (prefix: string) => Array<{ value: string }>;
      }>,
      cwd: string,
      fdPath?: string,
    ) {
      autocompleteProviders.push({ commands, cwd, fdPath });
    }
  },
  Container: class {},
  Spacer: class {},
  Text: class {},
}));

vi.mock('../components/banner.js', () => ({
  renderBanner: vi.fn(),
}));

vi.mock('../components/task-progress.js', () => ({
  TaskProgressComponent: class {},
}));

vi.mock('../display.js', () => ({
  showError: vi.fn(),
  showInfo: vi.fn(),
}));

vi.mock('../status-line.js', () => ({
  updateStatusLine: vi.fn(),
}));

import { showError, showInfo } from '../display.js';
import { GOAL_JUDGE_INPUT_LOCK_MESSAGE } from '../goal-input-lock.js';
import { refreshSkillsAutocomplete, setupAutocomplete, setupKeyHandlers, setupKeyboardShortcuts } from '../setup.js';
import { createMockState } from './agent-controller-mock.js';

const originalPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  vi.mocked(execFileSync).mockReset();
  vi.restoreAllMocks();
});

function createState(isRunning: boolean) {
  const actions = new Map<string, () => unknown>();
  const editor = {
    onAction: vi.fn((name: string, handler: () => unknown) => {
      actions.set(name, handler);
    }),
    onSubmit: vi.fn(),
    onCtrlD: undefined as (() => void) | undefined,
    getText: vi.fn(() => '/help'),
    getExpandedText: vi.fn(() => '/help'),
    addToHistory: vi.fn(),
    setText: vi.fn(),
    setAutocompleteProvider: vi.fn(),
  };

  const state = createMockState({
    session: {
      run: { isRunning: vi.fn(() => isRunning) },
      suspensions: { hasPending: vi.fn(() => false) },
      mode: { get: vi.fn() },
      state: { get: vi.fn(() => ({})), set: vi.fn() },
    },
    extra: {
      editor,
      pendingApprovalDismiss: undefined,
      activeInlinePlanApproval: undefined,
      activeInlineQuestion: undefined,
      pendingInlineQuestions: [],
      userInitiatedAbort: false,
      lastCtrlCTime: 0,
      lastClearedText: '',
      customSlashCommands: [],
      skillCommands: [],
      goalSkillCommands: [],
      hideThinkingBlock: false,
      toolOutputExpanded: false,
      allToolComponents: [],
      allSlashCommandComponents: [],
      allSystemReminderComponents: [],
      allShellComponents: [],
      ui: { requestRender: vi.fn(), start: vi.fn(), stop: vi.fn() },
      goalManager: {
        isActive: vi.fn(() => false),
        pause: vi.fn(),
        saveToThread: vi.fn(),
      },
    },
  }) as any;

  return { state, editor, actions };
}

describe('setupKeyHandlers', () => {
  function registerSigintHandler(state: any) {
    let handler: (() => void) | undefined;
    const onSpy = vi
      .spyOn(process, 'on')
      .mockImplementation((event: string | symbol, listener: (...args: any[]) => void) => {
        if (event === 'SIGINT') {
          handler = listener as () => void;
        }
        return process;
      });
    const offSpy = vi.spyOn(process, 'off').mockImplementation(() => process);

    const cleanup = setupKeyHandlers(state, { stop: vi.fn(), doubleCtrlCMs: 500 });

    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(handler).toBeDefined();
    return { handler: handler!, cleanup, offSpy };
  }

  it('only dismisses an active approval prompt on process SIGINT', () => {
    const { state } = createState(false);
    const pendingApprovalDismiss = vi.fn();
    const runInterrupt = vi.fn().mockResolvedValue(undefined);
    state.pendingApprovalDismiss = pendingApprovalDismiss;
    state.hookManager = { runInterrupt };

    const { handler, cleanup } = registerSigintHandler(state);

    handler();
    cleanup();

    expect(pendingApprovalDismiss).toHaveBeenCalledTimes(1);
    expect(runInterrupt).not.toHaveBeenCalled();
    expect(state.session.abort).not.toHaveBeenCalled();
  });

  it('does not emit process_sigint when no run is active', () => {
    const { state } = createState(false);
    const runInterrupt = vi.fn().mockResolvedValue(undefined);
    state.hookManager = { runInterrupt };

    const { handler, cleanup } = registerSigintHandler(state);

    handler();
    cleanup();

    expect(runInterrupt).not.toHaveBeenCalled();
    expect(state.session.abort).not.toHaveBeenCalled();
  });

  it('emits process_sigint while aborting an active run', () => {
    const { state } = createState(true);
    const runInterrupt = vi.fn().mockResolvedValue(undefined);
    state.hookManager = { runInterrupt };

    const { handler, cleanup } = registerSigintHandler(state);

    handler();
    cleanup();

    expect(runInterrupt).toHaveBeenCalledWith('process_sigint');
    expect(state.session.abort).toHaveBeenCalledTimes(1);
    expect(state.userInitiatedAbort).toBe(true);
  });
});

describe('setupKeyboardShortcuts', () => {
  it('defaults slash-command autocomplete to the first visible built-in command before custom commands', () => {
    autocompleteProviders.length = 0;
    const { state, editor } = createState(false);
    state.customSlashCommands = [
      { name: 'deploy', description: 'Deploy to prod', template: '', sourcePath: '', goal: true },
      { name: 'ship', description: 'Ship release', template: '', sourcePath: '' },
    ];
    state.skillCommands = [{ name: 'lint-fix', description: 'Fix lint issues', path: '/skills/lint-fix' }];
    state.goalSkillCommands = [
      { name: 'review', description: 'Review code', path: '/skills/review', metadata: { goal: true } },
    ];
    state.controller.listModes = vi.fn(() => ['default']);

    setupAutocomplete(state);

    expect(editor.setAutocompleteProvider).toHaveBeenCalledTimes(1);
    expect(autocompleteProviders).toHaveLength(1);

    const commandNames = autocompleteProviders[0]?.commands.map(command => command.name) ?? [];
    expect(commandNames[0]).toBe('new');
    expect(commandNames).toContain('thread');
    expect(commandNames).not.toContain('judge');
    expect(commandNames).not.toContain('notify');
    const goalCommand = autocompleteProviders[0]?.commands.find(command => command.name === 'goal') as
      | { getArgumentCompletions?: (prefix: string) => Array<{ value: string }> }
      | undefined;
    expect(goalCommand?.getArgumentCompletions?.('').map(command => command.value)).toEqual([
      'status',
      'pause',
      'resume',
      'clear',
      'judge',
    ]);
    expect(goalCommand?.getArgumentCompletions?.('pa').map(command => command.value)).toEqual(['pause']);
    const githubCommand = autocompleteProviders[0]?.commands.find(command => command.name === 'github') as
      | { getArgumentCompletions?: (prefix: string) => Array<{ value: string }> }
      | undefined;
    expect(githubCommand?.getArgumentCompletions?.('').map(command => command.value)).toEqual([
      'subscribe',
      'unsubscribe',
      'sync',
      'debug',
    ]);
    expect(githubCommand?.getArgumentCompletions?.('un').map(command => command.value)).toEqual(['unsubscribe']);
    expect(commandNames.indexOf('thread')).toBeLessThan(commandNames.indexOf('threads'));
    expect(commandNames).toContain('skill/');
    expect(commandNames).toContain('memory');
    expect(commandNames).toContain('om');
    expect(commandNames.indexOf('memory')).toBeLessThan(commandNames.indexOf('om'));
    expect(autocompleteProviders[0]?.commands.find(command => command.name === 'memory')?.description).toBe(
      'Configure Observational Memory',
    );
    expect(autocompleteProviders[0]?.commands.find(command => command.name === 'om')?.description).toBe(
      'Alias for /memory',
    );
    expect(commandNames).not.toContain('memory-gateway');
    expect(commandNames.indexOf('/deploy')).toBeGreaterThan(commandNames.indexOf('help'));
    expect(commandNames).toContain('skill/lint-fix');
    expect(commandNames).toContain('goal/deploy');
    expect(commandNames).toContain('goal/review');
    expect(commandNames.slice(-5)).toEqual(['/deploy', 'goal/deploy', '/ship', 'skill/lint-fix', 'goal/review']);
  });

  it('passes detected fd path and cwd into the autocomplete provider', () => {
    autocompleteProviders.length = 0;
    vi.mocked(execFileSync).mockReturnValue('/opt/homebrew/bin/fd\n' as any);
    const { state, editor } = createState(false);

    setupAutocomplete(state);

    expect(editor.setAutocompleteProvider).toHaveBeenCalledTimes(1);
    expect(execFileSync).toHaveBeenCalledWith('which', ['fd'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    expect(autocompleteProviders[0]?.cwd).toBe(process.cwd());
    expect(autocompleteProviders[0]?.fdPath).toBe('/opt/homebrew/bin/fd');
  });

  it('falls back to fdfind and keeps slash autocomplete when fd is unavailable', () => {
    autocompleteProviders.length = 0;
    vi.mocked(execFileSync).mockImplementation((_command, args) => {
      if (args?.[0] === 'fd') throw new Error('missing fd');
      return '/usr/bin/fdfind\n' as any;
    });
    const { state } = createState(false);

    setupAutocomplete(state);

    const commandNames = autocompleteProviders[0]?.commands.map(command => command.name) ?? [];
    expect(execFileSync).toHaveBeenNthCalledWith(1, 'which', ['fd'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(execFileSync).toHaveBeenNthCalledWith(2, 'which', ['fdfind'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(autocompleteProviders[0]?.fdPath).toBe('/usr/bin/fdfind');
    expect(commandNames[0]).toBe('new');
    expect(commandNames).toContain('help');
  });

  it('omits fd path but preserves command autocomplete when no file search binary is found', () => {
    autocompleteProviders.length = 0;
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('missing binary');
    });
    const { state, editor } = createState(false);
    state.customSlashCommands = [{ name: 'ship', description: 'Ship release', template: '', sourcePath: '' }];

    setupAutocomplete(state);

    const commandNames = autocompleteProviders[0]?.commands.map(command => command.name) ?? [];
    expect(editor.setAutocompleteProvider).toHaveBeenCalledTimes(1);
    expect(execFileSync).toHaveBeenCalledTimes(2);
    expect(autocompleteProviders[0]?.cwd).toBe(process.cwd());
    expect(autocompleteProviders[0]?.fdPath).toBeNull();
    expect(commandNames).toContain('help');
    expect(commandNames).toContain('/ship');
  });

  it('refreshes autocomplete after workspace skills resolve', async () => {
    autocompleteProviders.length = 0;
    const { state, editor } = createState(false);
    state.customSlashCommands = [];
    state.skillCommands = [];
    state.goalSkillCommands = [];
    state.controller.getWorkspace = vi.fn(() => undefined);
    state.controller.hasWorkspace = vi.fn(() => true);
    state.controller.resolveWorkspace = vi.fn(async () => ({
      skills: {
        list: vi.fn(async () => [
          { name: 'review', description: 'Review code', path: '/skills/review' },
          {
            name: 'internal-helper',
            description: 'Internal helper',
            path: '/skills/internal-helper',
            'user-invocable': false,
          },
        ]),
      },
    }));

    setupAutocomplete(state);
    await refreshSkillsAutocomplete(state);

    expect(editor.setAutocompleteProvider).toHaveBeenCalledTimes(2);
    expect(autocompleteProviders).toHaveLength(2);
    const initialCommands = autocompleteProviders[0]?.commands.map(command => command.name) ?? [];
    const refreshedCommands = autocompleteProviders[1]?.commands.map(command => command.name) ?? [];
    expect(initialCommands).toContain('skill/');
    expect(initialCommands).not.toContain('skill/review');
    expect(refreshedCommands).toContain('skill/review');
    expect(refreshedCommands).not.toContain('skill/internal-helper');
  });

  it('submits immediately on Enter when the controller is idle', () => {
    const { state, editor, actions } = createState(false);
    const queueFollowUpMessage = vi.fn();

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage,
    });

    const followUp = actions.get('followUp');
    expect(followUp).toBeDefined();

    expect(followUp?.()).toBe(true);
    expect(editor.onSubmit).toHaveBeenCalledWith('/help');
    expect(queueFollowUpMessage).not.toHaveBeenCalled();
    expect(editor.setText).not.toHaveBeenCalled();
  });

  it('submits through the editor handler on Enter while the controller is running', () => {
    const { state, editor, actions } = createState(true);
    const queueFollowUpMessage = vi.fn();

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage,
    });

    const followUp = actions.get('followUp');
    expect(followUp).toBeDefined();

    expect(followUp?.()).toBe(true);
    expect(editor.onSubmit).toHaveBeenCalledWith('/help');
    expect(queueFollowUpMessage).not.toHaveBeenCalled();
    expect(editor.addToHistory).not.toHaveBeenCalled();
    expect(editor.setText).not.toHaveBeenCalled();
  });

  it('queues follow-ups with Ctrl+F while the controller is running', () => {
    const { state, editor, actions } = createState(true);
    const queueFollowUpMessage = vi.fn();

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage,
    });

    const queueFollowUp = actions.get('queueFollowUp');
    expect(queueFollowUp).toBeDefined();

    expect(queueFollowUp?.()).toBe(true);
    expect(queueFollowUpMessage).toHaveBeenCalledWith('/help');
    expect(editor.addToHistory).toHaveBeenCalledWith('/help');
    expect(editor.setText).toHaveBeenCalledWith('');
    expect(editor.onSubmit).not.toHaveBeenCalled();
  });

  it('blocks Ctrl+F queueing while the goal judge is evaluating', () => {
    vi.mocked(showInfo).mockClear();
    const { state, editor, actions } = createState(true);
    state.activeGoalJudge = { modelId: 'openai/gpt-5.5' };
    const queueFollowUpMessage = vi.fn();

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage,
    });

    const queueFollowUp = actions.get('queueFollowUp');
    expect(queueFollowUp?.()).toBe(true);
    expect(editor.onSubmit).not.toHaveBeenCalled();
    expect(editor.addToHistory).not.toHaveBeenCalled();
    expect(editor.setText).not.toHaveBeenCalled();
    expect(queueFollowUpMessage).not.toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith(state, GOAL_JUDGE_INPUT_LOCK_MESSAGE);
    expect(state.ui.requestRender).toHaveBeenCalled();
  });

  it('blocks Enter submissions while the goal judge is evaluating', () => {
    vi.mocked(showInfo).mockClear();
    const { state, editor, actions } = createState(false);
    state.activeGoalJudge = { modelId: 'openai/gpt-5.5' };
    const queueFollowUpMessage = vi.fn();

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage,
    });

    const followUp = actions.get('followUp');
    expect(followUp?.()).toBe(true);
    expect(editor.onSubmit).not.toHaveBeenCalled();
    expect(editor.addToHistory).not.toHaveBeenCalled();
    expect(editor.setText).not.toHaveBeenCalled();
    expect(queueFollowUpMessage).not.toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith(state, GOAL_JUDGE_INPUT_LOCK_MESSAGE);
    expect(state.ui.requestRender).toHaveBeenCalled();
  });

  it('aborts an active goal judge even when the controller is idle', () => {
    const { state, editor, actions } = createState(false);
    const abortController = new AbortController();
    const component = { setInterrupted: vi.fn() };
    state.activeGoalJudge = { modelId: 'openai/gpt-5.5', abortController, component };
    editor.getText.mockReturnValue('');

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage: vi.fn(),
    });

    actions.get('clear')?.();

    expect(abortController.signal.aborted).toBe(true);
    expect(component.setInterrupted).toHaveBeenCalledTimes(1);
    expect(state.userInitiatedAbort).toBe(true);
    expect(state.session.abort).toHaveBeenCalledTimes(1);
    expect(editor.setText).not.toHaveBeenCalled();
    expect(state.ui.requestRender).toHaveBeenCalled();
  });

  it('does not pause an active goal when clearing empty idle input', () => {
    const { state, editor, actions } = createState(false);
    editor.getText.mockReturnValue('');
    state.goalManager.isActive.mockReturnValue(true);

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage: vi.fn(),
    });

    actions.get('clear')?.();

    expect(state.goalManager.pause).not.toHaveBeenCalled();
    expect(state.goalManager.saveToThread).not.toHaveBeenCalled();
    expect(showInfo).not.toHaveBeenCalledWith(state, 'Goal paused (interrupted). Use /goal resume to continue.');
    expect(state.ui.requestRender).toHaveBeenCalled();
  });

  it('aborts when parked in a tool suspension even though isRunning() is false', () => {
    const { state, editor, actions } = createState(false);
    editor.getText.mockReturnValue('');
    state.session.suspensions.hasPending.mockReturnValue(true);

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage: vi.fn(),
    });

    actions.get('clear')?.();

    expect(state.session.abort).toHaveBeenCalledTimes(1);
    expect(state.userInitiatedAbort).toBe(true);
    expect(editor.setText).not.toHaveBeenCalled();
  });

  it('aborts the controller and persists a paused goal when clearing during goal judge evaluation', () => {
    const { state, actions } = createState(true);
    const abortController = { abort: vi.fn() };
    const component = { setInterrupted: vi.fn() };
    state.activeGoalJudge = { modelId: 'openai/gpt-5.5', abortController, component };

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage: vi.fn(),
    });

    actions.get('clear')?.();

    expect(abortController.abort).toHaveBeenCalledTimes(1);
    expect(component.setInterrupted).toHaveBeenCalledTimes(1);
    expect(state.session.abort).toHaveBeenCalledTimes(1);
    expect(state.goalManager.pause).toHaveBeenCalledWith('Judge evaluation was interrupted.');
    expect(state.goalManager.saveToThread).toHaveBeenCalledWith(state);
    expect(state.activeGoalJudge).toBeUndefined();
    expect(state.userInitiatedAbort).toBe(true);
  });

  it('aborts and clears an active plan approval parked in a tool suspension', () => {
    // Regression: Ctrl+C while a submit_plan approval box is up must abort the
    // parked suspension (not hang). The editor-level handleInput override lets
    // \x03 fall through to this 'clear' action; here we assert the action
    // aborts and clears the inline plan-approval component.
    const { state, editor, actions } = createState(false);
    editor.getText.mockReturnValue('');
    state.session.suspensions.hasPending.mockReturnValue(true);
    state.activeInlinePlanApproval = { handleInput: vi.fn() } as any;

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage: vi.fn(),
    });

    actions.get('clear')?.();

    expect(state.session.abort).toHaveBeenCalledTimes(1);
    expect(state.activeInlinePlanApproval).toBeUndefined();
    expect(state.userInitiatedAbort).toBe(true);
    expect(editor.setText).not.toHaveBeenCalled();
  });

  it('suspends the process with Ctrl+Z and restarts rendering on SIGCONT', () => {
    setPlatform('darwin');
    const { state, actions } = createState(false);
    const onceSpy = vi
      .spyOn(process, 'once')
      .mockImplementation((_event: string | symbol, _listener: (...args: any[]) => void) => {
        return process;
      });
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage: vi.fn(),
    });

    actions.get('suspend')?.();

    expect(state.ui.stop).toHaveBeenCalledTimes(1);
    expect(onceSpy).toHaveBeenCalledWith('SIGCONT', expect.any(Function));
    expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTSTP');
    expect(state.ui.start).not.toHaveBeenCalled();

    const onContinue = onceSpy.mock.calls[0]?.[1] as (() => void) | undefined;
    onContinue?.();

    expect(state.ui.start).toHaveBeenCalledTimes(1);
    expect(state.ui.requestRender).toHaveBeenCalledTimes(1);
  });

  it('restores the TUI and shows an error when process suspension fails', () => {
    setPlatform('darwin');
    vi.mocked(showError).mockClear();
    const { state, actions } = createState(false);
    const onceSpy = vi.spyOn(process, 'once').mockImplementation(() => process);
    const offSpy = vi.spyOn(process, 'off').mockImplementation(() => process);
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('no tty');
    });

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage: vi.fn(),
    });

    actions.get('suspend')?.();

    const onContinue = onceSpy.mock.calls[0]?.[1];
    expect(state.ui.stop).toHaveBeenCalledTimes(1);
    expect(offSpy).toHaveBeenCalledWith('SIGCONT', onContinue);
    expect(state.ui.start).toHaveBeenCalledTimes(1);
    expect(state.ui.requestRender).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith(state, 'Unable to suspend in the current terminal');
  });

  it('guards Ctrl+Z process suspension on Windows', () => {
    setPlatform('win32');
    vi.mocked(showInfo).mockClear();
    const { state, actions } = createState(false);
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage: vi.fn(),
    });

    actions.get('suspend')?.();

    expect(showInfo).toHaveBeenCalledWith(state, 'Suspend is not supported on Windows');
    expect(state.ui.stop).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('restores last cleared text with Alt+Z only when the editor is empty', () => {
    const { state, editor, actions } = createState(false);
    state.lastClearedText = 'restore me';
    editor.getText.mockReturnValue('');

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage: vi.fn(),
    });

    actions.get('undo')?.();

    expect(editor.setText).toHaveBeenCalledWith('restore me');
    expect(state.lastClearedText).toBe('');
    expect(state.ui.requestRender).toHaveBeenCalledTimes(1);

    state.lastClearedText = 'do not restore';
    editor.getText.mockReturnValue('current input');
    actions.get('undo')?.();

    expect(editor.setText).toHaveBeenCalledTimes(1);
  });

  it('toggles system reminder expansion with Ctrl+E', () => {
    const { state, actions } = createState(false);
    const reminder = { setExpanded: vi.fn() };
    state.allSystemReminderComponents = [reminder] as any;

    setupKeyboardShortcuts(state, {
      stop: vi.fn(),
      doubleCtrlCMs: 500,
      queueFollowUpMessage: vi.fn(),
    });

    const expandTools = actions.get('expandTools');
    expect(expandTools).toBeDefined();

    expandTools?.();
    expect(state.toolOutputExpanded).toBe(true);
    expect(reminder.setExpanded).toHaveBeenCalledWith(true);

    expandTools?.();
    expect(state.toolOutputExpanded).toBe(false);
    expect(reminder.setExpanded).toHaveBeenLastCalledWith(false);
  });
});
