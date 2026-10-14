import { checkCancellation } from '../runtime/cancellation.ts';
import { processingElapsedMs } from '../processing/clock.ts';
import { renderedValues } from '../completion/document.ts';
import { prepareCompletion } from '../persistence/completion.ts';
import { generatePhase } from '../agents/runtime.ts';
import { userInfo } from 'node:os';
import { verificationSchema, compatibleResponseSchema } from '../contracts/answer.ts';
import type { AnswerDraft, QuestionResult } from '../contracts/answer.ts';
import { projectionSchema } from '../contracts/review.ts';
import type { ReviewDecision, Projection } from '../contracts/review.ts';
import type { EvidenceSnapshotRecord } from '../evidence/snapshot.ts';
import { validateEvidenceCitation } from '../evidence/snapshot.ts';
import { openProcessingStore } from '../persistence/processing.ts';
import type { ProcessingStore } from '../persistence/processing.ts';
import { openReviewStore } from '../persistence/review.ts';
import { canonicalJson, IntakeFailure } from '../intake/source.ts';
import { checkLocalContent } from '../processing/local-filter.ts';
import { createScreening } from '../processing/security.ts';
import { createProvider } from '../processing/model.ts';
import type { ModelFactory } from '../processing/model.ts';
import { supportVerifierAgent } from '../agents/support-verifier.ts';
import { trustedQuestionContext, questionPayload } from '../processing/answers.ts';
import {
  sourceContext,
  publicLocator,
  revalidateEvidence,
  containsRestricted,
  projectionTextValues,
  validateProjectionText,
} from './validation.ts';

