import { z } from "zod";
import {
  caseFeedbackSchema,
  customerFinancialRequestSchema,
  publicSupportCaseSchema,
} from "../domain/support-case";

export const mockEmailPayloadSchema = z
  .object({
    externalId: z.string().min(1),
    from: z.email(),
    fromName: z.string().min(1).optional(),
    subject: z.string().optional(),
    body: z.string().min(1),
    conversationId: z.string().min(1).max(200).optional(),
    receivedAt: z.iso.datetime().optional(),
  })
  .strict();

export const inboundSupportResponseSchema = z.object({
  caseId: z.string(),
  workflowRunId: z.string().optional(),
  status: z.literal("processing"),
});

export const caseListResponseSchema = z.object({
  cases: z.array(publicSupportCaseSchema),
});
export const customerFinancialRequestsResponseSchema = z.object({
  requests: z.array(customerFinancialRequestSchema),
});
export const approvalRequestSchema = z.object({
  commandFingerprint: z.string().min(1),
  note: z.string().max(2_000).optional(),
  serviceProblemConfirmed: z.literal(true).optional(),
});
export const followUpRequestSchema = z.object({
  body: z.string().min(1).max(10_000),
});
export const manualResolutionRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    expectedTurnId: z.string().min(1).max(200),
    idempotencyKey: z.string().min(16).max(200),
    internalNote: z.string().min(1).max(4_000),
  })
  .strict();
export const manualResolutionContextSchema = z.object({
  version: z.number().int().positive(),
  activeTurnId: z.string().optional(),
  receipt: z
    .object({
      id: z.string(),
      actorId: z.string(),
      turnId: z.string(),
      createdAt: z.string(),
      noteState: z.string(),
      closeState: z.string(),
    })
    .optional(),
});
export const manualResolutionResponseSchema = z.object({
  case: publicSupportCaseSchema,
  context: manualResolutionContextSchema,
  replayed: z.boolean(),
});

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(256),
});
export const loginResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  principal: z.object({
    id: z.string(),
    email: z.email(),
    tenantId: z.string(),
    roles: z.array(z.enum(["customer", "support-agent", "approver", "admin"])),
  }),
});
export const feedbackRequestSchema = caseFeedbackSchema
  .pick({
    rating: true,
    comment: true,
  })
  .extend({ responseMessageId: z.string().min(1) });
export const errorResponseSchema = z
  .object({ error: z.string(), result: z.unknown().optional() })
  .passthrough();
