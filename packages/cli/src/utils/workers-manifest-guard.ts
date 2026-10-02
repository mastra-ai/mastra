import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Legacy-deploy workers-manifest guard.
 *
 * Only the unified `mastra deploy` (environment) flow may ship a worker
 * manifest — the legacy `mastra studio deploy` and `mastra server deploy`
 * pipelines must NEVER cause the platform to provision a dedicated worker
 * service. Newer builds always emit `.mastra/output/workers.json`, and legacy
 * deploys on env-adopted projects are rerouted through the environment
 * pipeline server-side, so a manifest inside a legacy artifact WOULD reach
 * worker provisioning.
 *
 * When the built manifest exists and isn't already `null`, return a
 * `JSON.stringify(null)` override for the archive so the platform sees no
 * manifest. Malformed manifests are stripped too — a legacy artifact must be
 * inert no matter what the build emitted. The build output on disk is left
 * untouched so a later `mastra deploy` of the same build keeps its workers.
 */
export async function resolveLegacyWorkersManifestOverride(
  outputDir: string,
  fs?: { readFile: (path: string) => Promise<string> },
): Promise<{ status: 'no-manifest' | 'already-null' | 'stripped'; manifestOverride?: string }> {
  const readFn = fs?.readFile ?? (async (path: string) => readFile(path, 'utf-8'));

  let raw: string;
  try {
    raw = await readFn(join(outputDir, 'workers.json'));
  } catch {
    return { status: 'no-manifest' };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || parsed === undefined) {
      return { status: 'already-null' };
    }
  } catch {
    // Malformed manifest: fall through to strip. Legacy artifacts ship a
    // literal `null` manifest no matter what the build produced.
  }

  return { status: 'stripped', manifestOverride: JSON.stringify(null) };
}
