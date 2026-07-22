import type { Terminal } from '@earendil-works/pi-tui';

import type { createMastraCode, MastraCodeConfig } from '../../src/index.js';
import type { MastraTUIOptions } from '../../src/tui/index.js';

export type ScenarioName =
  | 'startup'
  | 'abort-followup'
  | 'branch-context-long-name'
  | 'active-signal-followup'
  | 'autocomplete-wrapping-navigation'
  | 'api-key-delete-env'
  | 'api-key-multi-provider-delete'
  | 'api-key-prompt'
  | 'api-key-reopen-stored'
  | 'ask-user-advanced-prompts'
  | 'automated-chat'
  | 'background-subagents'
  | 'browser-active-pending-status'
  | 'browser-profile-provider-mismatch'
  | 'browser-settings-persistence'
  | 'browser-startup-restore'
  | 'browser-tool-unavailable'
  | 'browserbase-startup-restore'
  | 'browser-toggle-attach'
  | 'browser-wizard-browserbase'
  | 'browser-wizard-export'
  | 'clipboard-image-paste'
  | 'commit-attribution-prompt'
  | 'custom-config-dir'
  | 'custom-pack-import-overwrite'
  | 'custom-pack-import-rename'
  | 'custom-pack-rename-active'
  | 'custom-provider-delete'
  | 'custom-provider-edit-share-import'
  | 'custom-provider-management'
  | 'custom-provider-modal-validation'
  | 'custom-provider-model-selector'
  | 'custom-slash-command'
  | 'ctrlf-queued-custom-slash'
  | 'ctrlf-queued-image-followup'
  | 'debug-logging'
  | 'file-attachment-blocked-retry'
  | 'file-attachment-history-reload'
  | 'file-autocomplete'
  | 'first-run-onboarding'
  | 'github-signals-command'
  | 'github-signals-incremental'
  | 'github-signals-notification-reload'
  | 'github-signals-polling-inbox'
  | 'github-signals-unsubscribe-reload'
  | 'goal-api-error-stops-loop'
  | 'goal-duration-tool-approval'
  | 'goal-judge-om-model-isolation'
  | 'goal-judge-single-render'
  | 'controller-api-config'
  | 'headless-mcp-tool-availability'
  | 'openai-strict-schema'
  | 'plan-approval-goal-handoff'
  | 'plan-approval-handoff'
  | 'plan-approval-request-changes'
  | 'persistent-goal-commands'
  | 'persistent-goal-judge-decision'
  | 'persistent-goal-reload'
  | 'plugins-local-tool'
  | 'plugins-local-hot-reload'
  | 'plugins-github-install-gh-cli-pnpm-10'
  | 'plugins-github-install-gh-cli-pnpm-11'
  | 'plugins-github-install-missing-corepack'
  | 'plugins-github-install-invalid-package-manager'
  | 'plugins-github-poll-update'
  | 'plugins-blocked-config'
  | 'plugins-scaffold-install-tool'
  | 'plugins-assets-loading'
  | 'plugins-command-ui'
  | 'process-shortcuts'
  | 'provider-history-compat'
  | 'provider-history-rejection-retry'
  | 'prompt-context-instructions'
  | 'prompt-queue-interleave'
  | 'prune-command'
  | 'visible-commands'
  | 'integration-commands'
  | 'lifecycle-hooks-configured'
  | 'lifecycle-hooks-events'
  | 'login-dialog-masked-input'
  | 'login-preserves-model-pack'
  | 'modal-and-shell'
  | 'mcp-http-tool-call'
  | 'mcp-long-running-tool'
  | 'mcp-reload-config'
  | 'mcp-oauth-authenticate'
  | 'mcp-oauth-cancel'
  | 'mcp-selector-reconnect'
  | 'mcp-server-config'
  | 'mcp-skipped-validation'
  | 'model-selection-api-key-prompt'
  | 'model-selection-cancel-env'
  | 'models-pack-activation-persistence'
  | 'notification-inbox-crud-flow'
  | 'notification-inbox-reload'
  | 'notification-inbox-tool-flow'
  | 'notification-signal-rendering'
  | 'om-settings'
  | 'om-attachment-observation'
  | 'om-global-settings-persistence'
  | 'om-model-override-reload'
  | 'om-pack-startup-restore'
  | 'om-status-indicator'
  | 'om-threshold-persistence'
  | 'quiet-settings'
  | 'quiet-streaming-preview-height'
  | 'quiet-tool-history-parity'
  | 'report-issue-command'
  | 'request-access-modal'
  | 'state-commands'
  | 'state-signal-browser-processor'
  | 'state-signal-reload'
  | 'state-signal-rendering'
  | 'setup-completion-persistence'
  | 'setup-custom-pack-completion'
  | 'setup-login-refresh'
  | 'setup-nested-model-selector'
  | 'settings-api-keys-navigation'
  | 'settings-startup-model-restore'
  | 'shell-passthrough-configured-settings'
  | 'shell-passthrough-env-override'
  | 'shell-passthrough-long-output'
  | 'shell-passthrough-nonpersistent'
  | 'skills-command-activation'
  | 'skills-symlink-dedupe'
  | 'storage-fallback-history-reload'
  | 'storage-settings'
  | 'storage-startup-pg-fallback'
  | 'stream-error-retry'
  | 'streaming-tool-args'
  | 'subagent-delegation'
  | 'subagent-plan-execute-tools'
  | 'subagent-model-startup-restore'
  | 'task-inline-transitions'
  | 'task-patch-tools'
  | 'task-progress-events'
  | 'terminal-resize-reflow'
  | 'task-prompt-context-next-turn'
  | 'thread-history'
  | 'tool-history-reload'
  | 'plugins-streaming-tool-output'
  | 'tool-schema-compat'
  | 'tool-suspension-same-run-resume'
  | 'update-command-prompt'
  | 'update-startup-prompt'
  | 'web-search-rendering'
  | 'workspace-commands'
  | 'workspace-plan-mode-tools'
  | 'workspace-tool-names'
  | 'workspace-tool-output-rendering'
  | 'work-idle-status'
  | 'worktree-cross-thread-resume'
  | 'worktree-thread-scoping'
  | 'resourceid-drift-prompt-accept'
  | 'resourceid-drift-prompt-decline';

