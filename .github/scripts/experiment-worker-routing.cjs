const experimentWorkerPaths = [
  'e2e-tests/experiment-worker/',
  'e2e-tests/_local-registry-setup/',
  'packages/cli/src/commands/experiment/',
  'packages/deployer/src/build/',
];

const experimentWorkerFiles = new Set([
  'packages/deployer/src/services/deps.ts',
  '.github/workflows/e2e-tests.yml',
  '.github/workflows/e2e-experiment-worker.yml',
  '.github/workflows/prebuild.yml',
  'pnpm-lock.yaml',
]);

const cliEntryFiles = new Set(['packages/cli/src/commands/index.ts', 'packages/cli/src/index.ts']);
const experimentRegistrationPattern = /experiment/i;

function experimentWorkerE2eChanged(changedFiles, entryDiff = '') {
  if (changedFiles.some(file => experimentWorkerPaths.some(prefix => file.startsWith(prefix)))) return true;
  if (changedFiles.some(file => experimentWorkerFiles.has(file))) return true;
  return changedFiles.some(file => cliEntryFiles.has(file)) && experimentRegistrationPattern.test(entryDiff);
}

const scenarioOwners = {
  'remote-sandbox': 'gated-remote-sandbox',
  'object-store': 'gated-object-store',
  'real-model': 'gated-real-model',
  'hosted-proxy': 'gated-hosted-proxy',
  'workspace-browser': 'browser',
};

function scheduledJobEnabled(job) {
  return [
    'full',
    'browser',
    'gated-remote-sandbox',
    'gated-object-store',
    'gated-real-model',
    'gated-hosted-proxy',
  ].includes(job);
}

function dispatchedJobEnabled({ tier, scenario = '', job }) {
  if (scenario) {
    return scenarioOwners[scenario] === job || (!scenarioOwners[scenario] && job === 'full');
  }
  if (tier === 'pr') return job === 'pr';
  if (tier === 'full') return job === 'full' || job === 'browser';
  if (tier === 'gated') return job.startsWith('gated-');
  return false;
}

module.exports = {
  dispatchedJobEnabled,
  experimentWorkerE2eChanged,
  scheduledJobEnabled,
};
