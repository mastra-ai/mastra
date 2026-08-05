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

export const minimalAgentScenario: ScenarioDefinition = {
  id: 'minimal-agent',
  fixture: 'runtime',
  isolationKey: 'runtime-pnpm',
  tier: 'pr',
  services: [],
  credentials: [],
  timeoutMs: 180_000,
  assertions: [
    'published-install',
    'worker-build',
    'manifest-valid',
    'artifact-relocated',
    'source-independent',
    'protocol-success',
    'stdout-protocol-only',
    'cleanup-complete',
    'report-written',
  ],
};

export const scenarios = [minimalAgentScenario];
