import { mkdir, mkdtemp, lstat, realpath, readdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { exportManifestSchema, projectionSchema } from '../contracts/review.ts';
import type { ExportManifest, ReviewState } from '../contracts/review.ts';
import { openReviewStore } from '../persistence/review.ts';
import { openProcessingStore } from '../persistence/processing.ts';
import { canonicalJson, sha256 } from '../intake/source.ts';
import { renderBundle, validateBundleContent } from './catalog.ts';
import { revalidateEvidence, validateProjectionText } from '../review/validation.ts';
import type { ReviewOptions } from '../review/service.ts';

export async function containedDirectory(root: string, path: string, create = false) {
  const base = resolve(root),
    target = resolve(path),
    rel = relative(base, target);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('UNCONTAINED_PATH');
  if (create) await mkdir(base, { recursive: true });
  const baseStat = await lstat(base);
  if (baseStat.isSymbolicLink() || !baseStat.isDirectory()) throw new Error('UNSAFE_ROOT');
  let current = base;
  for (const segment of rel.split('/').filter(Boolean)) {
    current = resolve(current, segment);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('UNSAFE_PATH');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      if (create) await mkdir(current);
      else throw error;
    }
  }
  if (relative(await realpath(base), await realpath(target)) !== rel) throw new Error('SYMLINK_PATH');
  return target;
}
export function bundlePath(root: string, s: Pick<ReviewState, 'runId' | 'revision'>) {
  return resolve(root, 'exports', s.runId, `revision-${s.revision}`);
}
export async function verifyPublished(path: string, s: ReviewState): Promise<ExportManifest> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('UNSAFE_BUNDLE');
  const manifest = exportManifestSchema.parse(JSON.parse(await readFile(resolve(path, 'manifest.json'), 'utf8')));
  if (s.stagedManifest && canonicalJson(manifest) !== canonicalJson(s.stagedManifest))
    throw new Error('PUBLICATION_HASH_MISMATCH');
  if (
    manifest.runId !== s.runId ||
    manifest.revision !== s.revision ||
    manifest.approvalId !== s.projection?.approvalId ||
    manifest.projectionDigest !== sha256(canonicalJson(s.projection))
  )
    throw new Error('BUNDLE_BINDING_MISMATCH');
  if (
    canonicalJson((await readdir(path)).sort()) !==
    canonicalJson([...manifest.files.map(f => f.name), 'manifest.json'].sort())
  )
    throw new Error('INCOMPLETE_BUNDLE');
  for (const f of manifest.files) {
    const file = resolve(path, f.name),
      stat = await lstat(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('UNSAFE_ARTIFACT');
    const b = await readFile(file);
    if (b.length !== f.bytes || sha256(b) !== f.sha256) throw new Error('ARTIFACT_HASH_MISMATCH');
  }
  await validateBundleContent(
    new Map(await Promise.all(manifest.files.map(async f => [f.name, await readFile(resolve(path, f.name))] as const))),
    s.projection!,
  );
  const json = projectionSchema.parse(JSON.parse(await readFile(resolve(path, 'completed.json'), 'utf8')));
  if (canonicalJson(json) !== canonicalJson(s.projection)) throw new Error('PROJECTION_MISMATCH');
  return manifest;
}
export interface ExportOptions extends ReviewOptions {
  runtimeRoot: string;
  fault?: (stage: 'write' | 'published' | 'state') => Promise<void>;
}
export async function publishExport(runId: string, options: ExportOptions) {
  const review = await openReviewStore(options.databaseUrl),
    processing = await openProcessingStore(options.databaseUrl);
  let state: ReviewState | undefined, temp: string | undefined;
  try {
    state = await review.claimExport(runId);
    let evidence;
    try {
      evidence = (await revalidateEvidence(processing, runId, options)).evidence;
    } catch {
      await review.invalidate(runId);
      throw new Error('SOURCE_DRIFT');
    }
    await validateProjectionText(state.projection!, evidence);
    const parent = await containedDirectory(options.runtimeRoot, resolve(options.runtimeRoot, 'exports', runId), true),
      destination = bundlePath(options.runtimeRoot, state);
    try {
      await lstat(destination);
      const manifest = await verifyPublished(destination, state);
      if (state.state === 'exported') return { state, manifest, path: destination };
      return { state: await review.finishExport(runId, state.claimToken!, manifest), manifest, path: destination };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (state.state === 'exported') throw new Error('MISSING_EXPORTED_BUNDLE');
    const files = await renderBundle(state.projection!);
    temp = await mkdtemp(resolve(parent, '.staging-'));
    const manifest = exportManifestSchema.parse({
      schemaVersion: 1,
      runId,
      revision: state.revision,
      approvalId: state.projection!.approvalId,
      projectionDigest: sha256(canonicalJson(state.projection)),
      quality: state.projection!.quality,
      files: [...files].map(([name, bytes]) => ({ name, sha256: sha256(bytes), bytes: bytes.length })),
    });
    for (const [name, bytes] of files) {
      await options.fault?.('write');
      await writeFile(resolve(temp, name), bytes, { flag: 'wx', mode: 0o600 });
    }
    await writeFile(resolve(temp, 'manifest.json'), canonicalJson(manifest), { flag: 'wx', mode: 0o600 });
    await verifyPublished(temp, state);
    await revalidateEvidence(processing, runId, options);
    const latest = await review.read(runId);
    if (latest?.claimToken !== state.claimToken || latest.digest !== state.digest) throw new Error('STALE_EXPORT');
    state = await review.prepareExport(runId, state.claimToken!, manifest);
    await rename(temp, destination);
    temp = undefined;
    await options.fault?.('published');
    await options.fault?.('state');
    return { state: await review.finishExport(runId, state.claimToken!, manifest), manifest, path: destination };
  } catch (error) {
    if (state?.claimToken) await review.releaseExport(runId, state.claimToken).catch(() => {});
    throw error;
  } finally {
    if (temp) await rm(temp, { recursive: true, force: true });
    review.close();
    processing.close();
  }
}