export interface ReviewOptions {
  databaseUrl: string;
  evidenceRoot: string;
  manifestPath: string;
  models?: ModelFactory;
}
const trustedReasons = new Set([
  'Supported by approved evidence.',
  'No releasable supported answer is available.',
  'Evidence is withheld.',
]);
// Corrections and custom gap reasons share the same reviewer screening and verifier.
async function verifyReviewedText(
  draft: AnswerDraft | undefined,
  result: QuestionResult,
  store: ProcessingStore,
  options: ReviewOptions,
  evidence: EvidenceSnapshotRecord,
  externalReason: string,
) {
  const status = (await store.status(evidence.runId))!;
  let payload: unknown;
  if (draft) {
    const intake = (await store.readIntake(evidence.runId))!;
    const question = intake.input.questions.find(q => q.id === result.questionId)!;
    if (!result.interpretation || draft.domain !== result.interpretation.domain)
      throw new Error('UNSUPPORTED_CORRECTION');
    if (
      draft.confidence < status.run.policy.confidenceThreshold ||
      result.interpretation.subparts.some(part => !draft.coveredSubparts.includes(part)) ||
      draft.claims.some(
        claim =>
          claim.kind !== 'policy' &&
          draft.citations
            .filter(c => claim.citationIds.includes(c.id))
            .every(c => evidence.documents.find(d => d.id === c.documentId)?.kind === 'policy'),
      )
    )
      throw new Error('UNSUPPORTED_CORRECTION');
    if (!compatibleResponseSchema(question).safeParse(draft).success) throw new Error('INCOMPATIBLE_RESPONSE');
    payload = {
      question: questionPayload(question),
      interpretation: result.interpretation,
      draft: {
        ...draft,
        // Citation hashes are verified against the source before this call. Keep
        // them out of content screening, where digit sequences can look like PII.
        citations: draft.citations.map(({ sourceSha256: _sourceHash, locator, ...citation }) => {
          const { sourceSha256: _locatorHash, ...coordinates } = locator;
          return { ...citation, locator: coordinates };
        }),
      },
      externalReason,
      excerpts: draft.citations.map(c => ({
        text: c.supportingExcerpt,
        documentId: c.documentId,
        kind: evidence.documents.find(d => d.id === c.documentId)!.kind,
      })),
    };
  } else {
    payload = {
      questionId: result.questionId,
      draft: { value: 'unknown', text: '', claims: [], citations: [] },
      externalReason,
      excerpts: [],
      instruction:
        'The external gap reason must contain no unsupported organizational control, certification, commitment or protected detail. It may describe only missing or withheld support.',
    };
  }
  const models = options.models ?? (() => createProvider(status.run.policy));
  const context = trustedQuestionContext(result.questionId, {
    runId: evidence.runId,
    policy: status.run.policy,
    evidence: { record: evidence },
  });
  await createScreening({
    runId: evidence.runId,
    questionId: result.questionId,
    policy: status.run.policy,
    store,
    models,
    requestContext: context,
  })(canonicalJson(payload), 'reviewer');
  const verification = await generatePhase(
    supportVerifierAgent,
    {
      runId: evidence.runId,
      questionId: result.questionId,
      policy: status.run.policy,
      store,
      provider: models('verification', result.questionId),
      phase: 'verification',
      maxTurns: 1,
    },
    context,
    canonicalJson(payload),
    verificationSchema,
  );
  const claims = draft?.claims ?? [];
  if (
    verification.conflictedClaimIds.length ||
    verification.unsupportedCommitment ||
    !verification.applicable ||
    !verification.complete ||
    verification.sensitive ||
    claims.some(c => !verification.supportedClaimIds.includes(c.id)) ||
    verification.supportedClaimIds.some(id => !claims.some(c => c.id === id))
  )
    throw new Error(draft ? 'UNSUPPORTED_CORRECTION' : 'UNSUPPORTED_GAP_REASON');
}
export async function submitReview(raw: ReviewDecision, options: ReviewOptions) {
  const review = await openReviewStore(options.databaseUrl);
  let store: ProcessingStore | undefined;
  let token: string | undefined;
  try {
    const completionPlan = await prepareCompletion(options.databaseUrl, raw.runId);
    const claim = await review.claimDecision(raw);
    if ('replay' in claim) return claim.replay;
    token = claim.token;
    store = await openProcessingStore(options.databaseUrl, { token, revision: raw.expectedRevision });
    let bound: Awaited<ReturnType<typeof revalidateEvidence>>;
    try {
      bound = await revalidateEvidence(store, raw.runId, options);
    } catch {
      await review.failDecision(raw.runId, token, true);
      token = undefined;
      throw new Error('SOURCE_DRIFT');
    }
    const { evidence, status } = bound,
      intake = (await store.readIntake(raw.runId))!;
    if (
      status.results.length !== intake.input.questions.length ||
      raw.dispositions.length !== status.results.length ||
      raw.dispositions.some(d => !status.results.some(r => r.questionId === d.questionId))
    )
      throw new Error('INCOMPLETE_REVIEW');
    // An exhausted run can publish only a deterministic, assertion-free gap set.
    // Original question/source labels are untrusted text, so none enter this projection.
    const minimumReservationUsd =
      (status.run.policy.maxInputTokens * status.run.policy.rates.inputUsdPerMillion +
        status.run.policy.maxOutputTokens * status.run.policy.rates.outputUsdPerMillion) /
      1e6;
    const exhaustion =
      status.run.stopReason === 'BUDGET_EXHAUSTED' || status.run.stopReason === 'TIME_LIMIT'
        ? status.run.stopReason
        : !status.run.stopReason && processingElapsedMs(status.run) >= status.run.policy.maxRunElapsedMs
          ? 'TIME_LIMIT'
          : !status.run.stopReason &&
              (status.usage.length >= status.run.policy.maxPhysicalCalls ||
                status.usage.reduce((sum, u) => sum + u.estimatedUsd, 0) + minimumReservationUsd >
                  status.run.policy.budgetUsd)
            ? 'BUDGET_EXHAUSTED'
            : null;
    if (exhaustion) {
      if (
        raw.dispositions.some(
          d =>
            d.disposition === 'release' ||
            d.correction ||
            d.releaseDocumentIds.length ||
            d.safeReason !==
              (d.disposition === 'unknown' ? 'No releasable supported answer is available.' : 'Evidence is withheld.'),
        )
      )
        throw new Error('EXHAUSTED_REVIEW_REQUIRES_TRUSTED_GAPS');
      if (!status.run.stopReason) await store.stop(raw.runId, exhaustion);
    }
    const answers: Projection['answers'] = [],
      releasable: Projection['evidence'] = [];
    for (const result of status.results) {
      const d = raw.dispositions.find(d => d.questionId === result.questionId)!;
      const question = intake.input.questions.find(q => q.id === result.questionId)!;
      await checkLocalContent(d.safeReason, result.questionId);
      if (containsRestricted(d.safeReason, evidence)) throw new Error('RESTRICTED_DISCLOSURE');
      let label = exhaustion
        ? `Question ${question.order + 1}: original text withheld because validation resources are exhausted.`
        : question.originalText;
      try {
        await checkLocalContent(label, result.questionId);
        if (containsRestricted(label, evidence) || (!exhaustion && result.status === 'security_review_required'))
          label = 'Question withheld for safety review.';
      } catch {
        label = 'Question withheld for safety review.';
      }
      if (d.disposition !== 'release') {
        if (!claim.reuseValidated && !trustedReasons.has(d.safeReason))
          await verifyReviewedText(undefined, result, store, options, evidence, d.safeReason);
        answers.push({
          questionId: question.id,
          order: question.order,
          question: label,
          disposition: d.disposition,
          value: d.disposition,
          text: '',
          responseOption: null,
          limitations: [],
          safeReason: d.safeReason,
          citationIds: [],
        });
        continue;
      }
      if (result.status === 'security_review_required') throw new Error('SECURITY_APPROVAL_FORBIDDEN');
      const draft = d.correction ?? result.draft;
      if (
        !draft ||
        draft.value === 'unknown' ||
        (!d.correction && result.status !== 'draft_eligible' && result.reasons.some(r => r !== 'SENSITIVE_DISCLOSURE'))
      )
        throw new Error('UNSUPPORTED_REVIEW');
      for (const c of draft.citations) {
        try {
          await validateEvidenceCitation(evidence, c, options.evidenceRoot, sourceContext());
        } catch (error) {
          // At this boundary, an invalid mapping refers to a citation, not the questionnaire fields.
          if (error instanceof IntakeFailure && error.code === 'INVALID_MAPPING')
            throw new Error('INVALID_ATTRIBUTION');
          throw error;
        }
        const doc = evidence.documents.find(doc => doc.id === c.documentId)!;
        if (
          doc.disclosure === 'restricted' ||
          (doc.disclosure === 'review_required' && !d.releaseDocumentIds.includes(doc.id))
        )
          throw new Error('FORBIDDEN_DISCLOSURE');
        releasable.push({
          id: `${question.id}:${c.id}`,
          documentId: doc.id,
          label: doc.citationLabel,
          version: doc.version,
          sourceSha256: doc.sha256,
          locator: publicLocator(c.locator),
          supportingExcerpt: c.supportingExcerpt,
        });
      }
      if (
        d.releaseDocumentIds.some(
          id =>
            !draft.citations.some(
              c =>
                c.documentId === id && evidence.documents.find(doc => doc.id === id)?.disclosure === 'review_required',
            ),
        )
      )
        throw new Error('FOREIGN_RELEASE');
      if (
        !claim.reuseValidated &&
        ((d.correction && canonicalJson(draft) !== canonicalJson(result.draft)) || !trustedReasons.has(d.safeReason))
      )
        await verifyReviewedText(draft, result, store, options, evidence, d.safeReason);
      answers.push({
        questionId: question.id,
        order: question.order,
        question: label,
        disposition: 'release',
        value: draft.value,
        text: draft.text,
        responseOption: draft.responseOption,
        limitations: draft.limitations,
        safeReason: d.safeReason,
        citationIds: draft.citations.map(c => `${question.id}:${c.id}`),
      });
    }
    const supported = answers.filter(a => a.disposition === 'release').length;
    const projection = projectionSchema.parse({
      schemaVersion: 1,
      runId: raw.runId,
      organizationId: raw.organizationId,
      revision: raw.expectedRevision + 1,
      approvalId: raw.decisionId,
      evidenceDigest: evidence.digest,
      policyDigest: status.run.policyDigest,
      quality: supported === answers.length ? 'complete' : 'delivered_with_gaps',
      total: answers.length,
      supported,
      answers,
      evidence: releasable,
    });
    renderedValues(completionPlan, projection);
    await validateProjectionText(projection, evidence);
    // Newly introduced public labels/reasons are screened through the native detector boundary too.
    // The exhausted branch admits only static gap prose and locally checked, schema-bound identifiers.
    const previous = claim.state.projection;
    const changed =
      raw.dispositions.some(d => d.correction) ||
      !previous ||
      canonicalJson(previous.answers.map(a => a.safeReason)) !== canonicalJson(answers.map(a => a.safeReason));
    if (changed && !exhaustion && !claim.reuseValidated) {
      const models = options.models ?? (() => createProvider(status.run.policy));
      const screen = createScreening({
        runId: raw.runId,
        questionId: 'final-set',
        policy: status.run.policy,
        store,
        models,
      });
      const values = projectionTextValues(projection);
      let chunk = '';
      for (const value of values) {
        if (chunk.length + value.length > 5000) {
          await screen(chunk, 'export');
          chunk = '';
        }
        chunk += value + '\n';
      }
      if (chunk) await screen(chunk, 'export');
    }
    await revalidateEvidence(store, raw.runId, options);
    checkCancellation(raw.runId);
    return await review.finishDecision(raw, token, projection, claim.payloadHash, userInfo().username);
  } catch (error) {
    if (token) await review.failDecision(raw.runId, token);
    throw error;
  } finally {
    review.close();
    store?.close();
  }
}
