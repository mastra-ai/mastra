import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';
import type { Agent } from '@mastra/core/agent';
import { toStandardSchema } from '@mastra/core/schema';
import { z } from 'zod';
import { ControlPlaneError } from '../core/contracts.js';
import type { DomainStore } from '../core/store.js';
import type { AdvisoryStore, PlanningAdvisory } from './store.js';

const atom = z.string().trim().min(1).max(160);
export const ignoreInput = z
  .object({ scope: z.enum(['all_targets', 'target']), targetId: z.string().uuid().nullable(), reason: atom })
  .strict()
  .superRefine((value, context) => {
    if ((value.scope === 'target') !== (value.targetId !== null))
      context.addIssue({ code: 'custom', message: 'TARGET_SCOPE_INVALID' });
  });
export const unignoreInput = z
  .object({ scope: z.enum(['all_targets', 'target']), targetId: z.string().uuid().nullable() })
  .strict()
  .superRefine((value, context) => {
    if ((value.scope === 'target') !== (value.targetId !== null))
      context.addIssue({ code: 'custom', message: 'TARGET_SCOPE_INVALID' });
  });
export const caseInput = z
  .object({ notes: z.string().trim().min(1).max(2000), evidenceRefs: z.array(atom).max(12) })
  .strict();
export const advisoryHypothesisSchema = z
  .object({
    recommendation: z.enum(['review_affected_product', 'review_vendor_guidance', 'monitor_advisory']),
    rationaleCode: z.enum(['PRODUCT_METADATA_ONLY', 'VERSION_UNVERIFIED', 'SOURCE_REVISION_REVIEW']),
    confidence: z.enum(['low', 'medium']),
  })
  .strict();
export type AdvisoryHypothesis = z.infer<typeof advisoryHypothesisSchema>;
export interface AdvisoryModels {
  plan(candidate: PlanningAdvisory, signal: AbortSignal): Promise<{ value: AdvisoryHypothesis; modelId: string }>;
}

/** Sherlock receives validated metadata only; advisory prose and credentials never enter the prompt. */
export class MastraAdvisoryModels implements AdvisoryModels {
  constructor(
    private readonly sherlock: Agent,
    private readonly modelId: string,
  ) {}
  /** Generate a bounded metadata-only advisory recommendation through the configured model interface. */
  async plan(candidate: PlanningAdvisory, signal: AbortSignal) {
    const prompt = JSON.stringify({
      task: 'Choose one bounded manual advisory triage recommendation. Target relevance is unknown. Do not assert target impact, invent evidence, or request execution.',
      candidate,
    });
    if (Buffer.byteLength(prompt) > 4096) throw new ControlPlaneError('ADVISORY_MODEL_INPUT_LIMIT', 409);
    const response = await this.sherlock.generate(prompt, {
      maxProcessorRetries: 0,
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      modelSettings: { maxOutputTokens: 160, maxRetries: 0 },
      structuredOutput: { schema: toStandardSchema(advisoryHypothesisSchema), errorStrategy: 'strict' },
    });
    return { value: advisoryHypothesisSchema.parse(response.object), modelId: this.modelId };
  }
}

export const localAdvisoryCatalog = [
  {
    id: 'node_package_review',
    version: 1,
    kind: 'runbook',
    execution: 'manual_only',
    terms: ['npm', 'node'],
    summary: 'Review the installed package and vendor guidance manually.',
  },
  {
    id: 'bola_rest_read',
    version: 1,
    kind: 'checker',
    execution: 'available_for_authorized_rest_bola_only',
    terms: ['bola', 'idor'],
    summary: 'Bounded authorized REST object-read comparison.',
  },
] as const;

