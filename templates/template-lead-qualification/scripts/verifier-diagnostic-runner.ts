import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, open, readFile, readdir, rename, rm, mkdtemp } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { qualificationConfig, snapshotConfiguration } from '../src/mastra/config/qualification';
import { normalizedEventSchema, domainSchema } from '../src/mastra/contracts';
import { LeadEventStore } from '../src/mastra/persistence/lead-event-store';
import { OpenAIEvidenceProvider, interpretationInput } from '../src/mastra/providers/evidence';
import type { ResearchContext } from '../src/mastra/providers/evidence';
import {
  candidateSchema,
  evidenceSchema,
  roundInputSchema,
  verificationWireSchema,
  ResearchError,
} from '../src/mastra/research/contracts';
import { approvedUrl } from '../src/mastra/research/page-retrieval';
import { createEvidenceBatch } from '../src/mastra/research/evidence-validation';
import { verifierDiagnostics } from '../src/mastra/research/verifier-diagnostics';
import { researchMeasurementSchema } from '../src/mastra/telemetry';
import type { Telemetry } from '../src/mastra/telemetry';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
// Canonical structural comparison ignores object key order, never array/message/case order.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const absolute = z.string().refine(isAbsolute);
const diagnosticMonths = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const diagnosticFixturesSchema = z
  .strictObject({
    version: z.literal(2),
    kind: z.literal('derived_verifier_diagnostic'),
    provenance: z.string().min(1).max(2000),
    sourceProfilesDigest: sha,
    assessmentTime: z.iso.datetime({ offset: true }),
    cases: z
      .array(
        z.strictObject({
          id: z.enum(['c07', 'c08', 'c10', 'c02', 'c03', 'c01']),
          domain: domainSchema,
          branch: z.literal('firmographics'),
          candidates: z.array(candidateSchema).length(1),
          evidence: z.array(evidenceSchema).min(1).max(2),
          round: roundInputSchema,
          expectedSupported: z.literal(true),
        }),
      )
      .length(6),
  })
  .superRefine((value, context) => {
    const fail = (message: string) => context.addIssue({ code: 'custom', message });
    if (value.cases.map(item => item.id).join(',') !== 'c07,c08,c10,c02,c03,c01') fail('diagnostic_case_order_invalid');
    for (const item of value.cases) {
      if (new Set(item.evidence.map(source => source.id)).size !== item.evidence.length)
        fail('diagnostic_source_id_duplicate');
      if (
        item.round.target !== item.candidates[0]!.attribute ||
        item.round.previousEvidenceIds.length ||
        Object.keys(item.round.supportedFacts).length ||
        canonical(item.round.currentEvidenceIds) !== canonical(item.evidence.map(source => source.id))
      )
        fail('diagnostic_round_context_invalid');
      for (const source of item.evidence) {
        if (source.kind !== 'website' || source.providerId !== 'openai-web' || digest(source.excerpt) !== source.digest)
          fail('diagnostic_source_invalid');
        try {
          if (!approvedUrl(source.source, [item.domain])) fail('diagnostic_domain_invalid');
        } catch {
          fail('diagnostic_domain_invalid');
        }
      }
      const candidate = item.candidates[0]!;
      // These curated probes use an explicit English date prefix; this is not a production prose-date parser.
      const quotedDate = /^As of (\d{1,2}) ([A-Z][a-z]+) (\d{4}), /.exec(candidate.quote);
      const effectiveDate = quotedDate
        ? `${quotedDate[3]}-${String(diagnosticMonths.indexOf(quotedDate[2]!) + 1).padStart(2, '0')}-${quotedDate[1]!.padStart(2, '0')}T00:00:00Z`
        : null;
      if (effectiveDate !== null && !z.iso.datetime().safeParse(effectiveDate).success)
        fail('diagnostic_claim_date_invalid');
      if (candidate.asOf !== effectiveDate) fail('diagnostic_claim_date_mismatch');
      if (effectiveDate !== null && Date.parse(effectiveDate) > Date.parse(value.assessmentTime))
        fail('diagnostic_claim_date_future');
      const passages = [
        { evidenceId: candidate.evidenceId, quote: candidate.quote },
        ...(candidate.inference?.additionalPassages ?? []),
      ];
      if (
        passages.some(
          passage => !item.evidence.find(source => source.id === passage.evidenceId)?.excerpt.includes(passage.quote),
        )
      )
        fail('diagnostic_quote_not_literal');
    }
  });
