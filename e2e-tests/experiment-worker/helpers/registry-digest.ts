import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { computeRegistryArtifactDigest } = require('../scripts/registry-artifact-digest.cjs') as {
  computeRegistryArtifactDigest(registryRoot: string): Promise<string>;
};

export { computeRegistryArtifactDigest };
