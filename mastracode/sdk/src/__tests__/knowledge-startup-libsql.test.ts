import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMastraCode } from '../index.js';

vi.setConfig({ testTimeout: 60_000 });

const publishedKnowledgeV1Schema = readFileSync(
  new URL('../../../../stores/libsql/src/storage/domains/knowledge/fixtures/published-1.21.1.sql', import.meta.url),
  'utf8',
);

const directories: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** A database written by a published v1 release that holds Knowledge rows. */
function createV1Database({ customIndex = false } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'mastracode-knowledge-v1-'));
  directories.push(directory);
  const databasePath = path.join(directory, 'mastra.db');
  const database = new DatabaseSync(databasePath);
  database.exec(publishedKnowledgeV1Schema);
  database
    .prepare(
      'INSERT INTO mastra_knowledge_nodes (id, type, name, canonicalName, scope, scopeKey, version, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      'v1-node',
      'entity',
      'Atlas',
      'atlas',
      '["local"]',
      'local',
      1,
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    );
  // A host-added index makes the layout one Mastra did not publish, so Knowledge must not replace it.
  if (customIndex) database.exec('CREATE INDEX custom_knowledge_index ON mastra_knowledge_nodes (name)');
  database.close();
  return { directory, databasePath };
}

function countV1Nodes(databasePath: string) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database.prepare('SELECT count(*) AS count FROM mastra_knowledge_nodes').get();
  } finally {
    database.close();
  }
}

function knowledgeSchemaVersion(databasePath: string) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database.prepare("SELECT schemaVersion FROM mastra_knowledge_access_state WHERE id = 'knowledge'").get();
  } finally {
    database.close();
  }
}

function hasTable(databasePath: string, name: string) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;
  } finally {
    database.close();
  }
}

async function start(directory: string, databasePath: string, knowledge?: true) {
  return createMastraCode({
    knowledge,
    cwd: directory,
    homeDir: directory,
    configDir: '.mastracode-test',
    settingsPath: path.join(directory, 'settings.json'),
    storage: new LibSQLStore({ id: 'knowledge-startup', url: `file:${databasePath}` }),
    storageBackend: 'libsql',
    disableMcp: true,
    disableHooks: true,
    disableEnvFile: true,
    disablePlugins: true,
    disableGithubSignals: true,
    createInitialThread: false,
  });
}

describe('createMastraCode on a database with v1 Knowledge rows', () => {
  it('starts without touching Knowledge when Knowledge is off', async () => {
    const { directory, databasePath } = createV1Database();

    const code = await start(directory, databasePath);

    expect(code.knowledge).toBeUndefined();
    expect(code.knowledgeInspector).toBeUndefined();
    expect(code.knowledgeInspectorUnavailableReason).toContain('/settings');
    expect(countV1Nodes(databasePath)).toEqual({ count: 1 });
  });

  it('starts, keeps the v1 rows, and explains the reset when Knowledge is on', async () => {
    const { directory, databasePath } = createV1Database();

    const code = await start(directory, databasePath, true);

    expect(code.knowledge).toBeDefined();
    expect(code.knowledgeInspector).toBeUndefined();
    expect(code.knowledgeInspectorUnavailableReason).toContain('Knowledge schema reset required');
    expect(code.knowledgeInspectorUnavailableReason).toContain('dangerouslyReset()');
    expect(countV1Nodes(databasePath)).toEqual({ count: 1 });
  });

  it('opens Knowledge on schema 4 after the host calls dangerouslyReset()', async () => {
    const { directory, databasePath } = createV1Database({ customIndex: true });
    const storage = new LibSQLStore({ id: 'knowledge-reset', url: `file:${databasePath}` });
    await storage.init();
    await storage.stores?.knowledge?.dangerouslyReset();

    const code = await start(directory, databasePath, true);

    expect(code.knowledge).toBeDefined();
    expect(code.knowledgeInspector).toBeDefined();
    expect(code.knowledgeInspectorUnavailableReason).toBeUndefined();
    expect(knowledgeSchemaVersion(databasePath)).toEqual({ schemaVersion: 4 });
    expect(hasTable(databasePath, 'mastra_knowledge_nodes')).toBe(false);
  });
});
