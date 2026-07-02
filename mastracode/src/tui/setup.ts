/**
 * TUI setup: keyboard shortcuts, layout building, autocomplete, key handlers.
 */
import { execFileSync } from 'node:child_process';

import { CombinedAutocompleteProvider, Spacer, Text } from '@earendil-works/pi-tui';
import type { SlashCommand } from '@earendil-works/pi-tui';
import type { AgentControllerEventListener } from '@mastra/core/agent-controller';
import { getUserId } from '../utils/project.js';
import { loadCustomCommands } from '../utils/slash-command-loader.js';
import { ThreadLockError } from '../utils/thread-lock.js';
import { isUserInvocable } from './commands/skill-filters.js';
import { renderBanner } from './components/banner.js';
import { IdleCounterComponent } from './components/idle-counter.js';
import { SimpleProgressComponent } from './components/simple-progress.js';
import { TaskProgressComponent } from './components/task-progress.js';
import { showError, showInfo } from './display.js';
import { isGoalJudgeInputLocked, showGoalJudgeInputLockInfo } from './goal-input-lock.js';
import { askModalQuestion } from './modal-question.js';
import { showModalOverlay } from './overlay.js';
import type { TUIState } from './state.js';
import { updateStatusLine } from './status-line.js';
import { theme } from './theme.js';

// =============================================================================
// Keyboard Shortcuts
// =============================================================================

export function setupKeyboardShortcuts(
  state: TUIState,
  callbacks: {
    stop: () => void;
    doubleCtrlCMs: number;
    queueFollowUpMessage: (text: string) => void;
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

    if (abortActiveGoalJudge(state)) {
      return;
    }

    if (state.pendingApprovalDismiss) {
      // Dismiss active approval dialogs by declining the gated tool. Do not abort
      // the run: the decline is delivered through the normal approval resume path.
      state.pendingApprovalDismiss();
      state.activeInlinePlanApproval = undefined;
      state.activeInlineQuestion = undefined;
      state.pendingInlineQuestions.length = 0;
      return;
    } else if (state.session.run.isRunning() || state.session.suspensions.hasPending()) {
      // Clean up active inline components on abort. suspensions.hasPending() covers
      // the case where the run is parked in a tool suspend() (e.g. ask_user) —
      // isRunning() is false there because the AbortController was nulled, but the
      // run is still pending and must be abortable.
      state.activeInlinePlanApproval = undefined;
      state.activeInlineQuestion = undefined;
      state.pendingInlineQuestions.length = 0;
      state.pendingAskUserComponents?.clear();
      state.userInitiatedAbort = true;
      state.session.abort();
    } else {
      const current = state.editor.getText();
      if (current.length > 0) {
        state.lastClearedText = current;
        state.editor.setText('');
      }
      state.ui.requestRender();
    }
  });

  // Ctrl+Z - suspend process (SIGTSTP)
  state.editor.onAction('suspend', () => {
    if (process.platform === 'win32') {
      showInfo(state, 'Suspend is not supported on Windows');
      return;
    }

    state.ui.stop();
    const onContinue = () => {
      state.ui.start();
      state.ui.requestRender();
    };
    process.once('SIGCONT', onContinue);
    try {
      process.kill(process.pid, 'SIGTSTP');
    } catch {
      process.off('SIGCONT', onContinue);
      state.ui.start();
      state.ui.requestRender();
      showError(state, 'Unable to suspend in the current terminal');
    }
  });

  // Alt+Z - undo last clear (restore editor text)
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
    for (const reminder of state.allSystemReminderComponents) {
      reminder.setExpanded(state.toolOutputExpanded);
    }
    for (const shell of state.allShellComponents) {
      shell.setExpanded(state.toolOutputExpanded);
    }
    state.ui.requestRender();
  });

  // Shift+Tab - cycle controller modes
  state.editor.onAction('cycleMode', async () => {
    // Block mode switching while the agent is active or plan approval is pending
    if (state.session.run.isRunning()) {
      showInfo(state, 'Wait for the agent to finish first');
      return;
    }
    if (state.activeInlinePlanApproval) {
      showInfo(state, 'Resolve the plan approval first');
      return;
    }

    const modes = state.controller.listModes();
    if (modes.length <= 1) return;
    const currentId = state.session.mode.get();
    const currentIndex = modes.findIndex(m => m.id === currentId);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex]!;
    await state.session.mode.switch({ modeId: nextMode.id });
  });

  // Ctrl+Y - toggle YOLO mode
  state.editor.onAction('toggleYolo', () => {
    const current = (state.session.state.get() as any)?.yolo === true;
    void state.session.state.set({ yolo: !current } as any);
    showInfo(state, current ? 'YOLO mode off' : 'YOLO mode on');
  });

  // Enter - submit immediately. The submit handler decides whether active input
  // should be sent as a signal or queued for cases signals cannot handle.
  state.editor.onAction('followUp', () => {
    if (isGoalJudgeInputLocked(state)) {
      showGoalJudgeInputLockInfo(state);
      state.ui.requestRender();
      return true;
    }

    state.editor.onSubmit?.(state.editor.getExpandedText());
    return true;
  });

  // Ctrl+F - explicitly queue a follow-up while a run is active. Enter now sends
  // normal messages as signals during active runs; this preserves manual FIFO
  // queueing for slash commands, image messages, and messages the user wants to
  // hold until the current run finishes.
  state.editor.onAction('queueFollowUp', () => {
    if (isGoalJudgeInputLocked(state)) {
      showGoalJudgeInputLockInfo(state);
      state.ui.requestRender();
      return true;
    }

    const text = state.editor.getExpandedText();
    if (!state.session.run.isRunning()) {
      state.editor.onSubmit?.(text);
      return true;
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return true;
    }

    state.editor.addToHistory(text);
    state.editor.setText('');
    callbacks.queueFollowUpMessage(text);
    return true;
  });
}

