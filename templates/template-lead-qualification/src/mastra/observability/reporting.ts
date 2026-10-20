import type { Client } from '@libsql/client';
import { z } from 'zod';
import { assessmentSchema } from '../research/contracts';
import { authorizationSchema, ownedPatchSchema } from '../review/contracts';

/** First observation is a retention anchor, not a guessed historical receipt. */
export async function initializeSalesRetention(client: Client) {
  await client.execute(
    'CREATE TABLE IF NOT EXISTS lead_sales_receipts(event_id TEXT PRIMARY KEY,received_at TEXT NOT NULL)',
  );
  if ((await client.execute("SELECT name FROM sqlite_master WHERE name='lead_sales_outcomes'")).rows.length)
    await client.execute({
      sql: 'INSERT OR IGNORE INTO lead_sales_receipts(event_id,received_at) SELECT event_id,? FROM lead_sales_outcomes',
      args: [new Date().toISOString()],
    });
}

export const reportWindowSchema = z
  .strictObject({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
    limit: z.number().int().min(1).max(1000).default(1000),
  })
  .refine(
    value =>
      Date.parse(value.from) < Date.parse(value.to) && Date.parse(value.to) - Date.parse(value.from) <= 90 * 86_400_000,
    'Select a positive window of at most 90 days',
  );
export const scoreBands = ['0–39', '40–69', '70–79', '80–100'] as const;
export const scoreBand = (score: number) => scoreBands[score < 40 ? 0 : score < 70 ? 1 : score < 80 ? 2 : 3]!;
const ratio = (numerator: number, denominator: number) => ({
  numerator,
  denominator,
  rate: denominator ? numerator / denominator : null,
});

