import type { Client } from '@libsql/client';
import { persistDomainEvent } from './telemetry.ts';
import { randomUUID } from 'node:crypto';
import { databaseUrl, openDatabase } from './database.ts';
import { writeTransaction } from './transaction.ts';
import { canonicalJson, sha256 } from '../intake/source.ts';
import { reviewStateSchema, reviewDecisionSchema } from '../contracts/review.ts';
import type { ReviewState, ReviewDecision, Projection, ExportManifest } from '../contracts/review.ts';
import { processingRunSchema } from '../contracts/processing.ts';
import { processingClock } from '../processing/clock.ts';

// Called inside the review claim transaction, so competing decisions cannot restart or pause the clock.
async function setReviewClock(db: Pick<Client, 'execute'>, runId: string, active: boolean) {
  const rows = await db.execute({ sql: 'SELECT run_json FROM vrq_processing WHERE run_id = ?', args: [runId] });
  if (!rows.rows[0]) return;
  const run = processingRunSchema.parse(JSON.parse(String(rows.rows[0].run_json)));
  await db.execute({
    sql: 'UPDATE vrq_processing SET run_json = ? WHERE run_id = ?',
    args: [canonicalJson({ ...run, clock: processingClock(run, active && !run.stopReason) }), runId],
  });
}

