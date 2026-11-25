// Runs a command against the shared E2E Verdaccio snapshot (built by the `publish-e2e-registry`
// CI job, or locally with `publish-ci-registry`). Every workspace package in the snapshot has
// the same `0.0.0-e2e-test-<timestamp>` version, so core's workspace dependencies resolve from
// the snapshot instead of npmjs, where a version-packages PR's bumped versions don't exist yet.
//
// Usage: MASTRA_E2E_REGISTRY_STORAGE=<dir>/storage node with-registry.mjs <command> [args...]
// The command gets MASTRA_COMPAT_REGISTRY (registry URL) and MASTRA_COMPAT_CORE_VERSION
// (the snapshot's @mastra/core version) in its environment.
import { spawn } from 'node:child_process';
import { startPublishedRegistryFromEnv, stopRegistry } from '../../../e2e-tests/_local-registry-setup/registry.js';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node with-registry.mjs <command> [args...]');
  process.exit(2);
}

if (!process.env.MASTRA_E2E_REGISTRY_STORAGE) {
  console.error(
    'MASTRA_E2E_REGISTRY_STORAGE is not set. Point it at the storage directory of an E2E registry snapshot: ' +
      'download the `e2e-verdaccio-registry` artifact from a CI run, or build one with ' +
      '`pnpm run publish-ci-registry` in e2e-tests/_local-registry-setup (see published-v1/README.md).',
  );
  process.exit(2);
}

const { tag, registry } = await startPublishedRegistryFromEnv();
const registryUrl = registry.toString();
let exitCode = 1;
try {
  const response = await fetch(`${registryUrl}/@mastra%2fcore`);
  if (!response.ok) {
    throw new Error(`@mastra/core is not in the E2E registry snapshot (${response.status} from ${registryUrl})`);
  }
  const coreVersion = (await response.json())['dist-tags']?.[tag];
  if (!coreVersion) {
    throw new Error(`@mastra/core has no '${tag}' dist-tag in the E2E registry snapshot`);
  }
  console.log(`E2E registry ${registryUrl}: @mastra/core@${tag} is ${coreVersion}`);

  exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, MASTRA_COMPAT_REGISTRY: registryUrl, MASTRA_COMPAT_CORE_VERSION: coreVersion },
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
} finally {
  await stopRegistry(registry);
}
process.exit(exitCode);
