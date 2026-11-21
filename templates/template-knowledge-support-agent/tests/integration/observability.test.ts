import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { LibSQLStore } from '@mastra/libsql';
import { observability } from '../../src/mastra/observability.ts';

test('aborted Knowledge tools persist aborted metrics', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'support-aborted-tool-'));
  const url = pathToFileURL(join(directory, 'observability.db')).href;
  const storage = new LibSQLStore({ id: 'aborted-tool', url });
  const mastra = new Mastra({ storage, observability, logger: false });
  const instance = mastra.observability?.getDefaultInstance();
  const client = createClient({ url });
  try {
    assert.ok(instance);
    instance.startSpan({ name: 'knowledge_list', type: SpanType.TOOL_CALL }).end({ outcome: 'abort' });
    await instance.flush();
    const { rows } = await client.execute(`
      SELECT name, outcome, error, json_extract(metadata, '$.labels.status') AS status
      FROM mastra_ai_spans
      WHERE name = 'knowledge-list' OR json_extract(metadata, '$.labels.operation') = 'knowledge-list'
      ORDER BY name
    `);
    assert.ok(rows.some(row => row.name === 'knowledge-list' && row.outcome === 'abort' && !row.error));
    assert.deepEqual(
      rows.filter(row => row.status !== null).map(row => [row.name, row.status]),
      [
        ['support_operation_count', 'abort'],
        ['support_operation_duration_ms', 'abort'],
      ],
    );
  } finally {
    await instance?.shutdown();
    client.close();
    await storage.close();
    await rm(directory, { recursive: true, force: true });
  }
});
