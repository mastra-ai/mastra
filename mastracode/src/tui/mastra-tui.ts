/**
 * Main TUI class for Mastra Code.
 * Wires the Harness to pi-tui components for a full interactive experience.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CombinedAutocompleteProvider, Container, Spacer, Text, visibleWidth } from '@mariozechner/pi-tui';
import type { Component, SlashCommand } from '@mariozechner/pi-tui';
import type {
  HarnessEvent,
  HarnessMessage,
  HarnessMessageContent,
  HarnessEventListener,
  TokenUsage,
  TaskItem,
} from '@mastra/core/harness';
import type { Workspace } from '@mastra/core/workspace';
import chalk from 'chalk';
import { parse as parsePartialJson } from 'partial-json';
import { getOAuthProviders } from '../auth/storage.js';
import { getToolCategory, TOOL_CATEGORIES } from '../permissions.js';
import { parseSubagentMeta } from '../tools/subagent.js';
import { parseError } from '../utils/errors.js';
import { loadCustomCommands } from '../utils/slash-command-loader.js';
import type { SlashCommandMetadata } from '../utils/slash-command-loader.js';
import { processSlashCommand } from '../utils/slash-command-processor.js';
import { ThreadLockError } from '../utils/thread-lock.js';
import { AskQuestionDialogComponent } from './components/ask-question-dialog.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { AssistantMessageComponent } from './components/assistant-message.js';
import { DiffOutputComponent } from './components/diff-output.js';
import { LoginDialogComponent } from './components/login-dialog.js';
import { ModelSelectorComponent } from './components/model-selector.js';
import type { ModelItem } from './components/model-selector.js';
import { GradientAnimator, applyGradientSweep } from './components/obi-loader.js';

import { OMMarkerComponent } from './components/om-marker.js';
import type { OMMarkerData } from './components/om-marker.js';
import { OMOutputComponent } from './components/om-output.js';
import { defaultOMProgressState, formatObservationStatus, formatReflectionStatus } from './components/om-progress.js';
import { OMSettingsComponent } from './components/om-settings.js';
import { PlanApprovalInlineComponent, PlanResultComponent } from './components/plan-approval-inline.js';
import { SettingsComponent } from './components/settings.js';
import { ShellOutputComponent } from './components/shell-output.js';
import { SlashCommandComponent } from './components/slash-command.js';
import { SubagentExecutionComponent } from './components/subagent-execution.js';
import { SystemReminderComponent } from './components/system-reminder.js';
import { TaskProgressComponent } from './components/task-progress.js';
import { ThreadSelectorComponent } from './components/thread-selector.js';

import { ToolApprovalDialogComponent } from './components/tool-approval-dialog.js';
import type { ApprovalAction } from './components/tool-approval-dialog.js';
import { ToolExecutionComponentEnhanced } from './components/tool-execution-enhanced.js';
import type { ToolResult } from './components/tool-execution-enhanced.js';
import { UserMessageComponent } from './components/user-message.js';
import { sendNotification } from './notify.js';
import type { NotificationMode, NotificationReason } from './notify.js';
import type { MastraTUIOptions, TUIState } from './state.js';
import { createTUIState } from './state.js';
import { getMarkdownTheme, fg, bold, theme, mastra, tintHex } from './theme.js';

// =============================================================================
// Constants
// =============================================================================

/** Tools that modify files, used for /diff tracking */
const FILE_TOOLS = ['string_replace_lsp', 'write_file', 'ast_smart_edit'];

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
      this.updateStatusLine();
    });
    // Ctrl+Y - toggle YOLO mode
    this.state.editor.onAction('toggleYolo', () => {
      const current = (this.state.harness.getState() as any).yolo === true;
      this.state.harness.setState({ yolo: !current } as any);
      this.updateStatusLine();
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
        this.addUserMessage({
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
          this.updateStatusLine();
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
        this.addUserMessage({
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
    await this.renderExistingMessages();
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
    this.updateStatusLine();
    this.refreshModelAuthStatus();

    // Set focus to editor
    this.state.ui.setFocus(this.state.editor);
  }

  /**
   * Update the two-line status bar.
   * Line 1: [MODE] provider/model  memory  tokens  think:level
   * Line 2:        ~/path/to/project (branch)
   */
  private updateStatusLine(): void {
    if (!this.state.statusLine) return;
    const termWidth = (process.stdout.columns || 80) - 1; // buffer to prevent jitter
    const SEP = '  '; // double-space separator between parts

    // --- Determine if we're showing observer/reflector instead of main mode ---
    const omStatus = this.state.omProgress.status;
    const isObserving = omStatus === 'observing';
    const isReflecting = omStatus === 'reflecting';
    const showOMMode = isObserving || isReflecting;

    // Colors for OM modes
    const OBSERVER_COLOR = mastra.orange; // Mastra orange
    const REFLECTOR_COLOR = mastra.pink; // Mastra pink

    // --- Mode badge ---
    let modeBadge = '';
    let modeBadgeWidth = 0;
    const modes = this.state.harness.listModes();
    const currentMode = modes.length > 1 ? this.state.harness.getCurrentMode() : undefined;
    // Use OM color when observing/reflecting, otherwise mode color
    const mainModeColor = currentMode?.color;
    const modeColor = showOMMode ? (isObserving ? OBSERVER_COLOR : REFLECTOR_COLOR) : mainModeColor;
    // Badge name: use OM mode name when observing/reflecting, otherwise main mode name
    const badgeName = showOMMode
      ? isObserving
        ? 'observe'
        : 'reflect'
      : currentMode
        ? currentMode.name || currentMode.id || 'unknown'
        : undefined;
    if (badgeName && modeColor) {
      const [mcr, mcg, mcb] = [
        parseInt(modeColor.slice(1, 3), 16),
        parseInt(modeColor.slice(3, 5), 16),
        parseInt(modeColor.slice(5, 7), 16),
      ];
      // Pulse the badge bg brightness opposite to the gradient sweep
      let badgeBrightness = 0.9;
      if (this.state.gradientAnimator?.isRunning()) {
        const fade = this.state.gradientAnimator.getFadeProgress();
        if (fade < 1) {
          const offset = this.state.gradientAnimator.getOffset() % 1;
          // Inverted phase (+ PI), range 0.65-0.95
          const animBrightness = 0.65 + 0.3 * (0.5 + 0.5 * Math.sin(offset * Math.PI * 2 + Math.PI));
          // Interpolate toward idle (0.9) as fade progresses
          badgeBrightness = animBrightness + (0.9 - animBrightness) * fade;
        }
      }
      const [mr, mg, mb] = [
        Math.floor(mcr * badgeBrightness),
        Math.floor(mcg * badgeBrightness),
        Math.floor(mcb * badgeBrightness),
      ];
      modeBadge = chalk.bgRgb(mr, mg, mb).hex(mastra.bg).bold(` ${badgeName.toLowerCase()} `);
      modeBadgeWidth = badgeName.length + 2;
    } else if (badgeName) {
      modeBadge = fg('dim', badgeName) + ' ';
      modeBadgeWidth = badgeName.length + 1;
    }

    // --- Update editor border to match mode color (not OM color) ---
    if (mainModeColor) {
      const [br, bg, bb] = [
        parseInt(mainModeColor.slice(1, 3), 16),
        parseInt(mainModeColor.slice(3, 5), 16),
        parseInt(mainModeColor.slice(5, 7), 16),
      ];
      const dim = 0.35;
      this.state.editor.borderColor = (text: string) =>
        chalk.rgb(Math.floor(br * dim), Math.floor(bg * dim), Math.floor(bb * dim))(text);
    }

    // --- Collect raw data ---
    // Show OM model when observing/reflecting, otherwise main model
    const fullModelId = showOMMode
      ? isObserving
        ? this.state.harness.getObserverModelId()
        : this.state.harness.getReflectorModelId()
      : this.state.harness.getFullModelId();
    // e.g. "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4-20250514"
    const shortModelId = fullModelId.includes('/') ? fullModelId.slice(fullModelId.indexOf('/') + 1) : fullModelId;
    // e.g. "claude-opus-4-6" → "opus 4.6", "claude-sonnet-4-20250514" → "sonnet-4-20250514"
    const tinyModelId = shortModelId.replace(/^claude-/, '').replace(/^(\w+)-(\d+)-(\d{1,2})$/, '$1 $2.$3');

    const homedir = process.env.HOME || process.env.USERPROFILE || '';
    let displayPath = this.state.projectInfo.rootPath;
    if (homedir && displayPath.startsWith(homedir)) {
      displayPath = '~' + displayPath.slice(homedir.length);
    }
    if (this.state.projectInfo.gitBranch) {
      displayPath = `${displayPath} (${this.state.projectInfo.gitBranch})`;
    }

    // --- Helper to style the model ID ---
    const isYolo = (this.state.harness.getState() as any).yolo === true;
    const styleModelId = (id: string): string => {
      if (!this.state.modelAuthStatus.hasAuth) {
        const envVar = this.state.modelAuthStatus.apiKeyEnvVar;
        return fg('dim', id) + fg('error', ' ✗') + fg('muted', envVar ? ` (${envVar})` : ' (no key)');
      }
      // Tinted near-black background from mode color
      const tintBg = modeColor ? tintHex(modeColor, 0.15) : undefined;
      const padded = ` ${id} `;

      if (this.state.gradientAnimator?.isRunning() && modeColor) {
        const fade = this.state.gradientAnimator.getFadeProgress();
        if (fade < 1) {
          // During active or fade-out: interpolate gradient toward idle color
          const text = applyGradientSweep(
            padded,
            this.state.gradientAnimator.getOffset(),
            modeColor,
            fade, // pass fade progress to flatten the gradient
          );
          return tintBg ? chalk.bgHex(tintBg)(text) : text;
        }
      }
      if (modeColor) {
        // Idle state
        const [r, g, b] = [
          parseInt(modeColor.slice(1, 3), 16),
          parseInt(modeColor.slice(3, 5), 16),
          parseInt(modeColor.slice(5, 7), 16),
        ];
        const dim = 0.8;
        const fg = chalk.rgb(Math.floor(r * dim), Math.floor(g * dim), Math.floor(b * dim)).bold(padded);
        return tintBg ? chalk.bgHex(tintBg)(fg) : fg;
      }
      return chalk.hex(mastra.specialGray).bold(id);
    };
    // --- Build line with progressive reduction ---
    // Strategy: progressively drop less-important elements to fit terminal width.
    // Each attempt assembles plain-text parts, measures, and if it fits, styles and renders.

    // Short badge: first letter only (e.g., "build" → "b", "observe" → "o")
    let shortModeBadge = '';
    let shortModeBadgeWidth = 0;
    if (badgeName && modeColor) {
      const shortName = badgeName.toLowerCase().charAt(0);
      const [mcr, mcg, mcb] = [
        parseInt(modeColor.slice(1, 3), 16),
        parseInt(modeColor.slice(3, 5), 16),
        parseInt(modeColor.slice(5, 7), 16),
      ];
      let sBadgeBrightness = 0.9;
      if (this.state.gradientAnimator?.isRunning()) {
        const fade = this.state.gradientAnimator.getFadeProgress();
        if (fade < 1) {
          const offset = this.state.gradientAnimator.getOffset() % 1;
          const animBrightness = 0.65 + 0.3 * (0.5 + 0.5 * Math.sin(offset * Math.PI * 2 + Math.PI));
          sBadgeBrightness = animBrightness + (0.9 - animBrightness) * fade;
        }
      }
      const [sr, sg, sb] = [
        Math.floor(mcr * sBadgeBrightness),
        Math.floor(mcg * sBadgeBrightness),
        Math.floor(mcb * sBadgeBrightness),
      ];
      shortModeBadge = chalk.bgRgb(sr, sg, sb).hex(mastra.bg).bold(` ${shortName} `);
      shortModeBadgeWidth = shortName.length + 2;
    } else if (badgeName) {
      const shortName = badgeName.toLowerCase().charAt(0);
      shortModeBadge = fg('dim', shortName) + ' ';
      shortModeBadgeWidth = shortName.length + 1;
    }

    const buildLine = (opts: {
      modelId: string;
      memCompact?: 'percentOnly' | 'noBuffer' | 'full';
      showDir: boolean;
      badge?: 'full' | 'short';
    }): { plain: string; styled: string } | null => {
      const parts: Array<{ plain: string; styled: string }> = [];
      // Model ID (always present) — styleModelId adds padding spaces
      // When YOLO, append ⚒ box flush (no SEP gap)
      if (isYolo && modeColor) {
        const yBox = chalk.bgHex(tintHex(modeColor, 0.25)).hex(tintHex(modeColor, 0.9)).bold(' ⚒ ');
        parts.push({
          plain: ` ${opts.modelId}  ⚒ `,
          styled: styleModelId(opts.modelId) + yBox,
        });
      } else {
        parts.push({
          plain: ` ${opts.modelId} `,
          styled: styleModelId(opts.modelId),
        });
      }
      const useBadge = opts.badge === 'short' ? shortModeBadge : modeBadge;
      const useBadgeWidth = opts.badge === 'short' ? shortModeBadgeWidth : modeBadgeWidth;
      // Memory info — animate label text when buffering is active
      const msgLabelStyler =
        this.state.bufferingMessages && this.state.gradientAnimator?.isRunning()
          ? (label: string) =>
              applyGradientSweep(
                label,
                this.state.gradientAnimator!.getOffset(),
                OBSERVER_COLOR,
                this.state.gradientAnimator!.getFadeProgress(),
              )
          : undefined;
      const obsLabelStyler =
        this.state.bufferingObservations && this.state.gradientAnimator?.isRunning()
          ? (label: string) =>
              applyGradientSweep(
                label,
                this.state.gradientAnimator!.getOffset(),
                REFLECTOR_COLOR,
                this.state.gradientAnimator!.getFadeProgress(),
              )
          : undefined;
      const obs = formatObservationStatus(this.state.omProgress, opts.memCompact, msgLabelStyler);
      const ref = formatReflectionStatus(this.state.omProgress, opts.memCompact, obsLabelStyler);
      if (obs) {
        parts.push({ plain: obs, styled: obs });
      }
      if (ref) {
        parts.push({ plain: ref, styled: ref });
      }
      // Directory (lowest priority on line 1)
      if (opts.showDir) {
        parts.push({
          plain: displayPath,
          styled: fg('dim', displayPath),
        });
      }
      const totalPlain =
        useBadgeWidth + parts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0), 0);

      if (totalPlain > termWidth) return null;

      let styledLine: string;
      if (opts.showDir && parts.length >= 3) {
        // Three groups: left (model), center (mem/tokens/thinking), right (dir)
        const leftPart = parts[0]!; // model
        const centerParts = parts.slice(1, -1); // mem, tokens, thinking
        const dirPart = parts[parts.length - 1]!; // dir

        const leftWidth = useBadgeWidth + visibleWidth(leftPart.plain);
        const centerWidth = centerParts.reduce(
          (sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0),
          0,
        );
        const rightWidth = visibleWidth(dirPart.plain);
        const totalContent = leftWidth + centerWidth + rightWidth;
        const freeSpace = termWidth - totalContent;
        const gapLeft = Math.floor(freeSpace / 2);
        const gapRight = freeSpace - gapLeft;

        styledLine =
          useBadge +
          leftPart.styled +
          ' '.repeat(Math.max(gapLeft, 1)) +
          centerParts.map(p => p.styled).join(SEP) +
          ' '.repeat(Math.max(gapRight, 1)) +
          dirPart.styled;
      } else if (opts.showDir && parts.length === 2) {
        // Just model + dir, right-align dir
        const mainStr = useBadge + parts[0]!.styled;
        const dirPart = parts[parts.length - 1]!;
        const gap = termWidth - totalPlain;
        styledLine = mainStr + ' '.repeat(gap + SEP.length) + dirPart.styled;
      } else {
        styledLine = useBadge + parts.map(p => p.styled).join(SEP);
      }
      return { plain: '', styled: styledLine };
    };
    // Try progressively more compact layouts.
    // Priority: token fractions + buffer > labels > provider > badge > buffer > fractions
    const result =
      // 1. Full badge + full model + long labels + fractions + buffer + dir
      buildLine({ modelId: fullModelId, memCompact: 'full', showDir: true }) ??
      // 2. Drop directory
      buildLine({ modelId: fullModelId, memCompact: 'full', showDir: false }) ??
      // 3. Drop provider + "claude-" prefix, keep full labels + fractions + buffer
      buildLine({ modelId: tinyModelId, memCompact: 'full', showDir: false }) ??
      // 4. Short labels (msg/mem) + fractions + buffer
      buildLine({ modelId: tinyModelId, showDir: false }) ??
      // 5. Short badge + short labels + fractions + buffer
      buildLine({ modelId: tinyModelId, showDir: false, badge: 'short' }) ??
      // 6. Short badge + fractions (drop buffer indicator)
      buildLine({
        modelId: tinyModelId,
        memCompact: 'noBuffer',
        showDir: false,
        badge: 'short',
      }) ??
      // 7. Full badge + percent only
      buildLine({
        modelId: tinyModelId,
        memCompact: 'percentOnly',
        showDir: false,
      }) ??
      // 8. Short badge + percent only
      buildLine({
        modelId: tinyModelId,
        memCompact: 'percentOnly',
        showDir: false,
        badge: 'short',
      });

    this.state.statusLine.setText(
      result?.styled ??
        shortModeBadge +
          styleModelId(tinyModelId) +
          (isYolo && modeColor ? chalk.bgHex(tintHex(modeColor, 0.25)).hex(tintHex(modeColor, 0.9)).bold(' ⚒ ') : ''),
    );

    // Line 2: hidden — dir only shows on line 1 when it fits
    if (this.state.memoryStatusLine) {
      this.state.memoryStatusLine.setText('');
    }

    this.state.ui.requestRender();
  }

  private async refreshModelAuthStatus(): Promise<void> {
    this.state.modelAuthStatus = await this.state.harness.getCurrentModelAuthStatus();
    this.updateStatusLine();
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
    switch (event.type) {
      case 'agent_start':
        this.handleAgentStart();
        break;

      case 'agent_end':
        if (event.reason === 'aborted') {
          this.handleAgentAborted();
        } else if (event.reason === 'error') {
          this.handleAgentError();
        } else {
          this.handleAgentEnd();
        }
        break;

      case 'message_start':
        this.handleMessageStart(event.message);
        break;

      case 'message_update':
        this.handleMessageUpdate(event.message);
        break;

      case 'message_end':
        this.handleMessageEnd(event.message);
        break;
      case 'tool_start':
        this.handleToolStart(event.toolCallId, event.toolName, event.args);
        break;

      case 'tool_approval_required':
        this.handleToolApprovalRequired(event.toolCallId, event.toolName, event.args);
        break;

      case 'tool_update':
        this.handleToolUpdate(event.toolCallId, event.partialResult);
        break;

      case 'shell_output':
        this.handleShellOutput(event.toolCallId, event.output, event.stream);
        break;

      case 'tool_input_start':
        this.handleToolInputStart(event.toolCallId, event.toolName);
        break;

      case 'tool_input_delta':
        this.handleToolInputDelta(event.toolCallId, event.argsTextDelta);
        break;

      case 'tool_input_end':
        this.handleToolInputEnd(event.toolCallId);
        break;

      case 'tool_end':
        this.handleToolEnd(event.toolCallId, event.result, event.isError);
        break;
      case 'info':
        this.showInfo(event.message);
        break;

      case 'error':
        this.showFormattedError(event);
        break;

      case 'mode_changed': {
        // Mode is already visible in status line, no need to log it
        await this.refreshModelAuthStatus();
        break;
      }

      case 'model_changed':
        // Update status line to reflect new model and auth status
        await this.refreshModelAuthStatus();
        break;

      case 'thread_changed': {
        this.showInfo(`Switched to thread: ${event.threadId}`);
        this.resetStatusLineState();
        await this.renderExistingMessages();
        await this.state.harness.loadOMProgress();
        this.syncOMThresholdsFromHarness();
        this.state.tokenUsage = this.state.harness.getTokenUsage();
        this.updateStatusLine();
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
        this.showInfo(`Created thread: ${event.thread.id}`);
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
        this.updateStatusLine();
        break;
      }

      case 'usage_update':
        this.handleUsageUpdate(event.usage);
        break;
      // Observational Memory events
      case 'om_status':
        this.handleOMStatus(event);
        break;

      case 'om_observation_start':
        this.handleOMObservationStart(event.cycleId, event.tokensToObserve);
        break;
      case 'om_observation_end':
        this.handleOMObservationEnd(
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
        this.handleOMFailed(event.cycleId, event.error, 'observation');
        break;

      case 'om_reflection_start':
        this.handleOMReflectionStart(event.cycleId, event.tokensToReflect);
        break;
      case 'om_reflection_end':
        this.handleOMReflectionEnd(event.cycleId, event.durationMs, event.compressedTokens, event.observations);
        break;
      case 'om_reflection_failed':
        this.handleOMFailed(event.cycleId, event.error, 'reflection');
        break;
      // Buffering lifecycle
      case 'om_buffering_start':
        if (event.operationType === 'observation') {
          this.state.bufferingMessages = true;
        } else {
          this.state.bufferingObservations = true;
        }
        this.state.activeActivationMarker = undefined;
        this.state.activeBufferingMarker = new OMMarkerComponent({
          type: 'om_buffering_start',
          operationType: event.operationType,
          tokensToBuffer: event.tokensToBuffer,
        });
        this.addOMMarkerToChat(this.state.activeBufferingMarker);
        this.updateStatusLine();
        this.state.ui.requestRender();
        break;
      case 'om_buffering_end':
        if (event.operationType === 'observation') {
          this.state.bufferingMessages = false;
        } else {
          this.state.bufferingObservations = false;
        }
        if (this.state.activeBufferingMarker) {
          this.state.activeBufferingMarker.update({
            type: 'om_buffering_end',
            operationType: event.operationType,
            tokensBuffered: event.tokensBuffered,
            bufferedTokens: event.bufferedTokens,
            observations: event.observations,
          });
        }
        this.state.activeBufferingMarker = undefined;
        this.updateStatusLine();
        this.state.ui.requestRender();
        break;

      case 'om_buffering_failed':
        if (event.operationType === 'observation') {
          this.state.bufferingMessages = false;
        } else {
          this.state.bufferingObservations = false;
        }
        if (this.state.activeBufferingMarker) {
          this.state.activeBufferingMarker.update({
            type: 'om_buffering_failed',
            operationType: event.operationType,
            error: event.error,
          });
        }
        this.state.activeBufferingMarker = undefined;
        this.updateStatusLine();
        this.state.ui.requestRender();
        break;
      case 'om_activation':
        if (event.operationType === 'observation') {
          this.state.bufferingMessages = false;
        } else {
          this.state.bufferingObservations = false;
        }
        const activationData: OMMarkerData = {
          type: 'om_activation',
          operationType: event.operationType,
          tokensActivated: event.tokensActivated,
          observationTokens: event.observationTokens,
        };
        this.state.activeActivationMarker = new OMMarkerComponent(activationData);
        this.addOMMarkerToChat(this.state.activeActivationMarker);
        this.state.activeBufferingMarker = undefined;
        this.updateStatusLine();
        this.state.ui.requestRender();
        break;

      case 'follow_up_queued': {
        const totalPending = (event.count as number) + this.state.pendingSlashCommands.length;
        this.showInfo(`Follow-up queued (${totalPending} pending)`);
        break;
      }

      case 'workspace_ready':
        // Workspace initialized successfully - silent unless verbose
        break;

      case 'workspace_error':
        this.showError(`Workspace: ${event.error.message}`);
        break;

      case 'workspace_status_changed':
        if (event.status === 'error' && event.error) {
          this.showError(`Workspace: ${event.error.message}`);
        }
        break;

      // Subagent / Task delegation events
      case 'subagent_start':
        this.handleSubagentStart(event.toolCallId, event.agentType, event.task, event.modelId);
        break;

      case 'subagent_tool_start':
        this.handleSubagentToolStart(event.toolCallId, event.subToolName, event.subToolArgs);
        break;

      case 'subagent_tool_end':
        this.handleSubagentToolEnd(event.toolCallId, event.subToolName, event.subToolResult, event.isError);
        break;

      case 'subagent_text_delta':
        // Text deltas are streamed but we don't render them incrementally
        // (the final result is shown via tool_end for the parent tool call)
        break;

      case 'subagent_end':
        this.handleSubagentEnd(event.toolCallId, event.isError, event.durationMs, event.result);
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
            this.renderCompletedTasksInline(tasks, insertIndex, true);
          } else if (this.state.previousTasks.length > 0 && (!tasks || tasks.length === 0)) {
            // Tasks were cleared
            this.renderClearedTasksInline(this.state.previousTasks, insertIndex);
          }

          // Track for next diff
          this.state.previousTasks = tasks ? [...tasks] : [];

          this.state.ui.requestRender();
        }
        break;
      }

      case 'ask_question':
        await this.handleAskQuestion(event.questionId, event.question, event.options);
        break;

      case 'sandbox_access_request':
        await this.handleSandboxAccessRequest(event.questionId, event.path, event.reason);
        break;

      case 'plan_approval_required':
        await this.handlePlanApproval(event.planId, event.title, event.plan);
        break;

      case 'plan_approved':
        // Handled directly in onApprove callback to ensure proper sequencing
        break;
    }
  }

  private handleUsageUpdate(usage: TokenUsage): void {
    // Accumulate token usage
    this.state.tokenUsage.promptTokens += usage.promptTokens;
    this.state.tokenUsage.completionTokens += usage.completionTokens;
    this.state.tokenUsage.totalTokens += usage.totalTokens;
    this.updateStatusLine();
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
    this.updateStatusLine();
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
    this.updateStatusLine();
  }

  // ===========================================================================
  // Observational Memory Event Handlers
  // ===========================================================================

  /**
   * Add an OM marker to the chat container, inserting it *before* the
   * current streaming component so it doesn't get pushed down as text
   * streams in.  Falls back to a normal append when nothing is streaming.
   */
  private addOMMarkerToChat(marker: OMMarkerComponent): void {
    if (this.state.streamingComponent) {
      const idx = this.state.chatContainer.children.indexOf(this.state.streamingComponent);
      if (idx >= 0) {
        this.state.chatContainer.children.splice(idx, 0, marker);
        this.state.chatContainer.invalidate();
        return;
      }
    }
    this.state.chatContainer.addChild(marker);
  }

  private addOMOutputToChat(output: OMOutputComponent): void {
    if (this.state.streamingComponent) {
      const idx = this.state.chatContainer.children.indexOf(this.state.streamingComponent);
      if (idx >= 0) {
        this.state.chatContainer.children.splice(idx, 0, output);
        this.state.chatContainer.invalidate();
        return;
      }
    }
    this.state.chatContainer.addChild(output);
  }
  private handleOMStatus(event: Extract<HarnessEvent, { type: 'om_status' }>): void {
    const { windows, generationCount, stepNumber } = event;
    const { active, buffered } = windows;

    // Update active window state
    this.state.omProgress.pendingTokens = active.messages.tokens;
    this.state.omProgress.threshold = active.messages.threshold;
    this.state.omProgress.thresholdPercent =
      active.messages.threshold > 0 ? (active.messages.tokens / active.messages.threshold) * 100 : 0;
    this.state.omProgress.observationTokens = active.observations.tokens;
    this.state.omProgress.reflectionThreshold = active.observations.threshold;
    this.state.omProgress.reflectionThresholdPercent =
      active.observations.threshold > 0 ? (active.observations.tokens / active.observations.threshold) * 100 : 0;

    // Update buffered state
    this.state.omProgress.buffered = {
      observations: { ...buffered.observations },
      reflection: { ...buffered.reflection },
    };
    this.state.omProgress.generationCount = generationCount;
    this.state.omProgress.stepNumber = stepNumber;

    // Drive buffering animation from status fields
    this.state.bufferingMessages = buffered.observations.status === 'running';
    this.state.bufferingObservations = buffered.reflection.status === 'running';

    this.updateStatusLine();
  }

  private handleOMObservationStart(cycleId: string, tokensToObserve: number): void {
    this.state.omProgress.status = 'observing';
    this.state.omProgress.cycleId = cycleId;
    this.state.omProgress.startTime = Date.now();
    // Show in-progress marker in chat
    this.state.activeOMMarker = new OMMarkerComponent({
      type: 'om_observation_start',
      tokensToObserve,
      operationType: 'observation',
    });
    this.addOMMarkerToChat(this.state.activeOMMarker);
    this.updateStatusLine();
    this.state.ui.requestRender();
  }
  private handleOMObservationEnd(
    _cycleId: string,
    durationMs: number,
    tokensObserved: number,
    observationTokens: number,
    observations?: string,
    currentTask?: string,
    suggestedResponse?: string,
  ): void {
    this.state.omProgress.status = 'idle';
    this.state.omProgress.cycleId = undefined;
    this.state.omProgress.startTime = undefined;
    this.state.omProgress.observationTokens = observationTokens;
    // Messages have been observed — reset pending tokens
    this.state.omProgress.pendingTokens = 0;
    this.state.omProgress.thresholdPercent = 0;
    // Remove in-progress marker — the output box replaces it
    if (this.state.activeOMMarker) {
      const idx = this.state.chatContainer.children.indexOf(this.state.activeOMMarker);
      if (idx >= 0) {
        this.state.chatContainer.children.splice(idx, 1);
        this.state.chatContainer.invalidate();
      }
      this.state.activeOMMarker = undefined;
    }
    // Show observation output in a bordered box (includes marker info in footer)
    const outputComponent = new OMOutputComponent({
      type: 'observation',
      observations: observations ?? '',
      currentTask,
      suggestedResponse,
      durationMs,
      tokensObserved,
      observationTokens,
    });
    this.addOMOutputToChat(outputComponent);
    this.updateStatusLine();
    this.state.ui.requestRender();
  }

  private handleOMReflectionStart(cycleId: string, tokensToReflect: number): void {
    this.state.omProgress.status = 'reflecting';
    this.state.omProgress.cycleId = cycleId;
    this.state.omProgress.startTime = Date.now();
    // Update observation tokens to show the total being reflected
    this.state.omProgress.observationTokens = tokensToReflect;
    this.state.omProgress.reflectionThresholdPercent =
      this.state.omProgress.reflectionThreshold > 0
        ? (tokensToReflect / this.state.omProgress.reflectionThreshold) * 100
        : 0;
    // Show in-progress marker in chat
    this.state.activeOMMarker = new OMMarkerComponent({
      type: 'om_observation_start',
      tokensToObserve: tokensToReflect,
      operationType: 'reflection',
    });
    this.addOMMarkerToChat(this.state.activeOMMarker);
    this.updateStatusLine();
    this.state.ui.requestRender();
  }
  private handleOMReflectionEnd(
    _cycleId: string,
    durationMs: number,
    compressedTokens: number,
    observations?: string,
  ): void {
    // Capture the pre-compression observation tokens for the marker display
    const preCompressionTokens = this.state.omProgress.observationTokens;
    this.state.omProgress.status = 'idle';
    this.state.omProgress.cycleId = undefined;
    this.state.omProgress.startTime = undefined;
    // Observations were compressed — update token count
    this.state.omProgress.observationTokens = compressedTokens;
    this.state.omProgress.reflectionThresholdPercent =
      this.state.omProgress.reflectionThreshold > 0
        ? (compressedTokens / this.state.omProgress.reflectionThreshold) * 100
        : 0;
    // Remove in-progress marker — the output box replaces it
    if (this.state.activeOMMarker) {
      const idx = this.state.chatContainer.children.indexOf(this.state.activeOMMarker);
      if (idx >= 0) {
        this.state.chatContainer.children.splice(idx, 1);
        this.state.chatContainer.invalidate();
      }
      this.state.activeOMMarker = undefined;
    }
    // Show reflection output in a bordered box (includes marker info in footer)
    const outputComponent = new OMOutputComponent({
      type: 'reflection',
      observations: observations ?? '',
      durationMs,
      compressedTokens,
      tokensObserved: preCompressionTokens,
    });
    this.addOMOutputToChat(outputComponent);
    // Revert spinner to "Working..."
    this.updateLoaderText('Working...');
    this.state.ui.requestRender();
    this.updateStatusLine();
  }

  private handleOMFailed(_cycleId: string, error: string, operation: 'observation' | 'reflection'): void {
    this.state.omProgress.status = 'idle';
    this.state.omProgress.cycleId = undefined;
    this.state.omProgress.startTime = undefined;
    // Update existing marker in-place, or create new one
    const failData: OMMarkerData = {
      type: 'om_observation_failed',
      error,
      operationType: operation,
    };
    if (this.state.activeOMMarker) {
      this.state.activeOMMarker.update(failData);
      this.state.activeOMMarker = undefined;
    } else {
      this.addOMMarkerToChat(new OMMarkerComponent(failData));
    }
    this.updateStatusLine();
    this.state.ui.requestRender();
  }

  /** Update the loading animation text (e.g., "Working..." → "Observing...") */
  private updateLoaderText(_text: string): void {
    // Status text changes are now reflected via updateStatusLine gradient
    this.updateStatusLine();
  }

  private handleAgentStart(): void {
    this.state.isAgentActive = true;
    if (!this.state.gradientAnimator) {
      this.state.gradientAnimator = new GradientAnimator(() => {
        this.updateStatusLine();
      });
    }
    this.state.gradientAnimator.start();
    this.updateStatusLine();
  }
  private handleAgentEnd(): void {
    this.state.isAgentActive = false;
    if (this.state.gradientAnimator) {
      this.state.gradientAnimator.fadeOut();
    }
    this.updateStatusLine();

    if (this.state.streamingComponent) {
      this.state.streamingComponent = undefined;
      this.state.streamingMessage = undefined;
    }
    this.state.followUpComponents = [];
    this.state.pendingTools.clear();
    this.state.toolInputBuffers.clear();
    // Keep allToolComponents so Ctrl+E continues to work after agent completes

    this.notify('agent_done');

    // Drain queued slash commands once all harness-level follow-ups are done.
    // Each slash command that triggers sendMessage will start a new agent
    // operation, and handleAgentEnd will fire again to drain the next one.
    if (this.state.pendingSlashCommands.length > 0 && this.state.harness.getFollowUpCount() === 0) {
      const nextCommand = this.state.pendingSlashCommands.shift()!;
      this.handleSlashCommand(nextCommand).catch(error => {
        this.showError(error instanceof Error ? error.message : 'Queued slash command failed');
      });
    }
  }

  private handleAgentAborted(): void {
    this.state.isAgentActive = false;
    if (this.state.gradientAnimator) {
      this.state.gradientAnimator.fadeOut();
    }
    this.updateStatusLine();

    // Update streaming message to show it was interrupted
    if (this.state.streamingComponent && this.state.streamingMessage) {
      this.state.streamingMessage.stopReason = 'aborted';
      this.state.streamingMessage.errorMessage = 'Interrupted';
      this.state.streamingComponent.updateContent(this.state.streamingMessage);
      this.state.streamingComponent = undefined;
      this.state.streamingMessage = undefined;
    } else if (this.state.userInitiatedAbort) {
      // Show standalone "Interrupted" if user pressed Ctrl+C but no streaming component
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(new Text(theme.fg('error', 'Interrupted'), 1, 0));
    }
    this.state.userInitiatedAbort = false;

    this.state.followUpComponents = [];
    this.state.pendingSlashCommands = [];
    this.state.pendingTools.clear();
    this.state.toolInputBuffers.clear();
    // Keep allToolComponents so Ctrl+E continues to work after interruption
    this.state.ui.requestRender();
  }

  private handleAgentError(): void {
    this.state.isAgentActive = false;
    if (this.state.gradientAnimator) {
      this.state.gradientAnimator.fadeOut();
    }
    this.updateStatusLine();

    if (this.state.streamingComponent) {
      this.state.streamingComponent = undefined;
      this.state.streamingMessage = undefined;
    }

    this.state.followUpComponents = [];
    this.state.pendingSlashCommands = [];
    this.state.pendingTools.clear();
    this.state.toolInputBuffers.clear();
    // Keep allToolComponents so Ctrl+E continues to work after errors
  }

  private handleMessageStart(message: HarnessMessage): void {
    if (message.role === 'user') {
      this.addUserMessage(message);
    } else if (message.role === 'assistant') {
      // Clear tool component references when starting a new assistant message
      this.state.lastAskUserComponent = undefined;
      this.state.lastSubmitPlanComponent = undefined;
      if (!this.state.streamingComponent) {
        this.state.streamingComponent = new AssistantMessageComponent(
          undefined,
          this.state.hideThinkingBlock,
          getMarkdownTheme(),
        );
        this.addChildBeforeFollowUps(this.state.streamingComponent);
        this.state.streamingMessage = message;
        const trailingParts = this.getTrailingContentParts(message);
        this.state.streamingComponent.updateContent({
          ...message,
          content: trailingParts,
        });
      }
      this.state.ui.requestRender();
    }
  }

  private handleMessageUpdate(message: HarnessMessage): void {
    if (!this.state.streamingComponent || message.role !== 'assistant') return;

    this.state.streamingMessage = message;
    // Check for new tool calls
    for (const content of message.content) {
      if (content.type === 'tool_call') {
        // For subagent calls, freeze the current streaming component
        // with content before the tool call, then create a new one.
        // SubagentExecutionComponent handles the visual rendering.
        // Check subagentToolCallIds separately since handleToolStart
        // may have already added the ID to seenToolCallIds.
        if (content.name === 'subagent' && !this.state.subagentToolCallIds.has(content.id)) {
          this.state.seenToolCallIds.add(content.id);
          this.state.subagentToolCallIds.add(content.id);
          // Freeze current component with pre-subagent content
          const preContent = this.getContentBeforeToolCall(message, content.id);
          this.state.streamingComponent.updateContent({
            ...message,
            content: preContent,
          });
          this.state.streamingComponent = new AssistantMessageComponent(
            undefined,
            this.state.hideThinkingBlock,
            getMarkdownTheme(),
          );
          this.addChildBeforeFollowUps(this.state.streamingComponent);
          continue;
        }

        if (!this.state.seenToolCallIds.has(content.id)) {
          this.state.seenToolCallIds.add(content.id);

          this.addChildBeforeFollowUps(new Text('', 0, 0));
          const component = new ToolExecutionComponentEnhanced(
            content.name,
            content.args,
            { showImages: false, collapsedByDefault: !this.state.toolOutputExpanded },
            this.state.ui,
          );
          component.setExpanded(this.state.toolOutputExpanded);
          this.addChildBeforeFollowUps(component);
          this.state.pendingTools.set(content.id, component);
          this.state.allToolComponents.push(component);

          this.state.streamingComponent = new AssistantMessageComponent(
            undefined,
            this.state.hideThinkingBlock,
            getMarkdownTheme(),
          );
          this.addChildBeforeFollowUps(this.state.streamingComponent);
        } else {
          const component = this.state.pendingTools.get(content.id);
          if (component) {
            component.updateArgs(content.args);
          }
        }
      }
    }

    const trailingParts = this.getTrailingContentParts(message);
    this.state.streamingComponent.updateContent({
      ...message,
      content: trailingParts,
    });

    this.state.ui.requestRender();
  }

  /**
   * Get content parts after the last tool_call/tool_result in the message.
   * These are the parts that should be rendered in the current streaming component.
   */
  private getTrailingContentParts(message: HarnessMessage): HarnessMessage['content'] {
    let lastToolIndex = -1;
    for (let i = message.content.length - 1; i >= 0; i--) {
      const c = message.content[i]!;
      if (c.type === 'tool_call' || c.type === 'tool_result') {
        lastToolIndex = i;
        break;
      }
    }
    if (lastToolIndex === -1) {
      // No tool calls — return all content
      return message.content;
    }
    // Return everything after the last tool-related part
    return message.content.slice(lastToolIndex + 1);
  }
  /**
   * Get content parts between the last processed tool call and this one (text/thinking only).
   */
  private getContentBeforeToolCall(message: HarnessMessage, toolCallId: string): HarnessMessage['content'] {
    const idx = message.content.findIndex(c => c.type === 'tool_call' && c.id === toolCallId);
    if (idx === -1) return message.content;
    // Find the start: after the last tool_call/tool_result that we've already seen
    let startIdx = 0;
    for (let i = idx - 1; i >= 0; i--) {
      const c = message.content[i]!;
      if (
        (c.type === 'tool_call' && 'id' in c && this.state.seenToolCallIds.has(c.id)) ||
        (c.type === 'tool_result' && 'id' in c && this.state.seenToolCallIds.has(c.id))
      ) {
        startIdx = i + 1;
        break;
      }
    }

    return message.content.slice(startIdx, idx).filter(c => c.type === 'text' || c.type === 'thinking');
  }

  private handleMessageEnd(message: HarnessMessage): void {
    if (message.role === 'user') return;

    if (this.state.streamingComponent && message.role === 'assistant') {
      this.state.streamingMessage = message;
      const trailingParts = this.getTrailingContentParts(message);
      this.state.streamingComponent.updateContent({
        ...message,
        content: trailingParts,
      });

      if (message.stopReason === 'aborted' || message.stopReason === 'error') {
        const errorMessage = message.errorMessage || 'Operation aborted';
        for (const [, component] of this.state.pendingTools) {
          component.updateResult({
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          });
        }
        this.state.pendingTools.clear();
        this.state.toolInputBuffers.clear();
      }

      this.state.streamingComponent = undefined;
      this.state.streamingMessage = undefined;
      this.state.seenToolCallIds.clear();
      this.state.subagentToolCallIds.clear();
    }
    this.state.ui.requestRender();
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
  private handleToolApprovalRequired(toolCallId: string, toolName: string, args: unknown): void {
    // Compute category label for the dialog
    const category = getToolCategory(toolName);
    const categoryLabel = category ? TOOL_CATEGORIES[category]?.label : undefined;

    // Send notification to alert the user
    this.notify('tool_approval', `Approve ${toolName}?`);

    const dialog = new ToolApprovalDialogComponent({
      toolCallId,
      toolName,
      args,
      categoryLabel,
      onAction: (action: ApprovalAction) => {
        this.state.ui.hideOverlay();
        this.state.pendingApprovalDismiss = null;
        if (action.type === 'approve') {
          this.state.harness.respondToToolApproval({ decision: 'approve' });
        } else if (action.type === 'always_allow_category') {
          this.state.harness.respondToToolApproval({ decision: 'always_allow_category' });
        } else if (action.type === 'yolo') {
          this.state.harness.setState({ yolo: true } as any);
          this.state.harness.respondToToolApproval({ decision: 'approve' });
          this.updateStatusLine();
        } else {
          this.state.harness.respondToToolApproval({ decision: 'decline' });
        }
      },
    });

    // Set up Ctrl+C dismiss to decline
    this.state.pendingApprovalDismiss = () => {
      this.state.ui.hideOverlay();
      this.state.pendingApprovalDismiss = null;
      this.state.harness.respondToToolApproval({ decision: 'decline' });
    };

    // Show the dialog as an overlay
    this.state.ui.showOverlay(dialog, {
      width: '70%',
      anchor: 'center',
    });
    dialog.focused = true;
    this.state.ui.requestRender();
  }

  private handleToolStart(toolCallId: string, toolName: string, args: unknown): void {
    // Component may already exist if created early by handleToolInputStart
    const existingComponent = this.state.pendingTools.get(toolCallId);

    if (existingComponent) {
      // Component was created during input streaming — update with final args
      existingComponent.updateArgs(args);
    } else if (!this.state.seenToolCallIds.has(toolCallId)) {
      this.state.seenToolCallIds.add(toolCallId);

      // Skip creating the regular tool component for subagent calls
      // The SubagentExecutionComponent will handle all the rendering
      if (toolName === 'subagent') {
        return;
      }

      this.addChildBeforeFollowUps(new Text('', 0, 0));
      const component = new ToolExecutionComponentEnhanced(
        toolName,
        args,
        { showImages: false, collapsedByDefault: !this.state.toolOutputExpanded },
        this.state.ui,
      );
      component.setExpanded(this.state.toolOutputExpanded);
      this.addChildBeforeFollowUps(component);
      this.state.pendingTools.set(toolCallId, component);
      this.state.allToolComponents.push(component);

      // Create a new post-tool AssistantMessageComponent so pre-tool text is preserved
      this.state.streamingComponent = new AssistantMessageComponent(
        undefined,
        this.state.hideThinkingBlock,
        getMarkdownTheme(),
      );
      this.addChildBeforeFollowUps(this.state.streamingComponent);

      this.state.ui.requestRender();
    }

    // Track ask_user tool components for inline question placement
    const component = this.state.pendingTools.get(toolCallId);
    if (component) {
      if (toolName === 'ask_user') {
        this.state.lastAskUserComponent = component;
      }
      // Track submit_plan tool components for inline plan approval placement
      if (toolName === 'submit_plan') {
        this.state.lastSubmitPlanComponent = component;
      }
    }

    // Track file-modifying tools for /diff command
    if (FILE_TOOLS.includes(toolName)) {
      const toolArgs = args as Record<string, unknown>;
      const filePath = toolArgs?.path as string;
      if (filePath) {
        this.state.pendingFileTools.set(toolCallId, { toolName, filePath });
      }
    }
  }

  private handleToolUpdate(toolCallId: string, partialResult: unknown): void {
    const component = this.state.pendingTools.get(toolCallId);
    if (component) {
      const result: ToolResult = {
        content: [{ type: 'text', text: this.formatToolResult(partialResult) }],
        isError: false,
      };
      component.updateResult(result, true);
      this.state.ui.requestRender();
    }
  }

  /**
   * Handle streaming shell output from execute_command tool.
   */
  private handleShellOutput(toolCallId: string, output: string, _stream: 'stdout' | 'stderr'): void {
    const component = this.state.pendingTools.get(toolCallId);
    if (component?.appendStreamingOutput) {
      component.appendStreamingOutput(output);
      this.state.ui.requestRender();
    }
  }

  /**
   * Handle the start of streaming tool call input arguments.
   * Creates the tool component early so partial args can render as they arrive.
   */
  private handleToolInputStart(toolCallId: string, toolName: string): void {
    this.state.toolInputBuffers.set(toolCallId, { text: '', toolName });

    // Mark as seen so handleMessageUpdate doesn't create a duplicate component
    if (!this.state.seenToolCallIds.has(toolCallId)) {
      this.state.seenToolCallIds.add(toolCallId);
    }

    // Create the component early so deltas can update it
    // Skip for subagent (handled by SubagentExecutionComponent) and task_write (streams to pinned TaskProgressComponent)
    if (toolName === 'task_write') {
      // Record position so task_updated can place inline completed/cleared display here
      this.state.taskWriteInsertIndex = this.state.chatContainer.children.length;

      // Create a new post-tool AssistantMessageComponent so pre-tool text is preserved
      // (even though task_write doesn't render a tool component inline, we still need
      // to split the streaming component so getTrailingContentParts doesn't overwrite it)
      this.state.streamingComponent = new AssistantMessageComponent(
        undefined,
        this.state.hideThinkingBlock,
        getMarkdownTheme(),
      );
      this.addChildBeforeFollowUps(this.state.streamingComponent);
      this.state.ui.requestRender();
    } else if (toolName !== 'subagent') {
      this.addChildBeforeFollowUps(new Text('', 0, 0));
      const component = new ToolExecutionComponentEnhanced(
        toolName,
        {},
        { showImages: false, collapsedByDefault: !this.state.toolOutputExpanded },
        this.state.ui,
      );
      component.setExpanded(this.state.toolOutputExpanded);
      this.addChildBeforeFollowUps(component);
      this.state.pendingTools.set(toolCallId, component);
      this.state.allToolComponents.push(component);

      // Create a new post-tool AssistantMessageComponent so pre-tool text is preserved
      this.state.streamingComponent = new AssistantMessageComponent(
        undefined,
        this.state.hideThinkingBlock,
        getMarkdownTheme(),
      );
      this.addChildBeforeFollowUps(this.state.streamingComponent);

      this.state.ui.requestRender();
    }
  }

  /**
   * Handle an incremental delta of tool call input arguments.
   * Buffers the partial JSON text and attempts to parse it, updating the component's args.
   */
  private handleToolInputDelta(toolCallId: string, argsTextDelta: string): void {
    const buffer = this.state.toolInputBuffers.get(toolCallId);
    if (buffer === undefined) return;

    buffer.text += argsTextDelta;
    const updatedText = buffer.text;

    try {
      const partialArgs = parsePartialJson(updatedText);
      if (partialArgs && typeof partialArgs === 'object') {
        // Update inline tool component if it exists
        const component = this.state.pendingTools.get(toolCallId);
        if (component) {
          component.updateArgs(partialArgs);
        }

        // For task_write, stream partial tasks into the pinned TaskProgressComponent.
        // The last array item is actively being written so its content is unstable.
        // If all existing pinned items are already completed, the list is stable and
        // we can stream in new items immediately (including the last one).
        // Otherwise, exclude the last item to avoid jumpy partial-content matches.
        if (buffer.toolName === 'task_write' && this.state.taskProgress) {
          const tasks = (partialArgs as { tasks?: TaskItem[] }).tasks;
          if (tasks && tasks.length > 0) {
            const existing = this.state.taskProgress.getTasks();
            const allExistingDone = existing.length === 0 || existing.every(t => t.status === 'completed');
            if (allExistingDone) {
              // Old list is done — start fresh, stream new items immediately
              this.state.taskProgress.updateTasks(tasks as TaskItem[]);
            } else if (tasks.length > 1) {
              // Merge only completed items (exclude the last still-streaming one)
              const merged = [...existing];
              for (const task of tasks.slice(0, -1)) {
                if (!task.content) continue;
                const idx = merged.findIndex(t => t.content === task.content);
                if (idx >= 0) {
                  merged[idx] = task;
                } else {
                  merged.push(task);
                }
              }
              this.state.taskProgress.updateTasks(merged);
            }
          }
        }

        this.state.ui.requestRender();
      }
    } catch {
      // Malformed or incomplete JSON — partial-json throws MalformedJSON for invalid input
    }
  }

  /**
   * Clean up the input buffer when tool input streaming ends.
   */
  private handleToolInputEnd(toolCallId: string): void {
    this.state.toolInputBuffers.delete(toolCallId);
  }

  /**
   * Handle an ask_question event from the ask_user tool.
   * Shows a dialog overlay and resolves the tool's pending promise.
   */
  private async handleAskQuestion(
    questionId: string,
    question: string,
    options?: Array<{ label: string; description?: string }>,
  ): Promise<void> {
    return new Promise(resolve => {
      if (this.state.options.inlineQuestions) {
        // Inline mode: Add question component to chat
        const questionComponent = new AskQuestionInlineComponent(
          {
            question,
            options,
            onSubmit: answer => {
              this.state.activeInlineQuestion = undefined;
              this.state.harness.respondToQuestion({ questionId, answer });
              resolve();
            },
            onCancel: () => {
              this.state.activeInlineQuestion = undefined;
              this.state.harness.respondToQuestion({ questionId, answer: '(skipped)' });
              resolve();
            },
          },
          this.state.ui,
        );

        // Store as active question
        this.state.activeInlineQuestion = questionComponent;

        // Insert the question right after the ask_user tool component
        if (this.state.lastAskUserComponent) {
          // Find the position of the ask_user component
          const children = [...this.state.chatContainer.children];
          // Since lastAskUserComponent extends Container, it should be in children
          const askUserIndex = children.indexOf(this.state.lastAskUserComponent as any);

          if (askUserIndex >= 0) {
            // Debug: Log the positioning

            // Clear and rebuild with question in the right place
            this.state.chatContainer.clear();
            // Add all children up to and including the ask_user tool
            for (let i = 0; i <= askUserIndex; i++) {
              this.state.chatContainer.addChild(children[i]!);
            }

            // Add the question component with spacing
            this.state.chatContainer.addChild(new Spacer(1));
            this.state.chatContainer.addChild(questionComponent);
            this.state.chatContainer.addChild(new Spacer(1));

            // Add remaining children
            for (let i = askUserIndex + 1; i < children.length; i++) {
              this.state.chatContainer.addChild(children[i]!);
            }
          } else {
            // Fallback: add at the end
            this.state.chatContainer.addChild(new Spacer(1));
            this.state.chatContainer.addChild(questionComponent);
            this.state.chatContainer.addChild(new Spacer(1));
          }
        } else {
          // Fallback: add at the end if no ask_user component tracked
          this.state.chatContainer.addChild(new Spacer(1));
          this.state.chatContainer.addChild(questionComponent);
          this.state.chatContainer.addChild(new Spacer(1));
        }

        this.state.ui.requestRender();

        // Ensure the chat scrolls to show the question
        this.state.chatContainer.invalidate();

        // Focus the question component
        questionComponent.focused = true;
      } else {
        // Dialog mode: Show overlay
        const dialog = new AskQuestionDialogComponent({
          question,
          options,
          onSubmit: answer => {
            this.state.ui.hideOverlay();
            this.state.harness.respondToQuestion({ questionId, answer });
            resolve();
          },
          onCancel: () => {
            this.state.ui.hideOverlay();
            this.state.harness.respondToQuestion({ questionId, answer: '(skipped)' });
            resolve();
          },
        });
        this.state.ui.showOverlay(dialog, { width: '70%', anchor: 'center' });
        dialog.focused = true;
      }

      this.notify('ask_question', question);
    });
  }

  /**
   * Handle a sandbox_access_request event from the request_sandbox_access tool.
   * Shows an inline prompt for the user to approve or deny directory access.
   */
  private async handleSandboxAccessRequest(questionId: string, requestedPath: string, reason: string): Promise<void> {
    return new Promise(resolve => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question: `Grant sandbox access to "${requestedPath}"?\n${fg('dim', `Reason: ${reason}`)}`,
          options: [
            { label: 'Yes', description: 'Allow access to this directory' },
            { label: 'No', description: 'Deny access' },
          ],
          onSubmit: answer => {
            this.state.activeInlineQuestion = undefined;
            this.state.harness.respondToQuestion({ questionId, answer });
            resolve();
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            this.state.harness.respondToQuestion({ questionId, answer: 'No' });
            resolve();
          },
          formatResult: answer => {
            const approved = answer.toLowerCase().startsWith('y');
            return approved ? `Granted access to ${requestedPath}` : `Denied access to ${requestedPath}`;
          },
          isNegativeAnswer: answer => !answer.toLowerCase().startsWith('y'),
        },
        this.state.ui,
      );

      // Store as active question so input routing works
      this.state.activeInlineQuestion = questionComponent;

      // Add to chat
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(questionComponent);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();

      this.notify('sandbox_access', `Sandbox access requested: ${requestedPath}`);
    });
  }

  /**
   * Handle a plan_approval_required event from the submit_plan tool.
   * Shows the plan inline with Approve/Reject/Request Changes options.
   */
  private async handlePlanApproval(planId: string, title: string, plan: string): Promise<void> {
    return new Promise(resolve => {
      const approvalComponent = new PlanApprovalInlineComponent(
        {
          planId,
          title,
          plan,
          onApprove: async () => {
            this.state.activeInlinePlanApproval = undefined;
            // Store the approved plan in harness state
            await this.state.harness.setState({
              activePlan: {
                title,
                plan,
                approvedAt: new Date().toISOString(),
              },
            });
            // Wait for plan approval to complete (switches mode, aborts stream)
            await this.state.harness.respondToPlanApproval({
              planId,
              response: { action: 'approved' },
            });
            this.updateStatusLine();

            // Now that mode switch is complete, add system reminder and trigger build agent
            // Use setTimeout to ensure the plan approval component has fully rendered
            setTimeout(() => {
              const reminderText =
                '<system-reminder>The user has approved the plan, begin executing.</system-reminder>';
              this.addUserMessage({
                id: `system-${Date.now()}`,
                role: 'user',
                content: [{ type: 'text', text: reminderText }],
                createdAt: new Date(),
              });
              this.fireMessage(reminderText);
            }, 50);

            resolve();
          },
          onReject: async (feedback?: string) => {
            this.state.activeInlinePlanApproval = undefined;
            this.state.harness.respondToPlanApproval({
              planId,
              response: { action: 'rejected', feedback },
            });
            resolve();
          },
        },
        this.state.ui,
      );

      // Store as active plan approval
      this.state.activeInlinePlanApproval = approvalComponent;

      // Insert after the submit_plan tool component (same pattern as ask_user)
      if (this.state.lastSubmitPlanComponent) {
        const children = [...this.state.chatContainer.children];
        const submitPlanIndex = children.indexOf(this.state.lastSubmitPlanComponent as any);
        if (submitPlanIndex >= 0) {
          this.state.chatContainer.clear();
          for (let i = 0; i <= submitPlanIndex; i++) {
            this.state.chatContainer.addChild(children[i]!);
          }
          this.state.chatContainer.addChild(new Spacer(1));
          this.state.chatContainer.addChild(approvalComponent);
          this.state.chatContainer.addChild(new Spacer(1));
          for (let i = submitPlanIndex + 1; i < children.length; i++) {
            this.state.chatContainer.addChild(children[i]!);
          }
        } else {
          this.state.chatContainer.addChild(new Spacer(1));
          this.state.chatContainer.addChild(approvalComponent);
          this.state.chatContainer.addChild(new Spacer(1));
        }
      } else {
        this.state.chatContainer.addChild(new Spacer(1));
        this.state.chatContainer.addChild(approvalComponent);
        this.state.chatContainer.addChild(new Spacer(1));
      }
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
      approvalComponent.focused = true;

      this.notify('plan_approval', `Plan "${title}" requires approval`);
    });
  }
  private handleToolEnd(toolCallId: string, result: unknown, isError: boolean): void {
    // If this is a subagent tool, store the result in the SubagentExecutionComponent
    const subagentComponent = this.state.pendingSubagents.get(toolCallId);
    if (subagentComponent) {
      // The final result is available here
      const resultText = this.formatToolResult(result);
      // We'll need to wait for subagent_end to set this
      // Store it temporarily
      (subagentComponent as any)._pendingResult = resultText;
    }

    // Track successful file modifications for /diff command
    const pendingFile = this.state.pendingFileTools.get(toolCallId);
    if (pendingFile && !isError) {
      const existing = this.state.modifiedFiles.get(pendingFile.filePath);
      if (existing) {
        existing.operations.push(pendingFile.toolName);
      } else {
        this.state.modifiedFiles.set(pendingFile.filePath, {
          operations: [pendingFile.toolName],
          firstModified: new Date(),
        });
      }
    }
    this.state.pendingFileTools.delete(toolCallId);

    const component = this.state.pendingTools.get(toolCallId);
    if (component) {
      const toolResult: ToolResult = {
        content: [{ type: 'text', text: this.formatToolResult(result) }],
        isError,
      };
      component.updateResult(toolResult, false);

      this.state.pendingTools.delete(toolCallId);
      this.state.ui.requestRender();
    }
  }

  /**
   * Format a tool result for display.
   * Handles objects, strings, and other types.
   * Extracts content from common tool return structures like { content: "...", isError: false }
   */
  private formatToolResult(result: unknown): string {
    if (result === null || result === undefined) {
      return '';
    }
    if (typeof result === 'string') {
      return result;
    }
    if (typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      // Handle common tool return format: { content: "...", isError: boolean }
      if ('content' in obj && typeof obj.content === 'string') {
        return obj.content;
      }
      // Handle content array format: { content: [{ type: "text", text: "..." }] }
      if ('content' in obj && Array.isArray(obj.content)) {
        const textParts = obj.content
          .filter(
            (part: unknown) =>
              typeof part === 'object' && part !== null && (part as Record<string, unknown>).type === 'text',
          )
          .map((part: unknown) => (part as Record<string, unknown>).text || '');
        if (textParts.length > 0) {
          return textParts.join('\n');
        }
      }
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    }
    return String(result);
  }

  /**
   * Render a completed task list inline in the chat history.
   * This mirrors the pinned TaskProgressComponent format but shows
   * all items as completed, since the pinned component hides itself
   * when everything is done.
   * @param tasks The completed task items
   * @param insertIndex Optional index to insert at (replaces tool component position)
   */
  private renderCompletedTasksInline(tasks: TaskItem[], insertIndex = -1, collapsed = false): void {
    const headerText = bold(fg('accent', 'Tasks')) + fg('dim', ` [${tasks.length}/${tasks.length} completed]`);

    const container = new Container();
    container.addChild(new Spacer(1));
    container.addChild(new Text(headerText, 0, 0));
    const MAX_VISIBLE = 4;
    const shouldCollapse = collapsed && tasks.length > MAX_VISIBLE + 1;
    const visible = shouldCollapse ? tasks.slice(0, MAX_VISIBLE) : tasks;
    const remaining = shouldCollapse ? tasks.length - MAX_VISIBLE : 0;

    for (const task of visible) {
      const icon = chalk.hex(mastra.green)('✓');
      const text = chalk.hex(mastra.green)(task.content);
      container.addChild(new Text(`  ${icon} ${text}`, 0, 0));
    }
    if (remaining > 0) {
      container.addChild(
        new Text(
          fg('dim', `  ... ${remaining} more completed task${remaining > 1 ? 's' : ''} (ctrl+e to expand)`),
          0,
          0,
        ),
      );
    }

    if (insertIndex >= 0) {
      // Insert at the position where the task_write tool was
      this.state.chatContainer.children.splice(insertIndex, 0, container);
      this.state.chatContainer.invalidate();
    } else {
      // Fallback: append at end
      this.state.chatContainer.addChild(container);
    }
  }

  /**
   * Render inline display when tasks are cleared.
   * Shows what was cleared with strikethrough.
   */
  private renderClearedTasksInline(clearedTasks: TaskItem[], insertIndex = -1): void {
    const container = new Container();
    container.addChild(new Spacer(1));
    const count = clearedTasks.length;
    const label = count === 1 ? 'Task' : 'Tasks';
    container.addChild(new Text(fg('accent', `${label} cleared`), 0, 0));
    for (const task of clearedTasks) {
      const icon = task.status === 'completed' ? chalk.hex(mastra.green)('✓') : chalk.hex(mastra.darkGray)('○');
      const text = chalk.dim.strikethrough(task.content);
      container.addChild(new Text(`  ${icon} ${text}`, 0, 0));
    }
    if (insertIndex >= 0) {
      this.state.chatContainer.children.splice(insertIndex, 0, container);
      this.state.chatContainer.invalidate();
    } else {
      this.state.chatContainer.addChild(container);
    }
  }
  // ===========================================================================
  // Subagent Events
  // ===========================================================================

  private handleSubagentStart(toolCallId: string, agentType: string, task: string, modelId?: string): void {
    // Create a dedicated rendering component for this subagent run
    const component = new SubagentExecutionComponent(agentType, task, this.state.ui, modelId);
    this.state.pendingSubagents.set(toolCallId, component);
    this.state.allToolComponents.push(component as any);

    // Insert before the current streamingComponent so subagent box
    // appears between pre-subagent text and post-subagent text
    if (this.state.streamingComponent) {
      const idx = this.state.chatContainer.children.indexOf(this.state.streamingComponent as any);
      if (idx >= 0) {
        (this.state.chatContainer.children as unknown[]).splice(idx, 0, component);
        this.state.chatContainer.invalidate();
      } else {
        this.state.chatContainer.addChild(component);
      }
    } else {
      this.state.chatContainer.addChild(component);
    }

    this.state.ui.requestRender();
  }

  private handleSubagentToolStart(toolCallId: string, subToolName: string, subToolArgs: unknown): void {
    const component = this.state.pendingSubagents.get(toolCallId);
    if (component) {
      component.addToolStart(subToolName, subToolArgs);
      this.state.ui.requestRender();
    }
  }

  private handleSubagentToolEnd(
    toolCallId: string,
    subToolName: string,
    subToolResult: unknown,
    isError: boolean,
  ): void {
    const component = this.state.pendingSubagents.get(toolCallId);
    if (component) {
      component.addToolEnd(subToolName, subToolResult, isError);
      this.state.ui.requestRender();
    }
  }

  private handleSubagentEnd(toolCallId: string, isError: boolean, durationMs: number, result?: string): void {
    const component = this.state.pendingSubagents.get(toolCallId);
    if (component) {
      component.finish(isError, durationMs, result);
      this.state.pendingSubagents.delete(toolCallId);
      this.state.ui.requestRender();
    }
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

  // ===========================================================================
  // Thread Selector
  // ===========================================================================

  private async showThreadSelector(): Promise<void> {
    const threads = await this.state.harness.listThreads({ allResources: true });
    const currentId = this.state.pendingNewThread ? null : this.state.harness.getCurrentThreadId();
    const currentResourceId = this.state.harness.getResourceId();

    if (threads.length === 0) {
      this.showInfo('No threads yet. Send a message to create one.');
      return;
    }

    return new Promise(resolve => {
      const selector = new ThreadSelectorComponent({
        tui: this.state.ui,
        threads,
        currentThreadId: currentId,
        currentResourceId,
        getMessagePreview: async (threadId: string) => {
          const firstUserMessage = await this.state.harness.getFirstUserMessageForThread({ threadId });
          if (firstUserMessage) {
            const text = this.extractTextContent(firstUserMessage);
            return this.truncatePreview(text);
          }
          return null;
        },
        onSelect: async thread => {
          this.state.ui.hideOverlay();

          if (thread.id === currentId) {
            resolve();
            return;
          }

          // If thread is from a different resource, switch resource first
          if (thread.resourceId !== currentResourceId) {
            this.state.harness.setResourceId({ resourceId: thread.resourceId });
          }
          try {
            await this.state.harness.switchThread({ threadId: thread.id });
          } catch (error) {
            if (error instanceof ThreadLockError) {
              this.showThreadLockPrompt(thread.title || thread.id, error.ownerPid);
              resolve();
              return;
            }
            throw error;
          }
          this.state.pendingNewThread = false;

          // Clear chat and render existing messages
          this.state.chatContainer.clear();
          this.state.allToolComponents = [];
          this.state.pendingTools.clear();
          this.state.toolInputBuffers.clear();
          await this.renderExistingMessages();
          this.updateStatusLine();

          this.showInfo(`Switched to: ${thread.title || thread.id}`);
          resolve();
        },
        onCancel: () => {
          this.state.ui.hideOverlay();
          resolve();
        },
      });

      this.state.ui.showOverlay(selector, {
        width: '80%',
        maxHeight: '60%',
        anchor: 'center',
      });
      selector.focused = true;
    });
  }

  // ===========================================================================
  // Thread Tagging
  // ===========================================================================

  private async tagThreadWithDir(): Promise<void> {
    const threadId = this.state.harness.getCurrentThreadId();
    if (!threadId && this.state.pendingNewThread) {
      this.showInfo('No active thread yet — send a message first.');
      return;
    }
    if (!threadId) {
      this.showInfo('No active thread.');
      return;
    }

    const projectPath = (this.state.harness.getState() as any)?.projectPath as string | undefined;
    if (!projectPath) {
      this.showInfo('Could not detect current project path.');
      return;
    }

    const dirName = projectPath.split('/').pop() || projectPath;

    return new Promise<void>(resolve => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question: `Tag this thread with directory "${dirName}"?\n  ${fg('dim', projectPath)}`,
          options: [{ label: 'Yes' }, { label: 'No' }],
          formatResult: answer => (answer === 'Yes' ? `Tagged thread with: ${dirName}` : `Thread not tagged`),
          onSubmit: async answer => {
            this.state.activeInlineQuestion = undefined;
            if (answer.toLowerCase().startsWith('y')) {
              await this.state.harness.setThreadSetting({ key: 'projectPath', value: projectPath });
            }
            resolve();
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.state.ui,
      );

      this.state.activeInlineQuestion = questionComponent;
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(questionComponent);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
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

  // ===========================================================================
  // Sandbox Management
  // ===========================================================================

  private async handleSandboxCommand(args: string[]): Promise<void> {
    const state = this.state.harness.getState() as {
      sandboxAllowedPaths?: string[];
    };
    const currentPaths = state.sandboxAllowedPaths ?? [];

    // If called with args, handle directly (e.g. /sandbox add /some/path)
    const subcommand = args[0]?.toLowerCase();
    if (subcommand === 'add' && args.length > 1) {
      await this.sandboxAddPath(args.slice(1).join(' ').trim());
      return;
    }
    if (subcommand === 'remove' && args.length > 1) {
      await this.sandboxRemovePath(args.slice(1).join(' ').trim(), currentPaths);
      return;
    }

    // Interactive mode — show inline selector
    const options: Array<{ label: string; description?: string }> = [
      { label: 'Add path', description: 'Allow access to another directory' },
    ];

    for (const p of currentPaths) {
      const short = p.split('/').pop() || p;
      options.push({
        label: `Remove: ${short}`,
        description: p,
      });
    }

    const pathsSummary = currentPaths.length
      ? `${currentPaths.length} allowed path${currentPaths.length > 1 ? 's' : ''}`
      : 'no extra paths';

    return new Promise<void>(resolve => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question: `Sandbox settings (${pathsSummary})`,
          options,
          formatResult: answer => {
            if (answer === 'Add path') return 'Adding sandbox path…';
            if (answer.startsWith('Remove: ')) {
              const short = answer.replace('Remove: ', '');
              return `Removed: ${short}`;
            }
            return answer;
          },
          onSubmit: async answer => {
            this.state.activeInlineQuestion = undefined;
            if (answer === 'Add path') {
              resolve();
              await this.showSandboxAddPrompt();
            } else if (answer.startsWith('Remove: ')) {
              const short = answer.replace('Remove: ', '');
              const fullPath = currentPaths.find(p => (p.split('/').pop() || p) === short);
              if (fullPath) {
                await this.sandboxRemovePath(fullPath, currentPaths);
              }
              resolve();
            } else {
              resolve();
            }
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.state.ui,
      );

      this.state.activeInlineQuestion = questionComponent;
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(questionComponent);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
    });
  }

  private async showSandboxAddPrompt(): Promise<void> {
    return new Promise<void>(resolve => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question: 'Enter path to allow',
          formatResult: answer => {
            const resolved = path.resolve(answer);
            return `Added: ${resolved}`;
          },
          onSubmit: async answer => {
            this.state.activeInlineQuestion = undefined;
            await this.sandboxAddPath(answer);
            resolve();
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.state.ui,
      );

      this.state.activeInlineQuestion = questionComponent;
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(questionComponent);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
    });
  }

  private async sandboxAddPath(rawPath: string): Promise<void> {
    const state = this.state.harness.getState() as {
      sandboxAllowedPaths?: string[];
    };
    const currentPaths = state.sandboxAllowedPaths ?? [];
    const resolved = path.resolve(rawPath);

    if (currentPaths.includes(resolved)) {
      this.showInfo(`Path already allowed: ${resolved}`);
      return;
    }
    try {
      await fs.promises.access(resolved);
    } catch {
      this.showError(`Path does not exist: ${resolved}`);
      return;
    }
    const updated = [...currentPaths, resolved];
    this.state.harness.setState({ sandboxAllowedPaths: updated } as any);
    await this.state.harness.setThreadSetting({ key: 'sandboxAllowedPaths', value: updated });
    this.showInfo(`Added to sandbox: ${resolved}`);
  }

  private async sandboxRemovePath(rawPath: string, currentPaths: string[]): Promise<void> {
    const resolved = path.resolve(rawPath);
    const match = currentPaths.find(p => p === resolved || p === rawPath);
    if (!match) {
      this.showError(`Path not in allowed list: ${resolved}`);
      return;
    }
    const updated = currentPaths.filter(p => p !== match);
    this.state.harness.setState({ sandboxAllowedPaths: updated } as any);
    await this.state.harness.setThreadSetting({ key: 'sandboxAllowedPaths', value: updated });
    this.showInfo(`Removed from sandbox: ${match}`);
  }

  // ===========================================================================
  // Skills List
  // ===========================================================================

  /**
   * Get the workspace, preferring harness-owned workspace over the direct option.
   */
  private getResolvedWorkspace(): Workspace | undefined {
    return this.state.harness.getWorkspace() ?? this.state.workspace;
  }

  private async showSkillsList(): Promise<void> {
    const workspace = this.getResolvedWorkspace();
    if (!workspace?.skills) {
      this.showInfo(
        'No skills configured.\n\n' +
          'Add skills to any of these locations:\n' +
          '  .mastracode/skills/   (project-local)\n' +
          '  .claude/skills/       (project-local)\n' +
          '  ~/.mastracode/skills/ (global)\n' +
          '  ~/.claude/skills/     (global)\n\n' +
          'Each skill is a folder with a SKILL.md file.\n' +
          'Install skills: npx add-skill <github-url>',
      );
      return;
    }

    try {
      const skills = await workspace.skills!.list();

      if (skills.length === 0) {
        this.showInfo(
          'No skills found in configured directories.\n\n' +
            'Each skill needs a SKILL.md file with YAML frontmatter.\n' +
            'Install skills: npx add-skill <github-url>',
        );
        return;
      }

      const skillLines = skills.map(skill => {
        const desc = skill.description
          ? ` - ${skill.description.length > 60 ? skill.description.slice(0, 57) + '...' : skill.description}`
          : '';
        return `  ${skill.name}${desc}`;
      });

      this.showInfo(
        `Skills (${skills.length}):\n${skillLines.join('\n')}\n\n` +
          'Skills are automatically activated by the agent when relevant.',
      );
    } catch (error) {
      this.showError(`Failed to list skills: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ===========================================================================
  // Model Selector
  // ===========================================================================

  /**
   * Show mode selector first, then scope (global/thread), then model list.
   * Flow: Mode → Scope → Model
   */
  private async showModelScopeSelector(): Promise<void> {
    const modes = this.state.harness.listModes();
    const currentMode = this.state.harness.getCurrentMode();

    // Sort modes with active mode first
    const sortedModes = [...modes].sort((a, b) => {
      if (a.id === currentMode?.id) return -1;
      if (b.id === currentMode?.id) return 1;
      return 0;
    });

    const modeOptions = sortedModes.map(mode => ({
      label: mode.name + (mode.id === currentMode?.id ? ' (active)' : ''),
      modeId: mode.id,
      modeName: mode.name,
    }));

    return new Promise<void>(resolve => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question: 'Select mode',
          options: modeOptions.map(m => ({ label: m.label })),
          formatResult: answer => {
            const mode = modeOptions.find(m => m.label === answer);
            return `Mode: ${mode?.modeName ?? answer}`;
          },
          onSubmit: async answer => {
            this.state.activeInlineQuestion = undefined;
            const selected = modeOptions.find(m => m.label === answer);
            if (selected?.modeId && selected?.modeName) {
              await this.showModelScopeThenList(selected.modeId, selected.modeName);
            }
            resolve();
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.state.ui,
      );

      this.state.activeInlineQuestion = questionComponent;
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(questionComponent);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
    });
  }

  /**
   * Show scope selector (global/thread) for a specific mode, then model list.
   */
  private async showModelScopeThenList(modeId: string, modeName: string): Promise<void> {
    const scopes = [
      {
        label: 'Thread default',
        description: `Default for ${modeName} mode in this thread`,
        scope: 'thread' as const,
      },
      {
        label: 'Global default',
        description: `Default for ${modeName} mode in all threads`,
        scope: 'global' as const,
      },
    ];

    return new Promise<void>(resolve => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question: `Select scope for ${modeName}`,
          options: scopes.map(s => ({
            label: s.label,
            description: s.description,
          })),
          formatResult: answer => `${modeName} · ${answer}`,
          onSubmit: async answer => {
            this.state.activeInlineQuestion = undefined;
            const selected = scopes.find(s => s.label === answer);
            if (selected) {
              await this.showModelListForScope(selected.scope, modeId, modeName);
            }
            resolve();
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.state.ui,
      );

      this.state.activeInlineQuestion = questionComponent;
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(questionComponent);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
    });
  }

  /**
   * Show the model list for a specific mode and scope.
   */
  private async showModelListForScope(scope: 'global' | 'thread', modeId: string, modeName: string): Promise<void> {
    const availableModels = await this.state.harness.listAvailableModels();

    if (availableModels.length === 0) {
      this.showInfo('No models available. Check your Mastra configuration.');
      return;
    }

    const currentModelId = this.state.harness.getCurrentModelId();
    const scopeLabel = scope === 'global' ? `${modeName} · Global` : `${modeName} · Thread`;

    return new Promise(resolve => {
      const selector = new ModelSelectorComponent({
        tui: this.state.ui,
        models: availableModels,
        currentModelId,
        title: `Select model (${scopeLabel})`,
        onSelect: async (model: ModelItem) => {
          this.state.ui.hideOverlay();
          await this.state.harness.switchModel({ modelId: model.id, scope, modeId });
          this.showInfo(`Model set for ${scopeLabel}: ${model.id}`);
          this.updateStatusLine();
          resolve();
        },
        onCancel: () => {
          this.state.ui.hideOverlay();
          resolve();
        },
      });

      this.state.ui.showOverlay(selector, {
        width: '80%',
        maxHeight: '60%',
        anchor: 'center',
      });
      selector.focused = true;
    });
  }

  /**
   * Show agent type selector first, then scope (global/thread), then model list.
   * Flow: Agent Type → Scope → Model
   */
  private async showSubagentModelSelector(): Promise<void> {
    const agentTypes = [
      {
        id: 'explore',
        label: 'Explore',
        description: 'Read-only codebase exploration',
      },
      {
        id: 'plan',
        label: 'Plan',
        description: 'Read-only analysis and planning',
      },
      {
        id: 'execute',
        label: 'Execute',
        description: 'Task execution with write access',
      },
    ];

    return new Promise<void>(resolve => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question: 'Select subagent type',
          options: agentTypes.map(t => ({
            label: t.label,
            description: t.description,
          })),
          formatResult: answer => `Subagent: ${answer}`,
          onSubmit: async answer => {
            this.state.activeInlineQuestion = undefined;
            const selected = agentTypes.find(t => t.label === answer);
            if (selected) {
              await this.showSubagentScopeThenList(selected.id, selected.label);
            }
            resolve();
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.state.ui,
      );

      this.state.activeInlineQuestion = questionComponent;
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(questionComponent);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
    });
  }

  /**
   * Show scope selector (global/thread) for a specific agent type, then model list.
   */
  private async showSubagentScopeThenList(agentType: string, agentTypeLabel: string): Promise<void> {
    const scopes = [
      {
        label: 'Thread default',
        description: `Default for ${agentTypeLabel} subagents in this thread`,
        scope: 'thread' as const,
      },
      {
        label: 'Global default',
        description: `Default for ${agentTypeLabel} subagents in all threads`,
        scope: 'global' as const,
      },
    ];

    return new Promise<void>(resolve => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question: `Select scope for ${agentTypeLabel} subagents`,
          options: scopes.map(s => ({
            label: s.label,
            description: s.description,
          })),
          formatResult: answer => `${agentTypeLabel} · ${answer}`,
          onSubmit: async answer => {
            this.state.activeInlineQuestion = undefined;
            const selected = scopes.find(s => s.label === answer);
            if (selected) {
              await this.showSubagentModelListForScope(selected.scope, agentType, agentTypeLabel);
            }
            resolve();
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.state.ui,
      );

      this.state.activeInlineQuestion = questionComponent;
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(questionComponent);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
    });
  }

  /**
   * Show the model list for subagent type and scope selection.
   */
  private async showSubagentModelListForScope(
    scope: 'global' | 'thread',
    agentType: string,
    agentTypeLabel: string,
  ): Promise<void> {
    const availableModels = await this.state.harness.listAvailableModels();

    if (availableModels.length === 0) {
      this.showInfo('No models available. Check your Mastra configuration.');
      return;
    }

    // Get current subagent model if set
    const currentSubagentModel = await this.state.harness.getSubagentModelId({ agentType });
    const scopeLabel = scope === 'global' ? `${agentTypeLabel} · Global` : `${agentTypeLabel} · Thread`;

    return new Promise(resolve => {
      const selector = new ModelSelectorComponent({
        tui: this.state.ui,
        models: availableModels,
        currentModelId: currentSubagentModel ?? undefined,
        title: `Select subagent model (${scopeLabel})`,
        onSelect: async (model: ModelItem) => {
          this.state.ui.hideOverlay();
          await this.state.harness.setSubagentModelId({ modelId: model.id, agentType });
          if (scope === 'global') {
            if (this.state.authStorage) {
              this.state.authStorage.setSubagentModelId(model.id, agentType);
              this.showInfo(`Subagent model set for ${scopeLabel}: ${model.id}`);
            } else {
              this.showError('Cannot persist global preference: auth storage not configured');
            }
          } else {
            this.showInfo(`Subagent model set for ${scopeLabel}: ${model.id}`);
          }
          resolve();
        },
        onCancel: () => {
          this.state.ui.hideOverlay();
          resolve();
        },
      });

      this.state.ui.showOverlay(selector, {
        width: '80%',
        maxHeight: '60%',
        anchor: 'center',
      });
      selector.focused = true;
    });
  }

  // ===========================================================================
  // Observational Memory Settings
  // ===========================================================================

  private async showOMSettings(): Promise<void> {
    // Get available models for the model submenus
    const availableModels = await this.state.harness.listAvailableModels();
    const modelOptions = availableModels.map(m => ({
      id: m.id,
      label: m.id,
    }));

    const config = {
      observerModelId: this.state.harness.getObserverModelId(),
      reflectorModelId: this.state.harness.getReflectorModelId(),
      observationThreshold: this.state.harness.getObservationThreshold(),
      reflectionThreshold: this.state.harness.getReflectionThreshold(),
    };

    return new Promise<void>(resolve => {
      const settings = new OMSettingsComponent(
        config,
        {
          onObserverModelChange: async modelId => {
            await this.state.harness.switchObserverModel({ modelId });
            this.showInfo(`Observer model → ${modelId}`);
          },
          onReflectorModelChange: async modelId => {
            await this.state.harness.switchReflectorModel({ modelId });
            this.showInfo(`Reflector model → ${modelId}`);
          },
          onObservationThresholdChange: value => {
            this.state.harness.setState({ observationThreshold: value } as any);
            this.state.omProgress.threshold = value;
            this.state.omProgress.thresholdPercent =
              value > 0 ? (this.state.omProgress.pendingTokens / value) * 100 : 0;
            this.updateStatusLine();
          },
          onReflectionThresholdChange: value => {
            this.state.harness.setState({ reflectionThreshold: value } as any);
            this.state.omProgress.reflectionThreshold = value;
            this.state.omProgress.reflectionThresholdPercent =
              value > 0 ? (this.state.omProgress.observationTokens / value) * 100 : 0;
            this.updateStatusLine();
          },
          onClose: () => {
            this.state.ui.hideOverlay();
            this.updateStatusLine();
            resolve();
          },
        },
        modelOptions,
        this.state.ui,
      );

      this.state.ui.showOverlay(settings, {
        width: '80%',
        maxHeight: '70%',
        anchor: 'center',
      });
      settings.focused = true;
    });
  }
  // ===========================================================================
  // General Settings
  // ===========================================================================
  private async showPermissions(): Promise<void> {
    const { TOOL_CATEGORIES, getToolsForCategory } = await import('../permissions.js');
    const rules = this.state.harness.getPermissionRules();
    const grants = this.state.harness.getSessionGrants();
    const isYolo = (this.state.harness.getState() as any).yolo === true;

    const lines: string[] = [];
    lines.push('Tool Approval Permissions');
    lines.push('─'.repeat(40));

    if (isYolo) {
      lines.push('');
      lines.push('⚡ YOLO mode is ON — all tools are auto-approved');
      lines.push('  Use /yolo to toggle off');
    }

    lines.push('');
    lines.push('Category Policies:');
    for (const [cat, meta] of Object.entries(TOOL_CATEGORIES)) {
      const policy = rules.categories[cat as keyof typeof rules.categories] || 'ask';
      const sessionGranted = grants.categories.includes(cat as any);
      const tools = getToolsForCategory(cat as any);
      const status = sessionGranted ? `${policy} (session: always allow)` : policy;
      lines.push(`  ${meta.label.padEnd(12)} ${status.padEnd(16)} tools: ${tools.join(', ')}`);
    }

    if (Object.keys(rules.tools).length > 0) {
      lines.push('');
      lines.push('Per-tool Overrides:');
      for (const [tool, policy] of Object.entries(rules.tools)) {
        lines.push(`  ${tool.padEnd(24)} ${policy}`);
      }
    }

    if (grants.categories.length > 0 || grants.tools.length > 0) {
      lines.push('');
      lines.push('Session Grants (reset on restart):');
      if (grants.categories.length > 0) {
        lines.push(`  Categories: ${grants.categories.join(', ')}`);
      }
      if (grants.tools.length > 0) {
        lines.push(`  Tools: ${grants.tools.join(', ')}`);
      }
    }

    lines.push('');
    lines.push('Commands:');
    lines.push('  /permissions set <category> <allow|ask|deny>');
    lines.push('  /yolo — toggle auto-approve all tools');

    this.showInfo(lines.join('\n'));
  }

  private async showSettings(): Promise<void> {
    const state = this.state.harness.getState() as any;
    const config = {
      notifications: (state?.notifications ?? 'off') as NotificationMode,
      yolo: state?.yolo === true,
      thinkingLevel: (state?.thinkingLevel ?? 'off') as string,
      escapeAsCancel: this.state.editor.escapeEnabled,
    };

    return new Promise<void>(resolve => {
      const settings = new SettingsComponent(config, {
        onNotificationsChange: async mode => {
          await this.state.harness.setState({ notifications: mode });
          this.showInfo(`Notifications: ${mode}`);
        },
        onYoloChange: enabled => {
          this.state.harness.setState({ yolo: enabled } as any);
          this.updateStatusLine();
        },
        onThinkingLevelChange: async level => {
          await this.state.harness.setState({ thinkingLevel: level } as any);
          this.updateStatusLine();
        },
        onEscapeAsCancelChange: async enabled => {
          this.state.editor.escapeEnabled = enabled;
          await this.state.harness.setState({ escapeAsCancel: enabled });
          await this.state.harness.setThreadSetting({ key: 'escapeAsCancel', value: enabled });
        },
        onClose: () => {
          this.state.ui.hideOverlay();
          resolve();
        },
      });

      this.state.ui.showOverlay(settings, {
        width: '60%',
        maxHeight: '50%',
        anchor: 'center',
      });
      settings.focused = true;
    });
  }
  // ===========================================================================
  // Login Selector
  // ===========================================================================

  private async showLoginSelector(mode: 'login' | 'logout'): Promise<void> {
    const allProviders = getOAuthProviders();
    const loggedInIds = allProviders.filter(p => this.state.authStorage?.isLoggedIn(p.id)).map(p => p.id);

    if (mode === 'logout') {
      if (loggedInIds.length === 0) {
        this.showInfo('No OAuth providers logged in. Use /login first.');
        return;
      }
    }

    const providers = mode === 'logout' ? allProviders.filter(p => loggedInIds.includes(p.id)) : allProviders;

    if (providers.length === 0) {
      this.showInfo('No OAuth providers available.');
      return;
    }

    const action = mode === 'login' ? 'Log in to' : 'Log out from';

    return new Promise<void>(resolve => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question: `${action} which provider?`,
          options: providers.map(p => ({
            label: p.name,
            description: loggedInIds.includes(p.id) ? '(logged in)' : '',
          })),
          formatResult: answer => (mode === 'login' ? `Logging in to ${answer}…` : `Logged out from ${answer}`),
          onSubmit: async answer => {
            this.state.activeInlineQuestion = undefined;
            const provider = providers.find(p => p.name === answer);
            if (provider) {
              if (mode === 'login') {
                await this.performLogin(provider.id);
              } else {
                if (this.state.authStorage) {
                  this.state.authStorage.logout(provider.id);
                  this.showInfo(`Logged out from ${provider.name}`);
                } else {
                  this.showError('Auth storage not configured');
                }
              }
            }
            resolve();
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.state.ui,
      );

      this.state.activeInlineQuestion = questionComponent;
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(questionComponent);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
    });
  }

  private async performLogin(providerId: string): Promise<void> {
    const provider = getOAuthProviders().find(p => p.id === providerId);
    const providerName = provider?.name || providerId;

    if (!this.state.authStorage) {
      this.showError('Auth storage not configured');
      return;
    }

    return new Promise(resolve => {
      const dialog = new LoginDialogComponent(this.state.ui, providerId, (success, message) => {
        this.state.ui.hideOverlay();
        if (success) {
          this.showInfo(`Successfully logged in to ${providerName}`);
        } else if (message) {
          this.showInfo(message);
        }
        resolve();
      });

      // Show as overlay - same size as model selector
      this.state.ui.showOverlay(dialog, {
        width: '80%',
        maxHeight: '60%',
        anchor: 'center',
      });
      dialog.focused = true;

      this.state.authStorage
        .login(providerId, {
          onAuth: (info: { url: string; instructions?: string }) => {
            dialog.showAuth(info.url, info.instructions);
          },
          onPrompt: async (prompt: { message: string; placeholder?: string }) => {
            return dialog.showPrompt(prompt.message, prompt.placeholder);
          },
          onProgress: (message: string) => {
            dialog.showProgress(message);
          },
          signal: dialog.signal,
        })
        .then(async () => {
          this.state.ui.hideOverlay();

          // Auto-switch to the provider's default model
          const defaultModel = this.state.authStorage?.getDefaultModelForProvider(providerId as any);
          if (defaultModel) {
            await this.state.harness.switchModel({ modelId: defaultModel });
            this.updateStatusLine();
            this.showInfo(`Logged in to ${providerName} - switched to ${defaultModel}`);
          } else {
            this.showInfo(`Successfully logged in to ${providerName}`);
          }

          resolve();
        })
        .catch((error: Error) => {
          this.state.ui.hideOverlay();
          if (error.message !== 'Login cancelled') {
            this.showError(`Failed to login: ${error.message}`);
          }
          resolve();
        });
    });
  }

  // ===========================================================================
  // Cost Tracking
  // ===========================================================================

  private async showCostBreakdown(): Promise<void> {
    // Format the breakdown
    const formatNumber = (n: number) => n.toLocaleString();

    // Get OM token usage if available
    let omTokensText = '';
    if (this.state.omProgress.observationTokens > 0) {
      omTokensText = `
  Memory:     ${formatNumber(this.state.omProgress.observationTokens)} tokens`;
    }

    this.showInfo(`Token Usage (Current Thread):
  Input:      ${formatNumber(this.state.tokenUsage.promptTokens)} tokens
  Output:     ${formatNumber(this.state.tokenUsage.completionTokens)} tokens${omTokensText}
  ─────────────────────────────────────────
  Total:      ${formatNumber(this.state.tokenUsage.totalTokens)} tokens
  
  Note: For cost estimates, check your provider's pricing page.`);
  }

  // ===========================================================================
  // Slash Commands
  // ===========================================================================

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

    switch (command) {
      case 'new': {
        // Defer thread creation until first message
        this.state.pendingNewThread = true;
        this.state.chatContainer.clear();
        this.state.pendingTools.clear();
        this.state.toolInputBuffers.clear();
        this.state.allToolComponents = [];
        this.state.modifiedFiles.clear();
        this.state.pendingFileTools.clear();
        if (this.state.taskProgress) {
          this.state.taskProgress.updateTasks([]);
        }
        this.state.previousTasks = [];
        this.state.taskWriteInsertIndex = -1;
        this.resetStatusLineState();
        this.state.ui.requestRender();
        this.showInfo('Ready for new conversation');
        return true;
      }

      case 'threads': {
        await this.showThreadSelector();
        return true;
      }

      case 'skills': {
        await this.showSkillsList();
        return true;
      }

      case 'thread:tag-dir': {
        await this.tagThreadWithDir();
        return true;
      }

      case 'sandbox': {
        await this.handleSandboxCommand(args);
        return true;
      }

      case 'mode': {
        const modes = this.state.harness.listModes();
        if (modes.length <= 1) {
          this.showInfo('Only one mode available');
          return true;
        }
        if (args[0]) {
          await this.state.harness.switchMode({ modeId: args[0] });
        } else {
          const currentMode = this.state.harness.getCurrentMode();
          const modeList = modes
            .map(m => `  ${m.id === currentMode?.id ? '* ' : '  '}${m.id}${m.name ? ` - ${m.name}` : ''}`)
            .join('\n');
          this.showInfo(`Modes:
${modeList}`);
        }
        return true;
      }

      case 'models': {
        await this.showModelScopeSelector();
        return true;
      }

      case 'subagents': {
        await this.showSubagentModelSelector();
        return true;
      }

      case 'om': {
        await this.showOMSettings();
        return true;
      }
      case 'think': {
        const currentLevel = ((this.state.harness.getState() as any)?.thinkingLevel ?? 'off') as string;
        const levels = [
          { label: 'Off', id: 'off' },
          { label: 'Minimal', id: 'minimal' },
          { label: 'Low', id: 'low' },
          { label: 'Medium', id: 'medium' },
          { label: 'High', id: 'high' },
        ];
        const currentIdx = levels.findIndex(l => l.id === currentLevel);
        const nextIdx = (currentIdx + 1) % levels.length;
        const next = levels[nextIdx]!;
        await this.state.harness.setState({ thinkingLevel: next.id } as any);
        this.showInfo(`Thinking: ${next.label}`);
        this.updateStatusLine();
        return true;
      }
      case 'permissions': {
        if (args[0] === 'set' && args.length >= 3) {
          const category = args[1] as any;
          const policy = args[2] as any;
          const validCategories = ['read', 'edit', 'execute', 'mcp'];
          const validPolicies = ['allow', 'ask', 'deny'];
          if (!validCategories.includes(category)) {
            this.showInfo(`Invalid category: ${category}. Must be one of: ${validCategories.join(', ')}`);
            return true;
          }
          if (!validPolicies.includes(policy)) {
            this.showInfo(`Invalid policy: ${policy}. Must be one of: ${validPolicies.join(', ')}`);
            return true;
          }
          this.state.harness.setPermissionForCategory({ category, policy });
          this.showInfo(`Set ${category} policy to: ${policy}`);
          return true;
        }
        await this.showPermissions();
        return true;
      }
      case 'yolo': {
        const current = (this.state.harness.getState() as any).yolo === true;
        this.state.harness.setState({ yolo: !current } as any);
        this.showInfo(!current ? 'YOLO mode ON — tools auto-approved' : 'YOLO mode OFF — tools require approval');
        this.updateStatusLine();
        return true;
      }
      case 'settings': {
        await this.showSettings();
        return true;
      }

      case 'login': {
        await this.showLoginSelector('login');
        return true;
      }

      case 'logout': {
        await this.showLoginSelector('logout');
        return true;
      }
      case 'cost': {
        await this.showCostBreakdown();
        return true;
      }

      case 'diff': {
        await this.showDiff(args[0]);
        return true;
      }

      case 'name': {
        const title = args.join(' ').trim();
        if (!title) {
          this.showInfo('Usage: /name <title>');
          return true;
        }
        if (!this.state.harness.getCurrentThreadId()) {
          this.showInfo('No active thread. Send a message first.');
          return true;
        }
        await this.state.harness.renameThread({ title });
        this.showInfo(`Thread renamed to: ${title}`);
        return true;
      }
      case 'resource': {
        const sub = args[0]?.trim();
        const current = this.state.harness.getResourceId();
        const defaultId = this.state.harness.getDefaultResourceId();

        if (!sub) {
          // Show current resource ID and list known ones
          const knownIds = await this.state.harness.getKnownResourceIds();
          const isOverridden = current !== defaultId;
          const lines = [
            `Current: ${current}${isOverridden ? ` (auto-detected: ${defaultId})` : ''}`,
            '',
            'Known resource IDs:',
            ...knownIds.map(id => `  ${id === current ? '* ' : '  '}${id}`),
            '',
            'Usage:',
            '  /resource <id>    - Switch to a resource ID',
            '  /resource reset   - Reset to auto-detected ID',
          ];
          this.showInfo(lines.join('\n'));
        } else if (sub === 'reset') {
          this.state.harness.setResourceId({ resourceId: defaultId });
          this.state.pendingNewThread = true;
          this.state.chatContainer.clear();
          this.state.pendingTools.clear();
          this.state.toolInputBuffers.clear();
          this.state.allToolComponents = [];
          this.resetStatusLineState();
          this.state.ui.requestRender();
          this.showInfo(`Resource ID reset to: ${defaultId}`);
        } else {
          const newId = args.join(' ').trim();
          this.state.harness.setResourceId({ resourceId: newId });
          this.state.pendingNewThread = true;
          this.state.chatContainer.clear();
          this.state.pendingTools.clear();
          this.state.toolInputBuffers.clear();
          this.state.allToolComponents = [];
          this.resetStatusLineState();
          this.state.ui.requestRender();
          this.showInfo(`Switched to resource: ${newId}`);
        }
        return true;
      }

      case 'exit':
        this.stop();
        process.exit(0);

      case 'help': {
        const modes = this.state.harness.listModes();
        const modeHelp = modes.length > 1 ? '\n/mode     - Switch or list modes' : '';

        // Build custom commands help
        let customCommandsHelp = '';
        if (this.state.customSlashCommands.length > 0) {
          customCommandsHelp =
            '\n\nCustom commands (use // prefix):\n' +
            this.state.customSlashCommands
              .map(cmd => `  //${cmd.name.padEnd(8)} - ${cmd.description || 'No description'}`)
              .join('\n');
        }

        this.showInfo(`Available commands:
  /new       - Start a new thread
  /threads       - Switch between threads
  /thread:tag-dir - Tag thread with current directory
  /name          - Rename current thread
  /resource      - Show/switch resource ID (tag for sharing)
  /skills        - List available skills
  /models    - Configure model (global/thread/mode)
  /subagents - Configure subagent model defaults
  /permissions - View/manage tool approval permissions
  /settings - General settings (notifications, YOLO, thinking)
  /om       - Configure Observational Memory
  /review   - Review a GitHub pull request
  /cost     - Show token usage and estimated costs
  /diff     - Show modified files or git diff for a path
  /sandbox  - Manage sandbox allowed paths
  /hooks    - Show/reload configured hooks
  /mcp      - Show/reload MCP server connections
  /login    - Login with OAuth provider
  /logout   - Logout from OAuth provider${modeHelp}
  /exit     - Exit the TUI
  /help     - Show this help${customCommandsHelp}

Shell:
  !<cmd>    - Run a shell command directly (e.g., !ls -la)

Keyboard shortcuts:
  Ctrl+C    - Interrupt agent / clear input
  Ctrl+C×2  - Exit process (double-tap)
  Ctrl+D    - Exit (when editor is empty)
  Enter     - While working: steer (interrupt + redirect)
  Ctrl+F    - While working: queue follow-up message
  Shift+Tab - Cycle agent modes
  Ctrl+T    - Toggle thinking blocks
  Ctrl+E    - Expand/collapse tool outputs`);
        return true;
      }

      case 'hooks': {
        const hm = this.state.hookManager;
        if (!hm) {
          this.showInfo('Hooks system not initialized.');
          return true;
        }

        const subcommand = args[0];
        if (subcommand === 'reload') {
          hm.reload();
          this.showInfo('Hooks config reloaded.');
          return true;
        }

        const paths = hm.getConfigPaths();

        if (!hm.hasHooks()) {
          this.showInfo(
            `No hooks configured.\n\n` +
              `Add hooks to:\n` +
              `  ${paths.project} (project)\n` +
              `  ${paths.global} (global)\n\n` +
              `Example hooks.json:\n` +
              `  {\n` +
              `    "PreToolUse": [{\n` +
              `      "type": "command",\n` +
              `      "command": "echo 'tool called'",\n` +
              `      "matcher": { "tool_name": "execute_command" }\n` +
              `    }]\n` +
              `  }`,
          );
          return true;
        }

        const hookConfig = hm.getConfig();
        const lines: string[] = [`Hooks Configuration:`];
        lines.push(`  Project: ${paths.project}`);
        lines.push(`  Global:  ${paths.global}`);
        lines.push('');

        const eventNames = [
          'PreToolUse',
          'PostToolUse',
          'Stop',
          'UserPromptSubmit',
          'SessionStart',
          'SessionEnd',
        ] as const;

        for (const event of eventNames) {
          const hooks = hookConfig[event];
          if (hooks && hooks.length > 0) {
            lines.push(`  ${event} (${hooks.length} hook${hooks.length > 1 ? 's' : ''}):`);
            for (const hook of hooks) {
              const matcherStr = hook.matcher?.tool_name ? ` [tool: ${hook.matcher.tool_name}]` : '';
              const desc = hook.description ? ` - ${hook.description}` : '';
              lines.push(`    ${hook.command}${matcherStr}${desc}`);
            }
          }
        }

        lines.push('');
        lines.push(`  /hooks reload - Reload config from disk`);

        this.showInfo(lines.join('\n'));
        return true;
      }

      case 'mcp': {
        const mm = this.state.mcpManager;
        if (!mm) {
          this.showInfo('MCP system not initialized.');
          return true;
        }

        const subcommand = args[0];
        if (subcommand === 'reload') {
          this.showInfo('MCP: Reconnecting to servers...');
          try {
            await mm.reload();
            const statuses = mm.getServerStatuses();
            const connected = statuses.filter(s => s.connected);
            const totalTools = connected.reduce((sum, s) => sum + s.toolCount, 0);
            this.showInfo(`MCP: Reloaded. ${connected.length} server(s) connected, ${totalTools} tool(s).`);
          } catch (error) {
            this.showError(`MCP reload failed: ${error instanceof Error ? error.message : String(error)}`);
          }
          return true;
        }

        const paths = mm.getConfigPaths();

        if (!mm.hasServers()) {
          this.showInfo(
            `No MCP servers configured.\n\n` +
              `Add servers to:\n` +
              `  ${paths.project} (project)\n` +
              `  ${paths.global} (global)\n` +
              `  ${paths.claude} (Claude Code compat)\n\n` +
              `Example mcp.json:\n` +
              `  {\n` +
              `    "mcpServers": {\n` +
              `      "filesystem": {\n` +
              `        "command": "npx",\n` +
              `        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],\n` +
              `        "env": {}\n` +
              `      }\n` +
              `    }\n` +
              `  }`,
          );
          return true;
        }

        const statuses = mm.getServerStatuses();
        const lines: string[] = [`MCP Servers:`];
        lines.push(`  Project: ${paths.project}`);
        lines.push(`  Global:  ${paths.global}`);
        lines.push(`  Claude:  ${paths.claude}`);
        lines.push('');

        for (const status of statuses) {
          const icon = status.connected ? '\u2713' : '\u2717';
          const state = status.connected ? 'connected' : `error: ${status.error}`;
          lines.push(`  ${icon} ${status.name} (${state})`);
          if (status.toolNames.length > 0) {
            for (const toolName of status.toolNames) {
              lines.push(`      - ${toolName}`);
            }
          }
        }

        lines.push('');
        lines.push(`  /mcp reload - Disconnect and reconnect all servers`);

        this.showInfo(lines.join('\n'));
        return true;
      }
      case 'review': {
        await this.handleReviewCommand(args);
        return true;
      }

      default: {
        // Fall back to custom commands for single-slash input
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
   * Handle the /review command — send a PR review prompt to the agent.
   * With no args: lists open PRs. With a PR number: reviews that PR.
   */
  private async handleReviewCommand(args: string[]): Promise<void> {
    if (!this.state.harness.hasModelSelected()) {
      this.showInfo('No model selected. Use /models to select a model, or /login to authenticate.');
      return;
    }

    // Ensure thread exists
    if (this.state.pendingNewThread) {
      await this.state.harness.createThread();
      this.state.pendingNewThread = false;
      this.updateStatusLine();
    }

    const prNumber = args[0];
    const focusArea = args.slice(1).join(' ');

    let prompt: string;

    if (!prNumber) {
      // No PR specified — list open PRs and ask
      prompt =
        `List the open pull requests for this repository using \`gh pr list --limit 20\`. ` +
        `Present them in a clear table with PR number, title, and author. ` +
        `Then ask me which PR I'd like you to review.`;
    } else {
      // PR number given — do a thorough review
      prompt =
        `Do a thorough code review of PR #${prNumber}. Follow these steps:\n\n` +
        `1. Run \`gh pr view ${prNumber}\` to get the PR description and metadata.\n` +
        `2. Run \`gh pr diff ${prNumber}\` to get the full diff.\n` +
        `3. Run \`gh pr checks ${prNumber}\` to check CI status.\n` +
        `4. Read any relevant source files for full context on the changes.\n` +
        `5. Provide a detailed code review covering:\n` +
        `   - Overview of what the PR does\n` +
        `   - Root cause analysis (if it's a fix)\n` +
        `   - Code quality assessment\n` +
        `   - Potential concerns or edge cases\n` +
        `   - CI status\n` +
        `   - Suggestions for improvement\n` +
        `   - Final verdict (approve/request changes/comment)\n`;

      if (focusArea) {
        prompt += `\nPay special attention to: ${focusArea}\n`;
      }
    }

    // Show what's happening
    this.addUserMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: [
        {
          type: 'text',
          text: prNumber ? `/review ${args.join(' ')}` : '/review',
        },
      ],
      createdAt: new Date(),
    });
    this.state.ui.requestRender();

    // Send to the agent
    this.state.harness.sendMessage({ content: prompt }).catch(error => {
      this.showError(error instanceof Error ? error.message : 'Review failed');
    });
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
  // Message Rendering
  // ===========================================================================

  private addUserMessage(message: HarnessMessage): void {
    const textContent = message.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('\n');

    const imageCount = message.content.filter(c => c.type === 'image').length;

    // Strip [image] markers from text since we show count separately
    const displayText = imageCount > 0 ? textContent.replace(/\[image\]\s*/g, '').trim() : textContent.trim();
    // Check for system reminder tags
    const systemReminderMatch = displayText.match(/<system-reminder>([\s\S]*?)<\/system-reminder>/);
    if (systemReminderMatch) {
      const reminderText = systemReminderMatch[1]!.trim();
      const reminderComponent = new SystemReminderComponent({
        message: reminderText,
      });

      // System reminders always go at the end (after plan approval)
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(reminderComponent);
      this.state.ui.requestRender();
      return;
    }

    // Check for slash command tags
    const slashCommandMatch = displayText.match(/<slash-command\s+name="([^"]*)">([\s\S]*?)<\/slash-command>/);
    if (slashCommandMatch) {
      const commandName = slashCommandMatch[1]!;
      const commandContent = slashCommandMatch[2]!.trim();
      const slashComp = new SlashCommandComponent(commandName, commandContent);
      this.state.allSlashCommandComponents.push(slashComp);
      this.state.chatContainer.addChild(slashComp);
      this.state.ui.requestRender();
      return;
    }

    const prefix = imageCount > 0 ? `[${imageCount} image${imageCount > 1 ? 's' : ''}] ` : '';
    if (displayText || prefix) {
      const userComponent = new UserMessageComponent(prefix + displayText);

      // Always append to end — follow-ups should stay at the bottom
      this.state.chatContainer.addChild(userComponent);

      // Track follow-up components sent while streaming so tool calls
      // can be inserted before them (keeping them anchored at bottom).
      // Only track if the agent is already streaming a response — otherwise
      // this is the initial message that triggers the response, not a follow-up.
      if (this.state.isAgentActive && this.state.streamingComponent) {
        this.state.followUpComponents.push(userComponent);
      }
    }
  }

  private async renderExistingMessages(): Promise<void> {
    this.state.chatContainer.clear();
    this.state.pendingTools.clear();
    this.state.toolInputBuffers.clear();
    this.state.allToolComponents = [];

    const messages = await this.state.harness.listMessages({ limit: 40 });

    for (const message of messages) {
      if (message.role === 'user') {
        this.addUserMessage(message);
      } else if (message.role === 'assistant') {
        // Render content in order - interleaving text and tool calls
        // Accumulate text/thinking until we hit a tool call, then render both
        let accumulatedContent: HarnessMessageContent[] = [];

        for (const content of message.content) {
          if (content.type === 'text' || content.type === 'thinking') {
            accumulatedContent.push(content);
          } else if (content.type === 'tool_call') {
            // Render accumulated text first if any
            if (accumulatedContent.length > 0) {
              const textMessage: HarnessMessage = {
                ...message,
                content: accumulatedContent,
              };
              const textComponent = new AssistantMessageComponent(
                textMessage,
                this.state.hideThinkingBlock,
                getMarkdownTheme(),
              );
              this.state.chatContainer.addChild(textComponent);
              accumulatedContent = [];
            }

            // Find matching tool result
            const toolResult = message.content.find(c => c.type === 'tool_result' && c.id === content.id);

            // Render subagent tool calls with dedicated component
            if (content.name === 'subagent') {
              const subArgs = content.args as
                | {
                    agentType?: string;
                    task?: string;
                    modelId?: string;
                  }
                | undefined;
              const rawResult =
                toolResult?.type === 'tool_result' ? this.formatToolResult(toolResult.result) : undefined;
              const isErr = toolResult?.type === 'tool_result' && toolResult.isError;

              // Parse embedded metadata for model ID, duration, tool calls
              const meta = rawResult ? parseSubagentMeta(rawResult) : null;
              const resultText = meta?.text ?? rawResult;
              const modelId = meta?.modelId ?? subArgs?.modelId;
              const durationMs = meta?.durationMs ?? 0;

              const subComponent = new SubagentExecutionComponent(
                subArgs?.agentType ?? 'unknown',
                subArgs?.task ?? '',
                this.state.ui,
                modelId,
              );
              // Populate tool calls from metadata
              if (meta?.toolCalls) {
                for (const tc of meta.toolCalls) {
                  subComponent.addToolStart(tc.name, {});
                  subComponent.addToolEnd(tc.name, '', tc.isError);
                }
              }
              // Mark as finished with result
              subComponent.finish(isErr ?? false, durationMs, resultText);
              this.state.chatContainer.addChild(subComponent);
              this.state.allToolComponents.push(subComponent as any);
              continue;
            }

            // Render the tool call
            const toolComponent = new ToolExecutionComponentEnhanced(
              content.name,
              content.args,
              {
                showImages: false,
                collapsedByDefault: !this.state.toolOutputExpanded,
              },
              this.state.ui,
            );

            if (toolResult && toolResult.type === 'tool_result') {
              toolComponent.updateResult(
                {
                  content: [
                    {
                      type: 'text',
                      text: this.formatToolResult(toolResult.result),
                    },
                  ],
                  isError: toolResult.isError,
                },
                false,
              );
            }

            // If this was task_write with all completed or cleared, show inline instead of tool component
            let replacedWithInline = false;
            if (content.name === 'task_write' && toolResult?.type === 'tool_result' && !toolResult.isError) {
              const args = content.args as { tasks?: TaskItem[] } | undefined;
              const tasks = args?.tasks;
              if (tasks && tasks.length > 0 && tasks.every(t => t.status === 'completed')) {
                this.renderCompletedTasksInline(tasks);
                replacedWithInline = true;
              } else if (!tasks || tasks.length === 0) {
                // Tasks were cleared - show with previous tasks if we have them
                if (this.state.previousTasks.length > 0) {
                  this.renderClearedTasksInline(this.state.previousTasks);
                  this.state.previousTasks = [];
                  replacedWithInline = true;
                }
              } else {
                // Track for detecting clears
                this.state.previousTasks = [...tasks];
              }
            }

            // If this was submit_plan, show the plan with approval status
            if (content.name === 'submit_plan' && toolResult?.type === 'tool_result') {
              const args = content.args as { title?: string; plan?: string } | undefined;
              // Result could be a string or an object with content property
              let resultText = '';
              if (typeof toolResult.result === 'string') {
                resultText = toolResult.result;
              } else if (
                typeof toolResult.result === 'object' &&
                toolResult.result !== null &&
                'content' in toolResult.result &&
                typeof (toolResult.result as any).content === 'string'
              ) {
                resultText = (toolResult.result as any).content;
              }
              const isApproved = resultText.toLowerCase().includes('approved');
              // Extract feedback if rejected with feedback
              let feedback: string | undefined;
              if (!isApproved && resultText.includes('Feedback:')) {
                const feedbackMatch = resultText.match(/Feedback:\s*(.+)/);
                feedback = feedbackMatch?.[1];
              }

              if (args?.title && args?.plan) {
                const planResult = new PlanResultComponent({
                  title: args.title,
                  plan: args.plan,
                  isApproved,
                  feedback,
                });
                this.state.chatContainer.addChild(planResult);
                replacedWithInline = true;
              }
            }

            if (!replacedWithInline) {
              this.state.chatContainer.addChild(toolComponent);
              this.state.allToolComponents.push(toolComponent);
            }
          } else if (
            content.type === 'om_observation_start' ||
            content.type === 'om_observation_end' ||
            content.type === 'om_observation_failed'
          ) {
            // Skip start markers in history — only show completed/failed results
            if (content.type === 'om_observation_start') continue;

            // Render accumulated text first if any
            if (accumulatedContent.length > 0) {
              const textMessage: HarnessMessage = {
                ...message,
                content: accumulatedContent,
              };
              const textComponent = new AssistantMessageComponent(
                textMessage,
                this.state.hideThinkingBlock,
                getMarkdownTheme(),
              );
              this.state.chatContainer.addChild(textComponent);
              accumulatedContent = [];
            }

            if (content.type === 'om_observation_end') {
              // Render bordered output box with marker info in footer
              const isReflection = content.operationType === 'reflection';
              const outputComponent = new OMOutputComponent({
                type: isReflection ? 'reflection' : 'observation',
                observations: content.observations ?? '',
                currentTask: content.currentTask,
                suggestedResponse: content.suggestedResponse,
                durationMs: content.durationMs,
                tokensObserved: content.tokensObserved,
                observationTokens: content.observationTokens,
                compressedTokens: isReflection ? content.observationTokens : undefined,
              });
              this.state.chatContainer.addChild(outputComponent);
            } else {
              // Failed marker
              this.state.chatContainer.addChild(new OMMarkerComponent(content));
            }
          }
          // Skip tool_result - it's handled with tool_call above
        }

        // Render any remaining text after the last tool call
        if (accumulatedContent.length > 0) {
          const textMessage: HarnessMessage = {
            ...message,
            content: accumulatedContent,
          };
          const textComponent = new AssistantMessageComponent(
            textMessage,
            this.state.hideThinkingBlock,
            getMarkdownTheme(),
          );
          this.state.chatContainer.addChild(textComponent);
        }
      }
    }

    // Restore pinned task list from the last active task_write in history
    if (this.state.previousTasks.length > 0 && this.state.taskProgress) {
      this.state.taskProgress.updateTasks(this.state.previousTasks);
    }

    this.state.ui.requestRender();
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
   * Show file changes tracked during this session.
   * With no args: shows summary of all modified files.
   * With a path: shows git diff for that specific file.
   */
  private async showDiff(filePath?: string): Promise<void> {
    if (filePath) {
      // Show git diff for a specific file
      try {
        const { execa } = await import('execa');
        const result = await execa('git', ['diff', filePath], {
          cwd: process.cwd(),
          reject: false,
        });

        if (!result.stdout.trim()) {
          // Try staged diff
          const staged = await execa('git', ['diff', '--cached', filePath], {
            cwd: process.cwd(),
            reject: false,
          });
          if (!staged.stdout.trim()) {
            this.showInfo(`No changes detected for: ${filePath}`);
            return;
          }
          const component = new DiffOutputComponent(`git diff --cached ${filePath}`, staged.stdout);
          this.state.chatContainer.addChild(component);
          this.state.ui.requestRender();
          return;
        }

        const component = new DiffOutputComponent(`git diff ${filePath}`, result.stdout);
        this.state.chatContainer.addChild(component);
        this.state.ui.requestRender();
      } catch (error) {
        this.showError(error instanceof Error ? error.message : 'Failed to get diff');
      }
      return;
    }

    // No path specified — show summary of all tracked modified files
    if (this.state.modifiedFiles.size === 0) {
      // Fall back to git diff --stat
      try {
        const { execa } = await import('execa');
        const result = await execa('git', ['diff', '--stat'], {
          cwd: process.cwd(),
          reject: false,
        });
        const staged = await execa('git', ['diff', '--cached', '--stat'], {
          cwd: process.cwd(),
          reject: false,
        });

        const output = [result.stdout, staged.stdout].filter(Boolean).join('\n');
        if (output.trim()) {
          const component = new DiffOutputComponent('git diff --stat', output);
          this.state.chatContainer.addChild(component);
          this.state.ui.requestRender();
        } else {
          this.showInfo('No file changes detected in this session or working tree.');
        }
      } catch {
        this.showInfo('No file changes tracked in this session.');
      }
      return;
    }

    const lines: string[] = [`Modified files (${this.state.modifiedFiles.size}):`];
    for (const [filePath, info] of this.state.modifiedFiles) {
      const opCounts = new Map<string, number>();
      for (const op of info.operations) {
        opCounts.set(op, (opCounts.get(op) || 0) + 1);
      }
      const ops = Array.from(opCounts.entries())
        .map(([op, count]) => (count > 1 ? `${op}×${count}` : op))
        .join(', ');
      lines.push(`  ${fg('path', filePath)} ${fg('muted', `(${ops})`)}`);
    }
    lines.push('');
    lines.push(fg('muted', 'Use /diff <path> to see the git diff for a specific file.'));

    this.showInfo(lines.join('\n'));
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
