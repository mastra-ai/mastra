import { randomUUID } from 'node:crypto';
import { Spanner } from '@google-cloud/spanner';
import {
  createSampleMessageV2,
  createSampleTask,
  createSampleThread,
  createSampleWorkflowSnapshot,
  createTestSuite,
  createConfigValidationTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import { TABLE_AGENTS, TraceStatus } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpannerDB } from './db';
import { AgentsSpanner } from './domains/agents';
import { BackgroundTasksSpanner } from './domains/background-tasks';
import { BlobsSpanner } from './domains/blobs';
import { ChannelsSpanner } from './domains/channels';
import { DatasetsSpanner } from './domains/datasets';
import { ExperimentsSpanner } from './domains/experiments';
import { FavoritesSpanner } from './domains/favorites';
import { MCPClientsSpanner } from './domains/mcp-clients';
import { MCPServersSpanner } from './domains/mcp-servers';
import { MemorySpanner } from './domains/memory';
import { ObservabilitySpanner } from './domains/observability';
import { defaultMetricIndexDefs, ensureMetricsTable, listMetrics } from './domains/observability/metrics';
import { PromptBlocksSpanner } from './domains/prompt-blocks';
import { SchedulesSpanner } from './domains/schedules';
import { ScorerDefinitionsSpanner } from './domains/scorer-definitions';
import { ScoresSpanner } from './domains/scores';
import { SkillsSpanner } from './domains/skills';
import { WorkflowsSpanner } from './domains/workflows';
import { WorkspacesSpanner } from './domains/workspaces';
import { SpannerStore } from '.';
import type { SpannerConfig } from '.';

const PROJECT_ID = process.env.SPANNER_PROJECT_ID || 'test-project';
const INSTANCE_ID = process.env.SPANNER_INSTANCE_ID || 'test-instance';
const EMULATOR_HOST = process.env.SPANNER_EMULATOR_HOST || 'localhost:9010';

// Each invocation creates a fresh database so tests are isolated.
const sharedSuffix = `mastra${Math.floor(Date.now() / 1000) % 100000}`;
const sharedDbId = `db-${sharedSuffix}`;
const directDbId = `db-${sharedSuffix}-d`;
const validateDbId = `db-${sharedSuffix}-v`;
// Database dedicated to initMode='validate' fresh-DB tests. Never has DDL
// applied to it; the "happy path" tests reuse `sharedDbId`, which is already
// fully populated by the createTestSuite block registered earlier in the file
// (vitest runs tests in a single file sequentially in registration order).
const validateModeEmptyDbId = `db-${sharedSuffix}-vmempty`;

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const spannerOptions = {
  servicePath: EMULATOR_HOST.split(':')[0],
  port: Number(EMULATOR_HOST.split(':')[1] ?? 9010),
  sslCreds: undefined,
};

async function ensureInstance(client: Spanner): Promise<void> {
  const instance = client.instance(INSTANCE_ID);
  const [exists] = await instance.exists();
  if (exists) return;
  const [, op] = await client.createInstance(INSTANCE_ID, {
    config: 'emulator-config',
    nodes: 1,
    displayName: INSTANCE_ID,
  });
  // Operation type is loosely typed as `any` here; the emulator returns immediately.
  await (op as any).promise();
}

async function ensureDatabase(client: Spanner, databaseId: string): Promise<void> {
  const instance = client.instance(INSTANCE_ID);
  const database = instance.database(databaseId);
  const [exists] = await database.exists();
  if (exists) return;
  const [, op] = await instance.createDatabase(databaseId);
  await (op as any).promise();
}

function makeClient(): Spanner {
  process.env.SPANNER_EMULATOR_HOST = EMULATOR_HOST;
  return new Spanner({ projectId: PROJECT_ID, ...spannerOptions });
}

const ENABLE_TESTS = process.env.ENABLE_TESTS === 'true';

if (!ENABLE_TESTS) {
  console.log(
    'Spanner integration tests are disabled by default. Run with ENABLE_TESTS=true and a running Spanner emulator.',
  );
}

