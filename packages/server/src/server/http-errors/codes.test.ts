import { describe, expect, it } from 'vitest';

import { MASTRA_ERROR_CODES, isMastraErrorCode } from './codes';

const GENERIC_HTTP_STATUS_NAMES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'INTERNAL_ERROR',
  'INTERNAL_SERVER_ERROR',
  'NOT_IMPLEMENTED',
  'SERVICE_UNAVAILABLE',
];

describe('MASTRA_ERROR_CODES catalogue', () => {
  const entries = Object.entries(MASTRA_ERROR_CODES);

  it('is not empty', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  describe('given every code in the catalogue', () => {
    it.each(entries)('%s is SCREAMING_SNAKE_CASE', code => {
      expect(code).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
    });

    it.each(entries)('%s is a plain string equal to its key, so a frontend can switch on it', (key, value) => {
      expect(typeof value).toBe('string');
      expect(value).toBe(key);
    });
  });

  describe('given the HTTP status already conveys the generic category', () => {
    it('does not define codes that merely restate an HTTP status', () => {
      for (const generic of GENERIC_HTTP_STATUS_NAMES) {
        expect(Object.keys(MASTRA_ERROR_CODES)).not.toContain(generic);
      }
    });
  });

  describe('given the business codes a frontend relies on', () => {
    it('exposes exactly the expected codes', () => {
      expect(Object.keys(MASTRA_ERROR_CODES).sort()).toEqual(
        [
          'AGENT_NOT_FOUND',
          'MODEL_NOT_ALLOWED',
          'NO_MODEL_SELECTED',
          'WORKFLOW_NOT_FOUND',
          'WORKFLOW_RUN_NOT_FOUND',
          'WORKFLOW_RUN_ACCESS_DENIED',
          'WORKFLOW_SCHEMA_VALIDATION_FAILED',
          'WORKFLOW_RESUME_ALREADY_CLAIMED',
          'RUN_ID_REQUIRED',
          'DURABLE_RUN_ACTIVE',
          'DURABLE_RUN_RECOVERY_IN_PROGRESS',
          'DURABLE_RUN_SUSPENDED',
          'DURABLE_RUN_EXECUTION_CONFLICT',
          'DURABLE_RUN_ACCESS_DENIED',
          'THREAD_NOT_FOUND',
          'THREAD_ACCESS_DENIED',
          'TOOL_NOT_FOUND',
          'PROCESSOR_NOT_FOUND',
          'WORKSPACE_NOT_FOUND',
          'SCHEDULE_NOT_FOUND',
          'BACKGROUND_TASK_NOT_FOUND',
          'PLAN_CAPABILITY_NOT_FOUND',
          'STORAGE_NOT_CONFIGURED',
          'STORAGE_DOMAIN_UNAVAILABLE',
          'OBSERVABILITY_FEATURE_NOT_IMPLEMENTED',
          'FEEDBACK_REVIEW_STATUS_CONFLICT',
          'INVALID_REQUEST_BODY',
          'INVALID_QUERY_PARAMS',
          'INVALID_PATH_PARAMS',
          'TRACE_QUERY_INVALID',
          'TRACE_QUERY_CURSOR_MALFORMED',
          'TRACE_QUERY_CURSOR_CONFLICT',
          'TRACE_QUERY_UNSUPPORTED',
          'TRACE_QUERY_DISCOVERY_UNSUPPORTED',
          'TRACE_AGGREGATE_UNSUPPORTED',
          'SPAN_QUERY_UNSUPPORTED',
          'TRACE_QUERY_EXECUTION_TIMEOUT',
          'TRACE_QUERY_RESOURCE_LIMIT',
          'CORE_VERSION_UNSUPPORTED',
          'MASTRA_INSTANCE_UNAVAILABLE',
          'EDITOR_NOT_CONFIGURED',
          'SERVER_CACHE_UNAVAILABLE',
          'ENDPOINT_DEPRECATED',
          'ROUTE_NOT_FOUND',
          'RESOURCE_NOT_FOUND',
          'RESOURCE_ID_DERIVATION_FAILED',
          'STORED_RESOURCE_RESOLUTION_FAILED',
          'STORED_RESOURCE_SCOPE_REQUIRED',
          'STORED_RESOURCE_NOT_FOUND',
          'VERSION_ACTIVE_DELETE_FORBIDDEN',
          'AUTHENTICATION_REQUIRED',
          'AUTH_FEATURE_NOT_CONFIGURED',
          'SESSION_NOT_FOUND',
          'SESSION_EXPIRED',
          'INVALID_CREDENTIALS',
          'ACCOUNT_CREATION_FAILED',
          'ADMIN_ACCESS_REQUIRED',
          'AGENT_INVALID_REQUEST',
          'AGENT_ALREADY_EXISTS',
          'AGENT_INSTRUCTIONS_REQUIRED',
          'AGENT_RECOVER_UNSUPPORTED',
          'AGENT_MODEL_LIST_EMPTY',
          'AGENT_VERSION_NOT_FOUND',
          'AGENT_BUILDER_ACTION_INVALID',
          'MODEL_CONFIG_NOT_FOUND',
          'MODEL_API_KEY_MISSING',
          'MODEL_RESOLUTION_FAILED',
          'AVATAR_INVALID',
          'AVATAR_TOO_LARGE',
          'SOURCE_CONTROL_CHANGE_REQUESTS_UNSUPPORTED',
          'PROMPT_BLOCK_NOT_FOUND',
          'PROMPT_BLOCK_ALREADY_EXISTS',
          'PROMPT_BLOCK_VERSION_NOT_FOUND',
          'PROMPT_BLOCK_REFERENCES_UNRESOLVED',
          'PROMPT_BLOCK_REFERENCES_UNPUBLISHED',
          'SCORER_NOT_FOUND',
          'SCORER_ALREADY_EXISTS',
          'SCORER_VERSION_NOT_FOUND',
          'MCP_CLIENT_NOT_FOUND',
          'MCP_CLIENT_ALREADY_EXISTS',
          'MCP_CLIENT_VERSION_NOT_FOUND',
          'MCP_SERVER_NOT_FOUND',
          'MCP_SERVER_VERSION_NOT_FOUND',
          'MCP_SERVER_OPERATION_UNSUPPORTED',
          'MCP_TOOL_NOT_FOUND',
          'MCP_TOOL_INVALID_INPUT',
          'MCP_RESOURCE_NOT_FOUND',
          'TOOL_INVALID_REQUEST',
          'TOOL_NOT_EXECUTABLE',
          'TOOL_SCHEMA_NOT_FOUND',
          'TOOL_PROVIDER_NOT_FOUND',
          'TOOL_PROVIDER_OPERATION_UNSUPPORTED',
          'TOOL_PROVIDER_CONNECTION_INVALID',
          'TOOL_PROVIDER_CONNECTION_NOT_FOUND',
          'TOOL_PROVIDER_CONNECTION_ACCESS_DENIED',
          'TOOL_PROVIDER_CONNECTION_IN_USE',
          'PROCESSOR_INVALID_REQUEST',
          'PROCESSOR_PHASE_UNSUPPORTED',
          'PROCESSOR_EXECUTION_FAILED',
          'PROCESSOR_PROVIDER_NOT_FOUND',
          'WORKFLOW_INVALID_REQUEST',
          'WORKFLOW_RUN_ALREADY_FINISHED',
          'WORKFLOW_OBSERVE_FAILED',
          'WORKFLOW_BUILDER_DISABLED',
          'MEMORY_NOT_CONFIGURED',
          'MEMORY_STORAGE_UNAVAILABLE',
          'MEMORY_INVALID_REQUEST',
          'MEMORY_OPERATION_UNSUPPORTED',
          'OBSERVATIONAL_MEMORY_NOT_ENABLED',
          'MESSAGE_ACCESS_DENIED',
          'THREAD_TRANSFER_FORBIDDEN',
          'CONVERSATION_NOT_FOUND',
          'RESPONSE_INVALID_REQUEST',
          'STORED_RESPONSE_NOT_FOUND',
          'STORED_RESPONSE_AGENT_MISMATCH',
          'CHANNEL_NOT_FOUND',
          'CHANNEL_OPERATION_UNSUPPORTED',
          'DATASET_NOT_FOUND',
          'DATASET_ITEM_NOT_FOUND',
          'DATASET_SCHEMA_VALIDATION_FAILED',
          'DATASET_SCHEMA_PATTERN_UNSUPPORTED',
          'DATASET_ITEM_IDENTITY_CONFLICT',
          'DATASET_ITEM_EXTERNAL_ID_INVALID',
          'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
          'EXPERIMENT_NOT_FOUND',
          'EXPERIMENT_NO_ITEMS',
          'EXPERIMENT_TARGET_REQUIRED',
          'EXPERIMENT_TARGET_INVALID',
          'EXPERIMENT_TARGET_NOT_FOUND',
          'EXPERIMENT_ID_CONFLICT',
          'EXPERIMENT_ALREADY_FINALIZED',
          'TRACE_NOT_FOUND',
          'SPAN_NOT_FOUND',
          'VECTOR_STORE_NOT_FOUND',
          'VECTOR_INVALID_REQUEST',
          'WORKSPACE_ALREADY_EXISTS',
          'WORKSPACE_INVALID_REQUEST',
          'WORKSPACE_FILESYSTEM_NOT_CONFIGURED',
          'WORKSPACE_SEARCH_NOT_CONFIGURED',
          'WORKSPACE_SKILLS_NOT_CONFIGURED',
          'WORKSPACE_PATH_NOT_FOUND',
          'WORKSPACE_PERMISSION_DENIED',
          'WORKSPACE_MOUNT_NOT_FOUND',
          'WORKSPACE_READ_ONLY',
          'PLAN_NOT_FOUND',
          'PLAN_PATH_INVALID',
          'SKILL_NOT_FOUND',
          'SKILL_ALREADY_EXISTS',
          'SKILL_REFERENCE_NOT_FOUND',
          'SKILL_NAME_INVALID',
          'SKILL_FILE_PATH_INVALID',
          'SKILL_PATH_INVALID',
          'SKILLS_API_ERROR',
          'REGISTRY_NOT_FOUND',
        ].sort(),
      );
    });
  });

  describe('isMastraErrorCode', () => {
    it('accepts catalogue codes', () => {
      expect(isMastraErrorCode(MASTRA_ERROR_CODES.AGENT_NOT_FOUND)).toBe(true);
    });

    it('rejects unknown values and non-strings', () => {
      expect(isMastraErrorCode('DURABLE_AGENT_RUN_ACTIVE')).toBe(false);
      expect(isMastraErrorCode('toString')).toBe(false);
      expect(isMastraErrorCode(undefined)).toBe(false);
      expect(isMastraErrorCode(404)).toBe(false);
    });
  });
});
