import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, inject, test } from 'vitest';
import { recordAssertionEvidence } from '../helpers/assertion-evidence.js';
import { buildWorker } from '../helpers/build-worker.js';
import { copyArtifact } from '../helpers/copy-artifact.js';
import { installPnpmProject } from '../helpers/install-project.js';
import { inspectManifest } from '../helpers/inspect-manifest.js';
import { materializeProject } from '../helpers/materialize-project.js';
import { OwnedResources } from '../helpers/process-cleanup.js';
import { runProtocol } from '../helpers/run-protocol.js';
import { copiedArtifactScenario, minimalAgentScenario } from '../scenarios/index.js';

const suiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function passed(id: string, evidence: unknown) {
  return { id, status: 'passed' as const, evidence };
}

describe('experiment worker installed artifact', () => {
  test(
    `${minimalAgentScenario.id} copied-artifact builds, relocates, and executes a published-package worker`,
    async () => {
      const resources = new OwnedResources();
      const reportRoot = inject('reportRoot');
      try {
        const projectRoot = resources.trackPath(
          await materializeProject({
            fixtureDir: join(suiteRoot, 'fixtures', minimalAgentScenario.fixture),
            runRoot: inject('runRoot'),
            registry: inject('registry'),
            tag: inject('tag'),
            scenarioId: minimalAgentScenario.id,
          }),
        );
        const install = await installPnpmProject(projectRoot, inject('registry'));
        const build = await buildWorker(projectRoot);
        const inspected = await inspectManifest(build.artifactRoot);
        const copiedRoot = resources.trackPath(
          await copyArtifact({
            artifactRoot: build.artifactRoot,
            destinationRoot: join(inject('artifactRoot'), minimalAgentScenario.id),
            sourceRoots: [projectRoot, suiteRoot],
            deleteRoots: [projectRoot],
          }),
        );
        const protocol = await runProtocol(copiedRoot, inspected.manifest);

        const transcriptPath = join(reportRoot, `${minimalAgentScenario.id}.protocol.ndjson`);
        const buildLogPath = join(reportRoot, `${minimalAgentScenario.id}.build.log`);
        await Promise.all([
          writeFile(transcriptPath, protocol.result.stdout),
          writeFile(buildLogPath, `${build.result.stdout}\n--- stderr ---\n${build.result.stderr}`),
        ]);
        const assertions = [
          passed('published-install', { exitCode: install.exitCode }),
          passed('worker-build', { exitCode: build.result.exitCode }),
          passed('manifest-valid', { contentDigest: inspected.manifest.artifact.contentDigest }),
          passed('artifact-relocated', { copiedRoot }),
          passed('source-independent', { deletedProjectRoot: projectRoot }),
          passed('protocol-success', {
            events: protocol.events.map(event => event.type),
            exitCode: protocol.result.exitCode,
          }),
          passed('stdout-protocol-only', { transcriptPath }),
        ];
        const cleanup = await resources.cleanup();
        expect(cleanup.remainingPaths).toEqual([]);
        assertions.push(passed('cleanup-complete', cleanup));

        const assertionEvidence = Object.fromEntries(assertions.map(assertion => [assertion.id, assertion.evidence]));
        await recordAssertionEvidence(minimalAgentScenario, assertionEvidence);
        await recordAssertionEvidence(copiedArtifactScenario, {
          'artifact-relocated': assertionEvidence['artifact-relocated'],
          'source-independent': assertionEvidence['source-independent'],
          'protocol-success': assertionEvidence['protocol-success'],
        });
        expect(protocol.result.stderr).toContain('minimal experiment fixture initialized');
        expect(protocol.events.map(event => event.type)).toEqual([
          'accepted',
          'run-started',
          'item-completed',
          'terminal',
        ]);
      } catch (error) {
        await resources.cleanup();
        throw error;
      }
    },
    minimalAgentScenario.timeoutMs,
  );
});
