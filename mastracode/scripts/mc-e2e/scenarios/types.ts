export type ScenarioName =
  | 'startup'
  | 'branch-context-long-name'
  | 'active-signal-followup'
  | 'api-key-delete-env'
  | 'api-key-prompt'
  | 'ask-user-advanced-prompts'
  | 'automated-chat'
  | 'browser-settings-persistence'
  | 'browser-toggle-attach'
  | 'clipboard-image-paste'
  | 'commit-attribution-prompt'
  | 'custom-config-dir'
  | 'custom-pack-import-overwrite'
  | 'custom-pack-import-rename'
  | 'custom-pack-rename-active'
  | 'custom-provider-delete'
  | 'custom-provider-edit-share-import'
  | 'custom-provider-management'
  | 'custom-slash-command'
  | 'debug-logging'
  | 'file-autocomplete'
  | 'first-run-onboarding'
  | 'github-signals-command'
  | 'github-signals-incremental'
  | 'github-signals-unsubscribe-reload'
  | 'harness-api-config'
  | 'openai-strict-schema'
  | 'plan-approval-goal-handoff'
  | 'plan-approval-handoff'
  | 'persistent-goal-commands'
  | 'persistent-goal-judge-decision'
  | 'persistent-goal-reload'
  | 'process-shortcuts'
  | 'provider-history-compat'
  | 'prompt-context-instructions'
  | 'prompt-queue-interleave'
  | 'visible-commands'
  | 'integration-commands'
  | 'modal-and-shell'
  | 'mcp-http-tool-call'
  | 'mcp-reload-config'
  | 'mcp-selector-reconnect'
  | 'mcp-server-config'
  | 'mcp-skipped-validation'
  | 'model-selection-api-key-prompt'
  | 'models-pack-activation-persistence'
  | 'notification-inbox-crud-flow'
  | 'notification-inbox-reload'
  | 'notification-inbox-tool-flow'
  | 'notification-signal-rendering'
  | 'om-settings'
  | 'om-global-settings-persistence'
  | 'quiet-settings'
  | 'quiet-tool-history-parity'
  | 'report-issue-command'
  | 'request-access-modal'
  | 'state-commands'
  | 'state-signal-browser-processor'
  | 'state-signal-reload'
  | 'state-signal-rendering'
  | 'setup-completion-persistence'
  | 'setup-nested-model-selector'
  | 'settings-startup-model-restore'
  | 'storage-settings'
  | 'stream-error-retry'
  | 'streaming-tool-args'
  | 'subagent-delegation'
  | 'task-inline-transitions'
  | 'task-patch-tools'
  | 'task-progress-events'
  | 'task-prompt-context-next-turn'
  | 'thread-history'
  | 'tool-history-reload'
  | 'tool-schema-compat'
  | 'update-command-prompt'
  | 'update-startup-prompt'
  | 'web-search-rendering'
  | 'workspace-commands'
  | 'workspace-plan-mode-tools'
  | 'workspace-tool-names'
  | 'workspace-tool-output-rendering';

export type McE2eTerminal = {
  getByText: (text: string | RegExp, options?: { full?: boolean; strict?: boolean }) => any;
  keyCtrlC: () => void;
  serialize: () => { view: string };
  submit: (text: string) => void;
  write: (text: string) => void;
};

export type McE2eScenarioRuntime = {
  printScreen: (label: string, terminal: McE2eTerminal) => void;
  sleep: (ms: number) => Promise<void>;
  startLiveOutput: (terminal: McE2eTerminal) => void;
  waitForScreenText: (pattern: RegExp, terminal: McE2eTerminal, timeoutMs?: number) => Promise<void>;
};

export type McE2ePrepareContext = {
  appDataDir: string;
  dbPath: string;
  homeDir: string;
  mastracodeDir: string;
  projectDir: string;
};

export type McE2eScenario = {
  name: ScenarioName;
  description: string;
  testName: string;
  projectFixture?: 'long-branch';
  useOpenAIModel?: boolean;
  aimockFixture?: string;
  env?: (context: McE2ePrepareContext) => Record<string, string>;
  entrypoint?: (context: McE2ePrepareContext) => string;
  prepare?: (context: McE2ePrepareContext) => Promise<void> | void;
  run: (context: { terminal: McE2eTerminal; runtime: McE2eScenarioRuntime }) => Promise<void>;
  verifyAimockRequests?: (requests: unknown[]) => void;
};
