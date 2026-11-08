import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BillingError, identifierSchema, parseInput } from '../billing/contracts.js';

const profileSchema = z.strictObject({
  actorId: identifierSchema,
  workspaceId: identifierSchema,
  credential: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const profilesSchema = z.strictObject({
  version: z.literal(1),
  databaseUrl: z.url(),
  ready: z.boolean(),
  profiles: z.strictObject({
    owner: profileSchema.optional(),
    member: profileSchema.optional(),
    outsider: profileSchema.optional(),
  }),
  invitation: z
    .strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), expiresAt: z.iso.datetime() })
    .optional(),
});
export type LocalProfiles = z.infer<typeof profilesSchema>;
export type ProfileName = 'owner' | 'member' | 'outsider';
export function localPaths(root: string) {
  const directory = resolve(root, 'data');
  return { directory, manifest: resolve(directory, 'local-profiles.json'), lock: resolve(directory, 'setup.lock') };
}
export async function privateDirectory(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0)
    throw new BillingError('storage_unavailable');
}
async function privateHandle(filename: string) {
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1 || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0)
      throw new BillingError('storage_unavailable');
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}
export async function readLocalProfiles(root: string, required = true): Promise<LocalProfiles | null> {
  const { directory, manifest } = localPaths(root);
  try {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0)
      throw new BillingError('storage_unavailable');
    const handle = await privateHandle(manifest);
    try {
      return parseInput(profilesSchema, JSON.parse(await handle.readFile('utf8')));
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (!required && error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw new BillingError('state_unavailable');
  }
}
export async function writeLocalProfiles(root: string, manifest: LocalProfiles) {
  const filename = localPaths(root).manifest;
  const temporary = `${filename}.${randomUUID()}.tmp`;
  const handle = await open(
    temporary,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(JSON.stringify(parseInput(profilesSchema, manifest), null, 2) + '\n');
    await handle.sync();
    await handle.close();
    await rename(temporary, filename);
  } finally {
    await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}
