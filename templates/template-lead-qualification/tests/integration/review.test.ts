import { sourcePassages } from '../../src/mastra/research/source-passages';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { RequestContext } from '@mastra/core/request-context';
import { createClient } from '@libsql/client';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { event, harness, productionToken } from '../support/application';
import { controlledHarness, controlledResearch, pageResponse } from '../support/research';
import type { ResearchScenario } from '../support/research';
import { LocalOutputProvider } from '../../src/mastra/providers/local/output';
import { ownedState } from '../../src/mastra/providers/output';
import type { OutputProvider } from '../../src/mastra/providers/output';
import { qualificationConfig } from '../../src/mastra/config/qualification';
import { digestValue } from '../../src/mastra/review/contracts';
import type { DecisionInput } from '../../src/mastra/review/contracts';
import type { Assessment } from '../../src/mastra/research/contracts';

type App = Awaited<ReturnType<typeof harness>>;
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function setup(scenario: ResearchScenario = {}, options: Parameters<typeof harness>[0] = {}) {
  const { app, controlled: research } = await controlledHarness(options, controlledResearch(scenario));
  cleanup.push(() => app.close());
  await app.mastra.startWorkers();
  return { app, research };
}
async function submit(app: App, id: string, extra: Record<string, unknown> = {}, inquiry: boolean | 'old' = false) {
  const response = await app.post({
    ...event(id, {
      domain: 'example.com',
      ...(inquiry
        ? {
            inquiry: {
              type: 'demo_request',
              occurredAt: new Date(Date.now() - (inquiry === 'old' ? 91 * 86_400_000 : 1000)).toISOString(),
              text: 'Please demonstrate the product to our purchasing team.',
            },
          }
        : {}),
    }),
    ...extra,
  });
  expect(response.status).toBe(202);
  return (await response.json()).runId as string;
}
async function waitState(app: App, runId: string, state: string) {
  await vi.waitFor(
    async () => {
      expect((await app.reviews.read(runId))?.state).toBe(state);
      expect((await app.store.get(runId))?.status).toBe('intake_received');
    },
    { timeout: 20_000 },
  );
  return (await app.reviews.read(runId))!;
}
async function decision(app: App, runId: string, changes: Partial<DecisionInput> = {}) {
  const packet = (await app.reviews.read(runId))!.packet!;
  return {
    runId,
    reviewId: packet.id,
    revision: 1 as const,
    digest: packet.digest,
    decision: 'approved' as const,
    override: {
      classification: 'qualified' as const,
      reason: 'Confirmed the required team size directly with the company.',
    },
    ...changes,
  };
}
function review(app: App, input: unknown, headers: Record<string, string> = {}) {
  return app.http.request('/lead-qualification/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(input),
  });
}
async function destination(app: App, reference: string) {
  return (await new LocalOutputProvider(app.store.client).read({ providerId: 'local', reference }))!;
}
function faultOutput() {
  let local: LocalOutputProvider;
  let blocked = false;
  let failAfterApply = true;
  const apply = vi.fn<OutputProvider['apply']>(async (...args) => {
    await local.apply(...args);
    if (failAfterApply) {
      blocked = true;
      throw new Error('Response lost after durable write');
    }
  });
  const provider: OutputProvider = {
    id: 'local',
    read: async target => {
      if (blocked) throw new Error('Read-back temporarily unavailable');
      return local.read(target);
    },
    apply,
  };
  return {
    provider,
    apply,
    bind(app: App) {
      local = new LocalOutputProvider(app.store.client);
    },
    recover() {
      blocked = false;
      failAfterApply = false;
    },
  };
}

