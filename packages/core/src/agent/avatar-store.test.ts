import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Workspace } from '../workspace';
import { LocalFilesystem } from '../workspace/filesystem/local-filesystem';
import {
  DEFAULT_AVATAR_MAX_BYTES,
  extForMime,
  isSupportedAvatarMime,
  LocalAvatarStore,
  mimeForExt,
  SUPPORTED_AVATAR_MIME_TYPES,
  WorkspaceAvatarStore,
} from './avatar-store';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('avatar-store helpers', () => {
  it('has a 2 MB default cap', () => {
    expect(DEFAULT_AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
  });

  it('mime <-> extension', () => {
    expect(extForMime('image/png')).toBe('png');
    expect(extForMime('image/jpeg')).toBe('jpg');
    expect(extForMime('image/webp')).toBe('webp');
    expect(extForMime('image/gif')).toBe('gif');
    expect(extForMime('image/svg+xml')).toBe('svg');
    expect(() => extForMime('image/bmp')).toThrow(/Unsupported avatar mime/);

    expect(mimeForExt('png')).toBe('image/png');
    expect(mimeForExt('JPG')).toBe('image/jpeg');
    expect(mimeForExt('jpeg')).toBe('image/jpeg');
    expect(mimeForExt('unknown')).toBeUndefined();
  });

  it('isSupportedAvatarMime narrows correctly', () => {
    expect(isSupportedAvatarMime('image/png')).toBe(true);
    expect(isSupportedAvatarMime('image/tiff')).toBe(false);
    for (const m of SUPPORTED_AVATAR_MIME_TYPES) {
      expect(isSupportedAvatarMime(m)).toBe(true);
    }
  });
});

describe('LocalAvatarStore', () => {
  let dir: string;
  let store: LocalAvatarStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-avatar-test-'));
    store = new LocalAvatarStore({ basePath: dir });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('put writes bytes and returns a mastra-avatar URL', async () => {
    const result = await store.put('agent-1', PNG_HEADER, 'image/png');
    expect(result).toEqual({ url: 'mastra-avatar:agent-1' });
    const written = await fs.readFile(path.join(dir, 'agent-1.png'));
    expect(written.equals(PNG_HEADER)).toBe(true);
  });

  it('get returns bytes and mime for stored avatar', async () => {
    await store.put('agent-2', PNG_HEADER, 'image/png');
    const got = await store.get('agent-2');
    expect(got?.mime).toBe('image/png');
    expect(got?.bytes.equals(PNG_HEADER)).toBe(true);
  });

  it('get returns null when no avatar stored', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  it('delete removes stored file', async () => {
    await store.put('agent-3', PNG_HEADER, 'image/png');
    await store.delete('agent-3');
    expect(await store.get('agent-3')).toBeNull();
  });

  it('put replaces avatar of a different extension', async () => {
    await store.put('agent-4', PNG_HEADER, 'image/png');
    await store.put('agent-4', Buffer.from('gif'), 'image/gif');
    const files = await fs.readdir(dir);
    const forAgent = files.filter(f => f.startsWith('agent-4.'));
    expect(forAgent).toEqual(['agent-4.gif']);
  });

  it('rejects agent ids that could escape the base path', async () => {
    await expect(store.put('../evil', PNG_HEADER, 'image/png')).rejects.toThrow(/Invalid agent id/);
    await expect(store.put('a/b', PNG_HEADER, 'image/png')).rejects.toThrow(/Invalid agent id/);
    await expect(store.put('.hidden', PNG_HEADER, 'image/png')).rejects.toThrow(/Invalid agent id/);
    await expect(store.put('', PNG_HEADER, 'image/png')).rejects.toThrow(/Invalid agent id/);
  });

  it('rejects unsupported mime types', async () => {
    await expect(store.put('agent-5', PNG_HEADER, 'image/bmp')).rejects.toThrow(/Unsupported avatar mime/);
  });

  it('preserves the existing avatar when the mime is invalid (no filesystem side effect)', async () => {
    await store.put('agent-6', PNG_HEADER, 'image/png');
    const target = path.join(dir, 'agent-6.png');
    // Invalid mime rejects before any filesystem write, so the existing
    // avatar must remain intact — the temp+rename ordering guarantees no
    // partial state.
    await expect(store.put('agent-6', PNG_HEADER, 'image/bmp' as any)).rejects.toThrow();
    const still = await fs.readFile(target);
    expect(still.equals(PNG_HEADER)).toBe(true);
  });
});

describe('WorkspaceAvatarStore', () => {
  let dir: string;
  let workspace: Workspace<any, any>;
  let store: WorkspaceAvatarStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-avatar-ws-test-'));
    workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: dir }) });
    await workspace.init();
    store = new WorkspaceAvatarStore(workspace);
  });

  afterEach(async () => {
    await workspace.destroy?.().catch(() => undefined);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes into .mastra/avatars/', async () => {
    const result = await store.put('agent-w-1', PNG_HEADER, 'image/png');
    expect(result.url).toBe('mastra-avatar:agent-w-1');
    const onDisk = await fs.readFile(path.join(dir, '.mastra', 'avatars', 'agent-w-1.png'));
    expect(onDisk.equals(PNG_HEADER)).toBe(true);
  });

  it('round trips via get', async () => {
    await store.put('agent-w-2', PNG_HEADER, 'image/png');
    const got = await store.get('agent-w-2');
    expect(got?.mime).toBe('image/png');
    expect(got?.bytes.equals(PNG_HEADER)).toBe(true);
  });

  it('delete removes the file', async () => {
    await store.put('agent-w-3', PNG_HEADER, 'image/png');
    await store.delete('agent-w-3');
    expect(await store.get('agent-w-3')).toBeNull();
  });

  it('throws when constructed without a filesystem', () => {
    // Workspace without a filesystem — only skills configured.
    const bare = { filesystem: undefined } as unknown as Workspace<any, any>;
    expect(() => new WorkspaceAvatarStore(bare)).toThrow(/requires a workspace with a filesystem/);
  });
});
