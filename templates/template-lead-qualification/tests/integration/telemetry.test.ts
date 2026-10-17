import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { SpanType } from '@mastra/core/observability';
import { DuckDBStore } from '@mastra/duckdb';
import { describe, expect, it, vi } from 'vitest';
import { event, harness } from '../support/application';

describe('persistent telemetry', () => {
  it('filters_private_content_and_keeps_operational_state_separate', async () => {
    const app = await harness();
    const runId = randomUUID();
    const secret = 'private-contact@example.com token=example-private-secret prompt-content';
    try {
      const instance = app.telemetry.observability.getDefaultInstance()!;
      const span = instance.startSpan({
        type: SpanType.GENERIC,
        name: secret,
        input: { body: secret },
        metadata: { runId, authorization: secret, privatePrompt: secret },
        requestContext: new RequestContext([['contact', secret]]),
      });
      span.error({ error: new Error(secret), endSpan: true });
      const response = await app.post(event('telemetry-email', { email: 'private-contact@example.com' }));
      expect(response.status).toBe(202);
      const accepted = await response.json();
      app.dispatcher.start();
      await vi.waitFor(async () => expect((await app.store.get(accepted.runId))?.status).toBe('intake_received'));
      await app.telemetry.observability.flush();
      const traces = await app.duckdb.observability.listTraces({ pagination: { page: 0, perPage: 100 } });
      const logs = await app.duckdb.observability.listLogs({ pagination: { page: 0, perPage: 100 } });
      const metrics = await app.duckdb.observability.listMetrics({ pagination: { page: 0, perPage: 100 } });
      expect(JSON.stringify(traces)).toContain(runId);
      expect(JSON.stringify(traces)).not.toContain(secret);
      expect(JSON.stringify(traces)).not.toContain('private-contact');
      expect(JSON.stringify(logs)).toContain('intake.dispatched');
      expect(JSON.stringify(logs)).not.toContain('private-contact');
      expect(JSON.stringify(metrics)).not.toContain('private-contact');
      const fresh = createClient({ url: pathToFileURL(join(app.directory, 'application.db')).href });
      try {
        const operational = await fresh.execute('SELECT event_json FROM lead_runs');
        expect(z.string().parse(operational.rows[0]!.event_json)).toContain('private-contact@example.com');
        const names = await fresh.execute(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('mastra_spans','mastra_logs','mastra_metrics')",
        );
        for (const row of names.rows) {
          const name = z.string().parse(row.name);
          const counts = await fresh.execute(`SELECT count(*) AS count FROM ${name}`);
          expect(counts.rows[0]!.count).toBe(0);
        }
      } finally {
        fresh.close();
      }
      await app.close(false);
      const reopened = new DuckDBStore({ path: join(app.directory, 'observability.duckdb') });
      try {
        await reopened.init();
        expect(JSON.stringify(await reopened.observability.listLogs({}))).toContain('intake.dispatched');
        expect(
          JSON.stringify(await reopened.observability.listTraces({ pagination: { page: 0, perPage: 100 } })),
        ).toContain(runId);
      } finally {
        await reopened.close();
      }
    } finally {
      await app.close();
    }
  });

  it('keeps_accepted_work_when_telemetry_fails', async () => {
    const app = await harness();
    try {
      const failure = vi.spyOn(app.telemetry.exporter, 'onLogEvent').mockRejectedValue(new Error('private-error'));
      const response = await app.post(event('telemetry-down'));
      expect(response.status).toBe(202);
      const accepted = await response.json();
      app.dispatcher.start();
      await vi.waitFor(async () => expect((await app.store.get(accepted.runId))?.status).toBe('intake_received'));
      expect((await (await app.http.request(accepted.statusUrl)).json()).telemetryDegraded).toBe(true);
      expect((await app.store.client.execute('SELECT count(*) AS count FROM lead_runs')).rows[0]!.count).toBe(1);
      failure.mockRestore();
    } finally {
      await app.close();
    }
  });
});
