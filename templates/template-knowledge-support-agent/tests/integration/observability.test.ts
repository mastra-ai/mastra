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

test('Knowledge tools persist matching trace and metric outcomes without payloads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'support-aborted-tool-'));
  const cleanups: Array<() => void | Promise<void>> = [() => rm(directory, { recursive: true, force: true })];
  const errors: unknown[] = [];
  try {
    const url = pathToFileURL(join(directory, 'observability.db')).href;
    const storage = new LibSQLStore({ id: 'aborted-tool', url });
    cleanups.unshift(() => storage.close());
    const client = createClient({ url });
    cleanups.unshift(() => client.close());
    const mastra = new Mastra({ storage, observability, logger: false });
    const instance = mastra.observability?.getDefaultInstance();
    assert.ok(instance);
    cleanups.unshift(() => instance.shutdown());
    instance.startSpan({ name: 'knowledge_list', type: SpanType.TOOL_CALL }).end({ outcome: 'abort' });
    instance
      .startSpan({ name: 'knowledge_read', type: SpanType.TOOL_CALL })
      .end({ outcome: 'success', attributes: { success: true }, output: { error: 'PRIVATE_READ_ERROR' } });
    const reviewedWindow = { lines: '1│<!-- knowledge-review:PRIVATE_READ_MARKER -->', range: { start: { col: 0 } } };
    instance.startSpan({ name: 'knowledge_read', type: SpanType.TOOL_CALL }).end({
      outcome: 'success',
      attributes: { success: true },
      output: { page: { body: 'PRIVATE_READ_BODY', matches: [reviewedWindow, reviewedWindow] } },
    });
    await instance.flush();
    const { rows } = await client.execute(`
      SELECT name, outcome, json(error) AS error, json(output) AS output,
             json(attributes) AS attributes, json(metadata) AS metadata,
             json_extract(attributes, '$.success') AS success,
             json_extract(metadata, '$.labels.operation') AS operation,
             json_extract(metadata, '$.labels.status') AS status,
             json_extract(metadata, '$.value') AS value,
             json_type(metadata, '$.value') AS valueType
      FROM mastra_ai_spans
      WHERE name IN ('knowledge-list', 'knowledge-read')
        OR json_extract(metadata, '$.labels.operation') IN ('knowledge-list', 'knowledge-read', 'resolution-reuse')
      ORDER BY name, status
    `);
    assert.ok(rows.some(row => row.name === 'knowledge-list' && row.outcome === 'abort' && !row.error));
    const reads = rows.filter(row => row.name === 'knowledge-read');
    assert.equal(reads.length, 2);
    const failed = reads.find(row => row.outcome === 'error');
    const succeeded = reads.find(row => row.outcome === 'success');
    assert.match(String(failed?.error), /Operation failed/u);
    assert.equal(failed?.success, 0);
    assert.equal(succeeded?.error, null);
    assert.equal(succeeded?.success, 1);
    assert.ok(reads.every(row => row.output === null));
    assert.doesNotMatch(JSON.stringify(rows), /PRIVATE_READ_/u);
    assert.deepEqual(
      rows
        .filter(row => row.operation === 'knowledge-read' && row.name === 'support_operation_count')
        .map(row => row.status),
      ['error', 'success'],
    );
    assert.deepEqual(
      rows.filter(row => row.operation === 'resolution-reuse').map(row => row.value),
      [1],
    );
    const metrics = rows.filter(row => row.operation === 'knowledge-list');
    assert.deepEqual(
      metrics.map(row => [row.name, row.status]),
      [
        ['support_operation_count', 'abort'],
        ['support_operation_duration_ms', 'abort'],
      ],
    );
    assert.ok(metrics.every(row => row.valueType === 'integer' || row.valueType === 'real'));
    assert.equal(metrics[0]?.value, 1);
    const duration = metrics[1]?.value;
    assert.ok(typeof duration === 'number' && Number.isFinite(duration) && duration >= 0);
  } catch (error) {
    errors.push(error);
  } finally {
    for (const cleanup of cleanups) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, 'Observability verification or cleanup failed', { cause: errors[0] });
});
