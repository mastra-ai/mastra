import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { Mastra } from "@mastra/core/mastra";
import {
  caseStore,
  type CaseStore,
  type DispatchRecord,
} from "../lib/case-store";
import type { SupportCase } from "../domain/support-case";
import { legacyAmountToMoney, moneyToLegacyAmount } from "../lib/money";
import {
  renewDispatchLeaseWhileRunning,
  withDispatchLeaseScope,
} from "../lib/dispatch-lease-scope";
import { isRefundPolicyEvidenceError } from "../lib/refund-policy-evidence";
import { resumeApprovedNativeTool } from "../providers/native-execution";
import type {
  RefundEffect,
  SubscriptionCreditEffect,
} from "../providers/contracts";
import {
  providerRegistry,
  resolveConfiguredBinding,
} from "../providers/registry";
import { bindingsForPersistedCase } from "./provider-bindings";

export type NativeRecoveryMastra = Mastra;

// Keep this recovery boundary independent of the workflow composition module.
const REQUEST_APPROVAL_STEP_ID = "request-approval";

type PersistedRefundCommand = {
  orderId?: string;
  idempotencyKey?: string;
  fingerprint?: string;
  amount?: number;
  currency?: string;
};
type PersistedSubscriptionCreditCommand = {
  customerId?: string;
  subscriptionId?: string;
  idempotencyKey?: string;
  fingerprint?: string;
  amount?: number;
  currency?: string;
  reason?: string;
};

/** Projects only an exact durable provider effect. A normal native-resume
 * return does not prove that its tool completed, so callers use this before
 * resuming the enclosing workflow. */
export async function reconcileApprovedRefundEffect(input: {
  store: CaseStore;
  supportCase: SupportCase;
  dispatch: DispatchRecord;
  fingerprint: string;
  command: PersistedRefundCommand | undefined;
}) {
  const { store, supportCase, dispatch, fingerprint, command } = input;
  if (!command?.idempotencyKey) return false;
  if (command.fingerprint !== fingerprint)
    throw new Error(
      "The persisted refund command does not match the approved fingerprint.",
    );
  const existing = await store.idempotency(command.idempotencyKey);
  if (!existing) return false;
  if (existing.fingerprint !== fingerprint)
    throw new Error(
      "A durable refund effect does not match the immutable approved command.",
    );
  const effect = existing.effect as RefundEffect;
  const expectedAmount =
    typeof command.amount === "number" && typeof command.currency === "string"
      ? legacyAmountToMoney(command.amount, command.currency)
      : undefined;
  if (
    effect.idempotencyKey !== command.idempotencyKey ||
    effect.orderId !== command.orderId ||
    !effect.amount ||
    !effect.refundId ||
    !expectedAmount ||
    effect.amount.currency !== expectedAmount.currency ||
    effect.amount.minor !== expectedAmount.minor ||
    !Number.isFinite(Date.parse(effect.executedAt))
  )
    throw new Error(
      "A durable refund effect does not exactly match the approved command.",
    );
  const reconciled = {
    refundId: effect.refundId,
    orderId: effect.orderId,
    amount: moneyToLegacyAmount(effect.amount),
    currency: effect.amount.currency,
    status: effect.replayed ? ("skipped" as const) : ("executed" as const),
    idempotencyKey: effect.idempotencyKey,
    executedAt: effect.executedAt,
  };
  await withDispatchLeaseScope(
    {
      dispatchId: dispatch.id,
      caseId: dispatch.caseId,
      turnId: dispatch.turnId,
      leaseToken: dispatch.leaseToken!,
    },
    () =>
      store.update(dispatch.caseId, {
        refundResult: reconciled,
        metadata: {
          ...supportCase.metadata,
          refundEffects: {
            ...supportCase.metadata.refundEffects,
            [fingerprint]: reconciled,
          },
        },
      }),
  );
  return true;
}

/** Credit recovery mirrors refund recovery but keeps its own command shape and
 * customer-balance receipt.  A durable receipt is enough to project the
 * result after restart; do not re-run the native POST. */
