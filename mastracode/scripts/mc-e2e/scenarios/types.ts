export type ScenarioName =
  | 'startup'
  | 'branch-context-long-name'
  | 'active-signal-followup'
  | 'api-key-prompt'
  | 'automated-chat'
  | 'clipboard-image-paste'
  | 'custom-config-dir'
  | 'custom-slash-command'
  | 'file-autocomplete'
  | 'github-signals-command'
  | 'prompt-context-instructions'
  | 'visible-commands'
  | 'integration-commands'
  | 'modal-and-shell'
  | 'notification-signal-rendering'
  | 'om-settings'
  | 'quiet-settings'
  | 'report-issue-command'
  | 'state-commands'
  | 'state-signal-rendering'
  | 'storage-settings'
  | 'thread-history'
  | 'workspace-commands';

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
