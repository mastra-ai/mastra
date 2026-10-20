import { passageExtractionInstruction } from '../src/mastra/research/source-passages';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, open, readFile, readdir, rename } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { modelLabelsSchema, modelProfilesSchema, validateModelDataset } from '../src/mastra/model-evaluation-data';
import { textDigest } from '../src/mastra/evaluation';
import type { Assessment } from '../src/mastra/research/contracts';
import type { ResearchContext } from '../src/mastra/providers/evidence';
import { researchMeasurementSchema } from '../src/mastra/telemetry';
import type { Telemetry } from '../src/mastra/telemetry';
import { modelEvaluationConfig, modelEvaluationHarness } from '../tests/support/model-evaluation';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const absolute = z.string().refine(isAbsolute, 'Use absolute paths');
export const modelCollectionCaps = {
  caseCount: 24,
  researchedCases: 20,
  maxRequests: 120,
  maxRequestsPerCase: 6,
  maxOutputTokensPerCase: 12000,
  maxOutputTokensTotal: 240000,
  maxProcessingMsPerCase: 180000,
  maxDurationMs: 3900000,
  maxRequestBytes: 131072,
  costNanoUsd: 5000000000,
  inputFramingTokens: 4096,
  inputNanoUsdPerToken: 275,
  outputNanoUsdPerToken: 1100,
  searches: 0,
  pageRequests: 0,
  crmOperations: 0,
  retries: 0,
} as const;
function maximumReservation(caps: {
  maxRequests: number;
  maxRequestBytes: number;
  inputFramingTokens: number;
  inputNanoUsdPerToken: number;
  maxOutputTokensTotal: number;
  outputNanoUsdPerToken: number;
}) {
  return (
    caps.maxRequests * (caps.maxRequestBytes + caps.inputFramingTokens) * caps.inputNanoUsdPerToken +
    caps.maxOutputTokensTotal * caps.outputNanoUsdPerToken
  );
}
const inputText = z.union([
  z.string(),
  z.array(z.strictObject({ type: z.literal('input_text'), text: z.string() })).min(1),
]);
// Keep the transport text-only and exclude every optional routing, context and billable-tool surface.
const responsesPayloadSchema = z.strictObject({
  model: z.literal('gpt-6-luna'),
  max_output_tokens: z.number().int().min(128).max(2000),
  stream: z.literal(true),
  store: z.literal(false),
  reasoning: z.strictObject({ effort: z.literal('low') }),
  include: z.tuple([z.literal('reasoning.encrypted_content')]).optional(),
  input: z.tuple([
    z.strictObject({ role: z.enum(['system', 'developer']), content: inputText }),
    z.strictObject({ role: z.literal('user'), content: inputText }),
  ]),
  text: z.strictObject({
    format: z.strictObject({
      name: z.literal('response'),
      type: z.literal('json_schema'),
      strict: z.literal(true),
      schema: z.record(z.string(), z.unknown()),
    }),
  }),
});
function messageText(content: z.infer<typeof inputText>) {
  return typeof content === 'string' ? content : content.map(part => part.text).join('');
}
export const modelApprovalSchema = z
  .strictObject({
    version: z.literal(2),
    purpose: z.literal('qualification_model_collection'),
    executionId: z.uuid(),
    approved: z.boolean(),
    approvedBy: z.string().trim().min(1).max(100).nullable(),
    approvedAt: z.iso.datetime({ offset: true }).nullable(),
    approvalPath: absolute,
    journalPath: absolute,
    projectRoot: absolute,
    outputDirectory: absolute,
    profilesPath: absolute,
    labelsPath: absolute,
    profilesDigest: digest,
    labelsDigest: digest,
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
    sourceDigest: digest,
    configurationDigest: digest,
    promptsDigest: digest,
    model: z.literal('openai/gpt-6-luna'),
    caseIds: z.array(z.string().regex(/^[a-zA-Z0-9._-]{1,100}$/)).length(24),
    maximumReservationNanoUsd: z.number().int().min(1).max(4724544000),
    pricing: z.strictObject({
      currency: z.literal('USD'),
      modelSource: z.literal('https://developers.openai.com/api/docs/models/gpt-6-luna'),
      pricingSource: z.literal('https://developers.openai.com/api/docs/pricing'),
      retrievedAt: z.literal('2026-10-19'),
      assumption: z.literal(
        'Full UTF8 body bytes as input tokens plus4096 framing; maximum cache-write, Fast2x and regional1.1 rates; not an account or invoice guarantee',
      ),
    }),
    caps: z.strictObject({
      caseCount: z.literal(24),
      researchedCases: z.literal(20),
      maxRequests: z.number().int().min(1).max(120),
      maxRequestsPerCase: z.number().int().min(1).max(6),
      maxOutputTokensPerCase: z.number().int().min(128).max(12000),
      maxOutputTokensTotal: z.number().int().min(128).max(240000),
      maxProcessingMsPerCase: z.number().int().min(1).max(180000),
      maxDurationMs: z.number().int().min(1).max(3900000),
      maxRequestBytes: z.number().int().min(1).max(131072),
      costNanoUsd: z.number().int().min(1).max(5000000000),
      inputFramingTokens: z.literal(4096),
      inputNanoUsdPerToken: z.literal(275),
      outputNanoUsdPerToken: z.literal(1100),
      searches: z.literal(0),
      pageRequests: z.literal(0),
      crmOperations: z.literal(0),
      retries: z.literal(0),
    }),
  })
  .superRefine((value, context) => {
    const caps = value.caps;
    if (
      caps.maxRequestsPerCase > caps.maxRequests ||
      caps.maxRequests > caps.researchedCases * caps.maxRequestsPerCase ||
      caps.maxOutputTokensPerCase > caps.maxRequestsPerCase * 2000 ||
      caps.maxOutputTokensPerCase > caps.maxOutputTokensTotal ||
      caps.maxOutputTokensTotal > caps.maxRequests * 2000 ||
      caps.maxOutputTokensTotal > caps.researchedCases * caps.maxOutputTokensPerCase ||
      value.maximumReservationNanoUsd !== maximumReservation(caps)
    )
      context.addIssue({ code: 'custom', message: 'Collection reservation caps must be consistent' });
  })
  .refine(value => new Set(value.caseIds).size === 24, 'Case IDs must be unique')
  .refine(
    value => !value.approved || Boolean(value.approvedBy && value.approvedAt),
    'Approved manifests require recorded human attribution',
  );
