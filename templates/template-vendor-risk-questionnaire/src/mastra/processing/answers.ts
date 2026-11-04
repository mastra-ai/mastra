import { generatePhase } from '../agents/runtime.ts';
import { isStorageFailure } from '../persistence/client.ts';
import { RequestContext } from '@mastra/core/request-context';

import { evidenceAnswerAgent } from '../agents/evidence-answer.ts';
import { supportVerifierAgent } from '../agents/support-verifier.ts';
import { modelEvidenceExcerpt } from '../evidence/context.ts';
import type { CanonicalQuestion } from '../contracts/question.ts';
import {
  draftSchema,
  compatibleResponseSchema,
  draftResponseSchema,
  draftInvariantSchema,
  interpretationSchema,
  questionResultSchema,
  verificationSchema,
} from '../contracts/answer.ts';
import type { QuestionResult, Reason, AnswerDraft, Interpretation } from '../contracts/answer.ts';
import type { ExecutionPolicy } from '../contracts/execution-policy.ts';
import type { ProcessingStore } from '../persistence/processing.ts';
import { canonicalJson } from '../intake/source.ts';
import { validateEvidenceCitation } from '../evidence/snapshot.ts';
import type { buildEvidenceSnapshot, EvidenceExcerpt } from '../evidence/snapshot.ts';
import type { InputAdapterContext } from '../intake/source.ts';
import type { ModelFactory } from './model.ts';
import { createScreening } from './security.ts';
import { checkLocalContent } from './local-filter.ts';
import { ProcessingFailure, OutputValidationFailure, globalFailures } from './failure.ts';
import { telemetryId } from '../observability/privacy.ts';

export interface QuestionEnvironment {
  runId: string;
  policy: ExecutionPolicy;
  store: ProcessingStore;
  models: ModelFactory;
  evidence: Awaited<ReturnType<typeof buildEvidenceSnapshot>>;
  evidenceRoot: string;
  context: InputAdapterContext;
}

export function reviewResult(question: CanonicalQuestion, reason: Reason, attempts = 0): QuestionResult {
  return questionResultSchema.parse({
    questionId: question.id,
    order: question.order,
    draft: null,
    interpretation: null,
    status:
      reason === 'SECURITY_BLOCKED' || reason === 'DETECTOR_FAILED' ? 'security_review_required' : 'review_required',
    reasons: [reason],
    attempts,
  });
}

export function trustedQuestionContext(
  questionId: string,
  environment: Pick<QuestionEnvironment, 'runId' | 'policy'> & {
    evidence: Pick<QuestionEnvironment['evidence'], 'record'>;
  },
) {
  const context = new RequestContext();
  context.set('runId', environment.runId);
  context.set('questionId', questionId);
  context.set('organizationId', environment.evidence.record.scope.organizationId);
  context.set('policyVersion', environment.policy.version);
  context.set('actor', 'local-operator');
  return context;
}

export function questionPayload(question: CanonicalQuestion) {
  return {
    id: question.id,
    text: question.originalText,
    instructions: question.instructions ?? '',
    section: question.section ?? '',
    answerType: question.answerType,
    constraints: question.answerConstraints,
  };
}

