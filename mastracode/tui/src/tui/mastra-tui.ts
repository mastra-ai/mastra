/**
 * Main TUI class for Mastra Code.
 * Wires the AgentController to pi-tui components for a full interactive experience.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Component } from '@earendil-works/pi-tui';
import { getOAuthProviders } from '@mastra/code-sdk/auth/storage';
import {
  getAvailableModePacks,
  getAvailableOmPacks,
  ONBOARDING_VERSION,
  loadSettings,
  saveSettings,
} from '@mastra/code-sdk/onboarding/index';
import type { ProviderAccess, ProviderAccessLevel } from '@mastra/code-sdk/onboarding/index';
import {
  resolveThreadActiveModelPackId,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY,
  MASTRA_GATEWAY_PROVIDER,
} from '@mastra/code-sdk/onboarding/settings';
import type { LoadedPlugin } from '@mastra/code-sdk/plugins/types';
import {
  detectPackageManager,
  fetchChangelog,
  fetchLatestVersion,
  isNewerVersion,
  performUpdate,
} from '@mastra/code-sdk/utils/update-check';
import type { AgentSignalAttributes } from '@mastra/core/agent';
import type { AgentControllerEvent, MastraDBMessage } from '@mastra/core/agent-controller';
import type { Workspace } from '@mastra/core/workspace';
import { insertChatComponentWithBoundarySpacing } from './chat-boundary-reconciliation.js';
import { dispatchSlashCommand } from './command-dispatch.js';
import { startGoalWithDefaults } from './commands/goal.js';

import type { SlashCommandContext } from './commands/types.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { LoginDialogComponent } from './components/login-dialog.js';
import { promptAuthMode } from './components/login-mode-selector.js';
import { ModelSelectorComponent } from './components/model-selector.js';
import type { ModelItem } from './components/model-selector.js';
import { GradientAnimator } from './components/obi-loader.js';
import type { IToolExecutionComponent } from './components/tool-execution-interface.js';
import { showError, showInfo, showFormattedError, notify } from './display.js';
import { dispatchEvent } from './event-dispatch.js';
import { isGoalJudgeInputLocked, showGoalJudgeInputLockInfo } from './goal-input-lock.js';
import type { EventHandlerContext } from './handlers/types.js';
import { askModalQuestion } from './modal-question.js';
import type { OnboardingResult } from './onboarding-inline.js';
import { OnboardingInlineComponent } from './onboarding-inline.js';
import { showModalOverlay } from './overlay.js';
import { promptForApiKeyIfNeeded } from './prompt-api-key.js';

import {
  addPendingUserMessage,
  addUserMessage,
  removePendingUserMessage,
  renderClearedTasksInline,
  renderCompletedTasksInline,
  renderExistingMessages,
  renderTaskDeltaInline,
} from './render-messages.js';
import { flushRender, requestRender } from './render-scheduler.js';
import {
  setupKeyboardShortcuts,
  buildLayout,
  setupAutocomplete,
  loadCustomSlashCommands,
  refreshSkillsAutocomplete,
  setupKeyHandlers,
  subscribeToAgentController,
  updateTerminalTitle,
  promptForThreadSelection,
  renderExistingTasks,
} from './setup.js';
import { handleShellPassthrough } from './shell.js';
import type { MastraTUIOptions, TUIState } from './state.js';
import { createTUIState, getGithubPrSubscriptionsFromMetadata } from './state.js';
import { updateStatusLine } from './status-line.js';

// =============================================================================
// Types
// =============================================================================

export type { MastraTUIOptions } from './state.js';

// =============================================================================
// MastraTUI Class
// =============================================================================

/**
 * Delivery option attributes applied to user-message signals. When the signal is delivered to an
 * active run it is tagged as while-active; when it starts a new run it is a message.
 * The LLM sees these as XML attributes on the `<user-message>` element.
 */
type GithubPollingChangedHandler = (event: { threadId: string; resourceId: string; running: boolean }) => void;
type GithubSignalsWithPollingEvents = { onPollingChanged?: (handler: GithubPollingChangedHandler) => void };

const USER_SIGNAL_DELIVERY_OPTIONS: {
  ifActive: { attributes: AgentSignalAttributes };
  ifIdle: { attributes: AgentSignalAttributes };
} = {
  ifActive: { attributes: { delivery: 'while-active' } },
  ifIdle: { attributes: { delivery: 'message' } },
};

const USER_MESSAGE_APPROVAL_INTERRUPT = {
  reason: 'interrupted_by_user_message',
  message: 'The pending tool approval was declined because the user sent a new message.',
};

/** How often to recheck for updates during a long-running session (ms). */
const UPDATE_RECHECK_INTERVAL_MS = 45 * 60 * 1_000; // 45 minutes
const IMAGE_PLACEHOLDER_PATTERN = /\[image\]\s*/g;
const CAFFEINATE_ARGS = ['-i', '-m'];

export async function syncInitialThreadState(state: TUIState): Promise<void> {
  const initThreadId = state.session.thread.getId();
  if (!initThreadId) return;

  const initThreads = await state.session.thread.list();
  const initThread = initThreads.find(t => t.id === initThreadId);
  if (initThread?.title) {
    state.currentThreadTitle = initThread.title;
  }
  const metadata = initThread?.metadata as Record<string, unknown> | undefined;
  state.activeGithubPrSubscriptions = getGithubPrSubscriptionsFromMetadata(metadata);
  // Prefer the durable ThreadState objective; fall back to the legacy
  // thread-metadata goal for threads created before the migration.
  await state.goalManager.loadFromThread(state);
  if (!state.goalManager.getGoal()) {
    state.goalManager.loadFromThreadMetadata(metadata);
  }
}

function shouldUseCaffeinate(): boolean {
  return process.platform === 'darwin' && process.env.MASTRACODE_DISABLE_CAFFEINATE !== '1';
}

export function consumePendingImages(
  text: string,
  pendingImages: TUIState['pendingImages'],
): { content: string; images?: TUIState['pendingImages'] } {
  const imageMarkerCount = text.match(/\[image\]/g)?.length ?? 0;
  const images = imageMarkerCount > 0 ? pendingImages.slice(0, imageMarkerCount) : undefined;

  return {
    content: text.replace(IMAGE_PLACEHOLDER_PATTERN, '').trim(),
    images: images && images.length > 0 ? images : undefined,
  };
}

export class MastraTUI {
  private state: TUIState;
  private updateCheckTimer: ReturnType<typeof setInterval> | null = null;
  private statusTimingTimer: ReturnType<typeof setInterval> | null = null;
  private hasShownUpdateBanner = false;
  private caffeinateProcess: ChildProcess | null = null;
  private cleanupKeyHandlers?: () => void;
  private cleanupPluginReloadListener?: () => void;
  private cleanupPluginUpdateListener?: () => void;
  private lastStreamError: string | null = null;

  private static readonly DOUBLE_CTRL_C_MS = 500;

