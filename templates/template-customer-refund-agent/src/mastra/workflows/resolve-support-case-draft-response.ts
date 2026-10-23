import { createStep } from '@mastra/core/workflows';
import {
  draftResolutionSchema,
  resourceIdForOwner,
  threadIdForCase,
  subscriptionCreditResultSchema,
} from '../domain/support-case';
import { escalationReasonForDraft } from '../domain/resolution-decision';
import { safeEscalationResponse } from '../domain/customer-response';
import { caseStore } from '../lib/case-store';
import { knowledgePublicationStore } from '../lib/knowledge-publications';
import { withTrustedCommerceScope } from '../lib/trusted-run-scope';
import { bindingsForPersistedCase } from '../runtime/provider-bindings';
import { getActiveCaseOrThrow, resolveSupportCaseInputSchema } from './resolve-support-case-context';
import { cancellationAuthority } from './staging-cancellation-authority';

export const draftResponseStep = createStep({
  id: 'draft-response',
  description: 'Runs the response agent to draft a grounded reply and refund recommendation.',
  inputSchema: resolveSupportCaseInputSchema,
  outputSchema: resolveSupportCaseInputSchema,
  execute: async ({ inputData, mastra, requestContext, tracingContext }) => {
    const { supportCase, turn, ownerId } = await getActiveCaseOrThrow(inputData.caseId, inputData.turnId);
    const latestMessage = turn.message!;
    if (!mastra) throw new Error('The resolve workflow must run through a registered Mastra instance.');

    const priorCreditReceiptCandidates = (await caseStore.turns(supportCase.id)).flatMap(entry => {
      const result = subscriptionCreditResultSchema.safeParse(entry.outcome?.subscriptionCreditResult);
      return result.success && (result.data.status === 'executed' || result.data.status === 'skipped')
        ? [
            {
              subscriptionId: result.data.subscriptionId,
              status: result.data.status,
              amount: result.data.amount,
              currency: result.data.currency,
              executedAt: result.data.executedAt,
            },
          ]
        : [];
    });
    const context = {
      subject: supportCase.subject,
      customerMessage: latestMessage.body,
      customerEmail: supportCase.customer.email,
      triage: supportCase.triage,
      policyMatches: supportCase.policyMatches,
      orderLookup: supportCase.orderLookup,
      subscriptionLookup: supportCase.subscriptionLookup,
      refundHistory: supportCase.refundHistory,
      // This is a receipt candidate, never an authority to tell the customer
      // that a credit remains unused. Finalization re-validates the immutable
      // command, approval, and provider receipt before sending any claim.
      priorCreditReceiptCandidates,
    };

    const bindings = bindingsForPersistedCase(supportCase);
    const result = await withTrustedCommerceScope(
      {
        caseId: supportCase.id,
        ownerId,
        tenantId: bindings.commerce.tenantId,
      },
      () =>
        mastra.getAgent('responseAgent').generate(
          [
            {
              role: 'user',
              content: `Draft a resolution for this support case. Here is everything retrieved so far as JSON - use only this data, plus your tools if you need to double check something:\n\n${JSON.stringify(context, null, 2)}`,
            },
          ],
          {
            structuredOutput: { schema: draftResolutionSchema },
            memory: {
              thread: threadIdForCase(supportCase.id, bindings.support.tenantId),
              resource: resourceIdForOwner(ownerId, bindings.support.tenantId),
            },
            requestContext,
            tracingContext,
          },
        ),
    );

    const responseUsage = result.usage;
    const existingUsage = supportCase.agentUsage;
    const parsedDraft = draftResolutionSchema.parse(result.object);
    // A cancellation effect has a deliberately small non-model authority
    // surface. The current, verified customer turn must match this complete
    // command form; mentioning cancellation or a refund elsewhere is never
    // enough to create an external effect.
    const hasNoRefundCancellationAuthority =
      supportCase.triage?.intent === 'cancellation' && cancellationAuthority(supportCase, turn);
    const policyMatches = supportCase.policyMatches ?? [];
    const validCitations = new Set(policyMatches.flatMap(entry => [entry.title, entry.source]));
    const missingEvidence = policyMatches.length === 0;
    const requiresSupportingCitation =
      hasNoRefundCancellationAuthority || parsedDraft.recommendRefund || !parsedDraft.requiresEscalation;
    const invalidCitation =
      (requiresSupportingCitation && parsedDraft.citedSources.length === 0) ||
      parsedDraft.citedSources.some(citation => !validCitations.has(citation));
    // Retrieval is not a decision. Re-read the selected authoritative
    // publication just before committing the draft so expiry, rollback, or a
    // stale/tampered vector result cannot support a customer promise.
    const authoritativeTexts = new Map<string, string>();
    const applicableEvidence = await Promise.all(
      parsedDraft.citedSources.map(async citation => {
        const match = policyMatches.find(entry => entry.title === citation || entry.source === citation);
        if (
          !match?.source ||
          !match.documentHash ||
          !match.generationId ||
          !match.version ||
          !match.effectiveAt ||
          !match.indexedAt ||
          !match.providerKind ||
          !match.providerAccountId ||
          match.providerKind !== bindings.knowledge.providerKind ||
          match.providerAccountId !== bindings.knowledge.providerAccountId
        )
          return false;
        try {
          if ((await knowledgePublicationStore.activeGeneration(bindings.knowledge)) !== match.generationId)
            return false;
          const authoritative = await knowledgePublicationStore.document(
            bindings.knowledge,
            match.generationId,
            match.source,
            match.documentHash,
          );
          const now = Date.now();
          const valid = Boolean(
            authoritative &&
            authoritative.title === match.title &&
            authoritative.version === match.version &&
            authoritative.effectiveAt === match.effectiveAt &&
            authoritative.indexedAt === match.indexedAt &&
            authoritative.expiresAt === match.expiresAt &&
            authoritative?.text.includes(match.text) &&
            Date.parse(authoritative.effectiveAt) <= now &&
            (!authoritative.expiresAt || Date.parse(authoritative.expiresAt) > now),
          );
          if (valid && authoritative) authoritativeTexts.set(match.source, authoritative.text);
          return valid;
        } catch {
          return false;
        }
      }),
    );
    const staleOrUnauthoritativeEvidence = requiresSupportingCitation && !applicableEvidence.every(Boolean);
    const invalidPolicySelection =
      !hasNoRefundCancellationAuthority &&
      !parsedDraft.requiresEscalation &&
      (parsedDraft.selectedPolicyExcerpts.length === 0 ||
        parsedDraft.selectedPolicyExcerpts.some(selection => {
          const match = policyMatches.find(
            entry =>
              (entry.source === selection.source || entry.title === selection.source) &&
              parsedDraft.citedSources.some(citation => citation === entry.source || citation === entry.title),
          );
          return !match || !authoritativeTexts.get(match.source)?.includes(selection.excerpt);
        }));
    const activeSubscription = supportCase.subscriptionLookup?.subscription;
    const priorCreditForSubscription = priorCreditReceiptCandidates.some(
      result => result.subscriptionId === activeSubscription?.subscriptionId,
    );
    const asksForNewFinancialAction =
      /\b(refund|new credit|another credit|additional credit|more credit|issue (?:a )?credit)\b/i.test(
        latestMessage.body,
      );
    const hasCreditPolicyCitation = parsedDraft.citedSources.some(citation =>
      policyMatches.some(
        match =>
          (match.source === citation || match.title === citation) &&
          /credit/i.test(`${match.title} ${match.text}`) &&
          Boolean(authoritativeTexts.get(match.source)),
      ),
    );
    const qualifyingInformationalCredit =
      supportCase.triage?.intent === 'account_issue' &&
      supportCase.triage.accountIssueSubtype === 'informational_credit_status' &&
      !supportCase.triage.requiresHumanReview &&
      supportCase.triage.confidence >= 0.8 &&
      activeSubscription?.status === 'active' &&
      priorCreditForSubscription &&
      !asksForNewFinancialAction &&
      !parsedDraft.requiresEscalation &&
      !parsedDraft.recommendRefund &&
      parsedDraft.resolutionAction === 'none' &&
      parsedDraft.subscriptionCreditAmount === undefined &&
      !missingEvidence &&
      !invalidCitation &&
      !invalidPolicySelection &&
      !staleOrUnauthoritativeEvidence &&
      hasCreditPolicyCitation;
    // A model cannot turn absent, stale, or conflicting evidence into an
    // executable promise. Preserve its text as internal evidence, but force the
    // durable case down the escalation path and suppress a refund proposal.
    // An escalation is deliberately a handoff, not a license to deliver
    // arbitrary model prose. Keep the model's proposed text only in staff
    // metadata: even a non-refund draft can falsely assert that a refund was
    // issued or rely on evidence that expired while it was being generated.
    const writerRequiresEscalation = !hasNoRefundCancellationAuthority && parsedDraft.requiresEscalation;
    const escalationReason =
      escalationReasonForDraft({
        triage: supportCase.triage,
        missingEvidence,
        invalidCitation: invalidCitation || invalidPolicySelection,
        staleEvidence: staleOrUnauthoritativeEvidence,
        writerRequiresEscalation,
        writerReason: parsedDraft.escalationReason,
      }) ??
      (supportCase.triage?.intent === 'account_issue' && !qualifyingInformationalCredit
        ? 'Account requests require a support specialist with verified account-service access.'
        : undefined);
    const mustUseSafeEscalation = escalationReason !== undefined;
    const evidenceSafeDraft = mustUseSafeEscalation
      ? {
          ...parsedDraft,
          draftResponse: safeEscalationResponse,
          recommendRefund: false,
          refundAmount: undefined,
          refundCurrency: undefined,
          refundReason: undefined,
          requiresEscalation: true,
          escalationReason,
        }
      : parsedDraft;
    // A qualifying no-refund cancellation is authorized by the immutable
    // customer turn, never by a draft recommendation. Remove every refund
    // field before the later cancellation and native-approval steps run, so a
    // conflicting model response cannot persist a refund command or suspend
    // the agent lifecycle.
    const safeDraft = qualifyingInformationalCredit
      ? {
          ...evidenceSafeDraft,
          draftResponse:
            'An earlier credit receipt is present. Finalization will verify durable evidence before it sends the customer response.',
          recommendRefund: false,
          refundAmount: undefined,
          refundCurrency: undefined,
          refundReason: undefined,
          resolutionAction: 'none' as const,
          subscriptionCreditAmount: undefined,
          subscriptionCreditCurrency: undefined,
          subscriptionCreditReason: undefined,
          requiresEscalation: false,
          escalationReason: undefined,
        }
      : hasNoRefundCancellationAuthority
        ? {
            ...evidenceSafeDraft,
            recommendRefund: false,
            refundAmount: undefined,
            refundCurrency: undefined,
            refundReason: undefined,
          }
        : evidenceSafeDraft;
    await caseStore.update(supportCase.id, {
      draft: safeDraft,
      metadata: mustUseSafeEscalation
        ? {
            ...supportCase.metadata,
            rejectedDraftForStaff: {
              draftResponse: parsedDraft.draftResponse,
              citedSources: parsedDraft.citedSources,
              reason: safeDraft.escalationReason,
            },
          }
        : supportCase.metadata,
      agentUsage: {
        inputTokens: (existingUsage?.inputTokens ?? 0) + (responseUsage.inputTokens ?? 0),
        outputTokens: (existingUsage?.outputTokens ?? 0) + (responseUsage.outputTokens ?? 0),
        model: (result as { response?: { modelId?: string } }).response?.modelId ?? existingUsage?.model,
      },
    });
    return { caseId: supportCase.id, turnId: inputData.turnId };
  },
});
