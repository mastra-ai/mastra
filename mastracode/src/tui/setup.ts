/**
 * TUI setup: keyboard shortcuts, layout building, autocomplete, key handlers.
 */
import fs from 'node:fs';

import { CombinedAutocompleteProvider, Spacer, Text } from '@mariozechner/pi-tui';
import type { SlashCommand } from '@mariozechner/pi-tui';
import type { HarnessEventListener, TaskItem } from '@mastra/core/harness';

import { loadCustomCommands } from '../utils/slash-command-loader.js';
import { ThreadLockError } from '../utils/thread-lock.js';
import { TaskProgressComponent } from './components/task-progress.js';
import { showError, showInfo } from './display.js';
import { addUserMessage } from './render-messages.js';
import type { TUIState } from './state.js';
import { updateStatusLine } from './status-line.js';
import { fg, bold } from './theme.js';

// =============================================================================
// Keyboard Shortcuts
// =============================================================================

export function setupKeyboardShortcuts(
  state: TUIState,
  callbacks: {
    stop: () => void;
    doubleCtrlCMs: number;
  },
): void {
  // Ctrl+C / Escape - abort if running, clear input if idle, double-tap always exits
  state.editor.onAction('clear', () => {
    const now = Date.now();
    if (now - state.lastCtrlCTime < callbacks.doubleCtrlCMs) {
      // Double Ctrl+C → exit
      callbacks.stop();
      process.exit(0);
    }
    state.lastCtrlCTime = now;

    if (state.pendingApprovalDismiss) {
      // Dismiss active approval dialog and abort
      state.pendingApprovalDismiss();
      state.activeInlinePlanApproval = undefined;
      state.activeInlineQuestion = undefined;
      state.userInitiatedAbort = true;
      state.harness.abort();
    } else if (state.harness.isRunning()) {
      // Clean up active inline components on abort
      state.activeInlinePlanApproval = undefined;
      state.activeInlineQuestion = undefined;
      state.userInitiatedAbort = true;
      state.harness.abort();
    } else {
      const current = state.editor.getText();
      if (current.length > 0) {
        state.lastClearedText = current;
      }
      state.editor.setText('');
      state.ui.requestRender();
    }
  });

  // Ctrl+Z - undo last clear (restore editor text)
  state.editor.onAction('undo', () => {
    if (state.lastClearedText && state.editor.getText().length === 0) {
      state.editor.setText(state.lastClearedText);
      state.lastClearedText = '';
      state.ui.requestRender();
    }
  });

  // Ctrl+D - exit when editor is empty
  state.editor.onCtrlD = () => {
    callbacks.stop();
    process.exit(0);
  };

  // Ctrl+T - toggle thinking blocks visibility
  state.editor.onAction('toggleThinking', () => {
    state.hideThinkingBlock = !state.hideThinkingBlock;
    state.ui.requestRender();
  });

  // Ctrl+E - expand/collapse tool outputs
  state.editor.onAction('expandTools', () => {
    state.toolOutputExpanded = !state.toolOutputExpanded;
    for (const tool of state.allToolComponents) {
      tool.setExpanded(state.toolOutputExpanded);
    }
    for (const sc of state.allSlashCommandComponents) {
      sc.setExpanded(state.toolOutputExpanded);
    }
    state.ui.requestRender();
  });

  // Shift+Tab - cycle harness modes
  state.editor.onAction('cycleMode', async () => {
    // Block mode switching while plan approval is active
    if (state.activeInlinePlanApproval) {
      showInfo(state, 'Resolve the plan approval first');
      return;
    }

    const modes = state.harness.listModes();
    if (modes.length <= 1) return;
    const currentId = state.harness.getCurrentModeId();
    const currentIndex = modes.findIndex(m => m.id === currentId);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex]!;
    await state.harness.switchMode({ modeId: nextMode.id });
    updateStatusLine(state);
  });

  // Ctrl+Y - toggle YOLO mode
  state.editor.onAction('toggleYolo', () => {
    const current = (state.harness.getState() as any).yolo === true;
    state.harness.setState({ yolo: !current } as any);
    updateStatusLine(state);
    showInfo(state, current ? 'YOLO mode off' : 'YOLO mode on');
  });

  // Ctrl+F - queue follow-up message while streaming
  state.editor.onAction('followUp', () => {
    const text = state.editor.getText().trim();
    if (!text) return;
    if (!state.harness.isRunning()) return; // Only relevant while streaming

    // Clear editor
    state.editor.setText('');
    state.ui.requestRender();

    if (text.startsWith('/')) {
      // Queue slash command for processing after the agent completes
      state.pendingSlashCommands.push(text);
      showInfo(state, `Slash command queued: ${text}`);
    } else {
      // Queue as a regular follow-up message
      addUserMessage(state, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: [{ type: 'text', text }],
        createdAt: new Date(),
      });
      state.ui.requestRender();

      state.harness.followUp({ content: text }).catch(error => {
        showError(state, error instanceof Error ? error.message : 'Follow-up failed');
      });
    }
  });
}

