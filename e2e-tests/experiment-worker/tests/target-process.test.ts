import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
import { recordAssertionEvidence } from '../helpers/assertion-evidence.js';
import { buildWorker } from '../helpers/build-worker.js';
import { copyArtifact } from '../helpers/copy-artifact.js';
import { installPnpmProject } from '../helpers/install-project.js';
import { inspectManifest, type ExperimentWorkerManifest } from '../helpers/inspect-manifest.js';
import { materializeProject } from '../helpers/materialize-project.js';
import { OwnedResources } from '../helpers/process-cleanup.js';
import { runCommand } from '../helpers/command.js';
import {
  createRunRequest,
  minimalWorkerEnvironment,
  runCancelledProtocol,
  runProtocol,
} from '../helpers/run-protocol.js';
import {
  mockedToolAgentScenario,
  processCancellationScenario,
  resumableWorkflowScenario,
  truncatedInputScenario,
} from '../scenarios/index.js';

const suiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('experiment worker target and fresh-process behavior', () => {
  const resources = new OwnedResources();
  let artifactRoot: string;
  let manifest: ExperimentWorkerManifest;

  beforeAll(async () => {
    const projectRoot = resources.trackPath(
      await materializeProject({
        fixtureDir: join(suiteRoot, 'fixtures', 'runtime'),
        runRoot: inject('runRoot'),
        registry: inject('registry'),
        tag: inject('tag'),
        scenarioId: 'target-process',
      }),
    );
    await installPnpmProject(projectRoot, inject('registry'));
    const build = await buildWorker(projectRoot);
    manifest = (await inspectManifest(build.artifactRoot)).manifest;
    artifactRoot = resources.trackPath(
      await copyArtifact({
        artifactRoot: build.artifactRoot,
        destinationRoot: join(inject('artifactRoot'), 'target-process'),
        sourceRoots: [projectRoot, suiteRoot],
        deleteRoots: [projectRoot],
      }),
    );
  }, 180_000);

  afterAll(async () => {
    const cleanup = await resources.cleanup();
    expect(cleanup.remainingPaths).toEqual([]);
  });

  test(
    `${mockedToolAgentScenario.id} uses matching mocks and denies unmocked calls`,
    async () => {
      const mockedRequest = createRunRequest(manifest, {
        targetId: 'mocked-tool-agent',
        items: [
          {
            id: 'mocked-item',
            input: 'look up fixture-key',
            toolMocks: [
              {
                toolId: 'lookupTool',
                args: { key: 'fixture-key' },
                output: { value: 'mocked-value' },
                matchArgs: 'strict',
              },
            ],
          },
        ],
        allowedToolIds: ['lookupTool'],
      });
      const mocked = await runProtocol(artifactRoot, manifest, mockedRequest);
      expect(mocked.events.at(-1)?.payload).toMatchObject({ status: 'completed' });
      expect(await pathExists(join(artifactRoot, 'live-tool-ran.txt'))).toBe(false);

      const deniedRequest = createRunRequest(manifest, {
        targetId: 'mocked-tool-agent',
        items: [
          {
            id: 'denied-item',
            input: 'look up fixture-key',
            toolMocks: [
              {
                toolId: 'lookupTool',
                args: { key: 'different-key' },
                output: { value: 'mocked-value' },
                matchArgs: 'strict',
              },
            ],
          },
        ],
        allowedToolIds: ['lookupTool'],
      });
      const denied = await runProtocol(artifactRoot, manifest, deniedRequest, 20);
      expect(denied.events.at(-1)?.payload).toMatchObject({ status: 'failed' });
      expect(await pathExists(join(artifactRoot, 'live-tool-ran.txt'))).toBe(false);

      const recovered = await runProtocol(artifactRoot, manifest, mockedRequest);
      expect(recovered.result.exitCode).toBe(0);
      await recordAssertionEvidence(mockedToolAgentScenario, {
        'mocked-tool-success': mocked.events.at(-1)?.payload,
        'deny-unmocked': denied.events.at(-1)?.payload,
        'live-side-effect-absent': !(await pathExists(join(artifactRoot, 'live-tool-ran.txt'))),
        'failure-then-success': { deniedExit: denied.result.exitCode, recoveredExit: recovered.result.exitCode },
      });
    },
    mockedToolAgentScenario.timeoutMs,
  );

  test(
    `${resumableWorkflowScenario.id} resumes and runs synchronous and asynchronous scorers`,
    async () => {
      const request = createRunRequest(manifest, {
        targetType: 'workflow',
        targetId: 'resumable-workflow',
        items: [
          {
            id: 'workflow-item',
            input: { prompt: 'approve deployment' },
            metadata: { resumeData: { approved: true } },
            toolMocks: [],
          },
        ],
        scorers: [
          { id: 'sync-score', version: 'fixture-v1' },
          { id: 'async-score', version: 'fixture-v1' },
        ],
      });
      const result = await runProtocol(artifactRoot, manifest, request);
      const completed = result.events.find(event => event.type === 'item-completed');
      expect(completed).toBeDefined();
      expect(JSON.stringify(completed)).toContain('sync-score');
      expect(JSON.stringify(completed)).toContain('async-score');
      expect(result.events.at(-1)?.payload).toMatchObject({ status: 'completed' });
      await recordAssertionEvidence(resumableWorkflowScenario, {
        'workflow-resumed': completed,
        'sync-scorer': JSON.stringify(completed).includes('sync-score'),
        'async-scorer': JSON.stringify(completed).includes('async-score'),
      });
    },
    resumableWorkflowScenario.timeoutMs,
  );

  test(
    `${processCancellationScenario.id} cancels an in-flight run, then succeeds in a fresh process`,
    async () => {
      const cancelRequest = createRunRequest(manifest, {
        targetId: 'slow-agent',
        items: [{ id: 'slow-item', input: 'wait for cancellation', toolMocks: [] }],
        timeoutMs: 60_000,
      });
      const cancelled = await runCancelledProtocol(artifactRoot, manifest, cancelRequest);

      expect(cancelled.exitCode).toBe(30);
      expect(cancelled.events[0]?.type).toBe('accepted');
      expect(cancelled.events.map(event => event.type)).toContain('run-started');
      const terminal = cancelled.events.at(-1);
      expect(terminal?.type).toBe('terminal');
      expect(terminal?.payload).toMatchObject({ status: 'cancelled' });

      const recovered = await runProtocol(artifactRoot, manifest);
      expect(recovered.result.exitCode).toBe(0);
      expect(recovered.events.at(-1)?.payload).toMatchObject({ status: 'completed' });
      await recordAssertionEvidence(processCancellationScenario, {
        'terminal-cancelled': terminal?.payload,
        'exit-code-agreement': cancelled.exitCode,
        'success-after-cancel': recovered.events.at(-1)?.payload,
      });
    },
    processCancellationScenario.timeoutMs,
  );

  test(
    `${truncatedInputScenario.id} fails deterministically on truncated stdin, then succeeds`,
    async () => {
      const truncated = await runCommand(manifest.launch.executable, manifest.launch.arguments, {
        cwd: artifactRoot,
        timeoutMs: 90_000,
        env: minimalWorkerEnvironment(),
        stdin: '{"type":"run"',
      });

      expect(truncated.timedOut).toBe(false);
      expect(truncated.exitCode).toBe(70);
      expect(truncated.stdout).toBe('');
      expect(truncated.stderr).toContain('truncated frame');

      const recovered = await runProtocol(artifactRoot, manifest);
      expect(recovered.result.exitCode).toBe(0);
      await recordAssertionEvidence(truncatedInputScenario, {
        'protocol-exit-code': truncated.exitCode,
        'stdout-empty': truncated.stdout,
        'stderr-diagnostic': truncated.stderr,
        'success-after-protocol-failure': recovered.result.exitCode,
      });
    },
    truncatedInputScenario.timeoutMs,
  );
});