export async function reconcileApprovedSubscriptionCreditEffect(input: {
  store: CaseStore;
  supportCase: SupportCase;
  dispatch: DispatchRecord;
  fingerprint: string;
  command: PersistedSubscriptionCreditCommand | undefined;
}) {
  const { store, supportCase, dispatch, fingerprint, command } = input;
  if (!command?.idempotencyKey) return false;
  if (command.fingerprint !== fingerprint)
    throw new Error(
      "The persisted subscription credit command does not match the approved fingerprint.",
    );
  const existing = await store.idempotency(command.idempotencyKey);
  if (!existing) return false;
  if (existing.fingerprint !== fingerprint)
    throw new Error(
      "A durable subscription credit receipt does not match the immutable approved command.",
    );
  const effect = existing.effect as SubscriptionCreditEffect;
  const expectedAmount =
    typeof command.amount === "number" && typeof command.currency === "string"
      ? legacyAmountToMoney(command.amount, command.currency)
      : undefined;
  if (
    effect.idempotencyKey !== command.idempotencyKey ||
    effect.customerId !== command.customerId ||
    effect.subscriptionId !== command.subscriptionId ||
    !effect.amount ||
    !effect.creditId ||
    !expectedAmount ||
    effect.amount.currency !== expectedAmount.currency ||
    effect.amount.minor !== expectedAmount.minor ||
    !Number.isFinite(Date.parse(effect.executedAt))
  )
    throw new Error(
      "A durable subscription credit receipt does not exactly match the approved command.",
    );
  const reconciled = {
    creditId: effect.creditId,
    customerId: effect.customerId,
    subscriptionId: effect.subscriptionId,
    amount: moneyToLegacyAmount(effect.amount),
    currency: effect.amount.currency,
    status: effect.replayed ? ("skipped" as const) : ("executed" as const),
    idempotencyKey: effect.idempotencyKey,
    executedAt: effect.executedAt,
  };
  const alreadyProjected =
    supportCase.subscriptionCreditResult?.idempotencyKey ===
      command.idempotencyKey &&
    supportCase.subscriptionCreditResult.creditId === reconciled.creditId &&
    supportCase.metadata.subscriptionCreditEffects?.[fingerprint]
      ?.idempotencyKey === command.idempotencyKey;
  if (alreadyProjected) return true;
  await withDispatchLeaseScope(
    {
      dispatchId: dispatch.id,
      caseId: dispatch.caseId,
      turnId: dispatch.turnId,
      leaseToken: dispatch.leaseToken!,
    },
    () =>
      store.projectSubscriptionCreditToolExecution({
        caseId: dispatch.caseId,
        turnId: dispatch.turnId,
        fingerprint,
        idempotencyKey: command.idempotencyKey!,
        result: reconciled,
        effect,
      }),
  );
  return true;
}

/** A response loss consumes the native tool snapshot but does not prove a
 * provider failure. On a later recovery pass, inspect Stripe's durable ledger
 * and project only the exact immutable receipt before resuming the enclosing
 * workflow. */
async function recoverAndProjectSubscriptionCreditReceipt(input: {
  store: CaseStore;
  supportCase: SupportCase;
  dispatch: DispatchRecord;
  fingerprint: string;
  command: PersistedSubscriptionCreditCommand | undefined;
}) {
  const { store, supportCase, dispatch, fingerprint, command } = input;
  if (
    !command?.idempotencyKey ||
    !command.customerId ||
    !command.subscriptionId ||
    !command.reason ||
    typeof command.amount !== "number" ||
    typeof command.currency !== "string" ||
    command.fingerprint !== fingerprint
  )
    return false;
  const binding = resolveConfiguredBinding(
    bindingsForPersistedCase(supportCase).transactions,
  );
  const effect = await providerRegistry(binding)
    .transactions(binding)
    .retrieveSubscriptionCredit({
      binding,
      approvalCaseId: supportCase.id,
      customerId: command.customerId,
      subscriptionId: command.subscriptionId,
      amount: legacyAmountToMoney(command.amount, command.currency),
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
      fingerprint,
    });
  if (!effect) return false;
  const result = {
    creditId: effect.creditId,
    customerId: effect.customerId,
    subscriptionId: effect.subscriptionId,
    amount: moneyToLegacyAmount(effect.amount),
    currency: effect.amount.currency,
    status: effect.replayed ? ("skipped" as const) : ("executed" as const),
    idempotencyKey: effect.idempotencyKey,
    executedAt: effect.executedAt,
  };
  await withDispatchLeaseScope(
    {
      dispatchId: dispatch.id,
      caseId: dispatch.caseId,
      turnId: dispatch.turnId,
      leaseToken: dispatch.leaseToken!,
    },
    () =>
      store.projectSubscriptionCreditToolExecution({
        caseId: dispatch.caseId,
        turnId: dispatch.turnId,
        fingerprint,
        idempotencyKey: command.idempotencyKey!,
        result,
        effect,
      }),
  );
  return true;
}

