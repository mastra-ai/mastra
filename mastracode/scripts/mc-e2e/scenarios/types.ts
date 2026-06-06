export type ScenarioName =
  | 'startup'
  | 'branch-context-long-name'
  | 'api-key-prompt'
  | 'automated-chat'
  | 'visible-commands'
  | 'integration-commands'
  | 'modal-and-shell'
  | 'report-issue-command'
  | 'state-commands'
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

export type McE2eScenario = {
  name: ScenarioName;
  description: string;
  testName: string;
  projectFixture?: 'long-branch';
  useOpenAIModel?: boolean;
  aimockFixture?: string;
  run: (context: { terminal: McE2eTerminal; runtime: McE2eScenarioRuntime }) => Promise<void>;
};
