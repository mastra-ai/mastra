import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
import { recordAssertionEvidence } from '../helpers/assertion-evidence.js';
import { buildWorker } from '../helpers/build-worker.js';
import { killProcessGroup } from '../helpers/command.js';
import { copyArtifact } from '../helpers/copy-artifact.js';
import { installPnpmProject } from '../helpers/install-project.js';
import { inspectManifest, type ExperimentWorkerManifest } from '../helpers/inspect-manifest.js';
import { materializeProject } from '../helpers/materialize-project.js';
import { OwnedResources } from '../helpers/process-cleanup.js';
import { createRunRequest, parseProtocolOutput, runProtocol } from '../helpers/run-protocol.js';
import { portabilityIsolationScenario } from '../scenarios/index.js';

const suiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const resources = new OwnedResources();
let artifactRoot = '';
let manifest: ExperimentWorkerManifest;
let repeatabilityEvidence: Record<string, unknown>;

function normalize(value: string, roots: string[], buildIds: string[]) {
  return [...roots, ...buildIds].reduce((result, token) => result.split(token).join('<volatile>'), value);
}

async function stableFiles(root: string, currentManifest: ExperimentWorkerManifest, roots: string[]) {
  return Promise.all(
    currentManifest.files.map(async file => {
      const path = join(root, file.path);
      const stats = await lstat(path);
      const value = stats.isSymbolicLink() ? await readlink(path) : await readFile(path);
      const normalized = normalize(value.toString(), roots, [currentManifest.build.buildId]);
      return {
        path: file.path,
        type: file.type ?? 'file',
        sha256: createHash('sha256').update(normalized).digest('hex'),
      };
    }),
  );
}

async function terminateInFlightWorker(request: ReturnType<typeof createRunRequest>) {
  const child = resources.trackProcess(
    spawn(manifest.launch.executable, manifest.launch.arguments, {
      cwd: artifactRoot,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR },
      detached: process.platform !== 'win32',
      stdio: 'pipe',
    }),
  );
  let stdout = '';
  child.stdout!.setEncoding('utf8').on('data', chunk => {
    stdout += chunk;
    if (stdout.includes('"type":"run-started"')) killProcessGroup(child.pid, 'SIGKILL');
  });
  child.stdin!.write(`${JSON.stringify(request)}\n`);
  const result = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      killProcessGroup(child.pid, 'SIGKILL');
      reject(new Error(`Worker did not reach run-started before timeout\n${stdout}`));
    }, 30_000);
    child.once('close', (exitCode, signal) => {
      clearTimeout(timeout);
      resolve({ exitCode, signal });
    });
  });
  expect(result.exitCode).not.toBe(0);
  expect(result.signal ?? 'SIGKILL').toBe('SIGKILL');
  expect(parseProtocolOutput(`${stdout.trimEnd()}\n`).some(event => event.type === 'run-started')).toBe(true);
}

beforeAll(async () => {
  const projectRoot = resources.trackPath(
    await materializeProject({
      fixtureDir: join(suiteRoot, 'fixtures', portabilityIsolationScenario.fixture),
      runRoot: inject('runRoot'),
      registry: inject('registry'),
      tag: inject('tag'),
      scenarioId: portabilityIsolationScenario.id,
    }),
  );
  await installPnpmProject(projectRoot, inject('registry'));

  const firstBuildRoot = resources.trackPath(join(inject('runRoot'), 'builds', `${portabilityIsolationScenario.id}-1`));
  const secondBuildRoot = resources.trackPath(
    join(inject('runRoot'), 'builds', `${portabilityIsolationScenario.id}-2`),
  );
  const firstBuild = await buildWorker(projectRoot, firstBuildRoot);
  const secondBuild = await buildWorker(projectRoot, secondBuildRoot);
  const first = (await inspectManifest(firstBuild.artifactRoot)).manifest;
  const second = (await inspectManifest(secondBuild.artifactRoot)).manifest;

  expect(first.build.buildId).not.toBe(second.build.buildId);
  expect(first.build.createdAt).not.toBe(second.build.createdAt);
  expect(first.files).toEqual(second.files);
  expect(first.artifact.contentDigest).toBe(second.artifact.contentDigest);
  expect({
    ...first,
    build: undefined,
    files: undefined,
    artifact: { ...first.artifact, contentDigest: undefined },
  }).toEqual({
    ...second,
    build: undefined,
    files: undefined,
    artifact: { ...second.artifact, contentDigest: undefined },
  });
  const firstStableFiles = await stableFiles(firstBuild.artifactRoot, first, [projectRoot, firstBuildRoot]);
  const secondStableFiles = await stableFiles(secondBuild.artifactRoot, second, [projectRoot, secondBuildRoot]);
  expect(firstStableFiles).toEqual(secondStableFiles);
  repeatabilityEvidence = {
    'repeated-build-stable-contract': firstStableFiles,
    'volatile-build-metadata': { first: first.build, second: second.build },
  };

  artifactRoot = resources.trackPath(
    await copyArtifact({
      artifactRoot: firstBuild.artifactRoot,
      destinationRoot: join(inject('artifactRoot'), portabilityIsolationScenario.id),
      sourceRoots: [projectRoot, firstBuildRoot, secondBuildRoot, suiteRoot],
      deleteRoots: [projectRoot, firstBuildRoot, secondBuildRoot],
    }),
  );
  manifest = (await inspectManifest(artifactRoot)).manifest;
}, portabilityIsolationScenario.timeoutMs);

afterAll(async () => {
  const cleanup = await resources.cleanup();
  expect(cleanup.remainingPaths).toEqual([]);
});

describe('experiment worker portability and process isolation', () => {
  test('portability-isolation runs concurrent workers and recovers after abrupt termination', async () => {
    const requests = ['concurrent-a', 'concurrent-b'].map(id =>
      createRunRequest(manifest, { items: [{ id, input: 'hello', toolMocks: [] }] }),
    );
    const [first, second] = await Promise.all(requests.map(request => runProtocol(artifactRoot, manifest, request)));
    expect(first.request.experimentId).not.toBe(second.request.experimentId);
    expect(first.result.exitCode).toBe(0);
    expect(second.result.exitCode).toBe(0);

    const slowRequest = createRunRequest(manifest, {
      targetId: 'slow-agent',
      timeoutMs: 30_000,
      items: [{ id: 'abrupt-item', input: 'wait', toolMocks: [] }],
    });
    await terminateInFlightWorker(slowRequest);
    const recovered = await runProtocol(artifactRoot, manifest);
    expect(recovered.result.exitCode).toBe(0);
    await recordAssertionEvidence(portabilityIsolationScenario, {
      ...repeatabilityEvidence,
      'concurrent-workers': [first.request.experimentId, second.request.experimentId],
      'artifact-immutable': manifest.artifact.contentDigest,
      'abrupt-termination-recovery': {
        signal: 'SIGKILL',
        recovered: recovered.events.at(-1)?.payload,
      },
    });
  });
});
