/**
 * Main TUI class for Mastra Code.
 * Wires the Harness to pi-tui components for a full interactive experience.
 */
import fs from 'node:fs';
import { CombinedAutocompleteProvider, Spacer, Text } from '@mariozechner/pi-tui';
import type { Component, SlashCommand } from '@mariozechner/pi-tui';
import type { HarnessEvent, HarnessMessage, HarnessEventListener, TaskItem } from '@mastra/core/harness';
import type { Workspace } from '@mastra/core/workspace';
import { parseError } from '../utils/errors.js';
import { loadCustomCommands } from '../utils/slash-command-loader.js';
import type { SlashCommandMetadata } from '../utils/slash-command-loader.js';
import { processSlashCommand } from '../utils/slash-command-processor.js';
import { ThreadLockError } from '../utils/thread-lock.js';
import {
  handleHelpCommand,
  handleCostCommand,
  handleYoloCommand,
  handleThinkCommand,
  handlePermissionsCommand,
  handleNameCommand,
  handleExitCommand,
  handleHooksCommand,
  handleMcpCommand,
  handleModeCommand,
  handleSkillsCommand,
  handleNewCommand,
  handleResourceCommand,
  handleDiffCommand,
  handleThreadsCommand,
  handleThreadTagDirCommand,
  handleSandboxCommand as handleSandboxCmd,
  handleModelsCommand,
  handleSubagentsCommand,
  handleOMCommand,
  handleSettingsCommand,
  handleLoginCommand,
  handleReviewCommand as handleReviewCmd,
} from './commands/index.js';
import type { SlashCommandContext } from './commands/types.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { defaultOMProgressState } from './components/om-progress.js';
import { ShellOutputComponent } from './components/shell-output.js';
import { SlashCommandComponent } from './components/slash-command.js';
import { TaskProgressComponent } from './components/task-progress.js';
import {
  handleAgentStart,
  handleAgentEnd,
  handleAgentAborted,
  handleAgentError,
  handleMessageStart,
  handleMessageUpdate,
  handleMessageEnd,
  handleUsageUpdate,
  handleOMStatus,
  handleOMObservationStart,
  handleOMObservationEnd,
  handleOMReflectionStart,
  handleOMReflectionEnd,
  handleOMFailed,
  handleOMBufferingStart,
  handleOMBufferingEnd,
  handleOMBufferingFailed,
  handleOMActivation,
  handleAskQuestion,
  handleSandboxAccessRequest,
  handlePlanApproval,
  handleSubagentStart,
  handleSubagentToolStart,
  handleSubagentToolEnd,
  handleSubagentEnd,
  handleToolApprovalRequired,
  handleToolStart,
  handleToolUpdate,
  handleShellOutput,
  handleToolInputStart,
  handleToolInputDelta,
  handleToolInputEnd,
  handleToolEnd,
} from './handlers/index.js';
import type { EventHandlerContext } from './handlers/types.js';
import { sendNotification } from './notify.js';
import type { NotificationMode, NotificationReason } from './notify.js';
import {
  addUserMessage,
  renderCompletedTasksInline,
  renderClearedTasksInline,
  renderExistingMessages,
} from './render-messages.js';
import type { MastraTUIOptions, TUIState } from './state.js';
import { createTUIState } from './state.js';
import { updateStatusLine } from './status-line.js';
import { fg, bold } from './theme.js';

// =============================================================================
// Types
// =============================================================================

export type { MastraTUIOptions } from './state.js';

// =============================================================================
// MastraTUI Class
// =============================================================================

export class MastraTUI {
  private state: TUIState;

  private static readonly DOUBLE_CTRL_C_MS = 500;

  constructor(options: MastraTUIOptions) {
    this.state = createTUIState(options);

    // Override editor input handling to check for active inline components
    const originalHandleInput = this.state.editor.handleInput.bind(this.state.editor);
    this.state.editor.handleInput = (data: string) => {
      // If there's an active plan approval, route input to it
      if (this.state.activeInlinePlanApproval) {
        this.state.activeInlinePlanApproval.handleInput(data);
        return;
      }
      // If there's an active inline question, route input to it
      if (this.state.activeInlineQuestion) {
        this.state.activeInlineQuestion.handleInput(data);
        return;
      }
      // Otherwise, handle normally
      originalHandleInput(data);
    };

    // Wire clipboard image paste
    this.state.editor.onImagePaste = image => {
      this.state.pendingImages.push(image);
      this.state.editor.insertTextAtCursor?.('[image] ');
      this.state.ui.requestRender();
    };

    this.setupKeyboardShortcuts();
  }

