import { z } from 'zod/v4';

import type { ServerErrorCode } from './index';

/**
 * Metadata sent with each business error code, as `metadata` on the JSON error body.
 *
 * A code listed here always carries this shape (or nothing, when the schema is optional).
 * A code missing from this map never carries metadata. `HTTPException` and `handleError`
 * enforce these shapes at the throw site, and `generate:route-types` publishes them to
 * `@mastra/client-js` so clients can narrow `metadata` by switching on `code`.
 *
 * Never put internal limits or configuration (body size limits, lease holders, ...) here:
 * metadata is sent to every client.
 */

/** Ids from a `MastraError`'s `details` that core attaches; the keys depend on the throwing call site. */
const forwardedDetails = z.record(z.string(), z.unknown()).optional();

const datasetValidationErrors = z.array(z.object({ path: z.string(), code: z.string(), message: z.string() }));
const datasetItemField = z.enum(['input', 'groundTruth']);

export const SERVER_ERROR_METADATA_SCHEMAS = {
  AGENT_BUILDER_ACTION_INVALID: z.object({ actionId: z.string() }),
  AGENT_CONTROLLER_NOT_FOUND: z.object({ controllerId: z.string() }),
  AGENT_CONTROLLER_SESSION_NOT_STARTED: z.object({ sessionId: z.string() }),
  AGENT_CONTROLLER_THREAD_NOT_FOUND: z.object({ threadId: z.string() }),
  AGENT_MODEL_CONFIG_NOT_FOUND: z.object({ agentId: z.string(), modelConfigId: z.string() }),
  AGENT_MODEL_LIST_DYNAMIC: z.object({ agentId: z.string() }),
  AGENT_MODEL_LIST_REORDER_INVALID: z.object({ agentId: z.string() }),
  AGENT_NOT_FOUND: z.object({ agentId: z.string() }),
  AGENT_SKILL_NOT_FOUND: z.object({ skill: z.string() }),
  AGENT_VERSION_NOT_FOUND: z.object({ versionId: z.string(), agentId: z.string() }),
  AVATAR_TOO_LARGE: z.object({ byteLength: z.number() }),
  CHANNEL_PLATFORM_NOT_REGISTERED: z.object({ platform: z.string() }),
  CHANNEL_PROGRAMMATIC_CONNECTION_UNSUPPORTED: z.object({ platform: z.string() }),
  CONVERSATION_MEMORY_NOT_CONFIGURED: z.object({ agentId: z.string() }),
  CONVERSATION_NOT_FOUND: z.object({ conversationId: z.string() }),
  DATASET_ITEM_EXTERNAL_ID_INVALID: z.object({ field: z.string() }),
  DATASET_ITEM_VERSION_NOT_FOUND: z.object({ itemId: z.string(), datasetVersion: z.number() }),
  DYNAMIC_WORKFLOW_NOT_FOUND: z.object({ dynamicWorkflowId: z.string() }),
  MCP_CLIENT_VERSION_NOT_FOUND: z.object({ versionId: z.string(), mcpClientId: z.string() }),
  MCP_RESOURCES_UNSUPPORTED: z.object({ serverId: z.string() }),
  MCP_RESOURCE_NOT_FOUND: z.object({ uri: z.string(), serverId: z.string() }),
  MCP_SERVER_NOT_FOUND: z.object({ serverId: z.string() }),
  MCP_SERVER_VERSION_NOT_FOUND: z.object({ serverId: z.string(), version: z.string(), availableVersion: z.string() }),
  MCP_TOOLS_UNSUPPORTED: z.object({ serverId: z.string() }),
  MCP_TOOL_INPUT_INVALID: z.object({ serverId: z.string(), toolId: z.string() }),
  MCP_TOOL_NOT_FOUND: z.object({ toolId: z.string(), serverId: z.string() }),
  MEMORY_STORAGE_NOT_INITIALIZED: z.object({ agentId: z.string() }),
  MESSAGES_THREAD_AND_RESOURCE_REQUIRED: z.object({ invalidMessageCount: z.number() }),
  OBSERVABILITY_DELTA_POLLING_UNSUPPORTED: z.object({ endpoint: z.string() }),
  PERMISSION_DENIED: z.object({ requiredPermissions: z.array(z.string()) }),
  PLAN_NOT_FOUND: z.object({ path: z.string() }),
  PROCESSOR_PROVIDER_NOT_FOUND: z.object({ providerId: z.string() }),
  PROMPT_BLOCK_REFERENCE_UNPUBLISHED: z.object({ promptBlockIds: z.array(z.string()) }),
  PROMPT_BLOCK_REFERENCE_UNRESOLVED: z.object({ promptBlockIds: z.array(z.string()) }),
  PROMPT_BLOCK_VERSION_NOT_FOUND: z.object({ versionId: z.string(), promptBlockId: z.string() }),
  REQUEST_ARGUMENT_REQUIRED: z.object({ argument: z.string() }),
  RESPONSE_AGENT_MISMATCH: z.object({ responseId: z.string(), agentId: z.string() }),
  RESPONSE_NOT_FOUND: z.object({ responseId: z.string() }),
  SCORER_NOT_FOUND: z.object({ scorerName: z.string() }),
  SCORER_VERSION_NOT_FOUND: z.object({ versionId: z.string(), scorerId: z.string() }),
  SKILLS_REGISTRY_REQUEST_FAILED: z.object({ upstreamStatus: z.number() }),
  SKILLS_REGISTRY_SKILL_CONTENT_UNAVAILABLE: z.object({ skillName: z.string() }),
  SKILLS_REGISTRY_SKILL_NOT_FOUND: z.object({ skillName: z.string(), owner: z.string(), repo: z.string() }),
  SKILL_NAME_INVALID: z.object({ skillName: z.string() }),
  SKILL_PATH_MISSING_SKILL_FILE: z.object({ skillPath: z.string() }),
  SKILL_PATH_NOT_DIRECTORY: z.object({ skillPath: z.string() }),
  SKILL_PATH_NOT_FOUND: z.object({ skillPath: z.string() }),
  SKILL_PATH_OUTSIDE_ALLOWED_DIRECTORY: z.object({ skillPath: z.string() }),
  STORED_AGENT_ALREADY_EXISTS: z.object({ storedAgentId: z.string() }),
  STORED_AGENT_NOT_FOUND: z.object({ storedAgentId: z.string() }),
  STORED_MCP_CLIENT_ALREADY_EXISTS: z.object({ storedMCPClientId: z.string() }),
  STORED_MCP_CLIENT_NOT_FOUND: z.object({ storedMCPClientId: z.string() }),
  STORED_PROMPT_BLOCK_ALREADY_EXISTS: z.object({ storedPromptBlockId: z.string() }),
  STORED_PROMPT_BLOCK_NOT_FOUND: z.object({ storedPromptBlockId: z.string() }),
  STORED_SCORER_ALREADY_EXISTS: z.object({ storedScorerId: z.string() }),
  STORED_SCORER_NOT_FOUND: z.object({ storedScorerId: z.string() }),
  STORED_SKILL_ALREADY_EXISTS: z.object({ storedSkillId: z.string() }),
  STORED_SKILL_NOT_FOUND: z.object({ storedSkillId: z.string() }),
  STORED_WORKSPACE_ALREADY_EXISTS: z.object({ storedWorkspaceId: z.string() }),
  STORED_WORKSPACE_NOT_FOUND: z.object({ storedWorkspaceId: z.string() }),
  TOOL_PROVIDER_CONNECTION_NOT_FOUND: z.object({ connectionId: z.string(), providerId: z.string() }),
  TOOL_PROVIDER_CONNECTION_PINNED_BY_AGENTS: z.object({ connectionId: z.string(), agentCount: z.number() }),
  TOOL_PROVIDER_NOT_FOUND: z.object({ providerId: z.string() }),
  TOOL_PROVIDER_OPERATION_UNSUPPORTED: z.object({ providerId: z.string() }),
  TOOL_PROVIDER_TOOL_SCHEMA_NOT_FOUND: z.object({ toolSlug: z.string(), providerId: z.string() }),
  TRACE_BRANCH_NOT_FOUND: z.object({ spanId: z.string(), traceId: z.string() }),
  TRACE_NOT_FOUND: z.object({ traceId: z.string() }),
  VECTOR_STORE_NOT_FOUND: z.object({ vectorName: z.string() }),
  WORKFLOW_NOT_FOUND: z.object({ workflowId: z.string() }),
  WORKFLOW_RUN_ALREADY_FINISHED: z.object({ runId: z.string(), status: z.string() }),
  WORKSPACE_MOUNT_NOT_FOUND: z.object({ mount: z.string() }),
  WORKSPACE_MOUNT_READ_ONLY: z.object({ mount: z.string() }),
  WORKSPACE_PATH_ABSOLUTE_NOT_ALLOWED: z.object({ path: z.string() }),
  WORKSPACE_PATH_TRAVERSAL: z.object({ path: z.string() }),
  WORKSPACE_SKILL_NOT_FOUND: z.object({ skillName: z.string() }),
  WORKSPACE_SKILL_REFERENCE_NOT_FOUND: z.object({ path: z.string(), skill: z.string() }),

  // Shapes the static throw-site inventory can't infer (unions, nested arrays, optional fields).
  DATASET_ITEM_IDENTITY_CONFLICT: z.object({ conflicts: z.array(z.unknown()) }),
  DATASET_ITEM_SCHEMA_VALIDATION_FAILED: z.object({ field: datasetItemField, errors: datasetValidationErrors }),
  DATASET_SCHEMA_UPDATE_VALIDATION_FAILED: z.object({
    failingItems: z.array(
      z.object({ index: z.number(), data: z.unknown(), field: datasetItemField, errors: datasetValidationErrors }),
    ),
  }),
  FGA_AUTHORIZATION_DENIED: z.object({
    permission: z.union([z.string(), z.array(z.string())]),
    resourceType: z.string(),
    resourceId: z.string(),
  }),
  MASTRA_CORE_VERSION_UNSUPPORTED: z
    .object({ methodName: z.string().optional(), endpoint: z.string().optional() })
    .optional(),
  PROCESSOR_PHASE_UNSUPPORTED: z.object({ phase: z.string() }),
  WORKSPACE_PATH_NOT_FOUND: z.object({ path: z.string() }).optional(),

  // Framework: request validation, routing, rate limiting.
  REQUEST_VALIDATION_FAILED: z.object({ location: z.enum(['query', 'body', 'path']) }).optional(),
  ROUTE_NOT_FOUND: z.object({ method: z.string(), path: z.string() }).optional(),
  REQUEST_RATE_LIMIT_EXCEEDED: z.object({ retryAfter: z.number() }).optional(),

  // Agent builder model allowlist.
  MODEL_NOT_ALLOWED: z.object({
    allowed: z
      .array(z.object({ kind: z.literal('custom').optional(), provider: z.string(), modelId: z.string().optional() }))
      .optional(),
    attempted: z.object({
      provider: z.string(),
      modelId: z.string(),
      origin: z.enum([
        'static',
        'conditional-variant',
        'conditional-default',
        'runtime',
        'list',
        'sdk-instance',
        'openai-compatible',
      ]),
      label: z.string().optional(),
    }),
    offendingLabel: z.string(),
  }),

  // Voice routes (`@mastra/voice` internals), which fall back to `handleError` without metadata.
  AGENT_VOICE_NOT_CONFIGURED: z.object({ agentId: z.string() }),
  AGENT_SPEAK_FAILED: z.object({ agentId: z.string() }).optional(),

  // Core throws these ids without the fields below, and handlers forward the core id as the code,
  // so the metadata is only present when the server raised the error itself.
  DATASET_ITEM_NOT_FOUND: z.object({ itemId: z.string() }).optional(),
  EXPERIMENT_NOT_FOUND: z.object({ experimentId: z.string() }).optional(),
  PROCESSOR_WORKFLOW_FAILED: z
    .object({ processorId: z.string(), status: z.enum(['failed', 'suspended', 'paused']).optional() })
    .optional(),

  // Run-state conflicts and validation failures raised by core, forwarded with their `details`.
  WORKFLOW_RESUME_ALREADY_CLAIMED: forwardedDetails,
  AGENT_RESUME_ALREADY_CLAIMED: forwardedDetails,
  WORKFLOW_RUN_NOT_SUSPENDED: forwardedDetails,
  AGENT_RESUME_RUN_NOT_SUSPENDED: forwardedDetails,
  WORKFLOW_TIME_TRAVEL_ALREADY_CLAIMED: forwardedDetails,
  WORKFLOW_TIME_TRAVEL_RUN_RUNNING: forwardedDetails,
  DURABLE_AGENT_RUN_ACTIVE: forwardedDetails,
  DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY: forwardedDetails,
  DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS: forwardedDetails,
  DURABLE_AGENT_RECOVER_RUN_SUSPENDED: forwardedDetails,
  DURABLE_AGENT_EXECUTION_CONFLICT: forwardedDetails,
  OBSERVABILITY_UPDATE_FEEDBACK_REVIEW_STATUS_CONFLICT: forwardedDetails,
  WORKFLOW_SCHEMA_VALIDATION_FAILED: forwardedDetails,
} satisfies Partial<Record<ServerErrorCode, z.ZodType>>;

type MetadataSchemas = typeof SERVER_ERROR_METADATA_SCHEMAS;

/** Metadata of the error `code` `C`; `undefined` for codes that carry none. */
export type ServerErrorMetadata<C extends ServerErrorCode> = C extends keyof MetadataSchemas
  ? z.infer<MetadataSchemas[C]>
  : undefined;

/**
 * The `metadata` option for a throw of code `C`: required when the code always carries metadata,
 * optional when it may, absent otherwise. A non-literal `code` (typed as the whole catalog) accepts
 * any record, for the few sites that forward a code resolved at runtime.
 */
export type ServerErrorMetadataOption<C extends ServerErrorCode> = ServerErrorCode extends C
  ? { metadata?: Record<string, unknown> }
  : undefined extends ServerErrorMetadata<C>
    ? { metadata?: ServerErrorMetadata<C> }
    : { metadata: ServerErrorMetadata<C> };
