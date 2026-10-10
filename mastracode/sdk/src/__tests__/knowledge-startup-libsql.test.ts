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
    return database.prepare("SELECT schemaVersion FROM mastra_knowledge_access_state WHERE id = 'global'").get();
  } finally {
    database.close();
  }
}

async function start(directory: string, databasePath: string) {
  return createMastraCode({
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
    vi.stubEnv('MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS', '');
    const { directory, databasePath } = createV1Database();

    const code = await start(directory, databasePath);

    expect(code.knowledge).toBeUndefined();
    expect(code.knowledgeInspector).toBeUndefined();
    expect(code.knowledgeInspectorUnavailableReason).toContain('MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS=1');
    expect(countV1Nodes(databasePath)).toEqual({ count: 1 });
  });

  it('replaces the v1 tables and opens Knowledge when Knowledge is on', async () => {
    vi.stubEnv('MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS', '1');
    const { directory, databasePath } = createV1Database();

    const code = await start(directory, databasePath);

    expect(code.knowledge).toBeDefined();
    expect(code.knowledgeInspector).toBeDefined();
    expect(code.knowledgeInspectorUnavailableReason).toBeUndefined();
    expect(countV1Nodes(databasePath)).toEqual({ count: 0 });
    expect(knowledgeSchemaVersion(databasePath)).toEqual({ schemaVersion: 2 });
  });

  it('starts and explains the reset when the Knowledge layout is not one Mastra published', async () => {
    vi.stubEnv('MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS', '1');
    const { directory, databasePath } = createV1Database({ customIndex: true });

    const code = await start(directory, databasePath);

    expect(code.knowledge).toBeDefined();
    expect(code.knowledgeInspector).toBeUndefined();
    expect(code.knowledgeInspectorUnavailableReason).toContain('Knowledge schema reset required');
    expect(code.knowledgeInspectorUnavailableReason).toContain('dangerouslyReset()');
    expect(countV1Nodes(databasePath)).toEqual({ count: 1 });
  });
});
