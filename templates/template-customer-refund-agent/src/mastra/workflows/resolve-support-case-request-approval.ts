import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { type SupportCase } from "../domain/support-case";
import { persistedRefundCommandSchema } from "../domain/refund-command";
import { persistedSubscriptionCreditCommandSchema } from "../domain/subscription-credit-command";
import { STANDARD_REFUND_REVIEW_LIMIT } from "../domain/refund-review-limit";
import { caseStore } from "../lib/case-store";
import {
  legacyAmountToMoney,
  refundFingerprint,
  subscriptionCreditFingerprint,
} from "../lib/money";
import { traceOperationalPort } from "../lib/operational-spans";
import {
  ensureProviderFixtures,
  providerRegistry,
  resolveConfiguredBinding,
} from "../providers/registry";
import { bindingsForPersistedCase } from "../runtime/provider-bindings";
import { refundExecutionInputSchema } from "../tools/issue-refund";
import { subscriptionCreditExecutionInputSchema } from "../tools/issue-subscription-credit";
import {
  getActiveCaseOrThrow,
  resolveSupportCaseInputSchema,
} from "./resolve-support-case-context";

/** Serialize only the authoritative identities already selected by the
 * grounded draft. This durable action is later read by the provider write
 * transaction; it intentionally does not consult a newer case draft. */
function parsedDraftEvidence(supportCase: SupportCase, citations: string[]) {
  return citations.map((citation) => {
    const match = (supportCase.policyMatches ?? []).find(
      (entry) => entry.title === citation || entry.source === citation,
    );
    if (
      !match?.source ||
      !match.title ||
      !match.documentHash ||
      !match.generationId ||
      !match.version ||
      !match.effectiveAt ||
      !match.indexedAt ||
      !match.providerKind ||
      !match.providerAccountId
    )
      throw new Error(
        "Refund approval requires complete authoritative policy evidence.",
      );
    return {
      title: match.title,
      source: match.source,
      documentHash: match.documentHash,
      generationId: match.generationId,
      version: match.version,
      effectiveAt: match.effectiveAt,
      indexedAt: match.indexedAt,
      expiresAt: match.expiresAt,
      providerKind: match.providerKind,
      providerAccountId: match.providerAccountId,
    };
  });
}

const approvalOutputSchema = z.object({
  caseId: z.string(),
  turnId: z.string(),
  approved: z.boolean(),
  approverId: z.string().optional(),
  note: z.string().optional(),
});

/** A running snapshot can be restarted after the API accepted a decision but
 * before Mastra persisted the downstream step. The restarted checkpoint has
 * no resumeData, so recover only an already durable decision. Approval is
 * tied to the immutable action row, never just mutable case metadata. */
async function recoveredApprovalDecision(
  supportCase: SupportCase,
  turnId: string,
) {
  const decision = supportCase.approval;
  if (!decision) return undefined;
  if (!decision.approverId)
    throw new Error("The persisted approval decision is missing its approver.");
  if (decision.approved) {
    const credit = persistedSubscriptionCreditCommandSchema.safeParse(
      supportCase.metadata.subscriptionCreditCommand,
    );
    if (credit.success) {
      const binding = resolveConfiguredBinding(
        bindingsForPersistedCase(supportCase).transactions,
      );
      const amount = legacyAmountToMoney(
        credit.data.amount,
        credit.data.currency,
      );
      const fingerprint = subscriptionCreditFingerprint({
        binding,
        approvalCaseId: supportCase.id,
        customerId: credit.data.customerId,
        subscriptionId: credit.data.subscriptionId,
        amount,
        reason: credit.data.reason,
        idempotencyKey: credit.data.idempotencyKey,
      });
      if (fingerprint !== credit.data.fingerprint)
        throw new Error(
          "The persisted subscription credit command fingerprint is invalid.",
        );
      const action = await caseStore.getAction(
        supportCase.id,
        "subscription-credit-command",
        fingerprint,
      );
      if (!action)
        throw new Error(
          "The persisted subscription credit command is missing its immutable action.",
        );
      return {
        caseId: supportCase.id,
        turnId,
        approved: decision.approved,
        approverId: decision.approverId,
        note: decision.note,
      };
    }
    const stored = persistedRefundCommandSchema.safeParse(
      supportCase.metadata.refundCommand,
    );
    if (!stored.success)
      throw new Error("The persisted refund command is missing.");
    const command = stored.data;
    const binding = resolveConfiguredBinding(
      bindingsForPersistedCase(supportCase).transactions,
    );
    const immutable = {
      binding,
      approvalCaseId: supportCase.id,
      orderId: command.orderId,
      amount: legacyAmountToMoney(command.amount, command.currency),
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
    };
    const fingerprint = refundFingerprint(immutable);
    if (
      command.approvalCaseId !== supportCase.id ||
      command.fingerprint !== fingerprint
    )
      throw new Error("The persisted refund command fingerprint is invalid.");
    const action = await caseStore.getAction(
      supportCase.id,
      "refund-command",
      fingerprint,
    );
    if (
      !action ||
      JSON.stringify(action) !== JSON.stringify({ ...immutable, fingerprint })
    )
      throw new Error(
        "The persisted approved refund command does not match its immutable action.",
      );
  }
  return {
    caseId: supportCase.id,
    turnId,
    approved: decision.approved,
    approverId: decision.approverId,
    note: decision.note,
  };
}