  constructor(options: MastraTUIOptions) {
    this.state = createTUIState(options);

    options.githubSignals?.onSubscriptionsChanged(event => {
      const currentThreadId = this.state.session?.thread?.getId?.();
      const currentResourceId = this.state.session?.identity?.getResourceId?.();
      if (event.threadId !== currentThreadId || (currentResourceId && event.resourceId !== currentResourceId)) return;
      this.state.activeGithubPrSubscriptions = event.subscriptions.map(subscription => ({
        owner: subscription.owner,
        repo: subscription.repo,
        prNumber: subscription.number,
        lastSyncStatus: subscription.lastSyncStatus,
        lastNotificationKind: subscription.lastNotificationKind,
        lastNotificationPriority: subscription.lastNotificationPriority,
      }));
      updateStatusLine(this.state);
      flushRender(this.state);
    });

    (options.githubSignals as GithubSignalsWithPollingEvents | undefined)?.onPollingChanged?.(event => {
      const currentThreadId = this.state.session?.thread?.getId?.();
      const currentResourceId = this.state.session?.identity?.getResourceId?.();
      if (event.threadId !== currentThreadId || (currentResourceId && event.resourceId !== currentResourceId)) return;
      if (!this.state.githubPrGradientAnimator) {
        this.state.githubPrGradientAnimator = new GradientAnimator(() => {
          updateStatusLine(this.state);
          requestRender(this.state);
        });
      }
      this.state.githubPrPollingActive = event.running;
      if (event.running) this.state.githubPrGradientAnimator.start();
      else this.state.githubPrGradientAnimator.stop();
      updateStatusLine(this.state);
      flushRender(this.state);
    });

    // Load user preferences
    const savedSettings = loadSettings();
    this.state.quietMode = savedSettings.preferences.quietMode;
    this.state.quietModeMaxToolPreviewLines = savedSettings.preferences.quietModeMaxToolPreviewLines;

    // Override editor input handling to check for active inline components
    const originalHandleInput = this.state.editor.handleInput.bind(this.state.editor);
    this.state.editor.handleInput = (data: string) => {
      // If there's an active plan approval, route input to it. Ctrl+C still
      // aborts: in raw mode the terminal delivers it as \x03 to the editor (the
      // process SIGINT never fires), so the inline component would otherwise
      // swallow it and leave the suspended submit_plan run parked. Fall through
      // to the editor's Ctrl+C handler (which clears inline state and aborts).
      if (this.state.activeInlinePlanApproval) {
        if (data !== '\x03') {
          this.state.activeInlinePlanApproval.handleInput(data);
          return;
        }
      }
      // If there's an active inline question, route input to it (same Ctrl+C
      // pass-through as plan approval above).
      else if (this.state.activeInlineQuestion) {
        if (data !== '\x03') {
          this.state.activeInlineQuestion.handleInput(data);
          return;
        }
      }
      // If onboarding is active, route input there
      if (this.state.activeOnboarding) {
        // Ctrl+C during onboarding — cancel it
        if (data === '\x03') {
          this.state.activeOnboarding.cancel();
          this.state.activeOnboarding = undefined;
          // Fall through to let the editor's 'clear' action fire
        } else {
          this.state.activeOnboarding.handleInput(data);
          return;
        }
      }
      // Otherwise, handle normally
      originalHandleInput(data);
    };

    // Wire clipboard image paste
    this.state.editor.onImagePaste = image => {
      this.state.pendingImages.push(image);
      this.state.editor.insertTextAtCursor?.('[image] ');
      flushRender(this.state);
    };
    this.state.editor.getPromptAnimator = () => this.state.gradientAnimator;

    setupKeyboardShortcuts(this.state, {
      stop: () => this.stop(),
      doubleCtrlCMs: MastraTUI.DOUBLE_CTRL_C_MS,
      queueFollowUpMessage: text => this.queueFollowUpMessage(text),
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

    // Process initial message if provided (e.g. piped stdin content).
    // Runs the same validation as interactive input: model check, prompt hooks.
    if (this.state.options.initialMessage) {
      const msg = this.state.options.initialMessage;

      if (!this.state.session.model.hasSelection()) {
        showInfo(this.state, 'No model selected. Use /models to select a model, or /login to authenticate.');
      } else {
        const messageId = `user-${Date.now()}`;
        addUserMessage(this.state, {
          id: messageId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: msg }] },
          createdAt: new Date(),
        });
        flushRender(this.state);

        const allowed = await this.runUserPromptHook(msg);
        if (!allowed) {
          const comp = this.state.messageComponentsById.get(messageId);
          if (comp) {
            this.state.chatContainer.removeChild(comp as never);
            this.state.messageComponentsById.delete(messageId);
            flushRender(this.state);
          }
        } else {
          try {
            if (this.state.pendingNewThread) {
              await this.state.session.thread.create();
              this.state.pendingNewThread = false;
            }
            this.fireMessage(msg);
          } catch (error) {
            this.state.pendingNewThread = false;
            showError(this.state, error instanceof Error ? error.message : 'Failed to start thread');
          }
        }
      }
    }

    // Main interactive loop — never blocks on streaming,
    // so the editor stays responsive for queued follow-ups.
    while (true) {
      const userInput = await this.getUserInput();
      // allow space as transparent continue (for recovering from api errors manually)
      if (!userInput.trim() && userInput !== ' ') continue;

      try {
        const pendingNewThread = this.state.pendingNewThread;

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

        // Check if a model is selected (sync — fast, no reason to defer)
        if (!this.state.session.model.hasSelection()) {
          showInfo(this.state, 'No model selected. Use /models to select a model, or /login to authenticate.');
          continue;
        }

        const { content, images } = consumePendingImages(userInput, this.state.pendingImages);
        this.state.pendingImages = [];

        const optimisticMessageId = this.renderOptimisticUserMessage(content, images);
        const allowed = await this.runUserPromptHook(userInput);
        if (!allowed) {
          this.removeOptimisticUserMessage(optimisticMessageId);
          continue;
        }

        this.sendOptimisticSignal(content, images, optimisticMessageId, pendingNewThread);
      } catch (error) {
        showError(this.state, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Fire off a message without blocking the main loop.
   * Errors are handled via controller events.
   */
  private fireMessage(content: string, images?: Array<{ data: string; mimeType: string }>): void {
    this.clearStatusTimingTicker();
    const files = images?.map(img => ({ data: img.data, mediaType: img.mimeType }));
    this.state.session.sendMessage({ content, files, untilIdle: true }).catch(error => {
      showError(this.state, error instanceof Error ? error.message : 'Unknown error');
    });
  }

  private createUserSignalMessage(
    content: string,
    images?: Array<{ data: string; mimeType: string }>,
    id = '',
  ): MastraDBMessage {
    return {
      id,
      role: 'user',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: content },
          ...(images?.map(img => ({ type: 'file' as const, data: img.data, mimeType: img.mimeType })) ?? []),
        ],
      },
      createdAt: new Date(),
    };
  }

  private createUserSignalContent(content: string, images?: Array<{ data: string; mimeType: string }>) {
    return images?.length
      ? [
          { type: 'text' as const, text: content },
          ...images.map(img => ({ type: 'file' as const, data: img.data, mediaType: img.mimeType })),
        ]
      : content;
  }

