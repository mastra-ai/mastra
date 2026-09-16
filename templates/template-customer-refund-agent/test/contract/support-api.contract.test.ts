import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { SupportCase } from "../../src/mastra/domain/support-case";
import {
  errorResponseSchema,
  mockEmailPayloadSchema,
  supportOpenApiDocument,
} from "../../src/mastra/server/contracts";
import { caseStore } from "../../src/mastra/lib/case-store";
import { issueLocalSession } from "../../src/mastra/server/auth";
import {
  intercomWebhookRoute,
  stripeWebhookRoute,
  supportCaseApproveRoute,
  supportCaseDetailRoute,
  supportCaseFeedbackRoute,
  supportCaseFollowUpRoute,
  supportCaseRejectRoute,
  supportCasesListRoute,
  supportLoginRoute,
  supportMonitoringSummaryRoute,
  supportRoutes,
} from "../../src/mastra/server/routes";

const originalSource = process.env.SUPPORT_SOURCE;

afterEach(() => {
  if (originalSource === undefined) delete process.env.SUPPORT_SOURCE;
  else process.env.SUPPORT_SOURCE = originalSource;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("support API contract", () => {
  it("matches the complete normalized Zod-derived OpenAPI document", () => {
    expect(supportOpenApiDocument).toMatchSnapshot();
  });

  it("rejects an invalid inbound DTO without accepting a partial payload", () => {
    const result = mockEmailPayloadSchema.safeParse({
      externalId: "only-an-id",
    });

    expect(result.success).toBe(false);
  });

  it("documents every case-id path parameter in OpenAPI", () => {
    for (const path of [
      "/support/cases/{caseId}",
      "/support/cases/{caseId}/approve",
      "/support/cases/{caseId}/reject",
      "/support/cases/{caseId}/feedback",
      "/support/cases/{caseId}/manual-resolution",
    ]) {
      const operation =
        supportOpenApiDocument.paths[
          path as keyof typeof supportOpenApiDocument.paths
        ];
      const method = "get" in operation ? operation.get : operation.post;
      expect(method.parameters).toContainEqual(
        expect.objectContaining({ in: "path", name: "caseId", required: true }),
      );
    }
  });

  it("requires the immutable command fingerprint for both approval decisions", () => {
    for (const path of [
      "/support/cases/{caseId}/approve",
      "/support/cases/{caseId}/reject",
    ] as const) {
      const operation = supportOpenApiDocument.paths[path].post;
      expect(operation.requestBody.required).toBe(true);
      expect(operation.requestBody.content["application/json"].schema).toEqual(
        expect.objectContaining({ required: ["commandFingerprint"] }),
      );
      expect(Object.keys(operation.responses).sort()).toEqual([
        "200",
        "400",
        "401",
        "403",
        "404",
        "409",
        "500",
      ]);
    }
  });

  it("exercises actual HTTP handlers for public and approval error contracts", async () => {
    vi.stubEnv("SUPPORT_SOURCE", "mock");
    vi.stubEnv("COMMERCE_SOURCE", "mock");
    const app = new Hono();
    app.post("/support/auth/login", supportLoginRoute.handler);
    app.post("/support/webhooks/intercom", intercomWebhookRoute.handler);
    app.post("/support/webhooks/stripe", stripeWebhookRoute.handler);
    app.post("/support/cases/:caseId/approve", supportCaseApproveRoute.handler);
    app.post("/support/cases/:caseId/reject", supportCaseRejectRoute.handler);
    app.post(
      "/support/cases/:caseId/feedback",
      supportCaseFeedbackRoute.handler,
    );
    app.post(
      "/support/cases/:caseId/follow-ups",
      supportCaseFollowUpRoute.handler,
    );
    app.get(
      "/support/monitoring/summary",
      supportMonitoringSummaryRoute.handler,
    );
    vi.spyOn(caseStore, "get").mockResolvedValue({
      id: "waiting-case",
      customer: { email: "alex@example.com" },
      status: "waiting_approval",
      workflowRunId: "waiting-run",
      metadata: {
        ownerId: "customer-alex",
        providerBinding: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "waiting-case",
        },
      },
    } as never);
    const approverHeaders = {
      authorization: `Bearer ${issueLocalSession({ id: "approver-demo" })}`,
      "content-type": "application/json",
    };
    const customerHeaders = {
      authorization: `Bearer ${issueLocalSession({ id: "customer-alex" })}`,
      "content-type": "application/json",
    };
    const requests = [
      app.request("/support/auth/login", { method: "POST", body: "{" }),
      app.request("/support/webhooks/intercom", { method: "POST" }),
      app.request("/support/webhooks/stripe", { method: "POST" }),
      app.request("/support/cases/waiting-case/approve", {
        method: "POST",
        headers: approverHeaders,
        body: "{}",
      }),
      app.request("/support/cases/waiting-case/reject", {
        method: "POST",
        headers: approverHeaders,
        body: "{}",
      }),
      app.request("/support/cases/waiting-case/feedback", {
        method: "POST",
        headers: customerHeaders,
        body: "{}",
      }),
      app.request("/support/cases/waiting-case/follow-ups", {
        method: "POST",
        headers: customerHeaders,
        body: "{}",
      }),
      app.request("/support/monitoring/summary", {
        headers: {
          authorization: `Bearer ${issueLocalSession({ id: "support-agent-demo" })}`,
        },
      }),
    ];
    const [
      login,
      intercom,
      stripe,
      approve,
      reject,
      feedback,
      followUp,
      monitoring,
    ] = await Promise.all(requests);
    expect([login.status, intercom.status, stripe.status]).toEqual([
      400, 404, 404,
    ]);
    expect([approve.status, reject.status]).toEqual([400, 400]);
    expect([feedback.status, followUp.status, monitoring.status]).toEqual([
      400, 400, 403,
    ]);
    const responseOperations = [
      [login, "/support/auth/login"],
      [intercom, "/support/webhooks/intercom"],
      [stripe, "/support/webhooks/stripe"],
      [approve, "/support/cases/{caseId}/approve"],
      [reject, "/support/cases/{caseId}/reject"],
      [feedback, "/support/cases/{caseId}/feedback"],
      [followUp, "/support/cases/{caseId}/follow-ups"],
      [monitoring, "/support/monitoring/summary"],
    ] as const;
    const expectedErrorSchema = z.toJSONSchema(errorResponseSchema);
    for (const [response, path] of responseOperations) {
      const operation =
        supportOpenApiDocument.paths[
          path as keyof typeof supportOpenApiDocument.paths
        ];
      const method = "get" in operation ? operation.get : operation.post;
      const documented =
        method.responses[
          String(response.status) as keyof typeof method.responses
        ];
      expect(documented).toBeDefined();
      expect(documented?.content?.["application/json"].schema).toEqual(
        expectedErrorSchema,
      );
      expect(errorResponseSchema.safeParse(await response.json()).success).toBe(
        true,
      );
    }
  });

  it("keeps feedback correlation IDs on staff records but out of customer responses", async () => {
    const submittedAt = "2026-09-09T19:00:00.000Z";
    const feedback = {
      rating: "up" as const,
      comment: "The replacement arrived quickly.",
      submittedAt,
      actorId: "customer-alex",
      turnId: "turn-feedback",
      runId: "run-feedback",
      traceId: "trace-feedback",
    };
    const supportCase: SupportCase = {
      id: "feedback-case",
      externalId: "feedback-external",
      source: "mock-email" as const,
      customer: { email: "alex@example.com", name: "Alex Kim" },
      subject: "Feedback projection",
      messages: [],
      status: "resolved" as const,
      createdAt: submittedAt,
      updatedAt: submittedAt,
      feedback,
      metadata: {
        ownerId: "customer-alex",
        activeTurnId: "turn-feedback",
        providerBinding: {
          tenantId: "local-demo",
          providerKind: "local" as const,
          providerAccountId: "local-demo",
          externalConversationId: "feedback-conversation",
        },
      },
    };
    vi.spyOn(caseStore, "list").mockResolvedValue([supportCase]);
    vi.spyOn(caseStore, "get").mockResolvedValue(supportCase);
    vi.spyOn(caseStore, "turns").mockResolvedValue([
      {
        id: "turn-feedback",
        eventId: "event-feedback",
        sequence: 1,
        state: "resolved",
        runId: "run-feedback",
        outcome: { telemetry: { traceId: "trace-feedback" } },
      },
    ]);
    vi.spyOn(caseStore, "recordFeedback").mockResolvedValue(feedback);
    vi.spyOn(caseStore, "update").mockResolvedValue(supportCase);

    const app = new Hono();
    app.use("/support/*", async (c, next) => {
      c.set("mastra", {
        observability: {},
        getLogger: () => undefined,
      } as never);
      await next();
    });
    app.get("/support/cases", supportCasesListRoute.handler);
    app.get("/support/cases/:caseId", supportCaseDetailRoute.handler);
    app.post(
      "/support/cases/:caseId/feedback",
      supportCaseFeedbackRoute.handler,
    );
    const customerHeaders = {
      authorization: `Bearer ${issueLocalSession({ id: "customer-alex" })}`,
      "content-type": "application/json",
    };
    const customerResponses = await Promise.all([
      app.request("http://support.test/support/cases", {
        headers: customerHeaders,
      }),
      app.request("http://support.test/support/cases/feedback-case", {
        headers: customerHeaders,
      }),
      app.request("http://support.test/support/cases/feedback-case/feedback", {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          rating: "up",
          comment: feedback.comment,
          responseMessageId: "msg_feedback-case_turn-feedback_final",
        }),
      }),
    ]);
    const [list, detail, posted] = await Promise.all(
      customerResponses.map((response) => response.json()),
    );
    expect(customerResponses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    const expectedCustomerFeedback = {
      rating: feedback.rating,
      comment: feedback.comment,
      submittedAt,
    };
    expect(list.cases[0].feedback).toEqual(expectedCustomerFeedback);
    expect(detail.feedback).toEqual(expectedCustomerFeedback);
    expect(posted.feedback).toEqual(expectedCustomerFeedback);
    for (const response of [list.cases[0], detail, posted]) {
      expect(response.feedback).not.toHaveProperty("actorId");
      expect(response.feedback).not.toHaveProperty("turnId");
      expect(response.feedback).not.toHaveProperty("runId");
      expect(response.feedback).not.toHaveProperty("traceId");
    }
    expect(caseStore.recordFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: expect.objectContaining({
          actorId: "customer-alex",
          turnId: "turn-feedback",
          runId: "run-feedback",
          traceId: "trace-feedback",
        }),
      }),
    );

    const staff = await app.request(
      "http://support.test/support/cases/feedback-case",
      {
        headers: {
          authorization: `Bearer ${issueLocalSession({ id: "support-agent-demo" })}`,
        },
      },
    );
    expect((await staff.json()).feedback).toEqual(feedback);
  });

  it("exercises disabled, malformed, oversized, and unsigned webhook responses", async () => {
    const app = new Hono();
    app.post("/support/webhooks/intercom", intercomWebhookRoute.handler);
    app.post("/support/webhooks/stripe", stripeWebhookRoute.handler);

    vi.stubEnv("SUPPORT_SOURCE", "intercom");
    vi.stubEnv("INTERCOM_DEVELOPMENT_ENABLED", "true");
    vi.stubEnv("INTERCOM_TENANT_ID", "local-demo");
    vi.stubEnv("INTERCOM_APP_ID", "contract-app");
    vi.stubEnv("INTERCOM_ACCESS_TOKEN", "synthetic-access-token");
    vi.stubEnv("INTERCOM_CLIENT_SECRET", "synthetic-client-secret");
    vi.stubEnv("INTERCOM_ADMIN_ID", "contract-admin");
    vi.stubEnv("COMMERCE_SOURCE", "stripe");
    vi.stubEnv("STRIPE_SANDBOX_ENABLED", "true");
    vi.stubEnv("STRIPE_TENANT_ID", "local-demo");
    vi.stubEnv("STRIPE_ACCOUNT_ID", "acct_contract");
    vi.stubEnv("STRIPE_RESTRICTED_API_KEY", "rk_test_contract");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "synthetic-webhook-secret");

    const responses = [
      [
        "/support/webhooks/intercom",
        await app.request("/support/webhooks/intercom", { method: "POST" }),
      ],
      [
        "/support/webhooks/intercom",
        await app.request("/support/webhooks/intercom", {
          method: "POST",
          headers: { "content-length": "0" },
        }),
      ],
      [
        "/support/webhooks/intercom",
        await app.request("/support/webhooks/intercom", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
      ],
      [
        "/support/webhooks/stripe",
        await app.request("/support/webhooks/stripe", { method: "POST" }),
      ],
      [
        "/support/webhooks/stripe",
        await app.request("/support/webhooks/stripe", {
          method: "POST",
          headers: { "content-length": "0" },
        }),
      ],
      [
        "/support/webhooks/stripe",
        await app.request("/support/webhooks/stripe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
      ],
    ] as const;
    expect(responses.map(([, response]) => response.status)).toEqual([
      400, 413, 401, 400, 413, 401,
    ]);
    const expectedErrorSchema = z.toJSONSchema(errorResponseSchema);
    for (const [path, response] of responses) {
      const operation = supportOpenApiDocument.paths[path].post;
      const documented =
        operation.responses[
          String(response.status) as keyof typeof operation.responses
        ];
      expect(documented?.content?.["application/json"].schema).toEqual(
        expectedErrorSchema,
      );
      expect(errorResponseSchema.safeParse(await response.json()).success).toBe(
        true,
      );
    }
  });

  it("preserves contextual error results in the documented Zod response schema", () => {
    const parsed = errorResponseSchema.parse({
      error: "Resolution failed after resume.",
      result: { status: "failed" },
    });
    expect(parsed.result).toEqual({ status: "failed" });
    const errorSchema = z.toJSONSchema(errorResponseSchema);
    expect(errorSchema.properties).toHaveProperty("result");
    expect(errorSchema.additionalProperties).toEqual({});
  });

  it("keeps registered route methods and documented success response schemas in OpenAPI", () => {
    const registeredRoutes = supportRoutes.map((route) => ({
      method: route.method.toLowerCase(),
      path: route.path.replace(/:([^/]+)/g, "{$1}"),
    }));

    expect(Object.keys(supportOpenApiDocument.paths).sort()).toEqual(
      [...new Set(registeredRoutes.map((route) => route.path))].sort(),
    );
    for (const { method, path } of registeredRoutes) {
      const operation =
        supportOpenApiDocument.paths[
          path as keyof typeof supportOpenApiDocument.paths
        ];
      const operationForMethod = operation[
        method as keyof typeof operation
      ] as { responses: Record<string, { content?: unknown }> };
      expect(
        Object.entries(operationForMethod.responses).some(
          ([status, response]) =>
            status.startsWith("2") && response.content !== undefined,
        ),
      ).toBe(true);
      expect(operationForMethod).toHaveProperty("responses");
    }
  });

  it("documents every handler's explicit JSON status surface", () => {
    const expectedStatuses = {
      "/support/auth/login": ["200", "400", "401"],
      "/support/inbound": ["200", "400", "401", "403", "410", "500"],
      "/support/webhooks/intercom": [
        "200",
        "400",
        "401",
        "404",
        "413",
        "500",
        "503",
      ],
      "/support/webhooks/stripe": [
        "200",
        "400",
        "401",
        "404",
        "413",
        "500",
        "503",
      ],
      "/support/cases": ["200", "401"],
      "/support/cases/{caseId}": ["200", "401", "403", "404"],
      "/support/cases/{caseId}/approve": [
        "200",
        "400",
        "401",
        "403",
        "404",
        "409",
        "500",
      ],
      "/support/cases/{caseId}/reject": [
        "200",
        "400",
        "401",
        "403",
        "404",
        "409",
        "500",
      ],
      "/support/cases/{caseId}/supervisor": [
        "200",
        "400",
        "401",
        "403",
        "404",
        "409",
        "422",
        "503",
      ],
      "/support/cases/{caseId}/feedback": [
        "200",
        "400",
        "401",
        "403",
        "404",
        "410",
      ],
      "/support/cases/{caseId}/follow-ups": [
        "200",
        "400",
        "401",
        "403",
        "404",
        "409",
        "410",
        "500",
      ],
      "/support/cases/{caseId}/manual-resolution": ["200", "401", "403", "404"],
      "/support/knowledge/reindex": ["200", "400", "401", "403", "500"],
      "/support/monitoring/summary": ["200", "401", "403"],
      "/support/openapi.json": ["200", "401"],
    } as const;
    for (const [path, expected] of Object.entries(expectedStatuses)) {
      const operation =
        supportOpenApiDocument.paths[
          path as keyof typeof supportOpenApiDocument.paths
        ];
      const method = "get" in operation ? operation.get : operation.post;
      expect(Object.keys(method.responses).sort()).toEqual(expected);
      for (const [status, response] of Object.entries(method.responses)) {
        expect(response.content?.["application/json"]).toBeDefined();
        if (!status.startsWith("2"))
          expect(response.content?.["application/json"].schema).toEqual(
            expect.objectContaining({ properties: expect.any(Object) }),
          );
      }
    }
    const manual =
      supportOpenApiDocument.paths["/support/cases/{caseId}/manual-resolution"]
        .post;
    expect(Object.keys(manual.responses).sort()).toEqual([
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
    ]);
  });

  it("documents the local bearer boundary and explicit public exceptions", () => {
    expect(supportOpenApiDocument.components.securitySchemes).toEqual({
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Local session",
      },
    });
    for (const path of [
      "/support/auth/login",
      "/support/webhooks/intercom",
      "/support/webhooks/stripe",
    ]) {
      const operation =
        supportOpenApiDocument.paths[
          path as keyof typeof supportOpenApiDocument.paths
        ];
      const method = "get" in operation ? operation.get : operation.post;
      expect(method.security).toEqual([]);
    }
    for (const { path } of supportRoutes) {
      if (
        [
          "/support/auth/login",
          "/support/webhooks/intercom",
          "/support/webhooks/stripe",
        ].includes(path)
      )
        continue;
      const documentedPath = path.replace(
        /:([^/]+)/g,
        "{$1}",
      ) as keyof typeof supportOpenApiDocument.paths;
      const operation = supportOpenApiDocument.paths[documentedPath];
      const method = "get" in operation ? operation.get : operation.post;
      expect(method.security).toBeUndefined();
      expect(supportOpenApiDocument.security).toEqual([{ bearerAuth: [] }]);
    }
  });
});
