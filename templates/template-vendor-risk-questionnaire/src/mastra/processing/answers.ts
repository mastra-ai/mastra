import { RequestContext } from '@mastra/core/request-context';

import { bindEvidenceAnswerAgent } from '../agents/evidence-answer.ts';
import { bindSupportVerifierAgent } from '../agents/support-verifier.ts';
import { createQuestionEvidenceTools, modelEvidenceExcerpt } from '../tools/question-evidence.ts';
import type { CanonicalQuestion } from '../contracts/question.ts';
import { draftSchema, draftResponseSchema, questionResultSchema, verificationSchema } from '../contracts/answer.ts';
import type { QuestionResult, Reason, AnswerDraft, Interpretation } from '../contracts/answer.ts';
import type { ExecutionPolicy } from '../contracts/execution-policy.ts';
import type { ProcessingStore } from '../persistence/processing.ts';
import { canonicalJson } from '../intake/source.ts';
import { validateEvidenceCitation } from '../evidence/snapshot.ts';
import type { buildEvidenceSnapshot, EvidenceExcerpt } from '../evidence/snapshot.ts';
import type { InputAdapterContext } from '../intake/source.ts';
import { providerOptions } from './model.ts';
import type { ModelFactory } from './model.ts';
import { createScreening } from './security.ts';
import { checkLocalContent } from './local-filter.ts';
import { ProcessingFailure, globalFailures } from './failure.ts';

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
  environment: Pick<QuestionEnvironment, 'runId' | 'policy' | 'evidence'>,
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

export async function processQuestion(
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

  async function validateGeneratedToolInput(input: string) {
    try {
      await checkLocalContent(input, question.id);
    } catch {
      questionFailure = 'SECURITY_BLOCKED';
      await store.persistSecurity({
        runId,
        questionId: question.id,
        policyVersion: policy.version,
        boundary: 'tool_result',
        gate: 'SEC-002',
        status: 'blocked',
        reason: 'REGEX_BLOCKED',
        retryEligible: false,
      });
      throw new ProcessingFailure('SECURITY_BLOCKED');
    }
  }

  const interpretation = interpreted;
  try {
    const existing = await store.status(runId);
    if (existing?.run.stopReason) throw new ProcessingFailure(existing.run.stopReason);
    const questionInput = questionPayload(question);
    const reasons: Reason[] = [];
    if (
      !evidence.record.scope.domains.includes(interpretation.domain) ||
      interpretation.product !== evidence.record.scope.product ||
      interpretation.environment !== evidence.record.scope.environment
    )
      reasons.push('AMBIGUOUS_APPLICABILITY');
    const delivered = new Map<string, EvidenceExcerpt>();
    const tools = createQuestionEvidenceTools({ evidence, delivered, screen });

    // Query planning is screened too: generated tool arguments cannot introduce unscreened content.
    await screen(canonicalJson(interpretation), 'tool_result');
    const answerer = bindEvidenceAnswerAgent(
      {
        runId,
        questionId: question.id,
        policy,
        store,
        provider: models('draft', question.id),
        phase: 'draft',
        maxTurns: policy.draftTurns,
        onAttempt,
        beforeCall,
        validateOutput: value => draftResponseSchema.parse(value),
        validateToolInput: validateGeneratedToolInput,
      },
      requestContext,
      tools,
    );
    const response = await answerer.generate(canonicalJson({ question: questionInput, interpretation }), {
      requestContext,
      structuredOutput: { schema: draftResponseSchema, errorStrategy: 'strict' },
      maxSteps: policy.draftTurns,
      modelSettings: { maxRetries: 0 },
      providerOptions,
    });
    beforeCall();
    const draftResponse = draftResponseSchema.parse(response.object);
    await screen(canonicalJson(draftResponse), 'draft');
    const draft =
      delivered.size === 0
        ? unknownDraft(question.id, interpretation.domain)
        : draftSchema.parse({
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
    if (draft.value === 'unknown' || delivered.size === 0) reasons.push('MISSING_EVIDENCE');
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
    if (question.answerConstraints.maxChars && draft.text.length > question.answerConstraints.maxChars)
      reasons.push('INCOMPATIBLE_RESPONSE');
    if (draft.value !== 'unknown') {
      const allowedAliases =
        draft.value === 'not_applicable'
          ? ['not_applicable', 'n/a', 'na']
          : draft.value === 'yes'
            ? ['yes', 'true', '1']
            : draft.value === 'no'
              ? ['no', 'false', '0']
              : [draft.value];
      if (
        question.answerType === 'free_text'
          ? draft.responseOption !== null
          : !question.answerConstraints.options?.some(
              option =>
                option.value === draft.responseOption &&
                (question.answerType === 'single_choice' || allowedAliases.includes(option.value.toLowerCase())),
            )
      )
        reasons.push('INCOMPATIBLE_RESPONSE');
    }
    // An invalid citation never enters the verifier context as purported support.
    if (draft.value !== 'unknown' && !reasons.includes('INVALID_ATTRIBUTION')) {
      const verifier = bindSupportVerifierAgent(
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
          validateOutput: value => verificationSchema.parse(value),
        },
        requestContext,
      );
      const supportResponse = await verifier.generate(
        canonicalJson({
          question: questionInput,
          interpretation,
          draft: draftResponse,
          excerpts: [...delivered.values()].map(modelEvidenceExcerpt),
        }),
        {
          requestContext,
          structuredOutput: { schema: verificationSchema, errorStrategy: 'strict' },
          maxSteps: 1,
          modelSettings: { maxRetries: 0 },
          providerOptions,
        },
      );
      const verification = verificationSchema.parse(supportResponse.object);
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
    const state = await store.status(runId);
    const code =
      state?.run.stopReason ??
      questionFailure ??
      (error instanceof ProcessingFailure
        ? error.code
        : (state?.usage.filter(usage => usage.questionId === question.id && usage.reason).at(-1)?.reason ??
          'INVALID_MODEL_OUTPUT'));
    if (globalFailures.includes(code)) await store.stop(runId, code);
    const result = { ...reviewResult(question, code, attempts), interpretation };
    await store.persistResult(runId, result);
    return result;
  }
}

export function unknownDraft(questionId: string, domain: string): AnswerDraft {
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
    limitations: ['No supporting evidence was returnedExcerpt.'],
  });
}
