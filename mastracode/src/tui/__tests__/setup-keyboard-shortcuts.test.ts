import { describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {},
}));

const autocompleteProviders: Array<{ commands: Array<{ name: string; description: string }> }> = [];

vi.mock('@mariozechner/pi-tui', () => ({
  CombinedAutocompleteProvider: class {
    constructor(commands: Array<{ name: string; description: string }>) {
      autocompleteProviders.push({ commands });
    }
  },
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

import { setupAutocomplete, setupKeyboardShortcuts } from '../setup.js';

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

  const state = {
    editor,
    harness: {
      isRunning: vi.fn(() => isRunning),
      getState: vi.fn(() => ({})),
      listModes: vi.fn(() => []),
      getCurrentModeId: vi.fn(),
      switchMode: vi.fn(),
      setState: vi.fn(),
      abort: vi.fn(),
    },
    pendingApprovalDismiss: undefined,
    activeInlinePlanApproval: undefined,
    activeInlineQuestion: undefined,
    pendingInlineQuestions: [],
    userInitiatedAbort: false,
    lastCtrlCTime: 0,
    lastClearedText: '',
    hideThinkingBlock: false,
    toolOutputExpanded: false,
    allToolComponents: [],
    allSlashCommandComponents: [],
    allSystemReminderComponents: [],
    allShellComponents: [],
    ui: { requestRender: vi.fn(), start: vi.fn(), stop: vi.fn() },
  } as any;

  return { state, editor, actions };
}

describe('setupKeyboardShortcuts', () => {
  it('defaults slash-command autocomplete to the first visible built-in command before custom commands', () => {
    autocompleteProviders.length = 0;
    const { state, editor } = createState(false);
    state.customSlashCommands = [
      { name: 'deploy', description: 'Deploy to prod', template: '', sourcePath: '' },
      { name: 'ship', description: 'Ship release', template: '', sourcePath: '' },
    ];
    state.harness.listModes = vi.fn(() => ['default']);

    setupAutocomplete(state);

    expect(editor.setAutocompleteProvider).toHaveBeenCalledTimes(1);
    expect(autocompleteProviders).toHaveLength(1);

    const commandNames = autocompleteProviders[0]?.commands.map(command => command.name) ?? [];
    expect(commandNames[0]).toBe('new');
    expect(commandNames).toContain('thread');
    expect(commandNames.indexOf('thread')).toBeLessThan(commandNames.indexOf('threads'));
    expect(commandNames).not.toContain('memory-gateway');
    expect(commandNames.indexOf('/deploy')).toBeGreaterThan(commandNames.indexOf('help'));
    expect(commandNames.slice(-2)).toEqual(['/deploy', '/ship']);
  });

  it('submits immediately on Enter when the harness is idle', () => {
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

  it('queues follow-up input on Enter while the harness is running', () => {
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
    expect(editor.addToHistory).toHaveBeenCalledWith('/help');
    expect(queueFollowUpMessage).toHaveBeenCalledWith('/help');
    expect(editor.setText).toHaveBeenCalledWith('');
    expect(editor.onSubmit).not.toHaveBeenCalled();
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
