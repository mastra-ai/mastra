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

// Write a private thread + message into a tenant store. Returns the ids used.
async function seedPrivateThread(mem: ReturnType<typeof memoryOf>, marker: string) {
  const threadId = `thread-${marker}`;
  const resourceId = `resource-${marker}`;
  const messageId = `msg-${marker}`;
  const now = new Date();
  await mem.saveThread({
    thread: { id: threadId, resourceId, title: `${marker} secret`, createdAt: now, updatedAt: now },
  });
  await mem.saveMessages({
    messages: [
      {
        id: messageId,
        threadId,
        resourceId,
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: `${marker} private content` }] },
        createdAt: now,
      } as never,
    ],
  });
  return { threadId, resourceId, messageId };
}

describe('S3: cross-tenant libSQL isolation', () => {
  it('keeps one tenant from reading another tenant threads and messages', async () => {
    const a = await resolveTenantStorage({ userId: 'user_a' });
    const b = await resolveTenantStorage({ userId: 'user_b' });

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

describe('S3: per-(org,user) libSQL isolation', () => {
  it('isolates two users in the SAME org into distinct databases', async () => {
    const a = await resolveTenantStorage({ orgId: 'org_a', userId: 'user_1' });
    const b = await resolveTenantStorage({ orgId: 'org_a', userId: 'user_2' });

    expect(a.tenantKey).not.toBe(b.tenantKey);
    expect(a.storageConfig.url).not.toBe(b.storageConfig.url);

    const storeA = buildLibSQLStore({ id: 'org-a-u1', url: a.storageConfig.url });
    const storeB = buildLibSQLStore({ id: 'org-a-u2', url: b.storageConfig.url });
    await storeA.init();
    await storeB.init();
    const memA = memoryOf(storeA);
    const memB = memoryOf(storeB);

    const { threadId, resourceId, messageId } = await seedPrivateThread(memA, 'orgA-u1');

    // Same org, different user → no cross-read.
    expect(await memB.getThreadById({ threadId })).toBeNull();
    expect((await memB.listThreads({ filter: { resourceId } })).threads).toHaveLength(0);
    expect((await memB.listMessagesById({ messageIds: [messageId] })).messages).toHaveLength(0);

    // Owner reads its own data back.
    expect((await memA.getThreadById({ threadId }))?.id).toBe(threadId);

    // Distinct files on disk under distinct hashed dirs.
    const fileA = dbFilePath(a.storageConfig.url);
    const fileB = dbFilePath(b.storageConfig.url);
    expect(path.dirname(fileA)).not.toBe(path.dirname(fileB));
    expect(existsSync(fileA)).toBe(true);
    expect(existsSync(fileB)).toBe(true);

    await storeA.close?.();
    await storeB.close?.();
  });

  it('isolates the SAME user across two orgs into distinct databases', async () => {
    const a = await resolveTenantStorage({ orgId: 'org_a', userId: 'user_1' });
    const b = await resolveTenantStorage({ orgId: 'org_b', userId: 'user_1' });

    expect(a.tenantKey).not.toBe(b.tenantKey);
    expect(a.storageConfig.url).not.toBe(b.storageConfig.url);

    const storeA = buildLibSQLStore({ id: 'u1-org-a', url: a.storageConfig.url });
    const storeB = buildLibSQLStore({ id: 'u1-org-b', url: b.storageConfig.url });
    await storeA.init();
    await storeB.init();
    const memA = memoryOf(storeA);
    const memB = memoryOf(storeB);

    const { threadId, resourceId, messageId } = await seedPrivateThread(memA, 'u1-orgA');

    // Same user, different org → no cross-read.
    expect(await memB.getThreadById({ threadId })).toBeNull();
    expect((await memB.listThreads({ filter: { resourceId } })).threads).toHaveLength(0);
    expect((await memB.listMessagesById({ messageIds: [messageId] })).messages).toHaveLength(0);

    expect((await memA.getThreadById({ threadId }))?.id).toBe(threadId);

    await storeA.close?.();
    await storeB.close?.();
  });
});

describe('S3: remote URL template per-(org,user) isolation', () => {
  it('produces distinct remote urls carrying each tenant composite key', async () => {
    process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE = 'libsql://{id}.turso.io';

    const a = await resolveTenantStorage({ orgId: 'org_a', userId: 'user_1' });
    const b = await resolveTenantStorage({ orgId: 'org_b', userId: 'user_1' });

    expect(a.storageConfig.isRemote).toBe(true);
    expect(b.storageConfig.isRemote).toBe(true);
    expect(a.storageConfig.url).toBe(`libsql://${a.tenantKey}.turso.io`);
    expect(b.storageConfig.url).toBe(`libsql://${b.tenantKey}.turso.io`);
    expect(a.storageConfig.url).not.toBe(b.storageConfig.url);
  });
});
