/**
 * Shared TUI state — the single source of truth for all mutable state
 * in the Mastra TUI. Extracted so that slash commands, event handlers,
 * and other modules can operate on the state without coupling to the
 * MastraTUI class.
 */
import { Container, TUI, ProcessTerminal } from '@mariozechner/pi-tui';
import type { CombinedAutocompleteProvider, Text } from '@mariozechner/pi-tui';
import type { Harness, HarnessMessage } from '@mastra/core/harness';
import type { Workspace } from '@mastra/core/workspace';
import type { AuthStorage } from '../auth/storage.js';
import type { HookManager } from '../hooks/index.js';
import type { McpManager } from '../mcp/manager.js';
import type { OnboardingInlineComponent } from '../onboarding/onboarding-inline.js';
import { detectProject } from '../utils/project.js';
import type { ProjectInfo } from '../utils/project.js';
import type { SlashCommandMetadata } from '../utils/slash-command-loader.js';
import type { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import type { AssistantMessageComponent } from './components/assistant-message.js';
import { CustomEditor } from './components/custom-editor.js';

import type { GradientAnimator } from './components/obi-loader.js';
import type { OMMarkerComponent } from './components/om-marker.js';
import type { OMProgressComponent } from './components/om-progress.js';
import type { PlanApprovalInlineComponent } from './components/plan-approval-inline.js';
import type { SlashCommandComponent } from './components/slash-command.js';
import type { SubagentExecutionComponent } from './components/subagent-execution.js';
import type { TaskProgressComponent } from './components/task-progress.js';
import type { IToolExecutionComponent } from './components/tool-execution-interface.js';
import type { UserMessageComponent } from './components/user-message.js';
import { getEditorTheme } from './theme.js';
// =============================================================================
// MastraTUIOptions
// =============================================================================

export interface MastraTUIOptions {
  /** The harness instance to control */
  harness: Harness<any>;

  /** Hook manager for session lifecycle hooks */
  hookManager?: HookManager;

  /** Auth storage for OAuth login/logout */
  authStorage?: AuthStorage;

  /** MCP manager for server status and reload */
  mcpManager?: McpManager;

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
// TUIState
// =============================================================================

export interface TUIState {
  // ── Core dependencies (set once) ──────────────────────────────────────
  harness: Harness<any>;
  options: MastraTUIOptions;
  hookManager?: HookManager;
  authStorage?: AuthStorage;
  mcpManager?: McpManager;
  workspace?: Workspace;

  // ── TUI framework (set once) ──────────────────────────────────────────
  ui: TUI;
  chatContainer: Container;
  editorContainer: Container;
  editor: CustomEditor;
  footer: Container;
  terminal: ProcessTerminal;

  // ── Agent / streaming ─────────────────────────────────────────────────
  isInitialized: boolean;
  gradientAnimator?: GradientAnimator;
  streamingComponent?: AssistantMessageComponent;
  streamingMessage?: HarnessMessage;
  pendingTools: Map<string, IToolExecutionComponent>;
  /** Position hint for task_write inline rendering when streaming */
  taskWriteInsertIndex: number;
  /** Track all tool IDs seen during current stream (prevents duplicates) */
  seenToolCallIds: Set<string>;
  /** Track subagent tool call IDs to skip in trailing content logic */
  subagentToolCallIds: Set<string>;
  /** Track all tools for expand/collapse */
  allToolComponents: IToolExecutionComponent[];
  /** Track slash command boxes for expand/collapse */
  allSlashCommandComponents: SlashCommandComponent[];
  /** Track active subagent tasks */
  pendingSubagents: Map<string, SubagentExecutionComponent>;
  toolOutputExpanded: boolean;
  hideThinkingBlock: boolean;

  // ── Thread / conversation ─────────────────────────────────────────────
  /** True when we want a new thread but haven't created it yet */
  pendingNewThread: boolean;
  pendingLockConflict: { threadTitle: string; ownerPid: number } | null;

  // ── Inline interaction ────────────────────────────────────────────────
  /** Track the most recent ask_user tool for inline question placement */
  lastAskUserComponent?: IToolExecutionComponent;
  /** Saved editor text for Ctrl+Z undo */
  lastClearedText: string;
  activeInlineQuestion?: AskQuestionInlineComponent;
  activeInlinePlanApproval?: PlanApprovalInlineComponent;
  activeOnboarding?: OnboardingInlineComponent;
  lastSubmitPlanComponent?: IToolExecutionComponent;
  /** Follow-up messages sent via Ctrl+F while streaming */
  followUpComponents: UserMessageComponent[];
  /** Slash commands queued via Ctrl+F while the agent is running */
  pendingSlashCommands: string[];
  /** Active approval dialog dismiss callback — called on Ctrl+C to unblock the dialog */
  pendingApprovalDismiss: (() => void) | null;

  // ── Status line ───────────────────────────────────────────────────────
  projectInfo: ProjectInfo;
  statusLine?: Text;
  memoryStatusLine?: Text;
  modelAuthStatus: { hasAuth: boolean; apiKeyEnvVar?: string };

  // ── Observational Memory ──────────────────────────────────────────────
  omProgressComponent?: OMProgressComponent;
  activeOMMarker?: OMMarkerComponent;
  activeBufferingMarker?: OMMarkerComponent;
  activeActivationMarker?: OMMarkerComponent;

  // ── Tasks ─────────────────────────────────────────────────────────────
  taskProgress?: TaskProgressComponent;

  // ── Input ─────────────────────────────────────────────────────────────
  autocompleteProvider?: CombinedAutocompleteProvider;
  customSlashCommands: SlashCommandMetadata[];
  /** Pending images from clipboard paste */
  pendingImages: Array<{ data: string; mimeType: string }>;

  // ── Abort tracking ────────────────────────────────────────────────────
  lastCtrlCTime: number;
  /** Track user-initiated aborts (Ctrl+C/Esc) vs system aborts */
  userInitiatedAbort: boolean;

  // ── Cleanup ───────────────────────────────────────────────────────────
  unsubscribe?: () => void;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create the initial TUIState from options.
 * Instantiates TUI framework objects (terminal, containers, editor)
 * and sets all mutable fields to their defaults.
 */
export function createTUIState(options: MastraTUIOptions): TUIState {
  const terminal = new ProcessTerminal();
  const ui = new TUI(terminal);
  const chatContainer = new Container();
  const editorContainer = new Container();
  const footer = new Container();
  const editor = new CustomEditor(ui, getEditorTheme());

  return {
    // Core dependencies
    harness: options.harness,
    options,
    hookManager: options.hookManager,
    authStorage: options.authStorage,
    mcpManager: options.mcpManager,
    workspace: options.workspace,

    // TUI framework
    ui,
    chatContainer,
    editorContainer,
    editor,
    footer,
    terminal,

    // Agent / streaming
    isInitialized: false,
    pendingTools: new Map(),
    taskWriteInsertIndex: -1,
    seenToolCallIds: new Set(),
    subagentToolCallIds: new Set(),
    allToolComponents: [],
    allSlashCommandComponents: [],
    pendingSubagents: new Map(),
    toolOutputExpanded: false,
    hideThinkingBlock: true,

    // Thread / conversation
    pendingNewThread: false,
    pendingLockConflict: null,

    // Inline interaction
    lastClearedText: '',
    followUpComponents: [],
    pendingSlashCommands: [],
    pendingApprovalDismiss: null,

    // Status line
    projectInfo: detectProject(process.cwd()),
    modelAuthStatus: { hasAuth: true },

    // Input
    customSlashCommands: [],
    pendingImages: [],

    // Abort tracking
    lastCtrlCTime: 0,
    userInitiatedAbort: false,
  };
}
