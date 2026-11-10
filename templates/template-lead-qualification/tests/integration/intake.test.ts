import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { attioFixture } from '../support/attio';
import { z } from 'zod';
import { createClient } from '@libsql/client';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizedEventSchema, domainSchema } from '../../src/mastra/contracts';
import { controlledHarness } from '../support/research';
import { digestValue } from '../../src/mastra/review/contracts';
import { ownedState } from '../../src/mastra/providers/output';
import { intakeConfig } from '../../src/mastra/config/lead-ingestion';
import { event, harness, productionToken } from '../support/application';
import type { DestinationState, OutputProvider } from '../../src/mastra/providers/output';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('durable intake', () => {
  it('accepts_and_persists_internationalized_top_level_domains_in_ascii_form', async () => {
    const app = await harness();
    cleanup.push(() => app.close());
    for (const [index, lead] of [
      { domain: 'пример.рф' },
      { domain: 'xn--e1afmkfd.xn--p1ai' },
      { domain: 'пример.рф', email: 'Sales@пример.рф' },
      { email: 'Sales@xn--e1afmkfd.xn--p1ai' },
    ].entries()) {
      const response = await app.post(event(`idn-tld-${index}`, lead));
      expect(response.status).toBe(202);
      const { runId } = await response.json();
      const stored = (await app.store.get(runId))!.event.lead;
      expect(stored.domain).toBe(lead.domain ? 'xn--e1afmkfd.xn--p1ai' : undefined);
      expect(stored.email).toBe(lead.email ? 'Sales@xn--e1afmkfd.xn--p1ai' : undefined);
    }
  });

  it('lists_and_opens_persisted_workflow_history_for_the_authenticated_production_operator', async () => {
    const app = await harness({ production: true, dispatch: true });
    cleanup.push(() => app.close());
    const headers = { Authorization: `Bearer ${productionToken}`, 'x-mastra-client-type': 'studio' };
    const accepted = await app.post(event('studio-history'), headers);
    expect(accepted.status).toBe(202);
    const { runId } = await accepted.json();
    await vi.waitFor(async () => {
      expect((await app.intake.workflow.getWorkflowRunById(runId))?.status).toBe('suspended');
    });
    const foreign = await app.intake.workflow.createRun({ resourceId: 'another-resource' });
    expect((await foreign.start({ inputData: { runId: foreign.runId } })).status).toBe('failed');
    await app.close(false);

    const restarted = await harness({ production: true, directory: app.directory });
    cleanup.push(() => restarted.close());
    const historyUrl = '/api/workflows/leadIntake/runs';
    const invalidHeaders: Record<string, string>[] = [
      {},
      { Authorization: 'Bearer wrong-token' },
      { 'x-mastra-client-type': 'studio' },
    ];
    for (const invalid of invalidHeaders) {
      expect((await restarted.http.request(historyUrl, { headers: invalid })).status).toBe(401);
      expect((await restarted.http.request(`${historyUrl}/${runId}`, { headers: invalid })).status).toBe(401);
    }
    const history = await restarted.http.request(historyUrl, { headers });
    expect(history.status).toBe(200);
    expect(await history.json()).toMatchObject({
      total: 1,
      runs: [{ runId, resourceId: 'lead-qualification' }],
    });
    const detail = await restarted.http.request(`${historyUrl}/${runId}`, { headers });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ runId, status: 'suspended', resourceId: 'lead-qualification' });
    expect((await restarted.http.request(`${historyUrl}/${foreign.runId}`, { headers })).status).toBe(403);
  });

  it('normalizes_a_registered_lead_source_and_reconciles_its_separate_output_destination_with_authenticated_review', async () => {
    const submittedSchema = z.strictObject({ submission: z.string().min(1), company: domainSchema });
    const destinations = new Map<string, DestinationState>();
    const output: OutputProvider = {
      id: 'company-directory',
      read: async target => destinations.get(target.reference) ?? { fields: { stage: 'Triage' }, marker: null },
      apply: async (target, operationId, patch, expected) => {
        const before = await output.read(target);
        if (digestValue(ownedState(before!.fields)) !== digestValue(expected)) throw new Error('destination_conflict');
        destinations.set(target.reference, { fields: { ...patch }, marker: operationId });
      },
    };
    const { app } = await controlledHarness({
      production: true,
      config: {
        ...intakeConfig,
        source: { ...intakeConfig.source, inputProviderId: 'sales-form', destinationProviderId: output.id },
      },
      inputProvider: () => ({
        id: 'sales-form',
        source: { ...intakeConfig.source, inputProviderId: 'sales-form', destinationProviderId: output.id },
        transport: 'json',
        async normalize(payload, source, receivedAt) {
          const submitted = submittedSchema.parse(payload);
          return {
            event: normalizedEventSchema.parse({
              version: 1,
              type: 'lead.received',
              eventId: submitted.submission,
              sourceId: source.id,
              receivedAt,
              lead: { reference: submitted.submission, domain: submitted.company },
              destination: {
                providerId: source.destinationProviderId,
                reference: `directory:${submitted.company}`,
              },
            }),
          };
        },
      }),
      outputProvider: () => output,
    });
    cleanup.push(() => app.close());
    const headers = { Authorization: `Bearer ${productionToken}` };
    expect((await app.post({ submission: 'lead-1', company: 'example.com' })).status).toBe(401);
    expect(
      (await app.post({ submission: 'lead-1', company: 'example.com', sourceId: 'untrusted' }, headers)).status,
    ).toBe(400);
    const payload = { submission: 'lead-1', company: 'EXAMPLE.COM' };
    const response = await app.post(payload, headers);
    expect(response.status).toBe(202);
    const accepted = await response.json();
    expect((await (await app.post(payload, headers)).json()).runId).toBe(accepted.runId);
    await app.mastra.startWorkers();
    await vi.waitFor(async () => expect((await app.reviews.read(accepted.runId))?.state).toBe('awaiting_review'));
    const run = await (await app.http.request(accepted.statusUrl, { headers })).json();
    expect(run.destination).toEqual({ providerId: output.id, reference: 'directory:example.com' });
    expect(run.sourceId).toBe('local-inbound');
    expect(run.qualification.assessment.identity.domain).toBe('example.com');
    const published = destinations.get('directory:example.com')!;
    expect(published.marker).toBe(`${accepted.runId}:review`);
    expect(published.fields).toMatchObject({ cycleId: accepted.runId, stage: 'Needs review' });
    const packet = run.business.packet;
    const decision = {
      runId: accepted.runId,
      reviewId: packet.id,
      revision: packet.revision,
      digest: packet.digest,
      decision: 'approved',
      override: { classification: 'qualified', reason: 'Confirmed the unresolved facts directly with the company.' },
    };
    const review = (body: unknown, authenticated = true) =>
      app.http.request('/lead-qualification/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authenticated ? headers : {}) },
        body: JSON.stringify(body),
      });
    expect((await review(decision, false)).status).toBe(401);
    expect((await review({ ...decision, providerId: 'attio', reviewer: 'forged' })).status).toBe(400);
    expect((await review(decision)).status).toBe(200);
    await vi.waitFor(async () => expect((await app.reviews.read(accepted.runId))?.state).toBe('applied'));
    const operation = (await app.store.reviews.operation(accepted.runId, 'final'))!;
    const completed = (await app.reviews.read(accepted.runId))!;
    expect(completed.authorization).toMatchObject({ kind: 'human', patchDigest: digestValue(operation.patch) });
    expect(completed.decision!.reviewer).toBe('local-operator');
    expect(operation.state).toBe('applied');
    expect(destinations.get('directory:example.com')).toMatchObject({
      marker: operation.id,
      fields: { stage: 'Qualified' },
    });
    const reopened = {
      ...destinations.get('directory:example.com')!,
      fields: { ...destinations.get('directory:example.com')!.fields, stage: 'Needs review' },
      revision: 'directory-review-2',
    };
    destinations.set('directory:example.com', reopened);
    const receivedAt = new Date().toISOString();
    await app.reviews.reopenFromProvider(output.id, accepted.runId, ownedState(reopened.fields), reopened.revision, {
      actorId: 'directory-operator',
      occurredAt: receivedAt,
      receivedAt,
    });
    await vi.waitFor(async () => expect((await app.reviews.read(accepted.runId))?.state).toBe('awaiting_review'));
    const secondPacket = (await app.reviews.read(accepted.runId))!.packet!;
    expect(secondPacket.revision).toBe(2);
    expect((await review(decision)).status).toBe(409);
    expect(
      (await review({ ...decision, reviewId: secondPacket.id, revision: 2, digest: secondPacket.digest })).status,
    ).toBe(200);
    await vi.waitFor(async () => expect((await app.reviews.read(accepted.runId))?.state).toBe('applied'));
    expect((await app.store.reviews.operation(accepted.runId, 'final', 2))?.state).toBe('applied');
  });

  it('starts_local_json_without_loading_unrelated_invalid_attio_configuration', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-provider-selection-'));
    cleanup.push(() => rm(directory, { recursive: true, force: true }));
    await writeFile(join(directory, 'package.json'), '{}');
    await writeFile(join(directory, 'attio.mapping.json'), '{invalid');
    vi.stubEnv('MASTRA_PROJECT_ROOT', directory);
    vi.stubEnv('ATTIO_API_TOKEN', 'unrelated-stale-token');
    vi.stubEnv('ATTIO_WEBHOOK_SECRET', 'invalid');
    const transport = vi.fn<typeof fetch>();
    const app = await harness({ directory, defaultProviders: true, attioTransport: transport });
    cleanup.push(() => app.close());
    expect(app.inputProvider.id).toBe('local');
    expect([...app.outputs.keys()]).toEqual(['local']);
    expect((await app.post(event('local-with-stale-attio'))).status).toBe(202);
    expect(transport).not.toHaveBeenCalled();
    expect(
      (await app.store.client.execute("SELECT name FROM sqlite_master WHERE name LIKE 'lead_attio_%'")).rows,
    ).toHaveLength(0);
  });

  it('keeps_provider_selection_independent_of_production_and_enables_only_the_selected_input', async () => {
    const local = await harness({ production: true, defaultProviders: true });
    cleanup.push(() => local.close());
    expect(local.inputProvider.id).toBe('local');
    expect([...local.outputs.keys()]).toEqual(['local']);
    const fixture = attioFixture();
    const headers = { Authorization: `Bearer ${productionToken}` };
    const attio = await harness({ production: true, attio: fixture.config, attioTransport: fixture.transport });
    cleanup.push(() => attio.close());
    expect(attio.inputProvider.id).toBe('attio');
    expect((await attio.post(event('unsigned-attio'), headers)).status).toBe(404);
    expect(
      (
        await attio.http.request('/lead-qualification/webhooks/attio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"events":[]}',
        })
      ).status,
    ).toBe(401);
    const { webhookSecret: _secret, ...connection } = fixture.config;
    const outputOnly = await harness({
      config: { ...intakeConfig, source: { ...intakeConfig.source, destinationProviderId: 'attio' } },
      attio: connection,
      attioTransport: fixture.transport,
    });
    cleanup.push(() => outputOnly.close());
    expect(outputOnly.inputProvider.id).toBe('local');
    expect([...outputOnly.outputs.keys()]).toEqual(['attio']);
    expect(outputOnly.outputs.get('attio')?.reviewMode).toBe('operator');
    expect((await outputOnly.http.request('/lead-qualification/webhooks/attio', { method: 'POST' })).status).toBe(404);
    expect(fixture.transport).not.toHaveBeenCalled();
  });

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
      outputProvider: () => output,
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