export const reindexResponseSchema = z.object({
  indexed: z.number().int().nonnegative(),
});
export const validationRequestSchema = z.object({
  // This is intentionally an explicit alternate execution mode. Ordinary
  // application requests do not inherit validation accounting.
  mode: z.literal("sandbox"),
});
export const supervisorExecutionRequestSchema = z.object({
  message: z.string().min(1).max(10_000),
  validation: validationRequestSchema.optional(),
});
export const reindexRequestSchema = z.object({
  validation: validationRequestSchema.optional(),
});
export const supervisorExecutionResponseSchema = z.object({
  text: z.string(),
  traceId: z.string().optional(),
  toolNames: z.array(z.string()),
  // Staff can inspect the read-only evidence their authorized supervisor run
  // actually observed. This deliberately exposes no command or approval data.
  toolResults: z.array(
    z.object({
      toolName: z.string(),
      result: z.unknown().optional(),
      isError: z.boolean(),
    }),
  ),
});
export const monitoringSummarySchema = z.object({
  generatedAt: z.iso.datetime(),
  casesConsidered: z.number().int().nonnegative(),
  funnel: z.object({
    totalCases: z.number().int().nonnegative(),
    new: z.number().int().nonnegative(),
    processing: z.number().int().nonnegative(),
    waitingApproval: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    escalated: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    containmentRate: z.number().nullable(),
    escalationRate: z.number().nullable(),
    avgResolutionMinutes: z.number().nullable(),
  }),
  refunds: z.object({
    recommended: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    autoEscalated: z.number().int().nonnegative(),
    approvalRate: z.number().nullable(),
    executed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    executedTotals: z.array(
      z.object({ currency: z.string(), minor: z.number().int().nonnegative() }),
    ),
  }),
  feedback: z.object({
    totalResponses: z.number().int().nonnegative(),
    up: z.number().int().nonnegative(),
    down: z.number().int().nonnegative(),
    satisfactionRate: z.number().nullable(),
    recent: z.array(
      z.object({
        caseId: z.string(),
        subject: z.string(),
        rating: z.enum(["up", "down"]),
        submittedAt: z.iso.datetime(),
        turnId: z.string().optional(),
        runId: z.string().optional(),
        traceId: z.string().optional(),
      }),
    ),
  }),
  telemetry: z.object({
    observedTraces: z.number().int().nonnegative(),
    observedSpans: z.number().int().nonnegative(),
    providerOrToolErrorRate: z.number().nullable(),
    providerOrToolP95Ms: z.number().nullable(),
    modelUsage: z.array(
      z.object({
        model: z.string(),
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
        estimatedCostMicrosUsd: z.number().nullable(),
      }),
    ),
    workflowStages: z.array(
      z.object({
        operation: z.string(),
        calls: z.number().int().nonnegative(),
        errorRate: z.number().nullable(),
        p95Ms: z.number().nullable(),
      }),
    ),
    providerCalls: z.array(
      z.object({
        operation: z.string(),
        calls: z.number().int().nonnegative(),
        errorRate: z.number().nullable(),
        p95Ms: z.number().nullable(),
      }),
    ),
    toolCalls: z.array(
      z.object({
        operation: z.string(),
        calls: z.number().int().nonnegative(),
        errorRate: z.number().nullable(),
        p95Ms: z.number().nullable(),
      }),
    ),
    unavailable: z.array(z.string()),
    alerts: z.array(z.string()),
  }),
  failures: z.object({
    rejectedDecisions: z.number().int().nonnegative(),
    workflow: z.number().int().nonnegative(),
    financial: z.number().int().nonnegative(),
    delivery: z.number().int().nonnegative(),
  }),
});

const caseIdParameter = {
  name: "caseId",
  in: "path",
  required: true,
  schema: { type: "string" },
} as const;

const jsonSchema = (schema: z.core.$ZodType) => z.toJSONSchema(schema);
const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": { schema: jsonSchema(errorResponseSchema) },
  },
});

