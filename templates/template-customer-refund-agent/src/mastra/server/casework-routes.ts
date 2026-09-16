import { registerApiRoute } from "@mastra/core/server";
import {
  caseStore,
  isRetentionTombstone,
  type DispatchRecord,
} from "../lib/case-store";
import {
  renewDispatchLeaseWhileRunning,
  withDispatchLeaseScope,
} from "../lib/dispatch-lease-scope";
import { retryOrEscalateOperationalFailure } from "../lib/operational-alerts";
import type { CaseFeedback } from "../domain/support-case";
import { canAccessCase, hasRole } from "./auth";
import {
  caseListResponseSchema,
  customerFinancialRequestsResponseSchema,
  errorResponseSchema,
  feedbackRequestSchema,
  followUpRequestSchema,
  manualResolutionContextSchema,
  manualResolutionRequestSchema,
} from "./contracts";
import { caseScope, requirePrincipal, scopedCaseDto } from "./route-context";

function canResolveManually(roles: readonly string[]) {
  return roles.some((role) =>
    ["support-agent", "approver", "admin"].includes(role),
  );
}

export const supportCaseManualResolutionContextRoute = registerApiRoute(
  "/support/cases/:caseId/manual-resolution",
  {
    method: "GET",
    handler: async (c) => {
      const supportCase = await caseStore.get(c.req.param("caseId"));
      if (!supportCase) return c.json({ error: "Case not found." }, 404);
      const current = caseScope(c, supportCase);
      if (current instanceof Response) return current;
      if (!canResolveManually(current.roles))
        return c.json(
          errorResponseSchema.parse({ error: "Insufficient authority." }),
          403,
        );
      const context = await caseStore.manualResolutionContext(supportCase.id);
      if (!context) return c.json({ error: "Case not found." }, 404);
      return c.json(manualResolutionContextSchema.parse(context));
    },
  },
);

export const supportCaseManualResolutionRoute = registerApiRoute(
  "/support/cases/:caseId/manual-resolution",
  {
    method: "POST",
    handler: async (c) => {
      const supportCase = await caseStore.get(c.req.param("caseId"));
      if (!supportCase) return c.json({ error: "Case not found." }, 404);
      const current = caseScope(c, supportCase);
      if (current instanceof Response) return current;
      if (!canResolveManually(current.roles))
        return c.json(
          errorResponseSchema.parse({ error: "Insufficient authority." }),
          403,
        );
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json(
          errorResponseSchema.parse({
            error: "Invalid manual-resolution payload.",
          }),
          400,
        );
      }
      const parsed = manualResolutionRequestSchema.safeParse(body);
      if (!parsed.success)
        return c.json(
          errorResponseSchema.parse({
            error: "Invalid manual-resolution payload.",
          }),
          400,
        );
      const result = await caseStore.resolveManually({
        caseId: supportCase.id,
        tenantId: current.tenantId,
        actorId: current.id,
        ...parsed.data,
      });
      if (result.state === "conflict")
        return c.json(errorResponseSchema.parse({ error: result.reason }), 409);
      const updated = await caseStore.get(supportCase.id);
      return c.json({
        case: scopedCaseDto(updated!, current),
        context: manualResolutionContextSchema.parse(result.context),
        replayed: result.state === "replayed",
      });
    },
  },
);

/** Follow-up execution is an operational entrypoint, not merely an HTTP
 * response. Classify its failure and leave a bounded durable retry or a human
 * escalation; never terminalize a dispatch as an unclassified failure. */
async function recoverFollowUpFailure(
  dispatch: DispatchRecord,
  caseId: string,
  error: unknown,
) {
  return retryOrEscalateOperationalFailure({
    signal: {
      providerOrTool: "resolve-support-case",
      occurredAt: new Date(),
      durationMs: 0,
      failed: true,
    },
    retry: () =>
      caseStore.retryDispatch(dispatch.id, caseId, error, dispatch.leaseToken),
    escalate: () =>
      caseStore.failDispatchAndCase(
        dispatch.id,
        caseId,
        error,
        dispatch.leaseToken,
        "escalated",
      ),
  });
}