export async function openReviewStore(url = databaseUrl, underlying?: Client) {
  const client = await openDatabase(url, undefined, underlying);
  if (!client.readOnly)
    await client.batch(
      [
        'CREATE TABLE IF NOT EXISTS vrq_review (run_id TEXT PRIMARY KEY, state_json TEXT NOT NULL, claim_token TEXT)',
        'CREATE TABLE IF NOT EXISTS vrq_review_payloads (run_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, dispositions_json TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS vrq_decisions (run_id TEXT NOT NULL, decision_id TEXT NOT NULL, payload_hash TEXT NOT NULL, outcome_json TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(run_id,decision_id))',
      ],
      'write',
    );
  async function read(db: Pick<typeof client, 'execute'>, runId: string) {
    const r = await db.execute({ sql: 'SELECT state_json FROM vrq_review WHERE run_id = ?', args: [runId] });
    return r.rows[0] ? reviewStateSchema.parse(JSON.parse(String(r.rows[0].state_json))) : undefined;
  }
  async function save(db: Pick<typeof client, 'execute'>, state: ReviewState) {
    await db.execute({
      sql: 'UPDATE vrq_review SET state_json = ?, claim_token = ? WHERE run_id = ?',
      args: [canonicalJson(reviewStateSchema.parse(state)), state.claimToken, state.runId],
    });
  }
  return {
    read: (runId: string) => read(client, runId),
    initialize: async (raw: ReviewState) =>
      writeTransaction(client, async tx => {
        const state = reviewStateSchema.parse(raw),
          old = await read(tx, state.runId);
        if (old) {
          if (old.workflowRunId !== state.workflowRunId) throw new Error('FOREIGN_WORKFLOW');
          return old;
        }
        await tx.execute({
          sql: 'INSERT INTO vrq_review (run_id,state_json,claim_token) VALUES (?,?,?)',
          args: [state.runId, canonicalJson(state), null],
        });
        return state;
      }),
    claimDecision: async (raw: ReviewDecision) =>
      writeTransaction(client, async tx => {
        const d = reviewDecisionSchema.parse(raw),
          payloadHash = sha256(canonicalJson(d));
        const duplicate = await tx.execute({
          sql: 'SELECT payload_hash,outcome_json FROM vrq_decisions WHERE run_id = ? AND decision_id = ?',
          args: [d.runId, d.decisionId],
        });
        if (duplicate.rows[0]) {
          if (duplicate.rows[0].payload_hash !== payloadHash) throw new Error('CONFLICTING_REPLAY');
          return { replay: reviewStateSchema.parse(JSON.parse(String(duplicate.rows[0].outcome_json))) };
        }
        const s = await read(tx, d.runId);
        if (!s || s.organizationId !== d.organizationId || s.policyDigest !== d.policyDigest)
          throw new Error('FOREIGN_REVIEW');
        if (
          s.revision !== d.expectedRevision ||
          s.digest !== d.expectedDigest ||
          s.claimToken ||
          s.state === 'exported' ||
          s.state === 'invalidated'
        )
          throw new Error('STALE_REVIEW');
        const token = randomUUID();
        const claimed = {
          ...s,
          projection: null,
          manifest: null,
          stagedManifest: null,
          state: 'awaiting_review' as const,
          claimToken: token,
          claimAt: new Date().toISOString(),
        };
        await save(tx, claimed);
        await setReviewClock(tx, d.runId, true);
        const validated = await tx.execute({
          sql: 'SELECT revision,dispositions_json FROM vrq_review_payloads WHERE run_id = ?',
          args: [d.runId],
        });
        const reuseValidated = Boolean(
          s.projection &&
          validated.rows[0]?.revision === s.revision &&
          validated.rows[0]?.dispositions_json === canonicalJson(d.dispositions),
        );
        return { token, state: s, payloadHash, reuseValidated };
      }),
    finishDecision: async (
      d: ReviewDecision,
      token: string,
      projection: Projection,
      payloadHash: string,
      actor: string,
    ) =>
      writeTransaction(client, async tx => {
        const s = await read(tx, d.runId);
        if (!s || s.claimToken !== token || s.revision !== d.expectedRevision) throw new Error('STALE_REVIEW');
        const next = reviewStateSchema.parse({
          ...s,
          revision: s.revision + 1,
          digest: sha256(canonicalJson(projection)),
          projection,
          state: d.finalApproval ? 'approved' : 'awaiting_review',
          claimToken: null,
          claimAt: null,
        });
        await save(tx, next);
        await setReviewClock(tx, d.runId, false);
        await tx.execute({
          sql: 'INSERT INTO vrq_review_payloads (run_id,revision,dispositions_json) VALUES (?,?,?) ON CONFLICT(run_id) DO UPDATE SET revision=excluded.revision,dispositions_json=excluded.dispositions_json',
          args: [d.runId, next.revision, canonicalJson(d.dispositions)],
        });
        for (const disposition of d.dispositions) {
          const original = s.results.find(r => r.questionId === disposition.questionId)?.draft;
          const draft = disposition.correction ?? original;
          await persistDomainEvent(tx, d.runId, `review:${d.decisionId}:${disposition.questionId}`, {
            kind: 'reviewed',
            at: new Date().toISOString(),
            startedAt: s.claimAt ?? undefined,
            questionId: disposition.questionId,
            corrected: Boolean(
              disposition.correction && canonicalJson(disposition.correction) !== canonicalJson(original),
            ),
            materialClaims: disposition.disposition === 'release' ? (draft?.claims.length ?? 0) : 0,
            supportedClaims: disposition.disposition === 'release' ? (draft?.claims.length ?? 0) : 0,
          });
        }
        await tx.execute({
          sql: 'INSERT INTO vrq_decisions (run_id,decision_id,payload_hash,outcome_json,actor,created_at) VALUES (?,?,?,?,?,?)',
          args: [d.runId, d.decisionId, payloadHash, canonicalJson(next), actor, new Date().toISOString()],
        });
        return next;
      }),
    failDecision: async (runId: string, token: string, invalidated = false) =>
      writeTransaction(client, async tx => {
        const s = await read(tx, runId);
        if (s?.claimToken === token) {
          await setReviewClock(tx, runId, false);
          await save(tx, {
            ...s,
            state: invalidated ? 'invalidated' : 'awaiting_review',
            projection: null,
            manifest: null,
            stagedManifest: null,
            claimToken: null,
            claimAt: null,
          });
        }
      }),
    invalidate: async (runId: string) =>
      writeTransaction(client, async tx => {
        const s = await read(tx, runId);
        if (s) {
          await setReviewClock(tx, runId, false);
          await save(tx, {
            ...s,
            state: 'invalidated',
            projection: null,
            manifest: null,
            stagedManifest: null,
            claimToken: null,
            claimAt: null,
          });
        }
      }),
    claimExport: async (runId: string) =>
      writeTransaction(client, async tx => {
        const s = await read(tx, runId);
        if (!s || !s.projection || !['approved', 'exporting', 'exported'].includes(s.state))
          throw new Error('FINAL_APPROVAL_REQUIRED');
        if (s.state === 'exported') return s;
        if (s.claimToken) throw new Error('EXPORT_BUSY');
        const next = { ...s, state: 'exporting' as const, claimToken: randomUUID(), claimAt: new Date().toISOString() };
        await save(tx, next);
        return next;
      }),
    prepareExport: async (runId: string, token: string, manifest: ExportManifest) =>
      writeTransaction(client, async tx => {
        const s = await read(tx, runId);
        if (
          !s ||
          s.claimToken !== token ||
          s.revision !== manifest.revision ||
          s.projection?.approvalId !== manifest.approvalId
        )
          throw new Error('STALE_EXPORT');
        const next = { ...s, stagedManifest: manifest };
        await save(tx, next);
        return next;
      }),
    finishExport: async (runId: string, token: string, manifest: ExportManifest) =>
      writeTransaction(client, async tx => {
        const s = await read(tx, runId);
        if (
          !s ||
          s.claimToken !== token ||
          s.projection?.approvalId !== manifest.approvalId ||
          s.revision !== manifest.revision ||
          canonicalJson(s.stagedManifest) !== canonicalJson(manifest)
        )
          throw new Error('STALE_EXPORT');
        const next = { ...s, state: 'exported' as const, manifest, claimToken: null, claimAt: null };
        await persistDomainEvent(tx, runId, `export:${manifest.revision}`, {
          kind: 'exported',
          at: new Date().toISOString(),
          startedAt: s.claimAt ?? undefined,
        });
        await save(tx, next);
        return next;
      }),
    releaseExport: async (runId: string, token: string) =>
      writeTransaction(client, async tx => {
        const s = await read(tx, runId);
        if (s?.claimToken === token) await save(tx, { ...s, state: 'approved', claimToken: null, claimAt: null });
      }),
    recoverClaim: async (runId: string, expectedToken: string) =>
      writeTransaction(client, async tx => {
        const s = await read(tx, runId);
        if (!s || s.claimToken !== expectedToken || !s.claimAt || Date.now() - Date.parse(s.claimAt) < 120000)
          throw new Error('CLAIM_NOT_ABANDONED');
        // An abandoned active operation conservatively retains its elapsed time.
        await setReviewClock(tx, runId, false);
        await save(tx, {
          ...s,
          state: s.state === 'exporting' ? 'approved' : 'awaiting_review',
          claimToken: null,
          claimAt: null,
        });
      }),
    close: () => client.close(),
  };
}