export class AdvisoryTriage {
  private readonly client;
  private readonly closing = new AbortController();
  private active?: Promise<unknown>;
  constructor(
    url: string,
    private readonly advisories: AdvisoryStore,
    private readonly domain: DomainStore,
    private readonly models?: AdvisoryModels,
  ) {
    this.client = createClient({ url });
  }
  /** Initialize advisory triage state and the offline reference catalogue. */
  async initialize() {
    await this.client.execute('PRAGMA busy_timeout = 5000');
    await this.client.execute(`CREATE TABLE IF NOT EXISTS scanner_advisory_hypotheses (
      advisory_id TEXT NOT NULL, source_revision INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','ready')),
      recommendation TEXT, rationale_code TEXT, confidence TEXT, model_id TEXT, created_at TEXT NOT NULL,
      PRIMARY KEY(advisory_id,source_revision))`);
    await this.client.execute(`CREATE TABLE IF NOT EXISTS scanner_advisory_ignores (
      advisory_id TEXT NOT NULL, scope TEXT NOT NULL, target_id TEXT NOT NULL, operator_id TEXT NOT NULL,
      reason TEXT NOT NULL, ignored_at TEXT NOT NULL, cleared_at TEXT,
      PRIMARY KEY(advisory_id,operator_id,scope,target_id))`);
    const columns = await this.client.execute('PRAGMA table_info(scanner_advisory_ignores)');
    const owner = columns.rows.find(row => String(row.name) === 'operator_id');
    if (!owner) throw new ControlPlaneError('ADVISORY_OWNER_MIGRATION_REQUIRED', 503);
    if (Number(owner.pk) === 0) {
      const tx = await this.client.transaction('write');
      try {
        const unattributed = await tx.execute(
          "SELECT 1 FROM scanner_advisory_ignores WHERE operator_id IS NULL OR operator_id='' LIMIT 1",
        );
        if (unattributed.rows.length) throw new ControlPlaneError('ADVISORY_OWNER_MIGRATION_REQUIRED', 503);
        await tx.execute(`CREATE TABLE scanner_advisory_ignores_owner_v2 (
          advisory_id TEXT NOT NULL, scope TEXT NOT NULL, target_id TEXT NOT NULL, operator_id TEXT NOT NULL,
          reason TEXT NOT NULL, ignored_at TEXT NOT NULL, cleared_at TEXT,
          PRIMARY KEY(advisory_id,operator_id,scope,target_id))`);
        await tx.execute(`INSERT INTO scanner_advisory_ignores_owner_v2
          SELECT advisory_id,scope,target_id,operator_id,reason,ignored_at,cleared_at FROM scanner_advisory_ignores`);
        await tx.execute('DROP TABLE scanner_advisory_ignores');
        await tx.execute('ALTER TABLE scanner_advisory_ignores_owner_v2 RENAME TO scanner_advisory_ignores');
        await tx.commit();
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        tx.close();
      }
    }
    await this.client.execute(`CREATE TABLE IF NOT EXISTS scanner_advisory_cases (
      id TEXT PRIMARY KEY, advisory_id TEXT NOT NULL, source_revision INTEGER NOT NULL, operator_id TEXT NOT NULL,
      notes TEXT NOT NULL, evidence_refs TEXT NOT NULL, created_at TEXT NOT NULL)`);
  }
  async close() {
    this.closing.abort();
    await this.active?.catch(() => undefined);
    this.client.close();
  }
  /** Load the advisory triage state visible to the requesting local operator. */
  async state(id: string, targetId: string | undefined, operator: string) {
    const canonical = (await this.advisories.resolveAlias(id)) ?? id.toUpperCase();
    const advisory = await this.advisories.get(canonical);
    if (targetId) await this.domain.get('target', targetId, operator);
    const [hypothesis, history, ignores, cases] = await Promise.all([
      this.client.execute({
        sql: 'SELECT * FROM scanner_advisory_hypotheses WHERE advisory_id=? AND source_revision=?',
        args: [canonical, advisory.revision],
      }),
      this.client.execute({
        sql: 'SELECT source_revision,state,recommendation,rationale_code,created_at FROM scanner_advisory_hypotheses WHERE advisory_id=? ORDER BY source_revision DESC LIMIT 25',
        args: [canonical],
      }),
      this.client.execute({
        sql: 'SELECT * FROM scanner_advisory_ignores WHERE advisory_id=? AND operator_id=? ORDER BY ignored_at DESC',
        args: [canonical, operator],
      }),
      this.client.execute({
        sql: 'SELECT * FROM scanner_advisory_cases WHERE advisory_id=? AND operator_id=? ORDER BY created_at DESC LIMIT 25',
        args: [canonical, operator],
      }),
    ]);
    const row = hypothesis.rows[0];
    const ignoreRecords = ignores.rows.map(item => ({
      scope: String(item.scope),
      targetId: item.target_id ? String(item.target_id) : null,
      operator: String(item.operator_id),
      reason: String(item.reason),
      ignoredAt: String(item.ignored_at),
      clearedAt: item.cleared_at ? String(item.cleared_at) : null,
    }));
    return {
      advisoryId: canonical,
      sourceRevision: advisory.revision,
      importance: this.importance(advisory.detail),
      targetRelevance: 'unknown' as const,
      suggested: !ignoreRecords.some(
        item => !item.clearedAt && (item.scope === 'all_targets' || (targetId && item.targetId === targetId)),
      ),
      checkerAvailability: this.catalog(advisory.detail).length
        ? ('metadata_only' as const)
        : ('none_available' as const),
      hypothesis: row
        ? {
            state: String(row.state),
            recommendation: row.recommendation ? String(row.recommendation) : null,
            rationaleCode: row.rationale_code ? String(row.rationale_code) : null,
            confidence: row.confidence ? String(row.confidence) : null,
            modelId: row.model_id ? String(row.model_id) : null,
          }
        : null,
      hypothesisHistory: history.rows.map(item => ({
        sourceRevision: Number(item.source_revision),
        state: String(item.state),
        recommendation: item.recommendation ? String(item.recommendation) : null,
        rationaleCode: item.rationale_code ? String(item.rationale_code) : null,
        createdAt: String(item.created_at),
      })),
      ignores: ignoreRecords,
      cases: cases.rows.map(item => ({
        id: String(item.id),
        sourceRevision: Number(item.source_revision),
        operator: String(item.operator_id),
        notes: String(item.notes),
        evidenceRefs: JSON.parse(String(item.evidence_refs)) as string[],
        createdAt: String(item.created_at),
      })),
    };
  }
  /** Normalize supported upstream severity labels, leaving unrecognized importance unknown. */
  private importance(detail: { severity?: unknown; statedSeverity?: unknown }) {
    for (const value of [detail.statedSeverity, detail.severity]) {
      const label =
        typeof value === 'string' ? value : value && typeof value === 'object' && 'label' in value ? value.label : null;
      if (typeof label === 'string' && /^(critical|high|medium|low)$/i.test(label)) return label.toLowerCase();
    }
    return 'unknown';
  }
  /** Select local advisory guidance whose search terms match affected-product metadata. */
  private catalog(detail: { affected?: unknown }) {
    const affected = Array.isArray(detail.affected) ? detail.affected : [];
    const terms = affected
      .flatMap(item =>
        item && typeof item === 'object'
          ? (Object.values(item).filter(value => typeof value === 'string') as string[])
          : [],
      )
      .map(value => value.toLowerCase());
    return localAdvisoryCatalog.filter(entry =>
      entry.terms.some(term => terms.some(value => value === term || value.includes(term))),
    );
  }
  /** Search the bounded advisory catalogue without inferring target applicability. */
  async search(id: string) {
    const canonical = (await this.advisories.resolveAlias(id)) ?? id.toUpperCase();
    const advisory = await this.advisories.get(canonical);
    return {
      advisoryId: canonical,
      sourceRevision: advisory.revision,
      items: this.catalog(advisory.detail).map(({ terms: _terms, ...entry }) => entry),
    };
  }
  /** Save or refresh an operator-scoped advisory ignore after checking any target ownership. */
  async ignore(id: string, input: z.infer<typeof ignoreInput>, operator: string) {
    const canonical = (await this.advisories.resolveAlias(id)) ?? id.toUpperCase();
    await this.advisories.get(canonical);
    if (input.targetId) await this.domain.get('target', input.targetId, operator);
    const targetId = input.targetId ?? '';
    await this.client.execute({
      sql: `INSERT INTO scanner_advisory_ignores(advisory_id,scope,target_id,operator_id,reason,ignored_at,cleared_at)
      VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(advisory_id,operator_id,scope,target_id) DO UPDATE SET reason=excluded.reason,ignored_at=excluded.ignored_at,cleared_at=NULL`,
      args: [canonical, input.scope, targetId, operator, input.reason, new Date().toISOString()],
    });
    return this.state(canonical, input.targetId ?? undefined, operator);
  }
  /** Restore an ignored advisory to the operator's active triage view. */
  async unignore(id: string, scope: 'all_targets' | 'target', targetId: string | null, operator: string) {
    const canonical = (await this.advisories.resolveAlias(id)) ?? id.toUpperCase();
    await this.advisories.get(canonical);
    if (targetId) await this.domain.get('target', targetId, operator);
    const result = await this.client.execute({
      sql: 'UPDATE scanner_advisory_ignores SET cleared_at=? WHERE advisory_id=? AND operator_id=? AND scope=? AND target_id=? AND cleared_at IS NULL',
      args: [new Date().toISOString(), canonical, operator, scope, targetId ?? ''],
    });
    if (!result.rowsAffected) throw new ControlPlaneError('ADVISORY_IGNORE_NOT_ACTIVE', 409);
    return this.state(canonical, targetId ?? undefined, operator);
  }
  /** Record a manual advisory case with its source revision, operator notes and evidence references. */
  async investigate(id: string, input: z.infer<typeof caseInput>, operator: string) {
    const canonical = (await this.advisories.resolveAlias(id)) ?? id.toUpperCase();
    const advisory = await this.advisories.get(canonical);
    const caseId = randomUUID();
    await this.client.execute({
      sql: 'INSERT INTO scanner_advisory_cases(id,advisory_id,source_revision,operator_id,notes,evidence_refs,created_at) VALUES (?,?,?,?,?,?,?)',
      args: [
        caseId,
        canonical,
        advisory.revision,
        operator,
        input.notes,
        JSON.stringify(input.evidenceRefs),
        new Date().toISOString(),
      ],
    });
    return this.state(canonical, undefined, operator);
  }
  /** Plan newly imported advisory revisions and retain their bounded recommendations. */
  async planNew(operator: string) {
    if (this.closing.signal.aborted) throw new ControlPlaneError('ADVISORY_TRIAGE_CLOSED', 503);
    if (this.active) throw new ControlPlaneError('ADVISORY_TRIAGE_BUSY', 409);
    const work = this.planAvailable(operator);
    this.active = work;
    try {
      return await work;
    } finally {
      this.active = undefined;
    }
  }
  /** Plan eligible advisory records while respecting current triage state and cancellation. */
  private async planAvailable(operator: string) {
    const rows = await this.client.execute({
      sql: `SELECT a.id,a.revision FROM scanner_advisories a
      LEFT JOIN scanner_advisory_hypotheses h ON h.advisory_id=a.id AND h.source_revision=a.revision
      WHERE a.id LIKE 'CVE-%' AND a.upstream_status='published' AND (h.state IS NULL OR h.state='pending')
      AND NOT EXISTS (SELECT 1 FROM scanner_advisory_ignores i WHERE i.advisory_id=a.id AND i.operator_id=? AND i.scope='all_targets' AND i.cleared_at IS NULL)
      ORDER BY CASE WHEN h.state IS NULL THEN 0 ELSE 1 END,a.provider_modified_at DESC,a.id LIMIT 8`,
      args: [operator],
    });
    let ready = 0,
      pending = 0;
    for (const row of rows.rows.filter(value => /^CVE-\d{4}-\d{4,}$/i.test(String(value.id)))) {
      if (this.closing.signal.aborted) break;
      const item = { id: String(row.id), revision: Number(row.revision) };
      let result: { value: AdvisoryHypothesis; modelId: string } | undefined;
      if (this.models)
        try {
          const candidate = await this.advisories.planningCandidate(item.id, item.revision);
          this.closing.signal.throwIfAborted();
          const planned = await this.models.plan(
            candidate,
            AbortSignal.any([this.closing.signal, AbortSignal.timeout(12000)]),
          );
          this.closing.signal.throwIfAborted();
          result = { ...planned, value: advisoryHypothesisSchema.parse(planned.value) };
        } catch {
          /* The durable pending state is the honest outcome of unavailable inference. */
        }
      await this.client.execute({
        sql: `INSERT INTO scanner_advisory_hypotheses(advisory_id,source_revision,state,recommendation,rationale_code,confidence,model_id,created_at)
        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(advisory_id,source_revision) DO UPDATE SET state=excluded.state,recommendation=excluded.recommendation,rationale_code=excluded.rationale_code,confidence=excluded.confidence,model_id=excluded.model_id`,
        args: [
          item.id,
          item.revision,
          result ? 'ready' : 'pending',
          result?.value.recommendation ?? null,
          result?.value.rationaleCode ?? null,
          result?.value.confidence ?? null,
          result?.modelId ?? null,
          new Date().toISOString(),
        ],
      });
      if (result) ready++;
      else pending++;
    }
    if (this.closing.signal.aborted) throw new ControlPlaneError('ADVISORY_TRIAGE_CLOSED', 503);
    return { ready, pending, modelCallLimit: 8, modelInputLimitBytes: 4096, modelOutputTokenLimit: 160 };
  }
}