  /**
   * Setup keyboard shortcuts for the custom editor.
   */
  private setupKeyboardShortcuts(): void {
    // Ctrl+C / Escape - abort if running, clear input if idle, double-tap always exits
    this.state.editor.onAction('clear', () => {
      const now = Date.now();
      if (now - this.state.lastCtrlCTime < MastraTUI.DOUBLE_CTRL_C_MS) {
        // Double Ctrl+C → exit
        this.stop();
        process.exit(0);
      }
      this.state.lastCtrlCTime = now;

      if (this.state.pendingApprovalDismiss) {
        // Dismiss active approval dialog and abort
        this.state.pendingApprovalDismiss();
        this.state.activeInlinePlanApproval = undefined;
        this.state.activeInlineQuestion = undefined;
        this.state.userInitiatedAbort = true;
        this.state.harness.abort();
      } else if (this.state.harness.isRunning()) {
        // Clean up active inline components on abort
        this.state.activeInlinePlanApproval = undefined;
        this.state.activeInlineQuestion = undefined;
        this.state.userInitiatedAbort = true;
        this.state.harness.abort();
      } else {
        const current = this.state.editor.getText();
        if (current.length > 0) {
          this.state.lastClearedText = current;
        }
        this.state.editor.setText('');
        this.state.ui.requestRender();
      }
    });

    // Ctrl+Z - undo last clear (restore editor text)
    this.state.editor.onAction('undo', () => {
      if (this.state.lastClearedText && this.state.editor.getText().length === 0) {
        this.state.editor.setText(this.state.lastClearedText);
        this.state.lastClearedText = '';
        this.state.ui.requestRender();
      }
    });

    // Ctrl+D - exit when editor is empty
    this.state.editor.onCtrlD = () => {
      this.stop();
      process.exit(0);
    };

    // Ctrl+T - toggle thinking blocks visibility
    this.state.editor.onAction('toggleThinking', () => {
      this.state.hideThinkingBlock = !this.state.hideThinkingBlock;
      this.state.ui.requestRender();
    });
    // Ctrl+E - expand/collapse tool outputs
    this.state.editor.onAction('expandTools', () => {
      this.state.toolOutputExpanded = !this.state.toolOutputExpanded;
      for (const tool of this.state.allToolComponents) {
        tool.setExpanded(this.state.toolOutputExpanded);
      }
      for (const sc of this.state.allSlashCommandComponents) {
        sc.setExpanded(this.state.toolOutputExpanded);
      }
      this.state.ui.requestRender();
    });

    // Shift+Tab - cycle harness modes
    this.state.editor.onAction('cycleMode', async () => {
      // Block mode switching while plan approval is active
      if (this.state.activeInlinePlanApproval) {
        this.showInfo('Resolve the plan approval first');
        return;
      }

      const modes = this.state.harness.listModes();
      if (modes.length <= 1) return;
      const currentId = this.state.harness.getCurrentModeId();
      const currentIndex = modes.findIndex(m => m.id === currentId);
      const nextIndex = (currentIndex + 1) % modes.length;
      const nextMode = modes[nextIndex]!;
      await this.state.harness.switchMode({ modeId: nextMode.id });
      // The mode_changed event handler will show the info message
      updateStatusLine(this.state);
    });
    // Ctrl+Y - toggle YOLO mode
    this.state.editor.onAction('toggleYolo', () => {
      const current = (this.state.harness.getState() as any).yolo === true;
      this.state.harness.setState({ yolo: !current } as any);
      updateStatusLine(this.state);
      this.showInfo(current ? 'YOLO mode off' : 'YOLO mode on');
    });

    // Ctrl+F - queue follow-up message while streaming
    this.state.editor.onAction('followUp', () => {
      const text = this.state.editor.getText().trim();
      if (!text) return;
      if (!this.state.harness.isRunning()) return; // Only relevant while streaming

      // Clear editor
      this.state.editor.setText('');
      this.state.ui.requestRender();

      if (text.startsWith('/')) {
        // Queue slash command for processing after the agent completes
        this.state.pendingSlashCommands.push(text);
        this.showInfo(`Slash command queued: ${text}`);
      } else {
        // Queue as a regular follow-up message
        addUserMessage(this.state, {
          id: `user-${Date.now()}`,
          role: 'user',
          content: [{ type: 'text', text }],
          createdAt: new Date(),
        });
        this.state.ui.requestRender();

        this.state.harness.followUp({ content: text }).catch(error => {
          this.showError(error instanceof Error ? error.message : 'Follow-up failed');
        });
      }
    });
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Run the TUI. This is the main entry point.
   */
  async run(): Promise<void> {
    await this.init();

    // Run SessionStart hooks (fire and forget)
    const hookMgr = this.state.hookManager;
    if (hookMgr) {
      hookMgr.runSessionStart().catch(() => {});
    }

    // Process initial message if provided
    if (this.state.options.initialMessage) {
      this.fireMessage(this.state.options.initialMessage);
    }

    // Main interactive loop — never blocks on streaming,
    // so the editor stays responsive for steer / follow-up.
    while (true) {
      const userInput = await this.getUserInput();
      if (!userInput.trim()) continue;

      try {
        // Handle slash commands
        if (userInput.startsWith('/')) {
          const handled = await this.handleSlashCommand(userInput);
          if (handled) continue;
        }

        // Handle shell passthrough (! prefix)
        if (userInput.startsWith('!')) {
          await this.handleShellPassthrough(userInput.slice(1).trim());
          continue;
        }

        // Create thread lazily on first message (may load last-used model)
        if (this.state.pendingNewThread) {
          await this.state.harness.createThread();
          this.state.pendingNewThread = false;
          updateStatusLine(this.state);
        }

        // Check if a model is selected
        if (!this.state.harness.hasModelSelected()) {
          this.showInfo('No model selected. Use /models to select a model, or /login to authenticate.');
          continue;
        }

        // Collect any pending images from clipboard paste
        const images = this.state.pendingImages.length > 0 ? [...this.state.pendingImages] : undefined;
        this.state.pendingImages = [];

        // Add user message to chat immediately
        addUserMessage(this.state, {
          id: `user-${Date.now()}`,
          role: 'user',
          content: [
            { type: 'text', text: userInput },
            ...(images?.map(img => ({
              type: 'image' as const,
              data: img.data,
              mimeType: img.mimeType,
            })) ?? []),
          ],
          createdAt: new Date(),
        });
        this.state.ui.requestRender();

        if (this.state.harness.isRunning()) {
          // Agent is streaming → steer (abort + resend)
          // Clear follow-up tracking since steer replaces the current response
          this.state.followUpComponents = [];
          this.state.pendingSlashCommands = [];
          this.state.harness.steer({ content: userInput }).catch(error => {
            this.showError(error instanceof Error ? error.message : 'Steer failed');
          });
        } else {
          // Normal send — fire and forget; events handle the rest
          this.fireMessage(userInput, images);
        }
      } catch (error) {
        this.showError(error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Fire off a message without blocking the main loop.
   * Errors are handled via harness events.
   */
  private fireMessage(content: string, images?: Array<{ data: string; mimeType: string }>): void {
    this.state.harness.sendMessage({ content, images: images ? images : undefined }).catch(error => {
      this.showError(error instanceof Error ? error.message : 'Unknown error');
    });
  }

  /**
   * Stop the TUI and clean up.
   */
  stop(): void {
    // Run SessionEnd hooks (best-effort, don't await)
    const hookMgr = this.state.hookManager;
    if (hookMgr) {
      hookMgr.runSessionEnd().catch(() => {});
    }

    if (this.state.unsubscribe) {
      this.state.unsubscribe();
    }
    this.state.ui.stop();
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  private async init(): Promise<void> {
    if (this.state.isInitialized) return;

    // Initialize harness (but don't select thread yet)
    await this.state.harness.init();

    // Check for existing threads and prompt for resume
    await this.promptForThreadSelection();

    // Load initial token usage from harness (persisted from previous session)
    this.state.tokenUsage = this.state.harness.getTokenUsage();

    // Load custom slash commands
    await this.loadCustomSlashCommands();

    // Setup autocomplete
    this.setupAutocomplete();

    // Build UI layout
    this.buildLayout();

    // Setup key handlers
    this.setupKeyHandlers();

    // Setup editor submit handler
    this.setupEditorSubmitHandler();

    // Subscribe to harness events
    this.subscribeToHarness();
    // Restore escape-as-cancel setting from persisted state
    const escState = this.state.harness.getState() as any;
    if (escState?.escapeAsCancel === false) {
      this.state.editor.escapeEnabled = false;
    }

    // Load OM progress now that we're subscribed (the event during
    // thread selection fired before we were listening)
    await this.state.harness.loadOMProgress();

    // Sync OM thresholds from thread metadata (may differ from OM defaults)
    this.syncOMThresholdsFromHarness();

    // Start the UI
    this.state.ui.start();
    this.state.isInitialized = true;

    // Set terminal title
    this.updateTerminalTitle();
    // Render existing messages
    await renderExistingMessages(this.state);
    // Render existing tasks if any
    await this.renderExistingTasks();

    // Show deferred thread lock prompt (must happen after TUI is started)
    if (this.state.pendingLockConflict) {
      this.showThreadLockPrompt(this.state.pendingLockConflict.threadTitle, this.state.pendingLockConflict.ownerPid);
      this.state.pendingLockConflict = null;
    }
  }

  /**
   * Render existing tasks from the harness state on startup
   */
  private async renderExistingTasks(): Promise<void> {
    try {
      // Access the harness state using the public method
      const state = this.state.harness.getState() as { tasks?: TaskItem[] };
      const tasks = state.tasks || [];

      if (tasks.length > 0 && this.state.taskProgress) {
        // Update the existing task progress component
        this.state.taskProgress.updateTasks(tasks);
        this.state.ui.requestRender();
      }
    } catch {
      // Silently ignore task rendering errors
    }
  }
  /**
   * Prompt user to continue existing thread or start new one.
   * This runs before the TUI is fully initialized.
   * Threads are scoped to the current resourceId by listThreads(),
   * then further filtered by projectPath to avoid resuming threads
   * from other worktrees of the same repo.
   */
  private async promptForThreadSelection(): Promise<void> {
    const allThreads = await this.state.harness.listThreads();

    // Filter to threads matching the current working directory.
    // This prevents worktrees (which share the same resourceId) from
    // resuming each other's threads.
    const currentPath = this.state.projectInfo.rootPath;
    // TEMPORARY: Threads created before auto-tagging don't have projectPath
    // metadata. To avoid resuming another worktree's untagged threads, we
    // compare against the directory's birthtime — if the thread predates the
    // directory it can't belong here. Once all legacy threads have been
    // retroactively tagged (see below), this check can be removed.
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
      this.state.pendingNewThread = true;
      return;
    }

    // Sort by most recent
    const sortedThreads = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const mostRecent = sortedThreads[0]!;
    // Auto-resume the most recent thread for this directory
    try {
      await this.state.harness.switchThread({ threadId: mostRecent.id });
      // Retroactively tag untagged legacy threads so the birthtime check
      // above can eventually be removed.
      if (!mostRecent.metadata?.projectPath) {
        await this.state.harness.setThreadSetting({ key: 'projectPath', value: currentPath });
      }
    } catch (error) {
      if (error instanceof ThreadLockError) {
        // Defer the lock conflict prompt until after the TUI is started
        this.state.pendingNewThread = true;
        this.state.pendingLockConflict = {
          threadTitle: mostRecent.title || mostRecent.id,
          ownerPid: error.ownerPid,
        };
        return;
      }
      throw error;
    }
  }
  /**
   * Extract text content from a harness message.
   */
  private extractTextContent(message: HarnessMessage): string {
    return message.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join(' ')
      .trim();
  }

  /**
   * Truncate text for preview display.
   */
  private truncatePreview(text: string, maxLength = 50): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  private buildLayout(): void {
    // Add header
    const appName = this.state.options.appName || 'Mastra Code';
    const version = this.state.options.version || '0.1.0';

    const logo = fg('accent', '◆') + ' ' + bold(fg('accent', appName)) + fg('dim', ` v${version}`);

    const keyStyle = (k: string) => fg('accent', k);
    const sep = fg('dim', ' · ');
    const instructions = [
      `  ${keyStyle('Ctrl+C')} ${fg('muted', 'interrupt/clear')}${sep}${keyStyle('Ctrl+C×2')} ${fg('muted', 'exit')}`,
      `  ${keyStyle('Enter')} ${fg('muted', 'while working → steer')}${sep}${keyStyle('Ctrl+F')} ${fg('muted', '→ queue follow-up')}`,
      `  ${keyStyle('/')} ${fg('muted', 'commands')}${sep}${keyStyle('!')} ${fg('muted', 'shell')}${sep}${keyStyle('Ctrl+T')} ${fg('muted', 'thinking')}${sep}${keyStyle('Ctrl+E')} ${fg('muted', 'tools')}${this.state.harness.listModes().length > 1 ? `${sep}${keyStyle('⇧Tab')} ${fg('muted', 'mode')}` : ''}`,
    ].join('\n');

    this.state.ui.addChild(new Spacer(1));
    this.state.ui.addChild(
      new Text(
        `${logo}
${instructions}`,
        1,
        0,
      ),
    );
    this.state.ui.addChild(new Spacer(1));

    // Add main containers
    this.state.ui.addChild(this.state.chatContainer);
    // Task progress (between chat and editor, visible only when tasks exist)
    this.state.taskProgress = new TaskProgressComponent();
    this.state.ui.addChild(this.state.taskProgress);
    this.state.ui.addChild(this.state.editorContainer);
    this.state.editorContainer.addChild(this.state.editor);

    // Add footer with two-line status
    this.state.statusLine = new Text('', 0, 0);
    this.state.memoryStatusLine = new Text('', 0, 0);
    this.state.footer.addChild(this.state.statusLine);
    this.state.footer.addChild(this.state.memoryStatusLine);
    this.state.ui.addChild(this.state.footer);
    updateStatusLine(this.state);
    this.refreshModelAuthStatus();

    // Set focus to editor
    this.state.ui.setFocus(this.state.editor);
  }

  private async refreshModelAuthStatus(): Promise<void> {
    this.state.modelAuthStatus = await this.state.harness.getCurrentModelAuthStatus();
    updateStatusLine(this.state);
  }

  private setupAutocomplete(): void {
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
    const modes = this.state.harness.listModes();
    if (modes.length > 1) {
      slashCommands.push({ name: 'mode', description: 'Switch agent mode' });
    }

    // Add custom slash commands to the list
    for (const customCmd of this.state.customSlashCommands) {
      // Prefix with extra / to distinguish from built-in commands (//command-name)
      slashCommands.push({
        name: `/${customCmd.name}`,
        description: customCmd.description || `Custom: ${customCmd.name}`,
      });
    }

    this.state.autocompleteProvider = new CombinedAutocompleteProvider(slashCommands, process.cwd());
    this.state.editor.setAutocompleteProvider(this.state.autocompleteProvider);
  }
  /**
   * Load custom slash commands from all sources:
   * - Global: ~/.opencode/command, ~/.claude/commands, and ~/.mastracode/commands
   * - Local: .opencode/command, .claude/commands, and .mastracode/commands
   */
  private async loadCustomSlashCommands(): Promise<void> {
    try {
      // Load from all sources (global and local)
      const globalCommands = await loadCustomCommands();
      const localCommands = await loadCustomCommands(process.cwd());

      // Merge commands, with local taking precedence over global for same names
      const commandMap = new Map<string, SlashCommandMetadata>();

      // Add global commands first
      for (const cmd of globalCommands) {
        commandMap.set(cmd.name, cmd);
      }

      // Add local commands (will override global if same name)
      for (const cmd of localCommands) {
        commandMap.set(cmd.name, cmd);
      }

      this.state.customSlashCommands = Array.from(commandMap.values());
    } catch {
      this.state.customSlashCommands = [];
    }
  }

  private setupKeyHandlers(): void {
    // Handle Ctrl+C via process signal (backup for when editor doesn't capture it)
    process.on('SIGINT', () => {
      const now = Date.now();
      if (now - this.state.lastCtrlCTime < MastraTUI.DOUBLE_CTRL_C_MS) {
        this.stop();
        process.exit(0);
      }
      this.state.lastCtrlCTime = now;
      if (this.state.pendingApprovalDismiss) {
        this.state.pendingApprovalDismiss();
      }
      this.state.userInitiatedAbort = true;
      this.state.harness.abort();
    });

    // Use onDebug callback for Shift+Ctrl+D
    this.state.ui.onDebug = () => {
      // Toggle debug mode or show debug info
      // Currently unused - could add debug panel in future
    };
  }

  private setupEditorSubmitHandler(): void {
    // The editor's onSubmit is handled via getUserInput promise
  }

  private subscribeToHarness(): void {
    const listener: HarnessEventListener = async event => {
      await this.handleEvent(event);
    };
    this.state.unsubscribe = this.state.harness.subscribe(listener);
  }

  private updateTerminalTitle(): void {
    const appName = this.state.options.appName || 'Mastra Code';
    const cwd = process.cwd().split('/').pop() || '';
    this.state.ui.terminal.setTitle(`${appName} - ${cwd}`);
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  private async handleEvent(event: HarnessEvent): Promise<void> {
    const ectx = this.buildEventContext();
    switch (event.type) {
      case 'agent_start':
        handleAgentStart(ectx);
        break;

      case 'agent_end':
        if (event.reason === 'aborted') {
          handleAgentAborted(ectx);
        } else if (event.reason === 'error') {
          handleAgentError(ectx);
        } else {
          handleAgentEnd(ectx);
        }
        break;

      case 'message_start':
        handleMessageStart(ectx, event.message);
        break;

      case 'message_update':
        handleMessageUpdate(ectx, event.message);
        break;

      case 'message_end':
        handleMessageEnd(ectx, event.message);
        break;

      case 'tool_start':
        handleToolStart(ectx, event.toolCallId, event.toolName, event.args);
        break;

      case 'tool_approval_required':
        handleToolApprovalRequired(ectx, event.toolCallId, event.toolName, event.args);
        break;

      case 'tool_update':
        handleToolUpdate(ectx, event.toolCallId, event.partialResult);
        break;

      case 'shell_output':
        handleShellOutput(ectx, event.toolCallId, event.output, event.stream);
        break;

      case 'tool_input_start':
        handleToolInputStart(ectx, event.toolCallId, event.toolName);
        break;

      case 'tool_input_delta':
        handleToolInputDelta(ectx, event.toolCallId, event.argsTextDelta);
        break;

      case 'tool_input_end':
        handleToolInputEnd(ectx, event.toolCallId);
        break;

      case 'tool_end':
        handleToolEnd(ectx, event.toolCallId, event.result, event.isError);
        break;
      case 'info':
        ectx.showInfo(event.message);
        break;

      case 'error':
        ectx.showFormattedError(event);
        break;

      case 'mode_changed': {
        // Mode is already visible in status line, no need to log it
        await ectx.refreshModelAuthStatus();
        break;
      }

      case 'model_changed':
        // Update status line to reflect new model and auth status
        await ectx.refreshModelAuthStatus();
        break;

      case 'thread_changed': {
        ectx.showInfo(`Switched to thread: ${event.threadId}`);
        ectx.resetStatusLineState();
        await ectx.renderExistingMessages();
        await this.state.harness.loadOMProgress();
        ectx.syncOMThresholdsFromHarness();
        this.state.tokenUsage = this.state.harness.getTokenUsage();
        ectx.updateStatusLine();
        // Restore tasks from thread state
        const threadState = this.state.harness.getState() as {
          tasks?: TaskItem[];
        };
        if (this.state.taskProgress) {
          this.state.taskProgress.updateTasks(threadState.tasks ?? []);
          this.state.ui.requestRender();
        }
        break;
      }
      case 'thread_created': {
        ectx.showInfo(`Created thread: ${event.thread.id}`);
        // Sync inherited resource-level settings
        const tState = this.state.harness.getState() as any;
        if (typeof tState?.escapeAsCancel === 'boolean') {
          this.state.editor.escapeEnabled = tState.escapeAsCancel;
        }
        // Clear stale tasks from the previous thread
        if (this.state.taskProgress) {
          this.state.taskProgress.updateTasks([]);
        }
        this.state.previousTasks = [];
        this.state.taskWriteInsertIndex = -1;
        ectx.updateStatusLine();
        break;
      }

      case 'usage_update':
        handleUsageUpdate(ectx, event.usage);
        break;

      // Observational Memory events
      case 'om_status':
        handleOMStatus(ectx, event);
        break;

      case 'om_observation_start':
        handleOMObservationStart(ectx, event.cycleId, event.tokensToObserve);
        break;

      case 'om_observation_end':
        handleOMObservationEnd(
          ectx,
          event.cycleId,
          event.durationMs,
          event.tokensObserved,
          event.observationTokens,
          event.observations,
          event.currentTask,
          event.suggestedResponse,
        );
        break;

      case 'om_observation_failed':
        handleOMFailed(ectx, event.cycleId, event.error, 'observation');
        break;

      case 'om_reflection_start':
        handleOMReflectionStart(ectx, event.cycleId, event.tokensToReflect);
        break;

      case 'om_reflection_end':
        handleOMReflectionEnd(ectx, event.cycleId, event.durationMs, event.compressedTokens, event.observations);
        break;

      case 'om_reflection_failed':
        handleOMFailed(ectx, event.cycleId, event.error, 'reflection');
        break;

      case 'om_buffering_start':
        handleOMBufferingStart(ectx, event.operationType, event.tokensToBuffer);
        break;

      case 'om_buffering_end':
        handleOMBufferingEnd(ectx, event.operationType, event.tokensBuffered, event.bufferedTokens, event.observations);
        break;

      case 'om_buffering_failed':
        handleOMBufferingFailed(ectx, event.operationType, event.error);
        break;

      case 'om_activation':
        handleOMActivation(ectx, event.operationType, event.tokensActivated, event.observationTokens);
        break;

      case 'follow_up_queued': {
        const totalPending = (event.count as number) + this.state.pendingSlashCommands.length;
        ectx.showInfo(`Follow-up queued (${totalPending} pending)`);
        break;
      }

      case 'workspace_ready':
        // Workspace initialized successfully - silent unless verbose
        break;

      case 'workspace_error':
        ectx.showError(`Workspace: ${event.error.message}`);
        break;

      case 'workspace_status_changed':
        if (event.status === 'error' && event.error) {
          ectx.showError(`Workspace: ${event.error.message}`);
        }
        break;

      // Subagent / Task delegation events
      case 'subagent_start':
        handleSubagentStart(ectx, event.toolCallId, event.agentType, event.task, event.modelId);
        break;

      case 'subagent_tool_start':
        handleSubagentToolStart(ectx, event.toolCallId, event.subToolName, event.subToolArgs);
        break;

      case 'subagent_tool_end':
        handleSubagentToolEnd(ectx, event.toolCallId, event.subToolName, event.subToolResult, event.isError);
        break;

      case 'subagent_text_delta':
        // Text deltas are streamed but we don't render them incrementally
        // (the final result is shown via tool_end for the parent tool call)
        break;

      case 'subagent_end':
        handleSubagentEnd(ectx, event.toolCallId, event.isError, event.durationMs, event.result);
        break;

      case 'task_updated': {
        const tasks = event.tasks as TaskItem[];
        if (this.state.taskProgress) {
          this.state.taskProgress.updateTasks(tasks ?? []);

          // Find the most recent task_write tool component and get its position
          let insertIndex = -1;
          for (let i = this.state.allToolComponents.length - 1; i >= 0; i--) {
            const comp = this.state.allToolComponents[i];
            if ((comp as any).toolName === 'task_write') {
              insertIndex = this.state.chatContainer.children.indexOf(comp as any);
              this.state.chatContainer.removeChild(comp as any);
              this.state.allToolComponents.splice(i, 1);
              break;
            }
          }
          // Fall back to the position recorded during streaming (when no inline component was created)
          if (insertIndex === -1 && this.state.taskWriteInsertIndex >= 0) {
            insertIndex = this.state.taskWriteInsertIndex;
            this.state.taskWriteInsertIndex = -1;
          }

          // Check if all tasks are completed
          const allCompleted = tasks && tasks.length > 0 && tasks.every(t => t.status === 'completed');
          if (allCompleted) {
            // Show collapsed completed list (pinned/live)
            ectx.renderCompletedTasksInline(tasks, insertIndex, true);
          } else if (this.state.previousTasks.length > 0 && (!tasks || tasks.length === 0)) {
            // Tasks were cleared
            ectx.renderClearedTasksInline(this.state.previousTasks, insertIndex);
          }

          // Track for next diff
          this.state.previousTasks = tasks ? [...tasks] : [];

          this.state.ui.requestRender();
        }
        break;
      }

      case 'ask_question':
        await handleAskQuestion(ectx, event.questionId, event.question, event.options);
        break;

      case 'sandbox_access_request':
        await handleSandboxAccessRequest(ectx, event.questionId, event.path, event.reason);
        break;

      case 'plan_approval_required':
        await handlePlanApproval(ectx, event.planId, event.title, event.plan);
        break;

      case 'plan_approved':
        // Handled directly in onApprove callback to ensure proper sequencing
        break;
    }
  }

  // ===========================================================================
  // Status Line Reset
  // ===========================================================================

  /**
   * Sync omProgress thresholds from harness state (thread metadata).
   * Called after thread load to pick up per-thread threshold overrides.
   */
  private syncOMThresholdsFromHarness(): void {
    const obsThreshold = this.state.harness.getObservationThreshold();
    const refThreshold = this.state.harness.getReflectionThreshold();
    this.state.omProgress.threshold = obsThreshold;
    this.state.omProgress.thresholdPercent =
      obsThreshold > 0 ? (this.state.omProgress.pendingTokens / obsThreshold) * 100 : 0;
    this.state.omProgress.reflectionThreshold = refThreshold;
    this.state.omProgress.reflectionThresholdPercent =
      refThreshold > 0 ? (this.state.omProgress.observationTokens / refThreshold) * 100 : 0;
    updateStatusLine(this.state);
  }
  private resetStatusLineState(): void {
    const prev = this.state.omProgress;
    this.state.omProgress = {
      ...defaultOMProgressState(),
      // Preserve thresholds across resets
      threshold: prev.threshold,
      reflectionThreshold: prev.reflectionThreshold,
    };
    this.state.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    this.state.bufferingMessages = false;
    this.state.bufferingObservations = false;
    updateStatusLine(this.state);
  }

  /**
   * Insert a child into the chat container before any follow-up user messages.
   * If no follow-ups are pending, appends to end.
   */
  private addChildBeforeFollowUps(child: Component): void {
    if (this.state.followUpComponents.length > 0) {
      const firstFollowUp = this.state.followUpComponents[0];
      const idx = this.state.chatContainer.children.indexOf(firstFollowUp as any);
      if (idx >= 0) {
        (this.state.chatContainer.children as unknown[]).splice(idx, 0, child);
        this.state.chatContainer.invalidate();
        return;
      }
    }
    this.state.chatContainer.addChild(child);
  }

  // ===========================================================================
  // User Input
  // ===========================================================================

  private getUserInput(): Promise<string> {
    return new Promise(resolve => {
      this.state.editor.onSubmit = (text: string) => {
        // Add to history for arrow up/down navigation (skip empty)
        if (text.trim()) {
          this.state.editor.addToHistory(text);
        }
        this.state.editor.setText('');
        resolve(text);
      };
    });
  }

  /**
   * Show an inline prompt when a thread is locked by another process.
   * User can create a new thread (y) or exit (n).
   */
  private showThreadLockPrompt(threadTitle: string, ownerPid: number): void {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: `Thread "${threadTitle}" is locked by pid ${ownerPid}. Create a new thread?`,
        options: [
          { label: 'Yes', description: 'Start a new thread' },
          { label: 'No', description: 'Exit' },
        ],
        formatResult: answer => (answer === 'Yes' ? 'Thread created' : 'Exiting.'),
        onSubmit: async answer => {
          this.state.activeInlineQuestion = undefined;
          if (answer.toLowerCase().startsWith('y')) {
            // pendingNewThread is already true — thread will be
            // created lazily on first message
          } else {
            process.exit(0);
          }
        },
        onCancel: () => {
          this.state.activeInlineQuestion = undefined;
          process.exit(0);
        },
      },
      this.state.ui,
    );

    this.state.activeInlineQuestion = questionComponent;
    this.state.chatContainer.addChild(questionComponent);
    this.state.chatContainer.addChild(new Spacer(1));
    this.state.ui.requestRender();
    this.state.chatContainer.invalidate();
  }

  /**
   * Get the workspace, preferring harness-owned workspace over the direct option.
   */
  private getResolvedWorkspace(): Workspace | undefined {
    return this.state.harness.getWorkspace() ?? this.state.workspace;
  }

  // ===========================================================================
  // Observational Memory Settings
  // ===========================================================================

  // ===========================================================================
  // Login Selector
  // ===========================================================================

  // ===========================================================================
  // Slash Commands
  // ===========================================================================

  private buildCommandContext(): SlashCommandContext {
    return {
      state: this.state,
      harness: this.state.harness,
      hookManager: this.state.hookManager,
      mcpManager: this.state.mcpManager,
      authStorage: this.state.authStorage,
      customSlashCommands: this.state.customSlashCommands,
      showInfo: msg => this.showInfo(msg),
      showError: msg => this.showError(msg),
      updateStatusLine: () => updateStatusLine(this.state),
      resetStatusLineState: () => this.resetStatusLineState(),
      stop: () => this.stop(),
      getResolvedWorkspace: () => this.getResolvedWorkspace(),
      addUserMessage: msg => addUserMessage(this.state, msg),
      renderExistingMessages: () => renderExistingMessages(this.state),
    };
  }

  private buildEventContext(): EventHandlerContext {
    return {
      state: this.state,
      showInfo: msg => this.showInfo(msg),
      showError: msg => this.showError(msg),
      showFormattedError: event => this.showFormattedError(event),
      updateStatusLine: () => updateStatusLine(this.state),
      resetStatusLineState: () => this.resetStatusLineState(),
      notify: (reason, message) => this.notify(reason, message),
      handleSlashCommand: input => this.handleSlashCommand(input),
      addUserMessage: msg => addUserMessage(this.state, msg),
      addChildBeforeFollowUps: child => this.addChildBeforeFollowUps(child),
      fireMessage: (content, images) => this.fireMessage(content, images),
      renderExistingMessages: () => renderExistingMessages(this.state),
      syncOMThresholdsFromHarness: () => this.syncOMThresholdsFromHarness(),
      renderCompletedTasksInline: (tasks, insertIndex, collapsed) =>
        renderCompletedTasksInline(this.state, tasks, insertIndex, collapsed),
      renderClearedTasksInline: (clearedTasks, insertIndex) =>
        renderClearedTasksInline(this.state, clearedTasks, insertIndex),
      refreshModelAuthStatus: () => this.refreshModelAuthStatus(),
    };
  }

  private async handleSlashCommand(input: string): Promise<boolean> {
    const trimmedInput = input.trim();

    // Strip leading slashes — pi-tui may pass /command or command depending
    // on how the user invoked it.  Try custom commands first, then built-in.
    const withoutSlashes = trimmedInput.replace(/^\/+/, '');
    if (trimmedInput.startsWith('/')) {
      const [cmdName, ...cmdArgs] = withoutSlashes.split(' ');
      const customCommand = this.state.customSlashCommands.find(cmd => cmd.name === cmdName);
      if (customCommand) {
        await this.handleCustomSlashCommand(customCommand, cmdArgs);
        return true;
      }
      // Not a custom command — fall through to built-in routing
    }

    const [command, ...args] = withoutSlashes.split(' ');

    // Build command context lazily for extracted handlers
    const ctx = () => this.buildCommandContext();

    switch (command) {
      case 'new':
        handleNewCommand(ctx());
        return true;
      case 'threads':
        await handleThreadsCommand(ctx());
        return true;
      case 'skills':
        await handleSkillsCommand(ctx());
        return true;
      case 'thread:tag-dir':
        await handleThreadTagDirCommand(ctx());
        return true;
      case 'sandbox':
        await handleSandboxCmd(ctx(), args);
        return true;
      case 'mode':
        await handleModeCommand(ctx(), args);
        return true;
      case 'models':
        await handleModelsCommand(ctx());
        return true;
      case 'subagents':
        await handleSubagentsCommand(ctx());
        return true;
      case 'om':
        await handleOMCommand(ctx());
        return true;
      case 'think':
        await handleThinkCommand(ctx());
        return true;
      case 'permissions':
        await handlePermissionsCommand(ctx(), args);
        return true;
      case 'yolo':
        handleYoloCommand(ctx());
        return true;
      case 'settings':
        await handleSettingsCommand(ctx());
        return true;
      case 'login':
        await handleLoginCommand(ctx(), 'login');
        return true;
      case 'logout':
        await handleLoginCommand(ctx(), 'logout');
        return true;
      case 'cost':
        handleCostCommand(ctx());
        return true;
      case 'diff':
        await handleDiffCommand(ctx(), args[0]);
        return true;
      case 'name':
        await handleNameCommand(ctx(), args);
        return true;
      case 'resource':
        await handleResourceCommand(ctx(), args);
        return true;
      case 'exit':
        handleExitCommand(ctx());
        return true;
      case 'help':
        handleHelpCommand(ctx());
        return true;
      case 'hooks':
        handleHooksCommand(ctx(), args);
        return true;
      case 'mcp':
        await handleMcpCommand(ctx(), args);
        return true;
      case 'review':
        await handleReviewCmd(ctx(), args);
        return true;
      default: {
        const customCommand = this.state.customSlashCommands.find(cmd => cmd.name === command);
        if (customCommand) {
          await this.handleCustomSlashCommand(customCommand, args);
          return true;
        }
        this.showError(`Unknown command: ${command}`);
        return true;
      }
    }
  }

  /**
   * Handle a custom slash command by processing its template and adding to context
   */
  private async handleCustomSlashCommand(command: SlashCommandMetadata, args: string[]): Promise<void> {
    try {
      // Process the command template
      const processedContent = await processSlashCommand(command, args, process.cwd());
      // Add the processed content as a system message / context
      if (processedContent.trim()) {
        // Show bordered indicator immediately with content
        const slashComp = new SlashCommandComponent(command.name, processedContent.trim());
        this.state.allSlashCommandComponents.push(slashComp);
        this.state.chatContainer.addChild(slashComp);
        this.state.ui.requestRender();

        // Wrap in <slash-command> tags so the assistant sees the full
        // content but addUserMessage won't double-render it.
        const wrapped = `<slash-command name="${command.name}">\n${processedContent.trim()}\n</slash-command>`;
        await this.state.harness.sendMessage({ content: wrapped });
      } else {
        this.showInfo(`Executed //${command.name} (no output)`);
      }
    } catch (error) {
      this.showError(`Error executing //${command.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ===========================================================================
  // UI Helpers
  // ===========================================================================

  private showError(message: string): void {
    this.state.chatContainer.addChild(new Spacer(1));
    this.state.chatContainer.addChild(new Text(fg('error', `Error: ${message}`), 1, 0));
    this.state.ui.requestRender();
  }

  /**
   * Show a formatted error with helpful context based on error type.
   */
  showFormattedError(
    event:
      | {
          error: Error;
          errorType?: string;
          retryable?: boolean;
          retryDelay?: number;
        }
      | Error,
  ): void {
    const error = 'error' in event ? event.error : event;
    const parsed = parseError(error);

    this.state.chatContainer.addChild(new Spacer(1));

    // Check if this is a tool validation error
    const errorMessage = error.message || String(error);
    const isValidationError =
      errorMessage.toLowerCase().includes('validation failed') ||
      errorMessage.toLowerCase().includes('required parameter') ||
      errorMessage.includes('Required');

    if (isValidationError) {
      // Show a simplified message for validation errors
      this.state.chatContainer.addChild(new Text(fg('error', 'Tool validation error - see details above'), 1, 0));
      this.state.chatContainer.addChild(
        new Text(fg('muted', '  Check the tool execution box for specific parameter requirements'), 1, 0),
      );
    } else {
      // Show the main error message
      let errorText = `Error: ${parsed.message}`;

      // Add retry info if applicable
      const retryable = 'retryable' in event ? event.retryable : parsed.retryable;
      const retryDelay = 'retryDelay' in event ? event.retryDelay : parsed.retryDelay;
      if (retryable && retryDelay) {
        const seconds = Math.ceil(retryDelay / 1000);
        errorText += fg('muted', ` (retry in ${seconds}s)`);
      }

      this.state.chatContainer.addChild(new Text(fg('error', errorText), 1, 0));

      // Add helpful hints based on error type
      const hint = this.getErrorHint(parsed.type);
      if (hint) {
        this.state.chatContainer.addChild(new Text(fg('muted', `  Hint: ${hint}`), 1, 0));
      }
    }

    this.state.ui.requestRender();
  }

  /**
   * Get a helpful hint based on error type.
   */
  private getErrorHint(errorType: string): string | null {
    switch (errorType) {
      case 'auth':
        return 'Use /login to authenticate with a provider';
      case 'model_not_found':
        return 'Use /models to select a different model';
      case 'context_length':
        return 'Use /new to start a fresh conversation';
      case 'rate_limit':
        return 'Wait a moment and try again';
      case 'network':
        return 'Check your internet connection';
      default:
        return null;
    }
  }
  /**
   * Run a shell command directly and display the output in the chat.
   * Triggered by the `!` prefix (e.g., `!ls -la`).
   */
  private async handleShellPassthrough(command: string): Promise<void> {
    if (!command) {
      this.showInfo('Usage: !<command> (e.g., !ls -la)');
      return;
    }

    try {
      const { execa } = await import('execa');
      const result = await execa(command, {
        shell: true,
        cwd: process.cwd(),
        reject: false,
        timeout: 30_000,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
        },
      });

      const component = new ShellOutputComponent(
        command,
        result.stdout ?? '',
        result.stderr ?? '',
        result.exitCode ?? 0,
      );
      this.state.chatContainer.addChild(component);
      this.state.ui.requestRender();
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Shell command failed');
    }
  }
  /**
   * Send a notification alert (bell / system / hooks) based on user settings.
   */
  private notify(reason: NotificationReason, message?: string): void {
    const mode = ((this.state.harness.getState() as any)?.notifications ?? 'off') as NotificationMode;
    sendNotification(reason, {
      mode,
      message,
      hookManager: this.state.hookManager,
    });
  }

  private showInfo(message: string): void {
    this.state.chatContainer.addChild(new Spacer(1));
    this.state.chatContainer.addChild(new Text(fg('muted', message), 1, 0));
    this.state.ui.requestRender();
  }
}
