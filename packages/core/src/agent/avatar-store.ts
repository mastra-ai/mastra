/**
 * Persistent storage for agent avatars.
 *
 * Avatars used to live inside `metadata.avatarUrl` as base64 data URLs, capped
 * at 512 KB. This module lets an agent (or user code) persist larger avatars
 * out-of-band and reference them via a compact `mastra-avatar:<agentId>` URL,
 * which the server resolves back to bytes at request time.
 *
 * The default store is {@link StorageAvatarStore}, which keeps avatars in the
 * configured Mastra storage adapter next to the rest of the agent's data.
 * {@link WorkspaceAvatarStore} (workspace filesystem) and
 * {@link LocalAvatarStore} (local disk; tests/dev) are opt-in alternatives,
 * and fully custom stores (S3, CDN, ...) can implement {@link AvatarStore}.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { MastraCompositeStore } from '../storage/base';
import type { Workspace } from '../workspace';
import type { WorkspaceFilesystem } from '../workspace/filesystem';

export interface StoredAvatar {
  bytes: Buffer;
  mime: string;
}

export interface PutAvatarResult {
  /**
   * The URL to write to `metadata.avatarUrl`. Built-in stores return
   * `mastra-avatar:<agentId>`. Custom stores may return absolute URLs
   * (e.g. a signed S3 URL).
   */
  url: string;
}

export interface AvatarStore {
  put(agentId: string, bytes: Buffer, mime: string): Promise<PutAvatarResult>;
  get(agentId: string): Promise<StoredAvatar | null>;
  delete(agentId: string): Promise<void>;
}

/** Mime types accepted by the built-in stores. */
export const SUPPORTED_AVATAR_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

export type SupportedAvatarMimeType = (typeof SUPPORTED_AVATAR_MIME_TYPES)[number];

const MIME_TO_EXT: Record<SupportedAvatarMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const EXT_TO_MIME: Record<string, SupportedAvatarMimeType> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

export const DEFAULT_AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export function isSupportedAvatarMime(mime: string): mime is SupportedAvatarMimeType {
  return (SUPPORTED_AVATAR_MIME_TYPES as readonly string[]).includes(mime);
}

export function extForMime(mime: string): string {
  if (!isSupportedAvatarMime(mime)) {
    throw new Error(`Unsupported avatar mime type '${mime}'. Supported: ${SUPPORTED_AVATAR_MIME_TYPES.join(', ')}.`);
  }
  return MIME_TO_EXT[mime];
}

export function mimeForExt(ext: string): SupportedAvatarMimeType | undefined {
  return EXT_TO_MIME[ext.toLowerCase()];
}

/**
 * Reject anything that could escape a store's directory (path separators,
 * traversal). Stored agent IDs are validated upstream but the store must not
 * assume that.
 */
function assertSafeAgentId(agentId: string): void {
  if (
    !agentId ||
    agentId.includes('/') ||
    agentId.includes('\\') ||
    agentId.includes('..') ||
    agentId.startsWith('.')
  ) {
    throw new Error(`Invalid agent id for avatar store: '${agentId}'`);
  }
}

/**
 * Store avatars in Mastra's storage layer (the `agentAvatars` storage domain).
 *
 * This is the default avatar store: avatars live alongside the rest of the
 * agent's data (metadata, versions) in whatever storage adapter the user
 * configured, so they are durable and shared across replicas without any
 * extra configuration. Bytes are persisted base64-encoded for cross-adapter
 * portability.
 */
export class StorageAvatarStore implements AvatarStore {
  private readonly storage: MastraCompositeStore;

  constructor(storage: MastraCompositeStore) {
    this.storage = storage;
  }

  async put(agentId: string, bytes: Buffer, mime: string): Promise<PutAvatarResult> {
    assertSafeAgentId(agentId);
    // Validates the mime type (throws on unsupported).
    extForMime(mime);
    const store = await this.storage.getStore('agentAvatars');
    if (!store) {
      throw new Error(
        `Storage adapter '${this.storage.id}' does not support the 'agentAvatars' domain. ` +
          `Configure an avatarStore on Mastra (e.g. a custom AvatarStore or WorkspaceAvatarStore), ` +
          `or use a storage adapter that implements agent avatar storage.`,
      );
    }
    await store.put({ agentId, data: bytes.toString('base64'), mime });
    return { url: `mastra-avatar:${agentId}` };
  }

  async get(agentId: string): Promise<StoredAvatar | null> {
    assertSafeAgentId(agentId);
    const store = await this.storage.getStore('agentAvatars');
    if (!store) return null;
    const row = await store.get(agentId);
    if (!row) return null;
    return { bytes: Buffer.from(row.data, 'base64'), mime: row.mime };
  }

  async delete(agentId: string): Promise<void> {
    assertSafeAgentId(agentId);
    const store = await this.storage.getStore('agentAvatars');
    if (!store) return;
    await store.delete(agentId);
  }
}

