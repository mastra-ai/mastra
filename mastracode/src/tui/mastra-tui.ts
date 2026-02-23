/**
 * Main TUI class for Mastra Code.
 * Wires the Harness to pi-tui components for a full interactive experience.
 */
import { Spacer } from '@mariozechner/pi-tui';
import type { Component } from '@mariozechner/pi-tui';
import type { HarnessEvent } from '@mastra/core/harness';
import type { Workspace } from '@mastra/core/workspace';
import { dispatchSlashCommand } from './command-dispatch.js';
import type { SlashCommandContext } from './commands/types.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { defaultOMProgressState } from './components/om-progress.js';
import { showError, showInfo, showFormattedError, notify } from './display.js';
import { dispatchEvent } from './event-dispatch.js';
import type { EventHandlerContext } from './handlers/types.js';

import {
  addUserMessage,
  renderCompletedTasksInline,
  renderClearedTasksInline,
  renderExistingMessages,
} from './render-messages.js';
import {
  setupKeyboardShortcuts,
  buildLayout,
  setupAutocomplete,
  loadCustomSlashCommands,
  setupKeyHandlers,
  subscribeToHarness,
  updateTerminalTitle,
  promptForThreadSelection,
  renderExistingTasks,
} from './setup.js';
import { handleShellPassthrough } from './shell.js';
import type { MastraTUIOptions, TUIState } from './state.js';
import { createTUIState } from './state.js';
import { updateStatusLine } from './status-line.js';

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

    setupKeyboardShortcuts(this.state, {
      stop: () => this.stop(),
      doubleCtrlCMs: MastraTUI.DOUBLE_CTRL_C_MS,
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
          await handleShellPassthrough(this.state, userInput.slice(1).trim());
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
          showInfo(this.state, 'No model selected. Use /models to select a model, or /login to authenticate.');
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
            showError(this.state, error instanceof Error ? error.message : 'Steer failed');
          });
        } else {
          // Normal send — fire and forget; events handle the rest
          this.fireMessage(userInput, images);
        }
      } catch (error) {
        showError(this.state, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Fire off a message without blocking the main loop.
   * Errors are handled via harness events.
   */
  private fireMessage(content: string, images?: Array<{ data: string; mimeType: string }>): void {
    this.state.harness.sendMessage({ content, images: images ? images : undefined }).catch(error => {
      showError(this.state, error instanceof Error ? error.message : 'Unknown error');
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
    await promptForThreadSelection(this.state);

    // Load initial token usage from harness (persisted from previous session)
    this.state.tokenUsage = this.state.harness.getTokenUsage();

    // Load custom slash commands
    await loadCustomSlashCommands(this.state);

    // Setup autocomplete
    setupAutocomplete(this.state);

    // Build UI layout
    buildLayout(this.state, () => this.refreshModelAuthStatus());

    // Setup key handlers
    setupKeyHandlers(this.state, {
      stop: () => this.stop(),
      doubleCtrlCMs: MastraTUI.DOUBLE_CTRL_C_MS,
    });

    // Subscribe to harness events
    subscribeToHarness(this.state, event => this.handleEvent(event));
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
    updateTerminalTitle(this.state);
    // Render existing messages
    await renderExistingMessages(this.state);
    // Render existing tasks if any
    await renderExistingTasks(this.state);

    // Show deferred thread lock prompt (must happen after TUI is started)
    if (this.state.pendingLockConflict) {
      this.showThreadLockPrompt(this.state.pendingLockConflict.threadTitle, this.state.pendingLockConflict.ownerPid);
      this.state.pendingLockConflict = null;
    }
  }

  private async refreshModelAuthStatus(): Promise<void> {
    this.state.modelAuthStatus = await this.state.harness.getCurrentModelAuthStatus();
    updateStatusLine(this.state);
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /** Cached event context – built once, reused for every event. */
  private _ectx: EventHandlerContext | undefined;

  private getEventContext(): EventHandlerContext {
    if (!this._ectx) {
      this._ectx = this.buildEventContext();
    }
    return this._ectx;
  }

  private async handleEvent(event: HarnessEvent): Promise<void> {
    await dispatchEvent(event, this.getEventContext(), this.state);
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
      showInfo: msg => showInfo(this.state, msg),
      showError: msg => showError(this.state, msg),
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
      showInfo: msg => showInfo(this.state, msg),
      showError: msg => showError(this.state, msg),
      showFormattedError: event => showFormattedError(this.state, event),
      updateStatusLine: () => updateStatusLine(this.state),
      resetStatusLineState: () => this.resetStatusLineState(),
      notify: (reason, message) => notify(this.state, reason, message),
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
    return dispatchSlashCommand(input, this.state, () => this.buildCommandContext());
  }
}