/** Read only authoritative retained records; no research, CRM request or analytical mirror. */
export async function qualificationReport(
  client: Client,
  input: z.input<typeof reportWindowSchema>,
  salesMapped: boolean,
) {
  const window = reportWindowSchema.parse(input);
  const rows = await client.execute({
    sql: `SELECT q.assessment_json,c.run_id,c.state,c.authorization_json,
      (SELECT patch_json FROM lead_output_operations o WHERE o.run_id=c.run_id AND o.state='applied'
       AND (o.kind='final' OR o.kind LIKE 'final:%') ORDER BY o.rowid DESC LIMIT 1) AS patch_json
      FROM lead_qualifications q JOIN lead_cycles c USING(run_id)
      WHERE q.assessment_json IS NOT NULL AND julianday(json_extract(q.assessment_json,'$.completedAt'))>=julianday(?)
      AND julianday(json_extract(q.assessment_json,'$.completedAt'))<julianday(?) ORDER BY c.run_id LIMIT ?`,
    args: [window.from, window.to, window.limit + 1],
  });
  const salesTable =
    (await client.execute("SELECT name FROM sqlite_master WHERE name='lead_sales_outcomes'")).rows.length > 0;
  const outcomes =
    salesMapped && salesTable
      ? (
          await client.execute({
            sql: `SELECT assessment_id,cycle_id,outcome,occurred_at,event_id FROM (
      SELECT *,ROW_NUMBER() OVER(PARTITION BY assessment_id,cycle_id ORDER BY julianday(occurred_at) DESC,event_id DESC) AS rank
      FROM lead_sales_outcomes WHERE julianday(occurred_at)<julianday(?) AND cycle_id IN (${
        rows.rows
          .slice(0, window.limit)
          .map(() => '?')
          .join(',') || 'NULL'
      })) WHERE rank=1`,
            args: [window.to, ...rows.rows.slice(0, window.limit).map(row => z.string().parse(row.run_id))],
          })
        ).rows
      : [];
  const truncated = rows.rows.length > window.limit;
  const assessments = rows.rows.slice(0, window.limit).map(row => {
    const assessment = assessmentSchema.parse(JSON.parse(z.string().parse(row.assessment_json)));
    const authorization =
      row.authorization_json === null
        ? null
        : authorizationSchema.parse(JSON.parse(z.string().parse(row.authorization_json)));
    const patch = row.patch_json === null ? null : ownedPatchSchema.parse(JSON.parse(z.string().parse(row.patch_json)));
    const applied =
      row.state === 'applied' && authorization !== null && patch !== null && patch.assessmentId === assessment.id;
    const outcome = applied
      ? outcomes.find(item => item.assessment_id === assessment.id && item.cycle_id === row.run_id)
      : undefined;
    const accepted = Object.values(assessment.facts).filter(fact => fact.disposition === 'accepted').length;
    return {
      assessmentId: assessment.id,
      cycleId: z.string().parse(row.run_id),
      completedAt: assessment.completedAt,
      processingStatus: assessment.processingStatus,
      classification: assessment.result.classification,
      score: assessment.result.score,
      band: scoreBand(assessment.result.score),
      acceptedAttributes: accepted,
      acceptedCompanyAttributes: [
        assessment.facts.businessModel,
        assessment.facts.employeeCount,
        assessment.facts.headquartersCountry,
      ].filter(fact => fact.disposition === 'accepted').length,
      requestedAttributes: Object.keys(assessment.facts).length,
      uncertainty: assessment.result.classification === 'needs_review',
      authorization: applied ? authorization.kind : null,
      disposition: applied ? patch.classification : null,
      override:
        applied && authorization.kind === 'human' && patch.classification !== assessment.result.classification
          ? { disposition: patch.classification, reason: patch.overrideReason }
          : null,
      salesOutcome: outcome ? z.string().parse(outcome.outcome) : null,
    };
  });
  const completed = assessments.filter(item => item.processingStatus === 'completed');
  const excluded = (
    await client.execute({
      sql: 'SELECT count(*) AS count FROM lead_retention_markers WHERE julianday(completed_at)>=julianday(?) AND julianday(completed_at)<julianday(?)',
      args: [window.from, window.to],
    })
  ).rows[0];
  return {
    window,
    coverage: {
      scope: 'retained_operational_cohort',
      truncated,
      expiredAssessments: Number(excluded?.count ?? 0),
      earliestRetained: assessments.map(item => item.completedAt).sort()[0] ?? null,
      completeHistoricalCohort: false,
    },
    assessments,
    enriched: assessments.filter(item => item.acceptedCompanyAttributes > 0).length,
    enrichmentCoverage: ratio(
      assessments.reduce((sum, item) => sum + item.acceptedAttributes, 0),
      assessments.reduce((sum, item) => sum + item.requestedAttributes, 0),
    ),
    qualification: ratio(completed.filter(item => item.classification === 'qualified').length, completed.length),
    manualReview: ratio(completed.filter(item => item.uncertainty).length, completed.length),
    classification: Object.fromEntries(
      ['qualified', 'nurture', 'disqualified', 'needs_review'].map(value => [
        value,
        completed.filter(item => item.classification === value).length,
      ]),
    ),
    authorization: {
      automatic: assessments.filter(item => item.authorization === 'policy').length,
      human: assessments.filter(item => item.authorization === 'human').length,
    },
    overrides: assessments.flatMap(item =>
      item.override ? [{ assessmentId: item.assessmentId, ...item.override }] : [],
    ),
    scoreDistribution: Object.fromEntries(
      scoreBands.map(band => [band, completed.filter(item => item.band === band).length]),
    ),
    conversion: {
      availability: !salesMapped
        ? 'source_unmapped'
        : assessments.some(item => item.salesOutcome !== null)
          ? 'observed'
          : 'no_closed_outcomes',
      bands: scoreBands.map(band => {
        const cohort = assessments.filter(item => item.band === band && item.authorization !== null);
        const won = cohort.filter(item => item.salesOutcome === 'won').length;
        const lost = cohort.filter(item => item.salesOutcome === 'lost').length;
        return { band, won, lost, openOrUnobserved: cohort.length - won - lost, ...ratio(won, won + lost) };
      }),
    },
  };
}