async function processQuestionImpl(
  question: CanonicalQuestion,
  environment: QuestionEnvironment,
  interpreted: Interpretation,
): Promise<QuestionResult> {
  const { runId, policy, store, evidence, models } = environment;
  let attempts = 0;
  const onAttempt = () => {
    attempts++;
  };
  const requestContext = trustedQuestionContext(question.id, environment);
  const nativeScreen = createScreening({
    runId,
    questionId: question.id,
    policy,
    store,
    models,
    onAttempt,
    requestContext,
  });
  let questionFailure: Reason | undefined;
  const beforeCall = () => {
    if (questionFailure) throw new ProcessingFailure(questionFailure);
  };
  const screen: typeof nativeScreen = async (text, boundary) => {
    try {
      await nativeScreen(text, boundary);
    } catch (error) {
      questionFailure = error instanceof ProcessingFailure ? error.code : 'DETECTOR_FAILED';
      throw error;
    }
  };

  const interpretation = interpreted;
  let nativeStage: 'draft' | 'verification' = 'draft';
  let nativeTurn = 0;
  try {
    const existing = await store.status(runId);
    if (existing?.run.stopReason) throw new ProcessingFailure(existing.run.stopReason);
    const questionInput = questionPayload(question);
    const reasons: Reason[] = [];
    if (
      !evidence.record.scope.domains.includes(interpretation.domain) ||
      interpretation.product !== evidence.record.scope.product ||
      interpretation.environment !== evidence.record.scope.environment ||
      interpretation.timeQualifier.startsWith('unresolved-')
    )
      reasons.push('AMBIGUOUS_APPLICABILITY');
    const delivered = new Map<string, EvidenceExcerpt>();
    // Bound the lexical pass with distinct source terms; all original wording stays in the answer input.
    const sourceWords = interpretation.subparts
      .join(' ')
      .replace(
        /\b(?:what|which|how|does|do|did|is|are|was|were|the|a|an|of|for|to|in|and|or|you|your|we|our|it|its|please|describe|provide|explain|state|currently|current|security|period|answer|distinguish|policy|operational|evidence)\b/gi,
        ' ',
      )
      .replace(/[^\p{L}\p{N}._:-]+/gu, ' ')
      .trim()
      .split(/\s+/)
      .filter(
        word => ![evidence.record.scope.organizationId, evidence.record.scope.product].includes(word.toLowerCase()),
      )
      .map(word => (/(?:ss|us|is)\b/i.test(word) ? word : word.replace(/([a-z]{3,})s\b/gi, '$1')));
    const lexicalQuery = [...new Set(sourceWords)].reduce((query, word) => {
      const candidate = query ? `${query} ${word}` : word;
      return interpretationSchema.shape.query.safeParse(candidate).success ? candidate : query;
    }, '');
    const queries = [...new Set([interpretation.query, lexicalQuery].filter(Boolean))];
    for (const query of queries) {
      for (const { excerpt } of await evidence.search(query, 3)) {
        const previous = delivered.get(excerpt.id);
        const original = evidence.record.excerpts.find(candidate => candidate.id === excerpt.id);
        if (
          !original ||
          canonicalJson(original) !== canonicalJson(excerpt) ||
          (previous && canonicalJson(modelEvidenceExcerpt(previous)) !== canonicalJson(modelEvidenceExcerpt(excerpt)))
        )
          throw new ProcessingFailure('INVALID_ATTRIBUTION');
        try {
          await checkLocalContent(canonicalJson(modelEvidenceExcerpt(excerpt)), question.id);
        } catch {
          await store.persistSecurity({
            runId,
            questionId: question.id,
            policyVersion: policy.version,
            boundary: 'evidence',
            gate: 'SEC-002',
            status: 'blocked',
            reason: 'REGEX_BLOCKED',
            retryEligible: false,
          });
          throw new ProcessingFailure('SECURITY_BLOCKED');
        }
        delivered.set(excerpt.id, excerpt);
      }
    }
    const applicability = {
      product: evidence.record.scope.product,
      environment: evidence.record.scope.environment,
      asOf: evidence.record.asOf,
    };
    const answerInput = canonicalJson({
      question: questionInput,
      interpretation,
      required: { domain: interpretation.domain, subparts: interpretation.subparts },
      applicability,
      excerpts: [...delivered.values()].map(modelEvidenceExcerpt),
    });
    await screen(answerInput, 'tool_result');
    for (const excerpt of delivered.values()) {
      try {
        if (
          canonicalJson(modelEvidenceExcerpt(await evidence.read(excerpt.id))) !==
          canonicalJson(modelEvidenceExcerpt(excerpt))
        )
          throw new ProcessingFailure('INVALID_ATTRIBUTION');
      } catch {
        throw new ProcessingFailure('INVALID_ATTRIBUTION');
      }
    }
    if (delivered.size === 0) {
      const result = questionResultSchema.parse({
        questionId: question.id,
        order: question.order,
        draft: unknownDraft(question.id, interpretation.domain),
        interpretation,
        status: 'review_required',
        reasons: [
          ...new Set([
            ...reasons,
            'MISSING_EVIDENCE',
            ...(evidence.record.denied.length ? ['SOURCE_UNAVAILABLE'] : []),
          ]),
        ],
        attempts,
      });
      await store.persistResult(runId, result);
      return result;
    }
    const draftResponse = await generatePhase(
      evidenceAnswerAgent,
      {
        runId,
        questionId: question.id,
        policy,
        store,
        provider: models('draft', question.id),
        phase: 'draft',
        maxTurns: 1,
        onAttempt,
        beforeCall,
        validateOutput: value => {
          const parsed = draftResponseSchema.safeParse(value);
          if (parsed.success) return parsed.data;
          const invariants = [
            ...new Set(
              parsed.error.issues.flatMap(issue => {
                const invariant = draftInvariantSchema.safeParse(
                  issue.code === 'custom' ? issue.params?.invariant : undefined,
                );
                return invariant.success ? [invariant.data] : [];
              }),
            ),
          ];
          throw new OutputValidationFailure(
            'CALLBACK_SCHEMA',
            invariants.length
              ? { schemaInvariants: invariants, schemaIssueCount: parsed.error.issues.length }
              : undefined,
          );
        },
        onFinish: event => {
          nativeTurn = event.turn;
        },
      },
      requestContext,
      answerInput,
      draftResponseSchema,
    );
    beforeCall();
    await screen(canonicalJson(draftResponse), 'draft');
    const draft = draftSchema.parse({
      ...draftResponse,
      citations: draftResponse.citations.map(citation => {
        const excerpt = delivered.get(citation.excerptId);
        if (!excerpt) throw new ProcessingFailure('INVALID_ATTRIBUTION');
        return {
          id: citation.id,
          documentId: excerpt.documentId,
          version: excerpt.version,
          sourceSha256: excerpt.sourceSha256,
          locator: excerpt.locator,
          supportingExcerpt: citation.supportingExcerpt,
        };
      }),
    });
    if (draft.questionId !== question.id || draft.domain !== interpretation.domain)
      throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
    if (draft.value === 'unknown') reasons.push('MISSING_EVIDENCE');
    if (draft.value === 'unknown' && evidence.record.denied.length) reasons.push('SOURCE_UNAVAILABLE');
    for (const citation of draft.citations) {
      const returnedExcerpt = [...delivered.values()].find(
        excerpt =>
          excerpt.documentId === citation.documentId &&
          excerpt.version === citation.version &&
          excerpt.sourceSha256 === citation.sourceSha256 &&
          canonicalJson(excerpt.locator) === canonicalJson(citation.locator) &&
          excerpt.text.includes(citation.supportingExcerpt),
      );
      try {
        if (!returnedExcerpt) throw new ProcessingFailure('INVALID_ATTRIBUTION');
        await validateEvidenceCitation(evidence.record, citation, environment.evidenceRoot, environment.context);
      } catch {
        reasons.push('INVALID_ATTRIBUTION');
      }
      if (returnedExcerpt?.disclosure !== 'shareable') reasons.push('SENSITIVE_DISCLOSURE');
    }
    for (const claim of draft.claims) {
      const claimCitations = draft.citations.filter(citation => claim.citationIds.includes(citation.id));
      if (
        claim.kind !== 'policy' &&
        claimCitations.every(
          citation =>
            evidence.record.documents.find(document => document.id === citation.documentId)?.kind === 'policy',
        )
      )
        reasons.push('UNSUPPORTED_CLAIM');
    }
    if (draft.confidence < policy.confidenceThreshold) reasons.push('LOW_CONFIDENCE');
    if (interpretation.subparts.some(subpart => !draft.coveredSubparts.includes(subpart)))
      reasons.push('PARTIAL_EVIDENCE');
    if (!compatibleResponseSchema(question).safeParse(draft).success) reasons.push('INCOMPATIBLE_RESPONSE');
    // An invalid citation never enters the verifier context as purported support.
    if (draft.value !== 'unknown' && !reasons.includes('INVALID_ATTRIBUTION')) {
      nativeStage = 'verification';
      const verification = await generatePhase(
        supportVerifierAgent,
        {
          runId,
          questionId: question.id,
          policy,
          store,
          provider: models('verification', question.id),
          phase: 'verification',
          maxTurns: 1,
          onAttempt,
          beforeCall,
        },
        requestContext,
        canonicalJson({
          question: questionInput,
          applicability,
          draft: {
            questionId: draftResponse.questionId,
            domain: draftResponse.domain,
            value: draftResponse.value,
            text: draftResponse.text,
            claims: draftResponse.claims,
            citations: draftResponse.citations.map(c => ({ id: c.id, excerptId: c.excerptId })),
          },
          excerpts: [...delivered.values()].map(modelEvidenceExcerpt),
        }),
        verificationSchema,
      );
      if (
        [...verification.supportedClaimIds, ...verification.conflictedClaimIds].some(
          id => !draft.claims.some(claim => claim.id === id),
        )
      )
        throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
      if (draft.claims.some(claim => !verification.supportedClaimIds.includes(claim.id)))
        reasons.push('UNSUPPORTED_CLAIM');
      if (verification.conflictedClaimIds.length) reasons.push('CONFLICTING_EVIDENCE');
      if (verification.unsupportedCommitment) reasons.push('UNSUPPORTED_COMMITMENT');
      if (!verification.applicable) reasons.push('AMBIGUOUS_APPLICABILITY');
      if (!verification.complete) reasons.push('PARTIAL_EVIDENCE');
      if (verification.sensitive) reasons.push('SENSITIVE_DISCLOSURE');
    }
    const result = questionResultSchema.parse({
      questionId: question.id,
      order: question.order,
      draft,
      interpretation,
      status: reasons.length ? 'review_required' : 'draft_eligible',
      reasons: [...new Set(reasons)],
      attempts,
    });
    await store.persistResult(runId, result);
    return result;
  } catch (error) {
    if (isStorageFailure(error) || (error instanceof ProcessingFailure && error.code === 'STORAGE_FAILURE')) {
      store.stopAdmission();
      await store.stop(runId, 'STORAGE_FAILURE');
    }
    const state = await store.status(runId);
    const code =
      state?.run.stopReason ??
      questionFailure ??
      (error instanceof ProcessingFailure
        ? error.code
        : (state?.usage.filter(usage => usage.questionId === question.id && usage.reason).at(-1)?.reason ??
          'INVALID_MODEL_OUTPUT'));
    if (globalFailures.includes(code)) await store.stop(runId, code);
    const recorded = await store.diagnostics(runId);
    const own = recorded.some(d => d.questionId === telemetryId(question.id) && d.origin !== 'sibling_cancelled');
    if (state?.run.stopReason && !own)
      await store.persistDiagnostic(runId, {
        questionId: telemetryId(question.id)!,
        at: new Date().toISOString(),
        phase: nativeStage,
        origin: 'sibling_cancelled',
        category: 'RUN_STOPPED',
        reason: code,
      });
    else if (code === 'INVALID_MODEL_OUTPUT' && !own)
      await store.persistDiagnostic(runId, {
        questionId: telemetryId(question.id)!,
        at: new Date().toISOString(),
        phase: nativeStage,
        origin: 'downstream',
        category: 'NATIVE_STRUCTURED_OUTPUT',
        reason: code,
        turn: nativeTurn,
      });
    const result = { ...reviewResult(question, code, attempts), interpretation };
    await store.persistResult(runId, result);
    return result;
  }
}

function unknownDraft(questionId: string, domain: string): AnswerDraft {
  return draftSchema.parse({
    questionId,
    domain,
    value: 'unknown',
    text: '',
    responseOption: null,
    claims: [],
    citations: [],
    coveredSubparts: [],
    confidence: 0,
    limitations: ['No supporting evidence was returned.'],
  });
}

export async function processQuestion(
  question: CanonicalQuestion,
  environment: QuestionEnvironment,
  interpreted: Interpretation,
): Promise<QuestionResult> {
  const release = environment.store.trackWork();
  try {
    return await processQuestionImpl(question, environment, interpreted);
  } finally {
    release();
  }
}
