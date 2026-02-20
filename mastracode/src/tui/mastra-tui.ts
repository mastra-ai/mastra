/**
 * Main TUI class for Mastra Code.
 * Wires the Harness to pi-tui components for a full interactive experience.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CombinedAutocompleteProvider,
  Container,
  Spacer,
  Text,
  TUI,
  ProcessTerminal,
  visibleWidth,
} from '@mariozechner/pi-tui';
import type { Component, SlashCommand } from '@mariozechner/pi-tui';
import type {
  Harness,
  HarnessEvent,
  HarnessMessage,
  HarnessMessageContent,
  HarnessEventListener,
  TokenUsage,
} from '@mastra/core/harness';
import type { Workspace } from '@mastra/core/workspace';
import chalk from 'chalk';
import type { AuthStorage } from '../auth/storage.js';
import { getOAuthProviders } from '../auth/storage.js';
import type { HookManager } from '../hooks/index.js';
import type { MCPManager } from '../mcp/manager.js';
import { getToolCategory, TOOL_CATEGORIES } from '../permissions.js';
import { parseSubagentMeta } from '../tools/subagent.js';
import { parseError } from '../utils/errors.js';
import { detectProject } from '../utils/project.js';
import type { ProjectInfo } from '../utils/project.js';
import { loadCustomCommands } from '../utils/slash-command-loader.js';
import type { SlashCommandMetadata } from '../utils/slash-command-loader.js';
import { processSlashCommand } from '../utils/slash-command-processor.js';
import { ThreadLockError } from '../utils/thread-lock.js';
import { AskQuestionDialogComponent } from './components/ask-question-dialog.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { AssistantMessageComponent } from './components/assistant-message.js';
import { CustomEditor } from './components/custom-editor.js';
import { DiffOutputComponent } from './components/diff-output.js';
import { LoginDialogComponent } from './components/login-dialog.js';
import { ModelSelectorComponent } from './components/model-selector.js';
import type { ModelItem } from './components/model-selector.js';
import { GradientAnimator, applyGradientSweep } from './components/obi-loader.js';

import { OMMarkerComponent } from './components/om-marker.js';
import type { OMMarkerData } from './components/om-marker.js';
import { OMOutputComponent } from './components/om-output.js';
import type { OMProgressComponent, OMProgressState } from './components/om-progress.js';
import { defaultOMProgressState, formatObservationStatus, formatReflectionStatus } from './components/om-progress.js';
import { OMSettingsComponent } from './components/om-settings.js';
import { PlanApprovalInlineComponent, PlanResultComponent } from './components/plan-approval-inline.js';
import { SettingsComponent } from './components/settings.js';
import { ShellOutputComponent } from './components/shell-output.js';
import { SlashCommandComponent } from './components/slash-command.js';
import { SubagentExecutionComponent } from './components/subagent-execution.js';
import { SystemReminderComponent } from './components/system-reminder.js';
import { ThreadSelectorComponent } from './components/thread-selector.js';

import { TodoProgressComponent } from './components/todo-progress.js';
import type { TodoItem } from './components/todo-progress.js';
import { ToolApprovalDialogComponent } from './components/tool-approval-dialog.js';
import type { ApprovalAction } from './components/tool-approval-dialog.js';
import { ToolExecutionComponentEnhanced } from './components/tool-execution-enhanced.js';
import type { ToolResult } from './components/tool-execution-enhanced.js';
import type { IToolExecutionComponent } from './components/tool-execution-interface.js';
import { UserMessageComponent } from './components/user-message.js';
import { sendNotification } from './notify.js';
import type { NotificationMode, NotificationReason } from './notify.js';
import { getEditorTheme, getMarkdownTheme, fg, bold, theme, mastra, tintHex } from './theme.js';

// =============================================================================
// Types
// =============================================================================

export interface MastraTUIOptions {
  /** The harness instance to control */
  harness: Harness<any>;

  /** Hook manager for session lifecycle hooks */
  hookManager?: HookManager;

  /** Auth storage for OAuth login/logout */
  authStorage?: AuthStorage;

  /** MCP manager for server status and reload */
  mcpManager?: MCPManager;

  /**
   * @deprecated Workspace is now obtained from the Harness.
   * Configure workspace via HarnessConfig.workspace instead.
   * Kept as fallback for backward compatibility.
   */
  workspace?: Workspace;

  /** Initial message to send on startup */
  initialMessage?: string;

  /** Whether to show verbose startup info */
  verbose?: boolean;

  /** App name for header */
  appName?: string;

  /** App version for header */
  version?: string;

  /** Use inline questions instead of dialog overlays */
  inlineQuestions?: boolean;
}

// =============================================================================
// MastraTUI Class
// =============================================================================

export class MastraTUI {
  private harness: Harness<any>;
  private options: MastraTUIOptions;
  private hookManager?: HookManager;
  private authStorage?: AuthStorage;
  private mcpManager?: MCPManager;

  // TUI components
  private ui: TUI;
  private chatContainer: Container;
  private editorContainer: Container;
  private editor: CustomEditor;
  private footer: Container;

  // State tracking
  private isInitialized = false;
  private gradientAnimator?: GradientAnimator;
  private isAgentActive = false;
  private streamingComponent?: AssistantMessageComponent;
  private streamingMessage?: HarnessMessage;
  private pendingTools = new Map<string, IToolExecutionComponent>();
  private seenToolCallIds = new Set<string>(); // Track all tool IDs seen during current stream (prevents duplicates)
  private subagentToolCallIds = new Set<string>(); // Track subagent tool call IDs to skip in trailing content logic
  private allToolComponents: IToolExecutionComponent[] = []; // Track all tools for expand/collapse
  private allSlashCommandComponents: SlashCommandComponent[] = []; // Track slash command boxes for expand/collapse
  private pendingSubagents = new Map<string, SubagentExecutionComponent>(); // Track active subagent tasks
  private toolOutputExpanded = false;
  private hideThinkingBlock = true;
  private pendingNewThread = false; // True when we want a new thread but haven't created it yet
  private pendingLockConflict: {
    threadTitle: string;
    ownerPid: number;
  } | null = null;
  private lastAskUserComponent?: IToolExecutionComponent; // Track the most recent ask_user tool for inline question placement
  private lastClearedText = ''; // Saved editor text for Ctrl+Z undo

  // Status line state
  private projectInfo: ProjectInfo;
  private tokenUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  private statusLine?: Text;
  private memoryStatusLine?: Text;
  private modelAuthStatus: { hasAuth: boolean; apiKeyEnvVar?: string } = {
    hasAuth: true,
  };
  // Observational Memory state
  private omProgress: OMProgressState = defaultOMProgressState();
  private omProgressComponent?: OMProgressComponent;
  private activeOMMarker?: OMMarkerComponent;
  private activeBufferingMarker?: OMMarkerComponent;
  private activeActivationMarker?: OMMarkerComponent;
  // Buffering state — drives statusline label animation
  private bufferingMessages = false;
  private bufferingObservations = false;
  private todoProgress?: TodoProgressComponent;
  private previousTodos: TodoItem[] = []; // Track previous state for diff

  // Autocomplete
  private autocompleteProvider?: CombinedAutocompleteProvider;

  // Custom slash commands
  private customSlashCommands: SlashCommandMetadata[] = [];

  // Pending images from clipboard paste
  private pendingImages: Array<{ data: string; mimeType: string }> = [];

  // Workspace (for skills)
  private workspace?: Workspace;

  // Active inline question component
  private activeInlineQuestion?: AskQuestionInlineComponent;

  // Active inline plan approval component
  private activeInlinePlanApproval?: PlanApprovalInlineComponent;
  private lastSubmitPlanComponent?: IToolExecutionComponent;
  // Follow-up messages sent via Ctrl+F while streaming
  // These must stay anchored at the bottom of the chat stream
  private followUpComponents: UserMessageComponent[] = [];

  // Active approval dialog dismiss callback — called on Ctrl+C to unblock the dialog
  private pendingApprovalDismiss: (() => void) | null = null;

  // Ctrl+C double-tap tracking
  private lastCtrlCTime = 0;
  private static readonly DOUBLE_CTRL_C_MS = 500;
  // Track user-initiated aborts (Ctrl+C/Esc) vs system aborts (mode switch, etc.)
  private userInitiatedAbort = false;

  // Track files modified during this session (for /diff command)
  private modifiedFiles = new Map<string, { operations: string[]; firstModified: Date }>();
  // Map toolCallId -> { toolName, filePath } for pending tool calls that modify files
  private pendingFileTools = new Map<string, { toolName: string; filePath: string }>();

  // Event handling
  private unsubscribe?: () => void;

  private terminal: ProcessTerminal;

  constructor(options: MastraTUIOptions) {
    this.harness = options.harness;
    this.options = options;
    this.hookManager = options.hookManager;
    this.authStorage = options.authStorage;
    this.mcpManager = options.mcpManager;
    this.workspace = options.workspace;

    // Detect project info for status line
    this.projectInfo = detectProject(process.cwd());

    // Create terminal and TUI instance
    this.terminal = new ProcessTerminal();
    this.ui = new TUI(this.terminal);

    // Create containers
    this.chatContainer = new Container();
    this.editorContainer = new Container();
    this.footer = new Container();

    // Create editor with custom keybindings
    this.editor = new CustomEditor(this.ui, getEditorTheme());

    // Override editor input handling to check for active inline components
    const originalHandleInput = this.editor.handleInput.bind(this.editor);
    this.editor.handleInput = (data: string) => {
      // If there's an active plan approval, route input to it
      if (this.activeInlinePlanApproval) {
        this.activeInlinePlanApproval.handleInput(data);
        return;
      }
      // If there's an active inline question, route input to it
      if (this.activeInlineQuestion) {
        this.activeInlineQuestion.handleInput(data);
        return;
      }
      // Otherwise, handle normally
      originalHandleInput(data);
    };

    // Wire clipboard image paste
    this.editor.onImagePaste = image => {
      this.pendingImages.push(image);
      this.editor.insertTextAtCursor?.('[image] ');
      this.ui.requestRender();
    };

    this.setupKeyboardShortcuts();
  }