function abortActiveGoalJudge(state: TUIState): boolean {
  const activeGoalJudge = state.activeGoalJudge;
  if (!activeGoalJudge) return false;

  state.userInitiatedAbort = true;
  activeGoalJudge.abortController.abort();
  activeGoalJudge.component.setInterrupted();
  // Esc during an in-loop goal evaluation pauses the goal so it does not
  // continue on the next iteration. Abort the active controller run too: the core
  // scorer owns the judge stream, so the TUI-local controller alone only changes
  // the visual component and lets the judge continue in the background.
  state.session.abort();
  // Persist the paused state immediately so a thread switch or exit before the
  // next save does not reload the old active objective and effectively undo the
  // pause. `saveToThread` is best-effort, so run it fire-and-forget to keep this
  // abort handler synchronous.
  state.goalManager.pause('Judge evaluation was interrupted.');
  void state.goalManager.saveToThread(state);
  state.activeGoalJudge = undefined;
  state.ui.requestRender();
  return true;
}

// =============================================================================
// Layout
// =============================================================================

export function buildLayout(state: TUIState, refreshModelAuthStatus: () => Promise<void>): void {
  // Add header
  const appName = state.options.appName || 'Mastra Code';
  const version = state.options.version || '0.1.0';

  const banner = renderBanner(version, appName);

  // Project frontmatter
  const frontmatter = [
    `Project: ${state.projectInfo.name}`,
    `Resource ID: ${state.projectInfo.resourceId}`,
    state.projectInfo.gitBranch ? `Branch: ${state.projectInfo.gitBranch}` : null,
    state.projectInfo.isWorktree ? `Worktree of: ${state.projectInfo.mainRepoPath}` : null,
    `User: ${getUserId(state.projectInfo.rootPath)}`,
  ]
    .filter(Boolean)
    .map(line => theme.fg('muted', line as string))
    .join('\n');

  const sep = theme.fg('dim', ' · ');
  const hintParts: string[] = [];
  if (state.controller.listModes().length > 1) {
    hintParts.push(`${theme.fg('accent', '⇧+Tab')} ${theme.fg('muted', 'cycle modes')}`);
  }
  hintParts.push(`${theme.fg('accent', '/help')} ${theme.fg('muted', 'info & shortcuts')}`);
  const instructions = `  ${hintParts.join(sep)}`;

  state.ui.addChild(new Spacer(1));
  state.ui.addChild(new Text(banner, 1, 0));
  state.ui.addChild(new Text(frontmatter, 1, 0));
  state.ui.addChild(new Spacer(1));
  state.ui.addChild(new Text(instructions, 0, 0));
  state.ui.addChild(new Spacer(1));

  // Add main containers
  state.ui.addChild(state.chatContainer);
  // Task progress (between chat and editor, visible only when tasks exist)
  state.taskProgress = new TaskProgressComponent();
  state.taskProgress.setQuietMode(state.quietMode);
  state.ui.addChild(state.taskProgress);
  state.ui.addChild(state.editorContainer);
  state.idleCounter = new IdleCounterComponent();
  state.editorContainer.addChild(state.idleCounter);
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

/** Detect the fd binary (fast file finder) for @ fuzzy file autocomplete */
function detectFdPath(): string | null {
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';
  for (const bin of ['fd', 'fdfind']) {
    try {
      const resolved = execFileSync(whichCmd, [bin], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
        .trim()
        .split(/\r?\n/)[0];
      if (resolved) return resolved;
    } catch {
      // not found, try next
    }
  }
  return null;
}

export function setupAutocomplete(state: TUIState): void {
  const slashCommands: SlashCommand[] = [
    { name: 'new', description: 'Start a new thread' },
    { name: 'clone', description: 'Clone the current thread' },
    { name: 'thread', description: 'Show current thread info' },
    { name: 'threads', description: 'Switch between threads' },
    { name: 'models', description: 'Switch model pack' },
    { name: 'custom-providers', description: 'Manage custom providers and models' },
    { name: 'subagents', description: 'Configure subagent model defaults' },
    { name: 'om', description: 'Configure Observational Memory models' },
    { name: 'think', description: 'Set thinking (off|low|medium|high|xhigh|status)' },
    { name: 'login', description: 'Login with OAuth provider' },
    { name: 'skills', description: 'List available skills' },
    { name: 'skill/', description: 'Activate a skill by name' },
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
    {
      name: 'voice',
      description: 'Manage push-to-talk voice input (engine, provider, model)',
    },
    { name: 'review', description: 'Review a GitHub pull request' },
    { name: 'report-issue', description: 'Open or browse mastracode issues' },
    { name: 'setup', description: 'Re-run the setup wizard' },
    { name: 'browser', description: 'Configure browser automation' },
    { name: 'theme', description: 'Switch color theme (auto/dark/light)' },
    { name: 'update', description: 'Check for and install updates' },
    { name: 'api-keys', description: 'Manage API keys for model providers' },
    { name: 'plugins', description: 'Manage Mastra Code plugins' },
    { name: 'observability', description: 'Configure cloud observability' },
    {
      name: 'github',
      description: 'Subscribe/sync/debug GitHub PR signals',
      getArgumentCompletions: (argumentPrefix: string) =>
        [
          { value: 'subscribe', label: 'subscribe', description: 'Subscribe this thread to a GitHub PR' },
          { value: 'unsubscribe', label: 'unsubscribe', description: 'Unsubscribe this thread from a GitHub PR' },
          { value: 'sync', label: 'sync', description: 'Immediately sync subscribed GitHub PRs' },
          { value: 'debug', label: 'debug', description: 'Show GitHub signal subscription debug info' },
        ].filter(command => command.value.startsWith(argumentPrefix.toLowerCase())),
    },
    {
      name: 'goal',
      description: 'Set/manage persistent goal (Ralph loop)',
      getArgumentCompletions: (argumentPrefix: string) =>
        [
          { value: 'status', label: 'status', description: 'Show current goal status' },
          { value: 'pause', label: 'pause', description: 'Pause the goal continuation loop' },
          { value: 'resume', label: 'resume', description: 'Resume the current goal' },
          { value: 'clear', label: 'clear', description: 'Clear the current goal' },
          { value: 'judge', label: 'judge', description: 'Set the goal judge model and max attempts' },
        ].filter(command => command.value.startsWith(argumentPrefix.toLowerCase())),
    },
    { name: 'exit', description: 'Exit the TUI' },
    { name: 'help', description: 'Show available commands' },
  ];

  // Only show /mode if there's more than one mode
  const modes = state.controller.listModes();
  if (modes.length > 1) {
    slashCommands.push({ name: 'mode', description: 'Switch agent mode' });
  }

  // Add custom slash commands to the list with // prefixes so they remain
  // visually distinct from built-in slash commands in autocomplete.
  for (const customCmd of state.customSlashCommands) {
    slashCommands.push({
      name: `/${customCmd.name}`,
      description: customCmd.description || `Custom: ${customCmd.name}`,
    });
    if (customCmd.goal) {
      slashCommands.push({
        name: `goal/${customCmd.name}`,
        description: customCmd.description ? `Goal: ${customCmd.description}` : `Goal: ${customCmd.name}`,
      });
    }
  }

  for (const skill of state.skillCommands) {
    slashCommands.push({
      name: `skill/${skill.name}`,
      description: skill.description ? `Skill: ${skill.description}` : `Skill: ${skill.name}`,
    });
  }

  for (const skill of state.goalSkillCommands) {
    slashCommands.push({
      name: `goal/${skill.name}`,
      description: skill.description ? `Goal skill: ${skill.description}` : `Goal skill: ${skill.name}`,
    });
  }

  const fdPath = detectFdPath();
  state.autocompleteProvider = new CombinedAutocompleteProvider(slashCommands, process.cwd(), fdPath);
  state.editor.setAutocompleteProvider(state.autocompleteProvider);
}

// =============================================================================
// Custom Slash Commands Loading
// =============================================================================

export async function loadCustomSlashCommands(state: TUIState): Promise<void> {
  try {
    const sessionState = state.session.state.get() as { configDir?: string; pluginCommandPaths?: string[] } | undefined;
    const configDir = sessionState?.configDir;
    // Load from all sources (global and local)
    const globalCommands = await loadCustomCommands(undefined, configDir);
    const localCommands = await loadCustomCommands(process.cwd(), configDir, sessionState?.pluginCommandPaths ?? []);

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
  // Skills load via `refreshSkillsAutocomplete` so this never blocks on workspace resolution.
}

/**
 * Populate `state.skillCommands` and `state.goalSkillCommands` from the
 * workspace. Safe to call before the workspace is resolved (returns empty
 * lists) and again later once it is (resolves and refreshes).
 */
export async function loadSkillCommands(state: TUIState): Promise<void> {
  try {
    let workspace = state.controller.getWorkspace() ?? state.workspace;
    if (!workspace && state.controller.hasWorkspace()) {
      workspace = await state.controller.resolveWorkspace({ session: state.session });
    }
    if (!workspace?.skills) {
      state.skillCommands = [];
      state.goalSkillCommands = [];
      return;
    }
    const skills = (await workspace.skills.list()).filter(isUserInvocable);
    state.skillCommands = skills;
    state.goalSkillCommands = skills.filter(skill => skill.metadata?.goal === true);
  } catch {
    state.skillCommands = [];
    state.goalSkillCommands = [];
  }
}

/** Reload skills and rebuild the autocomplete provider. */
export async function refreshSkillsAutocomplete(state: TUIState): Promise<void> {
  await loadSkillCommands(state);
  setupAutocomplete(state);
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
): () => void {
  // Handle Ctrl+C via process signal (backup for when editor doesn't capture it)
  const sigintHandler = () => {
    const now = Date.now();
    if (now - state.lastCtrlCTime < callbacks.doubleCtrlCMs) {
      callbacks.stop();
      process.exit(0);
    }
    state.lastCtrlCTime = now;
    if (abortActiveGoalJudge(state)) {
      return;
    }
    if (state.pendingApprovalDismiss) {
      state.pendingApprovalDismiss();
    }
    state.activeInlinePlanApproval = undefined;
    state.activeInlineQuestion = undefined;
    state.pendingInlineQuestions.length = 0;
    state.pendingAskUserComponents?.clear();
    state.userInitiatedAbort = true;
    state.session.abort();
  };
  process.on('SIGINT', sigintHandler);

  // Use onDebug callback for Shift+Ctrl+D
  state.ui.onDebug = () => {
    // Toggle debug mode or show debug info
    // Currently unused - could add debug panel in future
  };

  return () => {
    process.off('SIGINT', sigintHandler);
  };
}

// =============================================================================
// AgentController Subscription
// =============================================================================

export function subscribeToAgentController(state: TUIState, handleEvent: (event: any) => Promise<void>): void {
  let eventQueue = Promise.resolve();
  const listener: AgentControllerEventListener = event => {
    eventQueue = eventQueue.then(async () => {
      try {
        await handleEvent(event);
      } catch (err) {
        // Log but don't crash — individual event errors shouldn't kill the process
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        process.stderr.write(`[event error] ${event.type}: ${msg}\n`);
        if (stack) process.stderr.write(stack + '\n');
      }
    });
    return eventQueue;
  };
  state.unsubscribe = state.session.subscribe(listener);
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
  const currentPath = state.projectInfo.rootPath;
  const currentResourceId = state.session.identity.getResourceId();

  const allThreads = await state.session.thread.list();
  const activeThreadId = state.session.thread.getId();

  // Filter to threads explicitly tagged for the current working directory.
  const taggedThreads = allThreads.filter(t => {
    const threadPath = t.metadata?.projectPath as string | undefined;
    return !!threadPath && threadPath === currentPath;
  });
  const threads: typeof taggedThreads = [];
  for (const thread of taggedThreads) {
    const isActiveBlankThread = thread.id === activeThreadId && !thread.title;
    if (isActiveBlankThread) {
      const messages = await state.session.thread.listMessages({ threadId: thread.id, limit: 1 });
      if (messages.length === 0) continue;
    }
    threads.push(thread);
  }

  if (threads.length === 0) {
    const driftCandidates = (
      await state.session.thread.list({
        allResources: true,
        metadata: { projectPath: currentPath },
      })
    ).filter(t => t.resourceId !== currentResourceId);
    const [thread] = [...driftCandidates].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    if (thread) {
      const answer = await askModalQuestion(state.ui, {
        question: [
          'This directory is tagged on a different resource.',
          '',
          `Project: ${currentPath}`,
          `Thread: ${thread.title || thread.id}`,
          `Old resource: ${thread.resourceId}`,
          `Current resource: ${currentResourceId}`,
          '',
          'Clone this thread into the current resource and resume the clone?',
        ].join('\n'),
        options: [{ label: 'Clone and resume' }, { label: 'Start fresh' }],
        selectedOptionLabel: 'Clone and resume',
        allowCustomResponse: false,
        overlay: { widthPercent: 80, maxHeight: '70%' },
      });

      if (answer === 'Clone and resume') {
        const progress = new SimpleProgressComponent({ showElapsed: false, showPercentage: false });
        progress.start('Cloning thread into the current resource...');
        showModalOverlay(state.ui, progress, { widthPercent: 70, maxHeight: '40%', minHeightPercent: 0.35 });
        state.ui.requestRender();

        try {
          await new Promise(resolve => setTimeout(resolve, 50));
          progress.updateStatus('Loading cloned thread...');
          state.ui.requestRender();
          await state.session.thread.cloneToCurrentResource({
            threadId: thread.id,
            expectedResourceId: thread.resourceId,
            expectedProjectPath: currentPath,
          });
        } finally {
          state.ui.hideOverlay();
          state.ui.requestRender();
        }
        return;
      }
    }

    // No existing threads for this path - defer creation until first message
    state.pendingNewThread = true;
    return;
  }

  // Sort by most recent
  const sortedThreads = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  // Try each in order until one is unlocked
  for (const thread of sortedThreads) {
    try {
      await state.session.thread.switch({ threadId: thread.id });
      if (!thread.metadata?.projectPath) {
        await state.session.thread.setSetting({ key: 'projectPath', value: currentPath });
      }
      return;
    } catch (error) {
      if (error instanceof ThreadLockError) {
        continue; // Try the next one
      }
      throw error;
    }
  }

  // All directory threads are locked — silently start a new thread
  state.pendingNewThread = true;
}

// =============================================================================
// Existing Tasks
// =============================================================================

export async function renderExistingTasks(state: TUIState): Promise<void> {
  try {
    const tasks = state.session.displayState.get().tasks;

    if (tasks.length > 0 && state.taskProgress) {
      state.taskProgress.updateTasks(tasks);
      state.ui.requestRender();
    }
  } catch {
    // Silently ignore task rendering errors
  }
}