export type ModelApproval = z.infer<typeof modelApprovalSchema>;
type Measurement = Parameters<Telemetry['research']>[0];
interface Attempt {
  index: number;
  caseId: string;
  runId: string;
  stage: 'extract' | 'verify';
  outputReserved: number;
  inputBound: number;
  costReservedNanoUsd: number;
  responseStatus: number | null;
  dispatched: boolean;
  measurement: Measurement | null;
}
interface CaseProgress {
  id: string;
  population: 'domain' | 'email' | 'crm';
  runId: string | null;
  startedAt: string;
  startedMs: number;
  attempts: Attempt[];
  budget: unknown;
  completed: boolean;
}

async function durableJson(path: string, value: unknown) {
  const pending = path + '.pending';
  const handle = await open(pending, 'w', 0o600);
  try {
    await handle.writeFile(JSON.stringify(value, null, 2) + '\n');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(pending, path);
  const directory = await open(dirname(path), 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
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
  for (const folder of ['src', 'scripts', 'tests/support']) await visit(folder);
  const hashes = [];
  for (const path of files.sort()) hashes.push([path, textDigest(await readFile(join(root, path), 'utf8'))]);
  const { stdout } = await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd: root });
  return { sourceRevision: stdout.trim(), sourceDigest: textDigest(JSON.stringify(hashes)) };
}
function outside(root: string, path: string) {
  const rel = relative(root, path);
  return rel === '..' || rel.startsWith('../');
}
export async function prepareModelApproval(
  paths: { profiles: string; labels: string; approval: string; output: string },
  root = process.cwd(),
) {
  const projectRoot = resolve(root),
    profilesPath = resolve(paths.profiles),
    labelsPath = resolve(paths.labels),
    approvalPath = resolve(paths.approval),
    outputDirectory = resolve(paths.output);
  if (!outside(projectRoot, approvalPath) || !outside(projectRoot, outputDirectory))
    throw new Error('model_collection_artifacts_must_be_external');
  const profileText = await readFile(profilesPath, 'utf8'),
    labelText = await readFile(labelsPath, 'utf8');
  const profiles = modelProfilesSchema.parse(JSON.parse(profileText)),
    labels = modelLabelsSchema.parse(JSON.parse(labelText));
  if (labels.profilesDigest !== textDigest(profileText)) throw new Error('model_dataset_profile_digest_mismatch');
  validateModelDataset(profiles, labels);
  const executionId = randomUUID();
  const manifest = modelApprovalSchema.parse({
    version: 2,
    purpose: 'qualification_model_collection',
    executionId,
    approved: false,
    approvedBy: null,
    approvedAt: null,
    approvalPath,
    journalPath: resolve(dirname(approvalPath), `model-collection-${executionId}.jsonl`),
    projectRoot,
    outputDirectory,
    profilesPath,
    labelsPath,
    profilesDigest: textDigest(profileText),
    labelsDigest: textDigest(labelText),
    ...(await sourceSnapshot(projectRoot)),
    configurationDigest: textDigest(JSON.stringify(modelEvaluationConfig)),
    promptsDigest: textDigest(JSON.stringify(modelEvaluationConfig.prompts)),
    model: 'openai/gpt-6-luna',
    caseIds: profiles.cases.map(item => item.id),
    caps: modelCollectionCaps,
    maximumReservationNanoUsd: maximumReservation(modelCollectionCaps),
    pricing: {
      currency: 'USD',
      modelSource: 'https://developers.openai.com/api/docs/models/gpt-6-luna',
      pricingSource: 'https://developers.openai.com/api/docs/pricing',
      retrievedAt: '2026-10-19',
      assumption:
        'Full UTF8 body bytes as input tokens plus4096 framing; maximum cache-write, Fast2x and regional1.1 rates; not an account or invoice guarantee',
    },
  });
  return { manifest, profiles, labels, profileText, labelText };
}