// =============================================================================
// Layout
// =============================================================================

export function buildLayout(state: TUIState, refreshModelAuthStatus: () => Promise<void>): void {
  // Add header
  const appName = state.options.appName || 'Mastra Code';
  const version = state.options.version || '0.1.0';

  const logo = fg('accent', '◆') + ' ' + bold(fg('accent', appName)) + fg('dim', ` v${version}`);

  const keyStyle = (k: string) => fg('accent', k);
  const sep = fg('dim', ' · ');
  const instructions = [
    `  ${keyStyle('Ctrl+C')} ${fg('muted', 'interrupt/clear')}${sep}${keyStyle('Ctrl+C×2')} ${fg('muted', 'exit')}`,
    `  ${keyStyle('Enter')} ${fg('muted', 'while working → steer')}${sep}${keyStyle('Ctrl+F')} ${fg('muted', '→ queue follow-up')}`,
    `  ${keyStyle('/')} ${fg('muted', 'commands')}${sep}${keyStyle('!')} ${fg('muted', 'shell')}${sep}${keyStyle('Ctrl+T')} ${fg('muted', 'thinking')}${sep}${keyStyle('Ctrl+E')} ${fg('muted', 'tools')}${state.harness.listModes().length > 1 ? `${sep}${keyStyle('⇧Tab')} ${fg('muted', 'mode')}` : ''}`,
  ].join('\n');

  state.ui.addChild(new Spacer(1));
  state.ui.addChild(
    new Text(
      `${logo}
${instructions}`,
      1,
      0,
    ),
  );
  state.ui.addChild(new Spacer(1));

  // Add main containers
  state.ui.addChild(state.chatContainer);
  // Task progress (between chat and editor, visible only when tasks exist)
  state.taskProgress = new TaskProgressComponent();
  state.ui.addChild(state.taskProgress);
  state.ui.addChild(state.editorContainer);
  state.editorContainer.addChild(state.editor);

  // Add footer with two-line status
  state.statusLine = new Text('', 0, 0);
  state.memoryStatusLine = new Text('', 0, 0);
  state.footer.addChild(state.statusLine);
  state.footer.addChild(state.memoryStatusLine);
  state.ui.addChild(state.footer);
  updateStatusLine(state);
  refreshModelAuthStatus();

  // Set focus to editor
  state.ui.setFocus(state.editor);
}

// =============================================================================
// Autocomplete
// =============================================================================

export function setupAutocomplete(state: TUIState): void {
  const slashCommands: SlashCommand[] = [
    { name: 'new', description: 'Start a new thread' },
    { name: 'threads', description: 'Switch between threads' },
    { name: 'models', description: 'Configure model (global/thread/mode)' },
    { name: 'subagents', description: 'Configure subagent model defaults' },
    { name: 'om', description: 'Configure Observational Memory models' },
    { name: 'think', description: 'Set thinking level (Anthropic)' },
    { name: 'login', description: 'Login with OAuth provider' },
    { name: 'skills', description: 'List available skills' },
    { name: 'cost', description: 'Show token usage and estimated costs' },
    { name: 'diff', description: 'Show modified files or git diff' },
    { name: 'name', description: 'Rename current thread' },
    {
      name: 'resource',
      description: 'Show/switch resource ID (tag for sharing)',
    },
    { name: 'logout', description: 'Logout from OAuth provider' },
    { name: 'hooks', description: 'Show/reload configured hooks' },
    { name: 'mcp', description: 'Show/reload MCP server connections' },
    {
      name: 'thread:tag-dir',
      description: 'Tag current thread with this directory',
    },
    {
      name: 'sandbox',
      description: 'Manage allowed paths (add/remove directories)',
    },
    {
      name: 'permissions',
      description: 'View/manage tool approval permissions',
    },
    {
      name: 'settings',
      description: 'General settings (notifications, YOLO, thinking)',
    },
    {
      name: 'yolo',
      description: 'Toggle YOLO mode (auto-approve all tools)',
    },
    { name: 'review', description: 'Review a GitHub pull request' },
    { name: 'exit', description: 'Exit the TUI' },
    { name: 'help', description: 'Show available commands' },
  ];

  // Only show /mode if there's more than one mode
  const modes = state.harness.listModes();
  if (modes.length > 1) {
    slashCommands.push({ name: 'mode', description: 'Switch agent mode' });
  }

  // Add custom slash commands to the list
  for (const customCmd of state.customSlashCommands) {
    // Prefix with extra / to distinguish from built-in commands (//command-name)
    slashCommands.push({
      name: `/${customCmd.name}`,
      description: customCmd.description || `Custom: ${customCmd.name}`,
    });
  }

  state.autocompleteProvider = new CombinedAutocompleteProvider(slashCommands, process.cwd());
  state.editor.setAutocompleteProvider(state.autocompleteProvider);
}

