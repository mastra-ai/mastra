import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { attioConfig } from '../../src/mastra/config/attio';
import { qualificationConfig, snapshotConfiguration } from '../../src/mastra/config/qualification';
import { domainSchema } from '../../src/mastra/contracts';
import { AttioClient } from '../../src/mastra/providers/attio/client';
import { OutputError } from '../../src/mastra/providers/output';
import { assessmentSchema } from '../../src/mastra/research/contracts';
import {
  stageDisposition,
  authorizationSchema,
  decisionSchema,
  digestValue,
  reviewPacketSchema,
} from '../../src/mastra/review/contracts';
import { createDemoEntry, observeAttioEntry, observeRead } from '../../scripts/attio-demo';
import { exampleProfile } from '../support/example-profile';

const casesSchema = z
  .array(
    z.strictObject({
      domain: domainSchema,
      expected: z.enum(['Qualified', 'Nurture', 'Disqualified']),
      scenario: z.enum(['recent-inquiry', 'past-inquiry', 'no-inquiry']),
    }),
  )
  .length(3)
  .refine(cases => new Set(cases.map(item => item.expected)).size === 3);
const liveRunSchema = z.object({
  runId: z.uuid(),
  sourceId: z.string(),
  destination: z.object({ providerId: z.literal('attio'), reference: z.uuid() }),
  business: z.object({
    state: z.string(),
    predecessorId: z.uuid().nullable(),
    packet: reviewPacketSchema.nullable(),
    decision: decisionSchema.nullable(),
    authorization: authorizationSchema.nullable(),
    history: z.array(
      z.object({
        revision: z.number().int().positive(),
        state: z.string(),
        packet: reviewPacketSchema.nullable(),
        decision: decisionSchema.nullable(),
        authorization: authorizationSchema.nullable(),
        publishedAt: z.string().nullable(),
        expected: z.unknown(),
        expectedRevision: z.string().nullable(),
        changedAt: z.string(),
      }),
    ),
  }),
  qualification: z.object({ assessment: assessmentSchema }),
});
type LiveRun = z.infer<typeof liveRunSchema>;
type Observed = { entryId: string; runId: string; run: LiveRun };
// Three new automatic cases, one existing human decision read-only, one human-requested linked cycle.
// Each frozen expectation is asserted independently; a mismatch never prevents the other cases.
it('attio_qualification_pipeline_round_trip', async () => {
  const config = attioConfig();
  assert.ok(config, 'Connected Attio configuration is required');
  const live = z
    .strictObject({ baseUrl: z.url(), cases: casesSchema, reviewRunId: z.uuid() })
    .parse(JSON.parse(await readFile(z.string().min(1).parse(process.env.ATTIO_LIVE_CONFIG_FILE), 'utf8')));
  const base = live.baseUrl;
  assert.equal(new URL(base).protocol, 'https:');
  const token = z.string().min(32).parse(process.env.LEAD_QUALIFICATION_TOKEN);
  const cases = live.cases;
  const reviewedId = live.reviewRunId;
  const client = new AttioClient(config);
  const absoluteDeadline = Date.now() + 1_740_000;
  const failures: Array<{
    expected: string;
    entryId: string | null;
    runId: string | null;
    actual: string | null;
    reason: string;
  }> = [];
  const originals: Observed[] = [];
  let requalification: Observed | undefined;
  const linkedIds = new Set<string>();
  const readRun = (runId: string): Promise<LiveRun> => {
    const deadline = Math.min(absoluteDeadline, Date.now() + 15_000);
    return observeRead(
      async () => {
        try {
          const response = await fetch(new URL(`/lead-qualification/runs/${runId}`, base), {
            headers: { Authorization: `Bearer ${token}` },
            redirect: 'error',
            signal: AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline - Date.now()))),
          });
          if (!response.ok) {
            const retry = response.headers.get('retry-after');
            const delay = retry
              ? /^\d+(\.\d+)?$/.test(retry)
                ? Number(retry) * 1000
                : Date.parse(retry) - Date.now()
              : 0;
            throw new OutputError(
              `run_http_${response.status}`,
              response.status === 429 || response.status >= 500,
              Math.max(0, Number.isFinite(delay) ? delay : 0),
            );
          }
          return liveRunSchema.parse(await response.json());
        } catch (error) {
          if (
            error instanceof TypeError ||
            (error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name))
          )
            throw new OutputError('run_read_unavailable', true);
          throw error;
        }
      },
      config.limits,
      deadline,
    );
  };
  const waitEntry = (
    entryId: string,
    accept: (fields: Record<string, unknown>) => boolean,
    timeout: number,
    observe?: (fields: Record<string, unknown>) => void,
  ) =>
    observeAttioEntry(client, entryId, accept, Math.min(absoluteDeadline, Date.now() + timeout), fields => {
      if (
        requalification?.entryId === entryId &&
        typeof fields.cycleId === 'string' &&
        fields.cycleId !== requalification.runId
      )
        linkedIds.add(z.uuid().parse(fields.cycleId));
      observe?.(fields);
    });
  const settledRun = async (runId: string) => {
    const deadline = Math.min(absoluteDeadline, Date.now() + 10_000);
    let run = await readRun(runId);
    while (
      !['applied', 'awaiting_review', 'failed', 'conflict'].includes(run.business.state) &&
      Date.now() < deadline
    ) {
      await new Promise(resolve => setTimeout(resolve, 250));
      run = await readRun(runId);
    }
    return run;
  };
  const assertBinding = (run: LiveRun, entryId: string, fields: Record<string, unknown>) => {
    assert.equal(run.sourceId, `attio:${config.listId}`);
    assert.equal(run.destination.reference, entryId);
    assert.equal(fields.cycleId, run.runId);
    assert.equal(fields.assessmentId, run.qualification.assessment.id);
    assert.equal(run.qualification.assessment.runId, run.runId);
    assert.equal(fields.score, run.qualification.assessment.result.score);
  };
  const verifyReviewed = async () => {
    const run = await readRun(reviewedId);
    assert.equal(run.runId, reviewedId);
    const fields = await waitEntry(run.destination.reference, () => true, 15_000);
    assertBinding(run, run.destination.reference, fields);
    assert.equal(run.business.state, 'applied');
    const { authorization, decision, packet } = run.business;
    assert.ok(authorization?.kind === 'human' && decision && packet, 'Existing completed human review is required');
    assert.equal(decision.input.decision, 'approved');
    assert.equal(authorization.decisionId, decision.id);
    assert.equal(authorization.cycleId, reviewedId);
    assert.equal(authorization.assessmentId, run.qualification.assessment.id);
    assert.deepEqual(authorization.destination, run.destination);
    assert.equal(authorization.reviewId, packet.id);
    assert.equal(authorization.revision, packet.revision);
    assert.equal(authorization.reviewDigest, packet.digest);
    assert.equal(decision.input.runId, reviewedId);
    assert.equal(decision.input.reviewId, packet.id);
    assert.equal(decision.input.revision, packet.revision);
    assert.equal(decision.input.digest, packet.digest);
    assert.equal(packet.cycleId, reviewedId);
    assert.equal(packet.assessmentId, run.qualification.assessment.id);
    assert.deepEqual(packet.destination, run.destination);
    assert.ok(
      typeof decision.reviewer === 'object' &&
        decision.reviewer.provider === 'attio' &&
        'workspaceId' in decision.reviewer,
    );
    assert.equal(decision.reviewer.workspaceId, config.workspaceId);
    z.uuid().parse(decision.reviewer.memberId);
    assert.equal(run.qualification.assessment.result.classification, 'needs_review');
    assert.equal(packet.proposedPatch.classification, 'needs_review');
    assert.equal(packet.proposedPatch.score, run.qualification.assessment.result.score);
    assert.ok(
      'kind' in decision.input && decision.input.kind === 'attio-stage',
      'Current proof requires an actual human Stage decision',
    );
    assert.ok(packet.revision >= 2 && packet.reopenedBy, 'Current proof requires an actual manual Needs review reopen');
    z.uuid().parse(packet.reopenedBy.memberId);
    assert.equal(fields.classification, stageDisposition[decision.input.stage]);
    assert.equal(fields.reviewJustification, decision.input.justification);
    assert.equal(fields.stage, decision.input.stage);
    assert.ok(run.business.history.length > 0, 'The earlier review round must remain archived');
    for (const prior of run.business.history) {
      assert.ok(prior.authorization, 'An archived round must retain its authorization');
      assert.equal(prior.authorization.assessmentId, run.qualification.assessment.id);
      assert.equal(prior.authorization.cycleId, reviewedId);
      assert.deepEqual(prior.authorization.destination, run.destination);
      assert.ok(prior.revision < packet.revision);
      if (prior.packet) {
        assert.equal(prior.packet.assessmentId, run.qualification.assessment.id);
        assert.equal(prior.packet.proposedPatch.score, run.qualification.assessment.result.score);
      }
      if (prior.decision) {
        assert.ok(prior.packet && prior.authorization.kind === 'human');
        assert.equal(prior.authorization.decisionId, prior.decision.id);
        assert.equal(prior.authorization.reviewId, prior.packet.id);
        assert.equal(prior.authorization.reviewDigest, prior.packet.digest);
        assert.equal(prior.decision.input.digest, prior.packet.digest);
        assert.equal(prior.decision.input.revision, prior.packet.revision);
        assert.ok(
          typeof prior.decision.reviewer === 'object' &&
            'workspaceId' in prior.decision.reviewer &&
            prior.decision.reviewer.workspaceId === config.workspaceId,
        );
      } else assert.equal(prior.authorization.kind, 'policy');
    }
    assert.equal(fields.reviewStatus, 'Approved');
    assert.equal(fields.decisionSource, 'SDR');
    assert.equal(fields.outputState, 'Applied');
    assert.equal(fields.appliedAssessmentId, run.qualification.assessment.id);
    assert.equal(fields.reviewId, packet.id);
    assert.equal(fields.reviewRevision, packet.revision);
    console.info(
      JSON.stringify({
        event: 'attio.live.existing_human_review',
        runId: reviewedId,
        entryId: run.destination.reference,
        actual: fields.stage,
        businessState: run.business.state,
      }),
    );
    return run;
  };
  // Fail missing prerequisites before creating any new entry or requesting research.
  const reviewed = await verifyReviewed();
  for (const [index, item] of cases.entries()) {
    let entryId: string | null = null,
      runId: string | null = null,
      actual: string | null = null;
    try {
      assert.ok(Date.now() < absoluteDeadline, 'Live run total deadline reached');
      const entry = await createDemoEntry(
        client,
        exampleProfile({ domain: item.domain, scenario: item.scenario, seed: 4200 + index }),
      );
      entryId = entry.id.entry_id;
      console.info(JSON.stringify({ event: 'attio.live.entry', entryId, expected: item.expected }));
      const fields = await waitEntry(
        entryId,
        fields =>
          ['Qualified', 'Nurture', 'Disqualified', 'Needs review'].includes(String(fields.stage)) &&
          Boolean(fields.cycleId) &&
          fields.outputState === (fields.stage === 'Needs review' ? 'Pending' : 'Applied'),
        210_000,
        fields => {
          if (z.uuid().safeParse(fields.cycleId).success) runId = fields.cycleId as string;
          if (typeof fields.stage === 'string') actual = fields.stage;
        },
      );
      runId = z.uuid().parse(fields.cycleId);
      actual = z.string().parse(fields.stage);
      const run = await settledRun(runId);
      originals.push({ entryId, runId, run: structuredClone(run) });
      console.info(
        JSON.stringify({
          event: 'attio.live.observed',
          entryId,
          runId,
          expected: item.expected,
          actual,
          businessState: run.business.state,
        }),
      );
      assertBinding(run, entryId, fields);
      if (!requalification && actual === 'Disqualified' && run.business.state === 'applied') {
        requalification = { entryId, runId, run: structuredClone(run) };
        console.info(
          JSON.stringify({
            event: 'attio.live.human_action',
            entryId,
            runId,
            action:
              'Explicitly move this completed Disqualified entry to Triage once to request one fresh linked cycle. Other automatic cases continue now.',
          }),
        );
      }
      const sourceLinks = Array.isArray(fields.evidenceLinks)
        ? fields.evidenceLinks
        : z
            .string()
            .parse(fields.evidenceLinks)
            .split('\n')
            .filter(line => line.startsWith('https://'));
      const authorizedLinks = run.qualification.assessment.evidence
        .map(source => source.source)
        .filter(source => source.startsWith('https://'));
      assert.ok(sourceLinks.length > 0, 'Expected published public source links');
      assert.ok(
        sourceLinks.every(
          source =>
            typeof source === 'string' && new URL(source).protocol === 'https:' && authorizedLinks.includes(source),
        ),
        'Published links must be actual HTTPS assessment sources',
      );
      assert.equal(actual, item.expected, 'Observed qualification branch differs from the frozen expectation');
      assert.equal(run.business.authorization?.kind, 'policy');
      assert.equal(run.business.decision, null);
      assert.equal(fields.decisionSource, 'Automatic');
      assert.equal(fields.reviewStatus, 'Not required');
      assert.equal(fields.classification, item.expected.toLowerCase());
      assert.equal(fields.appliedAssessmentId, run.qualification.assessment.id);
      assert.equal(run.business.state, 'applied');
    } catch (error) {
      const failure = {
        expected: item.expected,
        entryId,
        runId,
        actual,
        reason: error instanceof Error ? error.message : 'Case failed',
      };
      failures.push(failure);
      console.info(JSON.stringify({ event: 'attio.live.case_failed', ...failure }));
    }
  }
  const previous = requalification;
  if (previous) {
    try {
      const fields = await waitEntry(
        previous.entryId,
        fields =>
          typeof fields.cycleId === 'string' &&
          fields.cycleId !== previous.runId &&
          ['Qualified', 'Nurture', 'Disqualified', 'Needs review'].includes(String(fields.stage)) &&
          fields.outputState === (fields.stage === 'Needs review' ? 'Pending' : 'Applied'),
        600_000,
      );
      const nextId = z.uuid().parse(fields.cycleId);
      const next = await settledRun(nextId);
      assert.equal(linkedIds.size, 1, 'Expected exactly one observed new linked cycle');
      assertBinding(next, previous.entryId, fields);
      assert.equal(next.business.predecessorId, previous.run.qualification.assessment.id);
      assert.notEqual(next.qualification.assessment.id, previous.run.qualification.assessment.id);
      assert.notEqual(next.runId, previous.runId);
      assert.equal(
        next.qualification.assessment.snapshot.digest,
        snapshotConfiguration(qualificationConfig, next.qualification.assessment.snapshot.assessmentTime).digest,
      );
      assert.ok(['applied', 'awaiting_review'].includes(next.business.state));
      console.info(
        JSON.stringify({
          event: 'attio.live.requalified',
          entryId: previous.entryId,
          runId: nextId,
          predecessorRunId: previous.runId,
          actual: fields.stage,
          businessState: next.business.state,
        }),
      );
    } catch (error) {
      failures.push({
        expected: 'linked requalification',
        entryId: previous.entryId,
        runId: previous.runId,
        actual: null,
        reason: error instanceof Error ? error.message : 'Requalification failed',
      });
    }
  } else
    failures.push({
      expected: 'linked requalification',
      entryId: null,
      runId: null,
      actual: null,
      reason: 'No completed Disqualified case was available; no requalification was attempted',
    });
  for (const original of originals) {
    try {
      assert.equal(
        digestValue((await readRun(original.runId)).qualification.assessment),
        digestValue(original.run.qualification.assessment),
        'Original full assessment changed',
      );
    } catch (error) {
      failures.push({
        expected: 'immutable assessment',
        entryId: original.entryId,
        runId: original.runId,
        actual: null,
        reason: error instanceof Error ? error.message : 'Assessment check failed',
      });
    }
  }
  const reviewedAfter = await verifyReviewed();
  assert.equal(
    digestValue(reviewedAfter.business.history),
    digestValue(reviewed.business.history),
    'Archived review history changed',
  );
  assert.equal(
    digestValue(reviewedAfter.qualification.assessment),
    digestValue(reviewed.qualification.assessment),
    'Existing reviewed assessment changed',
  );
  expect(failures).toEqual([]);
});