/** A derived OpenAPI 3.1 document used by the local route and contract checks. */
export const supportOpenApiDocument = {
  openapi: "3.1.0",
  info: { title: "Support demo API", version: "0.1.0" },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Local session",
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/support/auth/login": {
      post: {
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: jsonSchema(loginRequestSchema) },
          },
        },
        responses: {
          "200": {
            description: "Authenticated local session",
            content: {
              "application/json": { schema: jsonSchema(loginResponseSchema) },
            },
          },
          "401": {
            ...errorResponse("Invalid credentials"),
          },
          "400": {
            ...errorResponse("Invalid JSON or credentials payload"),
          },
        },
      },
    },
    "/support/inbound": {
      post: {
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: jsonSchema(mockEmailPayloadSchema) },
          },
        },
        responses: {
          "200": {
            description: "Ingestion accepted",
            content: {
              "application/json": {
                schema: jsonSchema(inboundSupportResponseSchema),
              },
            },
          },
          "400": {
            ...errorResponse("Invalid inbound payload"),
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
          "403": {
            ...errorResponse("Caller cannot create this case"),
          },
          "410": {
            ...errorResponse("Expired case cannot accept new content"),
          },
          "500": {
            ...errorResponse("Ingestion could not complete"),
          },
        },
      },
    },
    "/support/webhooks/intercom": {
      post: {
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": {
            description: "Verified provider event accepted or ignored",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "401": {
            ...errorResponse("Invalid webhook signature or payload"),
          },
          "400": {
            ...errorResponse("Malformed webhook body"),
          },
          "404": {
            ...errorResponse("Intercom adapter is not enabled"),
          },
          "413": {
            ...errorResponse("Webhook body exceeds the accepted size"),
          },
          "500": {
            ...errorResponse("Webhook transport is unavailable"),
          },
          "503": {
            ...errorResponse("Verified event could not be persisted"),
          },
        },
      },
    },
    "/support/webhooks/stripe": {
      post: {
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": {
            description: "Verified Stripe event accepted or ignored",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "401": {
            ...errorResponse("Invalid Stripe webhook signature or payload"),
          },
          "400": {
            ...errorResponse("Malformed webhook body"),
          },
          "404": {
            ...errorResponse("Stripe adapter is not enabled"),
          },
          "413": {
            ...errorResponse("Webhook body exceeds the accepted size"),
          },
          "500": {
            ...errorResponse("Webhook transport is unavailable"),
          },
          "503": {
            ...errorResponse("Verified Stripe event could not be reconciled"),
          },
        },
      },
    },
    "/support/cases": {
      get: {
        responses: {
          "200": {
            description: "Case inbox",
            content: {
              "application/json": {
                schema: jsonSchema(caseListResponseSchema),
              },
            },
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
        },
      },
    },
    "/support/customer/financial-requests": {
      get: {
        responses: {
          "200": {
            description:
              "Customer-scoped historical refund and subscription-credit request statuses",
            content: {
              "application/json": {
                schema: jsonSchema(customerFinancialRequestsResponseSchema),
              },
            },
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
          "403": {
            ...errorResponse("Only a customer may read this projection"),
          },
        },
      },
    },
    "/support/cases/{caseId}": {
      get: {
        parameters: [caseIdParameter],
        responses: {
          "200": {
            description: "Support case",
            content: {
              "application/json": {
                schema: jsonSchema(publicSupportCaseSchema),
              },
            },
          },
          "404": {
            ...errorResponse("Case was not found"),
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
          "403": {
            ...errorResponse("Caller cannot access this case"),
          },
        },
      },
    },
    "/support/cases/{caseId}/approve": {
      post: {
        parameters: [caseIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: jsonSchema(approvalRequestSchema) },
          },
        },
        responses: {
          "200": {
            description: "Updated support case",
            content: {
              "application/json": {
                schema: jsonSchema(publicSupportCaseSchema),
              },
            },
          },
          "400": {
            ...errorResponse("Invalid approval payload"),
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
          "403": {
            ...errorResponse("Caller is not an authorized approver"),
          },
          "404": {
            ...errorResponse("Case was not found"),
          },
          "409": {
            ...errorResponse("Approval command or workflow state is stale"),
          },
          "500": {
            ...errorResponse("Approval resume failed"),
          },
        },
      },
    },
    "/support/cases/{caseId}/reject": {
      post: {
        parameters: [caseIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: jsonSchema(approvalRequestSchema) },
          },
        },
        responses: {
          "200": {
            description: "Updated support case",
            content: {
              "application/json": {
                schema: jsonSchema(publicSupportCaseSchema),
              },
            },
          },
          "400": {
            ...errorResponse("Invalid approval payload"),
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
          "403": {
            ...errorResponse("Caller is not an authorized approver"),
          },
          "404": {
            ...errorResponse("Case was not found"),
          },
          "409": {
            ...errorResponse("Approval command or workflow state is stale"),
          },
          "500": {
            ...errorResponse("Approval resume failed"),
          },
        },
      },
    },
    "/support/cases/{caseId}/supervisor": {
      post: {
        parameters: [caseIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: jsonSchema(supervisorExecutionRequestSchema),
            },
          },
        },
        responses: {
          "200": {
            description: "Authenticated read-only supervisor response",
            content: {
              "application/json": {
                schema: jsonSchema(supervisorExecutionResponseSchema),
              },
            },
          },
          "400": {
            ...errorResponse("Invalid supervisor request"),
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
          "403": {
            ...errorResponse("Caller cannot run the supervisor for this case"),
          },
          "404": {
            ...errorResponse("Case was not found"),
          },
          "409": {
            ...errorResponse("Case is missing verified owner evidence"),
          },
          "422": {
            ...errorResponse("Validation budget blocked the supervisor run"),
          },
          "503": {
            ...errorResponse("Supervisor trace correlation was unavailable"),
          },
        },
      },
    },
    "/support/cases/{caseId}/feedback": {
      post: {
        parameters: [caseIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: jsonSchema(feedbackRequestSchema) },
          },
        },
        responses: {
          "200": {
            description: "Updated support case",
            content: {
              "application/json": {
                schema: jsonSchema(publicSupportCaseSchema),
              },
            },
          },
          "400": {
            ...errorResponse("Invalid feedback payload"),
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
          "403": {
            ...errorResponse("Caller cannot access this case"),
          },
          "404": {
            ...errorResponse("Case or response message was not found"),
          },
          "410": {
            ...errorResponse("Expired case cannot accept new content"),
          },
        },
      },
    },
    "/support/cases/{caseId}/follow-ups": {
      post: {
        parameters: [caseIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: jsonSchema(followUpRequestSchema) },
          },
        },
        responses: {
          "200": {
            description: "Appended authorized customer follow-up",
            content: {
              "application/json": {
                schema: jsonSchema(publicSupportCaseSchema),
              },
            },
          },
          "400": {
            ...errorResponse("Invalid follow-up payload"),
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
          "403": {
            ...errorResponse("Caller cannot append to this case"),
          },
          "404": {
            ...errorResponse("Case was not found"),
          },
          "409": {
            ...errorResponse("Follow-up dispatch lease was lost"),
          },
          "410": {
            ...errorResponse("Expired case cannot accept new content"),
          },
          "500": {
            ...errorResponse("Follow-up resolution failed"),
          },
        },
      },
    },
    "/support/cases/{caseId}/manual-resolution": {
      get: {
        parameters: [caseIdParameter],
        responses: {
          "200": {
            description:
              "Manual-resolution delivery receipt and active version",
            content: {
              "application/json": {
                schema: jsonSchema(manualResolutionContextSchema),
              },
            },
          },
          "401": { ...errorResponse("Authentication required") },
          "403": { ...errorResponse("Caller is not authorized staff") },
          "404": { ...errorResponse("Case was not found") },
        },
      },
      post: {
        parameters: [caseIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: jsonSchema(manualResolutionRequestSchema),
            },
          },
        },
        responses: {
          "200": {
            description: "Manually resolved case and Intercom delivery receipt",
            content: {
              "application/json": {
                schema: jsonSchema(manualResolutionResponseSchema),
              },
            },
          },
          "400": { ...errorResponse("Invalid manual-resolution payload") },
          "401": { ...errorResponse("Authentication required") },
          "403": { ...errorResponse("Caller is not authorized staff") },
          "404": { ...errorResponse("Case was not found") },
          "409": { ...errorResponse("Case version or active turn is stale") },
        },
      },
    },
    "/support/knowledge/reindex": {
      post: {
        requestBody: {
          required: false,
          content: {
            "application/json": { schema: jsonSchema(reindexRequestSchema) },
          },
        },
        responses: {
          "200": {
            description: "Knowledge indexed",
            content: {
              "application/json": { schema: jsonSchema(reindexResponseSchema) },
            },
          },
          "500": {
            ...errorResponse("Indexing failed"),
          },
          "400": {
            ...errorResponse("Invalid reindex request"),
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
          "403": {
            ...errorResponse("Caller is not an administrator"),
          },
        },
      },
    },
    "/support/monitoring/summary": {
      get: {
        responses: {
          "200": {
            description: "Support monitoring summary",
            content: {
              "application/json": {
                schema: jsonSchema(monitoringSummarySchema),
              },
            },
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
          "403": {
            ...errorResponse("Caller is not an administrator"),
          },
        },
      },
    },
    "/support/openapi.json": {
      get: {
        responses: {
          "200": {
            description: "OpenAPI document",
            content: {
              "application/json": { schema: jsonSchema(z.unknown()) },
            },
          },
          "401": {
            ...errorResponse("Authentication required"),
          },
        },
      },
    },
  },
} as const;

export type MockEmailPayload = z.infer<typeof mockEmailPayloadSchema>;
export type SupportCaseDto = z.infer<typeof publicSupportCaseSchema>;
export type CaseListResponse = z.infer<typeof caseListResponseSchema>;
export type InboundSupportResponse = z.infer<
  typeof inboundSupportResponseSchema
>;
export type MonitoringSummaryResponse = z.infer<typeof monitoringSummarySchema>;
