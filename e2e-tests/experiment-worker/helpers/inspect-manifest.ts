import { createHash } from 'node:crypto';
import { lstat, readFile, readlink } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export interface ExperimentWorkerManifest {
  artifactVersion: 1;
  kind: 'mastra-experiment-worker';
  build: { buildId: string; cliVersion: string; createdAt: string };
  protocol: { versions: string[]; framing: 'ndjson'; datasetCanonicalizationVersion: string };
  launch: { executable: string; arguments: string[]; workingDirectory: string };
  dependencies: { manifest: string; lockfile?: string };
  artifact: { digestAlgorithm: 'sha256'; contentDigest: string; excludes: string[] };
  files: Array<{ path: string; sha256: string; type?: 'file' | 'symlink'; target?: string }>;
}

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export async function inspectManifest(artifactRoot: string) {
  const manifestPath = join(artifactRoot, 'experiment-worker-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ExperimentWorkerManifest;
  if (manifest.artifactVersion !== 1 || manifest.kind !== 'mastra-experiment-worker') {
    throw new Error(`Unsupported experiment worker manifest: ${manifestPath}`);
  }
  if (manifest.launch.executable !== 'node' || manifest.launch.workingDirectory !== '.') {
    throw new Error('Unexpected experiment worker launch contract');
  }
  if (!manifest.launch.arguments.includes('index.mjs')) throw new Error('Manifest does not launch index.mjs');
  if (
    !manifest.artifact.excludes.includes('experiment-worker-manifest.json') ||
    !manifest.artifact.excludes.includes('node_modules')
  ) {
    throw new Error('Manifest does not declare required artifact exclusions');
  }

  const sorted = [...manifest.files].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  if (JSON.stringify(sorted) !== JSON.stringify(manifest.files)) throw new Error('Manifest files are not sorted');
  for (const file of manifest.files) {
    if (file.path === 'experiment-worker-manifest.json' || file.path.startsWith('node_modules/')) {
      throw new Error(`Manifest contains excluded path ${file.path}`);
    }
    const absolutePath = resolve(artifactRoot, file.path);
    const artifactRelativePath = relative(resolve(artifactRoot), absolutePath);
    if (isAbsolute(file.path) || artifactRelativePath === '..' || artifactRelativePath.startsWith(`..${sep}`)) {
      throw new Error(`Manifest path escapes artifact root: ${file.path}`);
    }
    const stats = await lstat(absolutePath);
    const digest = stats.isSymbolicLink() ? sha256(await readlink(absolutePath)) : sha256(await readFile(absolutePath));
    if (digest !== file.sha256) throw new Error(`Manifest digest mismatch for ${file.path}`);
  }
  const contentDigest = sha256(manifest.files.map(file => `${file.path}\0${file.sha256}\n`).join(''));
  if (contentDigest !== manifest.artifact.contentDigest) throw new Error('Manifest content digest mismatch');
  return { manifest, manifestPath };
}