export const requestApprovalStep = createStep({
  id: "request-approval",
  description:
    "Suspends the workflow for human approval when the drafted resolution recommends a refund.",
  inputSchema: resolveSupportCaseInputSchema,
  resumeSchema: z.object({
    approved: z.boolean(),
    approverId: z.string(),
    note: z.string().optional(),
  }),
  suspendSchema: z.object({
    caseId: z.string(),
    action: z.enum(["refund", "subscription_credit"]),
    refundAmount: z.number(),
    refundCurrency: z.string(),
    refundReason: z.string(),
    orderId: z.string(),
    draftResponse: z.string(),
  }),
  outputSchema: approvalOutputSchema,
  execute: async ({
    inputData,
    resumeData,
    suspend,
    mastra,
    requestContext,
    tracingContext,
  }) => {
    const { supportCase } = await getActiveCaseOrThrow(
      inputData.caseId,
      inputData.turnId,
    );
    const bindings = bindingsForPersistedCase(supportCase);
    const draft = supportCase.draft;

    const isCredit = draft?.resolutionAction === "subscription_credit";
    if (!draft?.recommendRefund && !isCredit) {
      return {
        caseId: supportCase.id,
        turnId: inputData.turnId,
        approved: false,
      };
    }

    // Do not create an executable native command for a recommendation which
    // local policy already requires a human escalation to handle. The same
    // rule is repeated by LocalRuntime in its provider write transaction.
    if (
      draft.requiresEscalation ||
      (!isCredit && (draft.refundAmount ?? 0) > STANDARD_REFUND_REVIEW_LIMIT)
    ) {
      if (!draft.requiresEscalation)
        await caseStore.update(supportCase.id, {
          draft: {
            ...draft,
            requiresEscalation: true,
            escalationReason: `Refund amount ${draft.refundAmount} exceeds the ${STANDARD_REFUND_REVIEW_LIMIT} standard review limit and needs manual handling.`,
          },
        });
      return {
        caseId: supportCase.id,
        turnId: inputData.turnId,
        approved: false,
      };
    }

    if (!resumeData) {
      const recovered = await recoveredApprovalDecision(
        supportCase,
        inputData.turnId,
      );
      if (recovered) return recovered;
      if (isCredit) {
        const subscription = supportCase.subscriptionLookup?.subscription;
        const amount = draft.subscriptionCreditAmount ?? 0;
        const currency = draft.subscriptionCreditCurrency ?? "USD";
        const binding = resolveConfiguredBinding(bindings.transactions);
        const customerId = subscription?.customerId;
        if (
          !subscription ||
          !customerId ||
          subscription.status !== "active" ||
          subscription.cancelAtPeriodEnd ||
          subscription.recurringInterval !== "month" ||
          subscription.recurringIntervalCount !== 1 ||
          subscription.quantity !== 1 ||
          subscription.currency !== currency ||
          subscription.amount !== amount
        )
          throw new Error(
            "Subscription credit requires one verified active monthly subscription and its exact monthly amount.",
          );
        const turnId = inputData.turnId;
        const immutableCommand = {
          binding,
          approvalCaseId: supportCase.id,
          customerId,
          subscriptionId: subscription.subscriptionId,
          amount: legacyAmountToMoney(amount, currency),
          reason:
            draft.subscriptionCreditReason ??
            "Approved service-problem subscription credit",
          idempotencyKey: `${supportCase.id}:${turnId}:subscription-credit`,
        };
        const fingerprint = subscriptionCreditFingerprint(immutableCommand);
        const command = {
          approvalCaseId: supportCase.id,
          customerId,
          subscriptionId: subscription.subscriptionId,
          amount,
          currency,
          reason: immutableCommand.reason,
          idempotencyKey: immutableCommand.idempotencyKey,
          fingerprint,
        };
        await ensureProviderFixtures(binding);
        const approvedCommand = { ...immutableCommand, fingerprint };
        await traceOperationalPort({
          mastra,
          tracingContext,
          kind: "provider",
          operation: "transactions.quote_subscription_credit",
          run: () =>
            providerRegistry(binding)
              .transactions(binding)
              .quoteSubscriptionCredit(approvedCommand),
        });
        await caseStore.saveAction(
          supportCase.id,
          "subscription-credit-command",
          fingerprint,
          approvedCommand,
        );
        await caseStore.saveAction(
          supportCase.id,
          "refund-policy-evidence",
          fingerprint,
          {
            turnId,
            binding: {
              tenantId: bindings.knowledge.tenantId,
              providerKind: bindings.knowledge.providerKind,
              providerAccountId: bindings.knowledge.providerAccountId,
            },
            citations: parsedDraftEvidence(supportCase, draft.citedSources),
          },
        );
        await caseStore.bindTurnCommand(supportCase.id, turnId, fingerprint);
        if (!mastra)
          throw new Error(
            "Native subscription credit approval requires the registered Mastra instance.",
          );
        const native = await mastra
          .getAgent("refundExecutionAgent")
          .generate(
            `Call issue_subscription_credit once with exactly this immutable command JSON: ${JSON.stringify({ caseId: supportCase.id, customerId, subscriptionId: subscription.subscriptionId, amount, currency, reason: command.reason, idempotencyKey: command.idempotencyKey, fingerprint })}`,
            { requestContext, tracingContext },
          );
        const suspended = native as {
          finishReason?: string;
          runId?: string;
          suspendPayload?: {
            toolCallId?: string;
            toolName?: string;
            args?: unknown;
          };
        };
        const nativeArgs = subscriptionCreditExecutionInputSchema.safeParse(
          suspended.suspendPayload?.args,
        );
        if (
          suspended.finishReason !== "suspended" ||
          !suspended.runId ||
          suspended.suspendPayload?.toolName !== "issue_subscription_credit" ||
          !suspended.suspendPayload.toolCallId ||
          !nativeArgs.success ||
          JSON.stringify(nativeArgs.data) !==
            JSON.stringify({
              caseId: supportCase.id,
              customerId,
              subscriptionId: subscription.subscriptionId,
              amount,
              currency,
              reason: command.reason,
              idempotencyKey: command.idempotencyKey,
              fingerprint,
            })
        )
          throw new Error(
            "Native subscription credit agent did not suspend on the immutable tool call.",
          );
        await caseStore.update(supportCase.id, {
          status: "waiting_approval",
          metadata: {
            ...supportCase.metadata,
            subscriptionCreditCommand: command,
            nativeApproval: {
              runId: suspended.runId,
              toolCallId: suspended.suspendPayload.toolCallId,
              fingerprint,
              turnId,
            },
          },
        });
        return suspend({
          caseId: supportCase.id,
          action: "subscription_credit",
          refundAmount: amount,
          refundCurrency: currency,
          refundReason: command.reason,
          orderId: subscription.subscriptionId,
          draftResponse: draft.draftResponse,
        });
      }
      const amount = draft.refundAmount ?? 0;
      const currency = draft.refundCurrency ?? "USD";
      const turnId = inputData.turnId;
      const command = {
        approvalCaseId: supportCase.id,
        orderId:
          supportCase.orderLookup?.order?.orderId ??
          supportCase.subscriptionLookup?.subscription?.refundOrderId ??
          "",
        amount,
        currency,
        reason: draft.refundReason ?? "Approved support refund",
        // A conversation may legitimately issue a later, distinct command.
        // The effect key is therefore stable for this immutable turn only.
        idempotencyKey: `${supportCase.id}:${turnId}`,
        fingerprint: "",
      };
      if (!command.orderId)
        throw new Error(
          "A refund recommendation requires an unambiguous order id.",
        );
      const money = legacyAmountToMoney(amount, currency);
      const binding = resolveConfiguredBinding(bindings.transactions);
      const immutableCommand = {
        binding,
        approvalCaseId: supportCase.id,
        orderId: command.orderId,
        amount: money,
        reason: command.reason,
        idempotencyKey: command.idempotencyKey,
      };
      command.fingerprint = refundFingerprint(immutableCommand);
      await ensureProviderFixtures(binding);
      const approvedCommand = {
        ...immutableCommand,
        fingerprint: command.fingerprint,
      };
      // Tool.execute does not create a Mastra span when this trusted workflow
      // invokes a deterministic provider port directly. Quote is a real
      // financial-provider boundary even though it has no effect, so include
      // it in the workflow's tenant/turn trace before native suspension.
      await traceOperationalPort({
        mastra,
        tracingContext,
        kind: "provider",
        operation: "transactions.quote_refund",
        run: () =>
          providerRegistry(binding)
            .transactions(binding)
            .quoteRefund(approvedCommand),
      });
      await caseStore.saveAction(
        supportCase.id,
        "refund-command",
        command.fingerprint,
        approvedCommand,
      );
      // Bind the exact evidence selected for this immutable command and turn.
      // Later case projections/drafts are mutable operational state and must
      // never decide whether a suspended approval may create an effect.
      await caseStore.saveAction(
        supportCase.id,
        "refund-policy-evidence",
        command.fingerprint,
        {
          turnId,
          binding: {
            tenantId: bindings.knowledge.tenantId,
            providerKind: bindings.knowledge.providerKind,
            providerAccountId: bindings.knowledge.providerAccountId,
          },
          citations: parsedDraftEvidence(supportCase, draft.citedSources),
        },
      );
      await caseStore.bindTurnCommand(
        supportCase.id,
        turnId,
        command.fingerprint,
      );
      if (!mastra)
        throw new Error(
          "Native refund approval requires the registered Mastra instance.",
        );
      const executionAgent = mastra.getAgent("refundExecutionAgent");
      // This is a real Agent lifecycle. requireApproval is set on issue_refund;
      // generate must therefore persist a native snapshot before the workflow
      // presents its one shared decision.
      const native = await executionAgent.generate(
        `Call issue_refund once with exactly this immutable command JSON: ${JSON.stringify(
          {
            caseId: supportCase.id,
            orderId: command.orderId,
            amount: command.amount,
            currency: command.currency,
            reason: command.reason,
            idempotencyKey: command.idempotencyKey,
            fingerprint: command.fingerprint,
          },
        )}`,
        { requestContext, tracingContext },
      );
      const suspended = native as {
        finishReason?: string;
        runId?: string;
        suspendPayload?: {
          toolCallId?: string;
          toolName?: string;
          args?: unknown;
        };
      };
      const expectedNativeArgs = {
        caseId: supportCase.id,
        orderId: command.orderId,
        amount: command.amount,
        currency: command.currency,
        reason: command.reason,
        idempotencyKey: command.idempotencyKey,
        fingerprint: command.fingerprint,
      };
      const nativeArgs = refundExecutionInputSchema.safeParse(
        suspended.suspendPayload?.args,
      );
      if (
        suspended.finishReason !== "suspended" ||
        !suspended.runId ||
        suspended.suspendPayload?.toolName !== "issue_refund" ||
        !suspended.suspendPayload.toolCallId ||
        !nativeArgs.success ||
        nativeArgs.data.caseId !== expectedNativeArgs.caseId ||
        nativeArgs.data.orderId !== expectedNativeArgs.orderId ||
        nativeArgs.data.amount !== expectedNativeArgs.amount ||
        nativeArgs.data.currency !== expectedNativeArgs.currency ||
        nativeArgs.data.reason !== expectedNativeArgs.reason ||
        nativeArgs.data.idempotencyKey !== expectedNativeArgs.idempotencyKey ||
        nativeArgs.data.fingerprint !== expectedNativeArgs.fingerprint
      )
        throw new Error(
          "Native refund agent did not suspend on the immutable tool call.",
        );
      await caseStore.update(supportCase.id, {
        status: "waiting_approval",
        metadata: {
          ...supportCase.metadata,
          refundCommand: command,
          nativeApproval: {
            runId: suspended.runId,
            toolCallId: suspended.suspendPayload.toolCallId,
            fingerprint: command.fingerprint,
            turnId,
          },
        },
      });
      return await suspend({
        caseId: supportCase.id,
        action: "refund",
        refundAmount: draft.refundAmount ?? 0,
        refundCurrency: draft.refundCurrency ?? "USD",
        refundReason: draft.refundReason ?? "",
        orderId:
          supportCase.orderLookup?.order?.orderId ??
          supportCase.subscriptionLookup?.subscription?.refundOrderId ??
          "",
        draftResponse: draft.draftResponse,
      });
    }

    if (
      !supportCase.metadata.refundCommand &&
      !supportCase.metadata.subscriptionCreditCommand
    )
      throw new Error("The persisted financial command is missing.");
    // HTTP records the authenticated decision atomically before it resumes the
    // workflow. This step must only consume that record, never manufacture a
    // second decision from resume data (which is network-controlled input).
    const persisted = supportCase.approval;
    if (!persisted)
      throw new Error(
        "Legacy approval has no authenticated Phase 003 decision and cannot execute.",
      );
    if (
      persisted.approved !== resumeData.approved ||
      persisted.approverId !== resumeData.approverId
    )
      throw new Error(
        "The workflow resume does not match the durable approval decision.",
      );

    return {
      caseId: supportCase.id,
      turnId: inputData.turnId,
      approved: persisted.approved,
      approverId: persisted.approverId,
      note: persisted.note,
    };
  },
});

export const REQUEST_APPROVAL_STEP_ID = requestApprovalStep.id;
