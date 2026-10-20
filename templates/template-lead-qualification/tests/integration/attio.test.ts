import { intakeConfig } from '../../src/mastra/config/lead-ingestion';
import type { AttioInputProvider } from '../../src/mastra/providers/attio/input';
import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type harness, productionToken } from '../support/application';
import { attioFixture } from '../support/attio';
import { controlledHarness, controlledResearch, pageResponse } from '../support/research';
import type { ResearchScenario } from '../support/research';
import { observeAttioEntry } from '../../scripts/attio-demo';
import { AttioOutputProvider } from '../../src/mastra/providers/attio/output';
import { digestValue } from '../../src/mastra/review/contracts';
import type { OwnedPatch } from '../../src/mastra/review/contracts';
import type { Assessment } from '../../src/mastra/research/contracts';
import type { AttioValue } from '../../src/mastra/providers/attio/client';

type App = Awaited<ReturnType<typeof harness>>;
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function setup(
  scenario: ResearchScenario = {},
  fixture = attioFixture(),
  options: Parameters<typeof harness>[0] = {},
) {
  const { app, controlled: research } = await controlledHarness(
    { production: true, attio: fixture.config, attioTransport: fixture.transport, ...options },
    controlledResearch(scenario),
  );
  cleanup.push(() => app.close());
  return { app, fixture, research };
}
function deliver(
  app: App,
  fixture: ReturnType<typeof attioFixture>,
  events: unknown[],
  id = randomUUID(),
  signature?: string,
) {
  const body = JSON.stringify({ events });
  return app.http.request('/lead-qualification/webhooks/attio', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': id,
      'attio-signature': signature ?? createHmac('sha256', fixture.config.webhookSecret).update(body).digest('hex'),
    },
  });
}
async function accepted(app: App, entryId: string) {
  return vi.waitFor(async () => {
    const row = (
      await app.store.client.execute({
        sql: 'SELECT run_id FROM lead_runs WHERE destination_reference=? ORDER BY rowid DESC LIMIT 1',
        args: [entryId],
      })
    ).rows[0];
    expect(row).toBeDefined();
    return z.string().parse(row!.run_id);
  });
}
async function state(app: App, runId: string, expected: string) {
  return vi.waitFor(
    async () => {
      const cycle = await app.reviews.read(runId);
      expect(cycle?.state).toBe(expected);
      return cycle!;
    },
    { timeout: 20_000 },
  );
}
async function approve(
  app: App,
  fixture: ReturnType<typeof attioFixture>,
  entryId: string,
  stage = 'Qualified',
  reason?: string,
) {
  if (reason !== undefined) fixture.set(entryId, 'reviewJustification', reason);
  fixture.set(entryId, 'stage', stage);
  expect((await deliver(app, fixture, [fixture.event(entryId, 'stage')])).status).toBe(202);
}
// Model independent source timestamps relative to the actual signed, persisted webhook receipt.
async function timestampedCommand(
  app: App,
  fixture: ReturnType<typeof attioFixture>,
  entry: string,
  stage: string,
  offset: number,
) {
  fixture.set(entry, 'stage', stage);
  const id = randomUUID();
  const events = [fixture.event(entry, 'stage')];
  expect((await deliver(app, fixture, events, id)).status).toBe(202);
  const input = app.inputs.get('attio') as AttioInputProvider;
  const receivedAt = z.iso.datetime({ offset: true }).parse((await input.inbox.delivery(id))!.receivedAt);
  const occurredAt = new Date(Date.parse(receivedAt) + offset).toISOString();
  fixture.set(entry, 'stage', stage, fixture.member, occurredAt);
  return { id, events, receivedAt, occurredAt, input };
}
async function inboxDone(app: App) {
  await vi.waitFor(
    async () =>
      expect(
        (await app.store.client.execute("SELECT count(*) AS total FROM lead_attio_events WHERE state='pending'"))
          .rows[0]!.total,
      ).toBe(0),
    { timeout: 10_000 },
  );
}
// Historical payloads deliberately omit the additive presentation marker.
function historicalPatch(patch: OwnedPatch, assessment: Assessment): OwnedPatch {
  const { presentationVersion: _version, ...legacy } = patch;
  return {
    ...legacy,
    summary: assessment.summary,
    evidenceLinks: [...new Set(assessment.evidence.map(source => source.source))],
    gaps: assessment.result.reviewReasons,
    nextAction: assessment.result.nextAction,
    reviewReasons: legacy.reviewReasons.map(reason => ({
      ...reason,
      explanation: assessment.result.contributions.find(rule => rule.rule === reason.attribute)!.reason,
      action: `Confirm ${reason.attribute} and submit corrected evidence for requalification.`,
    })),
  };
}
async function historicalReview(app: App, fixture: ReturnType<typeof attioFixture>, runId: string) {
  const cycle = (await app.reviews.read(runId))!;
  const assessment = (await app.store.qualifications.get(runId))!.assessment!;
  const run = (await app.store.get(runId))!;
  const operation = (await app.store.reviews.operation(runId, 'review'))!;
  const patch = historicalPatch(cycle.packet!.proposedPatch, assessment);
  const packet = {
    ...cycle.packet!,
    proposedPatch: patch,
    digest: digestValue({ event: run.event, assessment, patch, revision: 1 }),
  };
  const expected = new AttioOutputProvider(fixture.client).project(patch, operation.id, operation.expected);
  await fixture.client.update(run.event.destination.reference, expected);
  await app.store.client.batch(
    [
      {
        sql: 'UPDATE lead_cycles SET packet_json=?,expected_json=? WHERE run_id=?',
        args: [JSON.stringify(packet), JSON.stringify(expected), runId],
      },
      { sql: 'UPDATE lead_output_operations SET patch_json=? WHERE id=?', args: [JSON.stringify(patch), operation.id] },
    ],
    'write',
  );
  return { packet, assessment };
}
// Recover a prior deployment's authorized action without rebinding its digest or repeating a lost write.
async function recoverAuthorizedReview(
  app: App,
  fixture: ReturnType<typeof attioFixture>,
  entry: string,
  runId: string,
) {
  await app.dispatcher.stop();
  await approve(app, fixture, entry);
  await app.inputs.get('attio')!.drain!();
  fixture.fault({ status: 503, remaining: 1 });
  await app.reviews.advance(runId);
  const prepared = (await app.reviews.read(runId))!;
  const operation = (await app.store.reviews.operation(runId, 'final'))!;
  const patch = { ...operation.patch, nextAction: prepared.packet!.proposedPatch.nextAction };
  const authorization = { ...prepared.authorization!, patchDigest: digestValue(patch) };
  await app.store.client.execute({
    sql: 'UPDATE lead_output_operations SET patch_json=? WHERE id=?',
    args: [JSON.stringify(patch), operation.id],
  });
  await app.store.client.execute({
    sql: 'UPDATE lead_cycles SET authorization_json=?,next_retry_at=0 WHERE run_id=?',
    args: [JSON.stringify({ ...authorization, patchDigest: '0'.repeat(64) }), runId],
  });
  fixture.fault(undefined);
  await app.reviews.advance(runId);
  expect(await app.reviews.read(runId)).toMatchObject({
    state: 'failed',
    authorization: { patchDigest: '0'.repeat(64) },
  });
  await app.store.client.execute({
    sql: "UPDATE lead_cycles SET authorization_json=?,state='applying',attempts=0,next_retry_at=0,failure_code=NULL WHERE run_id=?",
    args: [JSON.stringify(authorization), runId],
  });
  fixture.fault({ after: true, remaining: 1 });
  await app.reviews.advance(runId);
  expect((await app.store.reviews.operation(runId, 'final'))!.state).toBe('uncertain');
  await app.close(false);
  const resumed = await setup({}, fixture, { directory: app.directory });
  await resumed.app.mastra.startWorkers();
  expect((await state(resumed.app, runId, 'applied')).authorization).toEqual(authorization);
  expect((await resumed.app.store.reviews.operation(runId, 'final'))!.patch).toEqual(patch);
  expect(fixture.client.fields(fixture.entries.get(entry)!).nextAction).toBe(patch.nextAction);
  expect(resumed.research.requests).toHaveLength(0);
  await resumed.app.close();
}
describe('Attio qualification pipeline', () => {
  it.each([1335, 5000])('accepts_triage_timestamp_%ims_after_receipt_once', async offset => {
    const { app, fixture, research } = await setup({ country: 'JP' }, attioFixture(true));
    const entry = fixture.add();
    await deliver(app, fixture, [fixture.event(entry)]);
    await app.mastra.startWorkers();
    const priorId = await accepted(app, entry);
    const prior = await state(app, priorId, 'applied');
    expect(fixture.client.fields(fixture.entries.get(entry)!).stage).toBe('Disqualified');
    await app.dispatcher.stop();
    const assessment = await app.store.qualifications.get(priorId);
    const operation = await app.store.reviews.operation(priorId, 'final');
    const requests = research.requests.length;
    const command = await timestampedCommand(app, fixture, entry, 'Triage', offset);
    expect(Date.parse(command.occurredAt) - Date.parse(command.receivedAt)).toBe(offset);
    await deliver(app, fixture, command.events, command.id);
    await command.input.drain();
    const childId = await accepted(app, entry);
    expect(childId).not.toBe(priorId);
    expect((await app.store.get(childId))!.event).toMatchObject({
      receivedAt: command.receivedAt,
      supersedesAssessmentId: prior.assessmentId,
    });
    expect((await command.input.inbox.delivery(command.id))!.events[0]).toMatchObject({
      state: 'done',
      runId: childId,
    });
    await deliver(app, fixture, command.events, command.id);
    await deliver(app, fixture, command.events);
    await command.input.drain();
    expect(
      (
        await app.store.client.execute({
          sql: 'SELECT run_id FROM lead_runs WHERE destination_reference=?',
          args: [entry],
        })
      ).rows,
    ).toHaveLength(2);
    expect(research.requests).toHaveLength(requests);
    await app.dispatcher.start();
    expect((await state(app, childId, 'applied')).predecessorId).toBe(prior.assessmentId);
    expect(await app.store.qualifications.get(priorId)).toEqual(assessment);
    expect(await app.store.reviews.operation(priorId, 'final')).toEqual(operation);
  });

  it.each([1335, 5000])('accepts_review_and_reopen_timestamp_%ims_after_receipt', async offset => {
    const { app, fixture, research } = await setup({ employees: null }, attioFixture(true));
    const entry = fixture.add();
    await deliver(app, fixture, [fixture.event(entry)]);
    await app.mastra.startWorkers();
    const runId = await accepted(app, entry);
    const pending = await state(app, runId, 'awaiting_review');
    await app.dispatcher.stop();
    const assessment = await app.store.qualifications.get(runId);
    const requests = research.requests.length;
    const approval = await timestampedCommand(app, fixture, entry, 'Qualified', offset);
    await approval.input.drain();
    const decided = (await app.reviews.read(runId))!;
    expect(decided.decision).toMatchObject({
      decidedAt: approval.occurredAt,
      reviewer: { provider: 'attio', memberId: fixture.member.id },
      input: { kind: 'attio-stage', stage: 'Qualified' },
    });
    await app.reviews.advance(runId);
    await state(app, runId, 'applied');
    const final = await app.store.reviews.operation(runId, 'final');
    const reopen = await timestampedCommand(app, fixture, entry, 'Needs review', offset);
    await reopen.input.drain();
    await app.reviews.advance(runId);
    const reopened = await state(app, runId, 'awaiting_review');
    expect(reopened.packet).toMatchObject({
      revision: 2,
      reopenedBy: { memberId: fixture.member.id, occurredAt: reopen.occurredAt, receivedAt: reopen.receivedAt },
    });
    expect(reopened.history).toHaveLength(1);
    expect(reopened.history[0]).toMatchObject({ packet: pending.packet, decision: decided.decision });
    expect(await app.store.reviews.operation(runId, 'final')).toEqual(final);
    expect(await app.store.qualifications.get(runId)).toEqual(assessment);
    expect(research.requests).toHaveLength(requests);
  });

  it('rejects_out_of_window_or_unbound_triage_without_research_even_after_retry', async () => {
    const { app, fixture, research } = await setup({ country: 'JP' }, attioFixture(true));
    const entry = fixture.add();
    await deliver(app, fixture, [fixture.event(entry)]);
    await app.mastra.startWorkers();
    const runId = await accepted(app, entry);
    const prior = await state(app, runId, 'applied');
    await app.dispatcher.stop();
    const baseline = structuredClone(fixture.entries.get(entry)!);
    const assessment = await app.store.qualifications.get(runId);
    const operation = await app.store.reviews.operation(runId, 'final');
    const requests = research.requests.length;
    const writes = fixture.writes.length;
    const retryObservations: unknown[] = [];
    for (const violation of [
      'future',
      'equal',
      'stale',
      'actor',
      'output',
      'marker',
      'history',
      'ambiguous',
    ] as const) {
      fixture.entries.set(entry, structuredClone(baseline));
      const command = await timestampedCommand(app, fixture, entry, 'Triage', violation === 'future' ? 5001 : 1335);
      if (violation === 'equal' || violation === 'stale')
        fixture.set(
          entry,
          'stage',
          'Triage',
          fixture.member,
          new Date(Date.parse(prior.changedAt) - (violation === 'stale' ? 1 : 0)).toISOString(),
        );
      if (violation === 'actor') fixture.set(entry, 'stage', 'Triage', fixture.integration, command.occurredAt);
      if (violation === 'output' || violation === 'marker') {
        const metadata = JSON.parse(String(fixture.client.fields(fixture.entries.get(entry)!).metadata));
        metadata.output[violation === 'output' ? 'score' : 'operationId'] = violation === 'output' ? 99 : randomUUID();
        fixture.set(entry, 'metadata', JSON.stringify(metadata));
      }
      const current = fixture.client.value(fixture.entries.get(entry)!, 'stage')!;
      const history =
        violation === 'history' || violation === 'ambiguous'
          ? vi
              .spyOn(command.input.client, 'history')
              .mockResolvedValue(
                violation === 'ambiguous'
                  ? [current, current]
                  : [{ ...current, active_from: new Date(Date.parse(command.occurredAt) + 1).toISOString() }],
              )
          : undefined;
      if (violation === 'future') {
        fixture.fault({ status: 503, remaining: 1 });
        await command.input.drain();
        retryObservations.push((await command.input.inbox.delivery(command.id))!.events[0]);
        fixture.fault(undefined);
        // Processing after the source timestamp must not move the original receipt window.
        const later = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(command.receivedAt) + 20_000);
        await command.input.drain();
        later.mockRestore();
      } else await command.input.drain();
      history?.mockRestore();
      expect(await command.input.inbox.delivery(command.id)).toMatchObject({
        receivedAt: command.receivedAt,
        events: [{ state: 'conflict', failureCode: 'attio_conflict' }],
      });
      expect(await accepted(app, entry)).toBe(runId);
      expect(await app.store.qualifications.get(runId)).toEqual(assessment);
      expect(await app.store.reviews.operation(runId, 'final')).toEqual(operation);
      expect(research.requests).toHaveLength(requests);
      expect(fixture.writes).toHaveLength(writes);
    }
    expect(retryObservations).toMatchObject([{ state: 'pending', attempts: 1 }]);
  });

  it('combines_json_intake_with_explicit_signed_attio_review_transport', async () => {
    const fixture = attioFixture(true);
    const { app } = await setup({ employees: null }, fixture, {
      config: { ...intakeConfig, source: { ...intakeConfig.source, destinationProviderId: 'attio' } },
      additionalInputs: ['attio'],
    });
    const entry = fixture.add();
    const response = await app.post(
      {
        version: 1,
        type: 'lead.received',
        eventId: 'json-to-attio',
        lead: { reference: entry, domain: 'example.com' },
        destinationReference: entry,
      },
      { Authorization: `Bearer ${productionToken}` },
    );
    expect(response.status).toBe(202);
    const { runId } = await response.json();
    await app.mastra.startWorkers();
    const cycle = await state(app, runId, 'awaiting_review');
    expect((await app.store.get(runId))!.event.sourceId).toBe('local-inbound');
    expect(
      (
        await app.http.request('/lead-qualification/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${productionToken}` },
          body: JSON.stringify({
            runId,
            reviewId: cycle.packet!.id,
            revision: 1,
            digest: cycle.packet!.digest,
            decision: 'approved',
            override: { classification: 'qualified', reason: 'Operator cannot bypass connected review.' },
          }),
        })
      ).status,
    ).toBe(409);
    await new Promise(resolve => setTimeout(resolve, 2));
    await approve(app, fixture, entry, 'Qualified', 'Confirmed the missing team size with the company.');
    const completed = await state(app, runId, 'applied');
    expect(completed.decision!.input).toMatchObject({ kind: 'attio-stage', stage: 'Qualified' });
    expect(completed.decision!.reviewer).toMatchObject({ provider: 'attio', memberId: fixture.member.id });
    const operation = (await app.store.reviews.operation(runId, 'final'))!;
    expect(operation.state).toBe('applied');
    expect(fixture.client.fields(fixture.entries.get(entry)!)).toMatchObject({
      operationId: operation.id,
      stage: 'Qualified',
    });
  });

  it('preserves_workforce_cue_inference_and_automatic_authorization_in_compact_output', async () => {
    const fixture = attioFixture(true);
    const rationale =
      'Assuming the 150+ staff milestone allows for moderate unreported growth, 150–240 is a working estimate. The upper bound is uncertain, not an observed ceiling.';
    const { app, research } = await setup(
      {
        employees: { min: 150, max: 240 },
        employeeQuote: '150+ employees',
        employeeObservation: { value: { min: 150, max: null }, quote: '150+ employees' },
        employeeInference: { rationale, additionalPassages: [] },
      },
      fixture,
    );
    const workforcePage =
      'Example sells subscription cloud software to businesses. Our workforce: 150+ employees. Headquarters: United States.';
    vi.mocked(research.transport.request).mockImplementation(async () => pageResponse(workforcePage));
    const entry = fixture.add();
    await deliver(app, fixture, [fixture.event(entry)]);
    await app.inputs.get('attio')!.drain!();
    const runId = await accepted(app, entry);
    await app.mastra.startWorkers();
    const cycle = await state(app, runId, 'applied');
    expect(cycle.authorization?.kind).toBe('policy');
    expect(cycle.decision).toBeNull();
    const fields = fixture.client.fields(fixture.entries.get(entry)!);
    const metadata = JSON.parse(String(fields.metadata));
    const assessment = (await app.store.qualifications.get(runId))!.assessment!;
    expect(metadata.output).toMatchObject({
      classification: 'qualified',
      score: 100,
      decisionSource: 'Automatic',
      reviewStatus: 'Not required',
      appliedAssessmentId: assessment.id,
    });
    expect(fields.summary).toContain('150–240 employees');
    expect(fields.summary).toContain('This is an estimate.');
    expect(assessment.facts.employeeCount.basis).toBe('inferred');
    expect(assessment.inferences).toContainEqual(
      expect.objectContaining({
        attribute: 'employeeCount',
        rationale,
        passages: [expect.objectContaining({ quote: workforcePage })],
      }),
    );
    const employeePassage = assessment.inferences.find(item => item.attribute === 'employeeCount')!.passages[0]!;
    expect(employeePassage.quote).toContain('150+ employees');
    expect(assessment.evidence.find(source => source.id === employeePassage.evidenceId)!.excerpt).toContain(
      employeePassage.quote,
    );
  });

  it('keeps_compact_input_separate_and_reconciles_exact_four_field_output', async () => {
    const fixture = attioFixture(true);
    const { app, research } = await setup({}, fixture);
    const entry = fixture.add();
    const submitted = JSON.parse(String(fixture.client.fields(fixture.entries.get(entry)!).metadata)).input;
    await deliver(app, fixture, [fixture.event(entry)]);
    await app.inputs.get('attio')!.drain!();
    const runId = await accepted(app, entry);
    fixture.fault({ after: true, remaining: 1 });
    await app.mastra.startWorkers();
    await vi.waitFor(async () => expect((await app.store.reviews.operation(runId, 'final'))?.state).toBe('uncertain'));
    await app.close(false);
    const count = fixture.writes.length;
    const resumed = await setup({}, fixture, { directory: app.directory });
    await resumed.app.mastra.startWorkers();
    await state(resumed.app, runId, 'applied');
    expect(fixture.writes).toHaveLength(count);
    expect(resumed.research.requests).toHaveLength(0);
    expect(research.requests.length).toBeGreaterThan(0);
    expect(Object.keys(fixture.writes[0]!).sort()).toEqual([
      'lq_metadata',
      'lq_review_justification',
      'lq_stage',
      'lq_summary',
    ]);
    const fields = fixture.client.fields(fixture.entries.get(entry)!);
    expect(fields).toMatchObject({
      stage: 'Qualified',
      decisionSource: 'Automatic',
      reviewStatus: 'Not required',
      cycleId: runId,
    });
    expect(fields.summary).toContain('Score: 100/100');
    expect(fields.summary).toContain('Public sources');
    expect(fields.summary).toContain('Next action');
    expect(JSON.parse(String(fields.metadata)).input).toEqual(submitted);
    expect((await resumed.app.store.get(runId))!.event.lead.inquiry).toEqual(submitted.inquiry);
    expect((await resumed.app.store.reviews.operation(runId, 'final'))!.patch.presentationVersion).toBe(2);
    expect(fixture.entries.get(entry)!.entry_values.owner_note![0]!.value).toBe('Keep this note');
    const original = (await resumed.app.store.qualifications.get(runId))!.assessment!;
    const originalOperation = (await resumed.app.store.reviews.operation(runId, 'final'))!;
    const settledEntry = structuredClone(fixture.entries.get(entry)!);
    const settledMetadata = JSON.parse(String(fields.metadata));
    const paid = resumed.research.requests.length;
    await resumed.app.dispatcher.stop();
    for (const [changed, outcome] of [
      [{ ...settledMetadata, output: { ...settledMetadata.output, score: 99 } }, 'conflict'],
      [{ ...settledMetadata, input: { inquiry: { type: 'demo_request', text: 'Missing submitted date.' } } }, 'failed'],
      [
        {
          ...settledMetadata,
          input: {
            inquiry: {
              type: 'demo_request',
              occurredAt: new Date(Date.now() + 86_400_000).toISOString(),
              text: 'Invalid future inquiry.',
            },
          },
        },
        'failed',
      ],
    ] as const) {
      fixture.entries.set(entry, structuredClone(settledEntry));
      fixture.set(entry, 'metadata', JSON.stringify(changed));
      fixture.set(entry, 'stage', 'Triage', fixture.member, new Date(Date.now() + 1).toISOString());
      await new Promise(resolve => setTimeout(resolve, 5));
      const delivery = randomUUID();
      await deliver(resumed.app, fixture, [fixture.event(entry, 'stage')], delivery);
      await resumed.app.inputs.get('attio')!.drain!();
      expect(
        (await (resumed.app.inputs.get('attio') as AttioInputProvider).inbox.delivery(delivery))!.events[0]!.state,
      ).toBe(outcome);
      expect(await accepted(resumed.app, entry)).toBe(runId);
      expect(resumed.research.requests).toHaveLength(paid);
    }
    fixture.entries.set(entry, structuredClone(settledEntry));
    const correctedInquiry = {
      type: 'demo_request',
      occurredAt: new Date(Date.now() - 91 * 86_400_000).toISOString(),
      text: 'Corrected submission: the procurement demo request was made earlier.',
    };
    const correctedMetadata = JSON.stringify({ ...settledMetadata, input: { inquiry: correctedInquiry } });
    fixture.set(entry, 'metadata', correctedMetadata);
    fixture.set(entry, 'stage', 'Triage', fixture.member, new Date(Date.now() + 1).toISOString());
    await new Promise(resolve => setTimeout(resolve, 5));
    const expectedRevision = new AttioOutputProvider(fixture.client).revision(fixture.entries.get(entry)!);
    await deliver(resumed.app, fixture, [fixture.event(entry, 'stage')]);
    await resumed.app.inputs.get('attio')!.drain!();
    const linked = await accepted(resumed.app, entry);
    expect(linked).not.toBe(runId);
    expect((await resumed.app.store.get(linked))!.event.lead.inquiry).toEqual(correctedInquiry);
    expect(await resumed.app.reviews.read(linked)).toMatchObject({
      expected: { metadata: correctedMetadata, stage: 'Triage' },
      expectedRevision,
    });
    await resumed.app.dispatcher.start();
    expect((await state(resumed.app, linked, 'applied')).predecessorId).toBe(original.id);
    expect(fixture.client.fields(fixture.entries.get(entry)!)).toMatchObject({ stage: 'Nurture', score: 70 });
    expect(JSON.parse(String(fixture.client.fields(fixture.entries.get(entry)!).metadata)).input.inquiry).toEqual(
      correctedInquiry,
    );
    expect((await resumed.app.store.qualifications.get(runId))!.assessment).toEqual(original);
    expect(await resumed.app.store.reviews.operation(runId, 'final')).toEqual(originalOperation);
  });

  it('protects_compact_metadata_and_preserves_human_history_reopen_and_expiry', async () => {
    const fixture = attioFixture(true);
    const { app, research } = await setup({}, fixture);
    await app.mastra.startWorkers();
    const entry = fixture.add(false);
    await deliver(app, fixture, [fixture.event(entry)]);
    const runId = await accepted(app, entry);
    const pending = await state(app, runId, 'awaiting_review');
    expect(pending.packet!.proposedPatch.presentationVersion).toBe(2);
    const original = (await app.store.qualifications.get(runId))!.assessment!;
    expect(original.facts.buyingIntent.disposition).not.toBe('accepted');
    const untouched = structuredClone(fixture.entries.get(entry)!);
    const metadata = String(fixture.client.fields(untouched).metadata);
    const forged = JSON.parse(metadata);
    forged.input = {
      inquiry: {
        type: 'purchase_inquiry',
        occurredAt: new Date(Date.now() - 1000).toISOString(),
        text: 'Injected after intake',
      },
    };
    fixture.set(entry, 'metadata', JSON.stringify(forged));
    await approve(app, fixture, entry);
    await inboxDone(app);
    expect((await app.reviews.read(runId))!.decision).toBeNull();
    fixture.entries.set(entry, structuredClone(untouched));
    fixture.set(entry, 'stage', 'Qualified', fixture.integration);
    await deliver(app, fixture, [fixture.event(entry, 'stage', fixture.integration)]);
    await inboxDone(app);
    expect((await app.reviews.read(runId))!.decision).toBeNull();
    fixture.entries.set(entry, structuredClone(untouched));
    await new Promise(resolve => setTimeout(resolve, 2));
    const reason = '  Exact SDR justification.\nConfirmed personally.  ';
    await approve(app, fixture, entry, 'Nurture', reason);
    const closed = await state(app, runId, 'applied');
    expect(closed.decision!.input).toMatchObject({ kind: 'attio-stage', stage: 'Nurture', justification: reason });
    expect(fixture.client.fields(fixture.entries.get(entry)!)).toMatchObject({
      reviewJustification: reason,
      score: original.result.score,
      classification: 'nurture',
    });
    const paid = research.requests.length;
    const settledEntry = structuredClone(fixture.entries.get(entry)!);
    const changedInput = JSON.parse(String(fixture.client.fields(settledEntry).metadata));
    changedInput.input = forged.input;
    fixture.set(entry, 'metadata', JSON.stringify(changedInput));
    fixture.set(entry, 'stage', 'Needs review', fixture.member, new Date(Date.now() + 1).toISOString());
    await new Promise(resolve => setTimeout(resolve, 5));
    await deliver(app, fixture, [fixture.event(entry, 'stage')]);
    await inboxDone(app);
    expect((await app.reviews.read(runId))!.state).toBe('applied');
    expect((await app.reviews.read(runId))!.history).toEqual(closed.history);
    expect(research.requests).toHaveLength(paid);
    fixture.entries.set(entry, structuredClone(settledEntry));
    fixture.set(entry, 'stage', 'Needs review', fixture.member, new Date(Date.now() + 1).toISOString());
    await new Promise(resolve => setTimeout(resolve, 5));
    await deliver(app, fixture, [fixture.event(entry, 'stage')]);
    const reopened = await state(app, runId, 'awaiting_review');
    expect(reopened.history[0]!.decision).toEqual(closed.decision);
    expect(reopened.packet!.revision).toBe(2);
    await app.dispatcher.stop();
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(reopened.packet!.expiresAt) + 1);
    await app.reviews.advance(runId);
    now.mockRestore();
    expect((await app.reviews.read(runId))!.state).toBe('expired');
    expect(fixture.client.fields(fixture.entries.get(entry)!)).toMatchObject({
      stage: 'Needs review',
      reviewStatus: 'Expired',
      reviewJustification: reason,
    });
    expect(JSON.parse(String(fixture.client.fields(fixture.entries.get(entry)!).metadata)).input).toEqual({});
    expect(research.requests).toHaveLength(paid);
    expect((await app.store.qualifications.get(runId))!.assessment).toEqual(original);
    const invalid = fixture.add(false);
    fixture.set(
      invalid,
      'metadata',
      JSON.stringify({ version: 2, input: { inquiry: { type: 'purchase_inquiry', text: 'No invented date' } } }),
    );
    const delivery = randomUUID();
    await deliver(app, fixture, [fixture.event(invalid)], delivery);
    await app.inputs.get('attio')!.drain!();
    expect((await (app.inputs.get('attio') as AttioInputProvider).inbox.delivery(delivery))!.events[0]!.state).toBe(
      'failed',
    );
    expect(research.requests).toHaveLength(paid);
    const counterfeit = fixture.add(false);
    fixture.set(counterfeit, 'metadata', metadata);
    const fakeDelivery = randomUUID();
    await deliver(app, fixture, [fixture.event(counterfeit)], fakeDelivery);
    await app.inputs.get('attio')!.drain!();
    expect((await (app.inputs.get('attio') as AttioInputProvider).inbox.delivery(fakeDelivery))!.events[0]!.state).toBe(
      'conflict',
    );
    expect(research.requests).toHaveLength(paid);
  });

  it('routes_attio_automatic_outcomes_and_reviewed_updates', async () => {
    const initial = await setup();
    const { fixture } = initial;
    const entry = fixture.add(),
      delivery = randomUUID();
    await deliver(initial.app, fixture, [fixture.event(entry)], delivery);
    await deliver(initial.app, fixture, [fixture.event(entry)], delivery);
    expect(fixture.transport).not.toHaveBeenCalled();
    await initial.app.close(false);
    const resumed = await setup({}, fixture, { directory: initial.app.directory });
    await resumed.app.mastra.startWorkers();
    const automaticId = await accepted(resumed.app, entry);
    expect(await state(resumed.app, automaticId, 'applied')).toMatchObject({
      decision: null,
      authorization: { kind: 'policy' },
    });
    expect(fixture.client.fields(fixture.entries.get(entry)!)).toMatchObject({
      stage: 'Qualified',
      decisionSource: 'Automatic',
    });
    expect(fixture.entries.get(entry)!.entry_values.owner_note![0]!.value).toBe('Keep this note');
    const beforeDuplicate = resumed.research.requests.length;
    await deliver(resumed.app, fixture, [fixture.event(entry), fixture.event(entry, 'stage', fixture.integration)]);
    await inboxDone(resumed.app);
    expect(resumed.research.requests).toHaveLength(beforeDuplicate);
    expect(initial.research.requests).toHaveLength(0);
    const nurture = fixture.add();
    fixture.set(
      nurture,
      'inquiry',
      JSON.stringify({
        type: 'demo_request',
        occurredAt: new Date(Date.now() - 91 * 86_400_000).toISOString(),
        text: 'Earlier example inquiry.',
      }),
    );
    await deliver(resumed.app, fixture, [fixture.event(nurture)]);
    expect(await state(resumed.app, await accepted(resumed.app, nurture), 'applied')).toMatchObject({
      decision: null,
      authorization: { kind: 'policy' },
    });
    expect(fixture.client.fields(fixture.entries.get(nurture)!)).toMatchObject({
      stage: 'Nurture',
      reviewStatus: 'Not required',
    });
    resumed.research.setScenario({ country: 'JP' });
    const excluded = fixture.add();
    await deliver(resumed.app, fixture, [fixture.event(excluded)]);
    const excludedId = await accepted(resumed.app, excluded);
    const previous = await state(resumed.app, excludedId, 'applied');
    expect(previous).toMatchObject({ decision: null, authorization: { kind: 'policy' } });
    expect(fixture.client.fields(fixture.entries.get(excluded)!)).toMatchObject({ stage: 'Disqualified' });
    const oldAssessment = await resumed.app.store.qualifications.get(excludedId);
    const oldOperation = await resumed.app.store.reviews.operation(excludedId, 'final');
    const callsBeforeInvalid = resumed.research.requests.length;
    for (const actor of [fixture.integration, fixture.system]) {
      fixture.set(excluded, 'stage', 'Triage', actor);
      await deliver(resumed.app, fixture, [fixture.event(excluded, 'stage', actor)]);
      await inboxDone(resumed.app);
    }
    fixture.set(
      excluded,
      'stage',
      'Triage',
      fixture.member,
      new Date(Date.parse(previous.changedAt) - 1).toISOString(),
    );
    await deliver(resumed.app, fixture, [fixture.event(excluded, 'stage')]);
    await inboxDone(resumed.app);
    expect(await accepted(resumed.app, excluded)).toBe(excludedId);
    expect(resumed.research.requests).toHaveLength(callsBeforeInvalid);
    resumed.research.setScenario({});
    fixture.set(excluded, 'reviewJustification', 'Documentation added after the automatic result.');
    fixture.set(excluded, 'stage', 'Triage', fixture.member, new Date(Date.now() + 1).toISOString());
    await new Promise(resolve => setTimeout(resolve, 5));
    const resetDelivery = randomUUID(),
      resetEvents = [fixture.event(excluded, 'stage'), fixture.event(excluded, 'stage'), fixture.event(excluded)];
    await deliver(resumed.app, fixture, resetEvents, resetDelivery);
    await deliver(resumed.app, fixture, resetEvents, resetDelivery);
    await vi.waitFor(async () => expect(await accepted(resumed.app, excluded)).not.toBe(excludedId));
    const nextId = await accepted(resumed.app, excluded);
    expect((await state(resumed.app, nextId, 'applied')).predecessorId).toBe(previous.assessmentId);
    expect(await resumed.app.store.qualifications.get(excludedId)).toEqual(oldAssessment);
    expect(await resumed.app.store.reviews.operation(excludedId, 'final')).toEqual(oldOperation);
    expect(
      (
        await resumed.app.store.client.execute({
          sql: 'SELECT run_id FROM lead_runs WHERE destination_reference=?',
          args: [excluded],
        })
      ).rows,
    ).toHaveLength(2);
    resumed.research.setScenario({ employees: null });
    const review = fixture.add();
    await deliver(resumed.app, fixture, [fixture.event(review)]);
    const reviewedId = await accepted(resumed.app, review);
    const published = await state(resumed.app, reviewedId, 'awaiting_review');
    const assessmentBefore = await resumed.app.store.qualifications.get(reviewedId);
    const ignored = randomUUID();
    fixture.set(review, 'classification', 'qualified');
    fixture.set(review, 'reviewStatus', 'Approved');
    await deliver(
      resumed.app,
      fixture,
      [
        fixture.event(review, 'classification'),
        fixture.event(review, 'reviewStatus'),
        fixture.event(review, 'reviewJustification', fixture.integration),
      ],
      ignored,
    );
    await inboxDone(resumed.app);
    expect(
      (await (resumed.app.inputs.get('attio') as AttioInputProvider).inbox.delivery(ignored))!.events.map(
        item => item.state,
      ),
    ).toEqual(['ignored', 'ignored', 'ignored']);
    expect((await resumed.app.reviews.read(reviewedId))!.decision).toBeNull();
    fixture.set(review, 'stage', 'Triage');
    await deliver(resumed.app, fixture, [fixture.event(review, 'stage')]);
    await inboxDone(resumed.app);
    expect(await accepted(resumed.app, review)).toBe(reviewedId);
    fixture.set(review, 'stage', 'Needs review');
    await resumed.app.dispatcher.stop();
    await new Promise(resolve => setTimeout(resolve, 2));
    await approve(resumed.app, fixture, review);
    await resumed.app.inputs.get('attio')!.drain!();
    expect((await resumed.app.reviews.read(reviewedId))!.decision!.input).toMatchObject({
      kind: 'attio-stage',
      stage: 'Qualified',
      justification: null,
    });
    await resumed.app.close(false);
    const restarted = await setup({}, fixture, { directory: resumed.app.directory });
    await restarted.app.mastra.startWorkers();
    const closed = await state(restarted.app, reviewedId, 'applied');
    expect(closed.decision!.reviewer).toEqual({
      provider: 'attio',
      workspaceId: fixture.config.workspaceId,
      memberId: fixture.member.id,
    });
    expect(fixture.client.fields(fixture.entries.get(review)!)).toMatchObject({
      stage: 'Qualified',
      classification: 'qualified',
      reviewStatus: 'Approved',
      decisionSource: 'SDR',
      reviewJustification: null,
      nextAction: expect.stringContaining('SDR conclusion: Qualified.'),
    });
    expect(restarted.research.requests).toHaveLength(0);
    const finalOperation = await restarted.app.store.reviews.operation(reviewedId, 'final');
    const closedRaw = (
      await restarted.app.store.client.execute({
        sql: 'SELECT packet_json,decision_json,authorization_json FROM lead_cycles WHERE run_id=?',
        args: [reviewedId],
      })
    ).rows[0];
    const unchangedDecision = closed.decision;
    const documentation = '  SDR employeeCount note.\nKeep [my wording](https://example.com/review).  ';
    fixture.set(review, 'reviewJustification', documentation);
    fixture.set(review, 'classification', 'disqualified');
    fixture.set(review, 'reviewStatus', 'Changes requested');
    fixture.set(review, 'stage', 'Nurture');
    await deliver(restarted.app, fixture, [
      fixture.event(review, 'stage'),
      fixture.event(review, 'reviewStatus'),
      fixture.event(review, 'classification'),
      fixture.event(review, 'reviewJustification'),
    ]);
    await inboxDone(restarted.app);
    expect((await restarted.app.reviews.read(reviewedId))!.decision).toEqual(unchangedDecision);
    expect(restarted.research.requests).toHaveLength(0);
    const documentedEntry = structuredClone(fixture.entries.get(review)!);
    fixture.set(review, 'score', 1);
    fixture.set(review, 'stage', 'Needs review');
    await deliver(restarted.app, fixture, [fixture.event(review, 'stage')]);
    await inboxDone(restarted.app);
    expect((await restarted.app.reviews.read(reviewedId))!.state).toBe('applied');
    expect((await restarted.app.reviews.read(reviewedId))!.history).toHaveLength(0);
    fixture.entries.set(review, documentedEntry);
    // Reopen the same run after its native workflow has completed, without any new model call.
    await vi.waitFor(async () =>
      expect((await restarted.app.intake.workflow.getWorkflowRunById(reviewedId))?.status).toBe('success'),
    );
    fixture.set(review, 'stage', 'Needs review', fixture.member, new Date(Date.now() + 1).toISOString());
    await new Promise(resolve => setTimeout(resolve, 5));
    const reopenEvents = [fixture.event(review, 'stage'), fixture.event(review, 'stage')];
    await deliver(restarted.app, fixture, reopenEvents);
    const reopened = await state(restarted.app, reviewedId, 'awaiting_review');
    expect(reopened.packet!.id).not.toBe(published.packet!.id);
    expect(reopened.packet!.revision).toBe(2);
    expect(Date.parse(reopened.packet!.expiresAt)).toBeGreaterThan(Date.parse(published.packet!.expiresAt));
    expect(reopened.history).toHaveLength(1);
    expect(
      (
        await restarted.app.store.client.execute({
          sql: 'SELECT packet_json,decision_json,authorization_json FROM lead_review_history WHERE run_id=? AND revision=1',
          args: [reviewedId],
        })
      ).rows[0],
    ).toEqual(closedRaw);
    expect(fixture.client.fields(fixture.entries.get(review)!).reviewJustification).toBe(documentation);
    expect(reopened.history[0]).toMatchObject({
      revision: 1,
      packet: closed.packet,
      decision: closed.decision,
      authorization: closed.authorization,
    });
    expect(await restarted.app.store.reviews.operation(reviewedId, 'final')).toEqual(finalOperation);
    expect(await restarted.app.store.qualifications.get(reviewedId)).toEqual(assessmentBefore);
    expect(restarted.research.requests).toHaveLength(0);
    const manualPacket = reopened.packet;
    await restarted.app.close(false);
    const manualRestart = await setup({}, fixture, { directory: restarted.app.directory });
    await manualRestart.app.mastra.startWorkers();
    expect((await manualRestart.app.reviews.read(reviewedId))!.packet).toEqual(manualPacket);
    fixture.set(review, 'stage', 'Qualified', fixture.member, closed.decision!.decidedAt);
    await deliver(manualRestart.app, fixture, [fixture.event(review, 'stage')]);
    await inboxDone(manualRestart.app);
    expect((await manualRestart.app.reviews.read(reviewedId))!.decision).toBeNull();
    await approve(manualRestart.app, fixture, review, 'Nurture', documentation);
    const resolved = await state(manualRestart.app, reviewedId, 'applied');
    expect(resolved.packet!.revision).toBe(2);
    expect(resolved.decision!.input).toMatchObject({
      kind: 'attio-stage',
      stage: 'Nurture',
      justification: documentation,
    });
    expect(fixture.client.fields(fixture.entries.get(review)!)).toMatchObject({
      stage: 'Nurture',
      classification: 'nurture',
      reviewJustification: documentation,
      nextAction: expect.stringContaining('SDR conclusion: Nurture.'),
    });
    expect((await manualRestart.app.store.reviews.operation(reviewedId, 'final', 2))!.id).toBe(`${reviewedId}:final:2`);
    expect(await manualRestart.app.store.reviews.operation(reviewedId, 'final')).toEqual(finalOperation);
    expect(manualRestart.research.requests).toHaveLength(0);
    const salesId = randomUUID(),
      sales = fixture.config.sales!;
    const text = (value: unknown): AttioValue => ({ ...fixture.value('summary', ''), value });
    fixture.entries.set(salesId, {
      id: { workspace_id: fixture.config.workspaceId, list_id: sales.listId, entry_id: salesId },
      parent_object: fixture.config.companyObjectId,
      parent_record_id: randomUUID(),
      entry_values: {
        [sales.stage.slug]: [
          { ...text(''), attribute_type: 'status', status: { id: { status_id: sales.wonOptionId } } },
        ],
        [sales.assessmentId.slug]: [text(resolved.assessmentId)],
        [sales.cycleId.slug]: [text(reviewedId)],
      },
    });
    const salesEvent = {
      event_type: 'list-entry.updated',
      id: {
        workspace_id: fixture.config.workspaceId,
        list_id: sales.listId,
        entry_id: salesId,
        attribute_id: sales.stage.id,
      },
      actor: fixture.member,
    };
    await deliver(manualRestart.app, fixture, [salesEvent, salesEvent]);
    await inboxDone(manualRestart.app);
    expect((await manualRestart.app.store.client.execute('SELECT * FROM lead_sales_outcomes')).rows).toHaveLength(1);
    expect(manualRestart.research.requests).toHaveLength(0);
  });

  it('publishes_actionable_reasons_and_routes_to_needs_review', async () => {
    for (const scenario of [{ employees: null }, { conflict: true }]) {
      const { app, fixture } = await setup(scenario);
      await app.mastra.startWorkers();
      const entry = fixture.add();
      await deliver(app, fixture, [fixture.event(entry)]);
      const runId = await accepted(app, entry),
        cycle = await state(app, runId, 'awaiting_review');
      const fields = fixture.client.fields(fixture.entries.get(entry)!);
      expect(fields).toMatchObject({
        classification: 'needs_review',
        stage: 'Needs review',
        reviewStatus: 'Awaiting review',
      });
      expect(fields.summary).toEqual(expect.stringContaining('Assessment outcome: Needs review'));
      expect(fields.reviewReasons).toEqual(expect.stringContaining('Employees'));
      expect(fields.evidenceLinks).toEqual(expect.stringContaining('https://example.com/'));
      expect([fields.summary, fields.reviewReasons, fields.gaps, fields.evidenceLinks].join(' ')).not.toMatch(
        /employeeCount|evidenceIds|\[[^\]]+\]\(|submitted:|openai-web:/,
      );
      expect(cycle.packet!.proposedPatch.presentationVersion).toBe(1);
      const assessment = (await app.store.qualifications.get(runId))!.assessment!;
      expect(assessment.summary).toContain('employeeCount');
      expect(await app.store.reviews.operation(runId, 'final')).toBeNull();
      if (scenario.conflict) {
        await recoverAuthorizedReview(app, fixture, entry, runId);
        continue;
      }
      // An already published old packet completes with its original exact array projection.
      await app.dispatcher.stop();
      const historical = await historicalReview(app, fixture, runId);
      const reason = '  Exact SDR wording.\nDocumentation is optional.  ';
      await approve(app, fixture, entry, 'Disqualified', reason);
      await app.inputs.get('attio')!.drain!();
      await app.dispatcher.start();
      const decided = await state(app, runId, 'applied');
      expect(fixture.client.fields(fixture.entries.get(entry)!)).toMatchObject({
        stage: 'Disqualified',
        reviewStatus: 'Approved',
        reviewJustification: reason,
        evidenceLinks: expect.any(Array),
      });
      expect(decided.packet).toEqual(historical.packet);
      expect((await app.store.qualifications.get(runId))!.assessment).toEqual(historical.assessment);
      // Read a real legacy decision shape, then retain it verbatim when a new manual revision opens.
      const legacyDecision = {
        ...decided.decision!,
        input: {
          runId,
          reviewId: historical.packet.id,
          revision: 1,
          digest: historical.packet.digest,
          decision: 'approved',
          override: { classification: 'disqualified', reason },
        },
      };
      await app.store.client.execute({
        sql: 'UPDATE lead_cycles SET decision_json=? WHERE run_id=?',
        args: [JSON.stringify(legacyDecision), runId],
      });
      expect((await app.reviews.read(runId))!.decision).toEqual(legacyDecision);
      fixture.set(entry, 'stage', 'Needs review', fixture.member, new Date(Date.now() + 1).toISOString());
      await new Promise(resolve => setTimeout(resolve, 5));
      await deliver(app, fixture, [fixture.event(entry, 'stage')]);
      const reopened = await state(app, runId, 'awaiting_review');
      expect(reopened.history[0]!.decision).toEqual(legacyDecision);
      expect(fixture.client.fields(fixture.entries.get(entry)!).evidenceLinks).toEqual(expect.any(String));
      await app.close();
    }
  });

  it('rejects_invalid_attio_events_and_stale_approvals', async () => {
    const { app, fixture, research } = await setup({ employees: null });
    const entry = fixture.add();
    expect((await deliver(app, fixture, [fixture.event(entry)], randomUUID(), 'bad')).status).toBe(401);
    expect((await app.post({})).status).toBe(404);
    expect((await app.http.request('/api/workflows')).status).toBe(401);
    const foreign = fixture.event(entry);
    foreign.id.list_id = randomUUID();
    await deliver(app, fixture, [foreign, fixture.event(entry, 'summary')]);
    await app.mastra.startWorkers();
    await inboxDone(app);
    expect(research.requests).toHaveLength(0);
    expect(fixture.transport).not.toHaveBeenCalled();
    const delivery = randomUUID();
    await deliver(app, fixture, [fixture.event(entry)], delivery);
    expect((await deliver(app, fixture, [foreign], delivery)).status).toBe(400);
    const runId = await accepted(app, entry),
      cycle = await state(app, runId, 'awaiting_review'),
      packet = cycle.packet!;
    expect(
      (
        await app.http.request('/lead-qualification/reviews', {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${productionToken}` },
          body: JSON.stringify({
            runId,
            reviewId: packet.id,
            revision: 1,
            digest: packet.digest,
            decision: 'approved',
            override: { classification: 'qualified', reason: 'Confirmed.' },
          }),
        })
      ).status,
    ).toBe(409);
    const unchanged = structuredClone(fixture.entries.get(entry)!);
    for (const { actor, timestamp } of [
      { actor: fixture.integration },
      { actor: fixture.system },
      { actor: { type: 'workspace-member' as const, id: randomUUID() } },
      { actor: fixture.member, timestamp: new Date(Date.parse(cycle.publishedAt!) - 1).toISOString() },
      { actor: fixture.member, timestamp: new Date(Date.now() + 10000).toISOString() },
    ]) {
      fixture.entries.set(entry, structuredClone(unchanged));
      fixture.set(entry, 'stage', 'Qualified', fixture.member, timestamp);
      await deliver(app, fixture, [fixture.event(entry, 'stage', actor)]);
      await inboxDone(app);
      expect((await app.reviews.read(runId))!.decision).toBeNull();
    }
    fixture.entries.set(entry, structuredClone(unchanged));
    await app.dispatcher.stop();
    await deliver(app, fixture, [fixture.event(entry, 'stage')]);
    fixture.set(entry, 'stage', 'Qualified', fixture.member, new Date(Date.now() + 10_000).toISOString());
    await app.dispatcher.start();
    await inboxDone(app);
    expect((await app.reviews.read(runId))!.decision).toBeNull();
    for (const [name, value] of [
      ['summary', 'Edited summary'],
      ['reviewRevision', 2],
      ['evidenceLinks', `${String(fixture.client.fields(unchanged).evidenceLinks)} `],
    ] as const) {
      fixture.entries.set(entry, structuredClone(unchanged));
      fixture.set(entry, name, value);
      await approve(app, fixture, entry);
      await inboxDone(app);
      expect((await app.reviews.read(runId))!.decision).toBeNull();
      expect(await app.store.reviews.operation(runId, 'final')).toBeNull();
    }
    fixture.entries.set(entry, structuredClone(unchanged));
    const oversized = 'x'.repeat(2001);
    await approve(app, fixture, entry, 'Qualified', oversized);
    await inboxDone(app);
    expect((await app.reviews.read(runId))!.decision).toBeNull();
    expect(fixture.client.fields(fixture.entries.get(entry)!).reviewJustification).toBe(oversized);
    expect(
      (
        await app.store.client.execute(
          "SELECT * FROM lead_attio_events WHERE failure_code='attio_justification_too_long'",
        )
      ).rows,
    ).toHaveLength(1);
    fixture.setDomains(['example.com', 'other.example']);
    const ambiguous = fixture.add();
    await deliver(app, fixture, [fixture.event(ambiguous)]);
    const ambiguousId = await accepted(app, ambiguous);
    const unresolved = await state(app, ambiguousId, 'awaiting_review');
    expect(unresolved.packet!.proposedPatch.reviewReasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'identity_unresolved' })]),
    );
    expect((await app.store.get(ambiguousId))!.event.lead.domain).toBeUndefined();
    await approve(app, fixture, ambiguous);
    await inboxDone(app);
    expect((await app.reviews.read(ambiguousId))!.decision).toBeNull();
    expect(
      (await app.store.client.execute("SELECT * FROM lead_attio_events WHERE failure_code='attio_identity_unresolved'"))
        .rows,
    ).toHaveLength(1);
    fixture.setDomains(['example.com']);
    const edited = fixture.add();
    await deliver(app, fixture, [fixture.event(edited)]);
    const editedId = await accepted(app, edited);
    await state(app, editedId, 'awaiting_review');
    await app.dispatcher.stop();
    await approve(app, fixture, edited);
    await app.inputs.get('attio')!.drain!();
    const decided = (await app.reviews.read(editedId))!;
    expect(decided.expected).toMatchObject({ stage: 'Qualified', reviewJustification: null });
    fixture.set(edited, 'stage', 'Qualified', fixture.member, new Date(Date.now() + 1).toISOString());
    await app.reviews.advance(editedId);
    expect((await app.reviews.read(editedId))!.state).toBe('conflict');
    expect((await app.store.reviews.operation(editedId, 'final'))!.state).toBe('conflict');
  });

  it('handles_attio_rate_limits_conflicts_and_uncertain_writes', async () => {
    const { app, fixture, research } = await setup();
    const entry = fixture.add();
    fixture.fault({ status: 429, remaining: 1, retryAfter: '0.05' });
    await deliver(app, fixture, [fixture.event(entry)]);
    await app.mastra.startWorkers();
    const runId = await accepted(app, entry);
    await state(app, runId, 'applied');
    expect((await app.store.client.execute('SELECT attempts FROM lead_attio_events')).rows[0]!.attempts).toBe(2);
    const qualification = await app.store.qualifications.get(runId);
    const operation = await app.store.reviews.operation(runId, 'final');
    const entryCount = fixture.entries.size,
      writeCount = fixture.writes.length,
      researchCount = research.requests.length;
    const beforePoll = fixture.transport.mock.calls.length;
    fixture.fault({ status: 503, remaining: 1 });
    const observed = await observeAttioEntry(
      fixture.client,
      entry,
      fields => fields.cycleId === runId && fields.stage === 'Qualified',
      Date.now() + 2000,
    );
    expect(observed.cycleId).toBe(runId);
    expect(fixture.transport.mock.calls.slice(beforePoll)).toHaveLength(2);
    expect(
      fixture.transport.mock.calls
        .slice(beforePoll)
        .every(
          ([url, init]) =>
            (url instanceof Request ? url.url : url instanceof URL ? url.href : url).endsWith(`/entries/${entry}`) &&
            init?.method === 'GET',
        ),
    ).toBe(true);
    let lastObserved: Record<string, unknown> = {};
    const beforeExhaustion = fixture.transport.mock.calls.length;
    await expect(
      observeAttioEntry(
        fixture.client,
        entry,
        () => false,
        Date.now() + 2000,
        fields => {
          lastObserved = fields;
          fixture.fault({ status: 503, remaining: 10 });
        },
        0,
      ),
    ).rejects.toMatchObject({
      code: 'attio_http_503',
      retryable: true,
    });
    expect(fixture.transport.mock.calls.length - beforeExhaustion).toBe(fixture.config.limits.maxAttempts + 1);
    expect(lastObserved.cycleId).toBe(runId);
    fixture.fault({ status: 429, remaining: 10, retryAfter: new Date(Date.now() + 60_000).toUTCString() });
    const beforeLongWait = fixture.transport.mock.calls.length;
    await expect(observeAttioEntry(fixture.client, entry, () => true, Date.now() + 2000)).rejects.toMatchObject({
      code: 'attio_http_429',
    });
    expect(fixture.transport.mock.calls.length - beforeLongWait).toBe(1);
    fixture.fault({ status: 404, remaining: 10 });
    const beforePermanent = fixture.transport.mock.calls.length;
    await expect(observeAttioEntry(fixture.client, entry, () => true, Date.now() + 2000)).rejects.toMatchObject({
      code: 'attio_http_404',
      retryable: false,
    });
    expect(fixture.transport.mock.calls.length - beforePermanent).toBe(1);
    fixture.fault(undefined);
    expect(fixture.entries.size).toBe(entryCount);
    expect(fixture.writes).toHaveLength(writeCount);
    expect(research.requests).toHaveLength(researchCount);
    expect(await app.store.qualifications.get(runId)).toEqual(qualification);
    expect(await app.store.reviews.operation(runId, 'final')).toEqual(operation);

    const missing = randomUUID();
    await deliver(app, fixture, [fixture.event(missing)]);
    await inboxDone(app);
    expect(
      (await app.store.client.execute("SELECT * FROM lead_attio_events WHERE failure_code='attio_http_404'")).rows,
    ).toHaveLength(1);
    const conflicted = fixture.add();
    await app.dispatcher.stop();
    await deliver(app, fixture, [fixture.event(conflicted)]);
    await app.inputs.get('attio')!.drain!();
    const conflictId = await accepted(app, conflicted);
    fixture.set(conflicted, 'stage', 'Nurture');
    await app.dispatcher.start();
    await state(app, conflictId, 'conflict');
    expect(fixture.client.fields(fixture.entries.get(conflicted)!)).toMatchObject({ stage: 'Nurture' });
    const uncertain = fixture.add();
    await app.dispatcher.stop();
    await deliver(app, fixture, [fixture.event(uncertain)]);
    await app.inputs.get('attio')!.drain!();
    const uncertainId = await accepted(app, uncertain);
    fixture.fault({ after: true, remaining: 1 });
    await app.dispatcher.start();
    await vi.waitFor(async () =>
      expect((await app.store.reviews.operation(uncertainId, 'final'))?.state).toBe('uncertain'),
    );
    await app.close(false);
    const writes = fixture.writes.length;
    const restarted = await setup({}, fixture, { directory: app.directory });
    await restarted.app.mastra.startWorkers();
    await state(restarted.app, uncertainId, 'applied');
    expect(fixture.writes).toHaveLength(writes);
    expect(restarted.research.requests).toHaveLength(0);
    const failed = fixture.add();
    await restarted.app.dispatcher.stop();
    await deliver(restarted.app, fixture, [fixture.event(failed)]);
    await restarted.app.inputs.get('attio')!.drain!();
    const failedId = await accepted(restarted.app, failed);
    fixture.fault({ status: 429, remaining: 10, retryAfter: new Date(Date.now() + 60_000).toUTCString() });
    await restarted.app.dispatcher.start();
    await state(restarted.app, failedId, 'failed');
    const failure = await restarted.app.reviews.read(failedId);
    expect(failure).toMatchObject({ active: true, attempts: 1, failureCode: 'attio_http_429' });
    const requests = fixture.transport.mock.calls.length;
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(fixture.transport).toHaveBeenCalledTimes(requests);
    expect(research.requests.length).toBeGreaterThan(0);
    const legacyFixture = attioFixture();
    legacyFixture.config.limits.retryDelayMs = 1000;
    const beforeJournal = await setup({}, legacyFixture);
    const legacyEntry = legacyFixture.add();
    await deliver(beforeJournal.app, legacyFixture, [legacyFixture.event(legacyEntry)]);
    await beforeJournal.app.inputs.get('attio')!.drain!();
    const legacyId = await accepted(beforeJournal.app, legacyEntry);
    legacyFixture.fault({ status: 503, remaining: 20 });
    await beforeJournal.app.mastra.startWorkers();
    await vi.waitFor(async () =>
      expect((await beforeJournal.app.reviews.read(legacyId))!.authorization).not.toBeNull(),
    );
    await beforeJournal.app.dispatcher.stop();
    const newPending = await beforeJournal.app.store.reviews.operation(legacyId, 'final');
    expect(newPending?.state).toBe('pending');
    expect(legacyFixture.writes).toHaveLength(0);
    // Seed the older crash boundary, before journal creation and before admission captured destination state.
    await beforeJournal.app.store.client.execute({
      sql: "DELETE FROM lead_output_operations WHERE id=? AND state='pending'",
      args: [newPending!.id],
    });
    await beforeJournal.app.store.client.execute({
      sql: 'UPDATE lead_cycles SET expected_json=NULL,expected_revision=NULL WHERE run_id=?',
      args: [legacyId],
    });
    expect(await beforeJournal.app.store.reviews.operation(legacyId, 'final')).toBeNull();
    const legacyAssessment = (await beforeJournal.app.store.qualifications.get(legacyId))!.assessment!;
    const legacyPatch = historicalPatch(
      { ...operation!.patch, assessmentId: legacyAssessment.id, cycleId: legacyId },
      legacyAssessment,
    );
    const prepared = (await beforeJournal.app.reviews.read(legacyId))!;
    const oldAuthorization = { ...prepared.authorization!, patchDigest: digestValue(legacyPatch) };
    legacyFixture.fault(undefined);
    await beforeJournal.app.store.client.execute({
      sql: 'UPDATE lead_cycles SET authorization_json=?,next_retry_at=0 WHERE run_id=?',
      args: [JSON.stringify({ ...oldAuthorization, patchDigest: '0'.repeat(64) }), legacyId],
    });
    const writesBeforeBlocked = legacyFixture.writes.length;
    await beforeJournal.app.reviews.advance(legacyId);
    expect((await beforeJournal.app.reviews.read(legacyId))!.state).toBe('failed');
    expect(legacyFixture.writes).toHaveLength(writesBeforeBlocked);
    await beforeJournal.app.store.client.execute({
      sql: "UPDATE lead_cycles SET authorization_json=?,state='applying',attempts=0,next_retry_at=0,failure_code=NULL WHERE run_id=?",
      args: [JSON.stringify(oldAuthorization), legacyId],
    });
    await beforeJournal.app.close(false);
    const legacyRestart = await setup({}, legacyFixture, { directory: beforeJournal.app.directory });
    await legacyRestart.app.mastra.startWorkers();
    await state(legacyRestart.app, legacyId, 'applied');
    expect(legacyRestart.research.requests).toHaveLength(0);
    expect((await legacyRestart.app.store.reviews.operation(legacyId, 'final'))!.patch).toEqual(legacyPatch);
    expect(legacyFixture.client.fields(legacyFixture.entries.get(legacyEntry)!)).toMatchObject({
      stage: 'Qualified',
      evidenceLinks: expect.any(Array),
    });
    expect((await legacyRestart.app.store.qualifications.get(legacyId))!.assessment).toEqual(legacyAssessment);
  });
});
