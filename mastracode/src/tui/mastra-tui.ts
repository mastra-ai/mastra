/**
 * Main TUI class for Mastra Code.
 * Wires the Harness to pi-tui components for a full interactive experience.
 */
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
import { dispatchSlashCommand } from './command-dispatch.js';
import type { SlashCommandContext } from './commands/types.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { LoginDialogComponent } from './components/login-dialog.js';
import { ModelSelectorComponent } from './components/model-selector.js';
import type { ModelItem } from './components/model-selector.js';
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
        }

        // Check if a model is selected
        if (!this.state.harness.hasModelSelected()) {
          showInfo(this.state, 'No model selected. Use /models to select a model, or /login to authenticate.');
          continue;
        }

        const allowed = await this.runUserPromptHook(userInput);
        if (!allowed) {
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
      // Skip onboarding when there's a lock conflict — it'll run on next clean startup
    } else if (this.shouldShowOnboarding()) {
      await this.showOnboarding();
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

    if (event.type === 'agent_end') {
      const stopReason = event.reason === 'aborted' ? 'aborted' : event.reason === 'error' ? 'error' : 'complete';
      await this.runStopHook(stopReason);
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
            if (this.shouldShowOnboarding()) {
              await this.showOnboarding();
            }
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

    const buildAccess = async (): Promise<ProviderAccess> => {
      const models = await this.state.harness.listAvailableModels();
      const hasEnv = (provider: string) => models.some(m => m.provider === provider && m.hasApiKey);
      const accessLevel = (provider: string, oauthId: string): ProviderAccessLevel => {
        if (this.state.authStorage?.isLoggedIn(oauthId)) return 'oauth';
        if (hasEnv(provider)) return 'apikey';
        return false;
      };
      return {
        anthropic: accessLevel('anthropic', 'anthropic'),
        openai: accessLevel('openai', 'openai-codex'),
        cerebras: hasEnv('cerebras') ? ('apikey' as const) : false,
        google: hasEnv('google') ? ('apikey' as const) : false,
        deepseek: hasEnv('deepseek') ? ('apikey' as const) : false,
      };
    };

    const access = await buildAccess();

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
            const updatedAccess = await buildAccess();
            component.updateModePacks(getAvailableModePacks(updatedAccess, savedSettings.customModelPacks));
            component.updateOmPacks(getAvailableOmPacks(updatedAccess));
            done();
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
              onSelect: (model: ModelItem) => {
                this.state.ui.hideOverlay();
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
    settings.onboarding.modePackId = modePack.id;
    settings.onboarding.omPackId = omPack.id;

    const modeDefaults: Record<string, string> = {};
    for (const mode of modes) {
      const modelId = (modePack.models as Record<string, string>)[mode.id];
      if (modelId) modeDefaults[mode.id] = modelId;
    }

    if (modePack.id === 'custom') {
      const idx = settings.customModelPacks.findIndex(p => p.name === 'Setup');
      const entry = { name: 'Setup', models: modeDefaults, createdAt: new Date().toISOString() };
      if (idx >= 0) {
        settings.customModelPacks[idx] = entry;
      } else {
        settings.customModelPacks.push(entry);
      }
      settings.models.activeModelPackId = 'custom:Setup';
      settings.models.modeDefaults = modeDefaults;
    } else if (modePack.id.startsWith('custom:')) {
      settings.models.activeModelPackId = modePack.id;
      settings.models.modeDefaults = modeDefaults;
    } else {
      settings.models.activeModelPackId = modePack.id;
      settings.models.modeDefaults = {};
    }

    settings.models.activeOmPackId = omPack.id;
    settings.models.omModelOverride = omPack.id === 'custom' ? omPack.modelId : null;
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
}
