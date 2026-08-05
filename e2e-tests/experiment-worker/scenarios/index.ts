export interface ScenarioDefinition {
  id: string;
  fixture: string;
  isolationKey: string;
  tier: 'pr' | 'full' | 'gated';
  services: string[];
  credentials: string[];
  timeoutMs: number;
  assertions: string[];
}

export const setupScenarioId = 'setup-context';

const runtimeScenario = (id: string, assertions: string[]): ScenarioDefinition => ({
  id,
  fixture: 'runtime',
  isolationKey: 'runtime-pnpm',
  tier: 'pr',
  services: [],
  credentials: [],
  timeoutMs: 180_000,
  assertions,
});

export const minimalAgentScenario = runtimeScenario('minimal-agent', [
  'published-install',
  'worker-build',
  'manifest-valid',
  'artifact-relocated',
  'source-independent',
  'protocol-success',
  'stdout-protocol-only',
  'cleanup-complete',
  'report-written',
]);

export const copiedArtifactScenario = runtimeScenario('copied-artifact', [
  'artifact-relocated',
  'source-independent',
  'protocol-success',
]);

export const mockedToolAgentScenario = runtimeScenario('mocked-tool-agent', [
  'mocked-tool-success',
  'deny-unmocked',
  'live-side-effect-absent',
  'failure-then-success',
]);

export const resumableWorkflowScenario = runtimeScenario('resumable-workflow', [
  'workflow-resumed',
  'sync-scorer',
  'async-scorer',
]);

export const processCancellationScenario = runtimeScenario('process-cancellation', [
  'terminal-cancelled',
  'exit-code-agreement',
  'success-after-cancel',
]);

export const truncatedInputScenario = runtimeScenario('truncated-input', [
  'protocol-exit-code',
  'stdout-empty',
  'stderr-diagnostic',
  'success-after-protocol-failure',
]);

const resourceScenario = (id: string, assertions: string[]): ScenarioDefinition => ({
  id,
  fixture: 'resources',
  isolationKey: 'resources-pnpm',
  tier: 'pr',
  services: [],
  credentials: [],
  timeoutMs: 180_000,
  assertions,
});

export const workspaceSkillAgentScenario = resourceScenario('workspace-skill-agent', [
  'workspace-inherited',
  'skill-discovered',
  'skill-prompt-injected',
]);

export const workspaceSandboxScenario = resourceScenario('workspace-sandbox', [
  'filesystem-write',
  'sandbox-command',
  'skill-listed',
]);

export const sandboxCancellationScenario = resourceScenario('sandbox-cancellation', [
  'sandbox-command-started',
  'terminal-cancelled',
  'descendant-terminated',
  'success-after-cancel',
]);

export const persistenceIsolationScenario = resourceScenario('persistence-isolation', [
  'application-storage-written',
  'vector-adapter-executed',
  'experiment-records-absent',
  'score-records-absent',
]);

export const nativeDuckdbScenario: ScenarioDefinition = {
  id: 'native-duckdb',
  fixture: 'native',
  isolationKey: 'native-duckdb-pnpm',
  tier: 'pr',
  services: [],
  credentials: [],
  timeoutMs: 240_000,
  assertions: [
    'isolated-install-root',
    'native-dependency-declared',
    'portable-hoisted-layout',
    'artifact-relocated',
    'native-vector-executed',
  ],
};

export const scenarios = [
  minimalAgentScenario,
  copiedArtifactScenario,
  mockedToolAgentScenario,
  resumableWorkflowScenario,
  processCancellationScenario,
  truncatedInputScenario,
  workspaceSkillAgentScenario,
  workspaceSandboxScenario,
  sandboxCancellationScenario,
  persistenceIsolationScenario,
  nativeDuckdbScenario,
];
