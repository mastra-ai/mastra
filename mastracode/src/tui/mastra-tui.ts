/**
 * Main TUI class for Mastra Code.
 * Wires the Harness to pi-tui components for a full interactive experience.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { Spacer } from '@mariozechner/pi-tui';
import type { Component } from '@mariozechner/pi-tui';
import type { HarnessEvent } from '@mastra/core/harness';
import type { Workspace } from '@mastra/core/workspace';
import { getOAuthProviders } from '../auth/storage.js';
import {
  OnboardingInlineComponent,
  getAvailableModePacks,
  getAvailableOmPacks,
  ONBOARDING_VERSION,
  loadSettings,
  saveSettings,
} from '../onboarding/index.js';
import type { OnboardingResult, ProviderAccess, ProviderAccessLevel } from '../onboarding/index.js';
import {
  resolveThreadActiveModelPackId,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY,
  MEMORY_GATEWAY_PROVIDER,
} from '../onboarding/settings.js';
import {
  detectPackageManager,
  fetchChangelog,
  fetchLatestVersion,
  getInstallCommand,
  isNewerVersion,
  runUpdate,
} from '../utils/update-check.js';
import { dispatchSlashCommand } from './command-dispatch.js';

import type { SlashCommandContext } from './commands/types.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { LoginDialogComponent } from './components/login-dialog.js';
import { ModelSelectorComponent } from './components/model-selector.js';
import type { ModelItem } from './components/model-selector.js';
import { showError, showInfo, showFormattedError, notify } from './display.js';
import { dispatchEvent } from './event-dispatch.js';
import type { EventHandlerContext } from './handlers/types.js';
import { promptForApiKeyIfNeeded } from './prompt-api-key.js';

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

/** How often to recheck for updates during a long-running session (ms). */
const UPDATE_RECHECK_INTERVAL_MS = 45 * 60 * 1_000; // 45 minutes
const IMAGE_PLACEHOLDER_PATTERN = /\[image\]\s*/g;
const CAFFEINATE_ARGS = ['-i', '-m'];

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
  private hasShownUpdateBanner = false;
  private caffeinateProcess: ChildProcess | null = null;
  private lastStreamError: string | null = null;

  private static readonly DOUBLE_CTRL_C_MS = 500;

  constructor(options: MastraTUIOptions) {
    this.state = createTUIState(options);

    // Load user preferences
    const savedSettings = loadSettings();
    this.state.quietMode = savedSettings.preferences.quietMode;

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
      this.state.ui.requestRender();
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

    // Process initial message if provided
    if (this.state.options.initialMessage) {
      this.fireMessage(this.state.options.initialMessage);
    }

    // Main interactive loop — never blocks on streaming,
    // so the editor stays responsive for queued follow-ups.
    while (true) {
      const userInput = await this.getUserInput();
      // allow space as transparent continue (for recovering from api errors manually)
      if (!userInput.trim() && userInput !== ' ') continue;

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

        // Check if a model is selected (sync — fast, no reason to defer)
        if (!this.state.harness.hasModelSelected()) {
          showInfo(this.state, 'No model selected. Use /models to select a model, or /login to authenticate.');
          continue;
        }

        const { content, images } = consumePendingImages(userInput, this.state.pendingImages);
        this.state.pendingImages = [];

        // Show the user message in the TUI right away — before any async work
        // (thread creation, hooks, sending) so the UI feels instant even when
        // GC pauses or I/O slow things down.
        const messageId = `user-${Date.now()}`;
        addUserMessage(this.state, {
          id: messageId,
          role: 'user',
          content: [
            { type: 'text', text: content },
            ...(images?.map(img => ({
              type: 'image' as const,
              data: img.data,
              mimeType: img.mimeType,
            })) ?? []),
          ],
          createdAt: new Date(),
        });
        this.state.ui.requestRender();

        const allowed = await this.runUserPromptHook(userInput);
        if (!allowed) {
          // Hook blocked the message — remove it from the chat
          const comp = this.state.messageComponentsById.get(messageId);
          if (comp) {
            this.state.chatContainer.removeChild(comp as never);
            this.state.messageComponentsById.delete(messageId);
            this.state.ui.requestRender();
          }
          continue;
        }

        // Create thread lazily on first message (may load last-used model).
        // Runs after the hook check so we don't create a thread for blocked messages.
        if (this.state.pendingNewThread) {
          await this.state.harness.createThread();
          this.state.pendingNewThread = false;
        }

        // Normal send — fire and forget; events handle the rest
        this.fireMessage(content, images);
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
    const files = images?.map(img => ({ data: img.data, mediaType: img.mimeType }));
    this.state.harness.sendMessage({ content, files }).catch(error => {
      showError(this.state, error instanceof Error ? error.message : 'Unknown error');
    });
  }

  private queueFollowUpMessage(text: string): void {
    if (text.startsWith('/')) {
      this.state.pendingSlashCommands.push(text);
      this.state.pendingQueuedActions.push('slash');
      updateStatusLine(this.state);
      this.state.ui.requestRender();
      return;
    }

    const { content, images } = consumePendingImages(text, this.state.pendingImages);
    this.state.pendingImages = [];

    this.state.pendingFollowUpMessages.push({ content, images });
    this.state.pendingQueuedActions.push('message');
    updateStatusLine(this.state);
    this.state.ui.requestRender();
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
    // thread selection fired before we were listening).
    // This emits om_status → display_state_changed → updateStatusLine.
    await this.state.harness.loadOMProgress();

    // Sync current thread title — the thread_changed event from
    // promptForThreadSelection fired before we subscribed above.
    const initThreadId = this.state.harness.getCurrentThreadId();
    if (initThreadId) {
      const initThreads = await this.state.harness.listThreads();
      const initThread = initThreads.find(t => t.id === initThreadId);
      if (initThread?.title) {
        this.state.currentThreadTitle = initThread.title;
      }
    }

    // Start the UI
    this.state.ui.start();
    this.state.isInitialized = true;

    // Start MCP connections now that the TUI owns the terminal.
    // Using showInfo() instead of console.info() avoids corrupting the display.
    if (this.state.mcpManager?.hasServers()) {
      const serverCount = Object.keys(this.state.mcpManager.getConfig().mcpServers ?? {}).length;
      showInfo(this.state, `MCP: Connecting to ${serverCount} server(s)...`);
      this.state.mcpManager
        .initInBackground()
        .then(result => {
          if (result.connected.length > 0) {
            showInfo(this.state, `MCP: ${result.connected.length} server(s) connected, ${result.totalTools} tool(s)`);
          }
          for (const s of result.failed) {
            showInfo(this.state, `MCP: Failed to connect to "${s.name}": ${s.error}`);
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
    await renderExistingMessages(this.state);
    // Render existing tasks if any
    await renderExistingTasks(this.state);

    if (this.shouldShowOnboarding()) {
      await this.showOnboarding();
    }

    // Check for updates (after onboarding so it doesn't interfere)
    await this.checkForUpdate();

    // Periodically recheck for updates during long-running sessions (passive only)
    this.updateCheckTimer = setInterval(() => {
      void this.checkForUpdate(/* passive */ true);
    }, UPDATE_RECHECK_INTERVAL_MS);
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
    if (event.type === 'agent_start') {
      this.startCaffeinate();
      this.lastStreamError = null;
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
      await dispatchEvent(event, this.getEventContext(), this.state);

      if (event.type === 'thread_created') {
        await this.syncThreadActivePackMetadata(event.thread);
      } else if (event.type === 'thread_changed') {
        await this.syncThreadActivePackMetadata();
      }

      if (event.type === 'agent_end') {
        const stopReason = event.reason === 'aborted' ? 'aborted' : event.reason === 'error' ? 'error' : 'complete';
        await this.runStopHook(stopReason);

        if (event.reason === 'error' && this.lastStreamError) {
          this.emitErrorFeedback(this.lastStreamError);
          this.lastStreamError = null;
        }
      }
    } finally {
      if (event.type === 'agent_end') {
        this.stopCaffeinate();
      }
    }
  }

  private emitErrorFeedback(errorMessage: string): void {
    const harness = this.state.harness;
    const traceId = harness.getCurrentTraceId() ?? undefined;
    const runId = harness.getCurrentRunId() ?? undefined;
    const threadId = harness.getCurrentThreadId() ?? undefined;

    if (!traceId && !runId && !threadId) return;

    const mastra = harness.getMastra();
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
    const models = await this.state.harness.listAvailableModels();
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
    };
    // Gateway covers all providers
    const mgKey =
      this.state.authStorage?.getStoredApiKey(MEMORY_GATEWAY_PROVIDER) ?? process.env['MASTRA_GATEWAY_API_KEY'];
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
    const currentThreadId = this.state.harness.getCurrentThreadId();
    if (!currentThreadId) return;

    const resolvedThread =
      thread?.id === currentThreadId
        ? thread
        : (await this.state.harness.listThreads()).find(t => t.id === currentThreadId);
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

        if (this.state.harness.isRunning()) {
          this.queueFollowUpMessage(text);
          return;
        }

        resolve(text);
      };
    });
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
      stop: () => this.stop(),
      getResolvedWorkspace: () => this.getResolvedWorkspace(),
      addUserMessage: msg => addUserMessage(this.state, msg),
      renderExistingMessages: () => renderExistingMessages(this.state),
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
      handleSlashCommand: input => this.handleSlashCommand(input),
      addUserMessage: msg => addUserMessage(this.state, msg),
      addChildBeforeFollowUps: child => this.addChildBeforeFollowUps(child),
      fireMessage: (content, images) => this.fireMessage(content, images),
      queueFollowUpMessage: content => this.queueFollowUpMessage(content),
      renderExistingMessages: () => renderExistingMessages(this.state),
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

      this.state.ui.showOverlay(dialog, {
        width: '80%',
        maxHeight: '60%',
        anchor: 'center',
      });
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
        })
        .then(async () => {
          this.state.ui.hideOverlay();

          const { PROVIDER_DEFAULT_MODELS } = await import('../auth/storage.js');
          const defaultModel = PROVIDER_DEFAULT_MODELS[providerId as keyof typeof PROVIDER_DEFAULT_MODELS];
          if (defaultModel) {
            await this.state.harness.switchModel({ modelId: defaultModel });
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
          await this.applyOnboardingResult(result);
          resolve();
        },
        onCancel: () => {
          this.state.activeOnboarding = undefined;
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
          const availableModels = await this.state.harness.listAvailableModels();
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

            this.state.ui.showOverlay(selector, {
              width: '80%',
              maxHeight: '60%',
              anchor: 'center',
            });
            selector.focused = true;
          });
        },
      });

      this.state.activeOnboarding = component;
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.chatContainer.addChild(component);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
    });
  }

  private async applyOnboardingResult(result: OnboardingResult): Promise<void> {
    const harness = this.state.harness;
    const modePack = result.modePack;
    const modes = harness.listModes();

    for (const mode of modes) {
      const modelId = (modePack.models as Record<string, string>)[mode.id];
      if (modelId) {
        (mode as any).defaultModelId = modelId;
        await harness.setThreadSetting({
          key: `modeModelId_${mode.id}`,
          value: modelId,
        });
      }
    }

    const currentModeId = harness.getCurrentModeId();
    const currentModeModel = (modePack.models as Record<string, string>)[currentModeId];
    if (currentModeModel) {
      await harness.switchModel({ modelId: currentModeModel });
    }

    const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
    for (const [agentType, modeId] of Object.entries(subagentModeMap)) {
      const saModelId = (modePack.models as Record<string, string>)[modeId];
      if (saModelId) {
        await harness.setSubagentModelId({ modelId: saModelId, agentType });
      }
    }

    const omPack = result.omPack;
    harness.setState({ observerModelId: omPack.modelId, reflectorModelId: omPack.modelId });
    harness.setState({ yolo: result.yolo });

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
    if (harness.getCurrentThreadId()) {
      await harness.setThreadSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: activeModePackId });
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
   * Show an inline Y/N prompt offering to auto-update.
   */
  private showUpdatePrompt(
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

    return new Promise<void>(resolve => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question,
          options: [
            { label: 'Yes', description: 'Update and restart' },
            { label: 'No', description: 'Skip this version' },
          ],
          formatResult: answer => (answer === 'Yes' ? 'Updating…' : 'Update skipped.'),
          onSubmit: async answer => {
            this.state.activeInlineQuestion = undefined;
            if (answer === 'Yes') {
              showInfo(this.state, `Updating to v${latestVersion}…`);
              const ok = await runUpdate(pm, latestVersion);
              if (ok) {
                showInfo(this.state, `Updated to v${latestVersion}. Please restart Mastra Code.`);
                this.stop();
                process.exit(0);
              } else {
                const cmd = getInstallCommand(pm, latestVersion);
                showError(this.state, `Auto-update failed. Run \`${cmd}\` manually.`);
              }
            } else {
              // User declined — save the dismissed version
              const settings = loadSettings();
              settings.updateDismissedVersion = latestVersion;
              saveSettings(settings);
              showInfo(this.state, `Update skipped. Run /update to update later.`);
            }
            resolve();
          },
          onCancel: () => {
            this.state.activeInlineQuestion = undefined;
            // Treat cancel (Esc / Ctrl+C) the same as "No"
            const settings = loadSettings();
            settings.updateDismissedVersion = latestVersion;
            saveSettings(settings);
            resolve();
          },
        },
        this.state.ui,
      );

      this.state.activeInlineQuestion = questionComponent;
      this.state.chatContainer.addChild(questionComponent);
      this.state.chatContainer.addChild(new Spacer(1));
      this.state.ui.requestRender();
      this.state.chatContainer.invalidate();
    });
  }
}