/**
 * Store avatars in a `Workspace`'s filesystem under `.mastra/avatars/`.
 *
 * Works with any `WorkspaceFilesystem` provider (Local, Mastra, S3, AgentFS,
 * ...). No special-casing per provider — path resolution is the provider's job.
 *
 * Opt-in: pass it explicitly via `new Mastra({ avatarStore: new WorkspaceAvatarStore(workspace) })`.
 */
export class WorkspaceAvatarStore implements AvatarStore {
  private readonly fs: WorkspaceFilesystem;
  private readonly dir: string;

  constructor(workspace: Workspace, options: { dir?: string } = {}) {
    const filesystem = workspace.filesystem as WorkspaceFilesystem | undefined;
    if (!filesystem) {
      throw new Error('WorkspaceAvatarStore requires a workspace with a filesystem configured.');
    }
    this.fs = filesystem;
    this.dir = options.dir ?? '.mastra/avatars';
  }

  async put(agentId: string, bytes: Buffer, mime: string): Promise<PutAvatarResult> {
    assertSafeAgentId(agentId);
    const ext = extForMime(mime);
    const target = this.pathFor(agentId, ext);
    // Write the new avatar FIRST — a failed write must not delete the existing one.
    await this.fs.writeFile(target, bytes, { recursive: true, overwrite: true, mimeType: mime });
    // Then clean up any previous avatar with a different extension (best-effort,
    // skipping the extension we just wrote).
    await this.deleteExisting(agentId, ext);
    return { url: `mastra-avatar:${agentId}` };
  }

  async get(agentId: string): Promise<StoredAvatar | null> {
    assertSafeAgentId(agentId);
    for (const ext of Object.values(MIME_TO_EXT)) {
      const p = this.pathFor(agentId, ext);
      if (await this.fs.exists(p).catch(() => false)) {
        const content = await this.fs.readFile(p);
        const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
        const mime = mimeForExt(ext);
        if (!mime) continue;
        return { bytes, mime };
      }
    }
    return null;
  }

  async delete(agentId: string): Promise<void> {
    assertSafeAgentId(agentId);
    await this.deleteExisting(agentId);
  }

  private pathFor(agentId: string, ext: string): string {
    return `${this.dir}/${agentId}.${ext}`;
  }

  private async deleteExisting(agentId: string, skipExt?: string): Promise<void> {
    for (const ext of Object.values(MIME_TO_EXT)) {
      if (skipExt && ext === skipExt) continue;
      const p = this.pathFor(agentId, ext);
      try {
        if (await this.fs.exists(p).catch(() => false)) {
          await this.fs.deleteFile(p, { force: true });
        }
      } catch {
        // best-effort cleanup — ignore failures for one extension
      }
    }
  }
}

/**
 * Store avatars on the local filesystem via `node:fs/promises`.
 *
 * Opt-in helper for tests and local development. Default base path is a
 * process-scoped tmpdir; pass `basePath` for persistence. Not suitable for
 * production (not shared across replicas, lost on host teardown) — prefer the
 * default `StorageAvatarStore` or a custom store.
 */
export class LocalAvatarStore implements AvatarStore {
  private readonly basePath: string;

  constructor(options: { basePath?: string } = {}) {
    this.basePath = options.basePath ?? path.join(os.tmpdir(), 'mastra-avatars');
  }

  async put(agentId: string, bytes: Buffer, mime: string): Promise<PutAvatarResult> {
    assertSafeAgentId(agentId);
    const ext = extForMime(mime);
    await fs.mkdir(this.basePath, { recursive: true });
    const target = this.pathFor(agentId, ext);
    // Write to a temp file, then atomically rename onto the target. If the
    // write or rename fails, the previous avatar (if any) is preserved.
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await fs.writeFile(tmp, bytes);
      await fs.rename(tmp, target);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => {
        /* best-effort */
      });
      throw err;
    }
    // Only after the new avatar is durably in place, clean up previous ones
    // with a different extension.
    await this.deleteExisting(agentId, ext);
    return { url: `mastra-avatar:${agentId}` };
  }

  async get(agentId: string): Promise<StoredAvatar | null> {
    assertSafeAgentId(agentId);
    for (const ext of Object.values(MIME_TO_EXT)) {
      const p = this.pathFor(agentId, ext);
      try {
        const bytes = await fs.readFile(p);
        const mime = mimeForExt(ext);
        if (!mime) continue;
        return { bytes, mime };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw err;
      }
    }
    return null;
  }

  async delete(agentId: string): Promise<void> {
    assertSafeAgentId(agentId);
    await this.deleteExisting(agentId);
  }

  private pathFor(agentId: string, ext: string): string {
    return path.join(this.basePath, `${agentId}.${ext}`);
  }

  private async deleteExisting(agentId: string, skipExt?: string): Promise<void> {
    for (const ext of Object.values(MIME_TO_EXT)) {
      if (skipExt && ext === skipExt) continue;
      const p = this.pathFor(agentId, ext);
      await fs.rm(p, { force: true }).catch(() => {
        /* best-effort */
      });
    }
  }
}
