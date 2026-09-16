import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
import { recordAssertionEvidence } from '../helpers/assertion-evidence.js';
import { buildWorker } from '../helpers/build-worker.js';
import { copyArtifact } from '../helpers/copy-artifact.js';
import { installPnpmProject } from '../helpers/install-project.js';
import { inspectManifest, type ExperimentWorkerManifest } from '../helpers/inspect-manifest.js';
import { materializeProject } from '../helpers/materialize-project.js';
import { OwnedResources } from '../helpers/process-cleanup.js';
import { createRunRequest, runProtocol } from '../helpers/run-protocol.js';
import {
  workspaceBrowserScenario,
  workspaceDynamicScenario,
  workspaceFailuresScenario,
  workspaceLspScenario,
  workspaceMountsScenario,
  workspaceOwnedOverrideScenario,
  workspaceSearchScenario,
} from '../scenarios/index.js';

const suiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function completedPayloads(events: Array<{ type: string; payload?: unknown }>) {
  return events.filter(event => event.type === 'item-completed').map(event => JSON.stringify(event.payload));
}

describe('experiment worker full-tier workspace lifecycle', () => {
  const resources = new OwnedResources();
  let artifactRoot: string;
  let manifest: ExperimentWorkerManifest;

  beforeAll(async () => {
    const projectRoot = resources.trackPath(
      await materializeProject({
        fixtureDir: join(suiteRoot, 'fixtures', 'resources'),
        runRoot: inject('runRoot'),
        registry: inject('registry'),
        tag: inject('tag'),
        scenarioId: 'full-workspace-lifecycle',
      }),
    );
    await installPnpmProject(projectRoot, inject('registry'));
    const build = await buildWorker(projectRoot);
    manifest = (await inspectManifest(build.artifactRoot)).manifest;
    artifactRoot = resources.trackPath(
      await copyArtifact({
        artifactRoot: build.artifactRoot,
        destinationRoot: join(inject('artifactRoot'), 'full-workspace-lifecycle'),
        sourceRoots: [projectRoot, suiteRoot],
        deleteRoots: [projectRoot],
      }),
    );
  }, 240_000);

  afterAll(async () => {
    const cleanup = await resources.cleanup();
    expect(cleanup.remainingPaths).toEqual([]);
  });

  test(
    `${workspaceOwnedOverrideScenario.id} prefers the agent-owned workspace over the global workspace`,
    async () => {
      const run = await runProtocol(
        artifactRoot,
        manifest,
        createRunRequest(manifest, {
          targetId: 'agent-owned-workspace-agent',
          items: [{ id: 'owned-item', input: 'report the workspace marker', toolMocks: [] }],
        }),
      );
      const output = completedPayloads(run.events).join('\n');
      expect(output).toContain('agent-owned-skill');
      expect(output).not.toContain('sandbox-echo-skill');
      await recordAssertionEvidence(workspaceOwnedOverrideScenario, {
        'agent-workspace-overrides-global': output,
        'global-workspace-marker-absent': !output.includes('sandbox-echo-skill'),
      });
    },
    workspaceOwnedOverrideScenario.timeoutMs,
  );

  test(
    `${workspaceDynamicScenario.id} isolates concurrent request-context workspaces`,
    async () => {
      const run = await runProtocol(
        artifactRoot,
        manifest,
        createRunRequest(manifest, {
          targetId: 'dynamic-workspace-agent',
          concurrency: 3,
          items: [
            {
              id: 'tenant-a-1',
              input: 'report the workspace marker',
              requestContext: { workspaceId: 'tenant-a-workspace' },
              toolMocks: [],
            },
            {
              id: 'tenant-b-1',
              input: 'report the workspace marker',
              requestContext: { workspaceId: 'tenant-b-workspace' },
              toolMocks: [],
            },
            {
              id: 'tenant-a-2',
              input: 'report the workspace marker again',
              requestContext: { workspaceId: 'tenant-a-workspace' },
              toolMocks: [],
            },
          ],
        }),
      );
      const outputs = completedPayloads(run.events);
      expect(outputs).toHaveLength(3);
      expect(outputs.filter(output => output.includes('tenant-a-skill'))).toHaveLength(2);
      expect(outputs.filter(output => output.includes('tenant-b-skill'))).toHaveLength(1);
      expect(outputs.every(output => !output.includes('workspace marker missing'))).toBe(true);
      await recordAssertionEvidence(workspaceDynamicScenario, {
        'concurrent-items': outputs,
        'same-key-consistent': outputs.filter(output => output.includes('tenant-a-skill')),
        'different-key-isolated': outputs,
        'workspace-cleanup': run.events.at(-1)?.payload,
      });
    },
    workspaceDynamicScenario.timeoutMs,
  );

  test(
    `${workspaceSearchScenario.id} executes BM25, vector, and hybrid search`,
    async () => {
      const run = await runProtocol(
        artifactRoot,
        manifest,
        createRunRequest(manifest, {
          targetType: 'workflow',
          targetId: 'search-workflow',
          items: [{ id: 'search-item', input: { query: 'production deployment rollback' }, toolMocks: [] }],
          timeoutMs: 30_000,
        }),
      );
      const output = completedPayloads(run.events).join('\n');
      expect(output).toContain('deployment.md');
      expect(output).toContain('bm25');
      expect(output).toContain('vector');
      expect(output).toContain('hybrid');
      await recordAssertionEvidence(workspaceSearchScenario, {
        'bm25-search': output,
        'vector-search': output,
        'hybrid-search': output,
      });
    },
    workspaceSearchScenario.timeoutMs,
  );

  test(
    `${workspaceMountsScenario.id} routes two mounts and enforces read-only access`,
    async () => {
      const run = await runProtocol(
        artifactRoot,
        manifest,
        createRunRequest(manifest, {
          targetType: 'workflow',
          targetId: 'mount-workflow',
          items: [{ id: 'mount-item', input: { value: 'project mount output' }, toolMocks: [] }],
        }),
      );
      const output = completedPayloads(run.events).join('\n');
      expect(output).toContain('project mount output');
      expect(output).toContain('shared mount reference');
      expect(output).toContain('"readOnlyRejected":true');
      await recordAssertionEvidence(workspaceMountsScenario, {
        'multi-mount-routing': output,
        'read-only-mount': output,
        'workspace-cleanup': run.events.at(-1)?.payload,
      });
    },
    workspaceMountsScenario.timeoutMs,
  );

  test(
    `${workspaceLspScenario.id} launches and shuts down a real TypeScript language server`,
    async () => {
      const run = await runProtocol(
        artifactRoot,
        manifest,
        createRunRequest(manifest, {
          targetType: 'workflow',
          targetId: 'lsp-workflow',
          items: [
            {
              id: 'lsp-item',
              input: { source: 'const value = 42;\nvalue.toFixed();\n' },
              toolMocks: [],
            },
          ],
          timeoutMs: 30_000,
        }),
      );
      const output = completedPayloads(run.events).join('\n');
      expect(output).toContain('TypeScript');
      expect(output).toContain('number');
      expect(run.result.exitCode).toBe(0);
      await recordAssertionEvidence(workspaceLspScenario, {
        'language-server-launched': output,
        'lsp-hover': output,
        'lsp-shutdown': run.result.exitCode,
      });
    },
    workspaceLspScenario.timeoutMs,
  );

  test(
    `${workspaceBrowserScenario.id} lazily launches a CLI browser and closes it during shutdown`,
    async () => {
      const run = await runProtocol(
        artifactRoot,
        manifest,
        createRunRequest(manifest, {
          targetType: 'workflow',
          targetId: 'browser-workflow',
          items: [{ id: 'browser-item', input: { threadId: 'browser-thread' }, toolMocks: [] }],
        }),
      );
      const output = completedPayloads(run.events).join('\n');
      expect(output).toContain('"lazyBefore":true');
      expect(output).toContain('"launched":true');
      expect(output).toContain('"commandRan":true');
      const events = JSON.parse(await readFile(join(artifactRoot, 'browser-events.json'), 'utf8')) as string[];
      expect(events[0]).toMatch(/^launch:/);
      expect(events.at(-1)).toBe('close');
      await recordAssertionEvidence(workspaceBrowserScenario, {
        'browser-lazy-before-command': output,
        'browser-launched-for-thread': output,
        'browser-cli-executed': output,
        'browser-closed-on-shutdown': events,
      });
    },
    workspaceBrowserScenario.timeoutMs,
  );

  test(
    `${workspaceFailuresScenario.id} reports lifecycle failures and rejects invalid configurations`,
    async () => {
      const run = await runProtocol(
        artifactRoot,
        manifest,
        createRunRequest(manifest, {
          targetType: 'workflow',
          targetId: 'lifecycle-failure-workflow',
          items: [{ id: 'failure-item', input: { value: 'verify' }, toolMocks: [] }],
        }),
      );
      const output = completedPayloads(run.events).join('\n');
      expect(output).toContain('"initFailed":true');
      expect(output).toContain('"destroyFailed":true');
      expect(output).toContain('"invalidConfigs":3');
      expect(run.result.exitCode).toBe(0);
      await recordAssertionEvidence(workspaceFailuresScenario, {
        'initialization-failure-reported': output,
        'shutdown-failure-reported': output,
        'invalid-configurations-rejected': output,
        'worker-clean-exit': run.result.exitCode,
      });
    },
    workspaceFailuresScenario.timeoutMs,
  );
});