// =============================================================================
// Custom Slash Commands Loading
// =============================================================================

export async function loadCustomSlashCommands(state: TUIState): Promise<void> {
  try {
    // Load from all sources (global and local)
    const globalCommands = await loadCustomCommands();
    const localCommands = await loadCustomCommands(process.cwd());

    // Merge commands, with local taking precedence over global for same names
    const commandMap = new Map<string, (typeof globalCommands)[number]>();

    // Add global commands first
    for (const cmd of globalCommands) {
      commandMap.set(cmd.name, cmd);
    }

    // Add local commands (will override global if same name)
    for (const cmd of localCommands) {
      commandMap.set(cmd.name, cmd);
    }

    state.customSlashCommands = Array.from(commandMap.values());
  } catch {
    state.customSlashCommands = [];
  }
}

// =============================================================================
// Key Handlers
// =============================================================================

export function setupKeyHandlers(
  state: TUIState,
  callbacks: {
    stop: () => void;
    doubleCtrlCMs: number;
  },
): void {
  // Handle Ctrl+C via process signal (backup for when editor doesn't capture it)
  process.on('SIGINT', () => {
    const now = Date.now();
    if (now - state.lastCtrlCTime < callbacks.doubleCtrlCMs) {
      callbacks.stop();
      process.exit(0);
    }
    state.lastCtrlCTime = now;
    if (state.pendingApprovalDismiss) {
      state.pendingApprovalDismiss();
    }
    state.userInitiatedAbort = true;
    state.harness.abort();
  });

  // Use onDebug callback for Shift+Ctrl+D
  state.ui.onDebug = () => {
    // Toggle debug mode or show debug info
    // Currently unused - could add debug panel in future
  };
}

// =============================================================================
// Harness Subscription
// =============================================================================

export function subscribeToHarness(state: TUIState, handleEvent: (event: any) => Promise<void>): void {
  const listener: HarnessEventListener = async event => {
    await handleEvent(event);
  };
  state.unsubscribe = state.harness.subscribe(listener);
}

// =============================================================================
// Terminal Title
// =============================================================================

export function updateTerminalTitle(state: TUIState): void {
  const appName = state.options.appName || 'Mastra Code';
  const cwd = process.cwd().split('/').pop() || '';
  state.ui.terminal.setTitle(`${appName} - ${cwd}`);
}

// =============================================================================
// Thread Selection
// =============================================================================

export async function promptForThreadSelection(state: TUIState): Promise<void> {
  const allThreads = await state.harness.listThreads();

  // Filter to threads matching the current working directory.
  const currentPath = state.projectInfo.rootPath;
  let dirCreatedAt: Date | undefined;
  try {
    const stat = fs.statSync(currentPath);
    dirCreatedAt = stat.birthtime;
  } catch {
    // fall through – treat all untagged threads as candidates
  }
  const threads = allThreads.filter(t => {
    const threadPath = t.metadata?.projectPath as string | undefined;
    if (threadPath) return threadPath === currentPath;
    if (dirCreatedAt) return t.createdAt >= dirCreatedAt;
    return true;
  });

  if (threads.length === 0) {
    // No existing threads for this path - defer creation until first message
    state.pendingNewThread = true;
    return;
  }

  // Sort by most recent
  const sortedThreads = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const mostRecent = sortedThreads[0]!;
  // Auto-resume the most recent thread for this directory
  try {
    await state.harness.switchThread({ threadId: mostRecent.id });
    // Retroactively tag untagged legacy threads
    if (!mostRecent.metadata?.projectPath) {
      await state.harness.setThreadSetting({ key: 'projectPath', value: currentPath });
    }
  } catch (error) {
    if (error instanceof ThreadLockError) {
      // Defer the lock conflict prompt until after the TUI is started
      state.pendingNewThread = true;
      state.pendingLockConflict = {
        threadTitle: mostRecent.title || mostRecent.id,
        ownerPid: error.ownerPid,
      };
      return;
    }
    throw error;
  }
}

// =============================================================================
// Existing Tasks
// =============================================================================

export async function renderExistingTasks(state: TUIState): Promise<void> {
  try {
    const harnessState = state.harness.getState() as { tasks?: TaskItem[] };
    const tasks = harnessState.tasks || [];

    if (tasks.length > 0 && state.taskProgress) {
      state.taskProgress.updateTasks(tasks);
      state.ui.requestRender();
    }
  } catch {
    // Silently ignore task rendering errors
  }
}