export type DiagnosticFixtures = z.infer<typeof diagnosticFixturesSchema>;
export const diagnosticCaps = {
  requests: 18,
  repetitions: 3,
  outputPerRequest: 1000,
  outputTotal: 18000,
  bytesPerRequest: 32768,
  bytesTotal: 589824,
  durationMs: 600000,
  costNanoUsd: 250000000,
  inputFramingTokens: 4096,
  inputNanoUsdPerToken: 275,
  outputNanoUsdPerToken: 1100,
  extract: 0,
  searches: 0,
  pageRequests: 0,
  crm: 0,
  retries: 0,
} as const;
export const diagnosticApprovalSchema = z
  .strictObject({
    version: z.literal(1),
    purpose: z.literal('verifier_diagnostic'),
    executionId: z.uuid(),
    approved: z.boolean(),
    approvedBy: z.string().trim().min(1).max(100).nullable(),
    approvedAt: z.iso.datetime({ offset: true }).nullable(),
    projectRoot: absolute,
    fixturePath: absolute,
    approvalPath: absolute,
    journalPath: absolute,
    outputDirectory: absolute,
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
    sourceDigest: sha,
    fixtureDigest: sha,
    configurationDigest: sha,
    schemaDigest: sha,
    inputsDigest: sha,
    caseOrderDigest: sha,
    model: z.literal('openai/gpt-6-luna'),
    caps: z
      .object(
        Object.fromEntries(Object.entries(diagnosticCaps).map(([key, value]) => [key, z.literal(value)])) as {
          [K in keyof typeof diagnosticCaps]: z.ZodLiteral<(typeof diagnosticCaps)[K]>;
        },
      )
      .strict(),
    pricing: z.strictObject({
      modelSource: z.literal('https://developers.openai.com/api/docs/models/gpt-6-luna'),
      pricingSource: z.literal('https://developers.openai.com/api/docs/pricing'),
      retrievedAt: z.literal('2026-10-19'),
      currency: z.literal('USD'),
      reservedMaximumUsd: z.literal(0.2022768),
      assumption: z.literal(
        'Full UTF8 body bytes as input tokens plus4096 framing; maximum cache-write, Fast2x and regional1.1 rates; not an account or invoice guarantee',
      ),
    }),
  })
  .refine(value => !value.approved || Boolean(value.approvedBy && value.approvedAt), 'Human attribution is required');
export type DiagnosticApproval = z.infer<typeof diagnosticApprovalSchema>;
type Measurement = Parameters<Telemetry['research']>[0];

