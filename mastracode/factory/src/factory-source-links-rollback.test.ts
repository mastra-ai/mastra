import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FactoryStorage } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { MastraFactory } from './factory.js';
import { createFactorySecretEncryption } from './secret-encryption.js';
import type { FactoryProjectsStorage } from './storage/domains/projects/base.js';
import type { ExternalWorkItemSource, WorkItemsStorage } from './storage/domains/work-items/base.js';
import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
} from './storage/domains/work-items/work-item-schema.js';
import type { WorkItemSourceDbRecord } from './storage/domains/work-items/work-item-schema.js';

const USER = 'user-reland';
const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
vi.setConfig({ testTimeout: 30_000 });
const secretEncryption = createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } });

/** A database several Factory boots open in turn. */
async function database(backend: string): Promise<() => FactoryStorage> {
  if (backend === 'postgres') {
    const { PgFactoryStorage, PostgresStore } = await import('@mastra/pg');
    const admin = new PostgresStore({ id: 'reland-admin', connectionString: postgresUrl!, disableInit: true });
    const schema = `factory_test_${randomUUID().replaceAll('-', '')}`;
    await admin.pool.query(`CREATE SCHEMA "${schema}"`);
    onTestFinished(async () => {
      await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.close();
    });
    const url = new URL(postgresUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    return () => new PgFactoryStorage({ id: 'reland', connectionString: url.toString() });
  }
  const dir = mkdtempSync(join(tmpdir(), 'factory-reland-'));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  return () => new LibSQLFactoryStorage({ id: 'reland', url: `file:${join(dir, 'factory.db')}` });
}

async function boot(open: () => FactoryStorage) {
  const storage = open();
  const factory = new MastraFactory({ storage, auth: null, mcp: false, secretEncryption });
  let closed: Promise<void> | undefined;
  const close = () =>
    (closed ??= (async () => {
      await factory.shutdown();
      await storage.close();
    })());
  onTestFinished(close);
  await factory.prepare();
  const workItems = storage.getDomain<WorkItemsStorage>('work-items');
  return { storage, workItems, close };
}

const issue = (number: number): ExternalWorkItemSource => ({
  integrationId: 'github',
  type: 'issue',
  externalId: `github:10:issue:${number}`,
  url: `https://github.com/acme/app/issues/${number}`,
});

// A database cards shared records on, which then ran a release without links for a while: the
// first, reverted rollout, or a rollback to a release before this one. That release syncs facts to
// the source row only, and deleting a card removes its board item, work item and owned sources,
// leaving its links behind.
describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'Factory boot after a release without links ran on %s',
  backend => {
    async function setup() {
      vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
      vi.stubEnv('MASTRA_FACTORY_WORK_ITEM_SPLIT', '');
      onTestFinished(() => {
        vi.unstubAllEnvs();
      });
      const open = await database(backend);
      const orgId = `org-${randomUUID()}`;

      // Issue 12 on Work and Release, issue 14 on Work and Security.
      const first = await boot(open);
      const project = await first.storage.getDomain<FactoryProjectsStorage>('projects').create({
        orgId,
        userId: USER,
        input: { name: 'Reland' },
      });
      const scope = { orgId, factoryProjectId: project.id, userId: USER };
      const file = async (source: ExternalWorkItemSource, workItems: WorkItemsStorage = first.workItems) =>
        (
          await workItems.upsert({
            ...scope,
            input: {
              title: source.externalId,
              board: 'work',
              stages: ['intake'],
              externalSource: source,
              metadata: { state: 'open', labels: ['bug'] },
            },
          })
        ).item;
      const work12 = await file(issue(12));
      const release12 = (await first.workItems.linkWorkItemToBoard({
        orgId,
        id: work12.id,
        board: 'release',
        stage: 'triage',
        userId: USER,
      }))!;
      const work14 = await file(issue(14));
      const security14 = (await first.workItems.linkWorkItemToBoard({
        orgId,
        id: work14.id,
        board: 'security',
        stage: 'triage',
        userId: USER,
      }))!;

      // The release without links, as it writes rows.
      const ops = first.storage.ops;
      const source12 = (await ops.findOne<WorkItemSourceDbRecord>(FACTORY_WORK_ITEM_SOURCES_SCHEMA.name, {
        work_item_id: work12.workItemId,
      }))!;
      await ops.updateMany(
        FACTORY_WORK_ITEM_SOURCES_SCHEMA.name,
        { id: source12.id },
        {
          state: 'closed',
          labels: ['bug', 'p1'],
          metadata: { ...source12.metadata, state: 'closed', labels: ['bug', 'p1'] },
          revision: source12.revision + 1,
          synced_at: new Date(Date.now() + 1_000),
          updated_at: new Date(Date.now() + 1_000),
        },
      );
      await ops.deleteMany(FACTORY_BOARD_ITEMS_SCHEMA.name, { id: security14.id });
      await ops.deleteMany(FACTORY_WORK_ITEMS_SCHEMA.name, { id: security14.workItemId });
      await first.close();

      const upgraded = await boot(open);
      return { ...upgraded, orgId, scope, file, work12, release12, work14 };
    }

    it("shows that release's facts on every card of the issue", async () => {
      const { workItems, orgId, work12, release12 } = await setup();

      for (const card of [work12, release12]) {
        expect((await workItems.get({ orgId, id: card.id }))!.workItem).toMatchObject({
          state: 'closed',
          labels: ['bug', 'p1'],
        });
      }
    });

    it('lets intake file an issue again after its last card goes, when that release deleted a sibling', async () => {
      const { workItems, orgId, scope, file, work14 } = await setup();

      expect((await workItems.listByProjectSource({ ...scope, source: issue(14) })).map(card => card.id)).toEqual([
        work14.id,
      ]);
      await workItems.delete({ orgId, id: work14.id });
      expect(await workItems.listByProjectSource({ ...scope, source: issue(14) })).toEqual([]);

      const refiled = await file(issue(14), workItems);
      expect(refiled.id).not.toBe(work14.id);
      expect(refiled).toMatchObject({ board: 'work', externalSource: issue(14) });
    });
  },
);
