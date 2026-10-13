import { checkCancellation } from '../runtime/cancellation.ts';
import { mkdir, mkdtemp, lstat, realpath, readdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { documentPublicationSchema } from '../contracts/completion.ts';
import type { ExportManifest, ReviewState } from '../contracts/review.ts';
import { openReviewStore } from '../persistence/review.ts';
import { openProcessingStore } from '../persistence/processing.ts';
import { canonicalJson, sha256 } from '../intake/source.ts';
import { prepareCompletion, sourceBytes } from '../persistence/completion.ts';
import { planDigest } from '../completion/plan.ts';
import { writeDocument, validateDocument, screenRetainedPackage } from '../completion/document.ts';
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
function bundlePath(root: string, s: Pick<ReviewState, 'runId' | 'revision'>) {
  return resolve(root, 'exports', s.runId, `revision-${s.revision}`);
}
async function verifyPublished(path: string, s: ReviewState): Promise<ExportManifest> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('UNSAFE_PUBLICATION');
  const manifest = s.stagedManifest ?? s.manifest;
  if (!manifest) throw new Error('MISSING_PUBLICATION_BINDING');
  if (
    manifest.runId !== s.runId ||
    manifest.revision !== s.revision ||
    manifest.approvalId !== s.projection?.approvalId ||
    manifest.projectionDigest !== sha256(canonicalJson(s.projection))
  )
    throw new Error('PUBLICATION_BINDING_MISMATCH');
  const expectedNames = manifest.files.map(f => f.name);
  if (canonicalJson((await readdir(path)).sort()) !== canonicalJson(expectedNames.sort()))
    throw new Error('INCOMPLETE_PUBLICATION');
  for (const f of manifest.files) {
    const file = resolve(path, f.name),
      stat = await lstat(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('UNSAFE_ARTIFACT');
    const bytes = await readFile(file);
    if (bytes.length !== f.bytes || sha256(bytes) !== f.sha256) throw new Error('ARTIFACT_HASH_MISMATCH');
  }
  return manifest;
}
export interface ExportOptions extends ReviewOptions {
  runtimeRoot: string;
  fault?: (stage: 'write' | 'state') => Promise<void>;
}
export async function publishExport(runId: string, options: ExportOptions) {
  checkCancellation(runId);
  const review = await openReviewStore(options.databaseUrl),
    processing = await openProcessingStore(options.databaseUrl);
  let state: ReviewState | undefined, temp: string | undefined;
  try {
    const plan = await prepareCompletion(options.databaseUrl, runId);
    const intake = await processing.readIntake(runId);
    if (!intake) throw new Error('SOURCE_UNAVAILABLE');
    const original = sourceBytes(intake.sourceBytes);
    state = await review.claimExport(runId);
    let evidence;
    try {
      evidence = (await revalidateEvidence(processing, runId, options)).evidence;
    } catch {
      await review.invalidate(runId);
      throw new Error('SOURCE_DRIFT');
    }
    await validateProjectionText(state.projection!, evidence);
    await screenRetainedPackage(original, plan.format, evidence);
    const parent = await containedDirectory(options.runtimeRoot, resolve(options.runtimeRoot, 'exports', runId), true),
      destination = bundlePath(options.runtimeRoot, state);
    try {
      await lstat(destination);
      const manifest = await verifyPublished(destination, state);
      if (
        manifest.sourceSha256 !== plan.sourceSha256 ||
        manifest.mappingDigest !== plan.mappingDigest ||
        manifest.writePlanDigest !== planDigest(plan)
      )
        throw new Error('PUBLICATION_BINDING_MISMATCH');
      const output = await readFile(resolve(destination, manifest.files[0]!.name));
      validateDocument(original, output, plan, state.projection!);
      await screenRetainedPackage(output, plan.format, evidence);
      checkCancellation(runId);
      if (state.state === 'exported') return { state, manifest, path: resolve(destination, manifest.files[0]!.name) };
      return {
        state: await review.finishExport(runId, state.claimToken!, manifest),
        manifest,
        path: resolve(destination, manifest.files[0]!.name),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (state.state === 'exported') throw new Error('MISSING_EXPORTED_BUNDLE');
    const bytes = writeDocument(original, plan, state.projection!);
    await screenRetainedPackage(bytes, plan.format, evidence);
    temp = await mkdtemp(resolve(parent, '.staging-'));
    const name = `answered.${plan.format}` as const;
    const manifest = documentPublicationSchema.parse({
      schemaVersion: 2,
      runId,
      revision: state.revision,
      approvalId: state.projection!.approvalId,
      projectionDigest: sha256(canonicalJson(state.projection)),
      quality: state.projection!.quality,
      sourceSha256: plan.sourceSha256,
      mappingDigest: plan.mappingDigest,
      writePlanDigest: planDigest(plan),
      format: plan.format,
      files: [{ name, sha256: sha256(bytes), bytes: bytes.length }],
    });
    await options.fault?.('write');
    await writeFile(resolve(temp, name), bytes, { flag: 'wx', mode: 0o600 });
    await verifyPublished(temp, { ...state, stagedManifest: manifest });
    await revalidateEvidence(processing, runId, options);
    await prepareCompletion(options.databaseUrl, runId);
    const latest = await review.read(runId);
    if (latest?.claimToken !== state.claimToken || latest.digest !== state.digest) throw new Error('STALE_EXPORT');
    checkCancellation(runId);
    state = await review.prepareExport(runId, state.claimToken!, manifest);
    checkCancellation(runId);
    await rename(temp, destination);
    temp = undefined;
    await options.fault?.('state');
    return {
      state: await review.finishExport(runId, state.claimToken!, manifest),
      manifest,
      path: resolve(destination, manifest.files[0]!.name),
    };
  } catch (error) {
    if (state?.claimToken) await review.releaseExport(runId, state.claimToken).catch(() => {});
    throw error;
  } finally {
    if (temp) await rm(temp, { recursive: true, force: true });
    review.close();
    processing.close();
  }
}
