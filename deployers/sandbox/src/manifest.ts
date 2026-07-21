import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SandboxDeploymentManifest } from './types';

export const MANIFEST_FILENAME = 'sandbox-deployment.json';

/** Write `sandbox-deployment.json` into the build output directory. */
export async function writeDeploymentManifest(outputDir: string, manifest: SandboxDeploymentManifest): Promise<void> {
  await writeFile(join(outputDir, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2));
}

/** Read `sandbox-deployment.json` from the build output directory, or null when absent. */
export async function readDeploymentManifest(outputDir: string): Promise<SandboxDeploymentManifest | null> {
  let raw: string;
  try {
    raw = await readFile(join(outputDir, MANIFEST_FILENAME), 'utf-8');
  } catch (error) {
    // Only "no manifest" maps to null — anything else (permissions, a
    // corrupted file, malformed JSON below) should surface, not be hidden.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
  return JSON.parse(raw) as SandboxDeploymentManifest;
}
