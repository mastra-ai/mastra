import { describe, expect, test } from 'vitest';
import routing from './dependency-test-routing.cjs';

const { dependencyAffectedTests, importersWithChangedDependencies } = routing;

// Trimmed from the real pnpm-lock.yaml (lockfile v9) layout.
function lockfile({ otelVersion = '2.1.0', anthropicVersion = '3.0.137', rootVitestPeer = '1.9.0' } = {}) {
  return `lockfileVersion: '9.0'

importers:

  .:
    devDependencies:
      vitest:
        specifier: 'catalog:'
        version: 4.1.12(@opentelemetry/api@${rootVitestPeer})

  observability/otel-bridge:
    dependencies:
      '@mastra/core':
        specifier: workspace:*
        version: link:../../packages/core
      '@opentelemetry/sdk-trace-base':
        specifier: ^2.0.0
        version: ${otelVersion}(@opentelemetry/api@1.9.1)

  packages/core:
    dependencies:
      '@mastra/schema-compat':
        specifier: workspace:*
        version: link:../schema-compat

  packages/schema-compat:
    devDependencies:
      '@ai-sdk/anthropic-v6':
        specifier: npm:@ai-sdk/anthropic@^3.0.0
        version: '@ai-sdk/anthropic@${anthropicVersion}(zod@4.6.7)'

  packages/playground-ui:
    dependencies:
      react:
        specifier: ^19.0.0
        version: 19.2.0

snapshots:

  '@ai-sdk/anthropic@${anthropicVersion}(zod@4.6.7)':
    dependencies:
      zod: 4.6.7

  '@opentelemetry/api@${rootVitestPeer}': {}

  '@opentelemetry/sdk-trace-base@${otelVersion}(@opentelemetry/api@1.9.1)':
    dependencies:
      '@opentelemetry/api': 1.9.1

  '@opentelemetry/api@1.9.1': {}

  react@19.2.0: {}

  vitest@4.1.12(@opentelemetry/api@${rootVitestPeer}):
    optionalDependencies:
      '@opentelemetry/api': ${rootVitestPeer}

  zod@4.6.7: {}
`;
}

const testFiles = [
  'observability/otel-bridge/src/bridge.test.ts',
  'packages/core/src/agent/agent.test.ts',
  'packages/schema-compat/src/provider-compats/anthropic.e2e.test.ts',
  'packages/schema-compat/src/schema.test.ts',
  'packages/playground-ui/src/hooks/__tests__/storybook-coverage.test.ts',
  'packages/playground-ui/src/hooks/__tests__/use-copy.test.ts',
  ...Array.from({ length: 20 }, (_, i) => `stores/pg/src/store-${i}.test.ts`),
];
const testSources: Record<string, string> = {
  'packages/playground-ui/src/hooks/__tests__/storybook-coverage.test.ts':
    'const files = readdirSync(directory, { withFileTypes: true });',
};
const readTest = (file: string) => testSources[file] ?? "import { it } from 'vitest';";

describe('dependency test routing', () => {
  // #28581 bumped OpenTelemetry in the lockfile only; otel-bridge tests broke main.
  test('runs a package whose resolved dependencies changed, and the packages linking to it', () => {
    const result = dependencyAffectedTests({
      changedFiles: ['pnpm-lock.yaml'],
      baseLockfile: lockfile(),
      headLockfile: lockfile({ otelVersion: '2.2.0' }),
      testFiles,
      readTest,
    });

    expect(result.runFull).toBe(false);
    expect(result.packages).toEqual([{ dir: 'observability/otel-bridge', reason: 'resolved dependencies changed' }]);
    expect(result.tests).toEqual(['observability/otel-bridge/src/bridge.test.ts']);
  });

  // #29341 (lockfile maintenance) moved an aliased @ai-sdk/anthropic; the schema-compat e2e test broke main.
  test('follows aliased dependencies and workspace links', () => {
    const changed = importersWithChangedDependencies(lockfile(), lockfile({ anthropicVersion: '3.0.138' }));
    expect([...changed].sort()).toEqual(['observability/otel-bridge', 'packages/core', 'packages/schema-compat']);
  });

  test('ignores lockfile edits that resolve to the same packages', () => {
    const result = dependencyAffectedTests({
      changedFiles: ['pnpm-lock.yaml', 'pnpm-workspace.yaml'],
      baseLockfile: lockfile(),
      headLockfile: lockfile().replace('specifier: ^19.0.0', 'specifier: ^19.2.0'),
      testFiles,
      readTest,
    });
    expect(result).toMatchObject({ runFull: false, reason: 'none', tests: [] });
  });

  test('asks for the full suite when the root toolchain resolves differently', () => {
    const result = dependencyAffectedTests({
      changedFiles: ['pnpm-lock.yaml'],
      baseLockfile: lockfile(),
      headLockfile: lockfile({ rootVitestPeer: '1.10.0' }),
      testFiles,
      readTest,
    });
    expect(result).toMatchObject({ runFull: true, reason: 'root dependencies changed' });
  });

  test('runs a package whose package.json changed without a lockfile change', () => {
    const result = dependencyAffectedTests({
      changedFiles: ['packages/schema-compat/package.json'],
      headLockfile: lockfile(),
      testFiles,
      readTest,
    });
    expect(result.tests).toEqual([
      'packages/schema-compat/src/provider-compats/anthropic.e2e.test.ts',
      'packages/schema-compat/src/schema.test.ts',
    ]);
  });

  // #29373 added a hook without a story; storybook-coverage.test.ts scans the hooks folder and broke main.
  test('runs tests that scan their package when a file there is added', () => {
    const result = dependencyAffectedTests({
      changedFiles: ['packages/playground-ui/src/hooks/use-clock.ts'],
      addedOrRemovedFiles: ['packages/playground-ui/src/hooks/use-clock.ts'],
      headLockfile: lockfile(),
      testFiles,
      readTest,
    });
    expect(result).toMatchObject({ runFull: false, reason: 'directory-scanning tests' });
    expect(result.tests).toEqual(['packages/playground-ui/src/hooks/__tests__/storybook-coverage.test.ts']);
  });

  test('leaves directory-scanning tests alone when files are only edited', () => {
    const result = dependencyAffectedTests({
      changedFiles: ['packages/playground-ui/src/hooks/use-copy.ts'],
      headLockfile: lockfile(),
      testFiles,
      readTest,
    });
    expect(result.tests).toEqual([]);
  });

  test('hands a selection over a quarter of the suite to the full suite', () => {
    const result = dependencyAffectedTests({
      changedFiles: ['stores/pg/package.json'],
      headLockfile: lockfile().replace(
        '  packages/playground-ui:',
        '  stores/pg:\n    dependencies: {}\n\n  packages/playground-ui:',
      ),
      testFiles,
      readTest,
    });
    expect(result).toMatchObject({ runFull: true, reason: 'dependency changes select most of the suite' });
  });
});
