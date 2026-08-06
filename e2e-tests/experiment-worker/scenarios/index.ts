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

const fullResourceScenario = (id: string, assertions: string[]): ScenarioDefinition => ({
  id,
  fixture: 'resources',
  isolationKey: 'resources-pnpm',
  tier: 'full',
  services: [],
  credentials: [],
  timeoutMs: 180_000,
  assertions,
});

export const workspaceOwnedOverrideScenario = fullResourceScenario('workspace-owned-override', [
  'agent-workspace-overrides-global',
  'global-workspace-marker-absent',
]);

export const workspaceDynamicScenario = fullResourceScenario('workspace-dynamic', [
  'concurrent-items',
  'same-key-consistent',
  'different-key-isolated',
  'workspace-cleanup',
]);

export const workspaceSearchScenario = fullResourceScenario('workspace-search', [
  'bm25-search',
  'vector-search',
  'hybrid-search',
]);

export const workspaceMountsScenario = fullResourceScenario('workspace-mounts', [
  'multi-mount-routing',
  'read-only-mount',
  'workspace-cleanup',
]);

export const workspaceLspScenario = fullResourceScenario('workspace-lsp', [
  'language-server-launched',
  'lsp-hover',
  'lsp-shutdown',
]);

export const workspaceBrowserScenario = fullResourceScenario('workspace-browser', [
  'browser-lazy-before-command',
  'browser-launched-for-thread',
  'browser-cli-executed',
  'browser-closed-on-shutdown',
]);

export const workspaceFailuresScenario = fullResourceScenario('workspace-failures', [
  'initialization-failure-reported',
  'shutdown-failure-reported',
  'invalid-configurations-rejected',
  'worker-clean-exit',
]);

export const postgresScenario: ScenarioDefinition = {
  id: 'postgres',
  fixture: 'postgres',
  isolationKey: 'postgres-pnpm',
  tier: 'full',
  services: ['docker', 'postgres'],
  credentials: [],
  timeoutMs: 300_000,
  assertions: [
    'application-state-persisted',
    'experiment-persistence-absent',
    'bounded-shutdown',
    'connection-reuse',
    'docker-cleanup',
  ],
};

const projectShapeScenario = (id: string, fixture: string, assertions: string[]): ScenarioDefinition => ({
  id,
  fixture,
  isolationKey: `${id}-install`,
  tier: 'full',
  services: [],
  credentials: [],
  timeoutMs: 240_000,
  assertions,
});

export const npmMinimalScenario = projectShapeScenario('npm-minimal', 'npm', [
  'isolated-install-root',
  'npm-install',
  'artifact-relocated',
  'minimal-environment',
]);

export const yarnMinimalScenario = projectShapeScenario('yarn-minimal', 'yarn', [
  'isolated-install-root',
  'yarn-berry-node-modules',
  'artifact-relocated',
  'minimal-environment',
]);

export const pnpmMonorepoScenario = projectShapeScenario('pnpm-monorepo', 'monorepo', [
  'isolated-install-root',
  'workspace-package-imported',
  'artifact-relocated',
  'source-independent',
]);

export const portabilityIsolationScenario = projectShapeScenario('portability-isolation', 'runtime', [
  'repeated-build-stable-contract',
  'volatile-build-metadata',
  'concurrent-workers',
  'abrupt-termination-recovery',
  'artifact-immutable',
]);

export const kitchenSinkScenario = projectShapeScenario('kitchen-sink', 'resources', [
  'import-heavy-build',
  'selected-agent-executed',
  'selected-workflow-executed',
  'studio-not-launched',
]);

export const malformedApprovalsScenario = projectShapeScenario('negative-malformed-approvals', 'runtime', [
  'invalid-pnpm-approval-diagnostic',
]);
export const missingMastraScenario = projectShapeScenario('negative-missing-mastra', 'runtime', [
  'missing-mastra-diagnostic',
]);
export const importFailureScenario = projectShapeScenario('negative-import-failure', 'runtime', [
  'customer-import-diagnostic',
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
  workspaceOwnedOverrideScenario,
  workspaceDynamicScenario,
  workspaceSearchScenario,
  workspaceMountsScenario,
  workspaceLspScenario,
  workspaceBrowserScenario,
  workspaceFailuresScenario,
  postgresScenario,
  npmMinimalScenario,
  yarnMinimalScenario,
  pnpmMonorepoScenario,
  portabilityIsolationScenario,
  kitchenSinkScenario,
  malformedApprovalsScenario,
  missingMastraScenario,
  importFailureScenario,
  nativeDuckdbScenario,
];
