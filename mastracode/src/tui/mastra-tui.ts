/**
 * Main TUI class for Mastra Code.
 * Wires the Harness to pi-tui components for a full interactive experience.
 */
import { Spacer } from '@mariozechner/pi-tui';
import type { Component } from '@mariozechner/pi-tui';
import type { HarnessEvent, TaskItem } from '@mastra/core/harness';
import type { Workspace } from '@mastra/core/workspace';
import type { SlashCommandMetadata } from '../utils/slash-command-loader.js';
import { processSlashCommand } from '../utils/slash-command-processor.js';
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

import { SlashCommandComponent } from './components/slash-command.js';

import { showError, showInfo, showFormattedError, notify } from './display.js';
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
        showError(this.state, `Unknown command: ${command}`);
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
        showInfo(this.state, `Executed //${command.name} (no output)`);
      }
    } catch (error) {
      showError(
        this.state,
        `Error executing //${command.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
