import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { MastraCompositeStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildLibSQLStore } from '../utils/storage-factory.js';
import { __clearTenantStorageCache, resolveTenantStorage } from './tenant-storage.js';

// The composite store types `stores`/`stores.memory` as optionally undefined;
// after `init()` the libSQL memory domain is always present, so narrow once.
function memoryOf(store: MastraCompositeStore) {
  const memory = store.stores?.memory;
  if (!memory) throw new Error('libSQL memory domain not initialised');
  return memory;
}

// ── S3: true cross-tenant DB isolation with real libSQL stores ───────────
// `tenant-storage.test.ts` only proves the *resolved paths* differ. This
// scenario goes a layer deeper: it constructs real `LibSQLStore` instances
// from the resolved per-tenant `storageConfig.url` and proves the storage
// backend itself is the tenant wall — user B cannot read a thread/messages
// user A wrote, and the two tenants live in two distinct database files.

// Strip the `file:` prefix the resolver puts on local urls to get a real path.
function dbFilePath(url: string): string {
  return url.startsWith('file:') ? url.slice('file:'.length) : url;
}

let root: string;
const savedRoot = process.env.MASTRACODE_TENANT_DB_ROOT;
const savedTemplate = process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE;

beforeEach(() => {
  // Force the local-file branch of the resolver into a throwaway temp dir.
  delete process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE;
  root = mkdtempSync(path.join(os.tmpdir(), 'mc-tenant-iso-'));
  process.env.MASTRACODE_TENANT_DB_ROOT = root;
  __clearTenantStorageCache();
});

afterEach(() => {
  __clearTenantStorageCache();
  if (savedRoot === undefined) delete process.env.MASTRACODE_TENANT_DB_ROOT;
  else process.env.MASTRACODE_TENANT_DB_ROOT = savedRoot;
  if (savedTemplate === undefined) delete process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE;
  else process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE = savedTemplate;
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

describe('S3: cross-tenant libSQL isolation', () => {
  it('keeps one tenant from reading another tenant threads and messages', async () => {
    const a = resolveTenantStorage('user_a');
    const b = resolveTenantStorage('user_b');

    // Different tenants → different hashed dirs → different db files.
    expect(a.storageConfig.url).not.toBe(b.storageConfig.url);

    const storeA = buildLibSQLStore({ id: 'tenant-a', url: a.storageConfig.url });
    const storeB = buildLibSQLStore({ id: 'tenant-b', url: b.storageConfig.url });
    await storeA.init();
    await storeB.init();
    const memA = memoryOf(storeA);
    const memB = memoryOf(storeB);

    const threadId = 'thread-shared-id';
    const resourceId = 'resource-shared-id';
    const now = new Date();

    // 1. User A writes a thread + a message.
    await memA.saveThread({
      thread: { id: threadId, resourceId, title: 'A secret', createdAt: now, updatedAt: now },
    });
    await memA.saveMessages({
      messages: [
        {
          id: 'msg-1',
          threadId,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'tenant-a private content' }] },
          createdAt: now,
        } as never,
      ],
    });

    // 2. User B queries the SAME ids → must see nothing (no cross-tenant read).
    expect(await memB.getThreadById({ threadId })).toBeNull();
    const bThreads = await memB.listThreads({ filter: { resourceId } });
    expect(bThreads.threads).toHaveLength(0);
    const bMessages = await memB.listMessagesById({ messageIds: ['msg-1'] });
    expect(bMessages.messages).toHaveLength(0);

    // 3. User A reads its own data back → present.
    const aThread = await memA.getThreadById({ threadId });
    expect(aThread?.id).toBe(threadId);
    expect(aThread?.title).toBe('A secret');
    const aThreads = await memA.listThreads({ filter: { resourceId } });
    expect(aThreads.threads).toHaveLength(1);
    const aMessages = await memA.listMessagesById({ messageIds: ['msg-1'] });
    expect(aMessages.messages).toHaveLength(1);

    // 4. Two distinct db files actually exist on disk under distinct dirs.
    const fileA = dbFilePath(a.storageConfig.url);
    const fileB = dbFilePath(b.storageConfig.url);
    expect(fileA).not.toBe(fileB);
    expect(path.dirname(fileA)).not.toBe(path.dirname(fileB));
    expect(existsSync(fileA)).toBe(true);
    expect(existsSync(fileB)).toBe(true);

    await storeA.close?.();
    await storeB.close?.();
  });
});
