import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CompositeFilesystem, LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Workspace and local libSQL compatibility', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'organization-intelligence-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads distinct mounted records and rejects source writes', async () => {
    const policies = join(directory, 'policies');
    const processes = join(directory, 'processes');
    await Promise.all([mkdir(policies), mkdir(processes)]);
    await Promise.all([
      writeFile(join(policies, 'guide.md'), 'Policy: retain invoices for seven years.'),
      writeFile(join(processes, 'guide.md'), 'Process: request archival access from records staff.'),
    ]);
    const filesystem = new CompositeFilesystem({
      mounts: {
        '/policies': new LocalFilesystem({ basePath: policies, readOnly: true }),
        '/processes': new LocalFilesystem({ basePath: processes, readOnly: true }),
      },
    });

    try {
      await filesystem.init();
      expect(String(await filesystem.readFile('/policies/guide.md'))).toContain('seven years');
      expect(String(await filesystem.readFile('/processes/guide.md'))).toContain('records staff');
      await expect(filesystem.writeFile('/policies/guide.md', 'unauthorized replacement')).rejects.toThrow();
      expect(await readFile(join(policies, 'guide.md'), 'utf8')).toBe('Policy: retain invoices for seven years.');
    } finally {
      await filesystem.destroy();
    }
  });

  it('combines Workspace keyword search with a persisted local vector index', async () => {
    const vector = new LibSQLVector({
      id: 'compatibility-vectors',
      url: pathToFileURL(join(directory, 'vectors.db')).href,
    });
    // Controlled embeddings establish adapter compatibility without external providers.
    const embedder = async (text: string) => (text.includes('invoice') ? [1, 0, 0] : [0, 1, 0]);
    const workspace = new Workspace({
      id: 'compatibility-workspace',
      filesystem: new LocalFilesystem({ basePath: directory, readOnly: true }),
      bm25: true,
      vectorStore: vector,
      embedder,
      searchIndexName: 'institutional_records',
    });

    try {
      await workspace.init();
      await workspace.index('/policies/invoices.md', 'Retain invoice records for seven years.', {
        metadata: { sourceId: 'policies' },
      });
      await workspace.index('/processes/archive.md', 'Archival access requires records staff approval.', {
        metadata: { sourceId: 'processes' },
      });
      const results = await workspace.search('invoice', { mode: 'hybrid', topK: 6 });
      const invoice = results.find(result => result.id === '/policies/invoices.md');
      expect(invoice?.content).toContain('seven years');
      expect(invoice?.metadata?.sourceId).toBe('policies');
      expect(invoice?.scoreDetails?.bm25).toBeGreaterThan(0);
      expect(invoice?.scoreDetails?.vector).toBeGreaterThan(0);
    } finally {
      await workspace.destroy();
      await vector.close();
    }

    const reopened = new LibSQLVector({
      id: 'reopened-vectors',
      url: pathToFileURL(join(directory, 'vectors.db')).href,
    });
    try {
      const results = await reopened.query({ indexName: 'institutional_records', queryVector: [1, 0, 0], topK: 6 });
      expect(results.some(result => result.metadata?.sourceId === 'policies')).toBe(true);
      await reopened.deleteIndex({ indexName: 'institutional_records' });
      expect(await reopened.listIndexes()).not.toContain('institutional_records');
    } finally {
      await reopened.close();
    }
  });

  it('persists a schedule across storage reopen and claims one due occurrence', async () => {
    const url = pathToFileURL(join(directory, 'schedules.db')).href;
    const storage = new LibSQLStore({ id: 'compatibility-storage', url });
    const now = Date.UTC(2026, 0, 1);

    try {
      await storage.init();
      const schedules = await storage.getStore('schedules');
      if (!schedules) throw new Error('The selected adapter must provide schedule storage.');
      await schedules.createSchedule({
        id: 'refresh-sources',
        target: { type: 'workflow', workflowId: 'refresh-sources' },
        cron: '*/5 * * * *',
        timezone: 'UTC',
        status: 'active',
        nextFireAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } finally {
      await storage.close();
    }

    const reopened = new LibSQLStore({ id: 'reopened-storage', url });
    try {
      await reopened.init();
      const schedules = await reopened.getStore('schedules');
      if (!schedules) throw new Error('Schedule storage must remain available after reopen.');
      expect((await schedules.listDueSchedules(now)).map(schedule => schedule.id)).toEqual(['refresh-sources']);
      expect(await schedules.updateScheduleNextFire('refresh-sources', now, now + 300000, now, 'run-1')).toBe(true);
      expect(await schedules.updateScheduleNextFire('refresh-sources', now, now + 300000, now, 'run-2')).toBe(false);
      expect(await schedules.listDueSchedules(now)).toEqual([]);
      expect(await schedules.listSchedules()).toHaveLength(1);
    } finally {
      await reopened.close();
    }
  });
});
