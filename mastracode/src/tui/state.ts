/**
 * Shared TUI state — the single source of truth for all mutable state
 * in the Mastra TUI. Extracted so that slash commands, event handlers,
 * and other modules can operate on the state without coupling to the
 * MastraTUI class.
 */
import { Container, TUI, ProcessTerminal } from '@earendil-works/pi-tui';
import type { CombinedAutocompleteProvider, Component, Terminal, Text } from '@earendil-works/pi-tui';
import type { AgentController, AgentControllerMessage, Session } from '@mastra/core/agent-controller';
import type { SkillMetadata, Workspace } from '@mastra/core/workspace';
import type { GithubSignals } from '@mastra/github-signals';
import type { MastraCodeAnalytics } from '../analytics.js';
import type { AuthStorage } from '../auth/storage.js';
import type { HookManager } from '../hooks/index.js';
import type { McpManager } from '../mcp/manager.js';
import type { OnboardingInlineComponent } from '../onboarding/onboarding-inline.js';
import { loadSettings } from '../onboarding/settings.js';
import type { PluginManager } from '../plugins/manager.js';
import { detectProject } from '../utils/project.js';
import type { ProjectInfo } from '../utils/project.js';
import type { SlashCommandMetadata } from '../utils/slash-command-loader.js';
import type { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import type { AssistantMessageComponent } from './components/assistant-message.js';
import { CustomEditor } from './components/custom-editor.js';
import type { IdleCounterComponent } from './components/idle-counter.js';
import type { JudgeDisplayComponent } from './components/judge-display.js';
import type { GradientAnimator } from './components/obi-loader.js';
import type { OMMarkerComponent, OMMarkerData } from './components/om-marker.js';
import type { OMProgressComponent } from './components/om-progress.js';
import type { PlanApprovalInlineComponent } from './components/plan-approval-inline.js';
import type { ShellStreamComponent } from './components/shell-output.js';
import type { SlashCommandComponent } from './components/slash-command.js';
import type { SubagentExecutionComponent } from './components/subagent-execution.js';
import type { SystemReminderComponent } from './components/system-reminder.js';
import type { TaskProgressComponent } from './components/task-progress.js';
import type { TemporalGapComponent } from './components/temporal-gap.js';
import type { IToolExecutionComponent } from './components/tool-execution-interface.js';
import type { UserMessageComponent } from './components/user-message.js';
import { showError, showInfo } from './display.js';

import { GoalManager } from './goal-manager.js';
import { getEditorTheme, mastra, TERM_WIDTH_BUFFER } from './theme.js';
import { VoiceController } from './voice/voice-controller.js';

export interface PendingSignalMessage {
  component: Component;
  text: string;
  images?: Array<{ data: string; mimeType: string }>;
  isInterjection?: boolean;
}

export interface GithubPrSubscriptionBadge {
  owner?: string;
  repo?: string;
  prNumber: number;
  lastSyncStatus?: string;
  lastNotificationKind?: string;
  lastNotificationPriority?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function getGithubPrSubscriptionsFromMetadata(
  metadata: Record<string, unknown> | undefined,
): GithubPrSubscriptionBadge[] {
  const mastraMetadata = isRecord(metadata?.mastra) ? metadata.mastra : undefined;
  const githubSignals = isRecord(mastraMetadata?.githubSignals) ? mastraMetadata.githubSignals : undefined;
  const subscriptions = Array.isArray(githubSignals?.subscriptions) ? githubSignals.subscriptions : [];
  const result: GithubPrSubscriptionBadge[] = [];
  for (const subscription of subscriptions) {
    if (!isRecord(subscription)) continue;
    const prNumber = typeof subscription.number === 'number' ? subscription.number : undefined;
    if (!prNumber) continue;
    result.push({
      prNumber,
      ...(typeof subscription.owner === 'string' ? { owner: subscription.owner } : {}),
      ...(typeof subscription.repo === 'string' ? { repo: subscription.repo } : {}),
      ...(typeof subscription.lastSyncStatus === 'string' ? { lastSyncStatus: subscription.lastSyncStatus } : {}),
      ...(typeof subscription.lastNotificationKind === 'string'
        ? { lastNotificationKind: subscription.lastNotificationKind }
        : {}),
      ...(typeof subscription.lastNotificationPriority === 'string'
        ? { lastNotificationPriority: subscription.lastNotificationPriority }
        : {}),
    });
  }
  return result.sort((a, b) => a.prNumber - b.prNumber);
}
// =============================================================================
// MastraTUIOptions
// =============================================================================

export interface MastraTUIOptions {
  /** The controller instance */
  controller: AgentController<any>;

  /** The session created from the controller that all work runs through */
  session: Session<any>;

  /** Hook manager for session lifecycle hooks */
  hookManager?: HookManager;

  /** Analytics client for product telemetry */
  analytics?: MastraCodeAnalytics;

  /** Auth storage for OAuth login/logout */
  authStorage?: AuthStorage;

  /** MCP manager for server status and reload */
  mcpManager?: McpManager;

  /** Plugin manager for /plugins. */
  pluginManager?: PluginManager;

  /**
   * @deprecated Workspace is now obtained from the AgentController.
   * Configure workspace via AgentControllerConfig.workspace instead.
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

  /** GitHub PR signal processor used for status-line polling state. */
  githubSignals?: GithubSignals;

  /** Optional terminal injection for in-process tests. Defaults to ProcessTerminal. */
  terminal?: Terminal;
}

// =============================================================================
// TUIState
// =============================================================================

export interface TUIState {
  // ── Core dependencies (set once) ──────────────────────────────────────
  controller: AgentController<any>;
  session: Session<any>;
  options: MastraTUIOptions;
  hookManager?: HookManager;
  analytics?: MastraCodeAnalytics;
  authStorage?: AuthStorage;
  mcpManager?: McpManager;
  pluginManager?: PluginManager;
  workspace?: Workspace;

  // ── TUI framework (set once) ──────────────────────────────────────────
  ui: TUI;
  chatContainer: Container;
  editorContainer: Container;
  idleCounter?: IdleCounterComponent;
  lastRenderedMessageAt?: number;
  editor: CustomEditor;
  footer: Container;
  terminal: Terminal;
  voiceController?: VoiceController;

  // ── Agent / streaming ─────────────────────────────────────────────────
  isInitialized: boolean;
  gradientAnimator?: GradientAnimator;
  streamingComponent?: AssistantMessageComponent;
  streamingMessage?: AgentControllerMessage;
  pendingTools: Map<string, IToolExecutionComponent>;
  /** Task tools are hidden on success but promoted to normal tool boxes on errors */
  pendingTaskToolIds: Set<string>;
  /** Position hint for inline task-tool rendering when streaming */
  taskToolInsertIndex: number;
  /** Track all tool IDs seen during current stream (prevents duplicates) */
  seenToolCallIds: Set<string>;
  /** Track subagent tool call IDs to skip in trailing content logic */
  subagentToolCallIds: Set<string>;
  /** Track streamed system reminders for the active assistant run */
  currentRunSystemReminderKeys: Set<string>;
  /** Track all tools for expand/collapse */
  allToolComponents: IToolExecutionComponent[];
  /** Track slash command boxes for expand/collapse */
  allSlashCommandComponents: SlashCommandComponent[];
  /** Track inline system reminders for expand/collapse */
  allSystemReminderComponents: Array<SystemReminderComponent | TemporalGapComponent>;
  /** Track rendered message components by message id for anchored inserts */
  messageComponentsById: Map<string, Component>;
  /** Track shell passthrough components for expand/collapse */
  allShellComponents: ShellStreamComponent[];
  /** Track active subagent tasks */
  pendingSubagents: Map<string, SubagentExecutionComponent>;
  toolOutputExpanded: boolean;
  hideThinkingBlock: boolean;
  quietMode: boolean;
  quietModeMaxToolPreviewLines: number;
  /** Active goal judge status-line override while evaluating the last turn. */
  activeGoalJudge?: { modelId: string; abortController: AbortController; component: JudgeDisplayComponent };

  // ── Thread / conversation ─────────────────────────────────────────────
  /** True when we want a new thread but haven't created it yet */
  pendingNewThread: boolean;
  /** Current thread title (for display in status line) */
  currentThreadTitle?: string;
  /** GitHub PR subscriptions for the current thread. */
  activeGithubPrSubscriptions: GithubPrSubscriptionBadge[];
  /** Cached thread previews for the current TUI session */
  threadPreviewCache: Map<string, { preview: string; updatedAt: number }>;
  /** Threads whose preview lookup already returned empty during this session */
  attemptedThreadPreviewIds: Set<string>;

  // ── Inline interaction ────────────────────────────────────────────────
  /** Track the most recent ask_user component for inline question activation */
  lastAskUserComponent?: AskQuestionInlineComponent;
  /** Map toolCallId → AskQuestionInlineComponent for streaming arg updates */
  pendingAskUserComponents: Map<string, AskQuestionInlineComponent>;
  /** Saved editor text for Alt+Z undo */
  lastClearedText: string;
  activeInlineQuestion?: AskQuestionInlineComponent;
  /** Queue of pending inline questions waiting to be shown (when one is already active) */
  pendingInlineQuestions: Array<() => void>;
  activeInlinePlanApproval?: PlanApprovalInlineComponent;
  activeOnboarding?: OnboardingInlineComponent;
  lastSubmitPlanComponent?: Component;
  pendingSubmitPlanComponents: Map<string, PlanApprovalInlineComponent>;
  /** Previous plan snapshot (keyed by plan file path) for diff display on resubmission */
  previousPlanSnapshot?: { path: string; plan: string };
  /** User-message follow-ups queued while the agent is running */
  pendingFollowUpMessages: Array<{ content: string; images?: Array<{ data: string; mimeType: string }> }>;
  /** FIFO ordering across queued follow-up messages and slash commands */
  pendingQueuedActions: Array<'message' | 'slash'>;
  /** Follow-up messages rendered while streaming so tool output stays above them */
  followUpComponents: UserMessageComponent[];
  /** Pending signal messages waiting for the stream echo */
  pendingSignalMessageComponentsById: Map<string, PendingSignalMessage>;
  /** Slash commands queued while the agent is running */
  pendingSlashCommands: string[];
  /** Pending user-message component ids for queued slash commands */
  pendingSlashCommandMessageIds: string[];
  /** Active approval dialog dismiss callback — called on Ctrl+C or user interruption to unblock the dialog */
  pendingApprovalDismiss: ((context?: { reason?: string; message?: string }) => void) | null;

  // ── Status line ───────────────────────────────────────────────────────
  projectInfo: ProjectInfo;
  statusLine?: Text;
  memoryStatusLine?: Text;
  modelAuthStatus: { hasAuth: boolean; apiKeyEnvVar?: string };
  githubPrGradientAnimator?: GradientAnimator;
  githubPrPollingActive: boolean;
  /** Timestamp (ms) when the current agent run started. */
  agentRunStartedAt?: number;
  /** Timestamp (ms) when the current agent run last received streamed content. */
  agentRunLastStreamPartAt?: number;
  /** Duration (ms) of the most recently completed agent run. */
  lastAgentRunDurationMs?: number;
  /** Timestamp (ms) when the most recent agent run ended. */
  lastAgentRunEndedAt?: number;
  /** End state of the most recent agent run. */
  lastAgentRunEndReason?: 'done' | 'aborted' | 'error';

  // ── Tokens/sec tracking ────────────────────────────────────────────────
  /**
   * Timestamp (ms) of the first streamed content delta of the current step —
   * i.e. when decoding began. tokens/sec is measured over decode time only
   * (excludes TTFT and inter-step tool gaps). 0 means decode not yet started.
   */
  decodeStartedAt: number;
  /** Current computed tokens/sec rate (0 when idle) */
  tokensPerSec: number;

  // ── Observational Memory ──────────────────────────────────────────────
  omProgressComponent?: OMProgressComponent;
  activeOMMarker?: OMMarkerComponent;
  activeBufferingMarker?: OMMarkerComponent;
  activeActivationMarker?: OMMarkerComponent;
  activeActivationData?: OMMarkerData;
  activeActivationProviderChangeMarker?: OMMarkerComponent;

  // ── Tasks ─────────────────────────────────────────────────────────────
  taskProgress?: TaskProgressComponent;

  // ── Goal loop ─────────────────────────────────────────────────────────
  goalManager: GoalManager;
  /** Track a goal started from plan approval — return to plan mode when it completes */
  planStartedGoalId?: string;

  // ── Input ─────────────────────────────────────────────────────────────
  autocompleteProvider?: CombinedAutocompleteProvider;
  customSlashCommands: SlashCommandMetadata[];
  skillCommands: SkillMetadata[];
  goalSkillCommands: SkillMetadata[];
  /** Pending images from clipboard paste */
  pendingImages: Array<{ data: string; mimeType: string }>;

  // ── Dedup ────────────────────────────────────────────────────────────
  /** Texts of queued messages that were locally rendered and fired — used to
   *  suppress the subscription echo that would otherwise create a duplicate. */
  firedQueuedMessageTexts?: Map<string, number>;

  // ── Abort tracking ────────────────────────────────────────────────────
  lastCtrlCTime: number;
  /** Track user-initiated aborts (Ctrl+C/Esc) vs system aborts */
  userInitiatedAbort: boolean;
  /**
   * Set when the run is aborted because the user clicked "Request Changes" on a
   * plan approval. Suppresses the "Interrupted" abort UI so the rejection ends
   * cleanly and the user can type revision feedback.
   */
  planRejectionAbort: boolean;

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
  const terminal = options.terminal ?? new ProcessTerminal();
  // Override columns getter to prevent line wrapping in nested terminal emulators
  if (!options.terminal) {
    Object.defineProperty(terminal, 'columns', {
      get: () => (process.stdout.columns || 80) - TERM_WIDTH_BUFFER,
    });
  }
  const ui = new TUI(terminal);

  // Perf profiling removed

  const chatContainer = new Container();
  const editorContainer = new Container();
  const footer = new Container();
  const editor = new CustomEditor(ui, getEditorTheme());
  const result: TUIState = {
    // Core dependencies
    controller: options.controller,
    session: options.session,
    options,
    hookManager: options.hookManager,
    analytics: options.analytics,
    authStorage: options.authStorage,
    mcpManager: options.mcpManager,
    pluginManager: options.pluginManager,
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
    pendingTaskToolIds: new Set(),
    taskToolInsertIndex: -1,
    seenToolCallIds: new Set(),
    subagentToolCallIds: new Set(),
    currentRunSystemReminderKeys: new Set(),
    allToolComponents: [],
    allSlashCommandComponents: [],
    allSystemReminderComponents: [],
    messageComponentsById: new Map(),
    allShellComponents: [],
    pendingSubagents: new Map(),
    toolOutputExpanded: false,
    hideThinkingBlock: true,
    quietMode: false,
    quietModeMaxToolPreviewLines: 2,

    // Thread / conversation
    pendingNewThread: false,
    currentThreadTitle: undefined,
    activeGithubPrSubscriptions: [],
    threadPreviewCache: new Map(),
    attemptedThreadPreviewIds: new Set(),

    // Inline interaction
    lastClearedText: '',
    pendingAskUserComponents: new Map(),
    pendingSubmitPlanComponents: new Map(),
    pendingInlineQuestions: [],
    pendingFollowUpMessages: [],
    pendingQueuedActions: [],
    followUpComponents: [],
    pendingSignalMessageComponentsById: new Map(),
    pendingSlashCommands: [],
    pendingSlashCommandMessageIds: [],
    pendingApprovalDismiss: null,

    // Status line
    projectInfo: detectProject(process.cwd()),
    modelAuthStatus: { hasAuth: true },
    githubPrPollingActive: false,

    // Tokens/sec tracking
    decodeStartedAt: 0,
    tokensPerSec: 0,

    // Goal loop
    goalManager: new GoalManager(),
    planStartedGoalId: undefined,

    // Input
    customSlashCommands: [],
    skillCommands: [],
    goalSkillCommands: [],
    pendingImages: [],

    // Abort tracking
    lastCtrlCTime: 0,
    userInitiatedAbort: false,
    planRejectionAbort: false,
  };
  editor.getModeColor = () => {
    if (result.activeGoalJudge) {
      return mastra.blue;
    }
    const color = result.session.mode.resolve()?.metadata?.color;
    return typeof color === 'string' ? color : undefined;
  };

  const voiceSettings = loadSettings().voice;
  result.voiceController = new VoiceController({
    authStorage: result.authStorage,
    settings: voiceSettings,
    onTranscript: text => editor.insertVoiceTranscript(text),
    onPartialTranscript: text => editor.replaceVoiceTranscript(text),
    showInfo: message => showInfo(result, message),
    showError: message => showError(result, message),
    onListeningChange: listening => editor.setVoiceListening(listening),
  });
  editor.voiceInput = result.voiceController;
  if (voiceSettings.enabled) {
    result.voiceController.restoreEnabled();
  }

  return result;
}