export const supportCaseFollowUpRoute = registerApiRoute(
  "/support/cases/:caseId/follow-ups",
  {
    method: "POST",
    handler: async (c) => {
      const caseId = c.req.param("caseId");
      const supportCase = await caseStore.get(caseId);
      if (!supportCase) return c.json({ error: "Case not found." }, 404);
      const current = caseScope(c, supportCase);
      if (current instanceof Response) return current;
      if (!hasRole(current, "customer"))
        return c.json(
          errorResponseSchema.parse({ error: "Insufficient authority." }),
          403,
        );
      if (isRetentionTombstone(supportCase))
        return c.json(
          errorResponseSchema.parse({
            error: "This expired support case cannot accept new content.",
          }),
          410,
        );
      let input: unknown;
      try {
        input = await c.req.json();
      } catch {
        return c.json(
          errorResponseSchema.parse({ error: "Invalid follow-up payload." }),
          400,
        );
      }
      const parsed = followUpRequestSchema.safeParse(input);
      if (!parsed.success)
        return c.json(
          errorResponseSchema.parse({ error: "Invalid follow-up payload." }),
          400,
        );
      const mastra = c.get("mastra");
      const runId = `follow-up-${crypto.randomUUID()}`;
      const appended = await caseStore.appendFollowUp({
        caseId,
        eventId: `portal-${crypto.randomUUID()}`,
        runId,
        message: {
          id: `message-${crypto.randomUUID()}`,
          author: "customer",
          authorName: current.email,
          body: parsed.data.body,
          createdAt: new Date().toISOString(),
        },
      });
      if (!appended.appended)
        return c.json(scopedCaseDto(appended.supportCase, current));
      const dispatch = await caseStore.claimDispatchForStart(caseId, runId);
      if (!dispatch)
        return c.json(scopedCaseDto((await caseStore.get(caseId))!, current));
      const lease = renewDispatchLeaseWhileRunning(caseStore, dispatch);
      try {
        await lease.renew();
        if (lease.lostOwnership)
          return c.json(
            { error: "Follow-up lost its dispatch lease; reload the case." },
            409,
          );
        lease.start();
        if (!(await caseStore.activateDispatch(dispatch)))
          return c.json(scopedCaseDto((await caseStore.get(caseId))!, current));
        const run = await mastra
          .getWorkflow("resolveSupportCaseWorkflow")
          .createRun({ runId });
        const result = await withDispatchLeaseScope<{ status: string }>(
          {
            dispatchId: dispatch.id,
            caseId: dispatch.caseId,
            turnId: dispatch.turnId,
            leaseToken: dispatch.leaseToken!,
          },
          () =>
            run.start({
              inputData: { caseId, turnId: dispatch.turnId },
              requestContext: c.get("requestContext"),
            }),
        );
        if (lease.lostOwnership)
          return c.json(
            { error: "Follow-up lost its dispatch lease; reload the case." },
            409,
          );
        if (result.status === "failed") {
          const recovery = await recoverFollowUpFailure(
            dispatch,
            caseId,
            "Follow-up resolution failed.",
          );
          if (!recovery.applied)
            return c.json(
              { error: "Follow-up lost its dispatch lease; reload the case." },
              409,
            );
          return c.json({ error: "Follow-up resolution failed." }, 500);
        }
        if (
          result.status === "suspended" ||
          result.status === "paused" ||
          result.status === "waiting"
        ) {
          if (
            !(await caseStore.completeDispatch(
              dispatch.id,
              "suspended",
              undefined,
              dispatch.leaseToken,
            ))
          )
            return c.json(
              { error: "Follow-up lost its dispatch lease; reload the case." },
              409,
            );
        } else if (result.status === "success") {
          if (
            !(await caseStore.completeDispatch(
              dispatch.id,
              "completed",
              undefined,
              dispatch.leaseToken,
            ))
          )
            return c.json(
              { error: "Follow-up lost its dispatch lease; reload the case." },
              409,
            );
        } else {
          const recovery = await recoverFollowUpFailure(
            dispatch,
            caseId,
            `Follow-up resolution returned ${result.status}.`,
          );
          if (!recovery.applied)
            return c.json(
              { error: "Follow-up lost its dispatch lease; reload the case." },
              409,
            );
          return c.json({ error: "Follow-up resolution failed." }, 500);
        }
      } catch (error) {
        const recovery = await recoverFollowUpFailure(
          dispatch,
          caseId,
          error,
        ).catch(() => undefined);
        if (!recovery?.applied)
          return c.json(
            { error: "Follow-up lost its dispatch lease; reload the case." },
            409,
          );
        return c.json(
          errorResponseSchema.parse({
            error: error instanceof Error ? error.message : String(error),
          }),
          500,
        );
      } finally {
        lease.stop();
      }
      return c.json(scopedCaseDto((await caseStore.get(caseId))!, current));
    },
  },
);

/** GET /support/cases - case inbox for the demo UI, newest first. Optionally filtered by `?email=` for the customer portal. */
export const supportCasesListRoute = registerApiRoute("/support/cases", {
  method: "GET",
  handler: async (c) => {
    const current = requirePrincipal(c);
    if (current instanceof Response) return current;
    const allCases = await caseStore.list();
    // Query/body email is never authority. Customers only see their own
    // tenant-qualified cases; staff roles remain tenant scoped.
    const cases = allCases.filter((supportCase) =>
      canAccessCase(current, supportCase),
    );
    return c.json(
      caseListResponseSchema.parse({
        cases: cases.map((supportCase) => scopedCaseDto(supportCase, current)),
      }),
    );
  },
});