  private renderOptimisticUserMessage(content: string, images?: Array<{ data: string; mimeType: string }>): string {
    const messageId = `user-${Date.now()}`;
    const isInterjection = this.state.session.stream.isActive();
    addUserMessage(this.state, this.createUserSignalMessage(content, images, messageId), {
      ...(isInterjection ? { label: 'steer' } : {}),
    });
    flushRender(this.state);
    return messageId;
  }

  private removeOptimisticUserMessage(messageId: string): void {
    const component = this.state.messageComponentsById.get(messageId);
    if (!component) return;
    this.state.chatContainer.removeChild(component as never);
    this.state.messageComponentsById.delete(messageId);
    flushRender(this.state);
  }

  private remapOptimisticUserMessage(optimisticMessageId: string, signalId: string): void {
    if (optimisticMessageId === signalId) return;
    const component = this.state.messageComponentsById.get(optimisticMessageId);
    if (!component) return;
    this.state.messageComponentsById.delete(optimisticMessageId);
    this.state.messageComponentsById.set(signalId, component);
  }

  private createPendingNewThread(): Promise<void> | undefined {
    if (!this.state.pendingNewThread) return undefined;
    this.state.pendingNewThread = false;
    return this.state.session.thread.create().then(() => undefined);
  }

  private sendOptimisticSignal(
    content: string,
    images: Array<{ data: string; mimeType: string }> | undefined,
    optimisticMessageId: string,
    pendingNewThread: boolean,
  ): void {
    const send = () => {
      this.clearStatusTimingTicker();
      this.state.analytics?.capture('mastracode_prompt_submitted', {
        threadId: this.state.session.thread.getId(),
        resourceId: this.state.session.identity.getResourceId(),
        mode: this.state.session.mode.get(),
        hasImages: Boolean(images?.length),
        isFirstPromptInThread: pendingNewThread,
        pendingNewThread,
      });

      const signal = this.state.session.sendSignal({
        content: this.createUserSignalContent(content, images),
        ...USER_SIGNAL_DELIVERY_OPTIONS,
      });
      this.remapOptimisticUserMessage(optimisticMessageId, signal.id);
      signal.accepted.catch((error: unknown) => {
        this.removeOptimisticUserMessage(signal.id);
        showError(this.state, error instanceof Error ? error.message : 'Unknown error');
      });
    };

    const pendingThread = this.createPendingNewThread();
    if (!pendingThread) {
      send();
      return;
    }

    pendingThread.then(send).catch((error: unknown) => {
      this.removeOptimisticUserMessage(optimisticMessageId);
      showError(this.state, error instanceof Error ? error.message : 'Unknown error');
    });
  }

  private signalMessage(content: string, images?: Array<{ data: string; mimeType: string }>): void {
    const hasActiveRun = this.state.session.stream.isActive();

    const send = () => {
      this.clearStatusTimingTicker();
      if (hasActiveRun) {
        this.state.pendingApprovalDismiss?.(USER_MESSAGE_APPROVAL_INTERRUPT);
      }

      const signal = this.state.session.sendSignal({
        content: this.createUserSignalContent(content, images),
        ...USER_SIGNAL_DELIVERY_OPTIONS,
      });

      if (hasActiveRun) {
        addPendingUserMessage(this.state, signal.id, content, images, { isInterjection: true });
      } else {
        addUserMessage(this.state, this.createUserSignalMessage(content, images, signal.id));
      }

      signal.accepted.catch((error: unknown) => {
        if (hasActiveRun) {
          removePendingUserMessage(this.state, signal.id);
        } else {
          this.removeOptimisticUserMessage(signal.id);
        }
        showError(this.state, error instanceof Error ? error.message : 'Unknown error');
      });
    };

    const pendingThread = this.createPendingNewThread();
    if (!pendingThread) {
      send();
      return;
    }

    pendingThread.then(send).catch((error: unknown) => {
      showError(this.state, error instanceof Error ? error.message : 'Unknown error');
    });
  }

  private queueFollowUpMessage(text: string): void {
    if (text.startsWith('/')) {
      const messageId = `queued-slash-${Date.now()}-${this.state.pendingSlashCommands.length}`;
      this.state.pendingSlashCommands.push(text);
      this.state.pendingSlashCommandMessageIds.push(messageId);
      this.state.pendingQueuedActions.push('slash');
      addPendingUserMessage(this.state, messageId, text);
      updateStatusLine(this.state);
      return;
    }

    const { content, images } = consumePendingImages(text, this.state.pendingImages);
    this.state.pendingImages = [];

    this.state.pendingFollowUpMessages.push({ content, images });
    this.state.pendingQueuedActions.push('message');
    updateStatusLine(this.state);
    flushRender(this.state);
  }

  /**
   * Stop the TUI and clean up.
   */
  stop(): void {
    this.stopCaffeinate();

    // Run SessionEnd hooks (best-effort, don't await)
    const hookMgr = this.state.hookManager;
    if (hookMgr) {
      hookMgr.runSessionEnd().catch(() => {});
    }

    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
      this.updateCheckTimer = null;
    }

    this.clearStatusTimingTicker();

    if (this.cleanupKeyHandlers) {
      this.cleanupKeyHandlers();
      this.cleanupKeyHandlers = undefined;
    }

    if (this.cleanupPluginReloadListener) {
      this.cleanupPluginReloadListener();
      this.cleanupPluginReloadListener = undefined;
    }

    if (this.cleanupPluginUpdateListener) {
      this.cleanupPluginUpdateListener();
      this.cleanupPluginUpdateListener = undefined;
    }