/** One consumed approval owns one exclusive external journal, independent of disposable output directories. */
export class ModelCollectionGuard {
  readonly cases: CaseProgress[] = [];
  private active: CaseProgress | undefined;
  private stageName: 'extract' | 'verify' | undefined;
  private currentAttempt: Attempt | undefined;
  private requestCount = 0;
  private outputReserved = 0;
  private costReservedNanoUsd = 0;
  private bytesReserved = 0;
  private failureCode: string | undefined;
  private readonly startedMs = Date.now();
  private constructor(
    readonly approval: ModelApproval,
    private readonly journal: FileHandle,
    private readonly transport: typeof fetch,
    private readonly verifySource: () => Promise<void>,
  ) {}
  static async consume(
    input: ModelApproval,
    transport: typeof fetch,
    verifySource: () => Promise<void> = async () => {},
  ) {
    const approval = modelApprovalSchema.parse(input);
    Object.freeze(approval.caseIds);
    Object.freeze(approval.caps);
    Object.freeze(approval.pricing);
    Object.freeze(approval);
    if (!approval.approved) throw new Error('model_collection_not_approved');
    await verifySource();
    const journal = await open(approval.journalPath, 'wx', 0o600);
    const guard = new ModelCollectionGuard(approval, journal, transport, verifySource);
    try {
      await guard.record('collection.consumed', {
        executionId: approval.executionId,
        approvalDigest: textDigest(JSON.stringify(approval)),
        sourceDigest: approval.sourceDigest,
        profilesDigest: approval.profilesDigest,
        labelsDigest: approval.labelsDigest,
        caps: approval.caps,
      });
      const directory = await open(dirname(approval.journalPath), 'r');
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } catch (error) {
      await journal.close();
      throw error;
    }
    return guard;
  }
  private async record(type: string, data: unknown) {
    try {
      await this.journal.appendFile(JSON.stringify({ type, at: new Date().toISOString(), data }) + '\n');
      await this.journal.sync();
    } catch {
      this.failureCode = 'model_collection_journal_unavailable';
      throw new Error(this.failureCode);
    }
  }
  private stop(code: string): never {
    this.failureCode ??= code;
    throw new Error(this.failureCode);
  }
  assertAvailable() {
    if (this.failureCode) throw new Error(this.failureCode);
    if (
      Date.now() - this.startedMs >= this.approval.caps.maxDurationMs ||
      (this.active &&
        !this.active.completed &&
        Date.now() - this.active.startedMs >= this.approval.caps.maxProcessingMsPerCase)
    )
      this.stop('model_collection_deadline_exhausted');
  }
  async beginCase(id: string, population: CaseProgress['population']) {
    this.assertAvailable();
    if (this.active && !this.active.completed) this.stop('model_collection_case_incomplete');
    if (id !== this.approval.caseIds[this.cases.length]) this.stop('model_collection_case_order_invalid');
    if (
      population === 'domain' &&
      this.cases.filter(item => item.population === 'domain').length >= this.approval.caps.researchedCases
    )
      this.stop('model_collection_researched_cases_exhausted');
    this.active = {
      id,
      population,
      runId: null,
      startedAt: new Date().toISOString(),
      startedMs: Date.now(),
      attempts: [],
      budget: null,
      completed: false,
    };
    this.cases.push(this.active);
    await this.record('case.started', { id, population });
  }
  async admitted(runId: string) {
    this.assertAvailable();
    if (!this.active || this.active.runId || this.active.completed) this.stop('model_collection_no_case');
    this.active.runId = runId;
    await this.record('case.admitted', { id: this.active.id, runId });
  }
  private assertAttemptMeasured() {
    if (this.currentAttempt && !this.currentAttempt.measurement && !this.failureCode)
      this.failureCode = 'model_collection_usage_unknown';
    this.assertAvailable();
  }
  async stage<T>(stage: 'extract' | 'verify', context: ResearchContext, work: () => Promise<T>): Promise<T> {
    this.assertAvailable();
    if (this.active?.runId !== context.runId || this.active.completed || this.stageName)
      this.stop('model_collection_context_mismatch');
    this.stageName = stage;
    this.currentAttempt = undefined;
    try {
      const result = await work();
      this.assertAvailable();
      return result;
    } finally {
      this.stageName = undefined;
      // Provider telemetry errors may be swallowed; retain the terminal guard state at the stage boundary.
      this.assertAttemptMeasured();
    }
  }
  readonly fetch: typeof fetch = async (input, init) => {
    this.assertAvailable();
    if (this.currentAttempt) this.stop('model_collection_retry_forbidden');
    const active = this.active,
      stage = this.stageName;
    if (!active?.runId || active.population !== 'domain' || !stage) this.stop('model_collection_unbound_request');
    try {
      await this.verifySource();
    } catch (error) {
      this.stop(
        error instanceof Error && error.message === 'model_collection_dataset_changed'
          ? error.message
          : 'model_collection_source_changed',
      );
    }
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const body =
      typeof init?.body === 'string'
        ? init.body
        : init?.body === undefined && input instanceof Request
          ? await input.clone().text()
          : null;
    if (url !== 'https://api.openai.com/v1/responses' || method !== 'POST' || body === null)
      this.stop('model_collection_transport_forbidden');
    if (Buffer.byteLength(body) > this.approval.caps.maxRequestBytes)
      this.stop('model_collection_request_size_exhausted');
    let decoded: unknown;
    try {
      decoded = JSON.parse(body);
    } catch {
      this.stop('model_collection_request_invalid');
    }
    const parsed = responsesPayloadSchema.safeParse(decoded);
    if (!parsed.success) this.stop('model_collection_request_forbidden');
    const payload = parsed.data;
    const instruction =
      stage === 'extract'
        ? passageExtractionInstruction(modelEvaluationConfig.prompts.extraction)
        : modelEvaluationConfig.prompts.verification;
    if (messageText(payload.input[0].content) !== instruction) this.stop('model_collection_instruction_mismatch');
    try {
      JSON.parse(messageText(payload.input[1].content));
    } catch {
      this.stop('model_collection_request_invalid');
    }
    const tokens = payload.max_output_tokens;
    if (tokens > (stage === 'extract' ? 2000 : 1000)) this.stop('model_collection_request_output_invalid');
    this.assertAvailable();
    if (this.currentAttempt) this.stop('model_collection_retry_forbidden');
    const requestBytes = Buffer.byteLength(body);
    const inputBound = requestBytes + this.approval.caps.inputFramingTokens;
    const costReservedNanoUsd =
      inputBound * this.approval.caps.inputNanoUsdPerToken + tokens * this.approval.caps.outputNanoUsdPerToken;
    if (this.costReservedNanoUsd + costReservedNanoUsd > this.approval.caps.costNanoUsd)
      this.stop('model_collection_cost_exhausted');
    const reservedForCase = active.attempts.reduce((sum, item) => sum + item.outputReserved, 0);
    if (
      this.requestCount >= this.approval.caps.maxRequests ||
      active.attempts.length >= this.approval.caps.maxRequestsPerCase ||
      this.outputReserved + tokens > this.approval.caps.maxOutputTokensTotal ||
      reservedForCase + tokens > this.approval.caps.maxOutputTokensPerCase
    )
      this.stop('model_collection_limit_exhausted');
    const attempt: Attempt = {
      index: ++this.requestCount,
      caseId: active.id,
      runId: active.runId,
      stage,
      outputReserved: tokens,
      inputBound,
      costReservedNanoUsd,
      responseStatus: null,
      dispatched: false,
      measurement: null,
    };
    this.outputReserved += tokens;
    this.costReservedNanoUsd += costReservedNanoUsd;
    this.bytesReserved += requestBytes;
    active.attempts.push(attempt);
    this.currentAttempt = attempt;
    await this.record('request.reserved', {
      ...attempt,
      requestBytes,
      costReservedNanoUsdTotal: this.costReservedNanoUsd,
      requestDigest: textDigest(body),
      usageStatus: 'unknown',
    });
    this.assertAvailable();
    const remaining = Math.min(
      this.approval.caps.maxDurationMs - (Date.now() - this.startedMs),
      this.approval.caps.maxProcessingMsPerCase - (Date.now() - active.startedMs),
    );
    if (remaining <= 0) this.stop('model_collection_deadline_exhausted');
    const inherited = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const signal = AbortSignal.any([...(inherited ? [inherited] : []), AbortSignal.timeout(remaining)]);
    try {
      attempt.dispatched = true;
      const pending = this.transport(url, {
        method: 'POST',
        body,
        headers: init?.headers ?? (input instanceof Request ? input.headers : undefined),
        signal,
        redirect: 'error',
      });
      const response = await pending;
      attempt.responseStatus = response.status;
      await this.record('request.response', { index: attempt.index, status: response.status });
      if (!response.ok) this.stop('model_collection_transport_failed');
      return response;
    } catch {
      await this.record('request.failed', { index: attempt.index, usageStatus: 'unknown' });
      this.stop('model_collection_transport_failed');
    }
  };
  readonly measurement: Telemetry['research'] = async data => {
    const parsed = researchMeasurementSchema.safeParse(data);
    if (!parsed.success) this.stop('model_collection_measurement_invalid');
    data = parsed.data;
    const attempt = this.currentAttempt;
    if (!attempt) {
      await this.record('provider.measurement_without_dispatch', { runId: data.runId, stage: data.stage });
      return;
    }
    if (
      attempt.runId !== data.runId ||
      attempt.stage !== data.stage ||
      data.model !== this.approval.model ||
      attempt.measurement
    )
      this.stop('model_collection_measurement_invalid');
    attempt.measurement = data;
    await this.record('request.measurement', { index: attempt.index, ...data });
    if (data.inputTokens === null || data.outputTokens === null) this.stop('model_collection_usage_unknown');
    if (
      data.inputTokens > attempt.inputBound ||
      data.outputTokens > attempt.outputReserved ||
      (data.reasoningTokens !== null && data.reasoningTokens > data.outputTokens)
    )
      this.stop('model_collection_usage_exceeds_reservation');
  };
  async finishCase(budget: unknown) {
    this.assertAvailable();
    if (!this.active) this.stop('model_collection_no_case');
    this.active.budget = budget;
    this.active.completed = true;
    await this.record('case.completed', {
      id: this.active.id,
      runId: this.active.runId,
      elapsedMs: Date.now() - this.active.startedMs,
      budget,
      modelRequests: this.active.attempts.length,
    });
  }
  provenance() {
    const attempts = this.cases.flatMap(item => item.attempts);
    const knownInputs = attempts.filter(
      item => item.measurement?.inputTokens !== null && item.measurement?.inputTokens !== undefined,
    );
    const knownOutputs = attempts.filter(
      item => item.measurement?.outputTokens !== null && item.measurement?.outputTokens !== undefined,
    );
    return {
      executionId: this.approval.executionId,
      approvalDigest: textDigest(JSON.stringify(this.approval)),
      sourceRevision: this.approval.sourceRevision,
      sourceDigest: this.approval.sourceDigest,
      configurationDigest: this.approval.configurationDigest,
      promptsDigest: this.approval.promptsDigest,
      model: this.approval.model,
      requestsReserved: attempts.length,
      confirmedTransportAttempts: attempts.filter(item => item.dispatched).length,
      responseCount: attempts.filter(item => item.responseStatus !== null).length,
      outputTokensReserved: this.outputReserved,
      bytesReserved: this.bytesReserved,
      costReservedNanoUsd: this.costReservedNanoUsd,
      costCeilingNanoUsd: this.approval.caps.costNanoUsd,
      failureCode: this.failureCode ?? null,
      observedInputTokens:
        attempts.length && knownInputs.length === attempts.length
          ? knownInputs.reduce((sum, item) => sum + item.measurement!.inputTokens!, 0)
          : null,
      observedOutputTokens:
        attempts.length && knownOutputs.length === attempts.length
          ? knownOutputs.reduce((sum, item) => sum + item.measurement!.outputTokens!, 0)
          : null,
      knownInputTokensSubtotal: knownInputs.reduce((sum, item) => sum + item.measurement!.inputTokens!, 0),
      knownOutputTokensSubtotal: knownOutputs.reduce((sum, item) => sum + item.measurement!.outputTokens!, 0),
      caseRequests: Object.fromEntries(this.cases.map(item => [item.id, item.attempts.length])),
    };
  }
  async close(completed: boolean) {
    try {
      await this.record(completed ? 'collection.completed' : 'collection.failed', {
        ...this.provenance(),
        failureCode: this.failureCode ?? (completed ? null : 'model_collection_failed'),
      });
    } finally {
      await this.journal.close();
    }
  }
}