async function hasUnknownStripeSubscriptionCreditAttempt(
  store: CaseStore,
  caseId: string,
  fingerprint: string,
  command: PersistedSubscriptionCreditCommand | undefined,
) {
  if (!command?.idempotencyKey) return false;
  const attempt = await store.stripeSubscriptionCreditAttempt(
    command.idempotencyKey,
  );
  return Boolean(
    attempt &&
    attempt.caseId === caseId &&
    attempt.fingerprint === fingerprint &&
    attempt.status === "unknown",
  );
}

/** A definite Stripe refusal is terminal and already has its one durable
 * staff-review outcome. Do not resume the consumed native snapshot again. */
async function hasFailedStripeSubscriptionCreditAttempt(
  store: CaseStore,
  caseId: string,
  fingerprint: string,
  command: PersistedSubscriptionCreditCommand | undefined,
) {
  if (!command?.idempotencyKey) return false;
  const attempt = await store.stripeSubscriptionCreditAttempt(
    command.idempotencyKey,
  );
  return Boolean(
    attempt &&
    attempt.caseId === caseId &&
    attempt.fingerprint === fingerprint &&
    attempt.status === "failed",
  );
}

/** A native tool can legitimately finish with a Stripe refund in `pending`.
 * The approval snapshot has then been consumed, but settlement is still owned
 * by the durable attempt/reconciliation worker. Treat it as a valid native
 * outcome without projecting success or finalizing the customer response. */
async function hasPendingStripeRefundAttempt(
  store: CaseStore,
  caseId: string,
  fingerprint: string,
  command: PersistedRefundCommand | undefined,
) {
  if (!command?.idempotencyKey) return false;
  const attempt = await store.stripeRefundAttempt(command.idempotencyKey);
  return Boolean(
    attempt &&
    attempt.caseId === caseId &&
    attempt.fingerprint === fingerprint &&
    attempt.refundId &&
    attempt.status === "pending",
  );
}

/** A confirmed terminal provider rejection is a real native outcome too. It
 * has no successful idempotency effect by design, but the enclosing workflow
 * must consume it once and produce its staff-review response. */
async function hasFailedStripeRefundAttempt(
  store: CaseStore,
  caseId: string,
  fingerprint: string,
  command: PersistedRefundCommand | undefined,
) {
  if (!command?.idempotencyKey) return false;
  const attempt = await store.stripeRefundAttempt(command.idempotencyKey);
  return Boolean(
    attempt &&
    attempt.caseId === caseId &&
    attempt.fingerprint === fingerprint &&
    attempt.status === "failed",
  );
}

async function cancelTerminalRefundWorkflow(
  mastra: NativeRecoveryMastra,
  workflowRunId: string,
) {
  const run = await mastra
    .getWorkflow("resolveSupportCaseWorkflow")
    .createRun({ runId: workflowRunId });
  await run.cancel();
}

