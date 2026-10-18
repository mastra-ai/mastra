import { z } from 'zod';
import { createClient } from '@libsql/client';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { intakeConfig } from '../../src/mastra/config/lead-ingestion';
import { event, harness, productionToken } from '../support/application';
import type { DestinationState, OutputProvider } from '../../src/mastra/providers/output';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
});

describe('durable intake', () => {
  it('accepts_supported_lead_identifiers', async () => {
    const destinations = new Map<string, DestinationState>();
    const output: OutputProvider = {
      id: 'local-review',
      read: async target => destinations.get(target.reference) ?? { fields: { stage: 'Triage' }, marker: null },
      apply: async (target, operationId, patch) => {
        destinations.set(target.reference, { fields: { ...patch }, marker: operationId });
      },
    };
    const app = await harness({
      config: { ...intakeConfig, source: { ...intakeConfig.source, destinationProviderId: 'local-review' } },
      output: [output],
    });
    cleanup.push(() => app.close());
    const modelCalls = vi.spyOn(globalThis, 'fetch');
    const cases = [
      event('domain', { domain: 'EXAMPLE.COM' }),
      event('email', { email: 'Sales@EXAMPLE.COM' }),
      event('crm', { crm: { providerId: 'attio', recordId: 'company-42' } }),
    ];
    const associations: string[] = [];
    for (const payload of cases) {
      const response = await app.post(payload);
      expect(response.status).toBe(202);
      const association = await response.json();
      associations.push(association.runId);
      const read = await app.http.request(association.statusUrl);
      expect(read.status).toBe(200);
      expect(await read.json()).toMatchObject({
        runId: association.runId,
        status: 'accepted',
        sourceId: 'local-inbound',
        destination: { providerId: 'local-review', reference: payload.lead.reference },
      });
      // Open another connection after the HTTP acknowledgement, before any dispatch.
      const fresh = createClient({ url: pathToFileURL(join(app.directory, 'application.db')).href });
      try {
        const result = await fresh.execute({
          sql: 'SELECT r.run_id, r.event_json, d.run_id AS delivery_run FROM lead_runs r JOIN lead_deliveries d USING(run_id) WHERE r.run_id=?',
          args: [association.runId],
        });
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]!.delivery_run).toBe(association.runId);
        const persisted = JSON.parse(z.string().parse(result.rows[0]!.event_json));
        expect(persisted.sourceId).toBe('local-inbound');
        expect(persisted.destination.providerId).toBe('local-review');
        expect(persisted.lead).toMatchObject(
          payload.eventId === 'domain'
            ? { domain: 'example.com' }
            : payload.eventId === 'email'
              ? { email: 'Sales@example.com' }
              : payload.lead,
        );
      } finally {
        fresh.close();
      }
    }
    expect(new Set(associations).size).toBe(3);
    expect(modelCalls).not.toHaveBeenCalled();
    expect(Object.keys(app.mastra.listAgents())).toHaveLength(0);
    await app.mastra.startWorkers();
    await vi.waitFor(async () => {
      for (const runId of associations) expect((await app.store.get(runId))?.status).toBe('intake_received');
    });
    for (const runId of associations) {
      const snapshot = await app.intake.workflow.getWorkflowRunById(runId);
      expect(snapshot?.status).toBe('suspended');
      expect((await app.reviews.read(runId))?.state).toBe('awaiting_review');
    }
    expect(modelCalls).not.toHaveBeenCalled();
  });

  it('rejects_unauthenticated_or_invalid_events', async () => {
    const app = await harness({
      production: true,
      config: { ...intakeConfig, limits: { ...intakeConfig.limits, maxPendingRuns: 1 } },
    });
    cleanup.push(() => app.close());
    const modelCalls = vi.spyOn(globalThis, 'fetch');
    const headers = { Authorization: `Bearer ${productionToken}` };
    const invalidHeaders: Record<string, string>[] = [
      {},
      { Authorization: 'Bearer wrong-token' },
      { 'x-mastra-client-type': 'studio' },
    ];
    for (const extra of invalidHeaders) {
      const response = await app.post(event(), extra);
      expect(response.status).toBe(401);
      for (const path of [
        '/api/workflows',
        '/api/agents',
        '/lead-qualification/runs/00000000-0000-4000-8000-000000000000',
      ]) {
        expect((await app.http.request(path, { headers: extra })).status).toBe(401);
      }
    }
    expect((await app.http.request('/api/workflows', { headers })).status).toBe(200);
    expect(
      (await app.http.request('/api/agents', { headers: { ...headers, 'x-mastra-client-type': 'studio' } })).status,
    ).toBe(200);
    for (const payload of [
      null,
      event('empty', {}),
      { ...event(), type: 'review.decided' },
      { ...event(), sourceId: 'forged' },
      event('crm', { crm: { providerId: 'unknown', recordId: 'record-1' } }),
    ]) {
      expect((await app.post(payload, headers)).status).toBe(400);
    }
    expect(
      (
        await app.http.request('/lead-qualification/events', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: '{',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await app.http.request('/lead-qualification/events', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'text/plain' },
          body: '{}',
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await app.http.request('/lead-qualification/events', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: ' '.repeat(262_145),
        })
      ).status,
    ).toBe(413);
    // The stream has no Content-Length, so the actual bytes must enforce the limit.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(262_145));
        controller.close();
      },
    });
    expect(
      (
        await app.http.request(
          new Request('http://localhost/lead-qualification/events', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: stream,
            duplex: 'half',
          } as RequestInit),
        )
      ).status,
    ).toBe(413);
    expect((await app.store.client.execute('SELECT count(*) AS count FROM lead_runs')).rows[0]!.count).toBe(0);
    expect((await app.store.client.execute('SELECT count(*) AS count FROM lead_deliveries')).rows[0]!.count).toBe(0);
    const accepted = await app.post(event('first'), headers);
    expect(accepted.status).toBe(202);
    const original = await accepted.json();
    expect((await app.post(event('second'), headers)).status).toBe(429);
    expect((await app.post(event('first'), headers)).status).toBe(202);
    expect((await app.post(event('conflict', { reference: 'first', domain: 'other.com' }), headers)).status).toBe(429);
    expect((await app.post(event('first', { domain: 'other.com' }), headers)).status).toBe(400);
    expect((await app.store.client.execute('SELECT count(*) AS count FROM lead_runs')).rows[0]!.count).toBe(1);
    expect((await app.store.client.execute('SELECT count(*) AS count FROM lead_deliveries')).rows[0]!.count).toBe(1);
    expect((await app.store.get(original.runId))?.event.lead.domain).toBe('example.com');
    // Even a valid native caller cannot bypass the accepted association/dispatch boundary.
    const invented = await app.intake.workflow.createRun();
    const result = await invented.start({ inputData: { runId: '00000000-0000-4000-8000-000000000000' } });
    expect(result.status).toBe('failed');
    expect((await app.store.client.execute('SELECT count(*) AS count FROM lead_runs')).rows[0]!.count).toBe(1);
    const unavailable = vi
      .spyOn(app.store, 'accept')
      .mockRejectedValueOnce(new Error('example-secret-private-contact@example.com'));
    const response = await app.post(event('unavailable'), headers);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('example-secret');
    unavailable.mockRestore();
    expect(modelCalls).not.toHaveBeenCalled();
    await app.telemetry.observability.flush();
    const diagnostics = await app.duckdb.observability.listLogs({ pagination: { page: 0, perPage: 100 } });
    const recorded = JSON.stringify(diagnostics);
    expect(recorded).toContain('intake.rejected');
    expect(recorded).not.toContain(productionToken);
    expect(recorded).not.toContain('private-contact');
    expect(recorded).not.toContain('Sales@');
  });
});
