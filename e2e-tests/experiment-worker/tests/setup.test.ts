import { access } from 'node:fs/promises';
import { describe, expect, inject, test } from 'vitest';
import { setupScenarioId } from '../scenarios/index.js';

async function expectDirectory(path: string) {
  await expect(access(path)).resolves.toBeUndefined();
}

describe('experiment worker E2E setup', () => {
  test(`${setupScenarioId} exposes a usable isolated registry context`, async () => {
    const registry = inject('registry');
    const expectedMode = process.env.MASTRA_E2E_REGISTRY_STORAGE ? 'published' : 'local';

    expect(inject('tag')).toBe(process.env.MASTRA_E2E_REGISTRY_TAG ?? 'experiment-worker-e2e-test');
    expect(inject('registryMode')).toBe(expectedMode);
    expect(registry).toMatch(/^http:\/\/localhost:\d+$/);
    expect(await fetch(`${registry}/-/ping`).then(response => response.ok)).toBe(true);

    await Promise.all([
      expectDirectory(inject('runRoot')),
      expectDirectory(inject('artifactRoot')),
      expectDirectory(inject('reportRoot')),
    ]);

    if (expectedMode === 'published') {
      expect(inject('registryArtifactDigest')).toMatch(/^[a-f0-9]{64}$/);
      if (process.env.MASTRA_E2E_REGISTRY_ARTIFACT_DIGEST) {
        expect(inject('registryArtifactDigest')).toBe(process.env.MASTRA_E2E_REGISTRY_ARTIFACT_DIGEST);
      }
    } else {
      expect(inject('registryArtifactDigest')).toBeNull();
    }
  });
});