    if (this.state.unsubscribe) {
      this.state.unsubscribe();
    }
    this.state.renderScheduler?.dispose();
    this.state.ui.stop();
  }

  private async refreshPluginRuntimeState(plugins: LoadedPlugin[]): Promise<void> {
    const activePlugins = plugins.filter(plugin => plugin.status === 'active');
    this.state.session.state.set({
      pluginSkillPaths: activePlugins.flatMap(plugin => plugin.skillPaths ?? []),
      pluginCommandPaths: activePlugins.flatMap(plugin => plugin.commandPaths ?? []),
      pluginInstructions: activePlugins.flatMap(plugin => (plugin.instructions ? [plugin.instructions] : [])),
    });
    await loadCustomSlashCommands(this.state);
    await refreshSkillsAutocomplete(this.state);
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  private async init(): Promise<void> {
    if (this.state.isInitialized) return;

    // Initialize controller (but don't select thread yet)
    await this.state.controller.init();
    await this.state.controller.getMastra()?.startWorkers();

    if (this.state.pluginManager && !this.cleanupPluginReloadListener) {
      this.cleanupPluginReloadListener = this.state.pluginManager.onReload(plugins =>
        this.refreshPluginRuntimeState(plugins).catch(err => {
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(`[plugin runtime refresh] ${msg}\n`);
        }),
      );
    }

    if (this.state.pluginManager && !this.cleanupPluginUpdateListener) {
      this.cleanupPluginUpdateListener = this.state.pluginManager.onGithubPluginsUpdated(pluginNames => {
        if (pluginNames.length === 0) return;
        const label = pluginNames.length === 1 ? 'Plugin' : 'Plugins';
        showInfo(this.state, `${label} updated to the latest version: ${pluginNames.join(', ')}`);
      });
    }

    // Load custom slash commands
    await loadCustomSlashCommands(this.state);

    // Install autocomplete immediately; refresh once the workspace resolves.
    setupAutocomplete(this.state);
    refreshSkillsAutocomplete(this.state).catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[skill autocomplete refresh] ${msg}\n`);
    });

    // Build UI layout
    buildLayout(this.state, () => this.refreshModelAuthStatus());

    // Setup key handlers
    this.cleanupKeyHandlers = setupKeyHandlers(this.state, {
      stop: () => this.stop(),
      doubleCtrlCMs: MastraTUI.DOUBLE_CTRL_C_MS,
    });

    // Start the UI before thread selection so resource-drift prompts can render.
    this.state.ui.start();

    // Check for existing threads and prompt for resume
    await promptForThreadSelection(this.state);

    // Subscribe to controller events
    subscribeToAgentController(this.state, event => this.handleEvent(event));
    // Restore escape-as-cancel setting from persisted state
    const escState = this.state.session.state.get() as any;
    if (escState?.escapeAsCancel === false) {
      this.state.editor.escapeEnabled = false;
    }

    // Load OM progress now that we're subscribed (the event during
    // thread selection fired before we were listening).
    // This emits om_status → display_state_changed → updateStatusLine.
    await this.state.controller.loadOMProgress(this.state.session);

    // Sync current thread metadata — the thread_changed event from
    // promptForThreadSelection fired before we subscribed above.
    await syncInitialThreadState(this.state);

    this.state.isInitialized = true;

    // Start MCP connections now that the TUI owns the terminal.
    if (this.state.mcpManager?.hasServers()) {
      this.state.mcpManager
        .initInBackground()
        .then(result => {
          for (const s of result.failed) {
            if (s.needsAuth) {
              showInfo(this.state, `MCP: \u26a0 "${s.name}" needs authentication \u2192 run /mcp to authenticate`);
            } else {
              showInfo(this.state, `MCP: Failed to connect to "${s.name}": ${s.error}`);
            }
          }
          for (const s of result.skipped) {
            showInfo(this.state, `MCP: Skipped "${s.name}": ${s.reason}`);
          }
        })
        .catch(error => {
          showInfo(this.state, `MCP: Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        });
    }

    // Set terminal title
    updateTerminalTitle(this.state);
    // Render existing messages
    await this.renderExistingMessagesAndSeedIdleCounter();
    // Render existing tasks if any
    await renderExistingTasks(this.state);

    if (this.shouldShowOnboarding()) {
      await this.showOnboarding();
    }

    await this.showQuietModePreferencePromptIfNeeded();

    // Check for updates after first render so network latency never blocks startup.
    void this.checkForUpdate().catch(() => {});

    // Periodically recheck for updates during long-running sessions (passive only)
    this.updateCheckTimer = setInterval(() => {
      void this.checkForUpdate(/* passive */ true);
    }, UPDATE_RECHECK_INTERVAL_MS);
  }

  private async refreshModelAuthStatus(): Promise<void> {
    this.state.modelAuthStatus = await this.state.controller.getCurrentModelAuthStatus(this.state.session);
    updateStatusLine(this.state);
  }

  private updateIdleStatusLine(now = Date.now()): void {
    this.state.idleCounter?.setTimingState(this.state, now);
    requestRender(this.state);
  }

  private updateActiveStatusTiming(now = Date.now()): void {
    this.state.idleCounter?.setTimingState(this.state, now);
    updateStatusLine(this.state);
    requestRender(this.state);
  }

  private startActiveStatusTimingTicker(): void {
    this.clearStatusTimingTicker();
    this.updateActiveStatusTiming();
    this.statusTimingTimer = setInterval(() => {
      if (this.state.agentRunStartedAt === undefined) {
        this.clearStatusTimingTicker(false);
        return;
      }
      this.updateActiveStatusTiming();
    }, 1_000);
  }

  private startIdleStatusTimingTicker(): void {
    this.clearStatusTimingTicker();
    this.updateIdleStatusLine();
    this.statusTimingTimer = setInterval(() => {
      this.updateIdleStatusLine();
    }, 60_000);
  }

  private async renderExistingMessagesAndSeedIdleCounter(): Promise<void> {
    await renderExistingMessages(this.state);

    if (this.state.session.run.isRunning()) {
      this.clearStatusTimingTicker();
      return;
    }

    if (this.state.lastRenderedMessageAt === undefined) {
      this.clearStatusTimingTicker();
      return;
    }

    this.state.lastAgentRunEndedAt = this.state.lastRenderedMessageAt;
    this.startIdleStatusTimingTicker();
  }

  private clearStatusTimingTicker(clearDisplay = true): void {
    if (this.statusTimingTimer) {
      clearInterval(this.statusTimingTimer);
      this.statusTimingTimer = null;
    }
    if (clearDisplay) {
      this.state.idleCounter?.setTimingState(undefined);
      requestRender(this.state);
    }
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

  private async handleEvent(event: AgentControllerEvent): Promise<void> {
    if (event.type === 'agent_start') {
      this.clearStatusTimingTicker();
      this.startCaffeinate();
      this.lastStreamError = null;
      this.beginLifecycleRun();
    }

    if (event.type === 'error' && 'error' in event && !event.retryable) {
      // Only capture errors that look like stream/agent failures, not OM or tool errors
      const msg = event.error?.message || String(event.error);
      const isOmError = /observational memory/i.test(msg);
      if (!isOmError) {
        this.lastStreamError = msg;
      }
    }

    try {
      this.fireLifecycleHooksForEvent(event);
      await dispatchEvent(event, this.getEventContext(), this.state);
      this.captureAgentControllerAnalytics(event);

      if (event.type === 'thread_created') {
        await this.syncThreadActivePackMetadata(event.thread);
      } else if (event.type === 'thread_changed') {
        await this.syncThreadActivePackMetadata();
      }

      if (event.type === 'agent_start' && this.state.agentRunStartedAt !== undefined) {
        this.startActiveStatusTimingTicker();
      }

      if (event.type === 'agent_end') {
        const stopReason = event.reason === 'aborted' ? 'aborted' : event.reason === 'error' ? 'error' : 'complete';
        this.startIdleStatusTimingTicker();
        await this.runAgentEndHook(event.reason ?? 'complete');
        await this.runStopHook(stopReason);

        if (event.reason === 'error' && this.lastStreamError) {
          this.emitErrorFeedback(this.lastStreamError);
          this.lastStreamError = null;
        }
      }
    } finally {
      if (event.type === 'agent_end') {
        this.stopCaffeinate();
        this.endLifecycleRun();
      }
    }
  }

  private captureAgentControllerAnalytics(event: AgentControllerEvent): void {
    const analytics = this.state.analytics;
    if (!analytics) {
      return;
    }

    if (event.type === 'thread_created') {
      analytics.capture('mastracode_thread_changed', {
        action: 'created',
        threadId: event.thread.id,
        resourceId: event.thread.resourceId,
        mode: this.state.session.mode.get(),
        hasTitle: Boolean(event.thread.title),
      });
      return;
    }

    if (event.type === 'thread_changed') {
      analytics.capture('mastracode_thread_changed', {
        action: 'switched',
        threadId: event.threadId,
        previousThreadId: event.previousThreadId,
        resourceId: this.state.session.identity.getResourceId(),
        mode: this.state.session.mode.get(),
      });
      return;
    }

    if (event.type === 'model_changed') {
      analytics.capture('mastracode_model_changed', {
        modelId: event.modelId,
        scope: event.scope,
        mode: event.modeId ?? this.state.session.mode.get(),
        threadId: this.state.session.thread.getId(),
        resourceId: this.state.session.identity.getResourceId(),
      });
    }
  }

  private emitErrorFeedback(errorMessage: string): void {
    const controller = this.state.controller;
    const traceId = this.state.session.run.getTraceId() ?? undefined;
    const runId = this.state.session.getCurrentRunId() ?? undefined;
    const threadId = this.state.session.thread.getId() ?? undefined;

    if (!traceId && !runId && !threadId) return;

    const mastra = controller.getMastra();
    const observability = mastra?.observability;
    if (!observability?.addFeedback) return;

    const comment = errorMessage.length > 500 ? errorMessage.slice(0, 500) + '…' : errorMessage;

    observability
      .addFeedback({
        traceId,
        correlationContext: { traceId, runId },
        feedback: {
          feedbackType: 'thumbs',
          feedbackSource: 'mastracode',
          feedbackUserId: 'system',
          value: 0,
          comment: `Stream error: ${comment}`,
          metadata: {
            ...(threadId ? { threadId } : {}),
            ...(runId ? { runId } : {}),
            autoGenerated: true,
          },
        },
      })
      .catch(() => {
        // Fire-and-forget — don't let feedback failures affect the TUI
      });
  }

  private startCaffeinate(): void {
    if (!shouldUseCaffeinate() || this.caffeinateProcess) {
      return;
    }

    try {
      const child = spawn('caffeinate', CAFFEINATE_ARGS, {
        stdio: 'ignore',
      });

      child.once('error', () => {
        if (this.caffeinateProcess === child) {
          this.caffeinateProcess = null;
        }
      });

      child.once('exit', () => {
        if (this.caffeinateProcess === child) {
          this.caffeinateProcess = null;
        }
      });

      this.caffeinateProcess = child;
    } catch {
      this.caffeinateProcess = null;
    }
  }

  private stopCaffeinate(): void {
    const child = this.caffeinateProcess;
    if (!child) {
      return;
    }

    this.caffeinateProcess = null;
    child.kill();
  }

  private async buildProviderAccess(): Promise<ProviderAccess> {
    const models = await this.state.controller.listAvailableModels();
    const hasEnv = (provider: string) => models.some(m => m.provider === provider && m.hasApiKey);
    const accessLevel = (storageProviderId: string): ProviderAccessLevel => {
      const cred = this.state.authStorage?.get(storageProviderId);
      if (cred?.type === 'oauth') return 'oauth';
      if (cred?.type === 'api_key' && cred.key.trim().length > 0) return 'apikey';
      return false;
    };
    const access: ProviderAccess = {
      anthropic: accessLevel('anthropic'),
      openai: accessLevel('openai-codex'),
      cerebras: hasEnv('cerebras') ? ('apikey' as const) : false,
      google: hasEnv('google') ? ('apikey' as const) : false,
      deepseek: hasEnv('deepseek') ? ('apikey' as const) : false,
      'github-copilot': accessLevel('github-copilot'),
    };
    // Gateway covers all providers
    const mgKey =
      this.state.authStorage?.getStoredApiKey(MASTRA_GATEWAY_PROVIDER) ?? process.env['MASTRA_GATEWAY_API_KEY'];
    if (mgKey) {
      if (!access.anthropic) access.anthropic = 'apikey';
      if (!access.openai) access.openai = 'apikey';
    }
    // Include all other providers that have API keys configured
    const seen = new Set(Object.keys(access));
    for (const m of models) {
      if (!seen.has(m.provider) && m.hasApiKey) {
        access[m.provider] = 'apikey';
        seen.add(m.provider);
      }
    }
    return access;
  }

  private async syncThreadActivePackMetadata(thread?: {
    id: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const settings = loadSettings();
    const currentThreadId = this.state.session.thread.getId();
    if (!currentThreadId) return;

    const resolvedThread =
      thread?.id === currentThreadId
        ? thread
        : (await this.state.session.thread.list()).find(t => t.id === currentThreadId);
    const access = await this.buildProviderAccess();
    const packs = getAvailableModePacks(access, settings.customModelPacks).filter(p => p.id !== 'custom');
    const resolvedPackId = resolveThreadActiveModelPackId(
      settings,
      packs,
      resolvedThread?.metadata as Record<string, unknown> | undefined,
    );

    if (resolvedPackId && settings.models.activeModelPackId !== resolvedPackId) {
      // Re-read settings to avoid overwriting concurrent changes
      const fresh = loadSettings();
      if (fresh.models.activeModelPackId !== resolvedPackId) {
        fresh.models.activeModelPackId = resolvedPackId;
        saveSettings(fresh);
      }
    }
  }

  private showHookWarnings(event: string, warnings: string[]): void {
    for (const warning of warnings) {
      showInfo(this.state, `[${event}] ${warning}`);
    }
  }

  private beginLifecycleRun(): void {
    const hookMgr = this.state.hookManager;
    if (!hookMgr) return;
    const runId = randomUUID();
    hookMgr.setRunId(runId);
    hookMgr.runAgentStart().catch(() => {});
  }

  private fireLifecycleHooksForEvent(event: AgentControllerEvent): void {
    const hookMgr = this.state.hookManager;
    if (!hookMgr) return;
    switch (event.type) {
      case 'tool_approval_required':
        hookMgr.runPermissionRequest('tool_approval', event.toolCallId, event.toolName, event.args).catch(() => {});
        break;
      case 'tool_suspended': {
        const payload = (event.suspendPayload ?? {}) as Record<string, unknown>;
        if (event.toolName === 'request_access' || payload.kind === 'sandbox_access_request') {
          hookMgr.runPermissionRequest('sandbox_access', event.toolCallId, event.toolName, payload).catch(() => {});
        } else if (event.toolName === 'submit_plan') {
          hookMgr.runPermissionRequest('plan_approval', event.toolCallId, event.toolName, payload).catch(() => {});
        }
        break;
      }
      case 'subagent_start':
        hookMgr
          .runSubagentStart(event.toolCallId, event.agentType, event.task, event.modelId, event.forked)
          .catch(() => {});
        break;
      case 'subagent_end':
        hookMgr
          .runSubagentEnd(event.toolCallId, event.agentType, event.result, event.isError, event.durationMs)
          .catch(() => {});
        break;
    }
  }

  private async runAgentEndHook(reason: 'complete' | 'aborted' | 'error' | 'suspended'): Promise<void> {
    const hookMgr = this.state.hookManager;
    if (!hookMgr) return;
    try {
      const result = await hookMgr.runAgentEnd(reason);
      this.showHookWarnings('AgentEnd', result.warnings);
    } catch (error) {
      showError(this.state, `AgentEnd hook failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  private endLifecycleRun(): void {
    const hookMgr = this.state.hookManager;
    hookMgr?.clearRunId();
  }

  private async runStopHook(stopReason: 'complete' | 'aborted' | 'error'): Promise<void> {
    const hookMgr = this.state.hookManager;
    if (!hookMgr) return;

    try {
      const result = await hookMgr.runStop(undefined, stopReason);
      this.showHookWarnings('Stop', result.warnings);
      if (!result.allowed && result.blockReason) {
        showError(this.state, `Stop hook blocked: ${result.blockReason}`);
      }
    } catch (error) {
      showError(this.state, `Stop hook failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runUserPromptHook(userInput: string): Promise<boolean> {
    const hookMgr = this.state.hookManager;
    if (!hookMgr) return true;

    try {
      const result = await hookMgr.runUserPromptSubmit(userInput);
      this.showHookWarnings('UserPromptSubmit', result.warnings);

      if (!result.allowed) {
        showError(this.state, result.blockReason || 'Blocked by UserPromptSubmit hook');
        return false;
      }

      return true;
    } catch (error) {
      showError(this.state, `UserPromptSubmit hook failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  // ===========================================================================
  /**
   * Insert a child into the chat container before any follow-up user messages.
   * If no follow-ups are pending, appends to end.
   */
  private addChildBeforeFollowUps(child: Component): void {
    const firstPinned = [
      ...this.state.followUpComponents,
      ...this.state.pendingSignalMessageComponentsById.values(),
    ].find(pinned =>
      this.state.chatContainer.children.includes(('component' in pinned ? pinned.component : pinned) as any),
    );

    if (firstPinned) {
      const component = 'component' in firstPinned ? firstPinned.component : firstPinned;
      const idx = this.state.chatContainer.children.indexOf(component as any);
      if (idx >= 0) {
        insertChatComponentWithBoundarySpacing(this.state.chatContainer, child, idx);
        return;
      }
    }
    insertChatComponentWithBoundarySpacing(this.state.chatContainer, child);
  }

  // ===========================================================================
  // User Input
  // ===========================================================================

  private getUserInput(): Promise<string> {
    return new Promise(resolve => {
      this.state.editor.onSubmit = (text: string) => {
        if (isGoalJudgeInputLocked(this.state)) {
          this.state.editor.setText(text);
          showGoalJudgeInputLockInfo(this.state);
          flushRender(this.state);
          return;
        }

        // Add to history for arrow up/down navigation (skip empty)
        if (text.trim()) {
          this.state.editor.addToHistory(text);
        }
        this.state.editor.setText('');

        if (this.state.session.run.isRunning()) {
          if (text.startsWith('/')) {
            // Run slash commands immediately — they are either settings
            // commands (no agent interaction) or agent-facing commands the
            // user explicitly chose to run mid-stream.  Use Ctrl+F to
            // queue instead.
            this.handleSlashCommand(text).catch(error => {
              showError(this.state, error instanceof Error ? error.message : 'Slash command failed');
            });
            return;
          }

          const { content, images } = consumePendingImages(text, this.state.pendingImages);
          this.state.pendingImages = [];
          if (images?.length) {
            this.state.pendingImages = images;
            this.queueFollowUpMessage(text);
            return;
          }

          this.signalMessage(content);
          return;
        }

        resolve(text);
      };
    });
  }

  /**
   * Get the workspace, preferring controller-owned workspace over the direct option.
   */
  private getResolvedWorkspace(): Workspace | undefined {
    return this.state.controller.getWorkspace() ?? this.state.workspace;
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
      controller: this.state.controller,
      session: this.state.session,
      hookManager: this.state.hookManager,
      mcpManager: this.state.mcpManager,
      pluginManager: this.state.pluginManager,
      analytics: this.state.analytics,
      authStorage: this.state.authStorage,
      customSlashCommands: this.state.customSlashCommands,
      showInfo: msg => showInfo(this.state, msg),
      showError: msg => showError(this.state, msg),
      updateStatusLine: () => updateStatusLine(this.state),
      stop: () => this.stop(),
      getResolvedWorkspace: () => this.getResolvedWorkspace(),
      addUserMessage: msg => addUserMessage(this.state, msg),
      renderExistingMessages: () => this.renderExistingMessagesAndSeedIdleCounter(),
      showOnboarding: () => this.showOnboarding(),
    };
  }

  private buildEventContext(): EventHandlerContext {
    return {
      state: this.state,
      showInfo: msg => showInfo(this.state, msg),
      showError: msg => showError(this.state, msg),
      showFormattedError: event => showFormattedError(this.state, event),
      updateStatusLine: () => updateStatusLine(this.state),
      notify: (reason, message) => notify(this.state, reason, message),
      analytics: this.state.analytics,
      handleSlashCommand: input => this.handleSlashCommand(input),
      addUserMessage: msg => addUserMessage(this.state, msg),
      addChildBeforeFollowUps: child => this.addChildBeforeFollowUps(child),
      fireMessage: (content, images) => this.fireMessage(content, images),
      startGoal: (objective, cancelMessage, options) =>
        startGoalWithDefaults(this.buildCommandContext(), objective, cancelMessage, options),
      queueFollowUpMessage: content => this.queueFollowUpMessage(content),
      renderExistingMessages: () => this.renderExistingMessagesAndSeedIdleCounter(),
      renderClearedTasksInline: (clearedTasks, insertIndex) =>
        renderClearedTasksInline(this.state, clearedTasks, insertIndex),
      renderCompletedTasksInline: (completedTasks, insertIndex) =>
        renderCompletedTasksInline(this.state, completedTasks, insertIndex),
      renderTaskDeltaInline: (previousTasks, nextTasks, insertIndex) =>
        renderTaskDeltaInline(this.state, previousTasks, nextTasks, insertIndex),
      refreshModelAuthStatus: () => this.refreshModelAuthStatus(),
    };
  }

  private async handleSlashCommand(input: string): Promise<boolean> {
    return dispatchSlashCommand(input, this.state, () => this.buildCommandContext());
  }

  // ===========================================================================
  // Login (used by onboarding)
  // ===========================================================================

  async performLogin(providerId: string): Promise<void> {
    const provider = getOAuthProviders().find(p => p.id === providerId);
    const providerName = provider?.name || providerId;

    if (!this.state.authStorage) {
      showError(this.state, 'Auth storage not configured');
      return;
    }

    const authMode = await promptAuthMode(this.state.ui, providerName, provider?.authModes);
    if (authMode === null) {
      // User cancelled at the mode-selection step.
      return;
    }

    return new Promise(resolve => {
      const dialog = new LoginDialogComponent(this.state.ui, providerId, (success, message) => {
        this.state.ui.hideOverlay();
        if (success) {
          showInfo(this.state, `Successfully logged in to ${providerName}`);
        } else if (message) {
          showInfo(this.state, message);
        }
        resolve();
      });

      showModalOverlay(this.state.ui, dialog, { widthPercent: 0.8, maxHeight: '60%' });
      dialog.focused = true;

      this.state
        .authStorage!.login(providerId, {
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
          authMode,
        })
        .then(async () => {
          this.state.ui.hideOverlay();

          const { PROVIDER_DEFAULT_MODELS } = await import('@mastra/code-sdk/auth/storage');
          const defaultModel = PROVIDER_DEFAULT_MODELS[providerId as keyof typeof PROVIDER_DEFAULT_MODELS];
          if (defaultModel) {
            await this.state.session.model.switch({ modelId: defaultModel });
            showInfo(this.state, `Logged in to ${providerName} - switched to ${defaultModel}`);
          } else {
            showInfo(this.state, `Successfully logged in to ${providerName}`);
          }

          resolve();
        })
        .catch((error: Error) => {
          this.state.ui.hideOverlay();
          if (error.message !== 'Login cancelled') {
            showError(this.state, `Failed to login: ${error.message}`);
          }
          resolve();
        });
    });
  }

  // ===========================================================================
  // Onboarding
  // ===========================================================================

  async showOnboarding(): Promise<void> {
    const allProviders = getOAuthProviders();
    const authProviders = allProviders.map(p => ({
      label: p.name,
      value: p.id,
      loggedIn: this.state.authStorage?.isLoggedIn(p.id) ?? false,
    }));

    const access = await this.buildProviderAccess();
    const hasProviderAccess = Object.values(access).some(Boolean);

    const savedSettings = loadSettings();
    const modePacks = getAvailableModePacks(access, savedSettings.customModelPacks);
    const omPacks = getAvailableOmPacks(access);

    let prevModePackId = savedSettings.onboarding.modePackId;
    if (prevModePackId === 'custom' && savedSettings.models.activeModelPackId?.startsWith('custom:')) {
      prevModePackId = savedSettings.models.activeModelPackId;
    }
    const previous = savedSettings.onboarding.completedAt
      ? {
          modePackId: prevModePackId,
          omPackId: savedSettings.onboarding.omPackId,
          yolo: savedSettings.preferences.yolo,
        }
      : undefined;

    return new Promise<void>(resolve => {
      const component = new OnboardingInlineComponent({
        tui: this.state.ui,
        authProviders,
        modePacks,
        omPacks,
        hasProviderAccess,
        previous,
        onComplete: async (result: OnboardingResult) => {
          this.state.activeOnboarding = undefined;
          this.state.ui.hideOverlay();
          await this.applyOnboardingResult(result);
          resolve();
        },
        onCancel: () => {
          this.state.activeOnboarding = undefined;
          this.state.ui.hideOverlay();
          const settings = loadSettings();
          if (!settings.onboarding.completedAt) {
            settings.onboarding.skippedAt = new Date().toISOString();
            settings.onboarding.version = ONBOARDING_VERSION;
            saveSettings(settings);
          }
          resolve();
        },
        onLogin: (providerId: string, done: () => void) => {
          this.performLogin(providerId).then(async () => {
            try {
              const updatedAccess = await this.buildProviderAccess();
              const updatedHasAccess = Object.values(updatedAccess).some(Boolean);
              component.updateModePacks(getAvailableModePacks(updatedAccess, savedSettings.customModelPacks));
              component.updateOmPacks(getAvailableOmPacks(updatedAccess));
              component.updateHasProviderAccess(updatedHasAccess);
            } catch (err) {
              console.error('Failed to refresh provider access after login:', err);
            } finally {
              done();
            }
          });
        },
        onSelectModel: async (title: string, modeColor?: string): Promise<string | undefined> => {
          const availableModels = await this.state.controller.listAvailableModels();
          if (availableModels.length === 0) return undefined;

          return new Promise<string | undefined>(resolveModel => {
            const selector = new ModelSelectorComponent({
              tui: this.state.ui,
              models: availableModels,
              currentModelId: undefined,
              title,
              titleColor: modeColor,
              onSelect: async (model: ModelItem) => {
                this.state.ui.hideOverlay();
                await promptForApiKeyIfNeeded(this.state.ui, model, this.state.authStorage);
                resolveModel(model.id);
              },
              onCancel: () => {
                this.state.ui.hideOverlay();
                resolveModel(undefined);
              },
            });

            showModalOverlay(this.state.ui, selector, { maxHeight: '75%' });
            selector.focused = true;
          });
        },
      });

      this.state.activeOnboarding = component;
      showModalOverlay(this.state.ui, component, { maxHeight: '80%' });
      component.focused = true;
    });
  }

  private async applyOnboardingResult(result: OnboardingResult): Promise<void> {
    const controller = this.state.controller;
    const modePack = result.modePack;
    const modes = controller.listModes();

    for (const mode of modes) {
      const modelId = (modePack.models as Record<string, string>)[mode.id];
      if (modelId) {
        (mode as any).defaultModelId = modelId;
        await this.state.session.thread.setSetting({
          key: `modeModelId_${mode.id}`,
          value: modelId,
        });
      }
    }

    const currentModeId = this.state.session.mode.get();
    const currentModeModel = (modePack.models as Record<string, string>)[currentModeId];
    if (currentModeModel) {
      await this.state.session.model.switch({ modelId: currentModeModel });
    }

    const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
    for (const [agentType, modeId] of Object.entries(subagentModeMap)) {
      const saModelId = (modePack.models as Record<string, string>)[modeId];
      if (saModelId) {
        await this.state.session.subagents.model.set({ modelId: saModelId, agentType });
      }
    }

    const omPack = result.omPack;
    void this.state.session.state.set({ observerModelId: omPack.modelId, reflectorModelId: omPack.modelId });
    void this.state.session.state.set({ yolo: result.yolo });

    const settings = loadSettings();
    settings.onboarding.completedAt = new Date().toISOString();
    settings.onboarding.skippedAt = null;
    settings.onboarding.version = ONBOARDING_VERSION;
    settings.onboarding.omPackId = omPack.id;

    const modeDefaults: Record<string, string> = {};
    for (const mode of modes) {
      const modelId = (modePack.models as Record<string, string>)[mode.id];
      if (modelId) modeDefaults[mode.id] = modelId;
    }

    let activeModePackId = modePack.id;
    if (modePack.id === 'custom' || modePack.id.startsWith('custom:')) {
      const customName =
        modePack.id === 'custom' ? modePack.name?.trim() || 'Custom' : modePack.id.slice('custom:'.length) || 'Custom';
      activeModePackId = `custom:${customName}`;
      const entry = { name: customName, models: modeDefaults, createdAt: new Date().toISOString() };
      const idx = settings.customModelPacks.findIndex(p => p.name === customName);
      if (idx >= 0) {
        settings.customModelPacks[idx] = entry;
      } else {
        settings.customModelPacks.push(entry);
      }
      settings.models.modeDefaults = modeDefaults;
    } else {
      settings.models.modeDefaults = {};
    }

    settings.onboarding.modePackId = activeModePackId;
    settings.models.activeModelPackId = activeModePackId;
    if (this.state.session.thread.getId()) {
      await this.state.session.thread.setSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: activeModePackId });
    }

    settings.models.activeOmPackId = omPack.id;
    settings.models.omModelOverride = omPack.id === 'custom' ? omPack.modelId : null;
    // Clear any per-role overrides from prior /om use so the newly-selected
    // pack (or custom modelId above) applies to both observer and reflector.
    settings.models.observerModelOverride = null;
    settings.models.reflectorModelOverride = null;
    settings.preferences.yolo = result.yolo;

    // Clear any manual subagent overrides so they derive from the active pack
    settings.models.subagentModels = {};

    saveSettings(settings);

    updateStatusLine(this.state);
    await this.refreshModelAuthStatus();
  }

  private shouldShowOnboarding(): boolean {
    const settings = loadSettings();
    const ob = settings.onboarding;
    if (ob.completedAt || ob.skippedAt) {
      return ob.version < ONBOARDING_VERSION;
    }
    return true;
  }

  private applyQuietModePreference(enabled: boolean, previewLineLimit = this.state.quietModeMaxToolPreviewLines): void {
    const settings = loadSettings();
    settings.preferences.quietMode = enabled;
    settings.preferences.quietModeMaxToolPreviewLines = previewLineLimit;
    settings.onboarding.quietModePreferenceSelected = true;
    saveSettings(settings);

    this.state.quietMode = enabled;
    this.state.quietModeMaxToolPreviewLines = previewLineLimit;
    this.state.taskProgress?.setQuietMode(enabled);

    const tools = this.state.allToolComponents.filter(
      (tool): tool is IToolExecutionComponent => typeof tool.setQuietModeDisplay === 'function',
    );
    const color = this.state.session?.mode.resolve().metadata?.color;
    const modeColor = typeof color === 'string' ? color : undefined;
    for (const tool of tools) {
      tool.setCompactToolModeColor?.(modeColor);
      tool.setQuietModeDisplay?.(enabled ? 'quiet' : 'normal');
      tool.setQuietPreviewLineLimit?.(previewLineLimit);
    }
    flushRender(this.state);
  }

  private parseQuietPreviewLineAnswer(answer: string | null): number {
    if (answer === 'None') return 0;
    const match = answer?.match(/^(\d+)/);
    return match ? Number(match[1]) : this.state.quietModeMaxToolPreviewLines;
  }

  async showQuietModePreferencePromptIfNeeded(): Promise<void> {
    const settings = loadSettings();
    if (settings.onboarding.quietModePreferenceSelected) return;

    const answer = await askModalQuestion(this.state.ui, {
      question:
        'Try compact quiet mode?\n\nQuiet mode keeps tool calls and task progress compact so long sessions are easier to scan.',
      options: [
        { label: 'Enable quiet mode', description: 'Use compact rendering by default' },
        { label: 'Keep classic mode', description: 'Keep the current full rendering' },
      ],
      allowCustomResponse: false,
      selectedOptionLabel: 'Enable quiet mode',
      overlay: { maxHeight: '50%' },
    });

    if (answer !== 'Enable quiet mode') {
      this.applyQuietModePreference(false);
      return;
    }

    const previewLineAnswer = await askModalQuestion(this.state.ui, {
      question: 'How many quiet-mode tool preview lines should be shown?\n\nYou can change this later in /settings.',
      options: [
        { label: 'None', description: 'Hide compact tool detail previews' },
        { label: '1 line', description: 'Show the latest preview line' },
        { label: '2 lines', description: 'Default' },
        { label: '4 lines', description: 'Show more streaming detail' },
        { label: '8 lines', description: 'Show the most detail' },
      ],
      allowCustomResponse: false,
      selectedOptionLabel: '2 lines',
      overlay: { maxHeight: '50%' },
    });

    this.applyQuietModePreference(true, this.parseQuietPreviewLineAnswer(previewLineAnswer));
  }

  // ===========================================================================
  // Auto-Update
  // ===========================================================================

  /**
   * Check npm for a newer version and prompt the user to update.
   * - If the user previously dismissed this version, show a passive note instead.
   * - If the fetch fails or we're already up-to-date, silently return.
   * @param passive When true, only show an info message (used for periodic rechecks).
   */
  private async checkForUpdate(passive = false): Promise<void> {
    if (process.env.MASTRACODE_DISABLE_UPDATE_CHECK === '1') return;

    const currentVersion = this.state.options.version;
    if (!currentVersion) return;

    const latestVersion = await fetchLatestVersion();
    if (!latestVersion || !isNewerVersion(currentVersion, latestVersion)) return;

    // Passive mode or previously dismissed — show info message only once
    if (passive) {
      if (!this.hasShownUpdateBanner) {
        this.hasShownUpdateBanner = true;
        showInfo(
          this.state,
          `Update available: v${latestVersion} (current: v${currentVersion}). Run /update to update.`,
        );
      }
      return;
    }

    const settings = loadSettings();

    // User previously dismissed this exact version — show passive banner note only once
    if (settings.updateDismissedVersion && !isNewerVersion(settings.updateDismissedVersion, latestVersion)) {
      if (!this.hasShownUpdateBanner) {
        this.hasShownUpdateBanner = true;
        showInfo(
          this.state,
          `Update available: v${latestVersion} (current: v${currentVersion}). Run /update to update.`,
        );
      }
      return;
    }

    const [pm, changelog] = await Promise.all([detectPackageManager(), fetchChangelog(latestVersion)]);

    // Prompt the user (and mark banner as shown so periodic checks don't repeat it)
    this.hasShownUpdateBanner = true;
    await this.showUpdatePrompt(currentVersion, latestVersion, pm, changelog);
  }

  /**
   * Show a Y/N prompt offering to auto-update (inline in the chat flow).
   */
  private async showUpdatePrompt(
    currentVersion: string,
    latestVersion: string,
    pm: Awaited<ReturnType<typeof detectPackageManager>>,
    changelog: string | null,
  ): Promise<void> {
    let question = `A new version of Mastra Code is available: v${latestVersion} (current: v${currentVersion}).`;
    if (changelog) {
      question += `\n\nWhat's new:\n${changelog}`;
    }
    question += `\n\nWould you like to update now?`;

    const answer = await new Promise<string | null>(resolve => {
      const component = new AskQuestionInlineComponent(
        {
          question,
          options: [
            { label: 'Yes', description: 'Update and restart' },
            { label: 'No', description: 'Skip this version' },
          ],
          allowCustomResponse: false,
          onSubmit: answer => {
            this.state.activeInlineQuestion = undefined;
            resolve(answer);
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            resolve(null);
          },
        },
        this.state.ui,
      );

      insertChatComponentWithBoundarySpacing(this.state.chatContainer, component);
      this.state.activeInlineQuestion = component;
      component.focused = true;
      flushRender(this.state);
    });

    if (answer === 'Yes') {
      showInfo(this.state, `Updating to v${latestVersion}…`);
      const outcome = await performUpdate(pm, latestVersion);
      if (outcome.status === 'updated') {
        // Printed after TUI teardown — a message rendered inside it is lost in the exit race.
        this.stop();
        console.info(outcome.message);
        process.exit(0);
      } else {
        showError(this.state, outcome.message);
      }
    } else {
      // User declined — save the dismissed version
      const settings = loadSettings();
      settings.updateDismissedVersion = latestVersion;
      saveSettings(settings);
      if (answer === 'No') {
        showInfo(this.state, `Update skipped. Run /update to update later.`);
      }
    }
  }
}