export type McE2eTerminal = {
  getByText: (text: string | RegExp, options?: { full?: boolean; strict?: boolean }) => any;
  flushInput?: () => Promise<void>;
  keyCtrlC: () => void;
  resize: (columns: number, rows: number) => void;
  serialize: () => { view: string };
  submit: (text: string) => void;
  write: (text: string) => void;
};

export type McE2eScenarioRuntime = {
  printScreen: (label: string, terminal: McE2eTerminal) => void;
  sleep: (ms: number) => Promise<void>;
  startLiveOutput: (terminal: McE2eTerminal) => void;
  /** Match against the full terminal scrollback, including text printed after the TUI stopped. */
  waitForOutputText: (pattern: RegExp, terminal: McE2eTerminal, timeoutMs?: number) => Promise<void>;
  waitForScreenText: (pattern: RegExp, terminal: McE2eTerminal, timeoutMs?: number) => Promise<void>;
  waitForScreenTextAbsent: (pattern: RegExp, terminal: McE2eTerminal, timeoutMs?: number) => Promise<void>;
};

export type McE2ePrepareContext = {
  appDataDir: string;
  dbPath: string;
  homeDir: string;
  mastracodeDir: string;
  projectDir: string;
};

export type McE2eInProcessApp = {
  stop?: () => Promise<void> | void;
};

export type McE2eMastraCodeAppResult = Awaited<ReturnType<typeof createMastraCode>>;

export type McE2eStartMastraCodeAppOptions = {
  config?: MastraCodeConfig;
  onCreated?: (result: McE2eMastraCodeAppResult) => Promise<void> | void;
  onTuiCreated?: (tui: unknown) => Promise<void> | void;
  setupDebugLogging?: boolean;
  startupWarnings?: string[];
  tui?: Partial<Pick<MastraTUIOptions, 'appName' | 'initialMessage' | 'inlineQuestions' | 'verbose'>>;
};

export type McE2eInProcessAppContext = McE2ePrepareContext & {
  columns: number;
  cwd: string;
  env: Record<string, string | null>;
  rows: number;
  startMastraCodeApp: (options?: McE2eStartMastraCodeAppOptions) => Promise<McE2eInProcessApp>;
  terminal: Terminal;
};

export type McE2eScenario = {
  name: ScenarioName;
  description: string;
  testName: string;
  skipReason?: string;
  projectFixture?: 'long-branch' | 'manual';
  useOpenAIModel?: boolean;
  disableMemory?: boolean;
  aimockFixture?: string;
  env?: (context: McE2ePrepareContext) => Record<string, string | null>;
  entrypoint?: (context: McE2ePrepareContext) => string;
  inProcessApp?: (context: McE2eInProcessAppContext) => Promise<McE2eInProcessApp> | McE2eInProcessApp;
  terminalBackend?: 'subprocess';
  prepare?: (context: McE2ePrepareContext) => Promise<void> | void;
  run: (context: { terminal: McE2eTerminal; runtime: McE2eScenarioRuntime }) => Promise<void>;
  verifyAimockRequests?: (requests: unknown[]) => void;
};