  /**
   * Setup keyboard shortcuts for the custom editor.
   */
  private setupKeyboardShortcuts(): void {
    // Ctrl+C / Escape - abort if running, clear input if idle, double-tap always exits
    this.editor.onAction('clear', () => {
      const now = Date.now();
      if (now - this.lastCtrlCTime < MastraTUI.DOUBLE_CTRL_C_MS) {
        // Double Ctrl+C → exit
        this.stop();
        process.exit(0);
      }
      this.lastCtrlCTime = now;

      if (this.pendingApprovalDismiss) {
        // Dismiss active approval dialog and abort
        this.pendingApprovalDismiss();
        this.activeInlinePlanApproval = undefined;
        this.activeInlineQuestion = undefined;
        this.userInitiatedAbort = true;
        this.harness.abort();
      } else if (this.harness.isRunning()) {
        // Clean up active inline components on abort
        this.activeInlinePlanApproval = undefined;
        this.activeInlineQuestion = undefined;
        this.userInitiatedAbort = true;
        this.harness.abort();
      } else {
        const current = this.editor.getText();
        if (current.length > 0) {
          this.lastClearedText = current;
        }
        this.editor.setText('');
        this.ui.requestRender();
      }
    });

    // Ctrl+Z - undo last clear (restore editor text)
    this.editor.onAction('undo', () => {
      if (this.lastClearedText && this.editor.getText().length === 0) {
        this.editor.setText(this.lastClearedText);
        this.lastClearedText = '';
        this.ui.requestRender();
      }
    });

    // Ctrl+D - exit when editor is empty
    this.editor.onCtrlD = () => {
      this.stop();
      process.exit(0);
    };

    // Ctrl+T - toggle thinking blocks visibility
    this.editor.onAction('toggleThinking', () => {
      this.hideThinkingBlock = !this.hideThinkingBlock;
      this.ui.requestRender();
    });
    // Ctrl+E - expand/collapse tool outputs
    this.editor.onAction('expandTools', () => {
      this.toolOutputExpanded = !this.toolOutputExpanded;
      for (const tool of this.allToolComponents) {
        tool.setExpanded(this.toolOutputExpanded);
      }
      for (const sc of this.allSlashCommandComponents) {
        sc.setExpanded(this.toolOutputExpanded);
      }
      this.ui.requestRender();
    });

    // Shift+Tab - cycle harness modes
    this.editor.onAction('cycleMode', async () => {
      // Block mode switching while plan approval is active
      if (this.activeInlinePlanApproval) {
        this.showInfo('Resolve the plan approval first');
        return;
      }

      const modes = this.harness.getModes();
      if (modes.length <= 1) return;
      const currentId = this.harness.getCurrentModeId();
      const currentIndex = modes.findIndex(m => m.id === currentId);
      const nextIndex = (currentIndex + 1) % modes.length;
      const nextMode = modes[nextIndex]!;
      await this.harness.switchMode(nextMode.id);
      // The mode_changed event handler will show the info message
      this.updateStatusLine();
    });
    // Ctrl+Y - toggle YOLO mode
    this.editor.onAction('toggleYolo', () => {
      const current = (this.harness.getState() as any).yolo === true;
      this.harness.setState({ yolo: !current } as any);
      this.updateStatusLine();
      this.showInfo(current ? 'YOLO mode off' : 'YOLO mode on');
    });

    // Ctrl+F - queue follow-up message while streaming
    this.editor.onAction('followUp', () => {
      const text = this.editor.getText().trim();
      if (!text) return;
      if (!this.harness.isRunning()) return; // Only relevant while streaming

      // Clear editor and add user message to chat
      this.editor.setText('');
      this.addUserMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        content: [{ type: 'text', text }],
        createdAt: new Date(),
      });
      this.ui.requestRender();

      // Queue the follow-up
      this.harness.followUp(text).catch(error => {
        this.showError(error instanceof Error ? error.message : 'Follow-up failed');
      });
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
    const hookMgr = this.hookManager;
    if (hookMgr) {
      hookMgr.runSessionStart().catch(() => {});
    }

    // Process initial message if provided
    if (this.options.initialMessage) {
      this.fireMessage(this.options.initialMessage);
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
        if (this.pendingNewThread) {
          await this.harness.createThread();
          this.pendingNewThread = false;
          this.updateStatusLine();
        }

        // Check if a model is selected
        if (!this.harness.hasModelSelected()) {
          this.showInfo('No model selected. Use /models to select a model, or /login to authenticate.');
          continue;
        }

        // Collect any pending images from clipboard paste
        const images = this.pendingImages.length > 0 ? [...this.pendingImages] : undefined;
        this.pendingImages = [];

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
        this.ui.requestRender();

        if (this.harness.isRunning()) {
          // Agent is streaming → steer (abort + resend)
          // Clear follow-up tracking since steer replaces the current response
          this.followUpComponents = [];
          this.harness.steer(userInput).catch(error => {
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
    this.harness.sendMessage(content, images ? { images } : undefined).catch(error => {
      this.showError(error instanceof Error ? error.message : 'Unknown error');
    });
  }

  /**
   * Stop the TUI and clean up.
   */
  stop(): void {
    // Run SessionEnd hooks (best-effort, don't await)
    const hookMgr = this.hookManager;
    if (hookMgr) {
      hookMgr.runSessionEnd().catch(() => {});
    }

    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.ui.stop();
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize harness (but don't select thread yet)
    await this.harness.init();

    // Check for existing threads and prompt for resume
    await this.promptForThreadSelection();

    // Load initial token usage from harness (persisted from previous session)
    this.tokenUsage = this.harness.getTokenUsage();

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
    const escState = this.harness.getState() as any;
    if (escState?.escapeAsCancel === false) {
      this.editor.escapeEnabled = false;
    }

    // Load OM progress now that we're subscribed (the event during
    // thread selection fired before we were listening)
    await this.harness.loadOMProgress();

    // Sync OM thresholds from thread metadata (may differ from OM defaults)
    this.syncOMThresholdsFromHarness();

    // Start the UI
    this.ui.start();
    this.isInitialized = true;

    // Set terminal title
    this.updateTerminalTitle();
    // Render existing messages
    await this.renderExistingMessages();
    // Render existing todos if any
    await this.renderExistingTodos();

    // Show deferred thread lock prompt (must happen after TUI is started)
    if (this.pendingLockConflict) {
      this.showThreadLockPrompt(this.pendingLockConflict.threadTitle, this.pendingLockConflict.ownerPid);
      this.pendingLockConflict = null;
    }
  }

  /**
   * Render existing todos from the harness state on startup
   */
  private async renderExistingTodos(): Promise<void> {
    try {
      // Access the harness state using the public method
      const state = this.harness.getState() as { todos?: TodoItem[] };
      const todos = state.todos || [];

      if (todos.length > 0 && this.todoProgress) {
        // Update the existing todo progress component
        this.todoProgress.updateTodos(todos);
        this.ui.requestRender();
      }
    } catch {
      // Silently ignore todo rendering errors
    }
  }
  /**
   * Prompt user to continue existing thread or start new one.
   * This runs before the TUI is fully initialized.
   * Threads are already scoped to the current project path by listThreads().
   */
  private async promptForThreadSelection(): Promise<void> {
    const threads = await this.harness.listThreads();

    if (threads.length === 0) {
      // No existing threads for this path - defer creation until first message
      this.pendingNewThread = true;
      return;
    }

    // Sort by most recent
    const sortedThreads = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const mostRecent = sortedThreads[0]!;
    // Auto-resume the most recent thread for this directory
    try {
      await this.harness.switchThread(mostRecent.id);
    } catch (error) {
      if (error instanceof ThreadLockError) {
        // Defer the lock conflict prompt until after the TUI is started
        this.pendingNewThread = true;
        this.pendingLockConflict = {
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
    const appName = this.options.appName || 'Mastra Code';
    const version = this.options.version || '0.1.0';

    const logo = fg('accent', '◆') + ' ' + bold(fg('accent', appName)) + fg('dim', ` v${version}`);

    const keyStyle = (k: string) => fg('accent', k);
    const sep = fg('dim', ' · ');
    const instructions = [
      `  ${keyStyle('Ctrl+C')} ${fg('muted', 'interrupt/clear')}${sep}${keyStyle('Ctrl+C×2')} ${fg('muted', 'exit')}`,
      `  ${keyStyle('Enter')} ${fg('muted', 'while working → steer')}${sep}${keyStyle('Ctrl+F')} ${fg('muted', '→ queue follow-up')}`,
      `  ${keyStyle('/')} ${fg('muted', 'commands')}${sep}${keyStyle('!')} ${fg('muted', 'shell')}${sep}${keyStyle('Ctrl+T')} ${fg('muted', 'thinking')}${sep}${keyStyle('Ctrl+E')} ${fg('muted', 'tools')}${this.harness.getModes().length > 1 ? `${sep}${keyStyle('⇧Tab')} ${fg('muted', 'mode')}` : ''}`,
    ].join('\n');

    this.ui.addChild(new Spacer(1));
    this.ui.addChild(
      new Text(
        `${logo}
${instructions}`,
        1,
        0,
      ),
    );
    this.ui.addChild(new Spacer(1));

    // Add main containers
    this.ui.addChild(this.chatContainer);
    // Todo progress (between chat and editor, visible only when todos exist)
    this.todoProgress = new TodoProgressComponent();
    this.ui.addChild(this.todoProgress);
    this.ui.addChild(this.editorContainer);
    this.editorContainer.addChild(this.editor);

    // Add footer with two-line status
    this.statusLine = new Text('', 0, 0);
    this.memoryStatusLine = new Text('', 0, 0);
    this.footer.addChild(this.statusLine);
    this.footer.addChild(this.memoryStatusLine);
    this.ui.addChild(this.footer);
    this.updateStatusLine();
    this.refreshModelAuthStatus();

    // Set focus to editor
    this.ui.setFocus(this.editor);
  }

  /**
   * Update the two-line status bar.
   * Line 1: [MODE] provider/model  memory  tokens  think:level
   * Line 2:        ~/path/to/project (branch)
   */
  private updateStatusLine(): void {
    if (!this.statusLine) return;
    const termWidth = (process.stdout.columns || 80) - 1; // buffer to prevent jitter
    const SEP = '  '; // double-space separator between parts

    // --- Determine if we're showing observer/reflector instead of main mode ---
    const omStatus = this.omProgress.status;
    const isObserving = omStatus === 'observing';
    const isReflecting = omStatus === 'reflecting';
    const showOMMode = isObserving || isReflecting;

    // Colors for OM modes
    const OBSERVER_COLOR = mastra.orange; // Mastra orange
    const REFLECTOR_COLOR = mastra.pink; // Mastra pink

    // --- Mode badge ---
    let modeBadge = '';
    let modeBadgeWidth = 0;
    const modes = this.harness.getModes();
    const currentMode = modes.length > 1 ? this.harness.getCurrentMode() : undefined;
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
      if (this.gradientAnimator?.isRunning()) {
        const fade = this.gradientAnimator.getFadeProgress();
        if (fade < 1) {
          const offset = this.gradientAnimator.getOffset() % 1;
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
      this.editor.borderColor = (text: string) =>
        chalk.rgb(Math.floor(br * dim), Math.floor(bg * dim), Math.floor(bb * dim))(text);
    }

    // --- Collect raw data ---
    // Show OM model when observing/reflecting, otherwise main model
    const fullModelId = showOMMode
      ? isObserving
        ? this.harness.getObserverModelId()
        : this.harness.getReflectorModelId()
      : this.harness.getFullModelId();
    // e.g. "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4-20250514"
    const shortModelId = fullModelId.includes('/') ? fullModelId.slice(fullModelId.indexOf('/') + 1) : fullModelId;
    // e.g. "claude-opus-4-6" → "opus 4.6", "claude-sonnet-4-20250514" → "sonnet-4-20250514"
    const tinyModelId = shortModelId.replace(/^claude-/, '').replace(/^(\w+)-(\d+)-(\d{1,2})$/, '$1 $2.$3');

    const homedir = process.env.HOME || process.env.USERPROFILE || '';
    let displayPath = this.projectInfo.rootPath;
    if (homedir && displayPath.startsWith(homedir)) {
      displayPath = '~' + displayPath.slice(homedir.length);
    }
    if (this.projectInfo.gitBranch) {
      displayPath = `${displayPath} (${this.projectInfo.gitBranch})`;
    }

    // --- Helper to style the model ID ---
    const isYolo = (this.harness.getState() as any).yolo === true;
    const styleModelId = (id: string): string => {
      if (!this.modelAuthStatus.hasAuth) {
        const envVar = this.modelAuthStatus.apiKeyEnvVar;
        return fg('dim', id) + fg('error', ' ✗') + fg('muted', envVar ? ` (${envVar})` : ' (no key)');
      }
      // Tinted near-black background from mode color
      const tintBg = modeColor ? tintHex(modeColor, 0.15) : undefined;
      const padded = ` ${id} `;

      if (this.gradientAnimator?.isRunning() && modeColor) {
        const fade = this.gradientAnimator.getFadeProgress();
        if (fade < 1) {
          // During active or fade-out: interpolate gradient toward idle color
          const text = applyGradientSweep(
            padded,
            this.gradientAnimator.getOffset(),
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
      if (this.gradientAnimator?.isRunning()) {
        const fade = this.gradientAnimator.getFadeProgress();
        if (fade < 1) {
          const offset = this.gradientAnimator.getOffset() % 1;
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
        this.bufferingMessages && this.gradientAnimator?.isRunning()
          ? (label: string) =>
              applyGradientSweep(
                label,
                this.gradientAnimator!.getOffset(),
                OBSERVER_COLOR,
                this.gradientAnimator!.getFadeProgress(),
              )
          : undefined;
      const obsLabelStyler =
        this.bufferingObservations && this.gradientAnimator?.isRunning()
          ? (label: string) =>
              applyGradientSweep(
                label,
                this.gradientAnimator!.getOffset(),
                REFLECTOR_COLOR,
                this.gradientAnimator!.getFadeProgress(),
              )
          : undefined;
      const obs = formatObservationStatus(this.omProgress, opts.memCompact, msgLabelStyler);
      const ref = formatReflectionStatus(this.omProgress, opts.memCompact, obsLabelStyler);
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

    this.statusLine.setText(
      result?.styled ??
        shortModeBadge +
          styleModelId(tinyModelId) +
          (isYolo && modeColor ? chalk.bgHex(tintHex(modeColor, 0.25)).hex(tintHex(modeColor, 0.9)).bold(' ⚒ ') : ''),
    );

    // Line 2: hidden — dir only shows on line 1 when it fits
    if (this.memoryStatusLine) {
      this.memoryStatusLine.setText('');
    }

    this.ui.requestRender();
  }

  private async refreshModelAuthStatus(): Promise<void> {
    this.modelAuthStatus = await this.harness.getCurrentModelAuthStatus();
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
    const modes = this.harness.getModes();
    if (modes.length > 1) {
      slashCommands.push({ name: 'mode', description: 'Switch agent mode' });
    }

    // Add custom slash commands to the list
    for (const customCmd of this.customSlashCommands) {
      // Prefix with extra / to distinguish from built-in commands (//command-name)
      slashCommands.push({
        name: `/${customCmd.name}`,
        description: customCmd.description || `Custom: ${customCmd.name}`,
      });
    }

    this.autocompleteProvider = new CombinedAutocompleteProvider(slashCommands, process.cwd());
    this.editor.setAutocompleteProvider(this.autocompleteProvider);
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

      this.customSlashCommands = Array.from(commandMap.values());
    } catch {
      this.customSlashCommands = [];
    }
  }

  private setupKeyHandlers(): void {
    // Handle Ctrl+C via process signal (backup for when editor doesn't capture it)
    process.on('SIGINT', () => {
      const now = Date.now();
      if (now - this.lastCtrlCTime < MastraTUI.DOUBLE_CTRL_C_MS) {
        this.stop();
        process.exit(0);
      }
      this.lastCtrlCTime = now;
      if (this.pendingApprovalDismiss) {
        this.pendingApprovalDismiss();
      }
      this.userInitiatedAbort = true;
      this.harness.abort();
    });

    // Use onDebug callback for Shift+Ctrl+D
    this.ui.onDebug = () => {
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
    this.unsubscribe = this.harness.subscribe(listener);
  }

  private updateTerminalTitle(): void {
    const appName = this.options.appName || 'Mastra Code';
    const cwd = process.cwd().split('/').pop() || '';
    this.ui.terminal.setTitle(`${appName} - ${cwd}`);
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
        await this.harness.loadOMProgress();
        this.syncOMThresholdsFromHarness();
        this.tokenUsage = this.harness.getTokenUsage();
        this.updateStatusLine();
        // Restore todos from thread state
        const threadState = this.harness.getState() as {
          todos?: TodoItem[];
        };
        if (this.todoProgress) {
          this.todoProgress.updateTodos(threadState.todos ?? []);
          this.ui.requestRender();
        }
        break;
      }
      case 'thread_created': {
        this.showInfo(`Created thread: ${event.thread.id}`);
        // Sync inherited resource-level settings
        const tState = this.harness.getState() as any;
        if (typeof tState?.escapeAsCancel === 'boolean') {
          this.editor.escapeEnabled = tState.escapeAsCancel;
        }
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
          this.bufferingMessages = true;
        } else {
          this.bufferingObservations = true;
        }
        this.activeActivationMarker = undefined;
        this.activeBufferingMarker = new OMMarkerComponent({
          type: 'om_buffering_start',
          operationType: event.operationType,
          tokensToBuffer: event.tokensToBuffer,
        });
        this.addOMMarkerToChat(this.activeBufferingMarker);
        this.updateStatusLine();
        this.ui.requestRender();
        break;
      case 'om_buffering_end':
        if (event.operationType === 'observation') {
          this.bufferingMessages = false;
        } else {
          this.bufferingObservations = false;
        }
        if (this.activeBufferingMarker) {
          this.activeBufferingMarker.update({
            type: 'om_buffering_end',
            operationType: event.operationType,
            tokensBuffered: event.tokensBuffered,
            bufferedTokens: event.bufferedTokens,
            observations: event.observations,
          });
        }
        this.activeBufferingMarker = undefined;
        this.updateStatusLine();
        this.ui.requestRender();
        break;

      case 'om_buffering_failed':
        if (event.operationType === 'observation') {
          this.bufferingMessages = false;
        } else {
          this.bufferingObservations = false;
        }
        if (this.activeBufferingMarker) {
          this.activeBufferingMarker.update({
            type: 'om_buffering_failed',
            operationType: event.operationType,
            error: event.error,
          });
        }
        this.activeBufferingMarker = undefined;
        this.updateStatusLine();
        this.ui.requestRender();
        break;
      case 'om_activation':
        if (event.operationType === 'observation') {
          this.bufferingMessages = false;
        } else {
          this.bufferingObservations = false;
        }
        const activationData: OMMarkerData = {
          type: 'om_activation',
          operationType: event.operationType,
          tokensActivated: event.tokensActivated,
          observationTokens: event.observationTokens,
        };
        this.activeActivationMarker = new OMMarkerComponent(activationData);
        this.addOMMarkerToChat(this.activeActivationMarker);
        this.activeBufferingMarker = undefined;
        this.updateStatusLine();
        this.ui.requestRender();
        break;

      case 'follow_up_queued':
        this.showInfo(`Follow-up queued (${event.count} pending)`);
        break;

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

      case 'todo_updated': {
        const todos = event.todos as TodoItem[];
        if (this.todoProgress) {
          this.todoProgress.updateTodos(todos ?? []);

          // Find the most recent todo_write tool component and get its position
          let insertIndex = -1;
          for (let i = this.allToolComponents.length - 1; i >= 0; i--) {
            const comp = this.allToolComponents[i];
            if ((comp as any).toolName === 'todo_write') {
              insertIndex = this.chatContainer.children.indexOf(comp as any);
              this.chatContainer.removeChild(comp as any);
              this.allToolComponents.splice(i, 1);
              break;
            }
          }

          // Check if all todos are completed
          const allCompleted = todos && todos.length > 0 && todos.every(t => t.status === 'completed');
          if (allCompleted) {
            // Show collapsed completed list (pinned/live)
            this.renderCompletedTodosInline(todos, insertIndex, true);
          } else if (this.previousTodos.length > 0 && (!todos || todos.length === 0)) {
            // Tasks were cleared
            this.renderClearedTodosInline(this.previousTodos, insertIndex);
          }

          // Track for next diff
          this.previousTodos = todos ? [...todos] : [];

          this.ui.requestRender();
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
    this.tokenUsage.promptTokens += usage.promptTokens;
    this.tokenUsage.completionTokens += usage.completionTokens;
    this.tokenUsage.totalTokens += usage.totalTokens;
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
    const obsThreshold = this.harness.getObservationThreshold();
    const refThreshold = this.harness.getReflectionThreshold();
    this.omProgress.threshold = obsThreshold;
    this.omProgress.thresholdPercent = obsThreshold > 0 ? (this.omProgress.pendingTokens / obsThreshold) * 100 : 0;
    this.omProgress.reflectionThreshold = refThreshold;
    this.omProgress.reflectionThresholdPercent =
      refThreshold > 0 ? (this.omProgress.observationTokens / refThreshold) * 100 : 0;
    this.updateStatusLine();
  }
  private resetStatusLineState(): void {
    const prev = this.omProgress;
    this.omProgress = {
      ...defaultOMProgressState(),
      // Preserve thresholds across resets
      threshold: prev.threshold,
      reflectionThreshold: prev.reflectionThreshold,
    };
    this.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    this.bufferingMessages = false;
    this.bufferingObservations = false;
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
    if (this.streamingComponent) {
      const idx = this.chatContainer.children.indexOf(this.streamingComponent);
      if (idx >= 0) {
        this.chatContainer.children.splice(idx, 0, marker);
        this.chatContainer.invalidate();
        return;
      }
    }
    this.chatContainer.addChild(marker);
  }

  private addOMOutputToChat(output: OMOutputComponent): void {
    if (this.streamingComponent) {
      const idx = this.chatContainer.children.indexOf(this.streamingComponent);
      if (idx >= 0) {
        this.chatContainer.children.splice(idx, 0, output);
        this.chatContainer.invalidate();
        return;
      }
    }
    this.chatContainer.addChild(output);
  }
  private handleOMStatus(event: Extract<HarnessEvent, { type: 'om_status' }>): void {
    const { windows, generationCount, stepNumber } = event;
    const { active, buffered } = windows;

    // Update active window state
    this.omProgress.pendingTokens = active.messages.tokens;
    this.omProgress.threshold = active.messages.threshold;
    this.omProgress.thresholdPercent =
      active.messages.threshold > 0 ? (active.messages.tokens / active.messages.threshold) * 100 : 0;
    this.omProgress.observationTokens = active.observations.tokens;
    this.omProgress.reflectionThreshold = active.observations.threshold;
    this.omProgress.reflectionThresholdPercent =
      active.observations.threshold > 0 ? (active.observations.tokens / active.observations.threshold) * 100 : 0;

    // Update buffered state
    this.omProgress.buffered = {
      observations: { ...buffered.observations },
      reflection: { ...buffered.reflection },
    };
    this.omProgress.generationCount = generationCount;
    this.omProgress.stepNumber = stepNumber;

    // Drive buffering animation from status fields
    this.bufferingMessages = buffered.observations.status === 'running';
    this.bufferingObservations = buffered.reflection.status === 'running';

    this.updateStatusLine();
  }

  private handleOMObservationStart(cycleId: string, tokensToObserve: number): void {
    this.omProgress.status = 'observing';
    this.omProgress.cycleId = cycleId;
    this.omProgress.startTime = Date.now();
    // Show in-progress marker in chat
    this.activeOMMarker = new OMMarkerComponent({
      type: 'om_observation_start',
      tokensToObserve,
      operationType: 'observation',
    });
    this.addOMMarkerToChat(this.activeOMMarker);
    this.updateStatusLine();
    this.ui.requestRender();
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
    this.omProgress.status = 'idle';
    this.omProgress.cycleId = undefined;
    this.omProgress.startTime = undefined;
    this.omProgress.observationTokens = observationTokens;
    // Messages have been observed — reset pending tokens
    this.omProgress.pendingTokens = 0;
    this.omProgress.thresholdPercent = 0;
    // Remove in-progress marker — the output box replaces it
    if (this.activeOMMarker) {
      const idx = this.chatContainer.children.indexOf(this.activeOMMarker);
      if (idx >= 0) {
        this.chatContainer.children.splice(idx, 1);
        this.chatContainer.invalidate();
      }
      this.activeOMMarker = undefined;
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
    this.ui.requestRender();
  }

  private handleOMReflectionStart(cycleId: string, tokensToReflect: number): void {
    this.omProgress.status = 'reflecting';
    this.omProgress.cycleId = cycleId;
    this.omProgress.startTime = Date.now();
    // Update observation tokens to show the total being reflected
    this.omProgress.observationTokens = tokensToReflect;
    this.omProgress.reflectionThresholdPercent =
      this.omProgress.reflectionThreshold > 0 ? (tokensToReflect / this.omProgress.reflectionThreshold) * 100 : 0;
    // Show in-progress marker in chat
    this.activeOMMarker = new OMMarkerComponent({
      type: 'om_observation_start',
      tokensToObserve: tokensToReflect,
      operationType: 'reflection',
    });
    this.addOMMarkerToChat(this.activeOMMarker);
    this.updateStatusLine();
    this.ui.requestRender();
  }
  private handleOMReflectionEnd(
    _cycleId: string,
    durationMs: number,
    compressedTokens: number,
    observations?: string,
  ): void {
    // Capture the pre-compression observation tokens for the marker display
    const preCompressionTokens = this.omProgress.observationTokens;
    this.omProgress.status = 'idle';
    this.omProgress.cycleId = undefined;
    this.omProgress.startTime = undefined;
    // Observations were compressed — update token count
    this.omProgress.observationTokens = compressedTokens;
    this.omProgress.reflectionThresholdPercent =
      this.omProgress.reflectionThreshold > 0 ? (compressedTokens / this.omProgress.reflectionThreshold) * 100 : 0;
    // Remove in-progress marker — the output box replaces it
    if (this.activeOMMarker) {
      const idx = this.chatContainer.children.indexOf(this.activeOMMarker);
      if (idx >= 0) {
        this.chatContainer.children.splice(idx, 1);
        this.chatContainer.invalidate();
      }
      this.activeOMMarker = undefined;
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
    this.ui.requestRender();
    this.updateStatusLine();
  }

  private handleOMFailed(_cycleId: string, error: string, operation: 'observation' | 'reflection'): void {
    this.omProgress.status = 'idle';
    this.omProgress.cycleId = undefined;
    this.omProgress.startTime = undefined;
    // Update existing marker in-place, or create new one
    const failData: OMMarkerData = {
      type: 'om_observation_failed',
      error,
      operationType: operation,
    };
    if (this.activeOMMarker) {
      this.activeOMMarker.update(failData);
      this.activeOMMarker = undefined;
    } else {
      this.addOMMarkerToChat(new OMMarkerComponent(failData));
    }
    this.updateStatusLine();
    this.ui.requestRender();
  }

  /** Update the loading animation text (e.g., "Working..." → "Observing...") */
  private updateLoaderText(_text: string): void {
    // Status text changes are now reflected via updateStatusLine gradient
    this.updateStatusLine();
  }

  private handleAgentStart(): void {
    this.isAgentActive = true;
    if (!this.gradientAnimator) {
      this.gradientAnimator = new GradientAnimator(() => {
        this.updateStatusLine();
      });
    }
    this.gradientAnimator.start();
    this.updateStatusLine();
  }
  private handleAgentEnd(): void {
    this.isAgentActive = false;
    if (this.gradientAnimator) {
      this.gradientAnimator.fadeOut();
    }
    this.updateStatusLine();

    if (this.streamingComponent) {
      this.streamingComponent = undefined;
      this.streamingMessage = undefined;
    }
    this.followUpComponents = [];
    this.pendingTools.clear();
    // Keep allToolComponents so Ctrl+E continues to work after agent completes

    this.notify('agent_done');
  }

  private handleAgentAborted(): void {
    this.isAgentActive = false;
    if (this.gradientAnimator) {
      this.gradientAnimator.fadeOut();
    }
    this.updateStatusLine();

    // Update streaming message to show it was interrupted
    if (this.streamingComponent && this.streamingMessage) {
      this.streamingMessage.stopReason = 'aborted';
      this.streamingMessage.errorMessage = 'Interrupted';
      this.streamingComponent.updateContent(this.streamingMessage);
      this.streamingComponent = undefined;
      this.streamingMessage = undefined;
    } else if (this.userInitiatedAbort) {
      // Show standalone "Interrupted" if user pressed Ctrl+C but no streaming component
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(new Text(theme.fg('error', 'Interrupted'), 1, 0));
    }
    this.userInitiatedAbort = false;

    this.followUpComponents = [];
    this.pendingTools.clear();
    // Keep allToolComponents so Ctrl+E continues to work after interruption
    this.ui.requestRender();
  }

  private handleAgentError(): void {
    this.isAgentActive = false;
    if (this.gradientAnimator) {
      this.gradientAnimator.fadeOut();
    }
    this.updateStatusLine();

    if (this.streamingComponent) {
      this.streamingComponent = undefined;
      this.streamingMessage = undefined;
    }

    this.followUpComponents = [];
    this.pendingTools.clear();
    // Keep allToolComponents so Ctrl+E continues to work after errors
  }

  private handleMessageStart(message: HarnessMessage): void {
    if (message.role === 'user') {
      this.addUserMessage(message);
    } else if (message.role === 'assistant') {
      // Clear tool component references when starting a new assistant message
      this.lastAskUserComponent = undefined;
      this.lastSubmitPlanComponent = undefined;
      if (!this.streamingComponent) {
        this.streamingComponent = new AssistantMessageComponent(undefined, this.hideThinkingBlock, getMarkdownTheme());
        this.addChildBeforeFollowUps(this.streamingComponent);
        this.streamingMessage = message;
        const trailingParts = this.getTrailingContentParts(message);
        this.streamingComponent.updateContent({
          ...message,
          content: trailingParts,
        });
      }
      this.ui.requestRender();
    }
  }

  private handleMessageUpdate(message: HarnessMessage): void {
    if (!this.streamingComponent || message.role !== 'assistant') return;

    this.streamingMessage = message;
    // Check for new tool calls
    for (const content of message.content) {
      if (content.type === 'tool_call') {
        // For subagent calls, freeze the current streaming component
        // with content before the tool call, then create a new one.
        // SubagentExecutionComponent handles the visual rendering.
        // Check subagentToolCallIds separately since handleToolStart
        // may have already added the ID to seenToolCallIds.
        if (content.name === 'subagent' && !this.subagentToolCallIds.has(content.id)) {
          this.seenToolCallIds.add(content.id);
          this.subagentToolCallIds.add(content.id);
          // Freeze current component with pre-subagent content
          const preContent = this.getContentBeforeToolCall(message, content.id);
          this.streamingComponent.updateContent({
            ...message,
            content: preContent,
          });
          this.streamingComponent = new AssistantMessageComponent(
            undefined,
            this.hideThinkingBlock,
            getMarkdownTheme(),
          );
          this.addChildBeforeFollowUps(this.streamingComponent);
          continue;
        }

        if (!this.seenToolCallIds.has(content.id)) {
          this.seenToolCallIds.add(content.id);

          this.addChildBeforeFollowUps(new Text('', 0, 0));
          const component = new ToolExecutionComponentEnhanced(
            content.name,
            content.args,
            { showImages: false, collapsedByDefault: !this.toolOutputExpanded },
            this.ui,
          );
          component.setExpanded(this.toolOutputExpanded);
          this.addChildBeforeFollowUps(component);
          this.pendingTools.set(content.id, component);
          this.allToolComponents.push(component);

          this.streamingComponent = new AssistantMessageComponent(
            undefined,
            this.hideThinkingBlock,
            getMarkdownTheme(),
          );
          this.addChildBeforeFollowUps(this.streamingComponent);
        } else {
          const component = this.pendingTools.get(content.id);
          if (component) {
            component.updateArgs(content.args);
          }
        }
      }
    }

    const trailingParts = this.getTrailingContentParts(message);
    this.streamingComponent.updateContent({
      ...message,
      content: trailingParts,
    });

    this.ui.requestRender();
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
        (c.type === 'tool_call' && 'id' in c && this.seenToolCallIds.has(c.id)) ||
        (c.type === 'tool_result' && 'id' in c && this.seenToolCallIds.has(c.id))
      ) {
        startIdx = i + 1;
        break;
      }
    }

    return message.content.slice(startIdx, idx).filter(c => c.type === 'text' || c.type === 'thinking');
  }

  private handleMessageEnd(message: HarnessMessage): void {
    if (message.role === 'user') return;

    if (this.streamingComponent && message.role === 'assistant') {
      this.streamingMessage = message;
      const trailingParts = this.getTrailingContentParts(message);
      this.streamingComponent.updateContent({
        ...message,
        content: trailingParts,
      });

      if (message.stopReason === 'aborted' || message.stopReason === 'error') {
        const errorMessage = message.errorMessage || 'Operation aborted';
        for (const [, component] of this.pendingTools) {
          component.updateResult({
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          });
        }
        this.pendingTools.clear();
      }

      this.streamingComponent = undefined;
      this.streamingMessage = undefined;
      this.seenToolCallIds.clear();
      this.subagentToolCallIds.clear();
    }
    this.ui.requestRender();
  }
  /**
   * Insert a child into the chat container before any follow-up user messages.
   * If no follow-ups are pending, appends to end.
   */
  private addChildBeforeFollowUps(child: Component): void {
    if (this.followUpComponents.length > 0) {
      const firstFollowUp = this.followUpComponents[0];
      const idx = this.chatContainer.children.indexOf(firstFollowUp as any);
      if (idx >= 0) {
        (this.chatContainer.children as unknown[]).splice(idx, 0, child);
        this.chatContainer.invalidate();
        return;
      }
    }
    this.chatContainer.addChild(child);
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
        this.ui.hideOverlay();
        this.pendingApprovalDismiss = null;
        if (action.type === 'approve') {
          this.harness.resolveToolApprovalDecision('approve');
        } else if (action.type === 'always_allow_category') {
          this.harness.resolveToolApprovalDecision('always_allow_category');
        } else if (action.type === 'yolo') {
          this.harness.setState({ yolo: true } as any);
          this.harness.resolveToolApprovalDecision('approve');
          this.updateStatusLine();
        } else {
          this.harness.resolveToolApprovalDecision('decline');
        }
      },
    });

    // Set up Ctrl+C dismiss to decline
    this.pendingApprovalDismiss = () => {
      this.ui.hideOverlay();
      this.pendingApprovalDismiss = null;
      this.harness.resolveToolApprovalDecision('decline');
    };

    // Show the dialog as an overlay
    this.ui.showOverlay(dialog, {
      width: '70%',
      anchor: 'center',
    });
    dialog.focused = true;
    this.ui.requestRender();
  }

  private handleToolStart(toolCallId: string, toolName: string, args: unknown): void {
    if (!this.seenToolCallIds.has(toolCallId)) {
      this.seenToolCallIds.add(toolCallId);

      // Skip creating the regular tool component for subagent calls
      // The SubagentExecutionComponent will handle all the rendering
      if (toolName === 'subagent') {
        return;
      }

      this.addChildBeforeFollowUps(new Text('', 0, 0));
      const component = new ToolExecutionComponentEnhanced(
        toolName,
        args,
        { showImages: false, collapsedByDefault: !this.toolOutputExpanded },
        this.ui,
      );
      component.setExpanded(this.toolOutputExpanded);
      this.addChildBeforeFollowUps(component);
      this.pendingTools.set(toolCallId, component);
      this.allToolComponents.push(component);

      // Track ask_user tool components for inline question placement
      if (toolName === 'ask_user') {
        this.lastAskUserComponent = component;
      }
      // Track submit_plan tool components for inline plan approval placement
      if (toolName === 'submit_plan') {
        this.lastSubmitPlanComponent = component;
      }

      // Track file-modifying tools for /diff command
      const FILE_TOOLS = ['string_replace_lsp', 'write_file', 'ast_smart_edit'];
      if (FILE_TOOLS.includes(toolName)) {
        const toolArgs = args as Record<string, unknown>;
        const filePath = toolArgs?.path as string;
        if (filePath) {
          this.pendingFileTools.set(toolCallId, { toolName, filePath });
        }
      }

      // Create a new post-tool AssistantMessageComponent so pre-tool text is preserved
      this.streamingComponent = new AssistantMessageComponent(undefined, this.hideThinkingBlock, getMarkdownTheme());
      this.addChildBeforeFollowUps(this.streamingComponent);

      this.ui.requestRender();
    }
  }

  private handleToolUpdate(toolCallId: string, partialResult: unknown): void {
    const component = this.pendingTools.get(toolCallId);
    if (component) {
      const result: ToolResult = {
        content: [{ type: 'text', text: this.formatToolResult(partialResult) }],
        isError: false,
      };
      component.updateResult(result, true);
      this.ui.requestRender();
    }
  }

  /**
   * Handle streaming shell output from execute_command tool.
   */
  private handleShellOutput(toolCallId: string, output: string, _stream: 'stdout' | 'stderr'): void {
    const component = this.pendingTools.get(toolCallId);
    if (component?.appendStreamingOutput) {
      component.appendStreamingOutput(output);
      this.ui.requestRender();
    }
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
      if (this.options.inlineQuestions) {
        // Inline mode: Add question component to chat
        const questionComponent = new AskQuestionInlineComponent(
          {
            question,
            options,
            onSubmit: answer => {
              this.activeInlineQuestion = undefined;
              this.harness.respondToQuestion(questionId, answer);
              resolve();
            },
            onCancel: () => {
              this.activeInlineQuestion = undefined;
              this.harness.respondToQuestion(questionId, '(skipped)');
              resolve();
            },
          },
          this.ui,
        );

        // Store as active question
        this.activeInlineQuestion = questionComponent;

        // Insert the question right after the ask_user tool component
        if (this.lastAskUserComponent) {
          // Find the position of the ask_user component
          const children = [...this.chatContainer.children];
          // Since lastAskUserComponent extends Container, it should be in children
          const askUserIndex = children.indexOf(this.lastAskUserComponent as any);

          if (askUserIndex >= 0) {
            // Debug: Log the positioning

            // Clear and rebuild with question in the right place
            this.chatContainer.clear();
            // Add all children up to and including the ask_user tool
            for (let i = 0; i <= askUserIndex; i++) {
              this.chatContainer.addChild(children[i]!);
            }

            // Add the question component with spacing
            this.chatContainer.addChild(new Spacer(1));
            this.chatContainer.addChild(questionComponent);
            this.chatContainer.addChild(new Spacer(1));

            // Add remaining children
            for (let i = askUserIndex + 1; i < children.length; i++) {
              this.chatContainer.addChild(children[i]!);
            }
          } else {
            // Fallback: add at the end
            this.chatContainer.addChild(new Spacer(1));
            this.chatContainer.addChild(questionComponent);
            this.chatContainer.addChild(new Spacer(1));
          }
        } else {
          // Fallback: add at the end if no ask_user component tracked
          this.chatContainer.addChild(new Spacer(1));
          this.chatContainer.addChild(questionComponent);
          this.chatContainer.addChild(new Spacer(1));
        }

        this.ui.requestRender();

        // Ensure the chat scrolls to show the question
        this.chatContainer.invalidate();

        // Focus the question component
        questionComponent.focused = true;
      } else {
        // Dialog mode: Show overlay
        const dialog = new AskQuestionDialogComponent({
          question,
          options,
          onSubmit: answer => {
            this.ui.hideOverlay();
            this.harness.respondToQuestion(questionId, answer);
            resolve();
          },
          onCancel: () => {
            this.ui.hideOverlay();
            this.harness.respondToQuestion(questionId, '(skipped)');
            resolve();
          },
        });
        this.ui.showOverlay(dialog, { width: '70%', anchor: 'center' });
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
            this.activeInlineQuestion = undefined;
            this.harness.respondToQuestion(questionId, answer);
            resolve();
          },
          onCancel: () => {
            this.activeInlineQuestion = undefined;
            this.harness.respondToQuestion(questionId, 'No');
            resolve();
          },
          formatResult: answer => {
            const approved = answer.toLowerCase().startsWith('y');
            return approved ? `Granted access to ${requestedPath}` : `Denied access to ${requestedPath}`;
          },
          isNegativeAnswer: answer => !answer.toLowerCase().startsWith('y'),
        },
        this.ui,
      );

      // Store as active question so input routing works
      this.activeInlineQuestion = questionComponent;

      // Add to chat
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(questionComponent);
      this.chatContainer.addChild(new Spacer(1));
      this.ui.requestRender();
      this.chatContainer.invalidate();

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
            this.activeInlinePlanApproval = undefined;
            // Store the approved plan in harness state
            await this.harness.setState({
              activePlan: {
                title,
                plan,
                approvedAt: new Date().toISOString(),
              },
            });
            // Wait for plan approval to complete (switches mode, aborts stream)
            await this.harness.respondToPlanApproval(planId, {
              action: 'approved',
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
            this.activeInlinePlanApproval = undefined;
            this.harness.respondToPlanApproval(planId, {
              action: 'rejected',
              feedback,
            });
            resolve();
          },
        },
        this.ui,
      );

      // Store as active plan approval
      this.activeInlinePlanApproval = approvalComponent;

      // Insert after the submit_plan tool component (same pattern as ask_user)
      if (this.lastSubmitPlanComponent) {
        const children = [...this.chatContainer.children];
        const submitPlanIndex = children.indexOf(this.lastSubmitPlanComponent as any);
        if (submitPlanIndex >= 0) {
          this.chatContainer.clear();
          for (let i = 0; i <= submitPlanIndex; i++) {
            this.chatContainer.addChild(children[i]!);
          }
          this.chatContainer.addChild(new Spacer(1));
          this.chatContainer.addChild(approvalComponent);
          this.chatContainer.addChild(new Spacer(1));
          for (let i = submitPlanIndex + 1; i < children.length; i++) {
            this.chatContainer.addChild(children[i]!);
          }
        } else {
          this.chatContainer.addChild(new Spacer(1));
          this.chatContainer.addChild(approvalComponent);
          this.chatContainer.addChild(new Spacer(1));
        }
      } else {
        this.chatContainer.addChild(new Spacer(1));
        this.chatContainer.addChild(approvalComponent);
        this.chatContainer.addChild(new Spacer(1));
      }
      this.ui.requestRender();
      this.chatContainer.invalidate();
      approvalComponent.focused = true;

      this.notify('plan_approval', `Plan "${title}" requires approval`);
    });
  }
  private handleToolEnd(toolCallId: string, result: unknown, isError: boolean): void {
    // If this is a subagent tool, store the result in the SubagentExecutionComponent
    const subagentComponent = this.pendingSubagents.get(toolCallId);
    if (subagentComponent) {
      // The final result is available here
      const resultText = this.formatToolResult(result);
      // We'll need to wait for subagent_end to set this
      // Store it temporarily
      (subagentComponent as any)._pendingResult = resultText;
    }

    // Track successful file modifications for /diff command
    const pendingFile = this.pendingFileTools.get(toolCallId);
    if (pendingFile && !isError) {
      const existing = this.modifiedFiles.get(pendingFile.filePath);
      if (existing) {
        existing.operations.push(pendingFile.toolName);
      } else {
        this.modifiedFiles.set(pendingFile.filePath, {
          operations: [pendingFile.toolName],
          firstModified: new Date(),
        });
      }
    }
    this.pendingFileTools.delete(toolCallId);

    const component = this.pendingTools.get(toolCallId);
    if (component) {
      const toolResult: ToolResult = {
        content: [{ type: 'text', text: this.formatToolResult(result) }],
        isError,
      };
      component.updateResult(toolResult, false);

      this.pendingTools.delete(toolCallId);
      this.ui.requestRender();
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
   * Render a completed todo list inline in the chat history.
   * This mirrors the pinned TodoProgressComponent format but shows
   * all items as completed, since the pinned component hides itself
   * when everything is done.
   * @param todos The completed todo items
   * @param insertIndex Optional index to insert at (replaces tool component position)
   */
  private renderCompletedTodosInline(todos: TodoItem[], insertIndex = -1, collapsed = false): void {
    const headerText = bold(fg('accent', 'Tasks')) + fg('dim', ` [${todos.length}/${todos.length} completed]`);

    const container = new Container();
    container.addChild(new Spacer(1));
    container.addChild(new Text(headerText, 0, 0));
    const MAX_VISIBLE = 4;
    const shouldCollapse = collapsed && todos.length > MAX_VISIBLE + 1;
    const visible = shouldCollapse ? todos.slice(0, MAX_VISIBLE) : todos;
    const remaining = shouldCollapse ? todos.length - MAX_VISIBLE : 0;

    for (const todo of visible) {
      const icon = chalk.hex(mastra.green)('✓');
      const text = chalk.hex(mastra.green)(todo.content);
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
      // Insert at the position where the todo_write tool was
      this.chatContainer.children.splice(insertIndex, 0, container);
      this.chatContainer.invalidate();
    } else {
      // Fallback: append at end
      this.chatContainer.addChild(container);
    }
  }

  /**
   * Render inline display when tasks are cleared.
   * Shows what was cleared with strikethrough.
   */
  private renderClearedTodosInline(clearedTodos: TodoItem[], insertIndex = -1): void {
    const container = new Container();
    container.addChild(new Spacer(1));
    const count = clearedTodos.length;
    const label = count === 1 ? 'Task' : 'Tasks';
    container.addChild(new Text(fg('accent', `${label} cleared`), 0, 0));
    for (const todo of clearedTodos) {
      const icon = todo.status === 'completed' ? chalk.hex(mastra.green)('✓') : chalk.hex(mastra.darkGray)('○');
      const text = chalk.dim.strikethrough(todo.content);
      container.addChild(new Text(`  ${icon} ${text}`, 0, 0));
    }
    if (insertIndex >= 0) {
      this.chatContainer.children.splice(insertIndex, 0, container);
      this.chatContainer.invalidate();
    } else {
      this.chatContainer.addChild(container);
    }
  }
  // ===========================================================================
  // Subagent Events
  // ===========================================================================

  private handleSubagentStart(toolCallId: string, agentType: string, task: string, modelId?: string): void {
    // Create a dedicated rendering component for this subagent run
    const component = new SubagentExecutionComponent(agentType, task, this.ui, modelId);
    this.pendingSubagents.set(toolCallId, component);
    this.allToolComponents.push(component as any);

    // Insert before the current streamingComponent so subagent box
    // appears between pre-subagent text and post-subagent text
    if (this.streamingComponent) {
      const idx = this.chatContainer.children.indexOf(this.streamingComponent as any);
      if (idx >= 0) {
        (this.chatContainer.children as unknown[]).splice(idx, 0, component);
        this.chatContainer.invalidate();
      } else {
        this.chatContainer.addChild(component);
      }
    } else {
      this.chatContainer.addChild(component);
    }

    this.ui.requestRender();
  }

  private handleSubagentToolStart(toolCallId: string, subToolName: string, subToolArgs: unknown): void {
    const component = this.pendingSubagents.get(toolCallId);
    if (component) {
      component.addToolStart(subToolName, subToolArgs);
      this.ui.requestRender();
    }
  }

  private handleSubagentToolEnd(
    toolCallId: string,
    subToolName: string,
    subToolResult: unknown,
    isError: boolean,
  ): void {
    const component = this.pendingSubagents.get(toolCallId);
    if (component) {
      component.addToolEnd(subToolName, subToolResult, isError);
      this.ui.requestRender();
    }
  }

  private handleSubagentEnd(toolCallId: string, isError: boolean, durationMs: number, result?: string): void {
    const component = this.pendingSubagents.get(toolCallId);
    if (component) {
      component.finish(isError, durationMs, result);
      this.pendingSubagents.delete(toolCallId);
      this.ui.requestRender();
    }
  }

  // ===========================================================================
  // User Input
  // ===========================================================================

  private getUserInput(): Promise<string> {
    return new Promise(resolve => {
      this.editor.onSubmit = (text: string) => {
        // Add to history for arrow up/down navigation (skip empty)
        if (text.trim()) {
          this.editor.addToHistory(text);
        }
        this.editor.setText('');
        resolve(text);
      };
    });
  }

  // ===========================================================================
  // Thread Selector
  // ===========================================================================

  private async showThreadSelector(): Promise<void> {
    const threads = await this.harness.listThreads({ allResources: true });
    const currentId = this.pendingNewThread ? null : this.harness.getCurrentThreadId();
    const currentResourceId = this.harness.getResourceId();

    if (threads.length === 0) {
      this.showInfo('No threads yet. Send a message to create one.');
      return;
    }

    return new Promise(resolve => {
      const selector = new ThreadSelectorComponent({
        tui: this.ui,
        threads,
        currentThreadId: currentId,
        currentResourceId,
        getMessagePreview: async (threadId: string) => {
          const firstUserMessage = await this.harness.getFirstUserMessageForThread(threadId);
          if (firstUserMessage) {
            const text = this.extractTextContent(firstUserMessage);
            return this.truncatePreview(text);
          }
          return null;
        },
        onSelect: async thread => {
          this.ui.hideOverlay();

          if (thread.id === currentId) {
            resolve();
            return;
          }

          // If thread is from a different resource, switch resource first
          if (thread.resourceId !== currentResourceId) {
            this.harness.setResourceId(thread.resourceId);
          }
          try {
            await this.harness.switchThread(thread.id);
          } catch (error) {
            if (error instanceof ThreadLockError) {
              this.showThreadLockPrompt(thread.title || thread.id, error.ownerPid);
              resolve();
              return;
            }
            throw error;
          }
          this.pendingNewThread = false;

          // Clear chat and render existing messages
          this.chatContainer.clear();
          this.allToolComponents = [];
          this.pendingTools.clear();
          await this.renderExistingMessages();
          this.updateStatusLine();

          this.showInfo(`Switched to: ${thread.title || thread.id}`);
          resolve();
        },
        onCancel: () => {
          this.ui.hideOverlay();
          resolve();
        },
      });

      this.ui.showOverlay(selector, {
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
    const threadId = this.harness.getCurrentThreadId();
    if (!threadId && this.pendingNewThread) {
      this.showInfo('No active thread yet — send a message first.');
      return;
    }
    if (!threadId) {
      this.showInfo('No active thread.');
      return;
    }

    const projectPath = (this.harness.getState() as any)?.projectPath as string | undefined;
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
            this.activeInlineQuestion = undefined;
            if (answer.toLowerCase().startsWith('y')) {
              await this.harness.persistThreadSetting('projectPath', projectPath);
            }
            resolve();
          },
          onCancel: () => {
            this.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.ui,
      );

      this.activeInlineQuestion = questionComponent;
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(questionComponent);
      this.chatContainer.addChild(new Spacer(1));
      this.ui.requestRender();
      this.chatContainer.invalidate();
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
          this.activeInlineQuestion = undefined;
          if (answer.toLowerCase().startsWith('y')) {
            // pendingNewThread is already true — thread will be
            // created lazily on first message
          } else {
            process.exit(0);
          }
        },
        onCancel: () => {
          this.activeInlineQuestion = undefined;
          process.exit(0);
        },
      },
      this.ui,
    );

    this.activeInlineQuestion = questionComponent;
    this.chatContainer.addChild(questionComponent);
    this.chatContainer.addChild(new Spacer(1));
    this.ui.requestRender();
    this.chatContainer.invalidate();
  }

  // ===========================================================================
  // Sandbox Management
  // ===========================================================================

  private async handleSandboxCommand(args: string[]): Promise<void> {
    const state = this.harness.getState() as {
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
            this.activeInlineQuestion = undefined;
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
            this.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.ui,
      );

      this.activeInlineQuestion = questionComponent;
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(questionComponent);
      this.chatContainer.addChild(new Spacer(1));
      this.ui.requestRender();
      this.chatContainer.invalidate();
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
            this.activeInlineQuestion = undefined;
            await this.sandboxAddPath(answer);
            resolve();
          },
          onCancel: () => {
            this.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.ui,
      );

      this.activeInlineQuestion = questionComponent;
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(questionComponent);
      this.chatContainer.addChild(new Spacer(1));
      this.ui.requestRender();
      this.chatContainer.invalidate();
    });
  }

  private async sandboxAddPath(rawPath: string): Promise<void> {
    const state = this.harness.getState() as {
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
    this.harness.setState({ sandboxAllowedPaths: updated } as any);
    await this.harness.persistThreadSetting('sandboxAllowedPaths', updated);
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
    this.harness.setState({ sandboxAllowedPaths: updated } as any);
    await this.harness.persistThreadSetting('sandboxAllowedPaths', updated);
    this.showInfo(`Removed from sandbox: ${match}`);
  }

  // ===========================================================================
  // Skills List
  // ===========================================================================

  /**
   * Get the workspace, preferring harness-owned workspace over the direct option.
   */
  private getResolvedWorkspace(): Workspace | undefined {
    return this.harness.getWorkspace() ?? this.workspace;
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
    const modes = this.harness.getModes();
    const currentMode = this.harness.getCurrentMode();

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
            this.activeInlineQuestion = undefined;
            const selected = modeOptions.find(m => m.label === answer);
            if (selected?.modeId && selected?.modeName) {
              await this.showModelScopeThenList(selected.modeId, selected.modeName);
            }
            resolve();
          },
          onCancel: () => {
            this.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.ui,
      );

      this.activeInlineQuestion = questionComponent;
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(questionComponent);
      this.chatContainer.addChild(new Spacer(1));
      this.ui.requestRender();
      this.chatContainer.invalidate();
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
            this.activeInlineQuestion = undefined;
            const selected = scopes.find(s => s.label === answer);
            if (selected) {
              await this.showModelListForScope(selected.scope, modeId, modeName);
            }
            resolve();
          },
          onCancel: () => {
            this.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.ui,
      );

      this.activeInlineQuestion = questionComponent;
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(questionComponent);
      this.chatContainer.addChild(new Spacer(1));
      this.ui.requestRender();
      this.chatContainer.invalidate();
    });
  }

  /**
   * Show the model list for a specific mode and scope.
   */
  private async showModelListForScope(scope: 'global' | 'thread', modeId: string, modeName: string): Promise<void> {
    const availableModels = await this.harness.getAvailableModels();

    if (availableModels.length === 0) {
      this.showInfo('No models available. Check your Mastra configuration.');
      return;
    }

    const currentModelId = this.harness.getCurrentModelId();
    const scopeLabel = scope === 'global' ? `${modeName} · Global` : `${modeName} · Thread`;

    return new Promise(resolve => {
      const selector = new ModelSelectorComponent({
        tui: this.ui,
        models: availableModels,
        currentModelId,
        title: `Select model (${scopeLabel})`,
        onSelect: async (model: ModelItem) => {
          this.ui.hideOverlay();
          await this.harness.switchModel(model.id, scope, modeId);
          this.showInfo(`Model set for ${scopeLabel}: ${model.id}`);
          this.updateStatusLine();
          resolve();
        },
        onCancel: () => {
          this.ui.hideOverlay();
          resolve();
        },
      });

      this.ui.showOverlay(selector, {
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
            this.activeInlineQuestion = undefined;
            const selected = agentTypes.find(t => t.label === answer);
            if (selected) {
              await this.showSubagentScopeThenList(selected.id, selected.label);
            }
            resolve();
          },
          onCancel: () => {
            this.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.ui,
      );

      this.activeInlineQuestion = questionComponent;
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(questionComponent);
      this.chatContainer.addChild(new Spacer(1));
      this.ui.requestRender();
      this.chatContainer.invalidate();
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
            this.activeInlineQuestion = undefined;
            const selected = scopes.find(s => s.label === answer);
            if (selected) {
              await this.showSubagentModelListForScope(selected.scope, agentType, agentTypeLabel);
            }
            resolve();
          },
          onCancel: () => {
            this.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.ui,
      );

      this.activeInlineQuestion = questionComponent;
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(questionComponent);
      this.chatContainer.addChild(new Spacer(1));
      this.ui.requestRender();
      this.chatContainer.invalidate();
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
    const availableModels = await this.harness.getAvailableModels();

    if (availableModels.length === 0) {
      this.showInfo('No models available. Check your Mastra configuration.');
      return;
    }

    // Get current subagent model if set
    const currentSubagentModel = await this.harness.getSubagentModelId(agentType);
    const scopeLabel = scope === 'global' ? `${agentTypeLabel} · Global` : `${agentTypeLabel} · Thread`;

    return new Promise(resolve => {
      const selector = new ModelSelectorComponent({
        tui: this.ui,
        models: availableModels,
        currentModelId: currentSubagentModel ?? undefined,
        title: `Select subagent model (${scopeLabel})`,
        onSelect: async (model: ModelItem) => {
          this.ui.hideOverlay();
          await this.harness.setSubagentModelId(model.id, agentType);
          if (scope === 'global') {
            if (this.authStorage) {
              this.authStorage.setSubagentModelId(model.id, agentType);
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
          this.ui.hideOverlay();
          resolve();
        },
      });

      this.ui.showOverlay(selector, {
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
    const availableModels = await this.harness.getAvailableModels();
    const modelOptions = availableModels.map(m => ({
      id: m.id,
      label: m.id,
    }));

    const config = {
      observerModelId: this.harness.getObserverModelId(),
      reflectorModelId: this.harness.getReflectorModelId(),
      observationThreshold: this.harness.getObservationThreshold(),
      reflectionThreshold: this.harness.getReflectionThreshold(),
    };

    return new Promise<void>(resolve => {
      const settings = new OMSettingsComponent(
        config,
        {
          onObserverModelChange: async modelId => {
            await this.harness.setState({ observerModelId: modelId } as any);
            this.showInfo(`Observer model → ${modelId}`);
          },
          onReflectorModelChange: async modelId => {
            await this.harness.setState({ reflectorModelId: modelId } as any);
            this.showInfo(`Reflector model → ${modelId}`);
          },
          onObservationThresholdChange: value => {
            this.harness.setState({ observationThreshold: value } as any);
            this.omProgress.threshold = value;
            this.omProgress.thresholdPercent = value > 0 ? (this.omProgress.pendingTokens / value) * 100 : 0;
            this.updateStatusLine();
          },
          onReflectionThresholdChange: value => {
            this.harness.setState({ reflectionThreshold: value } as any);
            this.omProgress.reflectionThreshold = value;
            this.omProgress.reflectionThresholdPercent =
              value > 0 ? (this.omProgress.observationTokens / value) * 100 : 0;
            this.updateStatusLine();
          },
          onClose: () => {
            this.ui.hideOverlay();
            this.updateStatusLine();
            resolve();
          },
        },
        modelOptions,
        this.ui,
      );

      this.ui.showOverlay(settings, {
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
    const rules = this.harness.getPermissionRules();
    const grants = this.harness.getSessionGrants();
    const isYolo = (this.harness.getState() as any).yolo === true;

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
    const state = this.harness.getState() as any;
    const config = {
      notifications: (state?.notifications ?? 'off') as NotificationMode,
      yolo: state?.yolo === true,
      thinkingLevel: (state?.thinkingLevel ?? 'off') as string,
      escapeAsCancel: this.editor.escapeEnabled,
    };

    return new Promise<void>(resolve => {
      const settings = new SettingsComponent(config, {
        onNotificationsChange: async mode => {
          await this.harness.setState({ notifications: mode });
          this.showInfo(`Notifications: ${mode}`);
        },
        onYoloChange: enabled => {
          this.harness.setState({ yolo: enabled } as any);
          this.updateStatusLine();
        },
        onThinkingLevelChange: async level => {
          await this.harness.setState({ thinkingLevel: level } as any);
          this.updateStatusLine();
        },
        onEscapeAsCancelChange: async enabled => {
          this.editor.escapeEnabled = enabled;
          await this.harness.setState({ escapeAsCancel: enabled });
          await this.harness.persistThreadSetting('escapeAsCancel', enabled);
        },
        onClose: () => {
          this.ui.hideOverlay();
          resolve();
        },
      });

      this.ui.showOverlay(settings, {
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
    const loggedInIds = allProviders.filter(p => this.authStorage?.isLoggedIn(p.id)).map(p => p.id);

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
            this.activeInlineQuestion = undefined;
            const provider = providers.find(p => p.name === answer);
            if (provider) {
              if (mode === 'login') {
                await this.performLogin(provider.id);
              } else {
                if (this.authStorage) {
                  this.authStorage.logout(provider.id);
                  this.showInfo(`Logged out from ${provider.name}`);
                } else {
                  this.showError('Auth storage not configured');
                }
              }
            }
            resolve();
          },
          onCancel: () => {
            this.activeInlineQuestion = undefined;
            resolve();
          },
        },
        this.ui,
      );

      this.activeInlineQuestion = questionComponent;
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(questionComponent);
      this.chatContainer.addChild(new Spacer(1));
      this.ui.requestRender();
      this.chatContainer.invalidate();
    });
  }

  private async performLogin(providerId: string): Promise<void> {
    const provider = getOAuthProviders().find(p => p.id === providerId);
    const providerName = provider?.name || providerId;

    if (!this.authStorage) {
      this.showError('Auth storage not configured');
      return;
    }

    return new Promise(resolve => {
      const dialog = new LoginDialogComponent(this.ui, providerId, (success, message) => {
        this.ui.hideOverlay();
        if (success) {
          this.showInfo(`Successfully logged in to ${providerName}`);
        } else if (message) {
          this.showInfo(message);
        }
        resolve();
      });

      // Show as overlay - same size as model selector
      this.ui.showOverlay(dialog, {
        width: '80%',
        maxHeight: '60%',
        anchor: 'center',
      });
      dialog.focused = true;

      this.authStorage
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
          this.ui.hideOverlay();

          // Auto-switch to the provider's default model
          const defaultModel = this.authStorage?.getDefaultModelForProvider(providerId as any);
          if (defaultModel) {
            await this.harness.switchModel(defaultModel);
            this.updateStatusLine();
            this.showInfo(`Logged in to ${providerName} - switched to ${defaultModel}`);
          } else {
            this.showInfo(`Successfully logged in to ${providerName}`);
          }

          resolve();
        })
        .catch((error: Error) => {
          this.ui.hideOverlay();
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
    if (this.omProgress.observationTokens > 0) {
      omTokensText = `
  Memory:     ${formatNumber(this.omProgress.observationTokens)} tokens`;
    }

    this.showInfo(`Token Usage (Current Thread):
  Input:      ${formatNumber(this.tokenUsage.promptTokens)} tokens
  Output:     ${formatNumber(this.tokenUsage.completionTokens)} tokens${omTokensText}
  ─────────────────────────────────────────
  Total:      ${formatNumber(this.tokenUsage.totalTokens)} tokens
  
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
      const customCommand = this.customSlashCommands.find(cmd => cmd.name === cmdName);
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
        this.pendingNewThread = true;
        this.chatContainer.clear();
        this.pendingTools.clear();
        this.allToolComponents = [];
        this.modifiedFiles.clear();
        this.pendingFileTools.clear();
        this.resetStatusLineState();
        this.ui.requestRender();
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
        const modes = this.harness.getModes();
        if (modes.length <= 1) {
          this.showInfo('Only one mode available');
          return true;
        }
        if (args[0]) {
          await this.harness.switchMode(args[0]);
        } else {
          const currentMode = this.harness.getCurrentMode();
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
        const currentLevel = ((this.harness.getState() as any)?.thinkingLevel ?? 'off') as string;
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
        await this.harness.setState({ thinkingLevel: next.id } as any);
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
          this.harness.setPermissionCategory(category, policy);
          this.showInfo(`Set ${category} policy to: ${policy}`);
          return true;
        }
        await this.showPermissions();
        return true;
      }
      case 'yolo': {
        const current = (this.harness.getState() as any).yolo === true;
        this.harness.setState({ yolo: !current } as any);
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
        if (!this.harness.getCurrentThreadId()) {
          this.showInfo('No active thread. Send a message first.');
          return true;
        }
        await this.harness.renameThread(title);
        this.showInfo(`Thread renamed to: ${title}`);
        return true;
      }
      case 'resource': {
        const sub = args[0]?.trim();
        const current = this.harness.getResourceId();
        const defaultId = this.harness.getDefaultResourceId();

        if (!sub) {
          // Show current resource ID and list known ones
          const knownIds = await this.harness.getKnownResourceIds();
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
          this.harness.setResourceId(defaultId);
          this.pendingNewThread = true;
          this.chatContainer.clear();
          this.pendingTools.clear();
          this.allToolComponents = [];
          this.resetStatusLineState();
          this.ui.requestRender();
          this.showInfo(`Resource ID reset to: ${defaultId}`);
        } else {
          const newId = args.join(' ').trim();
          this.harness.setResourceId(newId);
          this.pendingNewThread = true;
          this.chatContainer.clear();
          this.pendingTools.clear();
          this.allToolComponents = [];
          this.resetStatusLineState();
          this.ui.requestRender();
          this.showInfo(`Switched to resource: ${newId}`);
        }
        return true;
      }

      case 'exit':
        this.stop();
        process.exit(0);

      case 'help': {
        const modes = this.harness.getModes();
        const modeHelp = modes.length > 1 ? '\n/mode     - Switch or list modes' : '';

        // Build custom commands help
        let customCommandsHelp = '';
        if (this.customSlashCommands.length > 0) {
          customCommandsHelp =
            '\n\nCustom commands (use // prefix):\n' +
            this.customSlashCommands
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
        const hm = this.hookManager;
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
        const mm = this.mcpManager;
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
        const customCommand = this.customSlashCommands.find(cmd => cmd.name === command);
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
    if (!this.harness.hasModelSelected()) {
      this.showInfo('No model selected. Use /models to select a model, or /login to authenticate.');
      return;
    }

    // Ensure thread exists
    if (this.pendingNewThread) {
      await this.harness.createThread();
      this.pendingNewThread = false;
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
    this.ui.requestRender();

    // Send to the agent
    this.harness.sendMessage(prompt).catch(error => {
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
        this.allSlashCommandComponents.push(slashComp);
        this.chatContainer.addChild(slashComp);
        this.ui.requestRender();

        // Wrap in <slash-command> tags so the assistant sees the full
        // content but addUserMessage won't double-render it.
        const wrapped = `<slash-command name="${command.name}">\n${processedContent.trim()}\n</slash-command>`;
        await this.harness.sendMessage(wrapped);
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
      this.chatContainer.addChild(new Spacer(1));
      this.chatContainer.addChild(reminderComponent);
      this.ui.requestRender();
      return;
    }

    // Check for slash command tags
    const slashCommandMatch = displayText.match(/<slash-command\s+name="([^"]*)">([\s\S]*?)<\/slash-command>/);
    if (slashCommandMatch) {
      const commandName = slashCommandMatch[1]!;
      const commandContent = slashCommandMatch[2]!.trim();
      const slashComp = new SlashCommandComponent(commandName, commandContent);
      this.allSlashCommandComponents.push(slashComp);
      this.chatContainer.addChild(slashComp);
      this.ui.requestRender();
      return;
    }

    const prefix = imageCount > 0 ? `[${imageCount} image${imageCount > 1 ? 's' : ''}] ` : '';
    if (displayText || prefix) {
      const userComponent = new UserMessageComponent(prefix + displayText);

      // Always append to end — follow-ups should stay at the bottom
      this.chatContainer.addChild(userComponent);

      // Track follow-up components sent while streaming so tool calls
      // can be inserted before them (keeping them anchored at bottom).
      // Only track if the agent is already streaming a response — otherwise
      // this is the initial message that triggers the response, not a follow-up.
      if (this.isAgentActive && this.streamingComponent) {
        this.followUpComponents.push(userComponent);
      }
    }
  }

  private async renderExistingMessages(): Promise<void> {
    this.chatContainer.clear();
    this.pendingTools.clear();
    this.allToolComponents = [];

    const messages = await this.harness.getMessages({ limit: 40 });

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
                this.hideThinkingBlock,
                getMarkdownTheme(),
              );
              this.chatContainer.addChild(textComponent);
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
                this.ui,
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
              this.chatContainer.addChild(subComponent);
              this.allToolComponents.push(subComponent as any);
              continue;
            }

            // Render the tool call
            const toolComponent = new ToolExecutionComponentEnhanced(
              content.name,
              content.args,
              {
                showImages: false,
                collapsedByDefault: !this.toolOutputExpanded,
              },
              this.ui,
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

            // If this was todo_write with all completed or cleared, show inline instead of tool component
            let replacedWithInline = false;
            if (content.name === 'todo_write' && toolResult?.type === 'tool_result' && !toolResult.isError) {
              const args = content.args as { todos?: TodoItem[] } | undefined;
              const todos = args?.todos;
              if (todos && todos.length > 0 && todos.every(t => t.status === 'completed')) {
                this.renderCompletedTodosInline(todos);
                replacedWithInline = true;
              } else if (!todos || todos.length === 0) {
                // Tasks were cleared - show with previous todos if we have them
                if (this.previousTodos.length > 0) {
                  this.renderClearedTodosInline(this.previousTodos);
                  this.previousTodos = [];
                  replacedWithInline = true;
                }
              } else {
                // Track for detecting clears
                this.previousTodos = [...todos];
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
                this.chatContainer.addChild(planResult);
                replacedWithInline = true;
              }
            }

            if (!replacedWithInline) {
              this.chatContainer.addChild(toolComponent);
              this.allToolComponents.push(toolComponent);
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
                this.hideThinkingBlock,
                getMarkdownTheme(),
              );
              this.chatContainer.addChild(textComponent);
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
              this.chatContainer.addChild(outputComponent);
            } else {
              // Failed marker
              this.chatContainer.addChild(new OMMarkerComponent(content));
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
          const textComponent = new AssistantMessageComponent(textMessage, this.hideThinkingBlock, getMarkdownTheme());
          this.chatContainer.addChild(textComponent);
        }
      }
    }

    this.ui.requestRender();
  }

  // ===========================================================================
  // UI Helpers
  // ===========================================================================

  private showError(message: string): void {
    this.chatContainer.addChild(new Spacer(1));
    this.chatContainer.addChild(new Text(fg('error', `Error: ${message}`), 1, 0));
    this.ui.requestRender();
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

    this.chatContainer.addChild(new Spacer(1));

    // Check if this is a tool validation error
    const errorMessage = error.message || String(error);
    const isValidationError =
      errorMessage.toLowerCase().includes('validation failed') ||
      errorMessage.toLowerCase().includes('required parameter') ||
      errorMessage.includes('Required');

    if (isValidationError) {
      // Show a simplified message for validation errors
      this.chatContainer.addChild(new Text(fg('error', 'Tool validation error - see details above'), 1, 0));
      this.chatContainer.addChild(
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

      this.chatContainer.addChild(new Text(fg('error', errorText), 1, 0));

      // Add helpful hints based on error type
      const hint = this.getErrorHint(parsed.type);
      if (hint) {
        this.chatContainer.addChild(new Text(fg('muted', `  Hint: ${hint}`), 1, 0));
      }
    }

    this.ui.requestRender();
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
          this.chatContainer.addChild(component);
          this.ui.requestRender();
          return;
        }

        const component = new DiffOutputComponent(`git diff ${filePath}`, result.stdout);
        this.chatContainer.addChild(component);
        this.ui.requestRender();
      } catch (error) {
        this.showError(error instanceof Error ? error.message : 'Failed to get diff');
      }
      return;
    }

    // No path specified — show summary of all tracked modified files
    if (this.modifiedFiles.size === 0) {
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
          this.chatContainer.addChild(component);
          this.ui.requestRender();
        } else {
          this.showInfo('No file changes detected in this session or working tree.');
        }
      } catch {
        this.showInfo('No file changes tracked in this session.');
      }
      return;
    }

    const lines: string[] = [`Modified files (${this.modifiedFiles.size}):`];
    for (const [filePath, info] of this.modifiedFiles) {
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
      this.chatContainer.addChild(component);
      this.ui.requestRender();
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Shell command failed');
    }
  }
  /**
   * Send a notification alert (bell / system / hooks) based on user settings.
   */
  private notify(reason: NotificationReason, message?: string): void {
    const mode = ((this.harness.getState() as any)?.notifications ?? 'off') as NotificationMode;
    sendNotification(reason, {
      mode,
      message,
      hookManager: this.hookManager,
    });
  }

  private showInfo(message: string): void {
    this.chatContainer.addChild(new Spacer(1));
    this.chatContainer.addChild(new Text(fg('muted', message), 1, 0));
    this.ui.requestRender();
  }
}