/** Recheck source and raw dataset bytes before consumption and every dispatch. */
export async function verifyModelBindings(approval: ModelApproval) {
  const current = await sourceSnapshot(approval.projectRoot);
  if (current.sourceRevision !== approval.sourceRevision || current.sourceDigest !== approval.sourceDigest)
    throw new Error('model_collection_source_changed');
  const [profiles, labels] = await Promise.all([
    readFile(approval.profilesPath, 'utf8'),
    readFile(approval.labelsPath, 'utf8'),
  ]);
  if (textDigest(profiles) !== approval.profilesDigest || textDigest(labels) !== approval.labelsDigest)
    throw new Error('model_collection_dataset_changed');
}

export async function runModelCollection(paths: {
  profiles: string;
  labels: string;
  approval: string;
  output: string;
}) {
  const prepared = await prepareModelApproval(paths);
  const rawApproval = JSON.parse(await readFile(resolve(paths.approval), 'utf8'));
  if (rawApproval?.version !== 2) throw new Error('model_collection_approval_version_unsupported');
  const approval = modelApprovalSchema.parse(rawApproval);
  const expected = {
    ...prepared.manifest,
    executionId: approval.executionId,
    journalPath: resolve(dirname(approval.approvalPath), `model-collection-${approval.executionId}.jsonl`),
    approved: approval.approved,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
    caps: approval.caps,
    maximumReservationNanoUsd: maximumReservation(approval.caps),
  };
  if (JSON.stringify(approval) !== JSON.stringify(modelApprovalSchema.parse(expected)))
    throw new Error('model_collection_approval_binding_mismatch');
  if (!process.env.OPENAI_API_KEY || /^(example|placeholder|your[-_])/i.test(process.env.OPENAI_API_KEY))
    throw new Error('model_collection_key_unavailable');
  const verifySource = () => verifyModelBindings(approval);
  const originalFetch = globalThis.fetch;
  const guard = await ModelCollectionGuard.consume(approval, originalFetch.bind(globalThis), verifySource);
  let app: Awaited<ReturnType<typeof modelEvaluationHarness>> | undefined;
  const observations: Array<{ id: string; assessment: Assessment }> = [];
  const summaries: Array<Record<string, unknown>> = [];
  let completed = false;
  async function save() {
    await durableJson(join(approval.outputDirectory, 'observations.json'), {
      datasetDigest: approval.labelsDigest,
      profilesDigest: approval.profilesDigest,
      mode: 'live_model',
      collection: guard.provenance(),
      observations,
      semanticReviews: [],
    });
    await durableJson(join(approval.outputDirectory, 'collection-status.json'), {
      completed,
      cases: guard.cases,
      collection: guard.provenance(),
      journalPath: approval.journalPath,
    });
    await durableJson(join(approval.outputDirectory, 'summary-review-material.json'), summaries);
    await durableJson(
      join(approval.outputDirectory, 'summary-reviews.template.json'),
      summaries.map(item => ({
        id: item.id,
        reviewer: '',
        summaryDigest: item.summaryDigest,
        unsupportedDecisiveClaims: [],
        allUnsupportedClaimsFlagged: false,
      })),
    );
  }
  try {
    await mkdir(approval.outputDirectory, { mode: 0o700 });
    await durableJson(join(approval.outputDirectory, 'profiles.json'), JSON.parse(prepared.profileText));
    await durableJson(join(approval.outputDirectory, 'expected.json'), JSON.parse(prepared.labelText));
    globalThis.fetch = guard.fetch;
    app = await modelEvaluationHarness(prepared.profiles, {
      admitted: runId => guard.admitted(runId),
      stage: (stage, context, work) => guard.stage(stage, context, work),
      measurement: guard.measurement,
    });
    for (const profile of prepared.profiles.cases) {
      await guard.beginCase(profile.id, profile.lead.domain ? 'domain' : profile.lead.email ? 'email' : 'crm');
      const result = await app.assess(profile);
      await guard.finishCase(result.budget);
      observations.push({ id: profile.id, assessment: result.assessment });
      summaries.push({
        id: profile.id,
        summary: result.assessment.summary,
        summaryDigest: textDigest(result.assessment.summary),
        facts: result.assessment.facts,
        evidence: result.assessment.evidence,
      });
      await save();
      guard.assertAvailable();
    }
    completed = true;
    await save();
  } finally {
    globalThis.fetch = originalFetch;
    try {
      if (app) await save();
    } finally {
      try {
        await app?.close();
      } finally {
        await guard.close(completed);
      }
    }
  }
}