export async function recoverApprovedNativeDecisions(
  mastra: NativeRecoveryMastra,
  store: CaseStore = caseStore,
  options: { model?: LanguageModelV2; disableScorers?: boolean } = {},
) {
  let recovered = 0;
  for (const item of await store.nativeDecisionsNeedingRecovery()) {
    // Claim before touching the native run.  The durable dispatch lease fences
    // HTTP and recovery workers from approving/declining the same snapshot.
    const dispatch = await store.claimDispatchForResume(
      item.caseId,
      item.workflowRunId,
      item.turnId,
    );
    if (!dispatch || !item.workflowRunId) continue;
    const refundCommand = item.supportCase.metadata.refundCommand;
    const creditCommand = item.supportCase.metadata.subscriptionCreditCommand;
    const isCredit = Boolean(creditCommand && !refundCommand);
    const lease = renewDispatchLeaseWhileRunning(store, dispatch);
    try {
      await lease.renew();
      if (lease.lostOwnership) continue;
      lease.start();
      const reconciledBefore =
        item.approved && (refundCommand || creditCommand)
          ? isCredit
            ? (await reconcileApprovedSubscriptionCreditEffect({
                store,
                supportCase: item.supportCase,
                dispatch,
                fingerprint: item.fingerprint,
                command: creditCommand,
              })) ||
              (await recoverAndProjectSubscriptionCreditReceipt({
                store,
                supportCase: item.supportCase,
                dispatch,
                fingerprint: item.fingerprint,
                command: creditCommand,
              }))
            : await reconcileApprovedRefundEffect({
                store,
                supportCase: item.supportCase,
                dispatch,
                fingerprint: item.fingerprint,
                command: refundCommand,
              })
          : false;
      // A confirmed no-effect failure consumes the native approval snapshot.
      // On restart, detect it before any resume attempt and close the enclosing
      // run after the durable case/outbox projection already exists.
      if (
        item.approved &&
        refundCommand &&
        (await hasFailedStripeRefundAttempt(
          store,
          item.caseId,
          item.fingerprint,
          refundCommand,
        ))
      ) {
        await cancelTerminalRefundWorkflow(mastra, item.workflowRunId);
        await store.completeDispatch(
          dispatch.id,
          "completed",
          undefined,
          dispatch.leaseToken,
        );
        recovered += 1;
        continue;
      }
      await withDispatchLeaseScope(
        {
          dispatchId: dispatch.id,
          caseId: dispatch.caseId,
          turnId: dispatch.turnId,
          leaseToken: dispatch.leaseToken!,
        },
        () =>
          reconciledBefore
            ? Promise.resolve(undefined)
            : resumeApprovedNativeTool({
                mastra,
                approved: item.approved,
                scope: {
                  caseId: dispatch.caseId,
                  turnId: dispatch.turnId,
                  nativeRunId: item.nativeRunId,
                  nativeToolCallId: item.nativeToolCallId,
                  commandFingerprint: item.fingerprint,
                  dispatchId: dispatch.id,
                  leaseToken: dispatch.leaseToken!,
                },
                ...(options.model ? { model: options.model } : {}),
              }),
      );
      if (lease.lostOwnership) continue;
      // A normal native transition can contain a caught tool failure.  Do not
      // resume and terminalize the enclosing workflow until its exact effect
      // is durable and projected. A missing effect after that normal return
      // is an explicit failed tool result; thrown native/snapshot errors use
      // the recoverable catch path below.
      // Stripe's failed terminalizer has already atomically closed the case,
      // immutable originating turn, and one staff-review outbox item. Resuming
      // the enclosing native workflow would create a second correction and
      // can never legitimately emit an issued reply.
      if (
        item.approved &&
        refundCommand &&
        (await hasFailedStripeRefundAttempt(
          store,
          item.caseId,
          item.fingerprint,
          refundCommand,
        ))
      ) {
        await cancelTerminalRefundWorkflow(mastra, item.workflowRunId);
        await store.completeDispatch(
          dispatch.id,
          "completed",
          undefined,
          dispatch.leaseToken,
        );
        recovered += 1;
        continue;
      }
      if (
        isCredit &&
        (await hasFailedStripeSubscriptionCreditAttempt(
          store,
          item.caseId,
          item.fingerprint,
          creditCommand,
        ))
      ) {
        await store.completeDispatch(
          dispatch.id,
          "completed",
          undefined,
          dispatch.leaseToken,
        );
        recovered += 1;
        continue;
      }
      if (
        isCredit &&
        (await hasUnknownStripeSubscriptionCreditAttempt(
          store,
          item.caseId,
          item.fingerprint,
          creditCommand,
        ))
      ) {
        await store.completeDispatch(
          dispatch.id,
          "suspended",
          "Subscription credit receipt is awaiting durable provider recovery.",
          dispatch.leaseToken,
        );
        continue;
      }
      const finalized =
        item.approved && (refundCommand || creditCommand)
          ? isCredit
            ? await reconcileApprovedSubscriptionCreditEffect({
                store,
                supportCase: (await store.get(item.caseId)) ?? item.supportCase,
                dispatch,
                fingerprint: item.fingerprint,
                command: creditCommand,
              })
            : await reconcileApprovedRefundEffect({
                store,
                supportCase: (await store.get(item.caseId)) ?? item.supportCase,
                dispatch,
                fingerprint: item.fingerprint,
                command: refundCommand,
              })
          : false;
      if (
        item.approved &&
        (refundCommand || creditCommand) &&
        !finalized &&
        !(await hasPendingStripeRefundAttempt(
          store,
          item.caseId,
          item.fingerprint,
          refundCommand,
        )) &&
        !(await hasFailedStripeRefundAttempt(
          store,
          item.caseId,
          item.fingerprint,
          refundCommand,
        ))
      ) {
        // The official native transition returned normally and the exact
        // durable effect is still absent. This is a completed tool failure,
        // not an uncertain provider response: leave a visible terminal case
        // instead of repeatedly resuming an already-consumed native snapshot.
        await store.failDispatchAndCase(
          dispatch.id,
          item.caseId,
          isCredit
            ? "Native approval completed without a durable subscription credit receipt."
            : "Native approval completed without a durable refund effect.",
          dispatch.leaseToken,
          "escalated",
        );
        continue;
      }
      const run = await mastra
        .getWorkflow("resolveSupportCaseWorkflow")
        .createRun({
          runId: item.workflowRunId,
          ...(options.disableScorers ? { disableScorers: true } : {}),
        });
      const result = await withDispatchLeaseScope<{ status: string }>(
        {
          dispatchId: dispatch.id,
          caseId: dispatch.caseId,
          turnId: dispatch.turnId,
          leaseToken: dispatch.leaseToken!,
        },
        () =>
          run.resume({
            step: REQUEST_APPROVAL_STEP_ID,
            resumeData: {
              approved: item.approved,
              approverId: item.principalId,
              note: item.note,
            },
          }),
      );
      if (lease.lostOwnership) continue;
      if (result.status === "failed")
        await store.failDispatchAndCase(
          dispatch.id,
          item.caseId,
          "Workflow recovery failed after the native decision.",
          dispatch.leaseToken,
          "escalated",
        );
      else if (result.status === "success")
        await store.completeDispatch(
          dispatch.id,
          "completed",
          undefined,
          dispatch.leaseToken,
        );
      else
        await store.completeDispatch(
          dispatch.id,
          "suspended",
          `Workflow recovery returned ${result.status}.`,
          dispatch.leaseToken,
        );
      recovered += 1;
    } catch (error) {
      // The native snapshot may be temporarily unavailable after a process
      // crash. Return its lease to the suspended queue so a later bounded
      // sweep can reconcile it; never invent an approval or effect.
      if (
        /does not match the immutable approved command/.test(String(error)) ||
        isRefundPolicyEvidenceError(error)
      )
        await store
          .failDispatchAndCase(
            dispatch.id,
            item.caseId,
            error,
            dispatch.leaseToken,
            "escalated",
          )
          .catch(() => undefined);
      else
        await store
          .completeDispatch(
            dispatch.id,
            "suspended",
            error,
            dispatch.leaseToken,
          )
          .catch(() => undefined);
      continue;
    } finally {
      lease.stop();
    }
  }
  return recovered;
}
