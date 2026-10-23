import { lstat, readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { executionPolicySchema } from '../contracts/execution-policy.ts';
import { evidenceProfileSchema } from '../contracts/profile.ts';
import { manifestSchema } from '../contracts/evidence-manifest.ts';
import { loadManifest } from '../evidence/snapshot.ts';

export async function loadEvidenceProfile(runtimeRoot = resolve('.runtime')) {
  const root = resolve(runtimeRoot),
    path = resolve(root, 'profile.json');
  const [rootStat, stat] = await Promise.all([lstat(root), lstat(path)]).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('PROFILE_NOT_CONFIGURED');
    throw error;
  });
  if (
    rootStat.isSymbolicLink() ||
    !rootStat.isDirectory() ||
    stat.isSymbolicLink() ||
    !stat.isFile() ||
    (await realpath(path)) !== resolve(await realpath(root), 'profile.json')
  )
    throw new Error('PROFILE_PATH_UNSAFE');
  if (stat.size > 65536) throw new Error('PROFILE_SIZE_LIMIT');
  return validateEvidenceProfile(JSON.parse(await readFile(path, 'utf8')));
}
export async function validateEvidenceProfile(raw: unknown) {
  const profile = evidenceProfileSchema.parse(raw);
  const manifest = manifestSchema.parse(await loadManifest(profile.manifestPath));
  if (manifest.organizationId !== profile.scope.organizationId) throw new Error('PROFILE_SCOPE_MISMATCH');
  const evidence = await lstat(profile.evidenceRoot),
    manifestFile = await lstat(profile.manifestPath);
  if (!evidence.isDirectory() || evidence.isSymbolicLink() || !manifestFile.isFile() || manifestFile.isSymbolicLink())
    throw new Error('PROFILE_SOURCE_UNSAFE');
  profile.policy = executionPolicySchema.parse({
    ...profile.policy,
    model: process.env.VRQ_MODEL?.trim() || profile.policy.model,
  });
  return profile;
}