/** Customer-facing financial history is a purpose-built read model. It does
 * not reuse the staff case DTO because a command, approval note, or provider
 * reference is never customer-visible. */
export const supportCustomerFinancialRequestsRoute = registerApiRoute(
  "/support/customer/financial-requests",
  {
    method: "GET",
    handler: async (c) => {
      const current = requirePrincipal(c);
      if (current instanceof Response) return current;
      if (!hasRole(current, "customer"))
        return c.json(
          errorResponseSchema.parse({ error: "Insufficient authority." }),
          403,
        );
      const cases = (await caseStore.list()).filter((supportCase) =>
        canAccessCase(current, supportCase),
      );
      return c.json(
        customerFinancialRequestsResponseSchema.parse({
          requests: await caseStore.customerFinancialRequests(
            cases.map((supportCase) => supportCase.id),
          ),
        }),
      );
    },
  },
);

export const supportCaseDetailRoute = registerApiRoute(
  "/support/cases/:caseId",
  {
    method: "GET",
    handler: async (c) => {
      const supportCase = await caseStore.get(c.req.param("caseId"));
      if (!supportCase) return c.json({ error: "Case not found." }, 404);
      const current = caseScope(c, supportCase);
      if (current instanceof Response) return current;
      return c.json(scopedCaseDto(supportCase, current));
    },
  },
);

/** A tenant/case-qualified alternative to generic Studio agent execution.
 * Generic built-in routes cannot establish this application's resource scope;
 * this endpoint authenticates a staff user, checks the durable case, and gives
 * the registered supervisor only read authority for that one case. */

export const supportCaseFeedbackRoute = registerApiRoute(
  "/support/cases/:caseId/feedback",
  {
    method: "POST",
    handler: async (c) => {
      const caseId = c.req.param("caseId");
      const supportCase = await caseStore.get(caseId);
      if (!supportCase) return c.json({ error: "Case not found." }, 404);
      const current = caseScope(c, supportCase);
      if (current instanceof Response) return current;
      if (isRetentionTombstone(supportCase))
        return c.json(
          errorResponseSchema.parse({
            error: "This expired support case cannot accept new content.",
          }),
          410,
        );

      let body: {
        rating?: string;
        comment?: string;
        responseMessageId?: string;
      } = {};
      try {
        body = await c.req.json();
      } catch {
        return c.json(
          errorResponseSchema.parse({ error: "Invalid JSON body." }),
          400,
        );
      }

      const parsed = feedbackRequestSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          errorResponseSchema.parse({
            error: "rating must be 'up' or 'down'.",
          }),
          400,
        );
      }

      const ratedTurn = (await caseStore.turns(caseId)).find(
        (turn) =>
          `msg_${caseId}_${turn.id}_final` === parsed.data.responseMessageId,
      );
      if (!ratedTurn)
        return c.json(
          errorResponseSchema.parse({
            error: "Feedback response was not found.",
          }),
          404,
        );
      const telemetry =
        ratedTurn.outcome?.telemetry &&
        typeof ratedTurn.outcome.telemetry === "object"
          ? (ratedTurn.outcome.telemetry as { traceId?: string })
          : undefined;
      const feedback: CaseFeedback = {
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        submittedAt: new Date().toISOString(),
        actorId: current.id,
        turnId: ratedTurn.id,
        runId: ratedTurn.runId,
        traceId: telemetry?.traceId,
      };
      const persistedFeedback = await caseStore.recordFeedback({
        caseId,
        turnId: ratedTurn.id,
        actorId: current.id,
        feedback,
      });
      const updated =
        supportCase.metadata.activeTurnId === ratedTurn.id
          ? await caseStore.update(caseId, { feedback: persistedFeedback })
          : supportCase;

      const mastra = c.get("mastra");
      if (persistedFeedback.traceId && mastra.observability.addFeedback) {
        try {
          await mastra.observability.addFeedback({
            traceId: persistedFeedback.traceId,
            feedback: {
              feedbackSource: "user",
              feedbackType: "thumbs",
              value: feedback.rating === "up" ? 1 : -1,
              // Free-form feedback is retained only in the case store. Do not
              // bypass the application redactor by exporting it as a span
              // payload; the rating and trace association are sufficient.
            },
          });
        } catch (error) {
          mastra
            .getLogger()
            ?.warn("Failed to forward case feedback to observability storage", {
              error,
              caseId,
            });
        }
      }

      return c.json(scopedCaseDto(updated, current));
    },
  },
);
