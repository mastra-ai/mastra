import { registerApiRoute, type ContextWithMastra } from "@mastra/core/server";
import { caseStore } from "../lib/case-store";
import {
  renewDispatchLeaseWhileRunning,
  withDispatchLeaseScope,
} from "../lib/dispatch-lease-scope";
import { isRefundPolicyEvidenceError } from "../lib/refund-policy-evidence";
import { resumeApprovedNativeTool } from "../providers/native-execution";
import {
  reconcileApprovedRefundEffect,
  reconcileApprovedSubscriptionCreditEffect,
} from "../runtime/native-approval-recovery";
import { REQUEST_APPROVAL_STEP_ID } from "../workflows/resolve-support-case";
import { canAccessCase } from "./auth";
import { approvalRequestSchema, errorResponseSchema } from "./contracts";
import { requireRole, scopedCaseDto } from "./route-context";

async function resumeApproval(c: ContextWithMastra, approved: boolean) {
  const caseId = c.req.param("caseId");
  if (!caseId) {
    return c.json(
      errorResponseSchema.parse({ error: "Missing case id." }),
      400,
    );
  }
  const supportCase = await caseStore.get(caseId);
  if (!supportCase) return c.json({ error: "Case not found." }, 404);
  const current = requireRole(c, "approver");
  if (current instanceof Response) return current;
  if (!canAccessCase(current, supportCase))
    return c.json(
      errorResponseSchema.parse({ error: "Case access denied." }),
      403,
    );
  if (!supportCase.workflowRunId) {
    return c.json(
      { error: "This case has no in-flight resolution workflow run." },
      409,
    );
  }
  if (supportCase.status !== "waiting_approval") {
    return c.json(
      {
        error: `Case is not waiting for approval (status: ${supportCase.status}).`,
      },
      409,
    );
  }

  let body: {
    commandFingerprint?: string;
    note?: string;
    serviceProblemConfirmed?: true;
  } = {};
  try {
    const rawBody = await c.req.text();
    const parsed = approvalRequestSchema.safeParse(
      rawBody.trim() === "" ? {} : JSON.parse(rawBody),
    );
    if (!parsed.success)
      return c.json(
        errorResponseSchema.parse({ error: "Invalid approval payload." }),
        400,
      );
    body = parsed.data;
  } catch {
    return c.json(
      errorResponseSchema.parse({ error: "Invalid approval payload." }),
      400,
    );
  }

  const mastra = c.get("mastra");
  const resolveWorkflow = mastra.getWorkflow("resolveSupportCaseWorkflow");
  const command =
    supportCase.metadata.refundCommand ??
    supportCase.metadata.subscriptionCreditCommand;
  if (!command?.fingerprint)
    return c.json(
      errorResponseSchema.parse({
        error: "Immutable refund command is missing.",
      }),
      409,
    );
  const isSubscriptionCredit = Boolean(
    supportCase.metadata.subscriptionCreditCommand &&
    !supportCase.metadata.refundCommand,
  );
  if (approved && isSubscriptionCredit && !body.serviceProblemConfirmed)
    return c.json(
      errorResponseSchema.parse({
        error:
          "Approving a subscription credit requires confirmation of the reported service problem.",
      }),
      409,
    );
  if (body.commandFingerprint !== command.fingerprint)
    return c.json(
      errorResponseSchema.parse({
        error: "The displayed approval command is stale.",
      }),
      409,
    );
  const native = supportCase.metadata.nativeApproval;
  if (
    !native?.runId ||
    !native.toolCallId ||
    native.fingerprint !== command.fingerprint
  )
    return c.json(
      errorResponseSchema.parse({
        error: "Native approval binding is missing or stale.",
      }),
      409,
    );
  let decision;
  try {
    decision = await caseStore.recordApprovalDecision({
      caseId,
      turnId: native.turnId,
      commandFingerprint: command.fingerprint,
      principalId: current.id,
      approved,
      note: body.note,
      serviceProblemConfirmed: body.serviceProblemConfirmed,
      nativeRunId: native.runId,
      nativeToolCallId: native.toolCallId,
    });
  } catch (error) {
    return c.json(
      errorResponseSchema.parse({
        error: error instanceof Error ? error.message : String(error),
      }),
      409,
    );
  }
  if (!decision.won)
    return c.json(
      errorResponseSchema.parse({
        error: "This approval was already submitted.",
      }),
      409,
    );
  // Claim the durable workflow lease before changing the native Agent run.
  // A decision commit is recoverable; without this fence an HTTP request and
  // the recovery worker could both resume the same native snapshot.
  const dispatch = await caseStore.claimDispatchForResume(
    caseId,
    supportCase.workflowRunId,
    native.turnId,
  );
  if (!dispatch)
    return c.json(
      {
        error:
          "This approval is already being resumed or is no longer resumable.",
      },
      409,
    );
  const lease = renewDispatchLeaseWhileRunning(caseStore, dispatch);
  let nativeResumed = false;
  try {
    await lease.renew();
    if (lease.lostOwnership)
      return c.json(
        { error: "Approval resume lost its dispatch lease; reload the case." },
        409,
      );
    lease.start();
    await withDispatchLeaseScope(
      {
        dispatchId: dispatch.id,
        caseId: dispatch.caseId,
        turnId: dispatch.turnId,
        leaseToken: dispatch.leaseToken!,
      },
      () =>
        resumeApprovedNativeTool({
          mastra,
          approved,
          scope: {
            caseId: dispatch.caseId,
            turnId: dispatch.turnId,
            nativeRunId: native.runId!,
            nativeToolCallId: native.toolCallId!,
            commandFingerprint: native.fingerprint!,
            dispatchId: dispatch.id,
            leaseToken: dispatch.leaseToken!,
          },
          requestContext: c.get("requestContext"),
        }),
    );
    nativeResumed = true;
  } catch (error) {
    // Expired/replaced command evidence is a deterministic safety decision,
    // not a transient native snapshot failure. Leave a durable staff-review
    // outcome with no new provider effect; only transport/snapshot failures
    // remain recoverable.
    if (isRefundPolicyEvidenceError(error))
      await caseStore
        .failDispatchAndCase(
          dispatch.id,
          caseId,
          error,
          dispatch.leaseToken,
          "escalated",
        )
        .catch(() => undefined);
    else
      await caseStore
        .completeDispatch(dispatch.id, "suspended", error, dispatch.leaseToken)
        .catch(() => undefined);
    lease.stop();
    return c.json(
      errorResponseSchema.parse({
        error: error instanceof Error ? error.message : String(error),
      }),
      409,
    );
  }
  try {
    if (approved && command.idempotencyKey) {
      const currentCase = await caseStore.get(caseId);
      const creditCommand = currentCase?.metadata.subscriptionCreditCommand;
      const refundCommand = currentCase?.metadata.refundCommand;
      const isCredit = Boolean(creditCommand && !refundCommand);
      const reconciled = isCredit
        ? await reconcileApprovedSubscriptionCreditEffect({
            store: caseStore,
            supportCase: currentCase ?? supportCase,
            dispatch,
            fingerprint: command.fingerprint,
            command: creditCommand,
          })
        : await reconcileApprovedRefundEffect({
            store: caseStore,
            supportCase: currentCase ?? supportCase,
            dispatch,
            fingerprint: command.fingerprint,
            command: refundCommand,
          });
      const attempt = !reconciled
        ? isCredit
          ? await caseStore.stripeSubscriptionCreditAttempt(
              command.idempotencyKey,
            )
          : await caseStore.stripeRefundAttempt(command.idempotencyKey)
        : undefined;
      const exactAttempt =
        attempt &&
        attempt.caseId === caseId &&
        attempt.fingerprint === command.fingerprint;
      const failedStripeAttempt = exactAttempt && attempt.status === "failed";
      // The authoritative failure finalizer has already closed the immutable
      // turn and queued its one staff-review reply. An HTTP approval must not
      // turn a superseded success effect into a second native continuation.
      if (failedStripeAttempt) {
        const terminalCase = (await caseStore.get(caseId))!;
        // The financial failure is already finalized before this branch.  A
        // cancellation makes the enclosing Studio history truthful without
        // resuming the consumed approval tool or creating another reply.
        if (terminalCase.workflowRunId) {
          const terminalRun = await resolveWorkflow.createRun({
            runId: terminalCase.workflowRunId,
          });
          await terminalRun.cancel();
        }
        const completed = await caseStore.completeDispatch(
          dispatch.id,
          "completed",
          undefined,
          dispatch.leaseToken,
        );
        if (!completed)
          return c.json(
            {
              error:
                "Approval resume lost its dispatch lease; reload the case.",
            },
            409,
          );
        return c.json(scopedCaseDto((await caseStore.get(caseId))!, current));
      }
      const awaitingStripeSettlement =
        exactAttempt &&
        (attempt.status === "unknown" ||
          (!isCredit &&
            "refundId" in attempt &&
            Boolean(attempt.refundId) &&
            attempt.status === "pending"));
      if (awaitingStripeSettlement) {
        // A tool can return normally after recording an unknown provider POST.
        // Do not resume the enclosing workflow into an escalation: retain its
        // suspended dispatch so a restarted recovery worker can retrieve and
        // project the same immutable receipt without another approval or POST.
        const suspended = await caseStore.completeDispatch(
          dispatch.id,
          "suspended",
          isCredit
            ? "Subscription credit receipt is awaiting durable provider recovery."
            : "Refund receipt is awaiting durable provider recovery.",
          dispatch.leaseToken,
        );
        if (!suspended)
          return c.json(
            {
              error:
                "Approval resume lost its dispatch lease; reload the case.",
            },
            409,
          );
        return c.json(scopedCaseDto((await caseStore.get(caseId))!, current));
      }
      if (!reconciled) {
        // A normally resolved native transition with no exact provider effect
        // is a completed tool failure. Transport/snapshot errors take the
        // earlier catch path and remain recoverable; do not loop forever on a
        // native snapshot that Mastra has already consumed.
        const failed = await caseStore.failDispatchAndCase(
          dispatch.id,
          caseId,
          isCredit
            ? "Native approval completed without a durable subscription credit receipt."
            : "Native approval completed without a durable refund effect.",
          dispatch.leaseToken,
          "escalated",
        );
        if (!failed)
          return c.json(
            {
              error:
                "Approval resume lost its dispatch lease; reload the case.",
            },
            409,
          );
        return c.json(
          {
            error: isCredit
              ? "Approval completed without a durable subscription credit receipt."
              : "Approval completed without a durable refund effect.",
          },
          500,
        );
      }
    }
    if (lease.lostOwnership)
      return c.json(
        { error: "Approval resume lost its dispatch lease; reload the case." },
        409,
      );
    const run = await resolveWorkflow.createRun({
      runId: supportCase.workflowRunId,
    });
    const result = await withDispatchLeaseScope(
      {
        dispatchId: dispatch.id,
        caseId: dispatch.caseId,
        turnId: dispatch.turnId,
        leaseToken: dispatch.leaseToken!,
      },
      async () => {
        await caseStore.update(caseId, { status: "processing" });
        return run.resume({
          step: REQUEST_APPROVAL_STEP_ID,
          resumeData: {
            approved,
            // The authenticated principal wins.  A client supplied approver id
            // is retained only as an audit note and can never confer authority.
            approverId: current.id,
            note: body.note,
          },
          requestContext: c.get("requestContext"),
        });
      },
    );
    if (lease.lostOwnership)
      return c.json(
        { error: "Approval resume lost its dispatch lease; reload the case." },
        409,
      );

    if (result.status === "failed") {
      const failed = await caseStore.failDispatchAndCase(
        dispatch.id,
        caseId,
        "Resolution failed after approval resume.",
        dispatch.leaseToken,
        "escalated",
      );
      if (!failed)
        return c.json(
          {
            error: "Approval resume lost its dispatch lease; reload the case.",
          },
          409,
        );
      return c.json({ error: "Resolution failed after resume.", result }, 500);
    }

    const finalState =
      result.status === "success"
        ? "completed"
        : result.status === "suspended" || result.status === "paused"
          ? "suspended"
          : undefined;
    if (!finalState) {
      const failed = await caseStore.failDispatchAndCase(
        dispatch.id,
        caseId,
        `Resolution returned ${result.status} after approval resume.`,
        dispatch.leaseToken,
        "escalated",
      );
      if (!failed)
        return c.json(
          {
            error: "Approval resume lost its dispatch lease; reload the case.",
          },
          409,
        );
      return c.json({ error: "Resolution failed after resume." }, 500);
    }
    if (
      !(await caseStore.completeDispatch(
        dispatch.id,
        finalState,
        undefined,
        dispatch.leaseToken,
      ))
    )
      return c.json(
        { error: "Approval resume lost its dispatch lease; reload the case." },
        409,
      );

    return c.json(scopedCaseDto((await caseStore.get(caseId))!, current));
  } catch (error: any) {
    if (error?.id === "WORKFLOW_RESUME_ALREADY_CLAIMED") {
      return c.json({ error: "This approval was already submitted." }, 409);
    }
    if (!lease.lostOwnership && nativeResumed) {
      const failed = await caseStore
        .failDispatchAndCase(
          dispatch.id,
          caseId,
          error,
          dispatch.leaseToken,
          "escalated",
        )
        .catch(() => false);
      if (!failed)
        return c.json(
          {
            error: "Approval resume lost its dispatch lease; reload the case.",
          },
          409,
        );
    }
    return c.json(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  } finally {
    lease.stop();
  }
}

export const supportCaseApproveRoute = registerApiRoute(
  "/support/cases/:caseId/approve",
  {
    method: "POST",
    handler: async (c) => resumeApproval(c, true),
  },
);

export const supportCaseRejectRoute = registerApiRoute(
  "/support/cases/:caseId/reject",
  {
    method: "POST",
    handler: async (c) => resumeApproval(c, false),
  },
);