export function fixtureContext(
  fixtures: DiagnosticFixtures,
  item: DiagnosticFixtures['cases'][number],
  runId: string,
  store: ResearchContext['store'],
): ResearchContext {
  const snapshot = snapshotConfiguration(qualificationConfig, fixtures.assessmentTime);
  return {
    runId,
    store,
    snapshot,
    domain: item.domain,
    domains: [item.domain],
    deadline: Date.now() + 180000,
    round: {
      ...item.round,
      query: snapshot.config.research.targeted.queries[item.round.target],
      year: new Date(fixtures.assessmentTime).getUTCFullYear(),
      searchDomains: [item.domain],
      previousEvidence: [],
      consultedUrls: [],
      counters: { discoveredUrls: 0, retrievedPages: 0, extractedCandidates: 1, selectedCandidates: 1, urls: [] },
    },
  };
}
async function sourceSnapshot(root: string) {
  const files = ['package.json', 'package-lock.json', 'tsconfig.json'];
  async function visit(folder: string) {
    for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (/\.(?:ts|mjs)$/.test(entry.name)) files.push(path);
    }
  }
  for (const folder of ['src', 'scripts']) await visit(folder);
  const hashes = [];
  for (const path of files.sort()) hashes.push([path, digest(await readFile(join(root, path), 'utf8'))]);
  const { stdout } = await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd: root });
  return { sourceRevision: stdout.trim(), sourceDigest: digest(canonical(hashes)) };
}
export type DiagnosticPaths = { fixtures: string; approval: string; output: string };
export async function prepareDiagnostic(paths: DiagnosticPaths, project = process.cwd()) {
  const projectRoot = resolve(project),
    approvalPath = resolve(paths.approval),
    outputDirectory = resolve(paths.output),
    fixturePath = resolve(paths.fixtures);
  const outside = (path: string) => relative(projectRoot, path).startsWith('../');
  if (!outside(approvalPath) || !outside(outputDirectory)) throw new Error('diagnostic_artifacts_must_be_external');
  const fixtureText = await readFile(fixturePath, 'utf8');
  const fixtures = diagnosticFixturesSchema.parse(JSON.parse(fixtureText));
  const wireSchema = JSON.parse(
    await readFile(join(projectRoot, 'tests/fixtures/qualification/verifier-wire-schema.v1.json'), 'utf8'),
  ) as unknown;
  const inputs = fixtures.cases.map(item =>
    interpretationInput(
      item.branch,
      item.evidence,
      fixtureContext(
        fixtures,
        item,
        '00000000-0000-4000-8000-000000000000',
        undefined as unknown as ResearchContext['store'],
      ),
      item.candidates,
    ),
  );
  const executionId = randomUUID();
  const approval = diagnosticApprovalSchema.parse({
    version: 1,
    purpose: 'verifier_diagnostic',
    executionId,
    approved: false,
    approvedBy: null,
    approvedAt: null,
    projectRoot,
    fixturePath,
    approvalPath,
    outputDirectory,
    journalPath: join(dirname(approvalPath), `verifier-diagnostic-${executionId}.jsonl`),
    ...(await sourceSnapshot(projectRoot)),
    fixtureDigest: digest(fixtureText),
    configurationDigest: digest(canonical(qualificationConfig)),
    schemaDigest: digest(canonical(wireSchema)),
    inputsDigest: digest(canonical(inputs)),
    caseOrderDigest: digest(canonical(fixtures.cases.map(item => item.id))),
    model: 'openai/gpt-6-luna',
    caps: diagnosticCaps,
    pricing: {
      modelSource: 'https://developers.openai.com/api/docs/models/gpt-6-luna',
      pricingSource: 'https://developers.openai.com/api/docs/pricing',
      retrievedAt: '2026-10-19',
      currency: 'USD',
      reservedMaximumUsd: 0.2022768,
      assumption:
        'Full UTF8 body bytes as input tokens plus4096 framing; maximum cache-write, Fast2x and regional1.1 rates; not an account or invoice guarantee',
    },
  });
  return { approval, fixtures, inputs, wireSchema };
}
export async function durableDiagnosticJson(path: string, value: unknown) {
  const file = await open(path + '.pending', 'w', 0o600);
  try {
    await file.writeFile(JSON.stringify(value, null, 2) + '\n');
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(path + '.pending', path);
  const directory = await open(dirname(path), 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
// Match the actual provider schema semantically; SDKs may omit the JSON Schema dialect marker.
function schemaShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(schemaShape);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== '$schema')
        .map(([key, item]) => [key, schemaShape(item)]),
    );
  return value;
}
export class VerifierDiagnosticGuard {
  private slot:
    | {
        index: number;
        runId: string;
        input: unknown;
        requested: boolean;
        measured: Measurement | null;
        inputBound: number;
      }
    | undefined;
  private nextSlot = 0;
  private started = Date.now();
  private failed: string | null = null;
  private requests = 0;
  private bytes = 0;
  private outputReserved = 0;
  private costReservedNanoUsd = 0;
  private attempts: Array<{
    slot: number;
    runId: string;
    dispatched: boolean;
    status: number | null;
    measurement: Measurement | null;
  }> = [];
  private constructor(
    readonly approval: DiagnosticApproval,
    private file: FileHandle,
    private transport: typeof fetch,
    private verifySource: () => Promise<void>,
    private inputs: unknown[],
    private instruction: string,
    private wireSchema: unknown,
  ) {}
  static async consume(
    approval: DiagnosticApproval,
    transport: typeof fetch,
    inputs: unknown[],
    instruction: string,
    verifySource = async () => {},
    wireSchema: unknown = z.toJSONSchema(verificationWireSchema),
  ) {
    approval = diagnosticApprovalSchema.parse(approval);
    Object.freeze(approval.caps);
    Object.freeze(approval.pricing);
    Object.freeze(approval);
    if (!approval.approved) throw new Error('diagnostic_not_approved');
    if (
      digest(canonical(inputs)) !== approval.inputsDigest ||
      inputs.length !== 6 ||
      digest(canonical(wireSchema)) !== approval.schemaDigest
    )
      throw new Error('diagnostic_inputs_mismatch');
    await verifySource();
    const file = await open(approval.journalPath, 'wx', 0o600);
    const guard = new VerifierDiagnosticGuard(
      approval,
      file,
      transport,
      verifySource,
      JSON.parse(canonical(inputs)),
      instruction,
      JSON.parse(canonical(wireSchema)),
    );
    try {
      await guard.record('consumed', { approvalDigest: digest(canonical(approval)), caps: approval.caps });
      const directory = await open(dirname(approval.journalPath), 'r');
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
      return guard;
    } catch (error) {
      await file.close();
      throw error;
    }
  }
  private stop(code: string): never {
    this.failed ??= code;
    throw new Error(this.failed);
  }
  private async record(type: string, value: unknown) {
    try {
      await this.file.appendFile(JSON.stringify({ at: new Date().toISOString(), type, value }) + '\n');
      await this.file.sync();
    } catch {
      this.stop('diagnostic_journal_unavailable');
    }
  }
  assertAvailable() {
    if (this.failed) throw new Error(this.failed);
    if (Date.now() - this.started >= this.approval.caps.durationMs) this.stop('diagnostic_deadline_exhausted');
  }
  async beginSlot(index: number, runId: string) {
    this.assertAvailable();
    if (index !== this.nextSlot || index >= this.approval.caps.requests || this.slot)
      this.stop('diagnostic_slot_invalid');
    this.slot = {
      index,
      runId,
      input: this.inputs[Math.floor(index / 3)],
      requested: false,
      measured: null,
      inputBound: 0,
    };
    await this.record('slot.started', { index, runId, inputDigest: digest(canonical(this.slot.input)) });
  }
  readonly fetch: typeof fetch = async (input, init) => {
    this.assertAvailable();
    const slot = this.slot;
    if (!slot || slot.requested) this.stop('diagnostic_slot_or_retry_invalid');
    await this.verifySource().catch(() => this.stop('diagnostic_source_changed'));
    const url = input instanceof Request ? input.url : String(input),
      method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const body =
      typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : null;
    if (url !== 'https://api.openai.com/v1/responses' || method !== 'POST' || body === null)
      this.stop('diagnostic_endpoint_forbidden');
    const bytes = Buffer.byteLength(body);
    if (bytes > this.approval.caps.bytesPerRequest || this.bytes + bytes > this.approval.caps.bytesTotal)
      this.stop('diagnostic_body_limit');
    let decoded: unknown;
    try {
      decoded = JSON.parse(body);
    } catch {
      this.stop('diagnostic_request_invalid');
    }
    const payload = decoded as Record<string, unknown>;
    const only = (value: unknown, keys: string[]) =>
      Boolean(
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).every(key => keys.includes(key)),
      );
    if (
      !only(payload, ['model', 'input', 'max_output_tokens', 'stream', 'store', 'reasoning', 'text', 'include']) ||
      !only(payload.reasoning, ['effort']) ||
      (payload.reasoning as { effort?: unknown }).effort !== 'low' ||
      (payload.include !== undefined && canonical(payload.include) !== canonical(['reasoning.encrypted_content']))
    )
      this.stop('diagnostic_request_forbidden');
    if (
      !payload ||
      typeof payload !== 'object' ||
      payload.model !== 'gpt-6-luna' ||
      payload.max_output_tokens !== 1000 ||
      payload.stream !== true ||
      payload.store !== false ||
      (payload.tools !== undefined && (!Array.isArray(payload.tools) || payload.tools.length)) ||
      payload.previous_response_id !== undefined ||
      payload.conversation !== undefined
    )
      this.stop('diagnostic_request_forbidden');
    const messages = payload.input as Array<{
      role?: string;
      content?: string | Array<{ type?: string; text?: string }>;
    }>;
    if (!Array.isArray(messages) || messages.length !== 2) this.stop('diagnostic_input_mismatch');
    const text = (value: (typeof messages)[number]) =>
      !only(value, ['role', 'content'])
        ? null
        : typeof value.content === 'string'
          ? value.content
          : Array.isArray(value.content) &&
              value.content.every(
                part => only(part, ['type', 'text']) && part.type === 'input_text' && typeof part.text === 'string',
              )
            ? value.content.map(part => part.text).join('')
            : null;
    if (
      !['system', 'developer'].includes(messages[0]!.role ?? '') ||
      text(messages[0]!) !== this.instruction ||
      messages[1]!.role !== 'user'
    )
      this.stop('diagnostic_input_mismatch');
    let supplied: unknown;
    try {
      supplied = JSON.parse(text(messages[1]!) ?? '');
    } catch {
      this.stop('diagnostic_input_mismatch');
    }
    if (canonical(supplied) !== canonical(slot.input)) this.stop('diagnostic_input_mismatch');
    const format = (payload.text as { format?: { type?: string; strict?: boolean; schema?: unknown } } | undefined)
      ?.format;
    if (
      !only(payload.text, ['format']) ||
      !only(format, ['type', 'strict', 'schema', 'name']) ||
      (format as { name?: unknown })?.name !== 'response' ||
      format?.type !== 'json_schema' ||
      format.strict !== true ||
      canonical(schemaShape(format.schema)) !== canonical(schemaShape(this.wireSchema))
    )
      this.stop('diagnostic_schema_mismatch');
    if (this.requests >= this.approval.caps.requests || this.outputReserved + 1000 > this.approval.caps.outputTotal)
      this.stop('diagnostic_request_limit');
    const inputBound = bytes + this.approval.caps.inputFramingTokens;
    const cost = inputBound * this.approval.caps.inputNanoUsdPerToken + 1000 * this.approval.caps.outputNanoUsdPerToken;
    if (this.costReservedNanoUsd + cost > this.approval.caps.costNanoUsd) this.stop('diagnostic_cost_limit');
    slot.requested = true;
    slot.inputBound = inputBound;
    this.requests++;
    this.bytes += bytes;
    this.outputReserved += 1000;
    this.costReservedNanoUsd += cost;
    const attempt = {
      slot: slot.index,
      runId: slot.runId,
      dispatched: false,
      status: null as number | null,
      measurement: null as Measurement | null,
    };
    this.attempts.push(attempt);
    await this.record('request.reserved', {
      slot: slot.index,
      runId: slot.runId,
      bodyDigest: digest(body),
      bytes,
      inputBound,
      outputReserved: 1000,
      costNanoUsd: cost,
      usage: null,
    });
    const remaining = this.approval.caps.durationMs - (Date.now() - this.started);
    if (remaining <= 0) this.stop('diagnostic_deadline_exhausted');
    const inherited = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const signal = AbortSignal.any([AbortSignal.timeout(remaining), ...(inherited ? [inherited] : [])]);
    try {
      const pending = this.transport(input, { ...init, redirect: 'error', signal });
      attempt.dispatched = true;
      const response = await pending;
      attempt.status = response.status;
      await this.record('request.response', { slot: slot.index, status: response.status });
      return response;
    } catch {
      await this.record('request.failed', { slot: slot.index, usage: null });
      this.stop('diagnostic_transport_failed');
    }
  };
  readonly measurement: Telemetry['research'] = async data => {
    const parsed = researchMeasurementSchema.safeParse(data);
    if (!parsed.success) this.stop('diagnostic_measurement_invalid');
    data = parsed.data;
    const slot = this.slot,
      attempt = this.attempts.at(-1);
    if (
      !slot?.requested ||
      !attempt ||
      data.runId !== slot.runId ||
      data.stage !== 'verify' ||
      data.model !== this.approval.model ||
      slot.measured
    )
      this.stop('diagnostic_measurement_invalid');
    slot.measured = data;
    attempt.measurement = data;
    await this.record('request.measurement', { slot: slot.index, ...data });
    if (data.inputTokens === null || data.outputTokens === null) this.stop('diagnostic_usage_unknown');
    if (data.inputTokens > slot.inputBound || data.outputTokens > 1000)
      this.stop('diagnostic_usage_exceeds_reservation');
  };
  async finishSlot() {
    this.assertAvailable();
    if (
      !this.slot?.requested ||
      !this.slot.measured ||
      this.slot.measured.inputTokens === null ||
      this.slot.measured.outputTokens === null
    )
      this.stop('diagnostic_usage_unknown');
    await this.record('slot.completed', { index: this.slot.index, runId: this.slot.runId });
    this.nextSlot++;
    this.slot = undefined;
  }
  accounting() {
    const completeUsage =
      this.attempts.length > 0 &&
      this.attempts.every(
        item =>
          item.measurement?.inputTokens !== null &&
          item.measurement?.inputTokens !== undefined &&
          item.measurement?.outputTokens !== null &&
          item.measurement?.outputTokens !== undefined,
      );
    return {
      knownInputTokensSubtotal: this.attempts.reduce((sum, item) => sum + (item.measurement?.inputTokens ?? 0), 0),
      knownOutputTokensSubtotal: this.attempts.reduce((sum, item) => sum + (item.measurement?.outputTokens ?? 0), 0),
      requestsReserved: this.requests,
      dispatchedRequests: this.attempts.filter(item => item.dispatched).length,
      bytesReserved: this.bytes,
      outputTokensReserved: this.outputReserved,
      costReservedNanoUsd: this.costReservedNanoUsd,
      usageComplete: completeUsage,
      inputTokens: completeUsage ? this.attempts.reduce((sum, item) => sum + item.measurement!.inputTokens!, 0) : null,
      outputTokens: completeUsage
        ? this.attempts.reduce((sum, item) => sum + item.measurement!.outputTokens!, 0)
        : null,
      attempts: this.attempts,
      completedSlots: this.nextSlot,
      failureCode: this.failed,
    };
  }
  async close(completed: boolean) {
    try {
      await this.record(completed ? 'completed' : 'failed', {
        ...this.accounting(),
        failureCode: this.failed ?? (completed ? null : 'diagnostic_execution_failed'),
      });
    } finally {
      await this.file.close();
    }
  }
}
export async function runDiagnostic(paths: DiagnosticPaths) {
  const prepared = await prepareDiagnostic(paths),
    approval = diagnosticApprovalSchema.parse(JSON.parse(await readFile(resolve(paths.approval), 'utf8')));
  const expected = {
    ...prepared.approval,
    executionId: approval.executionId,
    journalPath: join(dirname(prepared.approval.approvalPath), `verifier-diagnostic-${approval.executionId}.jsonl`),
    approved: approval.approved,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
  };
  if (canonical(expected) !== canonical(approval)) throw new Error('diagnostic_approval_binding_mismatch');
  if (!approval.approved) throw new Error('diagnostic_not_approved');
  if (!process.env.OPENAI_API_KEY || /^(example|placeholder|your[-_])/i.test(process.env.OPENAI_API_KEY))
    throw new Error('diagnostic_key_unavailable');
  const original = globalThis.fetch;
  const verifySource = async () => {
    const source = await sourceSnapshot(approval.projectRoot);
    if (
      source.sourceDigest !== approval.sourceDigest ||
      source.sourceRevision !== approval.sourceRevision ||
      digest(await readFile(approval.fixturePath, 'utf8')) !== approval.fixtureDigest ||
      digest(
        canonical(
          JSON.parse(
            await readFile(
              join(approval.projectRoot, 'tests/fixtures/qualification/verifier-wire-schema.v1.json'),
              'utf8',
            ),
          ),
        ),
      ) !== approval.schemaDigest
    )
      throw new Error('diagnostic_source_changed');
  };
  const guard = await VerifierDiagnosticGuard.consume(
    approval,
    original.bind(globalThis),
    prepared.inputs,
    qualificationConfig.prompts.verification,
    verifySource,
    prepared.wireSchema,
  );
  let directory: string | undefined,
    store: LeadEventStore | undefined,
    completed = false;
  let failureCode: string | null = null;
  const results: Array<
    { actualSupported: boolean; diagnostics: ReturnType<typeof verifierDiagnostics> } & Record<string, unknown>
  > = [];
  async function save() {
    await durableDiagnosticJson(join(approval.outputDirectory, 'result.json'), {
      executionId: approval.executionId,
      completed,
      failureCode,
      summary: {
        completedObservations: results.length,
        expectedSupported: 18,
        observedSupported: results.filter(item => item.actualSupported).length,
        observedRejected: results.filter(item => !item.actualSupported).length,
        diagnosticAvailability: Object.fromEntries(
          ['reported', 'missing', 'not_reported', 'invalid'].map(status => [
            status,
            results.flatMap(item => item.diagnostics).filter(item => item.status === status).length,
          ]),
        ),
        qualityClaim: 'selected_verifier_support_stability_only',
      },
      fixtureDigest: approval.fixtureDigest,
      sourceDigest: approval.sourceDigest,
      model: approval.model,
      accounting: guard.accounting(),
      results,
    });
  }
  try {
    await mkdir(approval.outputDirectory, { mode: 0o700 });
    await durableDiagnosticJson(join(approval.outputDirectory, 'approval.json'), approval);
    await durableDiagnosticJson(join(approval.outputDirectory, 'fixtures.json'), prepared.fixtures);
    directory = await mkdtemp(join(tmpdir(), 'verifier-diagnostic-'));
    store = new LeadEventStore(`file:${join(directory, 'application.db')}`);
    await store.init();
    store.qualifications.measurement = guard.measurement;
    globalThis.fetch = guard.fetch;
    const provider = new OpenAIEvidenceProvider();
    for (let index = 0; index < 18; index++) {
      const item = prepared.fixtures.cases[Math.floor(index / 3)]!;
      const reference = `verifier-${approval.executionId}-${index}`;
      const event = normalizedEventSchema.parse({
        version: 1,
        type: 'lead.received',
        sourceId: 'local-inbound',
        eventId: reference,
        receivedAt: prepared.fixtures.assessmentTime,
        lead: { reference, domain: item.domain },
        destination: { providerId: 'local', reference },
      });
      const run = await store.accept(
        event,
        100,
        snapshotConfiguration(qualificationConfig, prepared.fixtures.assessmentTime),
      );
      const context = fixtureContext(prepared.fixtures, item, run.runId, store.qualifications);
      context.deadline = await store.qualifications.start(run.runId, context.snapshot);
      await guard.beginSlot(index, run.runId);
      try {
        const verified = await provider.verify(item.branch, item.candidates, item.evidence, context);
        const batch = createEvidenceBatch([]);
        for (const source of item.evidence) batch.add(source);
        results.push({
          caseId: item.id,
          repetition: (index % 3) + 1,
          runId: run.runId,
          expectedSupported: true,
          actualSupported: verified.supportedCandidateIds.includes(item.candidates[0]!.id),
          unknownSupportedIds: verified.supportedCandidateIds.filter(id => id !== item.candidates[0]!.id).length,
          diagnostics: verifierDiagnostics(
            verified.diagnostics,
            item.candidates,
            verified.supportedCandidateIds,
            batch.prepare(),
            { providerId: provider.id, branch: item.branch, roundIndex: context.round.index },
          ),
          budget: (await store.qualifications.get(run.runId))!.budget,
        });
        await save();
        await guard.finishSlot();
      } finally {
        await save();
      }
    }
    completed = true;
    await save();
  } catch (error) {
    failureCode =
      guard.accounting().failureCode ?? (error instanceof ResearchError ? error.code : 'diagnostic_execution_failed');
    throw new Error(failureCode);
  } finally {
    globalThis.fetch = original;
    try {
      if (store) await save();
    } finally {
      try {
        store?.client.close();
        if (directory) await rm(directory, { recursive: true, force: true });
      } finally {
        await guard.close(completed);
      }
    }
  }
}