describe('review and output', () => {
  it('automatically_applies_default_supported_employee_estimates_and_reviews_unresolved_decisive_facts', async () => {
    const { app, research } = await setup();
    const inference = {
      rationale:
        'The approximate employee count supports this finite interval, allowing for uncertainty around the stated workforce.',
      additionalPassages: [],
    };
    const lowerInference = {
      rationale:
        'The 150+ staff statement gives a known minimum. Assuming a rounded public milestone and moderate unreported growth, 150–240 is a working estimate; 240 is uncertain and is not a declared ceiling.',
      additionalPassages: [],
    };
    const rosterInference = {
      rationale:
        'Assuming these 30 distinct current staff profiles cover the main departments, 30–60 is a working estimate allowing for unlisted colleagues. Roster completeness is uncertain; 60 is not an observed ceiling.',
      additionalPassages: [],
    };
    const automatic: Array<{ assessment: Assessment; scenario: ResearchScenario }> = [];
    for (const [id, change, inquiry, expected, score] of [
      ['estimated-qualified', {}, true, 'qualified', 100],
      ['estimated-nurture', {}, 'old', 'nurture', 70],
      [
        'lower-cue-qualified',
        {
          employees: { min: 150, max: 240 },
          employeeQuote: '150+ employees',
          employeeObservation: { value: { min: 150, max: null }, quote: '150+ employees' },
          employeeInference: lowerInference,
        },
        true,
        'qualified',
        100,
      ],
      [
        'roster-cue-nurture',
        {
          employees: { min: 30, max: 60 },
          employeeQuote: 'Meet our team: 30 staff profiles across engineering, sales and operations.',
          employeeInference: rosterInference,
        },
        'old',
        'nurture',
        70,
      ],
      ['missing-employees', { employees: null }, true, 'needs_review', 75],
      ['estimated-missing-headquarters', { country: null }, true, 'needs_review', 85],
      ['estimated-missing-business', { businessModel: null }, true, 'needs_review', 70],
      ['estimated-missing-inquiry', {}, false, 'needs_review', 70],
      ['unsupported-estimate', { rejectEmployee: true }, true, 'needs_review', 75],
      ['conflicting-estimate', { conflict: true }, true, 'needs_review', 75],
      ['stale-estimate', { asOf: new Date(Date.now() - 31 * 86_400_000).toISOString() }, true, 'needs_review', 30],
      [
        'boundary-estimate',
        { employees: { min: 10, max: 50 }, employeeQuote: 'about 30 employees' },
        true,
        'needs_review',
        75,
      ],
    ] as const) {
      const scenario: ResearchScenario = {
        employees: { min: 180, max: 220 },
        employeeQuote: 'about 200 employees',
        employeeInference: inference,
        ...change,
      };
      research.setScenario(scenario);
      vi.mocked(research.transport.request).mockImplementation(async () =>
        pageResponse(
          [
            scenario.businessModel === null ? '' : 'Example sells subscription cloud software to businesses.',
            scenario.employees === null ? '' : `Our team has ${scenario.employeeQuote}.`,
            scenario.country === null ? '' : 'Headquarters: United States.',
            scenario.conflict ? 'A separate report lists 400 employees.' : '',
            typeof scenario.asOf === 'string' ? `These facts apply as of ${scenario.asOf}.` : '',
          ].join(' '),
        ),
      );
      const runId = await submit(app, id, {}, inquiry);
      const requiresReview = expected === 'needs_review';
      const cycle = await waitState(app, runId, requiresReview ? 'awaiting_review' : 'applied');
      const assessment = (await app.store.qualifications.get(runId))!.assessment!;
      expect(assessment.snapshot.config.policy.rules.employeeCount.estimates).toBe('accept');
      expect(assessment.result).toMatchObject({ classification: expected, score, requiresReview });
      expect(cycle.authorization?.kind ?? null).toBe(requiresReview ? null : 'policy');
      expect(cycle.decision).toBeNull();
      expect(Boolean(cycle.packet)).toBe(requiresReview);
      expect((await destination(app, id)).fields).toMatchObject({
        classification: expected,
        score,
        decisionSource: requiresReview ? null : 'Automatic',
        reviewStatus: requiresReview ? 'Awaiting review' : 'Not required',
      });
      if (!requiresReview) automatic.push({ assessment, scenario });
    }
    expect(automatic).toHaveLength(4);
    for (const { assessment, scenario } of automatic) {
      expect(assessment.facts.employeeCount).toMatchObject({
        disposition: 'accepted',
        basis: 'inferred',
        value: scenario.employees,
      });
      const employeeInference = assessment.inferences.find(item => item.attribute === 'employeeCount')!;
      expect(employeeInference.rationale).toBe(scenario.employeeInference!.rationale);
      expect(employeeInference.passages).toHaveLength(1);
      for (const passage of employeeInference.passages) {
        const source = assessment.evidence.find(source => source.id === passage.evidenceId)!;
        expect(passage.quote).toBe(sourcePassages([source])[0]!.quote);
        expect(passage.quote).toContain(scenario.employeeQuote);
        expect(assessment.facts.employeeCount.evidenceIds).toContain(passage.evidenceId);
        expect(assessment.evidence.find(source => source.id === passage.evidenceId)!.excerpt).toContain(passage.quote);
      }
      expect(assessment.result.contributions.find(rule => rule.rule === 'employeeCount')!.reason).toContain(
        `Inferred employee estimate ${scenario.employees!.min}–${scenario.employees!.max ?? 'open'}`,
      );
    }
    const lower = automatic[2]!.assessment;
    const checkpoint = (await app.store.qualifications.round(lower.runId, 0))!;
    expect(checkpoint.result.candidates).toContainEqual(
      expect.objectContaining({ attribute: 'employeeCount', value: { min: 150, max: null } }),
    );
    expect(
      checkpoint.result.candidates.find(candidate => candidate.attribute === 'employeeCount' && !candidate.inference)
        ?.inference ?? null,
    ).toBeNull();
    expect(lower.facts.employeeCount.candidateIds).toHaveLength(2);
  });

  it('applies_only_confirmed_automatic_outcomes_without_human_approval', async () => {
    const { app, research } = await setup();
    for (const [id, scenario, inquiry, expected] of [
      ['qualified', {}, true, 'qualified'],
      ['nurture', {}, 'old', 'nurture'],
      ['disqualified', { country: 'JP' }, true, 'disqualified'],
      ['uncertain', { employees: null }, true, 'needs_review'],
      ['conflicting', { conflict: true }, true, 'needs_review'],
      ['identity', { ambiguous: true }, true, 'needs_review'],
      ['missing-intent', {}, false, 'needs_review'],
    ] as const) {
      research.setScenario(scenario);
      const runId = await submit(app, id, {}, inquiry);
      const cycle = await waitState(app, runId, expected === 'needs_review' ? 'awaiting_review' : 'applied');
      const fields = (await destination(app, id)).fields;
      expect(fields.classification).toBe(expected);
      const requiresReview = expected === 'needs_review';
      expect(cycle.authorization?.kind ?? null).toBe(requiresReview ? null : 'policy');
      expect(cycle.decision).toBeNull();
      expect(Boolean(cycle.packet)).toBe(requiresReview);
      expect(fields).toMatchObject({
        decisionSource: requiresReview ? null : 'Automatic',
        reviewStatus: requiresReview ? 'Awaiting review' : 'Not required',
      });
      expect(Array.isArray(fields.reviewReasons) && fields.reviewReasons.length > 0).toBe(requiresReview);
      expect(
        (
          await review(app, {
            runId,
            reviewId: randomUUID(),
            revision: 1,
            digest: 'a'.repeat(64),
            decision: 'approved',
          })
        ).status,
      ).toBe(409);
    }
    expect((await app.post({ ...event('forged-auth'), authorization: { kind: 'policy' } })).status).toBe(400);
  });

  it('serves_authorized_local_markdown_and_text_with_exact_readback_after_restart', async () => {
    const first = await setup();
    const runId = await submit(first.app, 'readable-output', {}, true);
    const cycle = await waitState(first.app, runId, 'applied');
    const operation = (await first.app.store.reviews.operation(runId, 'final'))!;
    expect(cycle.authorization).toMatchObject({ kind: 'policy', patchDigest: digestValue(operation.patch) });
    const url = `/lead-qualification/runs/${runId}/output`;
    const report = await first.app.http.request(url);
    expect(report.status).toBe(200);
    expect(report.headers.get('content-type')).toContain('text/markdown');
    const markdown = await report.text();
    expect(markdown).toContain('# Lead qualification: Qualified');
    expect(markdown).toContain('**Score:** 100/100');
    expect(markdown).toContain('Sources report 40 employees.');
    expect(markdown).toContain('## Next action');
    expect(markdown).toContain('https://example.com/firmographics');
    const text = await first.app.http.request(`${url}?format=text`);
    expect(text.headers.get('content-type')).toContain('text/plain');
    const plain = await text.text();
    expect(plain).toContain('Lead qualification: Qualified');
    expect(plain).toContain('Score: 100/100');
    expect(plain).not.toContain('##');
    const state = (await destination(first.app, 'readable-output'))!;
    expect(state.marker).toBe(operation.id);
    expect(state.fields.reportMarkdown).toBe(markdown);
    expect(state.fields.reportText).toBe(plain);
    expect((await first.app.http.request(`${url}?format=html`)).status).toBe(400);
    await first.app.close(false);
    const resumed = await setup({}, { directory: first.app.directory });
    expect(await (await resumed.app.http.request(url)).text()).toBe(markdown);
    expect(resumed.research.requests).toHaveLength(0);
    await resumed.app.store.client.execute({
      sql: "UPDATE lead_local_destinations SET fields_json=json_set(fields_json,'$.reportMarkdown','Changed report') WHERE reference=?",
      args: ['readable-output'],
    });
    expect((await resumed.app.http.request(url)).status).toBe(409);
  });

  it('resumes_persisted_review_and_applies_approved_patch', async () => {
    const first = await setup({ employees: null });
    const runId = await submit(first.app, 'restart-review', {}, true);
    const cycle = await waitState(first.app, runId, 'awaiting_review');
    const before = await first.app.store.qualifications.get(runId);
    expect((await first.app.intake.workflow.getWorkflowRunById(runId))?.status).toBe('suspended');
    await first.app.store.client.execute({
      sql: "UPDATE lead_local_destinations SET fields_json=json_set(fields_json,'$.ownerNote','Keep this note') WHERE reference=?",
      args: ['restart-review'],
    });
    await first.app.close(false);
    const changed = structuredClone(qualificationConfig);
    changed.policy.rules.employeeCount.min = 100;
    const restarted = await setup({}, { directory: first.app.directory, qualification: changed });
    const approved = await decision(restarted.app, runId);
    const response = await review(restarted.app, approved);
    expect(response.status).toBe(200);
    const accepted = await response.json();
    expect(accepted.reviewer).toBe('local-operator');
    expect((await review(restarted.app, approved)).status).toBe(200);
    const result = await waitState(restarted.app, runId, 'applied');
    expect(result.authorization).toMatchObject({
      kind: 'human',
      reviewDigest: cycle.packet!.digest,
      decisionId: accepted.id,
    });
    expect((await destination(restarted.app, 'restart-review')).fields).toMatchObject({
      ...ownedState(cycle.packet!.proposedPatch),
      nextAction: 'Contact the lead to confirm the buying need and agree on the next step.',
      classification: 'qualified',
      stage: 'Qualified',
      reviewStatus: 'Approved',
      decisionSource: 'SDR',
      overrideClassification: 'qualified',
      overrideReason: approved.override!.reason,
      ownerNote: 'Keep this note',
    });
    expect(await restarted.app.store.qualifications.get(runId)).toEqual(before);
    expect(restarted.research.requests).toHaveLength(0);
    expect((await restarted.app.intake.workflow.getWorkflowRunById(runId))?.status).toBe('success');
    expect(
      (await restarted.app.store.client.execute("SELECT * FROM lead_output_operations WHERE kind='final'")).rows,
    ).toHaveLength(1);
  });

  it('rejects_stale_forged_expired_and_negative_reviews', async () => {
    const { app } = await setup({ employees: null });
    const runId = await submit(app, 'forgery');
    const cycle = await waitState(app, runId, 'awaiting_review');
    const input = await decision(app, runId);
    expect((await review(app, { ...input, digest: '0'.repeat(64) })).status).toBe(409);
    expect((await review(app, { ...input, reviewId: randomUUID() })).status).toBe(409);
    expect((await review(app, { ...input, revision: 2 })).status).toBe(409);
    expect((await review(app, { ...input, revision: 0 })).status).toBe(400);
    expect((await review(app, { ...input, reviewer: 'invented-reviewer' })).status).toBe(400);
    const run = await app.intake.workflow.createRun({ runId });
    await run.resume({
      step: 'apply-or-review',
      resumeData: { decisionId: randomUUID() },
      requestContext: new RequestContext([['intakeDispatch', { sourceId: 'local-inbound' }]]),
    });
    expect((await app.reviews.read(runId))?.authorization).toBeNull();
    expect((await destination(app, 'forgery')).fields.stage).toBe('Needs review');
    for (const kind of ['rejected', 'changes_requested'] as const) {
      const id = await submit(app, kind);
      await waitState(app, id, 'awaiting_review');
      expect((await review(app, await decision(app, id, { decision: kind, override: undefined }))).status).toBe(200);
      await waitState(app, id, kind);
      expect((await destination(app, kind)).fields.stage).toBe('Needs review');
      expect(await app.store.reviews.operation(id, 'final')).toBeNull();
    }
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(cycle.packet!.expiresAt) + 1);
    expect((await review(app, input)).status).toBe(409);
    await app.reviews.advance(runId);
    now.mockRestore();
    await waitState(app, runId, 'expired');
    expect((await destination(app, 'forgery')).fields.reviewStatus).toBe('Expired');
    expect(await app.store.reviews.operation(runId, 'final')).toBeNull();
    const protectedApp = await harness({ production: true });
    cleanup.push(() => protectedApp.close());
    expect((await review(protectedApp, input)).status).toBe(401);
    expect((await review(protectedApp, input, { Authorization: `Bearer ${productionToken}` })).status).toBe(409);
  });

  it('serializes_decisions_and_preserves_score_on_override', async () => {
    const config = structuredClone(qualificationConfig);
    config.routing.automaticOutcomes = ['qualified', 'nurture'];
    config.routing.reviewOutcomes = ['needs_review', 'disqualified'];
    const { app, research } = await setup({ country: 'JP' }, { qualification: config });
    const runId = await submit(app, 'override', {}, true);
    const cycle = await waitState(app, runId, 'awaiting_review');
    const score = (await app.store.qualifications.get(runId))!.assessment!.result.score;
    const approval = await decision(app, runId);
    expect((await review(app, { ...approval, override: { classification: 'qualified', reason: ' ' } })).status).toBe(
      400,
    );
    // A separate connection proves the durable pending-to-decided compare-and-set.
    const other = createClient({ url: pathToFileURL(join(app.directory, 'application.db')).href });
    const response = await Promise.all([
      review(app, approval),
      review(app, { ...approval, decision: 'rejected', override: undefined }),
    ]);
    expect(response.map(item => item.status).sort((a, b) => a - b)).toEqual([200, 409]);
    const winner = (await app.reviews.read(runId))!.decision!;
    const second = { ...winner, id: randomUUID() };
    expect(
      (
        await other.execute({
          sql: 'UPDATE lead_cycles SET decision_json=? WHERE run_id=? AND decision_json IS NULL',
          args: [JSON.stringify(second), runId],
        })
      ).rowsAffected,
    ).toBe(0);
    other.close();
    const state = winner.input.decision === 'approved' ? 'applied' : 'rejected';
    await waitState(app, runId, state);
    expect((await app.store.qualifications.get(runId))!.assessment!.result.score).toBe(score);
    expect((await destination(app, 'override')).fields.score).toBe(score);
    expect(cycle.packet!.proposedPatch.classification).toBe('disqualified');
    expect((await destination(app, 'override')).fields).toMatchObject(
      state === 'applied'
        ? { classification: 'qualified', overrideReason: approval.override!.reason, decisionSource: 'SDR' }
        : { classification: 'disqualified', reviewStatus: 'Rejected' },
    );
    const definiteId = await submit(app, 'confirmed-override', {}, true);
    await waitState(app, definiteId, 'awaiting_review');
    expect((await review(app, await decision(app, definiteId))).status).toBe(200);
    await waitState(app, definiteId, 'applied');
    expect((await destination(app, 'confirmed-override')).fields).toMatchObject({
      score,
      classification: 'qualified',
      overrideClassification: 'qualified',
      decisionSource: 'SDR',
    });
    research.setScenario({ ambiguous: true });
    const identity = await submit(app, 'unsafe-identity', {}, true);
    await waitState(app, identity, 'awaiting_review');
    expect((await review(app, await decision(app, identity))).status).toBe(409);
    expect(await app.store.reviews.operation(identity, 'final')).toBeNull();
  });

  it('reconciles_uncertain_writes_and_preserves_unowned_fields', async () => {
    const fault = faultOutput();
    const first = await setup({}, { outputProvider: () => fault.provider });
    fault.bind(first.app);
    const runId = await submit(first.app, 'uncertain-write', {}, true);
    await vi.waitFor(async () =>
      expect((await first.app.store.reviews.operation(runId, 'final'))?.state).toBe('uncertain'),
    );
    expect((await first.app.reviews.read(runId))?.active).toBe(true);
    const assessment = (await first.app.store.qualifications.get(runId))!.assessment!;
    expect(
      (
        await first.app.post({
          ...event('blocked', { domain: 'example.com' }),
          destinationReference: 'uncertain-write',
          supersedesAssessmentId: assessment.id,
        })
      ).status,
    ).toBe(429);
    await first.app.close(false);
    const recovered = await setup({}, { directory: first.app.directory });
    await waitState(recovered.app, runId, 'applied');
    expect(fault.apply).toHaveBeenCalledTimes(1);
    expect((await recovered.app.store.reviews.operation(runId, 'final'))?.state).toBe('applied');
    const publishFault = faultOutput();
    const pending = await setup({ employees: null }, { outputProvider: () => publishFault.provider });
    publishFault.bind(pending.app);
    const pendingId = await submit(pending.app, 'publication');
    await vi.waitFor(async () =>
      expect((await pending.app.store.reviews.operation(pendingId, 'review'))?.state).toBe('uncertain'),
    );
    expect((await pending.app.reviews.read(pendingId))?.publishedAt).toBeNull();
    expect((await review(pending.app, await decision(pending.app, pendingId))).status).toBe(409);
    publishFault.recover();
    await waitState(pending.app, pendingId, 'awaiting_review');
    expect(publishFault.apply).toHaveBeenCalledTimes(1);
    await pending.app.store.client.execute({
      sql: "UPDATE lead_local_destinations SET fields_json=json_set(fields_json,'$.stage','Nurture','$.ownerNote','Manual note') WHERE reference=?",
      args: ['publication'],
    });
    expect((await review(pending.app, await decision(pending.app, pendingId))).status).toBe(409);
    expect((await destination(pending.app, 'publication')).fields).toMatchObject({
      stage: 'Nurture',
      ownerNote: 'Manual note',
    });
    expect(await pending.app.store.reviews.operation(pendingId, 'final')).toBeNull();
  });

  it('recovers_initial_destination_reads_for_publication_and_automatic_output_after_restart', async () => {
    for (const [id, scenario, preparedState, recoveredState, operationKind] of [
      ['initial-review-read', { employees: null }, 'publishing_review', 'awaiting_review', 'review'],
      ['initial-final-read', {}, 'applying', 'applied', 'final'],
    ] as const) {
      let local: LocalOutputProvider;
      const read = vi.fn<OutputProvider['read']>(async () => {
        throw new Error('Destination read temporarily unavailable');
      });
      const output: OutputProvider = { id: 'local', read, apply: async (...args) => local.apply(...args) };
      const first = await setup(scenario, { outputProvider: () => output });
      local = new LocalOutputProvider(first.app.store.client);
      const runId = await submit(first.app, id, {}, true);
      const prepared = await waitState(first.app, runId, preparedState);
      await vi.waitFor(() => expect(read.mock.calls.length).toBeGreaterThanOrEqual(2));
      expect(prepared.active).toBe(true);
      expect(prepared.publishedAt).toBeNull();
      expect((await first.app.intake.workflow.getWorkflowRunById(runId))?.status).toBe('suspended');
      expect((await destination(first.app, id)).fields.stage).toBe('Triage');
      expect(await first.app.store.reviews.operation(runId, operationKind)).toBeNull();
      const original = await first.app.store.qualifications.get(runId);
      await first.app.close(false);

      const restarted = await setup({}, { directory: first.app.directory });
      const recovered = await waitState(restarted.app, runId, recoveredState);
      expect(recovered.assessmentId).toBe(prepared.assessmentId);
      expect(recovered.packet).toEqual(prepared.packet);
      expect(await restarted.app.store.qualifications.get(runId)).toEqual(original);
      expect(restarted.research.requests).toHaveLength(0);
      expect((await restarted.app.store.reviews.operation(runId, operationKind))?.state).toBe('applied');
    }
  });

  it('keeps_conflicted_destinations_reserved_without_starving_new_work_or_output_retries', async () => {
    let local: LocalOutputProvider;
    let recoveredReference: string | undefined;
    const output: OutputProvider = {
      id: 'local',
      read: async target => {
        if (target.reference.startsWith('conflict-')) return { fields: { stage: 'Nurture' }, marker: null };
        if (target.reference.startsWith('retry-') && target.reference !== recoveredReference)
          throw new Error('Destination read temporarily unavailable');
        return local.read(target);
      },
      apply: async (...args) => local.apply(...args),
    };
    const { app } = await setup({}, { outputProvider: () => output });
    local = new LocalOutputProvider(app.store.client);
    for (const id of ['conflict-one', 'conflict-two']) {
      const runId = await submit(app, id, {}, true);
      const conflicted = await waitState(app, runId, 'conflict');
      expect(conflicted.active).toBe(true);
      expect(
        (
          await app.post({
            ...event(`${id}-again`),
            destinationReference: id,
            supersedesAssessmentId: conflicted.assessmentId,
          })
        ).status,
      ).toBe(429);
    }
    const afterConflicts = await submit(app, 'after-conflicts', {}, true);
    await waitState(app, afterConflicts, 'applied');
    const retries: Array<{ runId: string; reference: string }> = [];
    for (const id of ['retry-one', 'retry-two', 'retry-three']) {
      const runId = await submit(app, id, {}, true);
      expect((await waitState(app, runId, 'applying')).active).toBe(true);
      retries.push({ runId, reference: id });
    }
    const afterRetries = await submit(app, 'after-retries', {}, true);
    await waitState(app, afterRetries, 'applied');
    expect((await destination(app, 'after-retries')).fields.classification).toBe('qualified');
    // Recover the last UUID in the queue, independent of random submission ordering.
    const last = retries.reduce((latest, retry) => (retry.runId > latest.runId ? retry : latest));
    recoveredReference = last.reference;
    await waitState(app, last.runId, 'applied');
    for (const retry of retries.filter(candidate => candidate !== last)) {
      expect(await app.reviews.read(retry.runId)).toMatchObject({ state: 'applying', active: true });
    }
    expect((await destination(app, last.reference)).fields.classification).toBe('qualified');
  });

  it('requalifies_disqualified_leads_without_erasing_history_or_replaying_old_events', async () => {
    const { app, research } = await setup({ country: 'JP' });
    const firstId = await submit(app, 'original', { destinationReference: 'account' }, true);
    await waitState(app, firstId, 'applied');
    const previous = (await app.store.qualifications.get(firstId))!;
    expect(previous.assessment!.result.classification).toBe('disqualified');
    const newConfig = structuredClone(qualificationConfig);
    newConfig.policy.version = 'updated-policy';
    research.setScenario({});
    const body = {
      ...event('new-cycle', {
        domain: 'example.com',
        inquiry: {
          type: 'demo_request',
          occurredAt: new Date(Date.now() - 1000).toISOString(),
          text: 'Please demonstrate the product.',
        },
      }),
      destinationReference: 'account',
      supersedesAssessmentId: previous.assessment!.id,
    };
    expect((await app.post({ ...body, supersedesAssessmentId: randomUUID() })).status).toBe(400);
    expect((await app.post({ ...body, supersedesAssessmentId: undefined })).status).toBe(400);
    const originalDestination = await destination(app, 'account');
    await app.store.client.execute({
      sql: "UPDATE lead_local_destinations SET fields_json=json_set(fields_json,'$.stage','Qualified') WHERE reference='account'",
      args: [],
    });
    expect((await app.post(body)).status).toBe(400);
    expect((await destination(app, 'account')).fields.stage).toBe('Qualified');
    await app.store.client.execute({
      sql: "UPDATE lead_local_destinations SET fields_json=? WHERE reference='account'",
      args: [JSON.stringify(originalDestination.fields)],
    });
    // Restart captures new configuration only for the new cycle.
    await app.close(false);
    const restarted = await setup({}, { directory: app.directory, qualification: newConfig });
    await restarted.app.dispatcher.stop();
    const accepted = await Promise.all(Array.from({ length: 4 }, async () => restarted.app.post(body)));
    expect(accepted.map(response => response.status)).toEqual([202, 202, 202, 202]);
    const ids = await Promise.all(accepted.map(async response => (await response.json()).runId as string));
    expect(new Set(ids).size).toBe(1);
    const nextId = ids[0]!;
    expect((await restarted.app.http.request(`/lead-qualification/runs/${nextId}/output`)).status).toBe(404);
    expect((await restarted.app.http.request(`/lead-qualification/runs/${firstId}/output`)).status).toBe(409);
    await restarted.app.dispatcher.start();
    const next = await waitState(restarted.app, nextId, 'applied');
    expect(next.predecessorId).toBe(previous.assessment!.id);
    expect((await restarted.app.http.request(`/lead-qualification/runs/${firstId}/output`)).status).toBe(409);
    expect(await (await restarted.app.http.request(`/lead-qualification/runs/${nextId}/output`)).text()).toContain(
      '# Lead qualification: Qualified',
    );
    expect((await restarted.app.store.qualifications.get(nextId))!.assessment!.result.classification).toBe('qualified');
    expect((await restarted.app.store.qualifications.get(nextId))!.snapshot.config.policy.version).toBe(
      'updated-policy',
    );
    expect(await restarted.app.store.qualifications.get(firstId)).toEqual(previous);
    const oldEvent = (await restarted.app.store.get(firstId))!.event;
    const replay = await restarted.app.post({
      version: 1,
      type: 'lead.received',
      eventId: oldEvent.eventId,
      lead: oldEvent.lead,
      destinationReference: 'account',
    });
    expect((await replay.json()).runId).toBe(firstId);
    expect((await destination(restarted.app, 'account')).fields.classification).toBe('qualified');
    restarted.research.setScenario({ country: 'JP' });
    const lastId = await submit(
      restarted.app,
      'still-mismatched',
      { destinationReference: 'account', supersedesAssessmentId: next.assessmentId },
      true,
    );
    await waitState(restarted.app, lastId, 'applied');
    expect((await destination(restarted.app, 'account')).fields.classification).toBe('disqualified');
    expect((await restarted.app.store.client.execute('SELECT * FROM lead_cycles')).rows).toHaveLength(3);
  });
});