if (ENABLE_TESTS) {
  // Bootstrap the emulator once; instance/database creation is fast on the emulator.
  const bootstrapClient = makeClient();
  beforeAll(async () => {
    await ensureInstance(bootstrapClient);
    await ensureDatabase(bootstrapClient, sharedDbId);
    await ensureDatabase(bootstrapClient, directDbId);
    await ensureDatabase(bootstrapClient, validateDbId);
    await ensureDatabase(bootstrapClient, validateModeEmptyDbId);
  });

  afterAll(async () => {
    bootstrapClient.close();
  });

  const sharedConfig: SpannerConfig = {
    id: 'spanner-shared',
    projectId: PROJECT_ID,
    instanceId: INSTANCE_ID,
    databaseId: sharedDbId,
    spannerOptions,
    // The production default is `disableMetrics: true` because Spanner is not
    // a good fit for the metrics workload at scale. The test suite opts in so
    // every metric method's correctness is still exercised against the
    // emulator; a separate test (`metrics disabled by default`) covers the
    // default-off path explicitly.
    disableMetrics: false,
  };

  createTestSuite(new SpannerStore(sharedConfig));

  // Domain-level direct usage with a pre-configured Database handle.
  createDomainDirectTests({
    storeName: 'Spanner',
    createMemoryDomain: () => {
      const client = makeClient();
      return new MemorySpanner({ database: client.instance(INSTANCE_ID).database(directDbId) });
    },
    createWorkflowsDomain: () => {
      const client = makeClient();
      return new WorkflowsSpanner({ database: client.instance(INSTANCE_ID).database(directDbId) });
    },
    createScoresDomain: () => {
      const client = makeClient();
      return new ScoresSpanner({ database: client.instance(INSTANCE_ID).database(directDbId) });
    },
    createDatasetsDomain: () => {
      const client = makeClient();
      return new DatasetsSpanner({ database: client.instance(INSTANCE_ID).database(directDbId) });
    },
    createExperimentsDomain: () => {
      const client = makeClient();
      return new ExperimentsSpanner({ database: client.instance(INSTANCE_ID).database(directDbId) });
    },
  });

  // Direct-usage smoke test for the Agents domain (the shared
  // createDomainDirectTests helper doesn't have an `agents` slot).
  describe('AgentsSpanner direct usage', () => {
    it('can create, version and delete an agent against a pre-configured Database', async () => {
      const client = makeClient();
      const agentsDomain = new AgentsSpanner({ database: client.instance(INSTANCE_ID).database(directDbId) });
      await agentsDomain.init();

      const agentId = `direct-agent-${Date.now()}`;
      await agentsDomain.create({
        agent: {
          id: agentId,
          name: 'Direct Agent',
          instructions: 'Be helpful',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      const fetched = await agentsDomain.getByIdResolved(agentId);
      expect(fetched?.name).toBe('Direct Agent');

      const versions = await agentsDomain.listVersions({ agentId });
      expect(versions.total).toBeGreaterThanOrEqual(1);

      await agentsDomain.delete(agentId);
      const afterDelete = await agentsDomain.getById(agentId);
      expect(afterDelete).toBeNull();
    });
  });

  // The shared test factory has no slot for workspaces (a versioned domain), so
  // exercise its thin-record + version snapshot surface inline against the
  // already-initialized shared database.
  describe('WorkspacesSpanner integration', () => {
    let workspaces: WorkspacesSpanner;

    beforeAll(async () => {
      const store = new SpannerStore(sharedConfig);
      await store.init();
      workspaces = (await store.getStore('workspaces')) as WorkspacesSpanner;
    });

    it('creates a draft workspace with a seed version', async () => {
      const id = `ws-${randomUUID()}`;
      const created = await workspaces.create({
        workspace: { id, name: 'My Workspace', description: 'first', autoSync: true } as any,
      });
      expect(created.id).toBe(id);
      expect(created.status).toBe('draft');
      expect(created.activeVersionId).toBeUndefined();

      const latest = await workspaces.getLatestVersion(id);
      expect(latest?.versionNumber).toBe(1);
      expect(latest?.name).toBe('My Workspace');
      expect(latest?.autoSync).toBe(true);

      const resolved = await workspaces.getByIdResolved(id, { status: 'draft' });
      expect(resolved?.name).toBe('My Workspace');
      expect(resolved?.description).toBe('first');
    });

    it('creates a new version when config fields change but not for metadata-only updates', async () => {
      const id = `ws-${randomUUID()}`;
      await workspaces.create({ workspace: { id, name: 'W', description: 'a' } as any });

      // metadata-only update: no new version
      await workspaces.update({ id, metadata: { team: 'x' } } as any);
      expect(await workspaces.countVersions(id)).toBe(1);

      // config change: bumps to version 2
      const updated = await workspaces.update({ id, description: 'b' } as any);
      expect(updated).toBeDefined();
      expect(await workspaces.countVersions(id)).toBe(2);
      const latest = await workspaces.getLatestVersion(id);
      expect(latest?.versionNumber).toBe(2);
      expect(latest?.description).toBe('b');
      expect(latest?.changedFields).toContain('description');

      // identical config value: no new version
      await workspaces.update({ id, description: 'b' } as any);
      expect(await workspaces.countVersions(id)).toBe(2);
    });

    it('auto-publishes when activeVersionId is set', async () => {
      const id = `ws-${randomUUID()}`;
      await workspaces.create({ workspace: { id, name: 'W' } as any });
      const v1 = await workspaces.getLatestVersion(id);
      const updated = await workspaces.update({ id, activeVersionId: v1!.id } as any);
      expect(updated.status).toBe('published');
      expect(updated.activeVersionId).toBe(v1!.id);
    });

    it('resolves the active version by default and a specific version by id', async () => {
      const id = `ws-${randomUUID()}`;
      await workspaces.create({ workspace: { id, name: 'orig' } as any });
      const v1 = await workspaces.getLatestVersion(id);
      await workspaces.update({ id, name: 'orig', description: 'v2desc' } as any);
      const v2 = await workspaces.getVersionByNumber(id, 2);
      await workspaces.update({ id, activeVersionId: v2!.id } as any);

      const publishedResolved = await workspaces.getByIdResolved(id);
      expect(publishedResolved?.description).toBe('v2desc');

      const pinnedResolved = await workspaces.getByIdResolved(id, { versionId: v1!.id });
      expect(pinnedResolved?.description).toBeUndefined();
    });

    it('lists workspaces and paginates versions', async () => {
      const id = `ws-${randomUUID()}`;
      const authorId = `author-${randomUUID()}`;
      await workspaces.create({ workspace: { id, name: 'L', authorId } as any });
      await workspaces.update({ id, description: 'v2' } as any);
      await workspaces.update({ id, description: 'v3' } as any);

      const listed = await workspaces.list({ authorId });
      expect(listed.workspaces.map(w => w.id)).toContain(id);
      expect(listed.total).toBe(1);

      const versions = await workspaces.listVersions({ workspaceId: id, perPage: 2, page: 0 });
      expect(versions.total).toBe(3);
      expect(versions.versions).toHaveLength(2);
      expect(versions.hasMore).toBe(true);
    });

    it('deletes a workspace and all its versions', async () => {
      const id = `ws-${randomUUID()}`;
      await workspaces.create({ workspace: { id, name: 'D' } as any });
      await workspaces.update({ id, description: 'v2' } as any);
      expect(await workspaces.countVersions(id)).toBe(2);

      await workspaces.delete(id);
      expect(await workspaces.getById(id)).toBeNull();
      expect(await workspaces.countVersions(id)).toBe(0);
    });

    it('getById / getVersion return null for unknown ids', async () => {
      expect(await workspaces.getById(`missing-${randomUUID()}`)).toBeNull();
      expect(await workspaces.getVersion(`missing-${randomUUID()}`)).toBeNull();
      expect(await workspaces.getVersionByNumber(`missing-${randomUUID()}`, 1)).toBeNull();
      expect(await workspaces.getLatestVersion(`missing-${randomUUID()}`)).toBeNull();
    });

    it('createVersion appends a version and getVersion fetches it by id', async () => {
      const id = `ws-${randomUUID()}`;
      await workspaces.create({ workspace: { id, name: 'CV' } as any });
      const versionId = randomUUID();
      const created = await workspaces.createVersion({
        id: versionId,
        workspaceId: id,
        versionNumber: 2,
        name: 'CV',
        description: 'manual v2',
        autoSync: true,
        changedFields: ['description'],
        changeMessage: 'manual',
      } as any);
      expect(created.id).toBe(versionId);

      const fetched = await workspaces.getVersion(versionId);
      expect(fetched?.versionNumber).toBe(2);
      expect(fetched?.description).toBe('manual v2');
      expect(fetched?.autoSync).toBe(true);
      expect(await workspaces.getVersionByNumber(id, 2)).toMatchObject({ id: versionId });
      expect((await workspaces.getLatestVersion(id))?.versionNumber).toBe(2);
    });

    it('deleteVersion removes a single version; deleteVersionsByParentId clears all', async () => {
      const id = `ws-${randomUUID()}`;
      await workspaces.create({ workspace: { id, name: 'DV' } as any });
      await workspaces.update({ id, description: 'v2' } as any);
      const v2 = await workspaces.getVersionByNumber(id, 2);

      await workspaces.deleteVersion(v2!.id);
      expect(await workspaces.getVersion(v2!.id)).toBeNull();
      expect(await workspaces.countVersions(id)).toBe(1);

      await workspaces.deleteVersionsByParentId(id);
      expect(await workspaces.countVersions(id)).toBe(0);
    });

    it('list paginates and filters by metadata', async () => {
      const tag = `grp-${randomUUID()}`;
      for (let i = 0; i < 3; i++) {
        await workspaces.create({
          workspace: { id: `ws-${randomUUID()}`, name: `M${i}`, metadata: { grp: tag } } as any,
        });
      }
      const page0 = await workspaces.list({ metadata: { grp: tag }, page: 0, perPage: 2 });
      expect(page0.total).toBe(3);
      expect(page0.workspaces).toHaveLength(2);
      expect(page0.hasMore).toBe(true);

      const all = await workspaces.list({ metadata: { grp: tag }, perPage: false });
      expect(all.workspaces).toHaveLength(3);
      expect(all.hasMore).toBe(false);
    });

    it('listResolved merges the active version config into each record', async () => {
      const authorId = `author-${randomUUID()}`;
      const id = `ws-${randomUUID()}`;
      await workspaces.create({ workspace: { id, name: 'R', description: 'd1', authorId } as any });
      const resolved = await workspaces.listResolved({ authorId } as any);
      const row = resolved.workspaces.find(w => w.id === id);
      expect(row?.name).toBe('R');
      expect(row?.description).toBe('d1');
    });
  });

  // Dedicated, explicit per-method coverage for the favorites domain. The shared
  // `createTestSuite` (registered at the top of this file) also exercises these
  // paths; this block guarantees every public method has direct coverage and
  // pins Spanner-specific behavior (composite primary key, counter persistence).
  describe('FavoritesSpanner methods', () => {
    let favorites: FavoritesSpanner;
    let agents: AgentsSpanner;
    let skills: SkillsSpanner;

    const makeAgent = async (id: string) => {
      await agents.create({
        agent: { id, name: id, instructions: 'x', model: { provider: 'openai', name: 'gpt-4' } } as any,
      });
    };
    const makeSkill = async (id: string) => {
      await skills.create({ skill: { id, name: id, description: 'd', instructions: 'i' } as any });
    };

    beforeAll(async () => {
      const store = new SpannerStore(sharedConfig);
      await store.init();
      favorites = (await store.getStore('favorites')) as FavoritesSpanner;
      agents = (await store.getStore('agents')) as AgentsSpanner;
      skills = (await store.getStore('skills')) as SkillsSpanner;
    });

    beforeEach(async () => {
      await favorites.dangerouslyClearAll();
    });

    it('favorite increments the counter and is idempotent', async () => {
      const id = `a-${randomUUID()}`;
      await makeAgent(id);
      expect(await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: id })).toEqual({
        favorited: true,
        favoriteCount: 1,
      });
      expect(await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: id })).toEqual({
        favorited: true,
        favoriteCount: 1,
      });
      expect(await favorites.favorite({ userId: 'u2', entityType: 'agent', entityId: id })).toEqual({
        favorited: true,
        favoriteCount: 2,
      });
      expect((await agents.getById(id))?.favoriteCount).toBe(2);
    });

    it('favorite throws when the entity does not exist', async () => {
      await expect(
        favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: `missing-${randomUUID()}` }),
      ).rejects.toThrow();
    });

    it('unfavorite decrements, clamps at 0, and is idempotent', async () => {
      const id = `s-${randomUUID()}`;
      await makeSkill(id);
      await favorites.favorite({ userId: 'u1', entityType: 'skill', entityId: id });
      expect(await favorites.unfavorite({ userId: 'u1', entityType: 'skill', entityId: id })).toEqual({
        favorited: false,
        favoriteCount: 0,
      });
      // Idempotent + clamped.
      expect(await favorites.unfavorite({ userId: 'u1', entityType: 'skill', entityId: id })).toEqual({
        favorited: false,
        favoriteCount: 0,
      });
      expect((await skills.getById(id))?.favoriteCount).toBe(0);
    });

    it('isFavorited / isFavoritedBatch report state per user', async () => {
      const a1 = `a-${randomUUID()}`;
      const a2 = `a-${randomUUID()}`;
      await makeAgent(a1);
      await makeAgent(a2);
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: a1 });

      expect(await favorites.isFavorited({ userId: 'u1', entityType: 'agent', entityId: a1 })).toBe(true);
      expect(await favorites.isFavorited({ userId: 'u2', entityType: 'agent', entityId: a1 })).toBe(false);
      expect(
        await favorites.isFavoritedBatch({ userId: 'u1', entityType: 'agent', entityIds: [a1, a2, 'missing'] }),
      ).toEqual(new Set([a1]));
      expect((await favorites.isFavoritedBatch({ userId: 'u1', entityType: 'agent', entityIds: [] })).size).toBe(0);
    });

    it('listFavoritedIds is scoped by user and entity type', async () => {
      const a1 = `a-${randomUUID()}`;
      const s1 = `s-${randomUUID()}`;
      await makeAgent(a1);
      await makeSkill(s1);
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: a1 });
      await favorites.favorite({ userId: 'u1', entityType: 'skill', entityId: s1 });

      expect(await favorites.listFavoritedIds({ userId: 'u1', entityType: 'agent' })).toEqual([a1]);
      expect(await favorites.listFavoritedIds({ userId: 'u1', entityType: 'skill' })).toEqual([s1]);
      expect(await favorites.listFavoritedIds({ userId: 'u2', entityType: 'agent' })).toEqual([]);
    });

    it('deleteFavoritesForEntity removes rows, resets the counter, and returns the count', async () => {
      const id = `a-${randomUUID()}`;
      await makeAgent(id);
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: id });
      await favorites.favorite({ userId: 'u2', entityType: 'agent', entityId: id });

      const removed = await favorites.deleteFavoritesForEntity({ entityType: 'agent', entityId: id });
      expect(removed).toBe(2);
      expect((await agents.getById(id))?.favoriteCount).toBe(0);
      expect(await favorites.isFavorited({ userId: 'u1', entityType: 'agent', entityId: id })).toBe(false);
    });

    it('agent and skill counters with colliding ids stay independent', async () => {
      const id = `shared-${randomUUID()}`;
      await makeAgent(id);
      await makeSkill(id);
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: id });
      await favorites.favorite({ userId: 'u1', entityType: 'skill', entityId: id });
      expect((await agents.getById(id))?.favoriteCount).toBe(1);
      expect((await skills.getById(id))?.favoriteCount).toBe(1);
    });

    it('concurrent same-user favorite calls are idempotent (counter never exceeds 1)', async () => {
      const id = `a-${randomUUID()}`;
      await makeAgent(id);
      // Fire several concurrent favorite() calls for the same key. Spanner's
      // serializable isolation + ABORTED retry must collapse them into one row.
      const results = await Promise.all(
        Array.from({ length: 5 }, () => favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: id })),
      );
      for (const r of results) expect(r.favorited).toBe(true);
      expect((await agents.getById(id))?.favoriteCount).toBe(1);
      expect(await favorites.listFavoritedIds({ userId: 'u1', entityType: 'agent' })).toEqual([id]);
    });

    it('favorites listing on agents respects draft/published/archived isolation rules', async () => {
      // Favorites-feature queries (entityIds / pinFavoritedFor / favoritedOnly)
      // intentionally return the favorited candidate set across all statuses —
      // this matches the cross-adapter conformance contract (and the Postgres
      // reference, which applies no default status). A normal list() with no
      // favorites params still defaults to published-only.
      const u = `u-${randomUUID()}`;
      const draft = `a-${randomUUID()}`;
      const published = `a-${randomUUID()}`;
      await makeAgent(draft); // create() => draft
      await makeAgent(published);
      const pubV = await agents.getLatestVersion(published);
      await agents.update({ id: published, activeVersionId: pubV!.id, status: 'published' } as any);

      await favorites.favorite({ userId: u, entityType: 'agent', entityId: draft });
      await favorites.favorite({ userId: u, entityType: 'agent', entityId: published });

      // favoritedOnly returns BOTH (draft + published) — favorites span statuses.
      const favOnly = await agents.list({ favoritedOnly: true, pinFavoritedFor: u, page: 0, perPage: 50 });
      expect(favOnly.agents.map(a => a.id).sort()).toEqual([draft, published].sort());

      // entityIds also bypasses the published default for the requested set.
      const byIds = await agents.list({ entityIds: [draft], page: 0, perPage: 50 });
      expect(byIds.agents.map(a => a.id)).toEqual([draft]);

      // A plain list() (no favorites params) still hides the draft.
      const plain = await agents.list({ entityIds: undefined, page: 0, perPage: 200 } as any);
      const plainIds = plain.agents.map(a => a.id);
      expect(plainIds).toContain(published);
      expect(plainIds).not.toContain(draft);

      // An explicit status filter is still honored alongside a favorites query.
      const favPublished = await agents.list({
        pinFavoritedFor: u,
        favoritedOnly: true,
        status: 'published',
        page: 0,
        perPage: 50,
      });
      expect(favPublished.agents.map(a => a.id)).toEqual([published]);

      // pinFavoritedFor is a favorites-feature query: it suppresses the published
      // default so the favorited draft surfaces too (matching the conformance
      // contract / Postgres reference). Both favorited agents appear.
      const pinned = await agents.list({ pinFavoritedFor: u, page: 0, perPage: 200 });
      const pinnedIds = pinned.agents.map(a => a.id);
      expect(pinnedIds).toContain(published);
      expect(pinnedIds).toContain(draft);
    });
  });

  describe('ChannelsSpanner methods', () => {
    let channels: ChannelsSpanner;

    const sampleInstallation = (over: Partial<any> = {}) => ({
      id: `inst-${randomUUID()}`,
      platform: 'slack',
      agentId: `ag-${randomUUID()}`,
      status: 'active' as const,
      webhookId: `wh-${randomUUID()}`,
      data: { botToken: 'xoxb', teamId: 'T1' },
      configHash: `hash-${randomUUID()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    });

    beforeAll(async () => {
      const store = new SpannerStore(sharedConfig);
      await store.init();
      channels = (await store.getStore('channels')) as ChannelsSpanner;
    });

    beforeEach(async () => {
      await channels.dangerouslyClearAll();
    });

    it('saveInstallation upserts and preserves createdAt; getInstallation round-trips JSON', async () => {
      const created = new Date('2025-01-01T00:00:00.000Z');
      const inst = sampleInstallation({ id: 'inst-1', status: 'pending', createdAt: created });
      await channels.saveInstallation(inst);

      let fetched = await channels.getInstallation('inst-1');
      expect(fetched?.status).toBe('pending');
      expect(fetched?.data).toEqual(inst.data);
      expect(fetched?.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');

      await channels.saveInstallation({ ...inst, status: 'active', data: { ...inst.data, teamId: 'T2' } });
      fetched = await channels.getInstallation('inst-1');
      expect(fetched?.status).toBe('active');
      expect((fetched?.data as any).teamId).toBe('T2');
      expect(fetched?.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      expect(await channels.getInstallation('nope')).toBeNull();
    });

    it('getInstallationByAgent prefers active, then pending; scoped per platform', async () => {
      const agentId = `ag-${randomUUID()}`;
      await channels.saveInstallation(sampleInstallation({ id: 'p', platform: 'slack', agentId, status: 'pending' }));
      await channels.saveInstallation(sampleInstallation({ id: 'a', platform: 'slack', agentId, status: 'active' }));
      expect((await channels.getInstallationByAgent('slack', agentId))?.id).toBe('a');
      expect(await channels.getInstallationByAgent('discord', agentId)).toBeNull();
    });

    it('getInstallationByWebhookId finds the row and tolerates missing/absent webhooks', async () => {
      await channels.saveInstallation(sampleInstallation({ id: 'w', webhookId: 'wh-known' }));
      // Two installs without a webhookId must coexist (NULL_FILTERED unique index).
      await channels.saveInstallation(sampleInstallation({ id: 'n1', webhookId: undefined }));
      await channels.saveInstallation(sampleInstallation({ id: 'n2', webhookId: undefined }));
      expect((await channels.getInstallationByWebhookId('wh-known'))?.id).toBe('w');
      expect(await channels.getInstallationByWebhookId('missing')).toBeNull();
      expect((await channels.getInstallation('n1'))?.webhookId).toBeUndefined();
    });

    it('listInstallations returns per-platform installs newest-first; deleteInstallation is idempotent', async () => {
      const t1 = new Date('2024-01-01T00:00:00.000Z');
      const t2 = new Date('2024-01-02T00:00:00.000Z');
      await channels.saveInstallation(
        sampleInstallation({ id: 'i1', platform: 'slack', createdAt: t1, updatedAt: t1 }),
      );
      await channels.saveInstallation(
        sampleInstallation({ id: 'i2', platform: 'slack', createdAt: t2, updatedAt: t2 }),
      );
      await channels.saveInstallation(sampleInstallation({ id: 'i3', platform: 'discord' }));
      const slack = await channels.listInstallations('slack');
      expect(slack.map(i => i.id)).toEqual(['i2', 'i1']); // newest-first
      expect(await channels.listInstallations('telegram')).toEqual([]);

      await channels.deleteInstallation('i1');
      expect(await channels.getInstallation('i1')).toBeNull();
      await expect(channels.deleteInstallation('i1')).resolves.not.toThrow();
    });

    it('saveConfig / getConfig upsert and deleteConfig removes per platform', async () => {
      await channels.saveConfig({ platform: 'slack', data: { appConfigToken: 'old' }, updatedAt: new Date() });
      await channels.saveConfig({
        platform: 'slack',
        data: { appConfigToken: 'new', clientId: 'c1' },
        updatedAt: new Date(),
      });
      const cfg = await channels.getConfig('slack');
      expect((cfg?.data as any).appConfigToken).toBe('new');
      expect((cfg?.data as any).clientId).toBe('c1');
      expect(await channels.getConfig('discord')).toBeNull();

      await channels.deleteConfig('slack');
      expect(await channels.getConfig('slack')).toBeNull();
      await expect(channels.deleteConfig('slack')).resolves.not.toThrow();
    });
  });

  describe('ExperimentsSpanner methods', () => {
    let experiments: ExperimentsSpanner;

    const baseExp = (over: Partial<any> = {}) => ({
      datasetId: null,
      datasetVersion: null,
      targetType: 'agent' as const,
      targetId: 'agent-1',
      totalItems: 1,
      ...over,
    });
    const baseResult = (experimentId: string, over: Partial<any> = {}) => ({
      experimentId,
      itemId: `item-${randomUUID()}`,
      itemDatasetVersion: null,
      input: { q: 'x' },
      output: null,
      groundTruth: null,
      error: null,
      startedAt: new Date(),
      completedAt: new Date(),
      retryCount: 0,
      ...over,
    });

    beforeAll(async () => {
      const store = new SpannerStore(sharedConfig);
      await store.init();
      experiments = (await store.getStore('experiments')) as ExperimentsSpanner;
    });

    beforeEach(async () => {
      await experiments.dangerouslyClearAll();
    });

    it('createExperiment applies defaults and getExperimentById round-trips', async () => {
      const exp = await experiments.createExperiment(baseExp({ name: 'e1', metadata: { k: 'v' } }));
      expect(exp.status).toBe('pending');
      expect(exp.succeededCount).toBe(0);
      expect(exp.failedCount).toBe(0);
      expect(exp.skippedCount).toBe(0);
      expect(exp.startedAt).toBeNull();
      const fetched = await experiments.getExperimentById({ id: exp.id });
      expect(fetched?.name).toBe('e1');
      expect(fetched?.metadata).toEqual({ k: 'v' });
      expect(await experiments.getExperimentById({ id: 'missing' })).toBeNull();
    });

    it('updateExperiment patches fields, bumps counts, and throws when missing', async () => {
      const exp = await experiments.createExperiment(baseExp());
      const started = new Date();
      const updated = await experiments.updateExperiment({
        id: exp.id,
        status: 'running',
        succeededCount: 2,
        startedAt: started,
      });
      expect(updated.status).toBe('running');
      expect(updated.succeededCount).toBe(2);
      expect(updated.startedAt?.toISOString()).toBe(started.toISOString());
      await expect(experiments.updateExperiment({ id: 'missing', status: 'failed' })).rejects.toThrow();
    });

    it('listExperiments filters and paginates', async () => {
      const targetId = `t-${randomUUID()}`;
      for (let i = 0; i < 3; i++) await experiments.createExperiment(baseExp({ targetId }));
      await experiments.createExperiment(baseExp({ targetId: 'other' }));

      const page0 = await experiments.listExperiments({ targetId, pagination: { page: 0, perPage: 2 } });
      expect(page0.pagination.total).toBe(3);
      expect(page0.experiments).toHaveLength(2);
      expect(page0.pagination.hasMore).toBe(true);
    });

    it('addExperimentResult stores rich JSON; listExperimentResults orders by startedAt ASC', async () => {
      const exp = await experiments.createExperiment(baseExp());
      const errObj = { message: 'boom', code: 'E1' };
      const r1 = await experiments.addExperimentResult(
        baseResult(exp.id, { itemId: 'i1', startedAt: new Date(Date.now() - 1000), error: errObj, output: null }),
      );
      expect(r1.error).toEqual(errObj);
      await experiments.addExperimentResult(baseResult(exp.id, { itemId: 'i2', output: { a: 1 } }));

      const fetched = await experiments.getExperimentResultById({ id: r1.id });
      expect(fetched?.input).toEqual({ q: 'x' });
      expect(await experiments.getExperimentResultById({ id: 'missing' })).toBeNull();

      const list = await experiments.listExperimentResults({
        experimentId: exp.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(list.results).toHaveLength(2);
      expect(new Date(list.results[0]!.startedAt).getTime()).toBeLessThanOrEqual(
        new Date(list.results[1]!.startedAt).getTime(),
      );
    });

    it('updateExperimentResult sets review status/tags/comment and is a no-op without changes', async () => {
      const exp = await experiments.createExperiment(baseExp());
      const r = await experiments.addExperimentResult(baseResult(exp.id, { itemId: 'i1' }));
      const updated = await experiments.updateExperimentResult({
        id: r.id,
        experimentId: exp.id,
        status: 'reviewed',
        tags: ['a', 'b'],
        comment: 'note',
      });
      expect(updated.status).toBe('reviewed');
      expect(updated.tags).toEqual(['a', 'b']);
      expect(updated.comment).toBe('note');
      // No-op (no status/tags/comment) returns the existing row.
      const same = await experiments.updateExperimentResult({ id: r.id });
      expect(same.status).toBe('reviewed');
      expect(same.comment).toBe('note');
      await expect(experiments.updateExperimentResult({ id: 'missing', status: 'complete' })).rejects.toThrow();
    });

    it('updateExperimentResult honors experimentId scoping (incl. the no-op path)', async () => {
      const expA = await experiments.createExperiment(baseExp());
      const expB = await experiments.createExperiment(baseExp());
      const r = await experiments.addExperimentResult(baseResult(expA.id, { itemId: 'i1' }));

      // Wrong experiment with a patch → not found.
      await expect(
        experiments.updateExperimentResult({ id: r.id, experimentId: expB.id, status: 'reviewed' }),
      ).rejects.toThrow();
      // Wrong experiment on the no-op path → also not found (scoping honored).
      await expect(experiments.updateExperimentResult({ id: r.id, experimentId: expB.id })).rejects.toThrow();
      // Correct experiment on the no-op path → returns the row.
      const ok = await experiments.updateExperimentResult({ id: r.id, experimentId: expA.id });
      expect(ok.id).toBe(r.id);
    });

    it('getReviewSummary aggregates review-status counts per experiment', async () => {
      const exp = await experiments.createExperiment(baseExp());
      await experiments.addExperimentResult(baseResult(exp.id, { itemId: 'i1', status: 'needs-review' }));
      await experiments.addExperimentResult(baseResult(exp.id, { itemId: 'i2', status: 'reviewed' }));
      await experiments.addExperimentResult(baseResult(exp.id, { itemId: 'i3', status: 'complete' }));
      await experiments.addExperimentResult(baseResult(exp.id, { itemId: 'i4' })); // null status

      const summary = await experiments.getReviewSummary();
      const row = summary.find(s => s.experimentId === exp.id);
      expect(row).toMatchObject({ total: 4, needsReview: 1, reviewed: 1, complete: 1 });
    });

    it('deleteExperimentResults clears results; deleteExperiment cascades', async () => {
      const exp = await experiments.createExperiment(baseExp());
      await experiments.addExperimentResult(baseResult(exp.id, { itemId: 'i1' }));
      await experiments.deleteExperimentResults({ experimentId: exp.id });
      expect(
        (await experiments.listExperimentResults({ experimentId: exp.id, pagination: { page: 0, perPage: 10 } }))
          .results,
      ).toHaveLength(0);

      await experiments.addExperimentResult(baseResult(exp.id, { itemId: 'i2' }));
      await experiments.deleteExperiment({ id: exp.id });
      expect(await experiments.getExperimentById({ id: exp.id })).toBeNull();
      expect(
        (await experiments.listExperimentResults({ experimentId: exp.id, pagination: { page: 0, perPage: 10 } }))
          .results,
      ).toHaveLength(0);
    });
  });

  describe('DatasetsSpanner methods', () => {
    let datasets: DatasetsSpanner;

    beforeAll(async () => {
      const store = new SpannerStore(sharedConfig);
      await store.init();
      datasets = (await store.getStore('datasets')) as DatasetsSpanner;
    });

    beforeEach(async () => {
      await datasets.dangerouslyClearAll();
    });

    it('createDataset / getDatasetById / updateDataset / listDatasets', async () => {
      const ds = await datasets.createDataset({ name: 'd1', description: 'orig', metadata: { a: 1 } });
      expect(ds.version).toBe(0);
      expect((await datasets.getDatasetById({ id: ds.id }))?.name).toBe('d1');
      expect(await datasets.getDatasetById({ id: 'missing' })).toBeNull();

      const updated = await datasets.updateDataset({ id: ds.id, description: 'changed', tags: ['x'] });
      expect(updated.description).toBe('changed');
      expect(updated.tags).toEqual(['x']);

      const list = await datasets.listDatasets({ pagination: { page: 0, perPage: 10 } });
      expect(list.datasets.map(d => d.id)).toContain(ds.id);
    });

    it('addItem / updateItem / deleteItem drive SCD-2 versioning and history', async () => {
      const ds = await datasets.createDataset({ name: 'd' });
      const item = await datasets.addItem({ datasetId: ds.id, input: { q: 'a' }, metadata: { m: 1 } });
      expect(item.datasetVersion).toBe(1);
      expect((await datasets.getDatasetById({ id: ds.id }))?.version).toBe(1);

      const updated = await datasets.updateItem({ id: item.id, datasetId: ds.id, input: { q: 'b' } });
      expect(updated.datasetVersion).toBe(2);
      expect(updated.input).toEqual({ q: 'b' });
      // createdAt preserved across the new version.
      expect(updated.createdAt.toISOString()).toBe(item.createdAt.toISOString());

      const history = await datasets.getItemHistory(item.id);
      expect(history).toHaveLength(2);
      expect(history[0]!.datasetVersion).toBeGreaterThan(history[1]!.datasetVersion);
      expect(history.find(h => h.datasetVersion === 1)!.validTo).toBe(2);
      expect(history.find(h => h.datasetVersion === 2)!.validTo).toBeNull();

      await datasets.deleteItem({ id: item.id, datasetId: ds.id });
      expect(await datasets.getItemById({ id: item.id })).toBeNull();
      const tombstone = (await datasets.getItemHistory(item.id)).find(h => h.isDeleted);
      expect(tombstone?.validTo).toBeNull();
    });

    it('getItemById / getItemsByVersion / listItems support time-travel and search', async () => {
      const ds = await datasets.createDataset({ name: 'd' });
      const item = await datasets.addItem({ datasetId: ds.id, input: { q: 'findme-alpha' } });
      await datasets.updateItem({ id: item.id, datasetId: ds.id, input: { q: 'findme-beta' } });

      expect((await datasets.getItemById({ id: item.id }))?.input).toEqual({ q: 'findme-beta' });
      expect((await datasets.getItemById({ id: item.id, datasetVersion: 1 }))?.input).toEqual({ q: 'findme-alpha' });

      const v1 = await datasets.getItemsByVersion({ datasetId: ds.id, version: 1 });
      expect(v1.map(i => i.input)).toEqual([{ q: 'findme-alpha' }]);

      const current = await datasets.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } });
      expect(current.items).toHaveLength(1);
      const past = await datasets.listItems({ datasetId: ds.id, version: 1, pagination: { page: 0, perPage: 10 } });
      expect(past.items[0]!.input).toEqual({ q: 'findme-alpha' });

      const search = await datasets.listItems({
        datasetId: ds.id,
        search: 'beta',
        pagination: { page: 0, perPage: 10 },
      });
      expect(search.items).toHaveLength(1);
      const noHit = await datasets.listItems({ datasetId: ds.id, search: 'zzz', pagination: { page: 0, perPage: 10 } });
      expect(noHit.items).toHaveLength(0);
    });

    it('batchInsertItems uses a single version bump; batchDeleteItems tombstones all', async () => {
      const ds = await datasets.createDataset({ name: 'd' });
      const items = await datasets.batchInsertItems({
        datasetId: ds.id,
        items: [{ input: { i: 1 } }, { input: { i: 2 } }, { input: { i: 3 } }],
      });
      expect(items).toHaveLength(3);
      expect(new Set(items.map(i => i.datasetVersion)).size).toBe(1);
      expect((await datasets.getDatasetById({ id: ds.id }))?.version).toBe(1);
      expect((await datasets.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } })).items).toHaveLength(
        3,
      );

      await datasets.batchDeleteItems({ datasetId: ds.id, itemIds: items.map(i => i.id) });
      expect((await datasets.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } })).items).toHaveLength(
        0,
      );
      expect((await datasets.getDatasetById({ id: ds.id }))?.version).toBe(2);
    });

    it('empty batch insert/delete are no-ops and do not bump the version', async () => {
      const ds = await datasets.createDataset({ name: 'd' });
      const inserted = await datasets.batchInsertItems({ datasetId: ds.id, items: [] });
      expect(inserted).toEqual([]);
      await datasets.batchDeleteItems({ datasetId: ds.id, itemIds: [] });
      await datasets.batchDeleteItems({ datasetId: ds.id, itemIds: ['does-not-exist'] });
      expect((await datasets.getDatasetById({ id: ds.id }))?.version).toBe(0);
      expect(
        (await datasets.listDatasetVersions({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } })).versions,
      ).toHaveLength(0);
    });

    it('enforces a unique (datasetId, version) snapshot invariant', async () => {
      const ds = await datasets.createDataset({ name: 'd' });
      await datasets.createDatasetVersion(ds.id, 5);
      await expect(datasets.createDatasetVersion(ds.id, 5)).rejects.toThrow();
      // Same version number is allowed under a different dataset.
      const ds2 = await datasets.createDataset({ name: 'd2' });
      await expect(datasets.createDatasetVersion(ds2.id, 5)).resolves.toMatchObject({ version: 5 });
    });

    it('createDatasetVersion / listDatasetVersions record and page snapshots', async () => {
      const ds = await datasets.createDataset({ name: 'd' });
      // Item mutations record versions automatically.
      await datasets.addItem({ datasetId: ds.id, input: { i: 1 } });
      await datasets.addItem({ datasetId: ds.id, input: { i: 2 } });
      // Direct snapshot row.
      const manual = await datasets.createDatasetVersion(ds.id, 99);
      expect(manual.version).toBe(99);

      const page0 = await datasets.listDatasetVersions({ datasetId: ds.id, pagination: { page: 0, perPage: 2 } });
      expect(page0.pagination.total).toBe(3);
      expect(page0.versions).toHaveLength(2);
      // DESC by version → newest (99) first.
      expect(page0.versions[0]!.version).toBe(99);
    });

    it('deleteDataset removes the dataset, its items, and versions', async () => {
      const ds = await datasets.createDataset({ name: 'd' });
      await datasets.addItem({ datasetId: ds.id, input: { i: 1 } });
      await datasets.deleteDataset({ id: ds.id });
      expect(await datasets.getDatasetById({ id: ds.id })).toBeNull();
      expect((await datasets.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } })).items).toHaveLength(
        0,
      );
      expect(
        (await datasets.listDatasetVersions({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } })).versions,
      ).toHaveLength(0);
    });
  });

  // The shared test factory has no slot for mcp-clients / mcp-servers, so we
  // exercise the versioned CRUD surface inline.
  describe('MCPClientsSpanner integration', () => {
    let mcpClients: MCPClientsSpanner;

    beforeAll(async () => {
      const store = await new SpannerStore(sharedConfig).getStore('mcpClients');
      if (!store) throw new Error('mcpClients domain not registered');
      mcpClients = store as MCPClientsSpanner;
      await mcpClients.dangerouslyClearAll();
    });

    it('exposes the concrete domain class', () => {
      expect(mcpClients).toBeInstanceOf(MCPClientsSpanner);
    });

    it('creates, lists and resolves an MCP client', async () => {
      const id = `mcp-client-${Date.now()}`;
      const created = await mcpClients.create({
        mcpClient: {
          id,
          name: 'Local MCP Client',
          description: 'For tests',
          servers: { fs: { url: 'http://localhost:1234' } as any },
          metadata: { env: 'test' },
        },
      });

      expect(created.status).toBe('draft');
      expect(created.activeVersionId == null).toBe(true);

      const resolved = await mcpClients.getByIdResolved(id);
      expect(resolved?.name).toBe('Local MCP Client');
      expect(resolved?.servers).toEqual({ fs: { url: 'http://localhost:1234' } });

      const list = await mcpClients.list({ status: 'draft' });
      expect(list.mcpClients.find(c => c.id === id)).toBeDefined();
    });

    it('supports multi-version listing and deletion', async () => {
      const id = `mcp-client-${Date.now()}-multi`;
      await mcpClients.create({
        mcpClient: {
          id,
          name: 'Multi-version client',
          servers: {},
        },
      });

      const versionId = `${id}-v2`;
      await mcpClients.createVersion({
        id: versionId,
        mcpClientId: id,
        versionNumber: 2,
        name: 'V2',
        servers: { remote: { url: 'http://remote' } as any },
        changedFields: ['servers'],
        changeMessage: 'Added remote server',
      });

      const versions = await mcpClients.listVersions({ mcpClientId: id });
      expect(versions.total).toBe(2);

      const latest = await mcpClients.getLatestVersion(id);
      expect(latest?.versionNumber).toBe(2);
      expect(latest?.name).toBe('V2');

      await mcpClients.delete(id);
      expect(await mcpClients.getById(id)).toBeNull();
      expect(await mcpClients.countVersions(id)).toBe(0);
    });
  });

  describe('MCPServersSpanner integration', () => {
    let mcpServers: MCPServersSpanner;

    beforeAll(async () => {
      const store = await new SpannerStore(sharedConfig).getStore('mcpServers');
      if (!store) throw new Error('mcpServers domain not registered');
      mcpServers = store as MCPServersSpanner;
      await mcpServers.dangerouslyClearAll();
    });

    it('exposes the concrete domain class', () => {
      expect(mcpServers).toBeInstanceOf(MCPServersSpanner);
    });

    it('creates and resolves an MCP server with all snapshot fields', async () => {
      const id = `mcp-server-${Date.now()}`;
      await mcpServers.create({
        mcpServer: {
          id,
          name: 'Test MCP Server',
          version: '1.2.3',
          description: 'Provides FS tools',
          instructions: 'Use the fs tool to read files',
          repository: { url: 'https://example.com/mcp', type: 'git' },
          releaseDate: '2025-01-01',
          isLatest: true,
          packageCanonical: 'npm',
          tools: { fsRead: {}, fsWrite: {} },
          agents: { reader: {} },
          workflows: {},
        },
      });

      const resolved = await mcpServers.getByIdResolved(id);
      expect(resolved?.name).toBe('Test MCP Server');
      expect(resolved?.version).toBe('1.2.3');
      expect(resolved?.repository).toEqual({ url: 'https://example.com/mcp', type: 'git' });
      expect(resolved?.tools).toEqual({ fsRead: {}, fsWrite: {} });
      expect(resolved?.agents).toEqual({ reader: {} });
    });

    it('supports update of thin-record fields and listing by status', async () => {
      const id = `mcp-server-${Date.now()}-status`;
      await mcpServers.create({
        mcpServer: { id, name: 'Status Server', version: '0.1.0' },
      });

      const versionId = `${id}-v1-active`;
      await mcpServers.createVersion({
        id: versionId,
        mcpServerId: id,
        versionNumber: 2,
        name: 'Status Server v2',
        version: '0.2.0',
        changedFields: ['version'],
        changeMessage: 'Bumped version',
      });
      await mcpServers.update({ id, status: 'published', activeVersionId: versionId });

      const fetched = await mcpServers.getById(id);
      expect(fetched?.status).toBe('published');
      expect(fetched?.activeVersionId).toBe(versionId);

      const published = await mcpServers.list({ status: 'published' });
      expect(published.mcpServers.find(s => s.id === id)).toBeDefined();
    });
  });

  // The shared test factory has no slot for schedules, so we exercise the full
  // SchedulesStorage surface inline.
  describe('SchedulesSpanner integration', () => {
    let schedules: SchedulesSpanner;
    const wfFor = (suffix: string) => `wf-${suffix}-${Date.now()}`;

    const buildSchedule = (
      id: string,
      overrides: Partial<{
        nextFireAt: number;
        status: 'active' | 'paused';
        workflowId: string;
        timezone: string;
        metadata: Record<string, unknown>;
        target: any;
      }> = {},
    ) => {
      const now = Date.now();
      return {
        id,
        target: overrides.target ?? {
          type: 'workflow' as const,
          workflowId: overrides.workflowId ?? wfFor('default'),
          inputData: { hello: 'world' },
        },
        cron: '*/5 * * * *',
        timezone: overrides.timezone,
        status: overrides.status ?? ('active' as const),
        nextFireAt: overrides.nextFireAt ?? now + 60_000,
        createdAt: now,
        updatedAt: now,
        metadata: overrides.metadata,
      };
    };

    beforeAll(async () => {
      // Self-sufficient init so this block can run in isolation (e.g. via vitest -t).
      const composite = new SpannerStore(sharedConfig);
      await composite.init();
      const store = await composite.getStore('schedules');
      if (!store) throw new Error('schedules domain not registered');
      schedules = store as SchedulesSpanner;
      await schedules.dangerouslyClearAll();
    });

    beforeEach(async () => {
      await schedules.dangerouslyClearAll();
    });

    it('exposes the concrete domain class', () => {
      expect(schedules).toBeInstanceOf(SchedulesSpanner);
    });

    it('createSchedule persists a row and round-trips via getSchedule', async () => {
      const id = `sched-create-${Date.now()}`;
      const wfId = wfFor('create');
      const schedule = buildSchedule(id, {
        workflowId: wfId,
        timezone: 'Europe/Bucharest',
        metadata: { tier: 'enterprise' },
      });
      const created = await schedules.createSchedule(schedule);
      expect(created.id).toBe(id);

      const fetched = await schedules.getSchedule(id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(id);
      expect(fetched!.cron).toBe('*/5 * * * *');
      expect(fetched!.status).toBe('active');
      expect(fetched!.timezone).toBe('Europe/Bucharest');
      expect(fetched!.target).toEqual({ type: 'workflow', workflowId: wfId, inputData: { hello: 'world' } });
      expect(fetched!.metadata).toEqual({ tier: 'enterprise' });
      expect(fetched!.nextFireAt).toBe(schedule.nextFireAt);
    });

    it('createSchedule rejects duplicate ids', async () => {
      const id = `sched-dup-${Date.now()}`;
      await schedules.createSchedule(buildSchedule(id));
      await expect(schedules.createSchedule(buildSchedule(id))).rejects.toThrow(/already exists/i);
    });

    it('createSchedule serializes concurrent calls for the same id (no duplicate insert race)', async () => {
      const id = `sched-concurrent-${Date.now()}`;
      const attempts = 5;
      const results = await Promise.allSettled(
        Array.from({ length: attempts }, () => schedules.createSchedule(buildSchedule(id))),
      );
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(attempts - 1);

      const stored = await schedules.getSchedule(id);
      expect(stored).not.toBeNull();
      expect(stored!.id).toBe(id);

      // Sanity: the table really only has one row for this id.
      const all = await schedules.listSchedules();
      expect(all.filter(s => s.id === id).length).toBe(1);
    });

    it('getSchedule returns null for missing ids', async () => {
      const result = await schedules.getSchedule(`missing-${Date.now()}`);
      expect(result).toBeNull();
    });

    it('listSchedules returns rows in created_at ASC order', async () => {
      const baseTs = Date.now();
      const a = { ...buildSchedule(`sched-list-a-${baseTs}`), createdAt: baseTs, updatedAt: baseTs };
      const b = { ...buildSchedule(`sched-list-b-${baseTs}`), createdAt: baseTs + 100, updatedAt: baseTs + 100 };
      const c = { ...buildSchedule(`sched-list-c-${baseTs}`), createdAt: baseTs + 200, updatedAt: baseTs + 200 };
      await schedules.createSchedule(b);
      await schedules.createSchedule(c);
      await schedules.createSchedule(a);

      const list = await schedules.listSchedules();
      const ids = list.map(s => s.id);
      expect(ids).toEqual([a.id, b.id, c.id]);
    });

    it('listSchedules filters by status', async () => {
      const ts = Date.now();
      await schedules.createSchedule(buildSchedule(`sched-active-${ts}`, { status: 'active' }));
      await schedules.createSchedule(buildSchedule(`sched-paused-${ts}`, { status: 'paused' }));
      await schedules.createSchedule(buildSchedule(`sched-active2-${ts}`, { status: 'active' }));

      const active = await schedules.listSchedules({ status: 'active' });
      expect(active.length).toBe(2);
      expect(active.every(s => s.status === 'active')).toBe(true);

      const paused = await schedules.listSchedules({ status: 'paused' });
      expect(paused.length).toBe(1);
      expect(paused[0]!.status).toBe('paused');
    });

    it('listSchedules filters by workflowId via the target_workflow_id index', async () => {
      const ts = Date.now();
      const wfA = wfFor(`a-${ts}`);
      const wfB = wfFor(`b-${ts}`);
      await schedules.createSchedule(buildSchedule(`sched-wfa1-${ts}`, { workflowId: wfA }));
      await schedules.createSchedule(buildSchedule(`sched-wfa2-${ts}`, { workflowId: wfA }));
      await schedules.createSchedule(buildSchedule(`sched-wfb1-${ts}`, { workflowId: wfB }));

      const matchA = await schedules.listSchedules({ workflowId: wfA });
      expect(matchA.length).toBe(2);
      expect(matchA.every(s => s.target.type === 'workflow' && s.target.workflowId === wfA)).toBe(true);

      const matchB = await schedules.listSchedules({ workflowId: wfB });
      expect(matchB.length).toBe(1);
    });

    it('exposes the target_workflow_id generated column populated from the JSON target', async () => {
      // Probe INFORMATION_SCHEMA directly so the assertion doesn't rely on the
      // runtime fast-path detection used by listSchedules.
      const internalDb: SpannerDB = (schedules as any).db;
      const exists = await internalDb.hasColumn('mastra_schedules', 'target_workflow_id');
      expect(exists).toBe(true);

      const wfId = wfFor(`stored-${Date.now()}`);
      await schedules.createSchedule(buildSchedule(`sched-stored-${Date.now()}`, { workflowId: wfId }));

      // Sanity check: the generated value matches what's in the JSON target.
      const [rows] = await (schedules as any).database.run({
        sql: `SELECT target_workflow_id FROM \`mastra_schedules\`
              WHERE target_workflow_id = @workflowId LIMIT 1`,
        params: { workflowId: wfId },
        json: true,
      });
      expect((rows as Array<Record<string, any>>)[0]?.target_workflow_id).toBe(wfId);
    });

    it('listDueSchedules returns only active rows with next_fire_at <= now, ordered ASC and limited', async () => {
      const baseTs = Date.now();
      const past1 = buildSchedule(`due-1-${baseTs}`, { nextFireAt: baseTs - 30_000 });
      const past2 = buildSchedule(`due-2-${baseTs}`, { nextFireAt: baseTs - 10_000 });
      const futureActive = buildSchedule(`due-future-${baseTs}`, { nextFireAt: baseTs + 60_000 });
      const pastPaused = buildSchedule(`due-paused-${baseTs}`, { nextFireAt: baseTs - 20_000, status: 'paused' });
      await schedules.createSchedule(past1);
      await schedules.createSchedule(past2);
      await schedules.createSchedule(futureActive);
      await schedules.createSchedule(pastPaused);

      const due = await schedules.listDueSchedules(baseTs);
      const dueIds = due.map(s => s.id);
      expect(dueIds).toContain(past1.id);
      expect(dueIds).toContain(past2.id);
      expect(dueIds).not.toContain(futureActive.id);
      expect(dueIds).not.toContain(pastPaused.id);
      // ASC by next_fire_at
      const idxPast1 = dueIds.indexOf(past1.id);
      const idxPast2 = dueIds.indexOf(past2.id);
      expect(idxPast1).toBeLessThan(idxPast2);

      const dueLimited = await schedules.listDueSchedules(baseTs, 1);
      expect(dueLimited.length).toBe(1);
      expect(dueLimited[0]!.id).toBe(past1.id); // earliest first
    });

    it('updateSchedule patches the supplied fields and bumps updated_at', async () => {
      const id = `sched-update-${Date.now()}`;
      const original = buildSchedule(id, { metadata: { v: 1 } });
      await schedules.createSchedule(original);

      // Wait a millisecond so updated_at advances observably.
      await new Promise(r => setTimeout(r, 2));

      const newTarget = { type: 'workflow' as const, workflowId: wfFor('updated'), inputData: { x: 1 } };
      const patched = await schedules.updateSchedule(id, {
        cron: '0 9 * * *',
        timezone: 'America/New_York',
        status: 'paused',
        nextFireAt: original.nextFireAt + 1000,
        target: newTarget,
        metadata: { v: 2 },
      });

      expect(patched.cron).toBe('0 9 * * *');
      expect(patched.timezone).toBe('America/New_York');
      expect(patched.status).toBe('paused');
      expect(patched.nextFireAt).toBe(original.nextFireAt + 1000);
      expect(patched.target).toEqual(newTarget);
      expect(patched.metadata).toEqual({ v: 2 });
      expect(patched.updatedAt).toBeGreaterThan(original.updatedAt);
    });

    it('updateSchedule treats undefined fields as no-ops and tolerates an empty patch', async () => {
      const id = `sched-update-empty-${Date.now()}`;
      const original = buildSchedule(id, { metadata: { v: 1 } });
      await schedules.createSchedule(original);

      // Empty patch: returns the existing row unchanged
      const same = await schedules.updateSchedule(id, {});
      expect(same.id).toBe(id);
      expect(same.metadata).toEqual({ v: 1 });

      // Patch with explicit `metadata: undefined` should not be treated as a clear.
      // (Only `metadata: null` or `metadata: { ... }` mutate the column.)
      const stillSame = await schedules.updateSchedule(id, { cron: '*/10 * * * *' });
      expect(stillSame.cron).toBe('*/10 * * * *');
      expect(stillSame.metadata).toEqual({ v: 1 });
    });

    it('updateSchedule throws for missing ids on empty patch', async () => {
      await expect(schedules.updateSchedule(`missing-${Date.now()}`, {})).rejects.toThrow(/not found/i);
    });

    it('updateScheduleNextFire CAS succeeds when expected matches and the row is active', async () => {
      const id = `sched-cas-${Date.now()}`;
      const ts = Date.now();
      const original = buildSchedule(id, { nextFireAt: ts });
      await schedules.createSchedule(original);

      const winner = await schedules.updateScheduleNextFire(id, ts, ts + 60_000, ts, 'run-1');
      expect(winner).toBe(true);

      const after = await schedules.getSchedule(id);
      expect(after!.nextFireAt).toBe(ts + 60_000);
      expect(after!.lastFireAt).toBe(ts);
      expect(after!.lastRunId).toBe('run-1');
    });

    it('updateScheduleNextFire CAS fails when another writer already advanced next_fire_at', async () => {
      const id = `sched-cas-loser-${Date.now()}`;
      const ts = Date.now();
      await schedules.createSchedule(buildSchedule(id, { nextFireAt: ts }));

      const winner = await schedules.updateScheduleNextFire(id, ts, ts + 60_000, ts, 'run-A');
      expect(winner).toBe(true);
      // Second attempt with the now-stale `expected` must lose.
      const loser = await schedules.updateScheduleNextFire(id, ts, ts + 120_000, ts, 'run-B');
      expect(loser).toBe(false);

      const after = await schedules.getSchedule(id);
      expect(after!.lastRunId).toBe('run-A');
      expect(after!.nextFireAt).toBe(ts + 60_000);
    });

    it('updateScheduleNextFire CAS fails on paused schedules', async () => {
      const id = `sched-cas-paused-${Date.now()}`;
      const ts = Date.now();
      await schedules.createSchedule(buildSchedule(id, { nextFireAt: ts, status: 'paused' }));

      const ok = await schedules.updateScheduleNextFire(id, ts, ts + 60_000, ts, 'run-X');
      expect(ok).toBe(false);

      const after = await schedules.getSchedule(id);
      expect(after!.nextFireAt).toBe(ts); // unchanged
      expect(after!.lastRunId).toBeUndefined();
    });

    it('updateScheduleNextFire returns false for missing ids without throwing', async () => {
      const ok = await schedules.updateScheduleNextFire(`missing-${Date.now()}`, 1, 2, 1, 'run-Z');
      expect(ok).toBe(false);
    });

    it('recordTrigger persists an audit row that listTriggers returns newest-first', async () => {
      const id = `sched-trig-${Date.now()}`;
      await schedules.createSchedule(buildSchedule(id));

      const baseTs = Date.now();
      await schedules.recordTrigger({
        scheduleId: id,
        runId: `${id}-run-1`,
        scheduledFireAt: baseTs - 60_000,
        actualFireAt: baseTs - 60_000,
        outcome: 'published',
      });
      await schedules.recordTrigger({
        scheduleId: id,
        runId: `${id}-run-2`,
        scheduledFireAt: baseTs - 30_000,
        actualFireAt: baseTs - 30_000,
        outcome: 'failed',
        error: 'pubsub publish failed',
      });
      await schedules.recordTrigger({
        scheduleId: id,
        runId: `${id}-run-3`,
        scheduledFireAt: baseTs,
        actualFireAt: baseTs,
        outcome: 'published',
      });

      const triggers = await schedules.listTriggers(id);
      expect(triggers.length).toBe(3);
      // Newest first
      expect(triggers[0]!.runId).toBe(`${id}-run-3`);
      expect(triggers[1]!.runId).toBe(`${id}-run-2`);
      expect(triggers[2]!.runId).toBe(`${id}-run-1`);
      expect(triggers[1]!.error).toBe('pubsub publish failed');
    });

    it('listTriggers respects fromActualFireAt / toActualFireAt windows', async () => {
      const id = `sched-trig-window-${Date.now()}`;
      await schedules.createSchedule(buildSchedule(id));

      const baseTs = Date.now();
      await schedules.recordTrigger({
        scheduleId: id,
        runId: `${id}-r1`,
        scheduledFireAt: baseTs - 30_000,
        actualFireAt: baseTs - 30_000,
        outcome: 'published',
      });
      await schedules.recordTrigger({
        scheduleId: id,
        runId: `${id}-r2`,
        scheduledFireAt: baseTs - 20_000,
        actualFireAt: baseTs - 20_000,
        outcome: 'published',
      });
      await schedules.recordTrigger({
        scheduleId: id,
        runId: `${id}-r3`,
        scheduledFireAt: baseTs - 10_000,
        actualFireAt: baseTs - 10_000,
        outcome: 'published',
      });

      const inclusiveLower = await schedules.listTriggers(id, { fromActualFireAt: baseTs - 20_000 });
      expect(inclusiveLower.map(t => t.runId)).toEqual([`${id}-r3`, `${id}-r2`]);

      const exclusiveUpper = await schedules.listTriggers(id, { toActualFireAt: baseTs - 20_000 });
      expect(exclusiveUpper.map(t => t.runId)).toEqual([`${id}-r1`]);

      const window = await schedules.listTriggers(id, {
        fromActualFireAt: baseTs - 25_000,
        toActualFireAt: baseTs - 5_000,
      });
      expect(window.map(t => t.runId)).toEqual([`${id}-r3`, `${id}-r2`]);
    });

    it('listTriggers respects limit', async () => {
      const id = `sched-trig-limit-${Date.now()}`;
      await schedules.createSchedule(buildSchedule(id));
      const baseTs = Date.now();
      for (let i = 0; i < 5; i++) {
        await schedules.recordTrigger({
          scheduleId: id,
          runId: `${id}-r${i}`,
          scheduledFireAt: baseTs + i * 1000,
          actualFireAt: baseTs + i * 1000,
          outcome: 'published',
        });
      }

      const limited = await schedules.listTriggers(id, { limit: 2 });
      expect(limited.length).toBe(2);
      expect(limited[0]!.runId).toBe(`${id}-r4`); // newest first
      expect(limited[1]!.runId).toBe(`${id}-r3`);
    });

    it('deleteSchedule removes the schedule and its trigger history', async () => {
      const id = `sched-delete-${Date.now()}`;
      await schedules.createSchedule(buildSchedule(id));
      const baseTs = Date.now();
      await schedules.recordTrigger({
        scheduleId: id,
        runId: `${id}-r1`,
        scheduledFireAt: baseTs,
        actualFireAt: baseTs,
        outcome: 'published',
      });
      await schedules.recordTrigger({
        scheduleId: id,
        runId: `${id}-r2`,
        scheduledFireAt: baseTs + 1000,
        actualFireAt: baseTs + 1000,
        outcome: 'published',
      });

      await schedules.deleteSchedule(id);
      expect(await schedules.getSchedule(id)).toBeNull();
      expect(await schedules.listTriggers(id)).toEqual([]);
    });

    it('deleteSchedule of a missing id is a no-op', async () => {
      // Should not throw. (Spanner DELETE with no matching rows succeeds with rowcount=0.)
      await expect(schedules.deleteSchedule(`missing-${Date.now()}`)).resolves.toBeUndefined();
    });

    it('dangerouslyClearAll wipes both schedules and trigger rows', async () => {
      const id = `sched-clear-${Date.now()}`;
      await schedules.createSchedule(buildSchedule(id));
      await schedules.recordTrigger({
        scheduleId: id,
        runId: `${id}-r1`,
        scheduledFireAt: Date.now(),
        actualFireAt: Date.now(),
        outcome: 'published',
      });

      await schedules.dangerouslyClearAll();
      expect(await schedules.listSchedules()).toEqual([]);
      expect(await schedules.listTriggers(id)).toEqual([]);
    });
  });

  describe('Method-level coverage', () => {
    let methodStore: SpannerStore;
    let memory: MemorySpanner;
    let workflows: WorkflowsSpanner;
    let agents: AgentsSpanner;
    let mcpClients: MCPClientsSpanner;
    let mcpServers: MCPServersSpanner;
    let backgroundTasks: BackgroundTasksSpanner;
    let skills: SkillsSpanner;
    let blobs: BlobsSpanner;
    let promptBlocks: PromptBlocksSpanner;
    let scorerDefinitions: ScorerDefinitionsSpanner;
    let scores: ScoresSpanner;
    let observability: ObservabilitySpanner;

    beforeAll(async () => {
      methodStore = new SpannerStore(sharedConfig);
      // init() is idempotent  tables already exist from the createTestSuite run.
      await methodStore.init();
      memory = (await methodStore.getStore('memory')) as MemorySpanner;
      workflows = (await methodStore.getStore('workflows')) as WorkflowsSpanner;
      agents = (await methodStore.getStore('agents')) as AgentsSpanner;
      mcpClients = (await methodStore.getStore('mcpClients')) as MCPClientsSpanner;
      mcpServers = (await methodStore.getStore('mcpServers')) as MCPServersSpanner;
      backgroundTasks = (await methodStore.getStore('backgroundTasks')) as BackgroundTasksSpanner;
      skills = (await methodStore.getStore('skills')) as SkillsSpanner;
      blobs = (await methodStore.getStore('blobs')) as BlobsSpanner;
      promptBlocks = (await methodStore.getStore('promptBlocks')) as PromptBlocksSpanner;
      scorerDefinitions = (await methodStore.getStore('scorerDefinitions')) as ScorerDefinitionsSpanner;
      scores = (await methodStore.getStore('scores')) as ScoresSpanner;
      observability = (await methodStore.getStore('observability')) as ObservabilitySpanner;
    });

    describe('MemorySpanner methods', () => {
      beforeAll(async () => {
        await memory.dangerouslyClearAll();
      });

      describe('saveThread', () => {
        it('creates a new thread', async () => {
          const thread = createSampleThread();
          const saved = await memory.saveThread({ thread });
          expect(saved.id).toBe(thread.id);
          const fetched = await memory.getThreadById({ threadId: thread.id });
          expect(fetched?.id).toBe(thread.id);
          expect(fetched?.resourceId).toBe(thread.resourceId);
          expect(fetched?.title).toBe(thread.title);
        });

        it('upserts an existing thread', async () => {
          const thread = createSampleThread();
          await memory.saveThread({ thread });
          const updated = {
            ...thread,
            title: 'Renamed',
            updatedAt: new Date(thread.updatedAt.getTime() + 1000),
          };
          await memory.saveThread({ thread: updated });
          const fetched = await memory.getThreadById({ threadId: thread.id });
          expect(fetched?.title).toBe('Renamed');
        });
      });

      describe('updateThread', () => {
        it('replaces title and merges metadata', async () => {
          const thread = { ...createSampleThread(), metadata: { a: 1, b: 2 } };
          await memory.saveThread({ thread });
          const updated = await memory.updateThread({
            id: thread.id,
            title: 'New title',
            metadata: { b: 99, c: 3 },
          });
          expect(updated.title).toBe('New title');
          expect(updated.metadata).toEqual({ a: 1, b: 99, c: 3 });
        });

        it('throws when thread does not exist', async () => {
          await expect(
            memory.updateThread({ id: `missing-${randomUUID()}`, title: 'x', metadata: {} }),
          ).rejects.toThrow(/not found/i);
        });
      });

      describe('deleteThread', () => {
        it('removes the thread and all its messages', async () => {
          const thread = createSampleThread();
          await memory.saveThread({ thread });
          const messages = [
            createSampleMessageV2({ threadId: thread.id, content: { content: 'a' } }),
            createSampleMessageV2({ threadId: thread.id, content: { content: 'b' } }),
          ];
          await memory.saveMessages({ messages });
          await memory.deleteThread({ threadId: thread.id });
          expect(await memory.getThreadById({ threadId: thread.id })).toBeNull();
          const remaining = await memory.listMessages({ threadId: thread.id });
          expect(remaining.messages).toHaveLength(0);
        });

        it('is a no-op for a missing thread', async () => {
          await expect(memory.deleteThread({ threadId: `missing-${randomUUID()}` })).resolves.toBeUndefined();
        });
      });

      describe('listThreads', () => {
        const sharedResourceId = `list-resource-${randomUUID()}`;

        beforeAll(async () => {
          for (let i = 0; i < 5; i++) {
            const thread = createSampleThread({ resourceId: sharedResourceId });
            await memory.saveThread({
              thread: { ...thread, metadata: { tag: i % 2 === 0 ? 'even' : 'odd' } },
            });
            // Stagger timestamps a bit so DESC ordering is deterministic.
            await new Promise(r => setTimeout(r, 5));
          }
        });

        it('filters by resourceId', async () => {
          const result = await memory.listThreads({ filter: { resourceId: sharedResourceId } });
          expect(result.total).toBe(5);
          expect(result.threads.every(t => t.resourceId === sharedResourceId)).toBe(true);
        });

        it('filters by metadata key/value', async () => {
          const result = await memory.listThreads({
            filter: { resourceId: sharedResourceId, metadata: { tag: 'even' } },
          });
          expect(result.total).toBe(3);
          expect(result.threads.every(t => t.metadata?.tag === 'even')).toBe(true);
        });

        it('paginates results', async () => {
          const page1 = await memory.listThreads({
            filter: { resourceId: sharedResourceId },
            page: 0,
            perPage: 2,
          });
          expect(page1.threads).toHaveLength(2);
          expect(page1.hasMore).toBe(true);
          const page2 = await memory.listThreads({
            filter: { resourceId: sharedResourceId },
            page: 1,
            perPage: 2,
          });
          expect(page2.threads).toHaveLength(2);
          expect(page2.page).toBe(1);
        });

        it('orders by createdAt DESC by default', async () => {
          const result = await memory.listThreads({ filter: { resourceId: sharedResourceId } });
          for (let i = 1; i < result.threads.length; i++) {
            expect(result.threads[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
              result.threads[i]!.createdAt.getTime(),
            );
          }
        });

        it('honors orderBy ASC', async () => {
          const result = await memory.listThreads({
            filter: { resourceId: sharedResourceId },
            orderBy: { field: 'createdAt', direction: 'ASC' },
          });
          for (let i = 1; i < result.threads.length; i++) {
            expect(result.threads[i - 1]!.createdAt.getTime()).toBeLessThanOrEqual(
              result.threads[i]!.createdAt.getTime(),
            );
          }
        });

        it('rejects invalid metadata keys', async () => {
          await expect(memory.listThreads({ filter: { metadata: { 'bad-key!': 'x' } } })).rejects.toThrow(
            /Invalid metadata key|metadata key/i,
          );
        });
      });

      describe('listMessagesById', () => {
        it('returns the requested messages and ignores unknown IDs', async () => {
          const thread = createSampleThread();
          await memory.saveThread({ thread });
          const m1 = createSampleMessageV2({ threadId: thread.id, content: { content: 'm1' } });
          const m2 = createSampleMessageV2({ threadId: thread.id, content: { content: 'm2' } });
          await memory.saveMessages({ messages: [m1, m2] });

          const fetched = await memory.listMessagesById({ messageIds: [m1.id, m2.id, 'not-real'] });
          const ids = fetched.messages.map(m => m.id).sort();
          expect(ids).toEqual([m1.id, m2.id].sort());
        });

        it('returns an empty array for an empty input', async () => {
          const result = await memory.listMessagesById({ messageIds: [] });
          expect(result.messages).toEqual([]);
        });
      });

      describe('listMessages and getIncludedMessages', () => {
        let threadId: string;
        const messageIds: string[] = [];

        beforeAll(async () => {
          const thread = createSampleThread();
          threadId = thread.id;
          await memory.saveThread({ thread });
          const seedMessages = [];
          for (let i = 0; i < 8; i++) {
            const m = createSampleMessageV2({
              threadId,
              content: { content: `msg-${i}` },
              // 1ms apart so createdAt ordering is deterministic.
              createdAt: new Date(Date.now() + i),
            });
            seedMessages.push(m);
            messageIds.push(m.id);
          }
          await memory.saveMessages({ messages: seedMessages });
        });

        it('paginates messages with hasMore', async () => {
          const page1 = await memory.listMessages({ threadId, page: 0, perPage: 3 });
          expect(page1.messages).toHaveLength(3);
          expect(page1.total).toBe(8);
          expect(page1.hasMore).toBe(true);
          const page3 = await memory.listMessages({ threadId, page: 2, perPage: 3 });
          expect(page3.messages).toHaveLength(2);
          expect(page3.hasMore).toBe(false);
        });

        it('returns all messages when perPage is false', async () => {
          const all = await memory.listMessages({ threadId, perPage: false });
          expect(all.messages).toHaveLength(8);
          expect(all.hasMore).toBe(false);
        });

        it('orders by createdAt ASC by default', async () => {
          const all = await memory.listMessages({ threadId, perPage: false });
          const contents = all.messages.map(m => (m.content as any).content);
          expect(contents).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5', 'msg-6', 'msg-7']);
        });

        it('honors DESC ordering', async () => {
          const all = await memory.listMessages({
            threadId,
            perPage: false,
            orderBy: { field: 'createdAt', direction: 'DESC' },
          });
          const contents = all.messages.map(m => (m.content as any).content);
          expect(contents[0]).toBe('msg-7');
          expect(contents[contents.length - 1]).toBe('msg-0');
        });

        it('returns include-only window when perPage=0 (covers getIncludedMessages)', async () => {
          const targetId = messageIds[3]!; // 'msg-3'
          const result = await memory.listMessages({
            threadId,
            perPage: 0,
            include: [{ id: targetId, withPreviousMessages: 2, withNextMessages: 1 }],
          });
          expect(result.total).toBe(0); // include-only path returns total: 0
          const contents = result.messages.map(m => (m.content as any).content);
          // Window: msg-1, msg-2, msg-3, msg-4
          expect(contents).toEqual(['msg-1', 'msg-2', 'msg-3', 'msg-4']);
        });

        it('filters by dateRange', async () => {
          const all = await memory.listMessages({ threadId, perPage: false });
          // Use the createdAt from the third message as the lower bound.
          const start = all.messages[3]!.createdAt as Date;
          const result = await memory.listMessages({
            threadId,
            perPage: false,
            filter: { dateRange: { start } },
          });
          // Should include 5 messages (indexes 3..7).
          expect(result.messages.length).toBe(5);
        });
      });

      describe('updateMessages', () => {
        it('updates a message content while preserving siblings', async () => {
          const thread = createSampleThread();
          await memory.saveThread({ thread });
          const m1 = createSampleMessageV2({ threadId: thread.id, content: { content: 'first' } });
          const m2 = createSampleMessageV2({ threadId: thread.id, content: { content: 'second' } });
          await memory.saveMessages({ messages: [m1, m2] });

          const updated = await memory.updateMessages({
            messages: [{ id: m1.id, content: { content: 'updated' } as any }],
          });
          const updatedM1 = updated.find(m => m.id === m1.id);
          expect((updatedM1!.content as any).content).toBe('updated');

          // m2 is untouched.
          const all = await memory.listMessages({ threadId: thread.id, perPage: false });
          const m2After = all.messages.find(m => m.id === m2.id);
          expect((m2After!.content as any).content).toBe('second');
        });

        it('returns an empty array for an empty input', async () => {
          const result = await memory.updateMessages({ messages: [] });
          expect(result).toEqual([]);
        });
      });

      describe('deleteMessages', () => {
        it('removes the listed messages and updates parent thread timestamp', async () => {
          const thread = createSampleThread();
          await memory.saveThread({ thread });
          const messages = [0, 1, 2].map(i =>
            createSampleMessageV2({ threadId: thread.id, content: { content: `m${i}` } }),
          );
          await memory.saveMessages({ messages });
          const before = await memory.getThreadById({ threadId: thread.id });

          // Wait long enough to detect the update.
          await new Promise(r => setTimeout(r, 20));

          await memory.deleteMessages([messages[0]!.id, messages[2]!.id]);
          const remaining = await memory.listMessages({ threadId: thread.id, perPage: false });
          const ids = remaining.messages.map(m => m.id);
          expect(ids).toEqual([messages[1]!.id]);

          const after = await memory.getThreadById({ threadId: thread.id });
          expect((after!.updatedAt as Date).getTime()).toBeGreaterThan((before!.updatedAt as Date).getTime());
        });

        it('is a no-op for an empty list', async () => {
          await expect(memory.deleteMessages([])).resolves.toBeUndefined();
        });
      });

      describe('updateResource', () => {
        it('creates a new resource if the id does not exist', async () => {
          const id = `new-resource-${randomUUID()}`;
          const updated = await memory.updateResource({
            resourceId: id,
            workingMemory: 'fresh',
            metadata: { hello: 'world' },
          });
          expect(updated.id).toBe(id);
          expect(updated.workingMemory).toBe('fresh');
          expect(updated.metadata).toEqual({ hello: 'world' });
        });

        it('merges metadata and updates workingMemory on existing resources', async () => {
          const resource = {
            id: `update-resource-${randomUUID()}`,
            workingMemory: 'old',
            metadata: { a: 1, b: 2 },
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await memory.saveResource({ resource });
          const updated = await memory.updateResource({
            resourceId: resource.id,
            workingMemory: 'new',
            metadata: { b: 22, c: 3 },
          });
          expect(updated.workingMemory).toBe('new');
          expect(updated.metadata).toEqual({ a: 1, b: 22, c: 3 });
        });

        it('updates workingMemory only when metadata is omitted', async () => {
          const resource = {
            id: `wm-only-${randomUUID()}`,
            workingMemory: 'first',
            metadata: { keep: true },
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await memory.saveResource({ resource });
          const updated = await memory.updateResource({ resourceId: resource.id, workingMemory: 'second' });
          expect(updated.workingMemory).toBe('second');
          expect(updated.metadata).toEqual({ keep: true });
        });
      });

      describe('hasMore correctness with include', () => {
        it('keeps hasMore=true when include adds same-thread messages on a paginated window', async () => {
          const threadId = `wf-hm-${randomUUID()}`;
          const resourceId = `res-hm-${randomUUID()}`;
          await memory.saveThread({
            thread: {
              id: threadId,
              resourceId,
              title: 'hasMore include',
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          // Insert 5 messages with strictly-ordered createdAt so pagination
          // is deterministic.
          const baseTs = Date.now();
          const ids = Array.from({ length: 5 }, (_, i) => `m${i}-${randomUUID()}`);
          await memory.saveMessages({
            messages: ids.map((id, i) => ({
              id,
              threadId,
              resourceId,
              role: 'user',
              type: 'v2',
              content: { format: 2, parts: [{ type: 'text', text: `msg ${i}` }] },
              createdAt: new Date(baseTs + i * 10),
            })) as any,
          });

          // Page 0 with perPage=2: should return 2 base rows, total=5,
          // hasMore=true because offset(0)+perPage(2) < total(5). Including
          // the 5th message (which is also same-thread) pushes the returned
          // length to 3, but hasMore must stay true.
          const result = await memory.listMessages({
            threadId,
            page: 0,
            perPage: 2,
            include: [{ id: ids[4]! }],
          });
          expect(result.total).toBe(5);
          expect(result.hasMore).toBe(true);
          // Sanity: include did expand the returned set beyond perPage.
          expect(result.messages.length).toBeGreaterThan(2);
        });
      });

      describe('error propagation (no empty-on-error)', () => {
        // Regression guard: backend failures must propagate as MastraError so
        // callers can distinguish "no data" from "store unavailable". The
        // prior implementation swallowed errors and returned {total:0,...}.
        it('listThreads re-throws backend failures instead of returning empty', async () => {
          const runSpy = vi
            .spyOn((memory as any).database, 'run')
            .mockRejectedValueOnce(new Error('simulated backend outage'));
          try {
            await expect(memory.listThreads({})).rejects.toMatchObject({
              id: expect.stringMatching(/LIST_THREADS.*FAILED/),
            });
          } finally {
            runSpy.mockRestore();
          }
        });

        it('listMessages re-throws backend failures instead of returning empty', async () => {
          // Use a real thread so the upstream validation passes; the spy
          // intercepts the first .run() call, which is the COUNT(*) for the
          // listMessages path.
          const threadId = `wf-err-${randomUUID()}`;
          const resourceId = `res-err-${randomUUID()}`;
          await memory.saveThread({
            thread: {
              id: threadId,
              resourceId,
              title: 't',
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          const runSpy = vi
            .spyOn((memory as any).database, 'run')
            .mockRejectedValueOnce(new Error('simulated backend outage'));
          try {
            await expect(memory.listMessages({ threadId })).rejects.toMatchObject({
              id: expect.stringMatching(/LIST_MESSAGES.*FAILED/),
            });
          } finally {
            runSpy.mockRestore();
          }
        });
      });

      describe('updateMessages O(n) lookup', () => {
        // Functional regression for the precomputed Map<id, payload>: a batch
        // update across many messages must still produce the right per-row
        // updates. Previously this used messages.find() per row (O(n²)).
        it('correctly updates a large batch of messages by id', async () => {
          const threadId = `wf-upd-${randomUUID()}`;
          const resourceId = `res-upd-${randomUUID()}`;
          await memory.saveThread({
            thread: {
              id: threadId,
              resourceId,
              title: 't',
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          const ids = Array.from({ length: 8 }, () => randomUUID());
          await memory.saveMessages({
            messages: ids.map((id, i) => ({
              id,
              threadId,
              resourceId,
              role: 'user',
              type: 'v2',
              content: { format: 2, parts: [{ type: 'text', text: `before ${i}` }] },
              createdAt: new Date(Date.now() + i),
            })) as any,
          });

          await memory.updateMessages({
            messages: ids.map((id, i) => ({
              id,
              content: { content: `after ${i}` } as any,
            })),
          });

          const result = await memory.listMessages({ threadId });
          // Every message got its own updated content  proves the per-row
          // payload lookup matched the right id, not just the first one.
          for (let i = 0; i < ids.length; i++) {
            const found = result.messages.find(m => m.id === ids[i]);
            expect((found?.content as any)?.content).toBe(`after ${i}`);
          }
        });
      });

      describe('getIncludedMessages batched target lookup', () => {
        // Functional regression for the IN-batched target query: results must
        // still include every requested target plus the requested neighbours.
        it('returns every requested include target in a single batched lookup', async () => {
          const threadId = `wf-inc-${randomUUID()}`;
          const resourceId = `res-inc-${randomUUID()}`;
          await memory.saveThread({
            thread: {
              id: threadId,
              resourceId,
              title: 't',
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          const baseTs = Date.now();
          const ids = Array.from({ length: 6 }, () => randomUUID());
          await memory.saveMessages({
            messages: ids.map((id, i) => ({
              id,
              threadId,
              resourceId,
              role: 'user',
              type: 'v2',
              content: { format: 2, parts: [{ type: 'text', text: `m ${i}` }] },
              createdAt: new Date(baseTs + i * 10),
            })) as any,
          });

          // Three include targets, no neighbours requested  collapses to a
          // single SELECT in the new implementation.
          const result = await memory.listMessages({
            threadId,
            perPage: 0,
            include: [{ id: ids[0]! }, { id: ids[2]! }, { id: ids[4]! }],
          });
          const returned = new Set(result.messages.map(m => m.id));
          expect(returned.has(ids[0]!)).toBe(true);
          expect(returned.has(ids[2]!)).toBe(true);
          expect(returned.has(ids[4]!)).toBe(true);
        });

        it('still returns prev/next neighbours alongside the targets', async () => {
          const threadId = `wf-inc-nb-${randomUUID()}`;
          const resourceId = `res-inc-nb-${randomUUID()}`;
          await memory.saveThread({
            thread: {
              id: threadId,
              resourceId,
              title: 't',
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          const baseTs = Date.now();
          const ids = Array.from({ length: 5 }, () => randomUUID());
          await memory.saveMessages({
            messages: ids.map((id, i) => ({
              id,
              threadId,
              resourceId,
              role: 'user',
              type: 'v2',
              content: { format: 2, parts: [{ type: 'text', text: `m ${i}` }] },
              createdAt: new Date(baseTs + i * 10),
            })) as any,
          });

          // Target ids[2] with one previous and one next neighbour.
          const result = await memory.listMessages({
            threadId,
            perPage: 0,
            include: [{ id: ids[2]!, withPreviousMessages: 1, withNextMessages: 1 }],
          });
          const returned = new Set(result.messages.map(m => m.id));
          expect(returned.has(ids[1]!)).toBe(true);
          expect(returned.has(ids[2]!)).toBe(true);
          expect(returned.has(ids[3]!)).toBe(true);
        });
      });
    });

    describe('WorkflowsSpanner methods', () => {
      beforeAll(async () => {
        await workflows.dangerouslyClearAll();
      });

      describe('persistWorkflowSnapshot and loadWorkflowSnapshot', () => {
        it('inserts a snapshot and reads it back', async () => {
          const { snapshot, runId } = createSampleWorkflowSnapshot('running');
          const workflowName = `wf-${randomUUID()}`;
          await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
          const loaded = await workflows.loadWorkflowSnapshot({ workflowName, runId });
          expect(loaded?.runId).toBe(runId);
          expect(loaded?.status).toBe('running');
        });

        it('upserts on conflict', async () => {
          const { snapshot, runId } = createSampleWorkflowSnapshot('running');
          const workflowName = `wf-${randomUUID()}`;
          await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
          await workflows.persistWorkflowSnapshot({
            workflowName,
            runId,
            snapshot: { ...snapshot, status: 'success' },
          });
          const loaded = await workflows.loadWorkflowSnapshot({ workflowName, runId });
          expect(loaded?.status).toBe('success');
        });

        it('returns null for missing snapshots', async () => {
          const result = await workflows.loadWorkflowSnapshot({
            workflowName: 'missing',
            runId: 'missing',
          });
          expect(result).toBeNull();
        });

        it('preserves createdAt across subsequent upserts when caller omits it', async () => {
          const { snapshot, runId } = createSampleWorkflowSnapshot('running');
          const workflowName = `wf-${randomUUID()}`;
          const originalCreatedAt = new Date('2024-01-15T10:00:00.000Z');
          await workflows.persistWorkflowSnapshot({
            workflowName,
            runId,
            snapshot,
            createdAt: originalCreatedAt,
            updatedAt: originalCreatedAt,
          });

          // Wait long enough that any unintended re-stamp would be visible.
          await new Promise(r => setTimeout(r, 25));

          // Caller does NOT pass createdAt  the existing value must survive.
          await workflows.persistWorkflowSnapshot({
            workflowName,
            runId,
            snapshot: { ...snapshot, status: 'success' },
          });

          const fetched = await workflows.getWorkflowRunById({ runId, workflowName });
          expect(fetched?.createdAt.getTime()).toBe(originalCreatedAt.getTime());
          expect(fetched?.updatedAt.getTime()).toBeGreaterThan(originalCreatedAt.getTime());
        });
      });

      describe('updateWorkflowResults', () => {
        it('merges step result and request context', async () => {
          const { snapshot, runId } = createSampleWorkflowSnapshot('running');
          const workflowName = `wf-${randomUUID()}`;
          await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
          const merged = await workflows.updateWorkflowResults({
            workflowName,
            runId,
            stepId: 'step-X',
            result: { status: 'success', output: { hello: 'world' } } as any,
            requestContext: { trace: 'abc' },
          });
          expect(merged['step-X']?.status).toBe('success');
          const loaded = await workflows.loadWorkflowSnapshot({ workflowName, runId });
          expect(loaded?.requestContext).toEqual({ trace: 'abc' });
        });

        it('creates the snapshot when none exists', async () => {
          const workflowName = `wf-${randomUUID()}`;
          const runId = `run-${randomUUID()}`;
          await workflows.updateWorkflowResults({
            workflowName,
            runId,
            stepId: 'first-step',
            result: { status: 'success' } as any,
            requestContext: {},
          });
          const loaded = await workflows.loadWorkflowSnapshot({ workflowName, runId });
          expect(loaded?.context['first-step']?.status).toBe('success');
        });

        it('preserves createdAt on the existing row when stepping the snapshot', async () => {
          const { snapshot, runId } = createSampleWorkflowSnapshot('running');
          const workflowName = `wf-${randomUUID()}`;
          const originalCreatedAt = new Date('2024-02-20T08:30:00.000Z');
          await workflows.persistWorkflowSnapshot({
            workflowName,
            runId,
            snapshot,
            createdAt: originalCreatedAt,
            updatedAt: originalCreatedAt,
          });

          await new Promise(r => setTimeout(r, 25));

          await workflows.updateWorkflowResults({
            workflowName,
            runId,
            stepId: 'step-X',
            result: { status: 'success' } as any,
            requestContext: { trace: 'abc' },
          });

          const fetched = await workflows.getWorkflowRunById({ runId, workflowName });
          expect(fetched?.createdAt.getTime()).toBe(originalCreatedAt.getTime());
          expect(fetched?.updatedAt.getTime()).toBeGreaterThan(originalCreatedAt.getTime());
        });
      });

      describe('updateWorkflowState', () => {
        it('merges options into the existing snapshot', async () => {
          const { snapshot, runId } = createSampleWorkflowSnapshot('running');
          const workflowName = `wf-${randomUUID()}`;
          await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
          const updated = await workflows.updateWorkflowState({
            workflowName,
            runId,
            opts: { status: 'success' as any },
          });
          expect(updated?.status).toBe('success');
        });

        it('returns undefined when the snapshot is missing', async () => {
          const result = await workflows.updateWorkflowState({
            workflowName: 'missing',
            runId: 'missing',
            opts: { status: 'success' as any },
          });
          expect(result).toBeUndefined();
        });
      });

      describe('getWorkflowRunById', () => {
        it('returns the run for a known runId', async () => {
          const { snapshot, runId } = createSampleWorkflowSnapshot('running');
          const workflowName = `wf-${randomUUID()}`;
          await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
          const fetched = await workflows.getWorkflowRunById({ runId, workflowName });
          expect(fetched?.runId).toBe(runId);
          expect(fetched?.workflowName).toBe(workflowName);
        });

        it('returns null for unknown runId', async () => {
          const result = await workflows.getWorkflowRunById({ runId: 'no-such-run' });
          expect(result).toBeNull();
        });

        it('finds runs by runId only', async () => {
          const { snapshot, runId } = createSampleWorkflowSnapshot('running');
          const workflowName = `wf-${randomUUID()}`;
          await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
          const fetched = await workflows.getWorkflowRunById({ runId });
          expect(fetched?.runId).toBe(runId);
        });

        it('rejects empty runId with a user-facing error', async () => {
          await expect(workflows.getWorkflowRunById({ runId: '' })).rejects.toMatchObject({
            id: expect.stringMatching(/EMPTY_RUN_ID/),
            message: expect.stringMatching(/non-empty runId/i),
          });
          await expect(workflows.getWorkflowRunById({ runId: '   ', workflowName: 'wf' })).rejects.toMatchObject({
            id: expect.stringMatching(/EMPTY_RUN_ID/),
          });
        });
      });

      describe('deleteWorkflowRunById', () => {
        it('removes a snapshot row', async () => {
          const { snapshot, runId } = createSampleWorkflowSnapshot('running');
          const workflowName = `wf-${randomUUID()}`;
          await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
          await workflows.deleteWorkflowRunById({ runId, workflowName });
          expect(await workflows.loadWorkflowSnapshot({ workflowName, runId })).toBeNull();
        });

        it('is a no-op for unknown runs', async () => {
          await expect(
            workflows.deleteWorkflowRunById({ runId: 'missing', workflowName: 'missing' }),
          ).resolves.toBeUndefined();
        });
      });

      describe('listWorkflowRuns', () => {
        const workflowA = `wf-a-${randomUUID()}`;
        const workflowB = `wf-b-${randomUUID()}`;
        const resourceX = `resource-${randomUUID()}`;

        beforeAll(async () => {
          // Three runs of A (one with resourceId), two of B.
          const aRuns = [
            createSampleWorkflowSnapshot('running'),
            createSampleWorkflowSnapshot('success'),
            createSampleWorkflowSnapshot('failed'),
          ];
          for (const r of aRuns) {
            await workflows.persistWorkflowSnapshot({
              workflowName: workflowA,
              runId: r.runId,
              snapshot: r.snapshot,
              resourceId: aRuns.indexOf(r) === 0 ? resourceX : undefined,
            });
            await new Promise(r => setTimeout(r, 5));
          }
          const bRuns = [createSampleWorkflowSnapshot('running'), createSampleWorkflowSnapshot('success')];
          for (const r of bRuns) {
            await workflows.persistWorkflowSnapshot({ workflowName: workflowB, runId: r.runId, snapshot: r.snapshot });
          }
        });

        it('lists all workflow runs without filters', async () => {
          const result = await workflows.listWorkflowRuns({});
          expect(result.runs.length).toBeGreaterThanOrEqual(5);
        });

        it('filters by workflowName', async () => {
          const result = await workflows.listWorkflowRuns({ workflowName: workflowA });
          expect(result.runs.every(r => r.workflowName === workflowA)).toBe(true);
          expect(result.runs.length).toBe(3);
        });

        it('filters by status', async () => {
          const result = await workflows.listWorkflowRuns({ workflowName: workflowA, status: 'success' });
          expect(result.runs.length).toBe(1);
        });

        it('exposes the snapshotStatus generated column populated from the JSON snapshot', async () => {
          // Probe INFORMATION_SCHEMA directly so the assertion doesn't rely on
          // the runtime fast-path detection used by listWorkflowRuns.
          const internalDb: SpannerDB = (workflows as any).db;
          const exists = await internalDb.hasColumn('mastra_workflow_snapshot', 'snapshotStatus');
          expect(exists).toBe(true);

          // Sanity check: the generated value matches what's in the snapshot.
          const [rows] = await (workflows as any).database.run({
            sql: `SELECT snapshotStatus FROM \`mastra_workflow_snapshot\`
                  WHERE workflow_name = @workflowName AND JSON_VALUE(snapshot, '$.status') = @status
                  LIMIT 1`,
            params: { workflowName: workflowA, status: 'success' },
            json: true,
          });
          expect((rows as Array<Record<string, any>>)[0]?.snapshotStatus).toBe('success');
        });

        it('filters by resourceId', async () => {
          const result = await workflows.listWorkflowRuns({ workflowName: workflowA, resourceId: resourceX });
          expect(result.runs.length).toBe(1);
          expect(result.runs[0]?.resourceId).toBe(resourceX);
        });

        it('paginates results', async () => {
          const page0 = await workflows.listWorkflowRuns({ workflowName: workflowA, page: 0, perPage: 2 });
          expect(page0.runs.length).toBe(2);
          expect(page0.total).toBe(3);
          const page1 = await workflows.listWorkflowRuns({ workflowName: workflowA, page: 1, perPage: 2 });
          expect(page1.runs.length).toBe(1);
        });

        it('filters by date range', async () => {
          const all = await workflows.listWorkflowRuns({ workflowName: workflowA });
          const sortedAsc = [...all.runs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          const fromDate = sortedAsc[1]!.createdAt;
          const result = await workflows.listWorkflowRuns({ workflowName: workflowA, fromDate });
          expect(result.runs.length).toBeGreaterThanOrEqual(2);
        });
      });
    });

    describe('BackgroundTasksSpanner methods', () => {
      beforeAll(async () => {
        await backgroundTasks.dangerouslyClearAll();
      });

      describe('createTask and getTask', () => {
        it('round-trips a task', async () => {
          const task = createSampleTask();
          await backgroundTasks.createTask(task);
          const fetched = await backgroundTasks.getTask(task.id);
          expect(fetched?.id).toBe(task.id);
          expect(fetched?.toolName).toBe(task.toolName);
          expect(fetched?.args).toEqual(task.args);
        });

        it('returns null for unknown task IDs', async () => {
          expect(await backgroundTasks.getTask('missing')).toBeNull();
        });
      });

      describe('updateTask', () => {
        it('updates status, retryCount, startedAt, completedAt, result, error', async () => {
          const task = createSampleTask();
          await backgroundTasks.createTask(task);
          const startedAt = new Date();
          const completedAt = new Date(startedAt.getTime() + 1000);
          await backgroundTasks.updateTask(task.id, {
            status: 'completed',
            retryCount: 2,
            startedAt,
            completedAt,
            result: { ok: true },
            error: null as any,
          });
          const fetched = await backgroundTasks.getTask(task.id);
          expect(fetched?.status).toBe('completed');
          expect(fetched?.retryCount).toBe(2);
          expect(fetched?.startedAt).toBeInstanceOf(Date);
          expect(fetched?.completedAt).toBeInstanceOf(Date);
          expect(fetched?.result).toEqual({ ok: true });
        });

        it('is a no-op when no fields are provided', async () => {
          const task = createSampleTask();
          await backgroundTasks.createTask(task);
          await expect(backgroundTasks.updateTask(task.id, {})).resolves.toBeUndefined();
        });
      });

      describe('listTasks', () => {
        const agentId = `agent-list-${randomUUID()}`;
        const otherAgent = `agent-other-${randomUUID()}`;

        beforeAll(async () => {
          for (let i = 0; i < 3; i++) {
            const t = createSampleTask({
              agentId,
              toolName: i === 0 ? 'tool-x' : 'tool-y',
              status: i === 0 ? 'completed' : 'running',
              createdAt: new Date(Date.now() + i),
            });
            await backgroundTasks.createTask(t);
          }
          await backgroundTasks.createTask(createSampleTask({ agentId: otherAgent, status: 'pending' }));
        });

        it('filters by agentId', async () => {
          const result = await backgroundTasks.listTasks({ agentId });
          expect(result.tasks.every(t => t.agentId === agentId)).toBe(true);
          expect(result.total).toBe(3);
        });

        it('filters by status (single)', async () => {
          const result = await backgroundTasks.listTasks({ agentId, status: 'running' });
          expect(result.tasks.every(t => t.status === 'running')).toBe(true);
          expect(result.total).toBe(2);
        });

        it('filters by status (multiple)', async () => {
          const result = await backgroundTasks.listTasks({ agentId, status: ['running', 'completed'] });
          expect(result.total).toBe(3);
        });

        it('filters by toolName', async () => {
          const result = await backgroundTasks.listTasks({ agentId, toolName: 'tool-x' });
          expect(result.total).toBe(1);
        });

        it('paginates results', async () => {
          const page = await backgroundTasks.listTasks({ agentId, perPage: 2, page: 0 });
          expect(page.tasks.length).toBe(2);
          expect(page.total).toBe(3);
        });

        it('orders by createdAt DESC when requested', async () => {
          const result = await backgroundTasks.listTasks({
            agentId,
            orderBy: 'createdAt',
            orderDirection: 'desc',
          });
          for (let i = 1; i < result.tasks.length; i++) {
            expect(result.tasks[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
              result.tasks[i]!.createdAt.getTime(),
            );
          }
        });
      });

      describe('deleteTask', () => {
        it('removes a single task', async () => {
          const task = createSampleTask();
          await backgroundTasks.createTask(task);
          await backgroundTasks.deleteTask(task.id);
          expect(await backgroundTasks.getTask(task.id)).toBeNull();
        });
      });

      describe('deleteTasks', () => {
        it('deletes by status filter', async () => {
          const agentId = `delete-${randomUUID()}`;
          await backgroundTasks.createTask(createSampleTask({ agentId, status: 'pending' }));
          await backgroundTasks.createTask(createSampleTask({ agentId, status: 'completed' }));

          await backgroundTasks.deleteTasks({ status: 'completed', agentId });
          const remaining = await backgroundTasks.listTasks({ agentId });
          expect(remaining.total).toBe(1);
          expect(remaining.tasks[0]?.status).toBe('pending');
        });

        it('is a no-op when filter is empty (no conditions)', async () => {
          await expect(backgroundTasks.deleteTasks({})).resolves.toBeUndefined();
        });

        it('is a no-op for an empty status array (does not emit `IN ()`)', async () => {
          // Bug guard: prior to the fix this would build invalid SQL like
          // `WHERE status IN ()` and throw at the Spanner layer.
          const agentId = `delete-empty-${randomUUID()}`;
          await backgroundTasks.createTask(createSampleTask({ agentId, status: 'pending' }));
          await expect(backgroundTasks.deleteTasks({ status: [] })).resolves.toBeUndefined();
          // The pending task survives the no-op delete.
          const remaining = await backgroundTasks.listTasks({ agentId });
          expect(remaining.total).toBe(1);
          await backgroundTasks.deleteTasks({ agentId });
        });
      });

      describe('input validation', () => {
        it('listTasks short-circuits when status is an explicit empty array', async () => {
          // Insert something so the table is non-empty; the empty status
          // filter must still return zero rows without hitting Spanner with
          // an invalid `IN ()` clause.
          const agentId = `list-empty-status-${randomUUID()}`;
          await backgroundTasks.createTask(createSampleTask({ agentId, status: 'pending' }));
          const result = await backgroundTasks.listTasks({ status: [] });
          expect(result).toEqual({ tasks: [], total: 0 });
          await backgroundTasks.deleteTasks({ agentId });
        });

        it('listTasks rejects negative page', async () => {
          await expect(backgroundTasks.listTasks({ page: -1, perPage: 10 })).rejects.toMatchObject({
            id: expect.stringMatching(/INVALID_PAGE/),
          });
        });

        it('listTasks rejects negative perPage', async () => {
          await expect(backgroundTasks.listTasks({ perPage: -5 })).rejects.toMatchObject({
            id: expect.stringMatching(/INVALID_PER_PAGE/),
          });
        });

        it('listTasks reports total via tasks.length when pagination is omitted', async () => {
          // When the caller doesn't ask for a paged window, the adapter skips
          // the dedicated COUNT(*) round-trip and reads `total` off the
          // returned array. This regression-checks both the count value and
          // that the count query was avoided.
          const agentId = `list-no-pagination-${randomUUID()}`;
          await backgroundTasks.createTask(createSampleTask({ agentId, status: 'pending' }));
          await backgroundTasks.createTask(createSampleTask({ agentId, status: 'pending' }));
          await backgroundTasks.createTask(createSampleTask({ agentId, status: 'pending' }));
          const result = await backgroundTasks.listTasks({ agentId });
          expect(result.tasks.length).toBe(3);
          expect(result.total).toBe(3);
          await backgroundTasks.deleteTasks({ agentId });
        });
      });

      describe('getRunningCount', () => {
        // Reset before each test so counts are deterministic regardless of
        // ordering with the rest of the BackgroundTasksSpanner suite.
        beforeEach(async () => {
          await backgroundTasks.dangerouslyClearAll();
        });

        it('returns 0 against an empty table', async () => {
          expect(await backgroundTasks.getRunningCount()).toBe(0);
        });

        it('counts only tasks with status="running"', async () => {
          await backgroundTasks.createTask(createSampleTask({ status: 'running' }));
          await backgroundTasks.createTask(createSampleTask({ status: 'running' }));
          await backgroundTasks.createTask(createSampleTask({ status: 'pending' }));
          await backgroundTasks.createTask(createSampleTask({ status: 'completed' }));
          await backgroundTasks.createTask(createSampleTask({ status: 'failed' }));
          expect(await backgroundTasks.getRunningCount()).toBe(2);
        });

        it('returns 0 when no tasks are running but the table is non-empty', async () => {
          await backgroundTasks.createTask(createSampleTask({ status: 'pending' }));
          await backgroundTasks.createTask(createSampleTask({ status: 'completed' }));
          expect(await backgroundTasks.getRunningCount()).toBe(0);
        });

        it('reflects status transitions on existing rows', async () => {
          const task = createSampleTask({ status: 'pending' });
          await backgroundTasks.createTask(task);
          expect(await backgroundTasks.getRunningCount()).toBe(0);

          await backgroundTasks.updateTask(task.id, { status: 'running', startedAt: new Date() });
          expect(await backgroundTasks.getRunningCount()).toBe(1);

          await backgroundTasks.updateTask(task.id, { status: 'completed', completedAt: new Date() });
          expect(await backgroundTasks.getRunningCount()).toBe(0);
        });
      });

      describe('getRunningCountByAgent', () => {
        beforeEach(async () => {
          await backgroundTasks.dangerouslyClearAll();
        });

        it('returns 0 for an unknown agentId', async () => {
          expect(await backgroundTasks.getRunningCountByAgent('agent-does-not-exist')).toBe(0);
        });

        it('counts running tasks scoped to the given agent', async () => {
          const a1 = `agent-${randomUUID()}`;
          const a2 = `agent-${randomUUID()}`;
          await backgroundTasks.createTask(createSampleTask({ agentId: a1, status: 'running' }));
          await backgroundTasks.createTask(createSampleTask({ agentId: a1, status: 'running' }));
          await backgroundTasks.createTask(createSampleTask({ agentId: a2, status: 'running' }));
          expect(await backgroundTasks.getRunningCountByAgent(a1)).toBe(2);
          expect(await backgroundTasks.getRunningCountByAgent(a2)).toBe(1);
        });

        it('ignores non-running tasks for the same agent', async () => {
          const a = `agent-${randomUUID()}`;
          await backgroundTasks.createTask(createSampleTask({ agentId: a, status: 'running' }));
          await backgroundTasks.createTask(createSampleTask({ agentId: a, status: 'pending' }));
          await backgroundTasks.createTask(createSampleTask({ agentId: a, status: 'completed' }));
          await backgroundTasks.createTask(createSampleTask({ agentId: a, status: 'failed' }));
          expect(await backgroundTasks.getRunningCountByAgent(a)).toBe(1);
        });

        it('ignores running tasks belonging to other agents', async () => {
          const a1 = `agent-${randomUUID()}`;
          const a2 = `agent-${randomUUID()}`;
          await backgroundTasks.createTask(createSampleTask({ agentId: a1, status: 'running' }));
          await backgroundTasks.createTask(createSampleTask({ agentId: a2, status: 'running' }));
          await backgroundTasks.createTask(createSampleTask({ agentId: a2, status: 'running' }));
          expect(await backgroundTasks.getRunningCountByAgent(a1)).toBe(1);
        });
      });
    });

    describe('AgentsSpanner methods', () => {
      beforeAll(async () => {
        await agents.dangerouslyClearAll();
      });

      const baseSnapshot = {
        name: 'Method Agent',
        instructions: 'be careful',
        model: { provider: 'openai', name: 'gpt-4' },
      };

      describe('update', () => {
        it('updates status, activeVersionId, authorId, metadata', async () => {
          const id = `update-${randomUUID()}`;
          await agents.create({ agent: { id, ...baseSnapshot } });

          const versionId = randomUUID();
          await agents.createVersion({
            id: versionId,
            agentId: id,
            versionNumber: 2,
            name: 'V2',
            instructions: 'still careful',
            model: baseSnapshot.model,
            changedFields: ['name'],
            changeMessage: 'rename',
          });

          const updated = await agents.update({
            id,
            status: 'published',
            activeVersionId: versionId,
            authorId: 'author-1',
            metadata: { region: 'eu' },
          });
          expect(updated.status).toBe('published');
          expect(updated.activeVersionId).toBe(versionId);
          expect(updated.authorId).toBe('author-1');
          expect(updated.metadata).toEqual({ region: 'eu' });
        });

        it('throws for missing agents', async () => {
          await expect(agents.update({ id: 'missing-agent', metadata: {} })).rejects.toThrow(/not found/i);
        });
      });

      describe('delete', () => {
        it('removes the thin record and all versions', async () => {
          const id = `delete-${randomUUID()}`;
          await agents.create({ agent: { id, ...baseSnapshot } });
          await agents.createVersion({
            id: randomUUID(),
            agentId: id,
            versionNumber: 2,
            name: 'V2',
            instructions: 'be',
            model: baseSnapshot.model,
          });
          await agents.delete(id);
          expect(await agents.getById(id)).toBeNull();
          expect(await agents.countVersions(id)).toBe(0);
        });

        it('is a no-op for unknown agents', async () => {
          await expect(agents.delete('non-existent')).resolves.toBeUndefined();
        });
      });

      describe('orphan-draft handling', () => {
        it('rolls back the draft thin row when the version insert fails inside the create() transaction', async () => {
          // create() now writes both the thin row and the seed version inside
          // a single Spanner transaction, so a version-insert failure must
          // roll the thin-row insert back atomically (no orphan left behind).
          // Spy on the underlying SpannerDB.insert and reject when the call
          // targets the versions table; capture the original BEFORE the spy
          // so the thin-row insert can pass through without recursing.
          const id = `orphan-create-${randomUUID()}`;
          const internalDb: SpannerDB = (agents as any).db;
          const originalInsert = internalDb.insert.bind(internalDb);
          const insertSpy = vi.spyOn(internalDb, 'insert').mockImplementation(async (args: any) => {
            if (args?.tableName === 'mastra_agent_versions') {
              throw new Error('simulated version insert failure');
            }
            return originalInsert(args);
          });
          try {
            await expect(agents.create({ agent: { id, ...baseSnapshot } })).rejects.toThrow(
              /simulated version insert failure|CREATE_AGENT/,
            );
          } finally {
            insertSpy.mockRestore();
          }
          // The transaction rolled back, so the thin row was never committed.
          expect(await agents.getById(id)).toBeNull();
        });

        it('init() sweeps orphaned draft=null,activeVersionId=null rows when cleanupStaleDraftsOnStartup is enabled', async () => {
          const id = `orphan-init-${randomUUID()}`;

          // Simulate a prior crash: thin row exists but no version was ever
          // inserted. Use the underlying SpannerDB directly to plant the orphan.
          const internalDb: SpannerDB = (agents as any).db;
          const now = new Date();
          await internalDb.insert({
            tableName: TABLE_AGENTS,
            record: {
              id,
              status: 'draft',
              activeVersionId: null,
              authorId: null,
              metadata: null,
              createdAt: now,
              updatedAt: now,
            },
          });
          expect(await agents.getById(id)).not.toBeNull();

          // The flag is readonly so test code casts through `any` to flip it
          // for the duration of the assertion, then restores it. This avoids
          // constructing a second AgentsSpanner instance, which incurs extra
          // DDL probes and can race with other concurrent tests.
          // Flip the flag and invoke the private cleanup directly. Going
          // through full init() repeatedly probes INFORMATION_SCHEMA on every
          // table/index even though they all already exist, which is enough
          // to time out on the emulator under load. The cleanup behavior is
          // what matters here.
          const previous = internalDb.cleanupStaleDraftsOnStartup;
          (internalDb as any).cleanupStaleDraftsOnStartup = true;
          try {
            await (agents as any).cleanupStaleDrafts();
          } finally {
            (internalDb as any).cleanupStaleDraftsOnStartup = previous;
          }

          expect(await agents.getById(id)).toBeNull();
        });

        it('init() with cleanupStaleDraftsOnStartup leaves published agents and drafts with active versions untouched', async () => {
          const publishedId = `keep-published-${randomUUID()}`;
          const draftWithVersionId = `keep-draft-${randomUUID()}`;

          await agents.create({ agent: { id: publishedId, ...baseSnapshot } });
          const versionId = randomUUID();
          await agents.createVersion({
            id: versionId,
            agentId: publishedId,
            versionNumber: 2,
            name: 'V2',
            instructions: 'still careful',
            model: baseSnapshot.model,
          });
          await agents.update({ id: publishedId, status: 'published', activeVersionId: versionId });

          // A draft that DOES have an active version (e.g. mid-edit) must survive.
          await agents.create({ agent: { id: draftWithVersionId, ...baseSnapshot } });
          const v1Id = randomUUID();
          await agents.createVersion({
            id: v1Id,
            agentId: draftWithVersionId,
            versionNumber: 2,
            name: 'V2',
            instructions: 'mid edit',
            model: baseSnapshot.model,
          });
          await agents.update({ id: draftWithVersionId, activeVersionId: v1Id });

          const internalDb: SpannerDB = (agents as any).db;
          // Flip the flag and invoke the private cleanup directly. Going
          // through full init() repeatedly probes INFORMATION_SCHEMA on every
          // table/index even though they all already exist, which is enough
          // to time out on the emulator under load. The cleanup behavior is
          // what matters here.
          const previous = internalDb.cleanupStaleDraftsOnStartup;
          (internalDb as any).cleanupStaleDraftsOnStartup = true;
          try {
            await (agents as any).cleanupStaleDrafts();
          } finally {
            (internalDb as any).cleanupStaleDraftsOnStartup = previous;
          }

          expect(await agents.getById(publishedId)).not.toBeNull();
          expect(await agents.getById(draftWithVersionId)).not.toBeNull();
        });
      });

      describe('list', () => {
        const authorA = `author-a-${randomUUID()}`;
        const authorB = `author-b-${randomUUID()}`;

        beforeAll(async () => {
          await agents.dangerouslyClearAll();
          for (let i = 0; i < 4; i++) {
            await agents.create({
              agent: {
                id: `list-${randomUUID()}`,
                ...baseSnapshot,
                authorId: i < 3 ? authorA : authorB,
                metadata: { tier: i % 2 === 0 ? 'gold' : 'silver' },
              },
            });
            await new Promise(r => setTimeout(r, 5));
          }
        });

        it('returns all agents with default pagination', async () => {
          const result = await agents.list({ status: 'draft' });
          expect(result.total).toBe(4);
        });

        it('filters by authorId', async () => {
          const result = await agents.list({ status: 'draft', authorId: authorA });
          expect(result.total).toBe(3);
          expect(result.agents.every(a => a.authorId === authorA)).toBe(true);
        });

        it('filters by metadata', async () => {
          const result = await agents.list({ status: 'draft', metadata: { tier: 'gold' } });
          expect(result.total).toBe(2);
        });

        it('paginates results', async () => {
          const page = await agents.list({ status: 'draft', page: 0, perPage: 2 });
          expect(page.agents.length).toBe(2);
          expect(page.hasMore).toBe(true);
        });

        it('orders by createdAt DESC by default', async () => {
          const result = await agents.list({ status: 'draft' });
          for (let i = 1; i < result.agents.length; i++) {
            expect(result.agents[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
              result.agents[i]!.createdAt.getTime(),
            );
          }
        });
      });

      describe('Version methods', () => {
        let agentId: string;
        const versionIds: string[] = [];

        beforeAll(async () => {
          agentId = `versions-${randomUUID()}`;
          await agents.create({ agent: { id: agentId, ...baseSnapshot } });
          // create() already added v1; add v2 and v3.
          for (let n = 2; n <= 3; n++) {
            const vid = randomUUID();
            versionIds.push(vid);
            await agents.createVersion({
              id: vid,
              agentId,
              versionNumber: n,
              name: `V${n}`,
              instructions: 'be',
              model: baseSnapshot.model,
              changedFields: ['name'],
              changeMessage: `bump-${n}`,
            });
          }
        });

        it('createVersion stores all snapshot fields', async () => {
          const v = await agents.getLatestVersion(agentId);
          expect(v?.versionNumber).toBe(3);
          expect(v?.name).toBe('V3');
        });

        it('getVersion returns the matching row', async () => {
          const v = await agents.getVersion(versionIds[0]!);
          expect(v?.id).toBe(versionIds[0]);
        });

        it('getVersion returns null for unknown id', async () => {
          expect(await agents.getVersion('no-such-version')).toBeNull();
        });

        it('getVersionByNumber returns the correct version', async () => {
          const v = await agents.getVersionByNumber(agentId, 2);
          expect(v?.versionNumber).toBe(2);
          expect(v?.name).toBe('V2');
        });

        it('getVersionByNumber returns null for missing version', async () => {
          expect(await agents.getVersionByNumber(agentId, 99)).toBeNull();
        });

        it('getLatestVersion returns the highest version', async () => {
          const v = await agents.getLatestVersion(agentId);
          expect(v?.versionNumber).toBe(3);
        });

        it('countVersions returns the total', async () => {
          expect(await agents.countVersions(agentId)).toBe(3);
        });

        it('deleteVersion removes a single version', async () => {
          await agents.deleteVersion(versionIds[0]!);
          expect(await agents.getVersion(versionIds[0]!)).toBeNull();
          expect(await agents.countVersions(agentId)).toBe(2);
        });

        it('deleteVersionsByParentId removes all versions for the agent', async () => {
          const tempAgentId = `bulk-${randomUUID()}`;
          await agents.create({ agent: { id: tempAgentId, ...baseSnapshot } });
          await agents.createVersion({
            id: randomUUID(),
            agentId: tempAgentId,
            versionNumber: 2,
            name: 'V2',
            instructions: 'x',
            model: baseSnapshot.model,
          });
          expect(await agents.countVersions(tempAgentId)).toBe(2);
          await agents.deleteVersionsByParentId(tempAgentId);
          expect(await agents.countVersions(tempAgentId)).toBe(0);
        });
      });
    });

    describe('MCPClientsSpanner methods', () => {
      beforeAll(async () => {
        await mcpClients.dangerouslyClearAll();
      });

      it('getVersion returns the row by id', async () => {
        const id = `mcp-c-${randomUUID()}`;
        await mcpClients.create({
          mcpClient: { id, name: 'Client', servers: { fs: { url: 'http://localhost' } as any } },
        });
        const latest = await mcpClients.getLatestVersion(id);
        expect(latest).not.toBeNull();
        const fetched = await mcpClients.getVersion(latest!.id);
        expect(fetched?.id).toBe(latest!.id);
      });

      it('getVersion returns null for unknown id', async () => {
        expect(await mcpClients.getVersion('missing')).toBeNull();
      });

      it('getVersionByNumber returns the matching version', async () => {
        const id = `mcp-c-${randomUUID()}`;
        await mcpClients.create({ mcpClient: { id, name: 'C', servers: {} } });
        await mcpClients.createVersion({
          id: randomUUID(),
          mcpClientId: id,
          versionNumber: 2,
          name: 'C v2',
          servers: { remote: { url: 'http://remote' } as any },
        });
        const v2 = await mcpClients.getVersionByNumber(id, 2);
        expect(v2?.versionNumber).toBe(2);
        expect(v2?.servers).toEqual({ remote: { url: 'http://remote' } });
        expect(await mcpClients.getVersionByNumber(id, 99)).toBeNull();
      });

      it('deleteVersion removes a single version', async () => {
        const id = `mcp-c-${randomUUID()}`;
        await mcpClients.create({ mcpClient: { id, name: 'C', servers: {} } });
        const v2Id = randomUUID();
        await mcpClients.createVersion({
          id: v2Id,
          mcpClientId: id,
          versionNumber: 2,
          name: 'V2',
          servers: {},
        });
        expect(await mcpClients.countVersions(id)).toBe(2);
        await mcpClients.deleteVersion(v2Id);
        expect(await mcpClients.countVersions(id)).toBe(1);
        expect(await mcpClients.getVersion(v2Id)).toBeNull();
      });

      describe('orphan-draft handling', () => {
        it('rolls back the draft thin row when the version insert fails inside the create() transaction', async () => {
          const id = `mcp-c-orphan-${randomUUID()}`;
          const internalDb: SpannerDB = (mcpClients as any).db;
          const originalInsert = internalDb.insert.bind(internalDb);
          const insertSpy = vi.spyOn(internalDb, 'insert').mockImplementation(async (args: any) => {
            if (args?.tableName === 'mastra_mcp_client_versions') {
              throw new Error('simulated version insert failure');
            }
            return originalInsert(args);
          });
          try {
            await expect(mcpClients.create({ mcpClient: { id, name: 'C', servers: {} } })).rejects.toThrow(
              /simulated version insert failure|CREATE_MCP_CLIENT/,
            );
          } finally {
            insertSpy.mockRestore();
          }
          expect(await mcpClients.getById(id)).toBeNull();
        });

        it('init() sweeps orphaned draft+activeVersionId=NULL rows when cleanupStaleDraftsOnStartup is enabled', async () => {
          const id = `mcp-c-init-orphan-${randomUUID()}`;
          const internalDb: SpannerDB = (mcpClients as any).db;
          const now = new Date();
          await internalDb.insert({
            tableName: 'mastra_mcp_clients' as any,
            record: {
              id,
              status: 'draft',
              activeVersionId: null,
              authorId: null,
              metadata: null,
              createdAt: now,
              updatedAt: now,
            },
          });
          expect(await mcpClients.getById(id)).not.toBeNull();

          const previous = internalDb.cleanupStaleDraftsOnStartup;
          (internalDb as any).cleanupStaleDraftsOnStartup = true;
          try {
            await (mcpClients as any).cleanupStaleDrafts();
          } finally {
            (internalDb as any).cleanupStaleDraftsOnStartup = previous;
          }

          expect(await mcpClients.getById(id)).toBeNull();
        });

        it('init() with cleanupStaleDraftsOnStartup leaves published clients and drafts with active versions untouched', async () => {
          const publishedId = `mcp-c-keep-pub-${randomUUID()}`;
          const draftWithVersionId = `mcp-c-keep-draft-${randomUUID()}`;

          await mcpClients.create({ mcpClient: { id: publishedId, name: 'P', servers: {} } });
          const v1Pub = await mcpClients.getLatestVersion(publishedId);
          await mcpClients.update({
            id: publishedId,
            status: 'published',
            activeVersionId: v1Pub!.id,
          });

          // A draft that DOES have an active version (e.g. mid-edit) must survive.
          await mcpClients.create({ mcpClient: { id: draftWithVersionId, name: 'D', servers: {} } });
          const v1Draft = await mcpClients.getLatestVersion(draftWithVersionId);
          await mcpClients.update({ id: draftWithVersionId, activeVersionId: v1Draft!.id });

          const internalDb: SpannerDB = (mcpClients as any).db;
          const previous = internalDb.cleanupStaleDraftsOnStartup;
          (internalDb as any).cleanupStaleDraftsOnStartup = true;
          try {
            await (mcpClients as any).cleanupStaleDrafts();
          } finally {
            (internalDb as any).cleanupStaleDraftsOnStartup = previous;
          }

          expect(await mcpClients.getById(publishedId)).not.toBeNull();
          expect(await mcpClients.getById(draftWithVersionId)).not.toBeNull();
        });
      });

      describe('list defaulting to status=published', () => {
        const tag = `pub-default-${randomUUID()}`;
        beforeAll(async () => {
          await mcpClients.dangerouslyClearAll();
          // 2 drafts (left in initial draft state by create())
          await mcpClients.create({
            mcpClient: { id: `${tag}-d1`, name: 'D1', servers: {}, metadata: { tag } },
          });
          await mcpClients.create({
            mcpClient: { id: `${tag}-d2`, name: 'D2', servers: {}, metadata: { tag } },
          });
          // 3 published (created as draft, then promoted to published)
          for (const n of ['p1', 'p2', 'p3']) {
            const id = `${tag}-${n}`;
            await mcpClients.create({
              mcpClient: { id, name: n, servers: {}, metadata: { tag } },
            });
            const latest = await mcpClients.getLatestVersion(id);
            await mcpClients.update({ id, status: 'published', activeVersionId: latest!.id });
          }
        });

        it('omitting status defaults to published (drafts excluded)', async () => {
          const result = await mcpClients.list({ metadata: { tag } });
          expect(result.total).toBe(3);
          expect(result.mcpClients.every(c => c.status === 'published')).toBe(true);
        });

        it('explicit status=draft still works', async () => {
          const result = await mcpClients.list({ status: 'draft', metadata: { tag } });
          expect(result.total).toBe(2);
          expect(result.mcpClients.every(c => c.status === 'draft')).toBe(true);
        });
      });

      describe('unique-version invariant', () => {
        it('rejects a duplicate (mcpClientId, versionNumber) pair', async () => {
          // The unique index on (mcpClientId, versionNumber) is meant to
          // prevent two writes from racing to produce the same version
          // number. Verifying the invariant is in force also means the
          // "unique index failure must not be swallowed at init()"
          // hardening is doing its job.
          const id = `mcp-c-unique-${randomUUID()}`;
          await mcpClients.create({ mcpClient: { id, name: 'C', servers: {} } });
          // The seed createVersion already wrote versionNumber=1; a second
          // write with the same number must throw.
          await expect(
            mcpClients.createVersion({
              id: randomUUID(),
              mcpClientId: id,
              versionNumber: 1,
              name: 'duplicate v1',
              servers: {},
            }),
          ).rejects.toThrow();
        });
      });
    });

    describe('MCPServersSpanner methods', () => {
      beforeAll(async () => {
        await mcpServers.dangerouslyClearAll();
      });

      it('delete removes the thin record and all versions', async () => {
        const id = `mcp-s-${randomUUID()}`;
        await mcpServers.create({ mcpServer: { id, name: 'S', version: '0.1.0' } });
        await mcpServers.createVersion({
          id: randomUUID(),
          mcpServerId: id,
          versionNumber: 2,
          name: 'S v2',
          version: '0.2.0',
        });
        expect(await mcpServers.countVersions(id)).toBe(2);
        await mcpServers.delete(id);
        expect(await mcpServers.getById(id)).toBeNull();
        expect(await mcpServers.countVersions(id)).toBe(0);
      });

      it('getVersionByNumber returns the matching version', async () => {
        const id = `mcp-s-${randomUUID()}`;
        await mcpServers.create({ mcpServer: { id, name: 'S', version: '1.0.0' } });
        await mcpServers.createVersion({
          id: randomUUID(),
          mcpServerId: id,
          versionNumber: 2,
          name: 'S v2',
          version: '2.0.0',
        });
        const v2 = await mcpServers.getVersionByNumber(id, 2);
        expect(v2?.version).toBe('2.0.0');
        expect(await mcpServers.getVersionByNumber(id, 99)).toBeNull();
      });

      it('getLatestVersion returns the highest version', async () => {
        const id = `mcp-s-${randomUUID()}`;
        await mcpServers.create({ mcpServer: { id, name: 'S', version: '1.0.0' } });
        for (let n = 2; n <= 3; n++) {
          await mcpServers.createVersion({
            id: randomUUID(),
            mcpServerId: id,
            versionNumber: n,
            name: `S v${n}`,
            version: `${n}.0.0`,
          });
        }
        const latest = await mcpServers.getLatestVersion(id);
        expect(latest?.versionNumber).toBe(3);
        expect(await mcpServers.getLatestVersion('missing-server')).toBeNull();
      });

      it('listVersions paginates and orders', async () => {
        const id = `mcp-s-${randomUUID()}`;
        await mcpServers.create({ mcpServer: { id, name: 'List Server', version: '1.0.0' } });
        for (let n = 2; n <= 5; n++) {
          await mcpServers.createVersion({
            id: randomUUID(),
            mcpServerId: id,
            versionNumber: n,
            name: `v${n}`,
            version: `${n}.0.0`,
          });
        }
        const all = await mcpServers.listVersions({ mcpServerId: id });
        expect(all.total).toBe(5);
        expect(all.versions[0]?.versionNumber).toBe(5); // default DESC

        const page = await mcpServers.listVersions({ mcpServerId: id, page: 0, perPage: 2 });
        expect(page.versions.length).toBe(2);
        expect(page.hasMore).toBe(true);

        const asc = await mcpServers.listVersions({
          mcpServerId: id,
          orderBy: { field: 'versionNumber', direction: 'ASC' },
        });
        expect(asc.versions[0]?.versionNumber).toBe(1);
      });

      it('deleteVersion removes a single version row', async () => {
        const id = `mcp-s-${randomUUID()}`;
        await mcpServers.create({ mcpServer: { id, name: 'S', version: '0.1.0' } });
        const v2Id = randomUUID();
        await mcpServers.createVersion({
          id: v2Id,
          mcpServerId: id,
          versionNumber: 2,
          name: 'S v2',
          version: '0.2.0',
        });
        await mcpServers.deleteVersion(v2Id);
        expect(await mcpServers.getVersion(v2Id)).toBeNull();
        expect(await mcpServers.countVersions(id)).toBe(1);
      });

      it('countVersions reports the version total', async () => {
        const id = `mcp-s-${randomUUID()}`;
        await mcpServers.create({ mcpServer: { id, name: 'S', version: '0.1.0' } });
        expect(await mcpServers.countVersions(id)).toBe(1);
        await mcpServers.createVersion({
          id: randomUUID(),
          mcpServerId: id,
          versionNumber: 2,
          name: 'S v2',
          version: '0.2.0',
        });
        expect(await mcpServers.countVersions(id)).toBe(2);
        expect(await mcpServers.countVersions('non-existent')).toBe(0);
      });

      describe('orphan-draft handling', () => {
        it('rolls back the draft thin row when the version insert fails inside the create() transaction', async () => {
          const id = `mcp-s-orphan-${randomUUID()}`;
          const internalDb: SpannerDB = (mcpServers as any).db;
          const originalInsert = internalDb.insert.bind(internalDb);
          const insertSpy = vi.spyOn(internalDb, 'insert').mockImplementation(async (args: any) => {
            if (args?.tableName === 'mastra_mcp_server_versions') {
              throw new Error('simulated version insert failure');
            }
            return originalInsert(args);
          });
          try {
            await expect(mcpServers.create({ mcpServer: { id, name: 'S', version: '0.1.0' } })).rejects.toThrow(
              /simulated version insert failure|CREATE_MCP_SERVER/,
            );
          } finally {
            insertSpy.mockRestore();
          }
          expect(await mcpServers.getById(id)).toBeNull();
        });

        it('init() sweeps orphaned draft+activeVersionId=NULL rows when cleanupStaleDraftsOnStartup is enabled', async () => {
          const id = `mcp-s-init-orphan-${randomUUID()}`;
          const internalDb: SpannerDB = (mcpServers as any).db;
          const now = new Date();
          await internalDb.insert({
            tableName: 'mastra_mcp_servers' as any,
            record: {
              id,
              status: 'draft',
              activeVersionId: null,
              authorId: null,
              metadata: null,
              createdAt: now,
              updatedAt: now,
            },
          });
          expect(await mcpServers.getById(id)).not.toBeNull();

          const previous = internalDb.cleanupStaleDraftsOnStartup;
          (internalDb as any).cleanupStaleDraftsOnStartup = true;
          try {
            await (mcpServers as any).cleanupStaleDrafts();
          } finally {
            (internalDb as any).cleanupStaleDraftsOnStartup = previous;
          }

          expect(await mcpServers.getById(id)).toBeNull();
        });

        it('init() with cleanupStaleDraftsOnStartup leaves published servers and drafts with active versions untouched', async () => {
          const publishedId = `mcp-s-keep-pub-${randomUUID()}`;
          const draftWithVersionId = `mcp-s-keep-draft-${randomUUID()}`;

          await mcpServers.create({ mcpServer: { id: publishedId, name: 'P', version: '1.0.0' } });
          const v1Pub = await mcpServers.getLatestVersion(publishedId);
          await mcpServers.update({
            id: publishedId,
            status: 'published',
            activeVersionId: v1Pub!.id,
          });

          // A draft that DOES have an active version (e.g. mid-edit) must survive.
          await mcpServers.create({
            mcpServer: { id: draftWithVersionId, name: 'D', version: '1.0.0' },
          });
          const v1Draft = await mcpServers.getLatestVersion(draftWithVersionId);
          await mcpServers.update({ id: draftWithVersionId, activeVersionId: v1Draft!.id });

          const internalDb: SpannerDB = (mcpServers as any).db;
          const previous = internalDb.cleanupStaleDraftsOnStartup;
          (internalDb as any).cleanupStaleDraftsOnStartup = true;
          try {
            await (mcpServers as any).cleanupStaleDrafts();
          } finally {
            (internalDb as any).cleanupStaleDraftsOnStartup = previous;
          }

          expect(await mcpServers.getById(publishedId)).not.toBeNull();
          expect(await mcpServers.getById(draftWithVersionId)).not.toBeNull();
        });
      });

      describe('list defaulting to status=published', () => {
        const tag = `mcp-s-pub-${randomUUID()}`;
        beforeAll(async () => {
          await mcpServers.dangerouslyClearAll();
          // 2 drafts (left in initial draft state by create())
          for (const n of ['d1', 'd2']) {
            await mcpServers.create({
              mcpServer: { id: `${tag}-${n}`, name: n, version: '1.0.0', metadata: { tag } },
            });
          }
          // 3 published (created as draft, then promoted to published)
          for (const n of ['p1', 'p2', 'p3']) {
            const id = `${tag}-${n}`;
            await mcpServers.create({
              mcpServer: { id, name: n, version: '1.0.0', metadata: { tag } },
            });
            const latest = await mcpServers.getLatestVersion(id);
            await mcpServers.update({ id, status: 'published', activeVersionId: latest!.id });
          }
        });

        it('omitting status defaults to published (drafts excluded)', async () => {
          const result = await mcpServers.list({ metadata: { tag } });
          expect(result.total).toBe(3);
          expect(result.mcpServers.every(s => s.status === 'published')).toBe(true);
        });

        it('explicit status=draft still works', async () => {
          const result = await mcpServers.list({ status: 'draft', metadata: { tag } });
          expect(result.total).toBe(2);
          expect(result.mcpServers.every(s => s.status === 'draft')).toBe(true);
        });
      });

      describe('unique-version invariant', () => {
        it('rejects a duplicate (mcpServerId, versionNumber) pair', async () => {
          // The unique index on (mcpServerId, versionNumber) is meant to
          // prevent two writes from racing to produce the same version
          // number. Verifying the invariant is in force also confirms
          // SpannerDB.createIndexes propagates unique-index failures
          // instead of silently swallowing them.
          const id = `mcp-s-unique-${randomUUID()}`;
          await mcpServers.create({ mcpServer: { id, name: 'S', version: '0.1.0' } });
          await expect(
            mcpServers.createVersion({
              id: randomUUID(),
              mcpServerId: id,
              versionNumber: 1, // duplicate
              name: 'duplicate v1',
              version: '0.1.0',
            }),
          ).rejects.toThrow();
        });
      });
    });

    // Skills domain
    describe('SkillsSpanner methods', () => {
      beforeAll(async () => {
        await skills.dangerouslyClearAll();
      });

      const baseSnapshot = {
        name: 'method-skill',
        description: 'A skill for tests',
        instructions: 'Do the thing',
      };

      describe('create', () => {
        it('creates the thin record as draft and seeds version 1', async () => {
          const id = `skill-${randomUUID()}`;
          const created = await skills.create({ skill: { id, ...baseSnapshot } });
          expect(created.id).toBe(id);
          expect(created.status).toBe('draft');
          expect(created.activeVersionId == null).toBe(true);
          const resolved = await skills.getByIdResolved(id);
          expect(resolved?.name).toBe('method-skill');
          expect(resolved?.description).toBe('A skill for tests');
          expect(resolved?.instructions).toBe('Do the thing');
          expect(await skills.countVersions(id)).toBe(1);
        });

        it('persists optional snapshot fields', async () => {
          const id = `skill-full-${randomUUID()}`;
          await skills.create({
            skill: {
              id,
              ...baseSnapshot,
              license: 'MIT',
              compatibility: { node: '>=18' },
              source: { type: 'managed', mastraPath: 'skills/example' } as any,
              references: ['ref-a.md', 'ref-b.md'],
              scripts: ['build.sh'],
              assets: ['asset.png'],
              metadata: { team: 'core' },
              tree: { files: [] } as any,
            },
          });
          const v = await skills.getLatestVersion(id);
          expect(v?.license).toBe('MIT');
          expect(v?.compatibility).toEqual({ node: '>=18' });
          expect(v?.source).toEqual({ type: 'managed', mastraPath: 'skills/example' });
          expect(v?.references).toEqual(['ref-a.md', 'ref-b.md']);
          expect(v?.scripts).toEqual(['build.sh']);
          expect(v?.assets).toEqual(['asset.png']);
          expect(v?.metadata).toEqual({ team: 'core' });
          expect(v?.tree).toEqual({ files: [] });
        });

        it('defaults visibility to private for authored skills and persists explicit values', async () => {
          const authored = `skill-vis-${randomUUID()}`;
          await skills.create({ skill: { id: authored, ...baseSnapshot, authorId: 'author-1' } as any });
          expect(((await skills.getById(authored)) as any)?.visibility).toBe('private');

          const pub = `skill-vis-${randomUUID()}`;
          await skills.create({
            skill: { id: pub, ...baseSnapshot, authorId: 'author-1', visibility: 'public' } as any,
          });
          expect(((await skills.getById(pub)) as any)?.visibility).toBe('public');

          // update can change visibility on the thin record.
          await skills.update({ id: pub, visibility: 'private' } as any);
          expect(((await skills.getById(pub)) as any)?.visibility).toBe('private');
        });
      });

      describe('list filters', () => {
        it('filters by status and visibility', async () => {
          const authorId = `author-${randomUUID()}`;
          const draftPrivate = `skill-${randomUUID()}`;
          const publishedPublic = `skill-${randomUUID()}`;
          await skills.create({ skill: { id: draftPrivate, ...baseSnapshot, authorId, visibility: 'private' } as any });
          await skills.create({
            skill: { id: publishedPublic, ...baseSnapshot, authorId, visibility: 'public' } as any,
          });
          await skills.update({ id: publishedPublic, status: 'published' } as any);

          const drafts = await skills.list({ authorId, status: 'draft', perPage: false });
          expect(drafts.skills.map(s => s.id)).toEqual([draftPrivate]);

          const publicOnes = await skills.list({ authorId, visibility: 'public', perPage: false });
          expect(publicOnes.skills.map(s => s.id)).toEqual([publishedPublic]);

          const publishedPublics = await skills.list({
            authorId,
            status: 'published',
            visibility: 'public',
            perPage: false,
          });
          expect(publishedPublics.skills.map(s => s.id)).toEqual([publishedPublic]);
        });
      });

      describe('getById', () => {
        it('returns null for unknown ids', async () => {
          expect(await skills.getById(`missing-${randomUUID()}`)).toBeNull();
        });

        it('returns the thin record (no snapshot fields)', async () => {
          const id = `skill-thin-${randomUUID()}`;
          await skills.create({ skill: { id, ...baseSnapshot } });
          const fetched = (await skills.getById(id)) as any;
          expect(fetched?.id).toBe(id);
          expect(fetched?.name).toBeUndefined();
          expect(fetched?.instructions).toBeUndefined();
        });
      });

      describe('update', () => {
        it('updates activeVersionId, status and authorId', async () => {
          const id = `skill-update-${randomUUID()}`;
          await skills.create({ skill: { id, ...baseSnapshot } });
          const versionId = randomUUID();
          await skills.createVersion({
            id: versionId,
            skillId: id,
            versionNumber: 2,
            name: 'method-skill',
            description: 'Updated',
            instructions: 'Updated',
            changedFields: ['description'],
            changeMessage: 'tweak',
          });

          const updated = await skills.update({
            id,
            status: 'published',
            activeVersionId: versionId,
            authorId: 'author-x',
          });
          expect(updated.status).toBe('published');
          expect(updated.activeVersionId).toBe(versionId);
          expect(updated.authorId).toBe('author-x');

          // Resolved skill should now reflect the active version's content.
          const resolved = await skills.getByIdResolved(id);
          expect(resolved?.description).toBe('Updated');
        });

        it('throws for missing skills', async () => {
          await expect(skills.update({ id: `missing-${randomUUID()}` })).rejects.toThrow(/not found/i);
        });
      });

      describe('delete', () => {
        it('removes the thin record and all versions', async () => {
          const id = `skill-delete-${randomUUID()}`;
          await skills.create({ skill: { id, ...baseSnapshot } });
          await skills.createVersion({
            id: randomUUID(),
            skillId: id,
            versionNumber: 2,
            name: 'method-skill',
            description: 'v2',
            instructions: 'v2',
          });
          expect(await skills.countVersions(id)).toBe(2);
          await skills.delete(id);
          expect(await skills.getById(id)).toBeNull();
          expect(await skills.countVersions(id)).toBe(0);
        });

        it('is a no-op for unknown skills', async () => {
          await expect(skills.delete('non-existent-skill')).resolves.toBeUndefined();
        });
      });

      describe('list', () => {
        const authorA = `author-a-${randomUUID()}`;
        const authorB = `author-b-${randomUUID()}`;

        beforeAll(async () => {
          await skills.dangerouslyClearAll();
          for (let i = 0; i < 4; i++) {
            await skills.create({
              skill: {
                id: `list-skill-${randomUUID()}`,
                ...baseSnapshot,
                authorId: i < 3 ? authorA : authorB,
              },
            });
            await new Promise(r => setTimeout(r, 5));
          }
        });

        it('returns all skills with default pagination', async () => {
          const result = await skills.list();
          expect(result.total).toBe(4);
        });

        it('filters by authorId', async () => {
          const result = await skills.list({ authorId: authorA });
          expect(result.total).toBe(3);
          expect(result.skills.every(s => s.authorId === authorA)).toBe(true);
        });

        it('paginates results', async () => {
          const page0 = await skills.list({ page: 0, perPage: 2 });
          expect(page0.skills.length).toBe(2);
          expect(page0.hasMore).toBe(true);
          const page1 = await skills.list({ page: 1, perPage: 2 });
          expect(page1.skills.length).toBe(2);
          expect(page1.hasMore).toBe(false);
        });

        it('returns all skills when perPage is false', async () => {
          const result = await skills.list({ perPage: false });
          expect(result.skills.length).toBe(4);
          expect(result.perPage).toBe(false);
          expect(result.hasMore).toBe(false);
        });

        it('orders by createdAt DESC by default', async () => {
          const result = await skills.list();
          for (let i = 1; i < result.skills.length; i++) {
            expect(result.skills[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
              result.skills[i]!.createdAt.getTime(),
            );
          }
        });

        it('honors orderBy ASC', async () => {
          const result = await skills.list({ orderBy: { field: 'createdAt', direction: 'ASC' } });
          for (let i = 1; i < result.skills.length; i++) {
            expect(result.skills[i - 1]!.createdAt.getTime()).toBeLessThanOrEqual(
              result.skills[i]!.createdAt.getTime(),
            );
          }
        });

        it('rejects negative page numbers', async () => {
          await expect(skills.list({ page: -1 })).rejects.toThrow(/page must be/i);
        });

        it('ignores the metadata filter (metadata lives on versions, not the entity row)', async () => {
          // The base type accepts a `metadata` filter, but the thin skills
          // table has no metadata column  the adapter should silently drop
          // the filter and return everything.
          const result = await skills.list({ metadata: { whatever: 'value' } });
          expect(result.total).toBe(4);
        });
      });

      describe('Version methods', () => {
        let skillId: string;
        const versionIds: string[] = [];

        beforeAll(async () => {
          skillId = `skill-versions-${randomUUID()}`;
          await skills.create({ skill: { id: skillId, ...baseSnapshot } });
          for (let n = 2; n <= 3; n++) {
            const vid = randomUUID();
            versionIds.push(vid);
            await skills.createVersion({
              id: vid,
              skillId,
              versionNumber: n,
              name: 'method-skill',
              description: `desc v${n}`,
              instructions: `instructions v${n}`,
              changedFields: ['description', 'instructions'],
              changeMessage: `bump v${n}`,
            });
          }
        });

        it('createVersion stores all snapshot fields', async () => {
          const v = await skills.getLatestVersion(skillId);
          expect(v?.versionNumber).toBe(3);
          expect(v?.description).toBe('desc v3');
        });

        it('getVersion returns the matching row', async () => {
          const v = await skills.getVersion(versionIds[0]!);
          expect(v?.id).toBe(versionIds[0]);
          expect(v?.versionNumber).toBe(2);
        });

        it('getVersion returns null for unknown id', async () => {
          expect(await skills.getVersion('no-such-version')).toBeNull();
        });

        it('getVersionByNumber returns the correct version', async () => {
          const v = await skills.getVersionByNumber(skillId, 2);
          expect(v?.versionNumber).toBe(2);
          expect(v?.description).toBe('desc v2');
        });

        it('getVersionByNumber returns null for missing version', async () => {
          expect(await skills.getVersionByNumber(skillId, 99)).toBeNull();
        });

        it('getLatestVersion returns the highest version', async () => {
          const v = await skills.getLatestVersion(skillId);
          expect(v?.versionNumber).toBe(3);
        });

        it('getLatestVersion returns null for unknown skills', async () => {
          expect(await skills.getLatestVersion('no-such-skill')).toBeNull();
        });

        it('countVersions returns the total', async () => {
          expect(await skills.countVersions(skillId)).toBe(3);
        });

        it('countVersions returns 0 for unknown skills', async () => {
          expect(await skills.countVersions('no-such-skill')).toBe(0);
        });

        it('listVersions paginates and orders', async () => {
          const all = await skills.listVersions({ skillId });
          expect(all.total).toBe(3);
          expect(all.versions[0]?.versionNumber).toBe(3); // default DESC

          const page = await skills.listVersions({ skillId, page: 0, perPage: 2 });
          expect(page.versions.length).toBe(2);
          expect(page.hasMore).toBe(true);

          const asc = await skills.listVersions({
            skillId,
            orderBy: { field: 'versionNumber', direction: 'ASC' },
          });
          expect(asc.versions.map((v: { versionNumber: any }) => v.versionNumber)).toEqual([1, 2, 3]);
        });

        it('listVersions returns all when perPage is false', async () => {
          const all = await skills.listVersions({ skillId, perPage: false });
          expect(all.versions.length).toBe(3);
          expect(all.perPage).toBe(false);
          expect(all.hasMore).toBe(false);
        });

        it('listVersions rejects negative page numbers', async () => {
          await expect(skills.listVersions({ skillId, page: -1 })).rejects.toThrow(/page must be/i);
        });

        it('deleteVersion removes a single version', async () => {
          await skills.deleteVersion(versionIds[0]!);
          expect(await skills.getVersion(versionIds[0]!)).toBeNull();
          expect(await skills.countVersions(skillId)).toBe(2);
        });

        it('deleteVersionsByParentId removes all versions for the skill', async () => {
          const tempId = `bulk-skill-${randomUUID()}`;
          await skills.create({ skill: { id: tempId, ...baseSnapshot } });
          await skills.createVersion({
            id: randomUUID(),
            skillId: tempId,
            versionNumber: 2,
            name: 'method-skill',
            description: 'bulk',
            instructions: 'bulk',
          });
          expect(await skills.countVersions(tempId)).toBe(2);
          await skills.deleteVersionsByParentId(tempId);
          expect(await skills.countVersions(tempId)).toBe(0);
        });
      });

      describe('orphan-draft handling', () => {
        it('rolls back the draft thin row when the version insert fails inside the create() transaction', async () => {
          const id = `skill-orphan-${randomUUID()}`;
          const internalDb: SpannerDB = (skills as any).db;
          const originalInsert = internalDb.insert.bind(internalDb);
          const insertSpy = vi.spyOn(internalDb, 'insert').mockImplementation(async (args: any) => {
            if (args?.tableName === 'mastra_skill_versions') {
              throw new Error('simulated version insert failure');
            }
            return originalInsert(args);
          });
          try {
            await expect(skills.create({ skill: { id, ...baseSnapshot } })).rejects.toThrow(
              /simulated version insert failure|CREATE_SKILL/,
            );
          } finally {
            insertSpy.mockRestore();
          }
          expect(await skills.getById(id)).toBeNull();
        });

        it('init() sweeps orphaned draft+activeVersionId=NULL rows when cleanupStaleDraftsOnStartup is enabled', async () => {
          const id = `skill-init-orphan-${randomUUID()}`;
          const internalDb: SpannerDB = (skills as any).db;
          const now = new Date();
          await internalDb.insert({
            tableName: 'mastra_skills' as any,
            record: {
              id,
              status: 'draft',
              activeVersionId: null,
              authorId: null,
              createdAt: now,
              updatedAt: now,
            },
          });
          expect(await skills.getById(id)).not.toBeNull();

          const previous = internalDb.cleanupStaleDraftsOnStartup;
          (internalDb as any).cleanupStaleDraftsOnStartup = true;
          try {
            await (skills as any).cleanupStaleDrafts();
          } finally {
            (internalDb as any).cleanupStaleDraftsOnStartup = previous;
          }

          expect(await skills.getById(id)).toBeNull();
        });

        it('init() with cleanupStaleDraftsOnStartup leaves published skills and drafts with active versions untouched', async () => {
          const publishedId = `skill-keep-pub-${randomUUID()}`;
          const draftWithVersionId = `skill-keep-draft-${randomUUID()}`;

          await skills.create({ skill: { id: publishedId, ...baseSnapshot } });
          const v1Pub = await skills.getLatestVersion(publishedId);
          await skills.update({
            id: publishedId,
            status: 'published',
            activeVersionId: v1Pub!.id,
          });

          // A draft that DOES have an active version (e.g. mid-edit) must survive.
          await skills.create({ skill: { id: draftWithVersionId, ...baseSnapshot } });
          const v1Draft = await skills.getLatestVersion(draftWithVersionId);
          await skills.update({ id: draftWithVersionId, activeVersionId: v1Draft!.id });

          const internalDb: SpannerDB = (skills as any).db;
          const previous = internalDb.cleanupStaleDraftsOnStartup;
          (internalDb as any).cleanupStaleDraftsOnStartup = true;
          try {
            await (skills as any).cleanupStaleDrafts();
          } finally {
            (internalDb as any).cleanupStaleDraftsOnStartup = previous;
          }

          expect(await skills.getById(publishedId)).not.toBeNull();
          expect(await skills.getById(draftWithVersionId)).not.toBeNull();
        });
      });

      describe('unique-version invariant', () => {
        it('rejects a duplicate (skillId, versionNumber) pair', async () => {
          // The unique index on (skillId, versionNumber) is meant to prevent
          // two writes from racing to produce the same version number.
          // Verifying the invariant is in force also confirms that
          // SpannerDB.createIndexes propagates unique-index failures
          // instead of silently swallowing them.
          const id = `skill-unique-${randomUUID()}`;
          await skills.create({ skill: { id, ...baseSnapshot } });
          await expect(
            skills.createVersion({
              id: randomUUID(),
              skillId: id,
              versionNumber: 1, // duplicate of the seed version
              name: 'duplicate v1',
              description: 'dup',
              instructions: 'dup',
            }),
          ).rejects.toThrow();
        });
      });
    });

    // Blobs domain (content-addressable store)
    describe('BlobsSpanner methods', () => {
      // Build a deterministic synthetic hash so tests don't depend on a real
      // SHA-256 implementation.
      const makeHash = (label: string) => `sha256-${label}-${randomUUID()}`;
      const makeEntry = (label = 'blob', overrides: Partial<Parameters<BlobsSpanner['put']>[0]> = {}) => ({
        hash: makeHash(label),
        content: `content for ${label}`,
        size: 14,
        mimeType: 'text/plain',
        createdAt: new Date(),
        ...overrides,
      });

      beforeAll(async () => {
        await blobs.dangerouslyClearAll();
      });

      describe('put', () => {
        it('stores a blob and round-trips it via get', async () => {
          const entry = makeEntry('round-trip');
          await blobs.put(entry);
          const fetched = await blobs.get(entry.hash);
          expect(fetched).toBeDefined();
          expect(fetched?.hash).toBe(entry.hash);
          expect(fetched?.content).toBe(entry.content);
          expect(fetched?.size).toBe(entry.size);
          expect(fetched?.mimeType).toBe(entry.mimeType);
          expect(fetched?.createdAt).toBeInstanceOf(Date);
        });

        it('is idempotent for repeated puts of the same hash', async () => {
          const entry = makeEntry('idempotent');
          await blobs.put(entry);
          // Second put with identical content should be a no-op.
          await expect(blobs.put(entry)).resolves.toBeUndefined();
          // Even a put with the same hash but different content keeps the original.
          await blobs.put({ ...entry, content: 'different content', size: 17 });
          const fetched = await blobs.get(entry.hash);
          expect(fetched?.content).toBe('content for idempotent');
          expect(fetched?.size).toBe(entry.size);
        });

        it('persists null mimeType when omitted', async () => {
          const entry = { ...makeEntry('no-mime'), mimeType: undefined };
          await blobs.put(entry);
          const fetched = await blobs.get(entry.hash);
          expect(fetched?.mimeType).toBeUndefined();
        });

        it('defaults createdAt to now when not provided', async () => {
          const before = Date.now();
          // Bypass the createdAt default in the helper.
          const entry = {
            hash: makeHash('default-time'),
            content: 'x',
            size: 1,
          } as any;
          await blobs.put(entry);
          const fetched = await blobs.get(entry.hash);
          expect(fetched?.createdAt).toBeInstanceOf(Date);
          expect(fetched!.createdAt.getTime()).toBeGreaterThanOrEqual(before);
        });
      });

      describe('get', () => {
        it('returns null for unknown hashes', async () => {
          expect(await blobs.get(`missing-${randomUUID()}`)).toBeNull();
        });
      });

      describe('has', () => {
        it('returns true when the blob exists', async () => {
          const entry = makeEntry('has-true');
          await blobs.put(entry);
          expect(await blobs.has(entry.hash)).toBe(true);
        });

        it('returns false for unknown hashes', async () => {
          expect(await blobs.has(`missing-${randomUUID()}`)).toBe(false);
        });
      });

      describe('delete', () => {
        it('returns true when the blob existed', async () => {
          const entry = makeEntry('delete-existing');
          await blobs.put(entry);
          expect(await blobs.delete(entry.hash)).toBe(true);
          expect(await blobs.has(entry.hash)).toBe(false);
        });

        it('returns false for unknown hashes', async () => {
          expect(await blobs.delete(`missing-${randomUUID()}`)).toBe(false);
        });

        it('is safe to call twice on the same hash', async () => {
          const entry = makeEntry('delete-twice');
          await blobs.put(entry);
          expect(await blobs.delete(entry.hash)).toBe(true);
          expect(await blobs.delete(entry.hash)).toBe(false);
        });
      });

      describe('putMany', () => {
        it('stores all entries atomically', async () => {
          const entries = [makeEntry('many-1'), makeEntry('many-2'), makeEntry('many-3')];
          await blobs.putMany(entries);
          for (const e of entries) {
            expect(await blobs.has(e.hash)).toBe(true);
          }
        });

        it('is a no-op for an empty input', async () => {
          await expect(blobs.putMany([])).resolves.toBeUndefined();
        });

        it('skips duplicates and keeps the original content', async () => {
          const original = makeEntry('dedup');
          await blobs.put(original);
          // putMany with the same hash but different content should be ignored.
          await blobs.putMany([{ ...original, content: 'overwritten', size: 99 }, makeEntry('dedup-new')]);
          const fetched = await blobs.get(original.hash);
          expect(fetched?.content).toBe(original.content);
        });
      });

      describe('getMany', () => {
        it('returns an empty map for empty input', async () => {
          const result = await blobs.getMany([]);
          expect(result.size).toBe(0);
        });

        it('returns only the hashes that exist, omitting unknown ones', async () => {
          const a = makeEntry('many-get-a');
          const b = makeEntry('many-get-b');
          const missing = `missing-${randomUUID()}`;
          await blobs.putMany([a, b]);
          const result = await blobs.getMany([a.hash, b.hash, missing]);
          expect(result.size).toBe(2);
          expect(result.get(a.hash)?.content).toBe(a.content);
          expect(result.get(b.hash)?.content).toBe(b.content);
          expect(result.has(missing)).toBe(false);
        });

        it('handles mixed hits and misses across multiple lookups', async () => {
          const entries = [makeEntry('mix-1'), makeEntry('mix-2'), makeEntry('mix-3')];
          await blobs.putMany(entries);
          const lookups = [entries[0]!.hash, 'unknown-1', entries[2]!.hash, 'unknown-2'];
          const result = await blobs.getMany(lookups);
          expect(result.size).toBe(2);
          expect(result.get(entries[0]!.hash)?.hash).toBe(entries[0]!.hash);
          expect(result.get(entries[2]!.hash)?.hash).toBe(entries[2]!.hash);
        });
      });

      describe('content-addressable semantics', () => {
        it('stores binary-like content accurately (UTF-8 round-trip)', async () => {
          const entry = makeEntry('binary', {
            content: 'こんにちは  𓂀  emoji: 🦀',
            size: 38,
          });
          await blobs.put(entry);
          const fetched = await blobs.get(entry.hash);
          expect(fetched?.content).toBe(entry.content);
        });

        it('preserves reported size even when it differs from string length', async () => {
          // The store treats `size` as user-reported metadata, not derived. A
          // multi-byte string can have size != content.length.
          const entry = makeEntry('size-mismatch', { content: 'abc', size: 4242 });
          await blobs.put(entry);
          const fetched = await blobs.get(entry.hash);
          expect(fetched?.size).toBe(4242);
        });
      });

      describe('dangerouslyClearAll', () => {
        it('removes every blob', async () => {
          await blobs.put(makeEntry('clear-1'));
          await blobs.put(makeEntry('clear-2'));
          await blobs.dangerouslyClearAll();
          // Anything we previously put should be gone.
          expect((await blobs.getMany(['anything'])).size).toBe(0);
        });
      });
    });

    // PromptBlocks domain
    describe('PromptBlocksSpanner methods', () => {
      beforeAll(async () => {
        await promptBlocks.dangerouslyClearAll();
      });

      const baseSnapshot = {
        name: 'method-block',
        description: 'A prompt block for tests',
        content: 'Hello {{name}}!',
      };

      describe('create', () => {
        it('creates the thin record as draft and seeds version 1', async () => {
          const id = `pb-${randomUUID()}`;
          const created = await promptBlocks.create({ promptBlock: { id, ...baseSnapshot } });
          expect(created.id).toBe(id);
          expect(created.status).toBe('draft');
          expect(created.activeVersionId == null).toBe(true);

          const resolved = await promptBlocks.getByIdResolved(id);
          expect(resolved?.name).toBe('method-block');
          expect(resolved?.content).toBe('Hello {{name}}!');
          expect(await promptBlocks.countVersions(id)).toBe(1);
        });

        it('persists optional snapshot fields (rules and requestContextSchema)', async () => {
          const id = `pb-full-${randomUUID()}`;
          const rules = {
            type: 'all',
            children: [{ field: 'env', operator: 'equals', value: 'prod' }],
          } as any;
          const requestContextSchema = {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          };
          await promptBlocks.create({
            promptBlock: {
              id,
              ...baseSnapshot,
              rules,
              requestContextSchema,
              metadata: { team: 'core' },
              authorId: 'me',
            },
          });
          const v = await promptBlocks.getLatestVersion(id);
          expect(v?.rules).toEqual(rules);
          expect(v?.requestContextSchema).toEqual(requestContextSchema);
          const fetched = await promptBlocks.getById(id);
          expect(fetched?.metadata).toEqual({ team: 'core' });
          expect(fetched?.authorId).toBe('me');
        });
      });

      describe('getById', () => {
        it('returns null for unknown ids', async () => {
          expect(await promptBlocks.getById(`missing-${randomUUID()}`)).toBeNull();
        });

        it('returns the thin record (no snapshot fields)', async () => {
          const id = `pb-thin-${randomUUID()}`;
          await promptBlocks.create({ promptBlock: { id, ...baseSnapshot } });
          const fetched = (await promptBlocks.getById(id)) as any;
          expect(fetched?.id).toBe(id);
          expect(fetched?.name).toBeUndefined();
          expect(fetched?.content).toBeUndefined();
        });
      });

      describe('update', () => {
        it('updates activeVersionId, status, authorId, and metadata', async () => {
          const id = `pb-update-${randomUUID()}`;
          await promptBlocks.create({ promptBlock: { id, ...baseSnapshot } });
          const versionId = randomUUID();
          await promptBlocks.createVersion({
            id: versionId,
            blockId: id,
            versionNumber: 2,
            name: 'method-block',
            description: 'updated',
            content: 'Hi {{name}}!',
            changedFields: ['content'],
            changeMessage: 'tweak',
          });

          const updated = await promptBlocks.update({
            id,
            status: 'published',
            activeVersionId: versionId,
            authorId: 'author-x',
            metadata: { tier: 'gold' },
          });
          expect(updated.status).toBe('published');
          expect(updated.activeVersionId).toBe(versionId);
          expect(updated.authorId).toBe('author-x');
          expect(updated.metadata).toEqual({ tier: 'gold' });

          const resolved = await promptBlocks.getByIdResolved(id);
          expect(resolved?.content).toBe('Hi {{name}}!');
        });

        it('throws for missing prompt blocks', async () => {
          await expect(promptBlocks.update({ id: `missing-${randomUUID()}` })).rejects.toThrow(/not found/i);
        });

        it('replaces metadata wholesale (DB adapter semantics)', async () => {
          const id = `pb-meta-${randomUUID()}`;
          await promptBlocks.create({
            promptBlock: { id, ...baseSnapshot, metadata: { keep: true, drop: 'me' } },
          });
          await promptBlocks.update({ id, metadata: { keep: false } });
          const fetched = await promptBlocks.getById(id);
          expect(fetched?.metadata).toEqual({ keep: false });
        });
      });

      describe('delete', () => {
        it('removes the thin record and all versions', async () => {
          const id = `pb-delete-${randomUUID()}`;
          await promptBlocks.create({ promptBlock: { id, ...baseSnapshot } });
          await promptBlocks.createVersion({
            id: randomUUID(),
            blockId: id,
            versionNumber: 2,
            name: 'method-block',
            content: 'v2',
          });
          expect(await promptBlocks.countVersions(id)).toBe(2);
          await promptBlocks.delete(id);
          expect(await promptBlocks.getById(id)).toBeNull();
          expect(await promptBlocks.countVersions(id)).toBe(0);
        });

        it('is a no-op for unknown ids', async () => {
          await expect(promptBlocks.delete('non-existent-pb')).resolves.toBeUndefined();
        });
      });

      describe('list', () => {
        const authorA = `pb-author-a-${randomUUID()}`;
        const authorB = `pb-author-b-${randomUUID()}`;

        beforeAll(async () => {
          await promptBlocks.dangerouslyClearAll();
          for (let i = 0; i < 4; i++) {
            await promptBlocks.create({
              promptBlock: {
                id: `pb-list-${randomUUID()}`,
                ...baseSnapshot,
                authorId: i < 3 ? authorA : authorB,
                metadata: { tier: i % 2 === 0 ? 'gold' : 'silver' },
              },
            });
            await new Promise(r => setTimeout(r, 5));
          }
        });

        it('returns all blocks with default pagination (status=draft)', async () => {
          const result = await promptBlocks.list({ status: 'draft' });
          expect(result.total).toBe(4);
        });

        it('filters by authorId', async () => {
          const result = await promptBlocks.list({ status: 'draft', authorId: authorA });
          expect(result.total).toBe(3);
          expect(result.promptBlocks.every(b => b.authorId === authorA)).toBe(true);
        });

        it('filters by metadata', async () => {
          const result = await promptBlocks.list({ status: 'draft', metadata: { tier: 'gold' } });
          expect(result.total).toBe(2);
          expect(result.promptBlocks.every(b => b.metadata?.tier === 'gold')).toBe(true);
        });

        it('rejects invalid metadata keys', async () => {
          await expect(promptBlocks.list({ status: 'draft', metadata: { 'bad-key!': 'x' } })).rejects.toThrow(
            /Invalid metadata key/i,
          );
        });

        it('paginates results', async () => {
          const page0 = await promptBlocks.list({ status: 'draft', page: 0, perPage: 2 });
          expect(page0.promptBlocks.length).toBe(2);
          expect(page0.hasMore).toBe(true);
          const page1 = await promptBlocks.list({ status: 'draft', page: 1, perPage: 2 });
          expect(page1.promptBlocks.length).toBe(2);
          expect(page1.hasMore).toBe(false);
        });

        it('returns all blocks when perPage is false', async () => {
          const result = await promptBlocks.list({ status: 'draft', perPage: false });
          expect(result.promptBlocks.length).toBe(4);
          expect(result.perPage).toBe(false);
          expect(result.hasMore).toBe(false);
        });

        it('orders by createdAt DESC by default', async () => {
          const result = await promptBlocks.list({ status: 'draft' });
          for (let i = 1; i < result.promptBlocks.length; i++) {
            expect(result.promptBlocks[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
              result.promptBlocks[i]!.createdAt.getTime(),
            );
          }
        });

        it('honors orderBy ASC', async () => {
          const result = await promptBlocks.list({
            status: 'draft',
            orderBy: { field: 'createdAt', direction: 'ASC' },
          });
          for (let i = 1; i < result.promptBlocks.length; i++) {
            expect(result.promptBlocks[i - 1]!.createdAt.getTime()).toBeLessThanOrEqual(
              result.promptBlocks[i]!.createdAt.getTime(),
            );
          }
        });

        it('rejects negative page numbers', async () => {
          await expect(promptBlocks.list({ page: -1 })).rejects.toThrow(/page must be/i);
        });

        it('returns empty result when no blocks match the status filter', async () => {
          const result = await promptBlocks.list({ status: 'archived' });
          expect(result.total).toBe(0);
          expect(result.promptBlocks).toEqual([]);
          expect(result.hasMore).toBe(false);
        });
      });

      describe('Version methods', () => {
        let blockId: string;
        const versionIds: string[] = [];

        beforeAll(async () => {
          blockId = `pb-versions-${randomUUID()}`;
          await promptBlocks.create({ promptBlock: { id: blockId, ...baseSnapshot } });
          for (let n = 2; n <= 3; n++) {
            const vid = randomUUID();
            versionIds.push(vid);
            await promptBlocks.createVersion({
              id: vid,
              blockId,
              versionNumber: n,
              name: 'method-block',
              description: `desc v${n}`,
              content: `content v${n}`,
              changedFields: ['content'],
              changeMessage: `bump v${n}`,
            });
          }
        });

        it('createVersion stores all snapshot fields', async () => {
          const v = await promptBlocks.getLatestVersion(blockId);
          expect(v?.versionNumber).toBe(3);
          expect(v?.content).toBe('content v3');
        });

        it('getVersion returns the matching row', async () => {
          const v = await promptBlocks.getVersion(versionIds[0]!);
          expect(v?.id).toBe(versionIds[0]);
          expect(v?.versionNumber).toBe(2);
        });

        it('getVersion returns null for unknown id', async () => {
          expect(await promptBlocks.getVersion('no-such-version')).toBeNull();
        });

        it('getVersionByNumber returns the correct version', async () => {
          const v = await promptBlocks.getVersionByNumber(blockId, 2);
          expect(v?.versionNumber).toBe(2);
          expect(v?.content).toBe('content v2');
        });

        it('getVersionByNumber returns null for missing version', async () => {
          expect(await promptBlocks.getVersionByNumber(blockId, 99)).toBeNull();
        });

        it('getLatestVersion returns the highest version', async () => {
          const v = await promptBlocks.getLatestVersion(blockId);
          expect(v?.versionNumber).toBe(3);
        });

        it('getLatestVersion returns null for unknown blocks', async () => {
          expect(await promptBlocks.getLatestVersion('no-such-block')).toBeNull();
        });

        it('countVersions returns the total', async () => {
          expect(await promptBlocks.countVersions(blockId)).toBe(3);
        });

        it('countVersions returns 0 for unknown blocks', async () => {
          expect(await promptBlocks.countVersions('no-such-block')).toBe(0);
        });

        it('listVersions paginates and orders', async () => {
          const all = await promptBlocks.listVersions({ blockId });
          expect(all.total).toBe(3);
          expect(all.versions[0]?.versionNumber).toBe(3); // default DESC

          const page = await promptBlocks.listVersions({ blockId, page: 0, perPage: 2 });
          expect(page.versions.length).toBe(2);
          expect(page.hasMore).toBe(true);

          const asc = await promptBlocks.listVersions({
            blockId,
            orderBy: { field: 'versionNumber', direction: 'ASC' },
          });
          expect(asc.versions.map((v: { versionNumber: any }) => v.versionNumber)).toEqual([1, 2, 3]);
        });

        it('listVersions returns all when perPage is false', async () => {
          const all = await promptBlocks.listVersions({ blockId, perPage: false });
          expect(all.versions.length).toBe(3);
          expect(all.perPage).toBe(false);
          expect(all.hasMore).toBe(false);
        });

        it('listVersions rejects negative page numbers', async () => {
          await expect(promptBlocks.listVersions({ blockId, page: -1 })).rejects.toThrow(/page must be/i);
        });

        it('listVersions returns empty when block has no versions', async () => {
          const result = await promptBlocks.listVersions({ blockId: 'unknown-block' });
          expect(result.total).toBe(0);
          expect(result.versions).toEqual([]);
        });

        it('deleteVersion removes a single version', async () => {
          await promptBlocks.deleteVersion(versionIds[0]!);
          expect(await promptBlocks.getVersion(versionIds[0]!)).toBeNull();
          expect(await promptBlocks.countVersions(blockId)).toBe(2);
        });

        it('deleteVersionsByParentId removes all versions for the block', async () => {
          const tempId = `pb-bulk-${randomUUID()}`;
          await promptBlocks.create({ promptBlock: { id: tempId, ...baseSnapshot } });
          await promptBlocks.createVersion({
            id: randomUUID(),
            blockId: tempId,
            versionNumber: 2,
            name: 'method-block',
            content: 'v2',
          });
          expect(await promptBlocks.countVersions(tempId)).toBe(2);
          await promptBlocks.deleteVersionsByParentId(tempId);
          expect(await promptBlocks.countVersions(tempId)).toBe(0);
        });
      });
    });

    // ScorerDefinitions domain
    describe('ScorerDefinitionsSpanner methods', () => {
      beforeAll(async () => {
        await scorerDefinitions.dangerouslyClearAll();
      });

      const llmJudgeSnapshot = {
        name: 'method-judge',
        description: 'A scorer for tests',
        type: 'llm-judge' as const,
        instructions: 'You are a strict judge',
        model: { provider: 'openai', name: 'gpt-4' } as any,
        scoreRange: { min: 0, max: 1 },
      };

      const presetSnapshot = {
        name: 'preset-bias',
        type: 'bias' as const,
        presetConfig: { scale: 5 },
        defaultSampling: { type: 'ratio' as const, rate: 0.5 } as any,
      };

      describe('create', () => {
        it('creates the thin record as draft and seeds version 1 (llm-judge)', async () => {
          const id = `sd-${randomUUID()}`;
          const created = await scorerDefinitions.create({
            scorerDefinition: { id, ...llmJudgeSnapshot },
          });
          expect(created.id).toBe(id);
          expect(created.status).toBe('draft');
          expect(created.activeVersionId == null).toBe(true);

          const resolved = await scorerDefinitions.getByIdResolved(id);
          expect(resolved?.name).toBe('method-judge');
          expect(resolved?.type).toBe('llm-judge');
          expect(resolved?.instructions).toBe('You are a strict judge');
          expect(resolved?.scoreRange).toEqual({ min: 0, max: 1 });
          expect(await scorerDefinitions.countVersions(id)).toBe(1);
        });

        it('persists preset-style snapshot fields', async () => {
          const id = `sd-preset-${randomUUID()}`;
          await scorerDefinitions.create({
            scorerDefinition: {
              id,
              ...presetSnapshot,
              metadata: { team: 'evals' },
              authorId: 'me',
            },
          });
          const v = await scorerDefinitions.getLatestVersion(id);
          expect(v?.type).toBe('bias');
          expect(v?.presetConfig).toEqual({ scale: 5 });
          expect(v?.defaultSampling).toEqual({ type: 'ratio', rate: 0.5 });
          const fetched = await scorerDefinitions.getById(id);
          expect(fetched?.metadata).toEqual({ team: 'evals' });
          expect(fetched?.authorId).toBe('me');
        });
      });

      describe('getById', () => {
        it('returns null for unknown ids', async () => {
          expect(await scorerDefinitions.getById(`missing-${randomUUID()}`)).toBeNull();
        });

        it('returns the thin record (no snapshot fields)', async () => {
          const id = `sd-thin-${randomUUID()}`;
          await scorerDefinitions.create({ scorerDefinition: { id, ...llmJudgeSnapshot } });
          const fetched = (await scorerDefinitions.getById(id)) as any;
          expect(fetched?.id).toBe(id);
          expect(fetched?.name).toBeUndefined();
          expect(fetched?.type).toBeUndefined();
          expect(fetched?.instructions).toBeUndefined();
        });
      });

      describe('update', () => {
        it('updates activeVersionId, status, authorId, and metadata', async () => {
          const id = `sd-update-${randomUUID()}`;
          await scorerDefinitions.create({ scorerDefinition: { id, ...llmJudgeSnapshot } });
          const versionId = randomUUID();
          await scorerDefinitions.createVersion({
            id: versionId,
            scorerDefinitionId: id,
            versionNumber: 2,
            name: 'method-judge',
            type: 'llm-judge',
            instructions: 'updated instructions',
            model: llmJudgeSnapshot.model,
            scoreRange: { min: 0, max: 10 },
            changedFields: ['instructions', 'scoreRange'],
            changeMessage: 'tweak',
          });

          const updated = await scorerDefinitions.update({
            id,
            status: 'published',
            activeVersionId: versionId,
            authorId: 'author-x',
            metadata: { tier: 'gold' },
          });
          expect(updated.status).toBe('published');
          expect(updated.activeVersionId).toBe(versionId);
          expect(updated.authorId).toBe('author-x');
          expect(updated.metadata).toEqual({ tier: 'gold' });

          const resolved = await scorerDefinitions.getByIdResolved(id);
          expect(resolved?.instructions).toBe('updated instructions');
          expect(resolved?.scoreRange).toEqual({ min: 0, max: 10 });
        });

        it('throws for missing scorer definitions', async () => {
          await expect(scorerDefinitions.update({ id: `missing-${randomUUID()}` })).rejects.toThrow(/not found/i);
        });

        it('replaces metadata wholesale (DB adapter semantics)', async () => {
          const id = `sd-meta-${randomUUID()}`;
          await scorerDefinitions.create({
            scorerDefinition: { id, ...llmJudgeSnapshot, metadata: { keep: true, drop: 'me' } },
          });
          await scorerDefinitions.update({ id, metadata: { keep: false } });
          const fetched = await scorerDefinitions.getById(id);
          expect(fetched?.metadata).toEqual({ keep: false });
        });
      });

      describe('delete', () => {
        it('removes the thin record and all versions', async () => {
          const id = `sd-delete-${randomUUID()}`;
          await scorerDefinitions.create({ scorerDefinition: { id, ...llmJudgeSnapshot } });
          await scorerDefinitions.createVersion({
            id: randomUUID(),
            scorerDefinitionId: id,
            versionNumber: 2,
            name: 'method-judge',
            type: 'llm-judge',
          });
          expect(await scorerDefinitions.countVersions(id)).toBe(2);
          await scorerDefinitions.delete(id);
          expect(await scorerDefinitions.getById(id)).toBeNull();
          expect(await scorerDefinitions.countVersions(id)).toBe(0);
        });

        it('is a no-op for unknown ids', async () => {
          await expect(scorerDefinitions.delete('non-existent-sd')).resolves.toBeUndefined();
        });
      });

      describe('list', () => {
        const authorA = `sd-author-a-${randomUUID()}`;
        const authorB = `sd-author-b-${randomUUID()}`;

        beforeAll(async () => {
          await scorerDefinitions.dangerouslyClearAll();
          for (let i = 0; i < 4; i++) {
            await scorerDefinitions.create({
              scorerDefinition: {
                id: `sd-list-${randomUUID()}`,
                ...llmJudgeSnapshot,
                authorId: i < 3 ? authorA : authorB,
                metadata: { tier: i % 2 === 0 ? 'gold' : 'silver' },
              },
            });
            await new Promise(r => setTimeout(r, 5));
          }
        });

        it('returns all definitions with default pagination (status=draft)', async () => {
          const result = await scorerDefinitions.list({ status: 'draft' });
          expect(result.total).toBe(4);
        });

        it('filters by authorId', async () => {
          const result = await scorerDefinitions.list({ status: 'draft', authorId: authorA });
          expect(result.total).toBe(3);
          expect(result.scorerDefinitions.every(s => s.authorId === authorA)).toBe(true);
        });

        it('filters by metadata', async () => {
          const result = await scorerDefinitions.list({ status: 'draft', metadata: { tier: 'gold' } });
          expect(result.total).toBe(2);
          expect(result.scorerDefinitions.every(s => s.metadata?.tier === 'gold')).toBe(true);
        });

        it('rejects invalid metadata keys', async () => {
          await expect(scorerDefinitions.list({ status: 'draft', metadata: { 'bad-key!': 'x' } })).rejects.toThrow(
            /Invalid metadata key/i,
          );
        });

        it('paginates results', async () => {
          const page0 = await scorerDefinitions.list({ status: 'draft', page: 0, perPage: 2 });
          expect(page0.scorerDefinitions.length).toBe(2);
          expect(page0.hasMore).toBe(true);
          const page1 = await scorerDefinitions.list({ status: 'draft', page: 1, perPage: 2 });
          expect(page1.scorerDefinitions.length).toBe(2);
          expect(page1.hasMore).toBe(false);
        });

        it('returns all definitions when perPage is false', async () => {
          const result = await scorerDefinitions.list({ status: 'draft', perPage: false });
          expect(result.scorerDefinitions.length).toBe(4);
          expect(result.perPage).toBe(false);
          expect(result.hasMore).toBe(false);
        });

        it('orders by createdAt DESC by default', async () => {
          const result = await scorerDefinitions.list({ status: 'draft' });
          for (let i = 1; i < result.scorerDefinitions.length; i++) {
            expect(result.scorerDefinitions[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
              result.scorerDefinitions[i]!.createdAt.getTime(),
            );
          }
        });

        it('honors orderBy ASC', async () => {
          const result = await scorerDefinitions.list({
            status: 'draft',
            orderBy: { field: 'createdAt', direction: 'ASC' },
          });
          for (let i = 1; i < result.scorerDefinitions.length; i++) {
            expect(result.scorerDefinitions[i - 1]!.createdAt.getTime()).toBeLessThanOrEqual(
              result.scorerDefinitions[i]!.createdAt.getTime(),
            );
          }
        });

        it('rejects negative page numbers', async () => {
          await expect(scorerDefinitions.list({ page: -1 })).rejects.toThrow(/page must be/i);
        });

        it('returns empty result when no definitions match the status filter', async () => {
          const result = await scorerDefinitions.list({ status: 'archived' });
          expect(result.total).toBe(0);
          expect(result.scorerDefinitions).toEqual([]);
          expect(result.hasMore).toBe(false);
        });
      });

      describe('Version methods', () => {
        let scorerId: string;
        const versionIds: string[] = [];

        beforeAll(async () => {
          scorerId = `sd-versions-${randomUUID()}`;
          await scorerDefinitions.create({ scorerDefinition: { id: scorerId, ...llmJudgeSnapshot } });
          for (let n = 2; n <= 3; n++) {
            const vid = randomUUID();
            versionIds.push(vid);
            await scorerDefinitions.createVersion({
              id: vid,
              scorerDefinitionId: scorerId,
              versionNumber: n,
              name: 'method-judge',
              description: `desc v${n}`,
              type: 'llm-judge',
              instructions: `instructions v${n}`,
              model: llmJudgeSnapshot.model,
              changedFields: ['instructions'],
              changeMessage: `bump v${n}`,
            });
          }
        });

        it('createVersion stores all snapshot fields', async () => {
          const v = await scorerDefinitions.getLatestVersion(scorerId);
          expect(v?.versionNumber).toBe(3);
          expect(v?.instructions).toBe('instructions v3');
        });

        it('getVersion returns the matching row', async () => {
          const v = await scorerDefinitions.getVersion(versionIds[0]!);
          expect(v?.id).toBe(versionIds[0]);
          expect(v?.versionNumber).toBe(2);
        });

        it('getVersion returns null for unknown id', async () => {
          expect(await scorerDefinitions.getVersion('no-such-version')).toBeNull();
        });

        it('getVersionByNumber returns the correct version', async () => {
          const v = await scorerDefinitions.getVersionByNumber(scorerId, 2);
          expect(v?.versionNumber).toBe(2);
          expect(v?.instructions).toBe('instructions v2');
        });

        it('getVersionByNumber returns null for missing version', async () => {
          expect(await scorerDefinitions.getVersionByNumber(scorerId, 99)).toBeNull();
        });

        it('getLatestVersion returns the highest version', async () => {
          const v = await scorerDefinitions.getLatestVersion(scorerId);
          expect(v?.versionNumber).toBe(3);
        });

        it('getLatestVersion returns null for unknown definitions', async () => {
          expect(await scorerDefinitions.getLatestVersion('no-such-scorer')).toBeNull();
        });

        it('countVersions returns the total', async () => {
          expect(await scorerDefinitions.countVersions(scorerId)).toBe(3);
        });

        it('countVersions returns 0 for unknown definitions', async () => {
          expect(await scorerDefinitions.countVersions('no-such-scorer')).toBe(0);
        });

        it('listVersions paginates and orders', async () => {
          const all = await scorerDefinitions.listVersions({ scorerDefinitionId: scorerId });
          expect(all.total).toBe(3);
          expect(all.versions[0]?.versionNumber).toBe(3); // default DESC

          const page = await scorerDefinitions.listVersions({
            scorerDefinitionId: scorerId,
            page: 0,
            perPage: 2,
          });
          expect(page.versions.length).toBe(2);
          expect(page.hasMore).toBe(true);

          const asc = await scorerDefinitions.listVersions({
            scorerDefinitionId: scorerId,
            orderBy: { field: 'versionNumber', direction: 'ASC' },
          });
          expect(asc.versions.map((v: { versionNumber: any }) => v.versionNumber)).toEqual([1, 2, 3]);
        });

        it('listVersions returns all when perPage is false', async () => {
          const all = await scorerDefinitions.listVersions({ scorerDefinitionId: scorerId, perPage: false });
          expect(all.versions.length).toBe(3);
          expect(all.perPage).toBe(false);
          expect(all.hasMore).toBe(false);
        });

        it('listVersions rejects negative page numbers', async () => {
          await expect(scorerDefinitions.listVersions({ scorerDefinitionId: scorerId, page: -1 })).rejects.toThrow(
            /page must be/i,
          );
        });

        it('listVersions returns empty when scorer has no versions', async () => {
          const result = await scorerDefinitions.listVersions({ scorerDefinitionId: 'unknown' });
          expect(result.total).toBe(0);
          expect(result.versions).toEqual([]);
        });

        it('deleteVersion removes a single version', async () => {
          await scorerDefinitions.deleteVersion(versionIds[0]!);
          expect(await scorerDefinitions.getVersion(versionIds[0]!)).toBeNull();
          expect(await scorerDefinitions.countVersions(scorerId)).toBe(2);
        });

        it('deleteVersionsByParentId removes all versions for the scorer', async () => {
          const tempId = `sd-bulk-${randomUUID()}`;
          await scorerDefinitions.create({ scorerDefinition: { id: tempId, ...llmJudgeSnapshot } });
          await scorerDefinitions.createVersion({
            id: randomUUID(),
            scorerDefinitionId: tempId,
            versionNumber: 2,
            name: 'method-judge',
            type: 'llm-judge',
          });
          expect(await scorerDefinitions.countVersions(tempId)).toBe(2);
          await scorerDefinitions.deleteVersionsByParentId(tempId);
          expect(await scorerDefinitions.countVersions(tempId)).toBe(0);
        });
      });

      describe('orphan-draft handling', () => {
        it('rolls back the draft thin row when the version insert fails inside the create() transaction', async () => {
          // create() now writes both the thin row and the seed version inside
          // a single Spanner transaction, so a version-insert failure must
          // roll the thin-row insert back atomically (no orphan left behind).
          // Spy on the underlying SpannerDB.insert and reject when the call
          // targets the versions table  this exercises the second statement
          // of the transactional path. We capture a reference to the original
          // BEFORE installing the spy so the thin-row insert can pass through
          // without recursing back into the spied wrapper.
          const id = `sd-orphan-${randomUUID()}`;
          const internalDb: SpannerDB = (scorerDefinitions as any).db;
          const originalInsert = internalDb.insert.bind(internalDb);
          const insertSpy = vi.spyOn(internalDb, 'insert').mockImplementation(async (args: any) => {
            if (args?.tableName === 'mastra_scorer_definition_versions') {
              throw new Error('simulated version insert failure');
            }
            return originalInsert(args);
          });
          try {
            await expect(scorerDefinitions.create({ scorerDefinition: { id, ...llmJudgeSnapshot } })).rejects.toThrow(
              /simulated version insert failure|CREATE_SCORER_DEFINITION/,
            );
          } finally {
            insertSpy.mockRestore();
          }
          // The transaction rolled back, so the thin row was never committed.
          expect(await scorerDefinitions.getById(id)).toBeNull();
        });

        it('init() sweeps orphaned draft+activeVersionId=NULL rows when cleanupStaleDraftsOnStartup is enabled', async () => {
          const id = `sd-init-orphan-${randomUUID()}`;
          const internalDb: SpannerDB = (scorerDefinitions as any).db;
          const now = new Date();
          await internalDb.insert({
            tableName: 'mastra_scorer_definitions' as any,
            record: {
              id,
              status: 'draft',
              activeVersionId: null,
              authorId: null,
              metadata: null,
              createdAt: now,
              updatedAt: now,
            },
          });
          expect(await scorerDefinitions.getById(id)).not.toBeNull();

          const previous = internalDb.cleanupStaleDraftsOnStartup;
          (internalDb as any).cleanupStaleDraftsOnStartup = true;
          try {
            await (scorerDefinitions as any).cleanupStaleDrafts();
          } finally {
            (internalDb as any).cleanupStaleDraftsOnStartup = previous;
          }

          expect(await scorerDefinitions.getById(id)).toBeNull();
        });

        it('init() with cleanupStaleDraftsOnStartup leaves published definitions and drafts with active versions untouched', async () => {
          const publishedId = `sd-keep-pub-${randomUUID()}`;
          const draftWithVersionId = `sd-keep-draft-${randomUUID()}`;

          await scorerDefinitions.create({
            scorerDefinition: { id: publishedId, ...llmJudgeSnapshot },
          });
          const v1Pub = await scorerDefinitions.getLatestVersion(publishedId);
          await scorerDefinitions.update({
            id: publishedId,
            status: 'published',
            activeVersionId: v1Pub!.id,
          });

          // A draft that DOES have an active version (e.g. mid-edit) must survive.
          await scorerDefinitions.create({
            scorerDefinition: { id: draftWithVersionId, ...llmJudgeSnapshot },
          });
          const v1Draft = await scorerDefinitions.getLatestVersion(draftWithVersionId);
          await scorerDefinitions.update({
            id: draftWithVersionId,
            activeVersionId: v1Draft!.id,
          });

          const internalDb: SpannerDB = (scorerDefinitions as any).db;
          const previous = internalDb.cleanupStaleDraftsOnStartup;
          (internalDb as any).cleanupStaleDraftsOnStartup = true;
          try {
            await (scorerDefinitions as any).cleanupStaleDrafts();
          } finally {
            (internalDb as any).cleanupStaleDraftsOnStartup = previous;
          }

          expect(await scorerDefinitions.getById(publishedId)).not.toBeNull();
          expect(await scorerDefinitions.getById(draftWithVersionId)).not.toBeNull();
        });
      });

      describe('unique-version invariant', () => {
        it('rejects a duplicate (scorerDefinitionId, versionNumber) pair', async () => {
          // The unique index on (scorerDefinitionId, versionNumber) is meant
          // to prevent two writes from racing to produce the same version
          // number. Verifying the invariant is in force also confirms that
          // SpannerDB.createIndexes propagates unique-index failures instead
          // of silently swallowing them.
          const id = `sd-unique-${randomUUID()}`;
          await scorerDefinitions.create({
            scorerDefinition: { id, ...llmJudgeSnapshot },
          });
          await expect(
            scorerDefinitions.createVersion({
              id: randomUUID(),
              scorerDefinitionId: id,
              versionNumber: 1, // duplicate of the seed version
              name: 'duplicate v1',
              type: 'llm-judge',
            }),
          ).rejects.toThrow();
        });
      });
    });

    describe('ScoresSpanner methods', () => {
      // Local score-payload factory: the shared `createSampleScore` helper
      // returns a fully-formed `ScoreRowData`, but `saveScore` takes the
      // pre-persistence `SaveScorePayload` shape (no id/createdAt/updatedAt).
      // Inlining keeps the dependency narrow and avoids reaching into the
      // test-utils package for an internal factory.
      function makeSamplePayload(overrides: Partial<Record<string, any>> = {}): any {
        const scorerId = overrides.scorerId ?? `scorer-${randomUUID()}`;
        return {
          scorerId,
          entityId: overrides.entityId ?? `agent-${randomUUID()}`,
          entityType: overrides.entityType ?? 'AGENT',
          runId: overrides.runId ?? `run-${randomUUID()}`,
          input: overrides.input ?? [{ id: randomUUID(), name: 'in', value: 'sample input' }],
          output: overrides.output ?? { text: 'sample output' },
          score: overrides.score ?? 0.75,
          source: overrides.source ?? 'LIVE',
          scorer: overrides.scorer ?? { id: scorerId, name: 'sample-scorer' },
          entity: overrides.entity ?? { id: overrides.entityId ?? 'agent', name: 'sample entity' },
          metadata: overrides.metadata ?? { tag: 'unit-test' },
          requestContext: overrides.requestContext ?? {},
          additionalContext: overrides.additionalContext,
          preprocessStepResult: overrides.preprocessStepResult,
          analyzeStepResult: overrides.analyzeStepResult,
          reason: overrides.reason ?? 'because',
          traceId: overrides.traceId,
          spanId: overrides.spanId,
        };
      }

      beforeAll(async () => {
        await scores.dangerouslyClearAll();
      });

      describe('saveScore + getScoreById', () => {
        it('persists the score and returns the normalized row', async () => {
          const payload = makeSamplePayload();
          const { score: saved } = await scores.saveScore(payload);

          // Returned record reflects the row that was actually inserted: the
          // ?? defaults are applied (so optional jsonb fields land as null /
          // empty object) and timestamps are populated.
          expect(saved.id).toMatch(/^[0-9a-f-]{36}$/i);
          expect(saved.scorerId).toBe(payload.scorerId);
          expect(saved.entityId).toBe(payload.entityId);
          expect(saved.runId).toBe(payload.runId);
          expect(saved.score).toBe(payload.score);
          expect(saved.scorer).toEqual(payload.scorer);
          expect(saved.entity).toEqual(payload.entity);
          expect(saved.createdAt).toBeInstanceOf(Date);
          expect(saved.updatedAt).toBeInstanceOf(Date);
          expect((saved as any).preprocessStepResult ?? null).toBeNull();
          expect((saved as any).analyzeStepResult ?? null).toBeNull();

          const fetched = await scores.getScoreById({ id: saved.id });
          expect(fetched).not.toBeNull();
          expect(fetched!.id).toBe(saved.id);
          expect(fetched!.score).toBe(payload.score);
          expect(fetched!.entityId).toBe(payload.entityId);
        });

        it('rejects an invalid payload with a typed VALIDATION_FAILED error', async () => {
          await expect(scores.saveScore({ score: 0.5 } as any)).rejects.toMatchObject({
            id: expect.stringMatching(/SAVE_SCORE_VALIDATION_FAILED/),
          });
        });

        it('returns null from getScoreById for an unknown id', async () => {
          const result = await scores.getScoreById({ id: `missing-${randomUUID()}` });
          expect(result).toBeNull();
        });
      });

      describe('listScoresByScorerId', () => {
        const scorerId = `scorer-${randomUUID()}`;
        const otherScorerId = `scorer-${randomUUID()}`;
        const entityId = `agent-${randomUUID()}`;

        beforeAll(async () => {
          // Three scores for `scorerId` (two LIVE + one TEST), one for another scorer.
          await scores.saveScore(makeSamplePayload({ scorerId, source: 'LIVE', entityId }));
          await new Promise(r => setTimeout(r, 5));
          await scores.saveScore(makeSamplePayload({ scorerId, source: 'LIVE', entityId }));
          await new Promise(r => setTimeout(r, 5));
          await scores.saveScore(makeSamplePayload({ scorerId, source: 'TEST', entityId: 'other-entity' }));
          await scores.saveScore(makeSamplePayload({ scorerId: otherScorerId }));
        });

        it('filters strictly by scorerId', async () => {
          const result = await scores.listScoresByScorerId({
            scorerId,
            pagination: { page: 0, perPage: 10 },
          });
          expect(result.pagination.total).toBe(3);
          expect(result.scores.every(s => s.scorerId === scorerId)).toBe(true);
        });

        it('further narrows by source / entityId / entityType when supplied', async () => {
          const liveOnly = await scores.listScoresByScorerId({
            scorerId,
            pagination: { page: 0, perPage: 10 },
            source: 'LIVE',
          });
          expect(liveOnly.pagination.total).toBe(2);
          expect(liveOnly.scores.every(s => s.source === 'LIVE')).toBe(true);

          const byEntity = await scores.listScoresByScorerId({
            scorerId,
            pagination: { page: 0, perPage: 10 },
            entityId,
            entityType: 'AGENT',
          });
          expect(byEntity.pagination.total).toBe(2);
          expect(byEntity.scores.every(s => s.entityId === entityId && s.entityType === 'AGENT')).toBe(true);
        });

        it('honors page/perPage and reports hasMore correctly', async () => {
          const firstPage = await scores.listScoresByScorerId({
            scorerId,
            pagination: { page: 0, perPage: 2 },
          });
          expect(firstPage.scores).toHaveLength(2);
          expect(firstPage.pagination.total).toBe(3);
          expect(firstPage.pagination.hasMore).toBe(true);

          const secondPage = await scores.listScoresByScorerId({
            scorerId,
            pagination: { page: 1, perPage: 2 },
          });
          expect(secondPage.scores).toHaveLength(1);
          expect(secondPage.pagination.hasMore).toBe(false);
        });

        it('returns an empty page (total: 0) for an unknown scorerId', async () => {
          const result = await scores.listScoresByScorerId({
            scorerId: `missing-${randomUUID()}`,
            pagination: { page: 0, perPage: 10 },
          });
          expect(result.pagination.total).toBe(0);
          expect(result.scores).toHaveLength(0);
          expect(result.pagination.hasMore).toBe(false);
        });
      });

      describe('listScoresByRunId', () => {
        const runId = `run-${randomUUID()}`;

        beforeAll(async () => {
          await scores.saveScore(makeSamplePayload({ runId }));
          await scores.saveScore(makeSamplePayload({ runId }));
          // Different runId  must NOT be returned.
          await scores.saveScore(makeSamplePayload({ runId: `run-${randomUUID()}` }));
        });

        it('returns only scores for the requested runId', async () => {
          const result = await scores.listScoresByRunId({
            runId,
            pagination: { page: 0, perPage: 10 },
          });
          expect(result.pagination.total).toBe(2);
          expect(result.scores.every(s => s.runId === runId)).toBe(true);
        });

        it('returns an empty page for an unknown runId', async () => {
          const result = await scores.listScoresByRunId({
            runId: `missing-${randomUUID()}`,
            pagination: { page: 0, perPage: 10 },
          });
          expect(result.pagination.total).toBe(0);
          expect(result.scores).toHaveLength(0);
        });
      });

      describe('listScoresBySpan', () => {
        const traceId = `trace-${randomUUID()}`;
        const spanId = `span-${randomUUID()}`;

        beforeAll(async () => {
          await scores.saveScore(makeSamplePayload({ traceId, spanId }));
          await scores.saveScore(makeSamplePayload({ traceId, spanId }));
          // Same trace, different span  excluded.
          await scores.saveScore(makeSamplePayload({ traceId, spanId: `span-${randomUUID()}` }));
          // Different trace, same span string  excluded.
          await scores.saveScore(makeSamplePayload({ traceId: `trace-${randomUUID()}`, spanId }));
        });

        it('matches on the (traceId, spanId) pair, not either column alone', async () => {
          const result = await scores.listScoresBySpan({
            traceId,
            spanId,
            pagination: { page: 0, perPage: 10 },
          });
          expect(result.pagination.total).toBe(2);
          expect(result.scores.every(s => s.traceId === traceId && s.spanId === spanId)).toBe(true);
        });

        it('returns an empty page when no rows match the pair', async () => {
          const result = await scores.listScoresBySpan({
            traceId: `missing-${randomUUID()}`,
            spanId: `missing-${randomUUID()}`,
            pagination: { page: 0, perPage: 10 },
          });
          expect(result.pagination.total).toBe(0);
          expect(result.scores).toHaveLength(0);
        });
      });
    });

    // Spanner-flavored coverage on top of the shared observability suite that
    // `createTestSuite` already runs. These focus on Spanner-specific
    // round-tripping (JSON columns, timestamps) and the GoogleSQL-rendered
    // filter shapes in listTraces that don't have a one-to-one mapping with
    // the Postgres reference (no JSON containment operator, no partial index).
    describe('ObservabilitySpanner methods', () => {
      const now = () => new Date();

      function makeSpan(overrides: Record<string, any> = {}): any {
        const traceId = overrides.traceId ?? `trace-${randomUUID()}`;
        const spanId = overrides.spanId ?? `span-${randomUUID()}`;
        const start = overrides.startedAt ?? now();
        return {
          traceId,
          spanId,
          parentSpanId: null,
          name: 'Observability Span',
          spanType: 'agent_run',
          entityType: 'agent',
          entityId: 'agent-1',
          entityName: 'Agent One',
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: 'test',
          source: 'local',
          serviceName: 'test-service',
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          requestContext: null,
          isEvent: false,
          startedAt: start,
          endedAt: new Date(start.getTime() + 1000),
          ...overrides,
        };
      }

      beforeAll(async () => {
        await observability.dangerouslyClearAll();
      });
      beforeEach(async () => {
        await observability.dangerouslyClearAll();
      });

      it('round-trips a span with JSON payload and timestamp columns', async () => {
        const span = makeSpan({
          traceId: 't-roundtrip',
          spanId: 's-roundtrip',
          attributes: { model: 'gpt-4', tokens: 42 },
          metadata: { priority: 'high', isTest: true },
          tags: ['important', 'customer'],
          input: { question: 'hello?' },
          output: { answer: 'world' },
        });
        await observability.createSpan({ span });

        const fetched = await observability.getSpan({ traceId: span.traceId, spanId: span.spanId });
        expect(fetched).not.toBeNull();
        expect(fetched!.span.attributes).toEqual({ model: 'gpt-4', tokens: 42 });
        expect(fetched!.span.metadata).toEqual({ priority: 'high', isTest: true });
        expect(fetched!.span.tags).toEqual(['important', 'customer']);
        expect(fetched!.span.input).toEqual({ question: 'hello?' });
        expect(fetched!.span.output).toEqual({ answer: 'world' });
        // Spanner returns PreciseDate; the domain normalises to plain Date so
        // the storage layer can compare instants without leaking precision.
        expect(fetched!.span.startedAt).toBeInstanceOf(Date);
        expect(fetched!.span.endedAt).toBeInstanceOf(Date);
        expect(fetched!.span.createdAt).toBeInstanceOf(Date);
        expect(fetched!.span.updatedAt).toBeInstanceOf(Date);
      });

      it('returns null for missing spans and traces', async () => {
        await expect(observability.getSpan({ traceId: 'missing-trace', spanId: 'missing-span' })).resolves.toBeNull();
        await expect(observability.getRootSpan({ traceId: 'missing-trace' })).resolves.toBeNull();
        await expect(observability.getTrace({ traceId: 'missing-trace' })).resolves.toBeNull();
        await expect(observability.getTraceLight({ traceId: 'missing-trace' })).resolves.toBeNull();
      });

      it('batchCreateSpans persists everything in one transaction', async () => {
        const traceId = 't-batch';
        const base = now();
        const records = [
          makeSpan({ traceId, spanId: 'root', startedAt: base }),
          makeSpan({
            traceId,
            spanId: 'child-a',
            parentSpanId: 'root',
            startedAt: new Date(base.getTime() + 100),
          }),
          makeSpan({
            traceId,
            spanId: 'child-b',
            parentSpanId: 'root',
            startedAt: new Date(base.getTime() + 200),
          }),
        ];
        await observability.batchCreateSpans({ records });

        const trace = await observability.getTrace({ traceId });
        expect(trace?.spans).toHaveLength(3);
        // getTrace orders ASC on startedAt, so root sits first.
        expect(trace!.spans[0]!.spanId).toBe('root');

        const root = await observability.getRootSpan({ traceId });
        expect(root?.span.spanId).toBe('root');
      });

      it('getTraceLight excludes heavy JSON fields', async () => {
        const traceId = 't-light';
        await observability.createSpan({
          span: makeSpan({
            traceId,
            spanId: 'root',
            attributes: { large: 'payload' },
            metadata: { x: 1 },
            tags: ['a', 'b'],
            input: { data: 'big' },
            output: { data: 'big' },
            links: [{ traceId: 'other', spanId: 'other' }],
          }),
        });

        const light = await observability.getTraceLight({ traceId });
        expect(light).not.toBeNull();
        expect(light!.spans).toHaveLength(1);
        const span = light!.spans[0]! as Record<string, any>;
        // The columns the light projection actually selects are present,
        // and the heavy ones are simply absent from the row shape.
        expect(span.spanId).toBe('root');
        expect(span.attributes).toBeUndefined();
        expect(span.metadata).toBeUndefined();
        expect(span.tags).toBeUndefined();
        expect(span.input).toBeUndefined();
        expect(span.output).toBeUndefined();
        expect(span.links).toBeUndefined();
      });

      it('updateSpan refreshes updatedAt and merges partial fields', async () => {
        const span = makeSpan({ traceId: 't-update', spanId: 's-update', output: null });
        await observability.createSpan({ span });
        const before = await observability.getSpan({ traceId: span.traceId, spanId: span.spanId });
        const updatedAtBefore = before!.span.updatedAt as Date;

        // Tiny pause so updatedAt strictly advances even on a fast emulator.
        await new Promise(resolve => setTimeout(resolve, 10));

        await observability.updateSpan({
          traceId: span.traceId,
          spanId: span.spanId,
          updates: { output: { final: 'value' } },
        });

        const after = await observability.getSpan({ traceId: span.traceId, spanId: span.spanId });
        expect(after!.span.output).toEqual({ final: 'value' });
        expect((after!.span.updatedAt as Date).getTime()).toBeGreaterThan(updatedAtBefore.getTime());
      });

      describe('listTraces filtering', () => {
        const baseDate = new Date('2024-01-01T00:00:00Z');

        async function seedTraces() {
          await observability.batchCreateSpans({
            records: [
              // Success / agent_run / production / user-1
              makeSpan({
                traceId: 'trace-1',
                spanId: 'root-1',
                spanType: 'agent_run',
                entityType: 'agent',
                entityId: 'agent-1',
                entityName: 'Agent One',
                environment: 'production',
                userId: 'user-1',
                tags: ['important', 'customer'],
                metadata: { priority: 'high' },
                startedAt: baseDate,
                endedAt: new Date(baseDate.getTime() + 1000),
              }),
              // Error / workflow_run / staging / user-2
              makeSpan({
                traceId: 'trace-2',
                spanId: 'root-2',
                spanType: 'workflow_run',
                entityType: 'workflow_run',
                entityId: 'workflow-1',
                entityName: 'Workflow One',
                environment: 'staging',
                userId: 'user-2',
                error: { message: 'Failed' },
                startedAt: new Date(baseDate.getTime() + 2000),
                endedAt: new Date(baseDate.getTime() + 3000),
              }),
              // Running / agent_run / production / user-1
              makeSpan({
                traceId: 'trace-3',
                spanId: 'root-3',
                spanType: 'agent_run',
                entityType: 'agent',
                entityId: 'agent-2',
                entityName: 'Agent Two',
                environment: 'production',
                userId: 'user-1',
                tags: ['important'],
                startedAt: new Date(baseDate.getTime() + 4000),
                endedAt: null,
              }),
            ],
          });
          // Add a child span with an error under trace-1 to exercise hasChildError.
          await observability.createSpan({
            span: makeSpan({
              traceId: 'trace-1',
              spanId: 'child-1',
              parentSpanId: 'root-1',
              error: { message: 'Child error' },
              startedAt: new Date(baseDate.getTime() + 500),
              endedAt: new Date(baseDate.getTime() + 800),
            }),
          });
        }

        it('returns only root spans paginated by perPage', async () => {
          await seedTraces();
          const page = await observability.listTraces({ pagination: { page: 0, perPage: 10 } });
          expect(page.spans).toHaveLength(3);
          expect(page.spans.every(s => s.parentSpanId == null)).toBe(true);
          expect(page.pagination.total).toBe(3);
          expect(page.pagination.hasMore).toBe(false);
        });

        it('filters by status (success / error / running)', async () => {
          await seedTraces();
          const success = await observability.listTraces({ filters: { status: TraceStatus.SUCCESS } });
          expect(success.spans.map(s => s.traceId)).toEqual(['trace-1']);

          const error = await observability.listTraces({ filters: { status: TraceStatus.ERROR } });
          expect(error.spans.map(s => s.traceId)).toEqual(['trace-2']);

          const running = await observability.listTraces({ filters: { status: TraceStatus.RUNNING } });
          expect(running.spans.map(s => s.traceId)).toEqual(['trace-3']);
        });

        it('filters by entityType / entityId / userId / environment', async () => {
          await seedTraces();

          const byEntityType = await observability.listTraces({ filters: { entityType: 'agent' as any } });
          expect(byEntityType.spans.map(s => s.traceId).sort()).toEqual(['trace-1', 'trace-3']);

          const byEntityId = await observability.listTraces({ filters: { entityId: 'agent-1' } });
          expect(byEntityId.spans.map(s => s.traceId)).toEqual(['trace-1']);

          const byUserId = await observability.listTraces({ filters: { userId: 'user-1' } });
          expect(byUserId.spans.map(s => s.traceId).sort()).toEqual(['trace-1', 'trace-3']);

          const byEnv = await observability.listTraces({ filters: { environment: 'staging' } });
          expect(byEnv.spans.map(s => s.traceId)).toEqual(['trace-2']);
        });

        it('hasChildError = true returns traces with at least one errored span anywhere', async () => {
          await seedTraces();
          const withErrors = await observability.listTraces({ filters: { hasChildError: true } });
          // trace-1 has an error child; trace-2 has an error on the root.
          expect(withErrors.spans.map(s => s.traceId).sort()).toEqual(['trace-1', 'trace-2']);
        });

        it('hasChildError = false excludes traces with errors anywhere in the trace', async () => {
          await seedTraces();
          const cleanOnly = await observability.listTraces({ filters: { hasChildError: false } });
          // trace-1 is excluded because of its child error; trace-2 is excluded
          // because the root itself has an error. Only trace-3 survives the
          // NOT EXISTS subquery.
          expect(cleanOnly.spans.map(s => s.traceId)).toEqual(['trace-3']);
        });

        it('orderBy endedAt DESC puts NULL endedAt (running) on top and the rest by recency', async () => {
          await seedTraces();
          const result = await observability.listTraces({
            orderBy: { field: 'endedAt', direction: 'DESC' },
          });
          // trace-3 has endedAt = NULL; emulated NULLS FIRST keeps it at the
          // top, then trace-2 (later endedAt) before trace-1.
          expect(result.spans.map(s => s.traceId)).toEqual(['trace-3', 'trace-2', 'trace-1']);
        });
      });

      describe('listTraces JSON filtering', () => {
        async function seedJsonTraces() {
          await observability.batchCreateSpans({
            records: [
              makeSpan({
                traceId: 'json-a',
                spanId: 'root',
                scope: { name: 'mastra-core', version: '1.0.0' },
                metadata: { priority: 'high', team: 'platform' },
                tags: ['prod', 'critical'],
              }),
              makeSpan({
                traceId: 'json-b',
                spanId: 'root',
                scope: { name: 'mastra-server', version: '2.0.0' },
                metadata: { priority: 'low', team: 'platform' },
                tags: ['dev'],
              }),
              makeSpan({
                traceId: 'json-c',
                spanId: 'root',
                scope: { name: 'mastra-core', version: '2.0.0' },
                metadata: { priority: 'high' },
                tags: ['prod'],
              }),
              // No JSON payload at all; the filter must skip it.
              makeSpan({ traceId: 'json-empty', spanId: 'root' }),
            ],
          });
        }

        it('filters by a single metadata key (JSON_VALUE equality)', async () => {
          await seedJsonTraces();
          const result = await observability.listTraces({
            filters: { metadata: { priority: 'high' } },
          });
          expect(result.spans.map(s => s.traceId).sort()).toEqual(['json-a', 'json-c']);
        });

        it('treats multiple metadata keys as AND', async () => {
          await seedJsonTraces();
          const result = await observability.listTraces({
            filters: { metadata: { priority: 'high', team: 'platform' } },
          });
          // Only json-a satisfies both keys; json-c is dropped because team is
          // missing, even though priority matches.
          expect(result.spans.map(s => s.traceId)).toEqual(['json-a']);
        });

        it('returns no rows when metadata value does not match', async () => {
          await seedJsonTraces();
          const result = await observability.listTraces({
            filters: { metadata: { priority: 'medium' } },
          });
          expect(result.spans).toHaveLength(0);
        });

        it('filters by a scope key', async () => {
          await seedJsonTraces();
          const result = await observability.listTraces({
            filters: { scope: { name: 'mastra-core' } as any },
          });
          expect(result.spans.map(s => s.traceId).sort()).toEqual(['json-a', 'json-c']);
        });

        it('treats multiple scope keys as AND', async () => {
          await seedJsonTraces();
          const result = await observability.listTraces({
            filters: { scope: { name: 'mastra-core', version: '1.0.0' } as any },
          });
          expect(result.spans.map(s => s.traceId)).toEqual(['json-a']);
        });

        it('filters by a single tag (EXISTS over JSON_QUERY_ARRAY)', async () => {
          await seedJsonTraces();
          const result = await observability.listTraces({
            filters: { tags: ['prod'] },
          });
          expect(result.spans.map(s => s.traceId).sort()).toEqual(['json-a', 'json-c']);
        });

        it('treats multiple tags as AND (every requested tag must be present)', async () => {
          await seedJsonTraces();
          const result = await observability.listTraces({
            filters: { tags: ['prod', 'critical'] },
          });
          // json-c has only 'prod', so it's dropped.
          expect(result.spans.map(s => s.traceId)).toEqual(['json-a']);
        });

        it('returns no rows for a tag that no row carries', async () => {
          await seedJsonTraces();
          const result = await observability.listTraces({
            filters: { tags: ['nonexistent'] },
          });
          expect(result.spans).toHaveLength(0);
        });

        it('combines metadata + tag filters', async () => {
          await seedJsonTraces();
          const result = await observability.listTraces({
            filters: { metadata: { priority: 'high' }, tags: ['critical'] },
          });
          expect(result.spans.map(s => s.traceId)).toEqual(['json-a']);
        });

        it('rejects metadata keys that contain invalid identifiers', async () => {
          await seedJsonTraces();
          await expect(
            observability.listTraces({
              filters: { metadata: { "'; DROP TABLE; --": 'high' } },
            }),
          ).rejects.toMatchObject({
            id: expect.stringMatching(/LIST_TRACES_VALIDATE_FAILED/),
            message: expect.stringContaining('Invalid metadata key'),
          });
        });

        it('rejects scope keys that contain invalid identifiers', async () => {
          await seedJsonTraces();
          await expect(
            observability.listTraces({
              filters: { scope: { 'service.name': 'mastra-core' } as any },
            }),
          ).rejects.toMatchObject({
            id: expect.stringMatching(/LIST_TRACES_VALIDATE_FAILED/),
            message: expect.stringContaining('Invalid scope key'),
          });
        });
      });

      it('batchDeleteTraces removes every span tied to the given trace ids', async () => {
        await observability.batchCreateSpans({
          records: [
            makeSpan({ traceId: 'del-1', spanId: 'root' }),
            makeSpan({ traceId: 'del-1', spanId: 'child', parentSpanId: 'root' }),
            makeSpan({ traceId: 'del-2', spanId: 'root' }),
            makeSpan({ traceId: 'keep', spanId: 'root' }),
          ],
        });

        await observability.batchDeleteTraces({ traceIds: ['del-1', 'del-2'] });

        expect(await observability.getTrace({ traceId: 'del-1' })).toBeNull();
        expect(await observability.getTrace({ traceId: 'del-2' })).toBeNull();
        const kept = await observability.getTrace({ traceId: 'keep' });
        expect(kept?.spans).toHaveLength(1);
      });

      it('batchDeleteTraces is a no-op when the id list is empty', async () => {
        await observability.createSpan({ span: makeSpan({ traceId: 'kept', spanId: 'root' }) });
        await expect(observability.batchDeleteTraces({ traceIds: [] })).resolves.toBeUndefined();
        const kept = await observability.getTrace({ traceId: 'kept' });
        expect(kept?.spans).toHaveLength(1);
      });

      // The MastraStorageExporter reads this getter to pick which write
      // strategy to use. Spanner supports both insert-only and batched
      // updates; the preferred mode is batch-with-updates because in-flight
      // span enrichments (input/output/error) can ride on the trailing
      // updateSpan instead of being lost.
      it('reports its tracingStrategy (preferred = batch-with-updates)', () => {
        expect(observability.tracingStrategy).toEqual({
          preferred: 'batch-with-updates',
          supported: ['batch-with-updates', 'insert-only'],
        });
      });

      // Verifies that a custom index targeting mastra_ai_spans passed via the
      // SpannerStore `indexes` option is actually routed to ObservabilitySpanner
      // and committed against the live database. The composite store filters
      // each index by table name, so an index pointed at a different table
      // must NOT be created by this domain.
      it('createCustomIndexes routes custom indexes by table name', async () => {
        const customIndexName = `mastra_ai_spans_custom_${Math.floor(Date.now() / 1000)}`;
        const unrelatedIndexName = `mastra_threads_custom_${Math.floor(Date.now() / 1000)}`;
        const storeWithCustomIndex = new SpannerStore({
          ...sharedConfig,
          id: 'spanner-obs-custom-idx',
          indexes: [
            { name: customIndexName, table: 'mastra_ai_spans' as any, columns: ['environment'] },
            // Pointed at a different table — observability must skip it.
            { name: unrelatedIndexName, table: 'mastra_threads' as any, columns: ['title'] },
          ],
        });
        await storeWithCustomIndex.init();

        const client = makeClient();
        const probeDb = new SpannerDB({
          database: client.instance(INSTANCE_ID).database(sharedDbId),
        });
        const indexes = await probeDb.listIndexes('mastra_ai_spans');
        expect(indexes.map(i => i.name)).toContain(customIndexName);

        const threadIndexes = await probeDb.listIndexes('mastra_threads');
        // The unrelated index is the responsibility of the memory domain and
        // would only be created if MemorySpanner's filter accepted it (which
        // it does, in this composite). The point of this check is just that
        // observability didn't accidentally create something on a foreign
        // table.
        const customOnAiSpans = indexes.find(i => i.name === customIndexName);
        expect(customOnAiSpans?.table).toBe('mastra_ai_spans');
        // Defensive: confirm the foreign-table index isn't sitting on the
        // ai-spans table either (would indicate the routing filter was off).
        expect(indexes.find(i => i.name === unrelatedIndexName)).toBeUndefined();

        // listIndexes asserts both lookups returned; the threadIndexes call
        // proves the lookup mechanism works on the live DB.
        expect(Array.isArray(threadIndexes)).toBe(true);

        await probeDb.dropIndex(customIndexName);
      });

      // Metrics live in the mastra_ai_metrics table managed entirely by the
      // observability domain (not in @mastra/core's TABLE_SCHEMAS). This
      // block covers the write path, listing, OLAP queries, and discovery.
      describe('metrics', () => {
        const baseDate = new Date('2024-02-01T00:00:00Z');

        function makeMetric(overrides: Record<string, any> = {}): any {
          return {
            metricId: overrides.metricId ?? randomUUID(),
            timestamp: overrides.timestamp ?? baseDate,
            name: overrides.name ?? 'agent.duration_ms',
            value: overrides.value ?? 100,
            traceId: null,
            spanId: null,
            entityType: 'agent',
            entityId: 'agent-1',
            entityName: 'Agent One',
            environment: 'production',
            serviceName: 'api',
            executionSource: 'cloud',
            provider: null,
            model: null,
            estimatedCost: null,
            costUnit: null,
            labels: {},
            tags: null,
            metadata: null,
            scope: null,
            costMetadata: null,
            ...overrides,
          };
        }

        beforeEach(async () => {
          await observability.dangerouslyClearAll();
        });

        async function seedMetrics() {
          await observability.batchCreateMetrics({
            metrics: [
              makeMetric({
                name: 'agent.duration_ms',
                value: 100,
                timestamp: new Date(baseDate.getTime()),
                provider: 'openai',
                model: 'gpt-4',
                estimatedCost: 0.01,
                costUnit: 'usd',
                labels: { env: 'prod', region: 'us' },
                tags: ['critical'],
              }),
              makeMetric({
                name: 'agent.duration_ms',
                value: 200,
                timestamp: new Date(baseDate.getTime() + 60_000),
                provider: 'openai',
                model: 'gpt-4',
                estimatedCost: 0.02,
                costUnit: 'usd',
                labels: { env: 'prod', region: 'us' },
              }),
              makeMetric({
                name: 'agent.duration_ms',
                value: 50,
                timestamp: new Date(baseDate.getTime() + 120_000),
                provider: 'anthropic',
                model: 'claude-3',
                estimatedCost: 0.005,
                costUnit: 'usd',
                labels: { env: 'staging', region: 'us' },
              }),
              makeMetric({
                name: 'agent.tokens',
                value: 1500,
                timestamp: new Date(baseDate.getTime() + 30_000),
                provider: 'openai',
                model: 'gpt-4',
                labels: { env: 'prod' },
              }),
            ],
          });
        }

        it('batchCreateMetrics persists every row and listMetrics returns them', async () => {
          await seedMetrics();
          const result = await observability.listMetrics({ pagination: { page: 0, perPage: 50 } });
          expect(result.pagination.total).toBe(4);
          expect(result.metrics).toHaveLength(4);
          // default order is timestamp DESC, so the newest comes first
          expect(result.metrics[0]!.timestamp.getTime()).toBeGreaterThanOrEqual(
            result.metrics[result.metrics.length - 1]!.timestamp.getTime(),
          );
        });

        it('round-trips JSON columns (labels, tags, costMetadata, metadata, scope)', async () => {
          const id = randomUUID();
          await observability.batchCreateMetrics({
            metrics: [
              makeMetric({
                metricId: id,
                labels: { a: '1', b: '2' },
                tags: ['x', 'y'],
                costMetadata: { tier: 'pro' },
                metadata: { custom: { nested: true } },
                scope: { name: 'mastra-core', version: '1.0.0' },
              }),
            ],
          });
          const result = await observability.listMetrics({
            filters: { name: ['agent.duration_ms'] } as any,
            pagination: { page: 0, perPage: 50 },
          });
          const row = result.metrics.find((m: { metricId: string }) => m.metricId === id)!;
          expect(row.labels).toEqual({ a: '1', b: '2' });
          expect(row.tags).toEqual(['x', 'y']);
          expect(row.costMetadata).toEqual({ tier: 'pro' });
          expect(row.metadata).toEqual({ custom: { nested: true } });
          expect(row.scope).toEqual({ name: 'mastra-core', version: '1.0.0' });
        });

        it('listMetrics filters by name (IN list) and by label equality', async () => {
          await seedMetrics();
          const byName = await observability.listMetrics({
            filters: { name: ['agent.tokens'] } as any,
          });
          expect(byName.pagination.total).toBe(1);
          expect(byName.metrics[0]!.name).toBe('agent.tokens');

          const byLabel = await observability.listMetrics({
            filters: { labels: { region: 'us' } } as any,
          });
          expect(byLabel.pagination.total).toBe(3);

          const byEnvLabel = await observability.listMetrics({
            filters: { labels: { env: 'staging' } } as any,
          });
          expect(byEnvLabel.pagination.total).toBe(1);
          expect(byEnvLabel.metrics[0]!.value).toBe(50);
        });

        it('listMetrics rejects label filter keys with invalid identifiers', async () => {
          await seedMetrics();
          await expect(
            observability.listMetrics({
              filters: { labels: { 'env.name': 'prod' } } as any,
            }),
          ).rejects.toMatchObject({
            id: expect.stringMatching(/METRICS_FILTER_VALIDATE_FAILED/),
            message: expect.stringContaining('Invalid label key'),
          });
        });

        it('listMetrics filters by timestamp range', async () => {
          await seedMetrics();
          const result = await observability.listMetrics({
            filters: {
              timestamp: { start: new Date(baseDate.getTime() + 30_000), end: new Date(baseDate.getTime() + 90_000) },
            } as any,
          });
          // Only the tokens metric (T+30s) and the duration at T+60s fall in [T+30s, T+90s].
          expect(result.pagination.total).toBe(2);
        });

        it('getMetricAggregate: sum / avg / min / max / count over a name', async () => {
          await seedMetrics();
          const sum = await observability.getMetricAggregate({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
          });
          expect(sum.value).toBe(350);

          const avg = await observability.getMetricAggregate({
            name: ['agent.duration_ms'],
            aggregation: 'avg',
          });
          expect(avg.value).toBeCloseTo(116.667, 1);

          const min = await observability.getMetricAggregate({
            name: ['agent.duration_ms'],
            aggregation: 'min',
          });
          expect(min.value).toBe(50);

          const max = await observability.getMetricAggregate({
            name: ['agent.duration_ms'],
            aggregation: 'max',
          });
          expect(max.value).toBe(200);

          const count = await observability.getMetricAggregate({
            name: ['agent.duration_ms'],
            aggregation: 'count',
          });
          expect(count.value).toBe(3);
        });

        it('getMetricAggregate: count_distinct over an allowlisted column', async () => {
          await seedMetrics();
          const result = await observability.getMetricAggregate({
            name: ['agent.duration_ms'],
            aggregation: 'count_distinct',
            distinctColumn: 'model',
          });
          // 2 distinct models: gpt-4 and claude-3
          expect(result.value).toBe(2);
        });

        it('getMetricAggregate: last returns the most recent value', async () => {
          await seedMetrics();
          const result = await observability.getMetricAggregate({
            name: ['agent.duration_ms'],
            aggregation: 'last',
          });
          // newest timestamp for agent.duration_ms is T+120s with value 50
          expect(result.value).toBe(50);
        });

        it('getMetricAggregate: returns cost summary when costUnit is consistent', async () => {
          await seedMetrics();
          const result = await observability.getMetricAggregate({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
          });
          expect(result.estimatedCost).toBeCloseTo(0.035, 5);
          // all duration_ms rows use 'usd'
          expect(result.costUnit).toBe('usd');
        });

        it('getMetricAggregate: returns null costUnit when units are mixed', async () => {
          await observability.batchCreateMetrics({
            metrics: [
              makeMetric({ value: 1, estimatedCost: 0.1, costUnit: 'usd' }),
              makeMetric({ value: 1, estimatedCost: 0.1, costUnit: 'eur' }),
            ],
          });
          const result = await observability.getMetricAggregate({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
          });
          expect(result.costUnit).toBeNull();
          expect(result.estimatedCost).toBeCloseTo(0.2, 5);
        });

        it('getMetricAggregate: previous_period comparison emits changePercent', async () => {
          // Seed two non-overlapping windows of equal width. Using
          // `endExclusive: true` keeps the current window's start boundary
          // out of the shifted previous window so the two don't double-count
          // any rows.
          await observability.batchCreateMetrics({
            metrics: [
              makeMetric({ value: 100, timestamp: new Date(baseDate.getTime()) }),
              makeMetric({ value: 100, timestamp: new Date(baseDate.getTime() + 30_000) }),
              makeMetric({ value: 150, timestamp: new Date(baseDate.getTime() + 60_000) }),
              makeMetric({ value: 150, timestamp: new Date(baseDate.getTime() + 90_000) }),
            ],
          });
          const result = await observability.getMetricAggregate({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
            comparePeriod: 'previous_period',
            filters: {
              timestamp: {
                start: new Date(baseDate.getTime() + 60_000),
                end: new Date(baseDate.getTime() + 120_000),
                endExclusive: true,
              },
            } as any,
          });
          expect(result.value).toBe(300); // current window: T+60s, T+90s
          expect(result.previousValue).toBe(200); // previous window: T+0, T+30s
          // (300 - 200) / 200 * 100 = 50%
          expect(result.changePercent).toBeCloseTo(50, 5);
        });

        it('getMetricBreakdown: groups by a scalar column', async () => {
          await seedMetrics();
          const result = await observability.getMetricBreakdown({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
            groupBy: ['provider'],
          });
          const byProvider = new Map(
            result.groups.map((g: { dimensions: { provider: any }; value: any }) => [g.dimensions.provider, g.value]),
          );
          expect(byProvider.get('openai')).toBe(300);
          expect(byProvider.get('anthropic')).toBe(50);
        });

        it('getMetricBreakdown: groups by a label key', async () => {
          await seedMetrics();
          const result = await observability.getMetricBreakdown({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
            groupBy: ['env'],
          });
          const byEnv = new Map(
            result.groups.map((g: { dimensions: { env: any }; value: any }) => [g.dimensions.env, g.value]),
          );
          expect(byEnv.get('prod')).toBe(300);
          expect(byEnv.get('staging')).toBe(50);
        });

        it('getMetricBreakdown: honors limit + orderDirection', async () => {
          await seedMetrics();
          const top = await observability.getMetricBreakdown({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
            groupBy: ['provider'],
            limit: 1,
            orderDirection: 'DESC',
          });
          expect(top.groups).toHaveLength(1);
          expect(top.groups[0]!.dimensions.provider).toBe('openai');

          const bottom = await observability.getMetricBreakdown({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
            groupBy: ['provider'],
            limit: 1,
            orderDirection: 'ASC',
          });
          expect(bottom.groups).toHaveLength(1);
          expect(bottom.groups[0]!.dimensions.provider).toBe('anthropic');
        });

        it('getMetricTimeSeries: 1-minute buckets', async () => {
          await seedMetrics();
          const result = await observability.getMetricTimeSeries({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
            interval: '1m',
          });
          expect(result.series).toHaveLength(1);
          // 3 distinct minutes for agent.duration_ms (T, T+1m, T+2m)
          expect(result.series[0]!.points).toHaveLength(3);
          const valuesByBucket = new Map(
            result.series[0]!.points.map((p: { timestamp: { toISOString: () => any }; value: any }) => [
              p.timestamp.toISOString(),
              p.value,
            ]),
          );
          expect(valuesByBucket.get(baseDate.toISOString())).toBe(100);
          expect(valuesByBucket.get(new Date(baseDate.getTime() + 60_000).toISOString())).toBe(200);
          expect(valuesByBucket.get(new Date(baseDate.getTime() + 120_000).toISOString())).toBe(50);
        });

        it('getMetricTimeSeries: 5-minute buckets snap rows down to the boundary', async () => {
          // All four duration rows fall inside the same 5-minute bucket
          // (T+0, T+1m, T+2m are all within [T, T+5m)).
          await seedMetrics();
          const result = await observability.getMetricTimeSeries({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
            interval: '5m',
          });
          expect(result.series).toHaveLength(1);
          expect(result.series[0]!.points).toHaveLength(1);
          expect(result.series[0]!.points[0]!.value).toBe(350);
          expect(result.series[0]!.points[0]!.timestamp.toISOString()).toBe(baseDate.toISOString());
        });

        it('getMetricTimeSeries: splits into multiple series when groupBy is provided', async () => {
          await seedMetrics();
          const result = await observability.getMetricTimeSeries({
            name: ['agent.duration_ms'],
            aggregation: 'sum',
            interval: '1h',
            groupBy: ['provider'],
          });
          const seriesByName = new Map(result.series.map((s: { name: any }) => [s.name, s]));
          expect(seriesByName.has('openai')).toBe(true);
          expect(seriesByName.has('anthropic')).toBe(true);
          expect(seriesByName.get('openai')!.points[0]!.value).toBe(300);
          expect(seriesByName.get('anthropic')!.points[0]!.value).toBe(50);
        });

        it('getMetricPercentiles: returns exact PERCENTILE_CONT-style values', async () => {
          // 100 rows with values 1..100 in the same 1-hour bucket. With
          // linear-interpolation percentiles, p50 over [1..100] is 50.5
          // (rank 49.5 between values 50 and 51) and p99 is 99.01
          // (rank 98.01 between values 99 and 100).
          const rows = Array.from({ length: 100 }, (_, i) =>
            makeMetric({
              name: 'agent.tokens',
              value: i + 1,
              timestamp: new Date(baseDate.getTime() + 1000 * (i % 30)),
            }),
          );
          await observability.batchCreateMetrics({ metrics: rows });
          const result = await observability.getMetricPercentiles({
            name: 'agent.tokens',
            percentiles: [0.5, 0.99],
            interval: '1h',
          });
          expect(result.series).toHaveLength(2);
          const p50 = result.series.find((s: { percentile: number }) => s.percentile === 0.5)!;
          expect(p50.points[0]!.value).toBeCloseTo(50.5, 5);
          const p99 = result.series.find((s: { percentile: number }) => s.percentile === 0.99)!;
          expect(p99.points[0]!.value).toBeCloseTo(99.01, 5);
        });

        it('getMetricNames returns distinct metric names with prefix + limit', async () => {
          await seedMetrics();
          const all = await observability.getMetricNames({});
          expect(all.names.sort()).toEqual(['agent.duration_ms', 'agent.tokens']);

          const prefix = await observability.getMetricNames({ prefix: 'agent.tok' });
          expect(prefix.names).toEqual(['agent.tokens']);

          const limited = await observability.getMetricNames({ limit: 1 });
          expect(limited.names).toHaveLength(1);
        });

        it('getMetricLabelKeys returns distinct label keys for a metric', async () => {
          await seedMetrics();
          const result = await observability.getMetricLabelKeys({ metricName: 'agent.duration_ms' });
          expect(result.keys.sort()).toEqual(['env', 'region']);
        });

        it('getMetricLabelValues returns distinct values for a label key', async () => {
          await seedMetrics();
          const result = await observability.getMetricLabelValues({
            metricName: 'agent.duration_ms',
            labelKey: 'env',
          });
          expect(result.values.sort()).toEqual(['prod', 'staging']);
        });

        it('getMetricLabelValues honors prefix + limit', async () => {
          await seedMetrics();
          const result = await observability.getMetricLabelValues({
            metricName: 'agent.duration_ms',
            labelKey: 'env',
            prefix: 'pro',
          });
          expect(result.values).toEqual(['prod']);
        });

        it('getMetricLabelValues rejects label keys with invalid identifiers', async () => {
          await seedMetrics();
          await expect(
            observability.getMetricLabelValues({
              metricName: 'agent.duration_ms',
              labelKey: "'; DROP TABLE; --",
            }),
          ).rejects.toThrow(/Invalid label key/);
        });

        it('getMetricBreakdown rejects label groupBy keys with invalid identifiers', async () => {
          await seedMetrics();
          await expect(
            observability.getMetricBreakdown({
              name: ['agent.duration_ms'],
              aggregation: 'sum',
              groupBy: ['env.name'],
            }),
          ).rejects.toMatchObject({
            id: expect.stringMatching(/METRICS_FILTER_VALIDATE_FAILED/),
            message: expect.stringContaining('Invalid label key'),
          });
        });

        it('dangerouslyClearAll wipes both spans and metrics', async () => {
          await seedMetrics();
          await observability.createSpan({
            span: makeSpan({ traceId: 'span-for-clear', spanId: 'root' }),
          });
          await observability.dangerouslyClearAll();
          const metrics = await observability.listMetrics({});
          expect(metrics.pagination.total).toBe(0);
          const trace = await observability.getTrace({ traceId: 'span-for-clear' });
          expect(trace).toBeNull();
        });

        it('batchCreateMetrics is a no-op when the input list is empty', async () => {
          await expect(observability.batchCreateMetrics({ metrics: [] })).resolves.toBeUndefined();
          const result = await observability.listMetrics({});
          expect(result.pagination.total).toBe(0);
        });

        // Sanity check that mutations-API writes are visible immediately when
        // strong reads are used (the default). The actual perf win of the
        // mutations API is impossible to assert in-process — it's about RPC
        // round-trip count — but we can at least confirm a moderately sized
        // batch persists in a single transaction.
        it('batchCreateMetrics (mutations API) atomically commits a moderate batch', async () => {
          const records = Array.from({ length: 50 }, (_, i) =>
            makeMetric({ name: 'mut.api.smoke', value: i + 1, timestamp: new Date(baseDate.getTime() + i * 1000) }),
          );
          await observability.batchCreateMetrics({ metrics: records });
          const result = await observability.getMetricAggregate({
            name: ['mut.api.smoke'],
            aggregation: 'count',
          });
          expect(result.value).toBe(50);
        });

        // Validates that the dashboardStalenessMs config is wired all the way
        // through: a store configured with bounded staleness must still return
        // recently-written rows (the emulator's read replica delay is zero,
        // so maxStaleness reads should observe everything). The point of the
        // test is to confirm the option doesn't break correctness — a faulty
        // wiring (wrong bounds, wrong unit, etc.) typically surfaces as a
        // gRPC INVALID_ARGUMENT here, not as silent staleness.
        it('dashboardStalenessMs reads still observe writes against the emulator', async () => {
          const staleStore = new SpannerStore({
            ...sharedConfig,
            id: 'spanner-stale-reads',
            dashboardStalenessMs: 10_000,
          });
          await staleStore.init();
          const staleObs = (await staleStore.getStore('observability')) as ObservabilitySpanner;
          await staleObs.dangerouslyClearAll();
          await staleObs.batchCreateMetrics({
            metrics: [
              makeMetric({ name: 'stale.test', value: 42, timestamp: baseDate }),
              makeMetric({ name: 'stale.test', value: 58, timestamp: new Date(baseDate.getTime() + 1000) }),
            ],
          });
          const result = await staleObs.getMetricAggregate({
            name: ['stale.test'],
            aggregation: 'sum',
          });
          expect(result.value).toBe(100);
        });

        describe('metrics disabled by default', () => {
          const disabledDbId = `db-${sharedSuffix}-nometrics`;

          beforeAll(async () => {
            await ensureDatabase(bootstrapClient, disabledDbId);
          });

          it('throws NOT_IMPLEMENTED for every metric method when disableMetrics defaults to true', async () => {
            const defaultStore = new SpannerStore({
              id: 'spanner-default-no-metrics',
              projectId: PROJECT_ID,
              instanceId: INSTANCE_ID,
              databaseId: disabledDbId,
              spannerOptions,
              // No disableMetrics override — exercises the default.
            });
            await defaultStore.init();
            const obs = (await defaultStore.getStore('observability')) as ObservabilitySpanner;

            const expectNotImplemented = (p: Promise<unknown>, idSuffix: string) =>
              expect(p).rejects.toMatchObject({
                id: `OBSERVABILITY_STORAGE_${idSuffix}_NOT_IMPLEMENTED`,
              });

            await expectNotImplemented(obs.batchCreateMetrics({ metrics: [] as any }), 'BATCH_CREATE_METRICS');
            await expectNotImplemented(obs.listMetrics({} as any), 'LIST_METRICS');
            await expectNotImplemented(
              obs.getMetricAggregate({ name: ['x'], aggregation: 'sum' } as any),
              'GET_METRIC_AGGREGATE',
            );
            await expectNotImplemented(
              obs.getMetricBreakdown({ name: ['x'], aggregation: 'sum', groupBy: ['provider'] } as any),
              'GET_METRIC_BREAKDOWN',
            );
            await expectNotImplemented(
              obs.getMetricTimeSeries({ name: ['x'], aggregation: 'sum', interval: '1h' } as any),
              'GET_METRIC_TIME_SERIES',
            );
            await expectNotImplemented(
              obs.getMetricPercentiles({ name: 'x', percentiles: [0.5], interval: '1h' } as any),
              'GET_METRIC_PERCENTILES',
            );
            await expectNotImplemented(obs.getMetricNames({}), 'GET_METRIC_NAMES');
            await expectNotImplemented(obs.getMetricLabelKeys({ metricName: 'x' }), 'GET_METRIC_LABEL_KEYS');
            await expectNotImplemented(
              obs.getMetricLabelValues({ metricName: 'x', labelKey: 'env' }),
              'GET_METRIC_LABEL_VALUES',
            );
          });

          it('does not create the metrics table when disableMetrics defaults to true', async () => {
            const defaultStore = new SpannerStore({
              id: 'spanner-default-no-metrics-table',
              projectId: PROJECT_ID,
              instanceId: INSTANCE_ID,
              databaseId: disabledDbId,
              spannerOptions,
            });
            await defaultStore.init();
            const [rows] = await defaultStore.database.run({
              sql: `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = '' AND TABLE_NAME = 'mastra_ai_metrics'`,
              json: true,
            });
            const cnt = Number((rows as Array<{ cnt: number | string }>)[0]?.cnt ?? 0);
            expect(cnt).toBe(0);
          });
        });
      });
    });
  });

  // Light Spanner-specific smoke tests beyond the shared suite.
  describe('SpannerStore Spanner-specific behavior', () => {
    it('should expose the underlying database handle', () => {
      const store = new SpannerStore({
        id: 'spanner-handle-test',
        projectId: PROJECT_ID,
        instanceId: INSTANCE_ID,
        databaseId: validateDbId,
        spannerOptions,
      });
      expect(store.database).toBeDefined();
      expect(typeof (store.database as any).run).toBe('function');
    });

    it('should accept a pre-configured Database handle', async () => {
      const client = makeClient();
      const database = client.instance(INSTANCE_ID).database(validateDbId);
      const store = new SpannerStore({ id: 'spanner-prebuilt', database });
      expect(store.database).toBe(database);
    });
  });

  describe('SpannerDB low-level behavior', () => {
    function makeDb(): SpannerDB {
      const client = makeClient();
      const database = client.instance(INSTANCE_ID).database(directDbId);
      return new SpannerDB({ database });
    }

    describe('load', () => {
      it('throws an explicit user error when keys is empty', async () => {
        const db = makeDb();
        await expect(db.load({ tableName: TABLE_AGENTS, keys: {} })).rejects.toMatchObject({
          message: expect.stringMatching(/Cannot load without keys/i),
          id: expect.stringMatching(/EMPTY_KEYS/),
        });
      });

      it('throws an explicit user error when keys is missing', async () => {
        const db = makeDb();
        await expect(db.load({ tableName: TABLE_AGENTS, keys: undefined as any })).rejects.toMatchObject({
          message: expect.stringMatching(/Cannot load without keys/i),
          id: expect.stringMatching(/EMPTY_KEYS/),
        });
      });

      it('emits a json type hint when filtering by a jsonb column', async () => {
        const db = makeDb();
        const runSpy = vi.spyOn(db.database, 'run').mockImplementation((async () => [[]]) as any);
        try {
          await db.load({
            tableName: TABLE_AGENTS,
            keys: { metadata: { foo: 'bar' } },
          });
          const call = runSpy.mock.calls[0]?.[0] as { types?: Record<string, string> };
          expect(call?.types?.p0).toBe('json');
        } finally {
          runSpy.mockRestore();
        }
      });
    });

    describe('batchDelete', () => {
      it('emits a json type hint when keying by a jsonb column', async () => {
        const db = makeDb();
        const captured: Array<{ sql: string; params: any; types?: Record<string, string> }> = [];
        const fakeTx = {
          runUpdate: async (req: any) => {
            captured.push(req);
            return [0];
          },
          commit: async () => {},
        };
        const runTxSpy = vi
          .spyOn(db.database, 'runTransactionAsync')
          .mockImplementation((async (fn: any) => fn(fakeTx as any)) as any);
        try {
          await db.batchDelete({
            tableName: TABLE_AGENTS,
            keys: [{ metadata: { foo: 'bar' } }],
          });
          expect(captured[0]?.types?.p0).toBe('json');
        } finally {
          runTxSpy.mockRestore();
        }
      });
    });

    describe('prepareWhereClause', () => {
      it('emits a json type hint for jsonb columns with non-null values', () => {
        const db = makeDb();
        const { types } = db.prepareWhereClause({ metadata: { foo: 'bar' } }, TABLE_AGENTS);
        expect(types.w0).toBe('json');
      });

      it('still emits string type for plain text columns with non-null values', () => {
        const db = makeDb();
        const { types } = db.prepareWhereClause({ id: 'agent-123' }, TABLE_AGENTS);
        expect(types.w0).toBeUndefined();
      });

      it('renders null values as IS NULL without binding a parameter', () => {
        const db = makeDb();
        const { sql, types } = db.prepareWhereClause({ metadata: null }, TABLE_AGENTS);
        expect(sql).toMatch(/IS NULL/);
        expect(Object.keys(types)).toHaveLength(0);
      });
    });

    // The validate-mode column-shape comparison is the gate that catches schema
    // drift in externally-managed databases. Tests stub `database.run` so we
    // can drive INFORMATION_SCHEMA responses deterministically and exercise the
    // happy path + every failure flavour without touching real DDL.
    describe('validateTableSchema', () => {
      type ColumnRow = { COLUMN_NAME: string; SPANNER_TYPE: string; IS_NULLABLE: string };

      function withMockedColumns(
        db: SpannerDB,
        rows: ColumnRow[],
      ): { run: ReturnType<typeof vi.spyOn>; restore: () => void } {
        const run = vi.spyOn(db.database, 'run').mockImplementation((async () => [rows]) as any);
        return { run, restore: () => run.mockRestore() };
      }

      it('returns silently when every column matches type and nullability', async () => {
        const db = makeDb();
        const { restore } = withMockedColumns(db, [
          { COLUMN_NAME: 'id', SPANNER_TYPE: 'STRING(MAX)', IS_NULLABLE: 'NO' },
          { COLUMN_NAME: 'metadata', SPANNER_TYPE: 'JSON', IS_NULLABLE: 'YES' },
        ]);
        try {
          await expect(
            (db as any).validateTableSchema(TABLE_AGENTS, {
              id: { type: 'text' },
              metadata: { type: 'jsonb', nullable: true },
            }),
          ).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });

      it('flags missing columns by name in the error details', async () => {
        const db = makeDb();
        const { restore } = withMockedColumns(db, [
          { COLUMN_NAME: 'id', SPANNER_TYPE: 'STRING(MAX)', IS_NULLABLE: 'NO' },
        ]);
        try {
          await expect(
            (db as any).validateTableSchema(TABLE_AGENTS, {
              id: { type: 'text' },
              metadata: { type: 'jsonb', nullable: true },
              authorId: { type: 'text', nullable: true },
            }),
          ).rejects.toMatchObject({
            id: expect.stringMatching(/CREATE_TABLE_VALIDATE_FAILED/),
            message: expect.stringContaining('missing columns: metadata, authorId'),
            details: expect.objectContaining({ missing: 'metadata,authorId' }),
          });
        } finally {
          restore();
        }
      });

      it('flags type mismatches against the canonical Spanner type', async () => {
        const db = makeDb();
        // Live schema has metadata as STRING(MAX) instead of JSON.
        const { restore } = withMockedColumns(db, [
          { COLUMN_NAME: 'id', SPANNER_TYPE: 'STRING(MAX)', IS_NULLABLE: 'NO' },
          { COLUMN_NAME: 'metadata', SPANNER_TYPE: 'STRING(MAX)', IS_NULLABLE: 'YES' },
        ]);
        try {
          await expect(
            (db as any).validateTableSchema(TABLE_AGENTS, {
              id: { type: 'text' },
              metadata: { type: 'jsonb', nullable: true },
            }),
          ).rejects.toMatchObject({
            id: expect.stringMatching(/CREATE_TABLE_VALIDATE_FAILED/),
            message: expect.stringContaining('type mismatch: metadata'),
            details: expect.objectContaining({
              wrongType: expect.stringContaining('metadata'),
            }),
          });
        } finally {
          restore();
        }
      });

      it('flags nullability mismatches and treats `nullable` undefined as NOT NULL', async () => {
        const db = makeDb();
        // Schema declares `id` with no `nullable` key, so it should be NOT NULL,
        // but the live column is NULLABLE.
        const { restore } = withMockedColumns(db, [
          { COLUMN_NAME: 'id', SPANNER_TYPE: 'STRING(MAX)', IS_NULLABLE: 'YES' },
        ]);
        try {
          await expect(
            (db as any).validateTableSchema(TABLE_AGENTS, {
              id: { type: 'text' },
            }),
          ).rejects.toMatchObject({
            id: expect.stringMatching(/CREATE_TABLE_VALIDATE_FAILED/),
            message: expect.stringContaining('nullability mismatch: id'),
            details: expect.objectContaining({
              wrongNullability: expect.stringContaining('id (expected NOT NULL, actual NULLABLE)'),
            }),
          });
        } finally {
          restore();
        }
      });

      it('aggregates all three failure categories in a single error', async () => {
        const db = makeDb();
        const { restore } = withMockedColumns(db, [
          // wrong type
          { COLUMN_NAME: 'metadata', SPANNER_TYPE: 'STRING(MAX)', IS_NULLABLE: 'YES' },
          // wrong nullability  schema says default NOT NULL, live says NULLABLE
          { COLUMN_NAME: 'id', SPANNER_TYPE: 'STRING(MAX)', IS_NULLABLE: 'YES' },
          // `authorId` is missing entirely
        ]);
        try {
          await expect(
            (db as any).validateTableSchema(TABLE_AGENTS, {
              id: { type: 'text' },
              metadata: { type: 'jsonb', nullable: true },
              authorId: { type: 'text', nullable: true },
            }),
          ).rejects.toMatchObject({
            id: expect.stringMatching(/CREATE_TABLE_VALIDATE_FAILED/),
            message: expect.stringMatching(
              /missing columns: authorId.*type mismatch: metadata.*nullability mismatch: id/s,
            ),
          });
        } finally {
          restore();
        }
      });

      it('passes when the live column is NOT NULL and the schema marks it NOT NULL implicitly', async () => {
        const db = makeDb();
        const { restore } = withMockedColumns(db, [
          { COLUMN_NAME: 'id', SPANNER_TYPE: 'STRING(MAX)', IS_NULLABLE: 'NO' },
        ]);
        try {
          await expect(
            (db as any).validateTableSchema(TABLE_AGENTS, { id: { type: 'text' } }),
          ).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });
    });
  });

  // Verify initMode='validate' lets Mastra act as a schema VERIFIER (rather
  // than a schema OWNER) when another process  Terraform, Liquibase, etc.
  // controls the DDL. Sync init must populate everything; validate init must
  // never issue DDL and must surface a typed user error if anything is missing.
  describe("initMode='validate' end-to-end", () => {
    // The "ready" path reuses sharedDbId, which is fully populated by the
    // createTestSuite registered earlier in this file. No additional seed is
    // required: vitest runs tests within a single file in registration order,
    // so by the time these blocks execute, sharedDbId already has every
    // table, column, and default index from a prior `storage.init()` call.

    describe("SpannerStore initMode='validate'", () => {
      it('throws on a fresh database where no tables exist', async () => {
        const store = new SpannerStore({
          id: 'spanner-validate-empty',
          projectId: PROJECT_ID,
          instanceId: INSTANCE_ID,
          databaseId: validateModeEmptyDbId,
          spannerOptions,
          initMode: 'validate',
        });
        await expect(store.init()).rejects.toMatchObject({
          id: expect.stringMatching(/VALIDATE_FAILED/),
          message: expect.stringMatching(/does not exist/i),
        });
      });

      it('succeeds when the schema is fully populated (post sync init)', async () => {
        const store = new SpannerStore({
          id: 'spanner-validate-ready',
          projectId: PROJECT_ID,
          instanceId: INSTANCE_ID,
          databaseId: sharedDbId,
          spannerOptions,
          initMode: 'validate',
        });
        await expect(store.init()).resolves.toBeUndefined();
      });

      it('reports the missing index name when an expected default index is dropped', async () => {
        // Drop one default index from the seed DB, then run validate to confirm
        // the error pinpoints the missing index rather than swallowing it.
        const client = makeClient();
        const database = client.instance(INSTANCE_ID).database(sharedDbId);
        const probe = new SpannerDB({ database });
        const droppedIndex = 'mastra_workflow_snapshot_runid_idx';
        await probe.dropIndex(droppedIndex);
        try {
          const validateStore = new SpannerStore({
            id: 'spanner-validate-missing-index',
            projectId: PROJECT_ID,
            instanceId: INSTANCE_ID,
            databaseId: sharedDbId,
            spannerOptions,
            initMode: 'validate',
          });
          await expect(validateStore.init()).rejects.toMatchObject({
            id: expect.stringMatching(/INDEX_CREATE.*VALIDATE_FAILED/),
            message: expect.stringContaining(droppedIndex),
          });
        } finally {
          // Re-create the index so subsequent describe blocks aren't broken.
          const restorer = new SpannerDB({ database });
          await restorer.createIndex({
            name: droppedIndex,
            table: 'mastra_workflow_snapshot' as any,
            columns: ['run_id'],
          });
        }
      });
    });

    // Per-domain coverage: every domain class must (a) refuse to come up against
    // an empty database in validate mode, and (b) come up cleanly against the
    // pre-populated database. The factory list is the source of truth  adding
    // a new domain to this list is the cue that all of init() must be safe to
    // run repeatedly in validate mode.
    describe("Per-domain initMode='validate'", () => {
      type DomainFactory = (database: ReturnType<Spanner['instance']>['database']) => { init: () => Promise<void> };
      const domainFactories: Array<{ name: string; create: DomainFactory }> = [
        {
          name: 'MemorySpanner',
          create: database => new MemorySpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'WorkflowsSpanner',
          create: database => new WorkflowsSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'ScoresSpanner',
          create: database => new ScoresSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'BackgroundTasksSpanner',
          create: database => new BackgroundTasksSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'AgentsSpanner',
          create: database => new AgentsSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'MCPClientsSpanner',
          create: database => new MCPClientsSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'MCPServersSpanner',
          create: database => new MCPServersSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'SkillsSpanner',
          create: database => new SkillsSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'BlobsSpanner',
          create: database => new BlobsSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'PromptBlocksSpanner',
          create: database => new PromptBlocksSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'ScorerDefinitionsSpanner',
          create: database => new ScorerDefinitionsSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'ObservabilitySpanner',
          create: database =>
            new ObservabilitySpanner({ database: database as any, initMode: 'validate', disableMetrics: false }),
        },
        {
          name: 'ChannelsSpanner',
          create: database => new ChannelsSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'DatasetsSpanner',
          create: database => new DatasetsSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'ExperimentsSpanner',
          create: database => new ExperimentsSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'FavoritesSpanner',
          create: database => new FavoritesSpanner({ database: database as any, initMode: 'validate' }),
        },
        {
          name: 'WorkspacesSpanner',
          create: database => new WorkspacesSpanner({ database: database as any, initMode: 'validate' }),
        },
      ];

      for (const { name, create } of domainFactories) {
        describe(name, () => {
          it('throws when its tables do not exist', async () => {
            const client = makeClient();
            const database = client.instance(INSTANCE_ID).database(validateModeEmptyDbId);
            const domain = create(database as any);
            await expect(domain.init()).rejects.toMatchObject({
              id: expect.stringMatching(/VALIDATE_FAILED/),
            });
          });

          it('succeeds when its tables and indexes exist', async () => {
            const client = makeClient();
            const database = client.instance(INSTANCE_ID).database(sharedDbId);
            const domain = create(database as any);
            await expect(domain.init()).resolves.toBeUndefined();
          });
        });
      }
    });
  }); // end "initMode='validate' end-to-end"
} else {
  describe('SpannerStore', () => {
    it('should be defined', () => {
      expect(SpannerStore).toBeDefined();
    });
  });
}

describe('Spanner metrics unit behavior', () => {
  function fakeOperation() {
    return { promise: vi.fn(async () => undefined) };
  }

  it('declares covering STORING columns on metric aggregate indexes', () => {
    const indexes = defaultMetricIndexDefs();
    expect(indexes.find(index => index.name === 'mastra_ai_metrics_name_ts_idx')?.storing).toEqual(
      expect.arrayContaining(['value', 'estimatedCost', 'costUnit', 'provider', 'model']),
    );
    expect(indexes.find(index => index.name === 'mastra_ai_metrics_provider_model_ts_idx')?.storing).toEqual(
      expect.arrayContaining(['name', 'value', 'estimatedCost', 'costUnit']),
    );
  });

  it('renders metric index DDL with STORING columns', async () => {
    const updateSchema = vi.fn(async (statements: string[]) => [fakeOperation(), statements]);
    const database = {
      run: vi.fn(async ({ sql }: { sql: string }) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[]];
        if (sql.includes('INFORMATION_SCHEMA.INDEXES')) return [[]];
        throw new Error(`Unexpected query: ${sql}`);
      }),
      updateSchema,
    };

    await ensureMetricsTable(database as any, { initMode: 'sync' });

    const statements = updateSchema.mock.calls[0]?.[0] as string[];
    expect(statements.some(statement => /CREATE TABLE `mastra_ai_metrics`/.test(statement))).toBe(true);
    expect(
      statements.some(
        statement =>
          statement.includes('CREATE INDEX `mastra_ai_metrics_name_ts_idx`') &&
          statement.includes('STORING (`value`, `estimatedCost`, `costUnit`'),
      ),
    ).toBe(true);
    expect(
      statements.some(
        statement =>
          statement.includes('CREATE INDEX `mastra_ai_metrics_provider_model_ts_idx`') &&
          statement.includes('STORING (`name`, `value`, `estimatedCost`, `costUnit`)'),
      ),
    ).toBe(true);
  });

  it('validate mode rejects metric indexes that are missing STORING columns', async () => {
    const database = {
      run: vi.fn(async ({ sql }: { sql: string }) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[{ found: 1 }]];
        if (sql.includes('INFORMATION_SCHEMA.INDEXES')) return [[{ found: 1 }]];
        if (sql.includes('INFORMATION_SCHEMA.INDEX_COLUMNS')) {
          return [
            [
              { COLUMN_NAME: 'name', COLUMN_ORDERING: 'ASC' },
              { COLUMN_NAME: 'timestamp', COLUMN_ORDERING: 'DESC' },
            ],
          ];
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
    };

    await expect(ensureMetricsTable(database as any, { initMode: 'validate' })).rejects.toMatchObject({
      id: expect.stringMatching(/METRICS_INDEX_CREATE.*VALIDATE_FAILED/),
      message: expect.stringContaining('STORING column list mismatch'),
      details: expect.objectContaining({
        expectedStoringColumns: expect.stringContaining('value'),
      }),
    });
  });

  it('listMetrics rejects unsafe label filter keys before querying Spanner', async () => {
    const database = { run: vi.fn() };

    await expect(
      listMetrics(
        database as any,
        {
          filters: { labels: { 'env.name': 'prod' } },
        } as any,
      ),
    ).rejects.toMatchObject({
      id: expect.stringMatching(/METRICS_FILTER_VALIDATE_FAILED/),
      message: expect.stringContaining('Invalid label key'),
    });
    expect(database.run).not.toHaveBeenCalled();
  });

  it('passes dashboardStalenessMs to metrics reads as maxStaleness', async () => {
    const run = vi.fn(async () => [[{ value: 3, estimatedCost: null, costUnit: null }]]);
    const observability = new ObservabilitySpanner({
      database: { run } as any,
      disableMetrics: false,
      dashboardStalenessMs: 1234,
    });

    await expect(
      observability.getMetricAggregate({
        name: ['agent.duration_ms'],
        aggregation: 'sum',
      }),
    ).resolves.toMatchObject({ value: 3 });

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('SELECT SUM(value) AS value'),
      }),
      { maxStaleness: 1234 },
    );
  });

  it('listTraces rejects unsafe metadata and scope filter keys before querying Spanner', async () => {
    const run = vi.fn();
    const observability = new ObservabilitySpanner({ database: { run } as any });

    await expect(
      observability.listTraces({
        filters: { metadata: { 'service.name': 'api' } },
      } as any),
    ).rejects.toMatchObject({
      id: expect.stringMatching(/LIST_TRACES_VALIDATE_FAILED/),
      message: expect.stringContaining('Invalid metadata key'),
    });
    await expect(
      observability.listTraces({
        filters: { scope: { 'service.name': 'api' } },
      } as any),
    ).rejects.toMatchObject({
      id: expect.stringMatching(/LIST_TRACES_VALIDATE_FAILED/),
      message: expect.stringContaining('Invalid scope key'),
    });
    expect(run).not.toHaveBeenCalled();
  });
});

// Configuration validation tests run unconditionally; they don't touch the network.
createConfigValidationTests({
  storeName: 'SpannerStore',
  createStore: config => new SpannerStore(config as any),
  validConfigs: [
    {
      description: 'projectId/instanceId/databaseId config',
      config: {
        id: 'test-store',
        projectId: 'p',
        instanceId: 'i',
        databaseId: 'd',
        spannerOptions,
      },
    },
    {
      description: 'config with disableInit',
      config: {
        id: 'test-store',
        projectId: 'p',
        instanceId: 'i',
        databaseId: 'd',
        disableInit: true,
        spannerOptions,
      },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty projectId',
      config: { id: 'test-store', projectId: '', instanceId: 'i', databaseId: 'd' },
      expectedError: /projectId must be provided/i,
    },
    {
      description: 'empty instanceId',
      config: { id: 'test-store', projectId: 'p', instanceId: '', databaseId: 'd' },
      expectedError: /instanceId must be provided/i,
    },
    {
      description: 'empty databaseId',
      config: { id: 'test-store', projectId: 'p', instanceId: 'i', databaseId: '' },
      expectedError: /databaseId must be provided/i,
    },
    {
      description: 'empty id',
      config: { id: '', projectId: 'p', instanceId: 'i', databaseId: 'd' },
      expectedError: /id must be provided/i,
    },
  ],
  usesMastraError: true,
});
