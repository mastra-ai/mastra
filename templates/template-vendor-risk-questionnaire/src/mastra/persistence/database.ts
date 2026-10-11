import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { LibSQLStore } from '@mastra/libsql';

export const runtimeRoot = resolve(process.cwd(), '.runtime');
export const databaseUrl = `file:${resolve(runtimeRoot, 'vrq.db')}`;
export const storage = new LibSQLStore({ id: 'vendor-risk-local', url: databaseUrl });
export async function openDatabase(url: string) {
  if (url === databaseUrl) await mkdir(runtimeRoot, { recursive: true });
  const client = createClient({ url });
  await client.batch(
    [
      'CREATE TABLE IF NOT EXISTS vrq_sources (digest TEXT PRIMARY KEY, source_id TEXT NOT NULL, original_name TEXT NOT NULL, size_bytes INTEGER NOT NULL, bytes BLOB NOT NULL)',
      'CREATE TABLE IF NOT EXISTS vrq_intakes (run_id TEXT PRIMARY KEY, digest TEXT NOT NULL, canonical_json TEXT NOT NULL, mapping_json TEXT NOT NULL, source_digest TEXT NOT NULL, created_at TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS vrq_evidence_snapshots (run_id TEXT PRIMARY KEY, digest TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL)',
    ],
    'write',
  );
  return client;
}
