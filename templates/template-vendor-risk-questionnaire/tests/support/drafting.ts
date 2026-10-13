import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { IntakeCoordinator } from '../../src/mastra/intake/adapters.ts';
import { openIntakeStore } from '../../src/mastra/persistence/store.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { buildEvidenceSnapshot } from '../../src/mastra/evidence/snapshot.ts';
import { manifestSchema } from '../../src/mastra/contracts/evidence-manifest.ts';
import { defaultExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';
import type { ExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';
import type { AnswerDraft, Interpretation } from '../../src/mastra/contracts/answer.ts';
import type { CanonicalQuestion } from '../../src/mastra/contracts/question.ts';
import type { EvidenceExcerpt } from '../../src/mastra/evidence/snapshot.ts';
import type { ModelCall, ModelFactory, ModelPart, ModelStream } from '../../src/mastra/processing/model.ts';
import { createDraftWorkflow } from '../../src/mastra/workflows/vendor-risk-drafts.ts';
import { sha256 } from '../../src/mastra/intake/source.ts';
import { canonicalJson } from '../../src/mastra/intake/source.ts';
import type { SourceSpan } from '../../src/mastra/processing/interpretation.ts';
import { xlsxFixture, docxFixture } from '../fixtures/office.ts';
import { source, context, tableMapping } from '../fixtures/support.ts';

export const controlText =
  'control Production workforce MFA is required. SSO is not offered to basic accounts and is limited to enterprise accounts. Payment card processing is not applicable. Production logs are retained for ninety days.';
export async function draftingFixture(
  root: string,
  options: {
    questions?: Array<{ id?: string; text: string; kind?: string; choices?: string; instructions?: string }>;
    domains?: string[];
    disclosure?: 'shareable' | 'review_required' | 'restricted';
    text?: string;
    evidence?: { format: 'json' | 'csv'; bytes: string };
    denied?: boolean;
    databasePath?: string;
    runId?: string;
    runtimeRoot?: string;
    format?: 'xlsx' | 'docx';
    transform?: (bytes: Uint8Array) => Uint8Array;
  } = {},
) {
  const runId = options.runId ?? 'draft-run',
    url = `file:${options.databasePath ?? resolve(root, 'state.db')}`,
    runtimeRoot = options.runtimeRoot ?? resolve(root, 'runtime');
  const data = options.questions ?? [{ text: 'Does production require MFA?' }];
  const hasInstructions = data.some(q => q.instructions !== undefined);
  const rows = [
    [
      'Reference',
      'Inquiry',
      'Response kind',
      'Allowed values',
      ...(hasInstructions ? ['Instructions'] : []),
      'Response',
      'Explanation',
      'Evidence',
    ],
    ...data.map((q, i) => [
      q.id ?? `Q${i + 1}`,
      q.text,
      q.kind ?? 'boolean',
      q.kind === 'free_text' ? '' : (q.choices ?? 'yes|no|partial|not_applicable|unknown|withheld'),
      ...(hasInstructions ? [q.instructions ?? ''] : []),
      '',
      '',
      '',
    ]),
  ];
  const raw = options.format === 'docx' ? docxFixture([{ table: rows }]) : xlsxFixture([{ name: 'Questions', rows }]);
  const s = source(options.transform?.(raw) ?? raw, `input.${options.format ?? 'xlsx'}`);
  const coordinator = new IntakeCoordinator();
  const mapping = tableMapping(
    s,
    [
      {
        regionId: options.format === 'docx' ? 'table:0' : 'sheet:0',
        startRow: 1,
        endRow: data.length,
        fields: {
          id: 0,
          question: 1,
          type: 2,
          options: 3,
          ...(hasInstructions ? { instructions: 4 } : {}),
          response: hasInstructions ? 5 : 4,
          explanation: hasInstructions ? 6 : 5,
          evidence: hasInstructions ? 7 : 6,
        },
      },
    ],
    [{ regionId: options.format === 'docx' ? 'table:0' : 'sheet:0', startRow: 0, endRow: 0, reason: 'Table header' }],
  );
  const imported = await coordinator.import(
    s,
    mapping,
    { questionnaireId: 'questionnaire', organizationId: 'northstar', title: 'Fictional review' },
    context(),
  );
  await mkdir(resolve(root, 'evidence'), { recursive: true });
  const bytes = options.evidence?.bytes ?? `# Approved record\n${options.text ?? controlText}\n`;
  const relativePath = options.evidence ? `control.${options.evidence.format}` : 'control.md';
  await writeFile(resolve(root, 'evidence', relativePath), bytes);
  const document = {
    id: 'control',
    relativePath,
    format: options.evidence?.format ?? 'markdown',
    version: '1',
    sha256: sha256(bytes),
    title: 'Private control record',
    citationLabel: 'Approved control record',
    scope: {
      organizationId: 'northstar',
      products: ['tasks'],
      environments: ['production'],
      domains: options.domains ?? ['access'],
    },
    kind: 'operational_record',
    approvalState: 'approved',
    approvedBy: 'operator',
    approvedAt: '2026-01-01T00:00:00.000Z',
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: '2126-01-01T00:00:00.000Z',
    llmAllowed: true,
    disclosure: options.disclosure ?? 'shareable',
  };
  const manifest = manifestSchema.parse({
    schemaVersion: 1,
    organizationId: 'northstar',
    documents: [
      document,
      ...(options.denied ? [{ ...document, id: 'unrelated', relativePath: 'unrelated.md', llmAllowed: false }] : []),
    ],
  });
  const manifestPath = resolve(root, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  const snapshot = await buildEvidenceSnapshot({
    runId,
    manifest,
    root: resolve(root, 'evidence'),
    runtimeRoot,
    scope: {
      organizationId: 'northstar',
      product: 'tasks',
      environment: 'production',
      domains: options.domains ?? ['access'],
    },
    context: context(),
  });
  const store = await openIntakeStore(url);
  try {
    await store.persistIntake(runId, imported.input, imported.mapping, s);
    await store.persistEvidence(snapshot.record, snapshot.sources);
  } finally {
    store.close();
  }
  return {
    root,
    runId,
    url,
    runtimeRoot,
    manifestPath,
    snapshot,
    questions: imported.input.questions,
    input: imported.input,
  };
}
export type DraftFixture = Awaited<ReturnType<typeof draftingFixture>>;
export interface CasePlan {
  requests?: (spans: SourceSpan[]) => Array<{ field: 'text' | 'instructions'; ref: string }>;
  value?: AnswerDraft['value'];
  text?: string;
  draft?: (draft: AnswerDraft) => AnswerDraft;
  interpretation?: Partial<Interpretation>;
  verification?: Record<string, unknown>;
  failures?: number;
  status?: number;
  missingUsage?: boolean;
  delayMs?: number;
  inconsistentWith?: string[];
}
export function userText(call: ModelCall): string {
  const message = [...call.prompt].reverse().find(m => m.role === 'user');
  if (!message || typeof message.content === 'string')
    return typeof message?.content === 'string' ? message.content : '';
  return message.content
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join('');
}
export function nativeWireChoices(call: ModelCall, questionId: string, field: string): string[] {
  if (call.responseFormat?.type !== 'json') throw new Error('STRUCTURED_WIRE_REQUIRED');
  const schema = call.responseFormat.schema as {
    properties: { interpretations: { properties: Record<string, { properties: Record<string, { enum: string[] }> }> } };
  };
  return schema.properties.interpretations.properties[questionId]!.properties[field]!.enum;
}
export function stream(parts: ModelPart[], extra: Partial<ModelStream> = {}): ModelStream {
  return {
    ...extra,
    stream: new ReadableStream<ModelPart>({
      start(c) {
        for (const part of parts) c.enqueue(part);
        c.close();
      },
    }),
  };
}
export function jsonStream(value: unknown, missingUsage = false): ModelStream {
  return stream([
    { type: 'text-start', id: 'text' },
    { type: 'text-delta', id: 'text', delta: typeof value === 'string' ? value : JSON.stringify(value) },
    { type: 'text-end', id: 'text' },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: {
        inputTokens: missingUsage ? undefined : 100,
        outputTokens: missingUsage ? undefined : 100,
        totalTokens: missingUsage ? undefined : 200,
        reasoningTokens: missingUsage ? undefined : 20,
      },
    },
  ]);
}
export function controlledProvider(
  fixture: DraftFixture,
  plans: CasePlan[] = [],
  guard?: (phase: 'injection' | 'pii', text: string, call: ModelCall) => ModelStream | undefined,
) {
  const calls: Array<{ phase: string; questionId: string; call: ModelCall }> = [];
  let active = 0,
    maximum = 0;
  const finished: string[] = [];
  const representativeReferences = new Map<string, string>();
  const failures = new Map<string, number>();
  const planFor = (id: string) => plans[fixture.questions.findIndex(q => q.id === id)] ?? {};
  const factory: ModelFactory = (phase, questionId) => {
    const doStream = async (call: ModelCall): Promise<ModelStream> => {
      calls.push({ phase, questionId, call: structuredClone({ ...call, abortSignal: undefined }) });
      const text = userText(call),
        plan = planFor(questionId);
      if (phase === 'injection' || phase === 'pii')
        return (
          guard?.(phase, text, call) ??
          jsonStream(
            phase === 'injection' ? { categories: null, reason: null } : { categories: null, detections: null },
          )
        );
      if (phase === 'interpretation') {
        const request = JSON.parse(text) as {
          questions: Array<{ id: string; spans: SourceSpan[]; equivalenceRef: string }>;
        };
        for (const q of request.questions) representativeReferences.set(q.id, q.equivalenceRef);
        return jsonStream({
          interpretations: Object.fromEntries(
            request.questions.map(q => {
              const p = planFor(q.id),
                fields = p.interpretation ?? {};
              const representative = fields.equivalenceKey
                ? fixture.questions.find(
                    question => planFor(question.id).interpretation?.equivalenceKey === fields.equivalenceKey,
                  )?.id
                : undefined;
              const equivalence = (representative ? representativeReferences.get(representative) : undefined) ?? 'none';
              return [
                q.id,
                {
                  domain: fields.domain ?? 'access',
                  product: fields.product ?? 'tasks',
                  environment: fields.environment ?? 'production',
                  timeQualifier:
                    fields.timeQualifier ??
                    (nativeWireChoices(call, q.id, 'timeQualifier').includes('current') ? 'current' : 'unspecified'),
                  query: q.spans[0]!.ref,
                  equivalenceKey: equivalence,
                  requests: Object.fromEntries(
                    (p.requests?.(q.spans) ?? q.spans.map(({ field, ref }) => ({ field, ref }))).map(
                      ({ field, ref }) => [ref, field],
                    ),
                  ),
                },
              ];
            }),
          ),
        });
      }
      if (phase === 'verification' && questionId.startsWith('consistency-')) {
        const request = JSON.parse(text) as { answers: Array<{ questionId: string; value: string }> };
        const [a, b] = request.answers;
        return jsonStream({
          materialContradiction:
            planFor(a!.questionId).inconsistentWith?.includes(b!.questionId) ||
            planFor(b!.questionId).inconsistentWith?.includes(a!.questionId) ||
            (a!.value === 'yes' && b!.value === 'no') ||
            (a!.value === 'no' && b!.value === 'yes') ||
            false,
        });
      }
      const failed = failures.get(questionId) ?? 0;
      if (phase === 'draft' && failed < (plan.failures ?? 0)) {
        failures.set(questionId, failed + 1);
        throw Object.assign(new Error('Provider failed with private response.'), { statusCode: plan.status ?? 503 });
      }
      if (phase === 'draft') {
        active++;
        maximum = Math.max(maximum, active);
        if (plan.delayMs) await new Promise(resolve => setTimeout(resolve, plan.delayMs));
        const q = fixture.questions.find(q => q.id === questionId)!;
        const excerpt = fixture.snapshot.record.excerpts.find(e => e.text.includes('control'))!;
        const draft = {
          ...draftFor(q, excerpt, plan.value ?? 'yes', plan.text),
          coveredSubparts: JSON.parse(text).required.subparts,
        };
        active--;
        finished.push(questionId);
        const finalDraft = plan.draft?.(draft) ?? draft;
        return jsonStream(
          {
            ...finalDraft,
            citations: finalDraft.citations.map(c => ({
              id: c.id,
              excerptId:
                fixture.snapshot.record.excerpts.find(
                  e =>
                    e.documentId === c.documentId &&
                    e.version === c.version &&
                    e.sourceSha256 === c.sourceSha256 &&
                    canonicalJson(e.locator) === canonicalJson(c.locator),
                )?.id ?? 'foreign-excerpt',
              supportingExcerpt: c.supportingExcerpt,
            })),
          },
          plan.missingUsage,
        );
      }
      return jsonStream(
        {
          supportedClaimIds: JSON.parse(text).draft.claims.map((claim: { id: string }) => claim.id),
          conflictedClaimIds: [],
          unsupportedCommitment: false,
          applicable: true,
          complete: true,
          sensitive: false,
          ...plan.verification,
        },
        plan.missingUsage,
      );
    };
    return { doStream, doGenerate: doStream };
  };
  return {
    factory,
    calls,
    finished,
    get maximum() {
      return maximum;
    },
  };
}
export function draftFor(
  q: CanonicalQuestion,
  e: EvidenceExcerpt,
  value: AnswerDraft['value'],
  text?: string,
): AnswerDraft {
  if (value === 'unknown')
    return {
      questionId: q.id,
      domain: 'access',
      value,
      text: '',
      responseOption: null,
      claims: [],
      citations: [],
      coveredSubparts: [],
      confidence: 0,
      limitations: ['No evidence.'],
    };
  const answer =
    text ??
    (value === 'yes'
      ? 'Production workforce MFA is required.'
      : value === 'no'
        ? 'SSO is not offered to basic accounts.'
        : value === 'partial'
          ? 'SSO is limited to enterprise accounts.'
          : value === 'not_applicable'
            ? 'Payment card processing is not applicable.'
            : 'Production logs are retained for ninety days.');
  return {
    questionId: q.id,
    domain: 'access',
    value,
    text: answer,
    responseOption: q.answerType === 'free_text' ? null : value,
    claims: [{ id: 'claim', text: answer, citationIds: ['citation'], kind: 'operational' }],
    citations: [
      {
        id: 'citation',
        documentId: e.documentId,
        version: e.version,
        sourceSha256: e.sourceSha256,
        locator: e.locator,
        supportingExcerpt: e.text,
      },
    ],
    coveredSubparts: ['control'],
    confidence: 0.95,
    limitations: value === 'partial' ? ['Enterprise subscription scope only.'] : [],
  };
}
export async function executeDraft(
  fixture: DraftFixture,
  provider: ReturnType<typeof controlledProvider>,
  policy: Partial<ExecutionPolicy> = {},
) {
  const workflow = createDraftWorkflow({
    databaseUrl: fixture.url,
    runtimeRoot: resolve(fixture.root, 'runtime'),
    models: provider.factory,
  });
  const run = await workflow.createRun();
  const result = await run.start({
    inputData: {
      runId: fixture.runId,
      evidenceRoot: resolve(fixture.root, 'evidence'),
      manifestPath: fixture.manifestPath,
      policy: { ...defaultExecutionPolicy, ...policy },
    },
  });
  const store = await openProcessingStore(fixture.url);
  try {
    return { result, status: await store.status(fixture.runId) };
  } finally {
    store.close();
  }
}
