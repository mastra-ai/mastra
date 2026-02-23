import { z, ZodSchema } from 'zod';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { getZodTypeName, getZodDef } from '@mastra/core/utils';

/**
 * Normalizes a route path to ensure consistent formatting.
 * - Removes leading/trailing whitespace
 * - Validates no path traversal (..), query strings (?), or fragments (#)
 * - Collapses multiple consecutive slashes
 * - Removes trailing slashes
 * - Ensures leading slash (unless empty)
 *
 * @param path - The route path to normalize
 * @returns The normalized path (empty string for root paths)
 * @throws Error if path contains invalid characters
 */
export function normalizeRoutePath(path: string): string {
  let normalized = path.trim();
  if (normalized.includes('..') || normalized.includes('?') || normalized.includes('#')) {
    throw new Error(`Invalid route path: "${path}". Path cannot contain '..', '?', or '#'`);
  }
  normalized = normalized.replace(/\/+/g, '/');
  if (normalized === '/' || normalized === '') {
    return '';
  }
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  return normalized;
}

/**
 * Generate context-aware test value based on field name
 */
export function generateContextualValue(fieldName?: string): string {
  if (!fieldName) return 'test-string';

  const field = fieldName.toLowerCase();

  if (field === 'entitytype') return 'AGENT';
  if (field === 'entityid') return 'test-agent';
  if (field === 'role') return 'user';
  if (field === 'fields') return 'result'; // For workflow execution result field filtering (status is always included)
  // JSON-encoded query params (wrapped with wrapSchemaForQueryParams)
  if (field === 'tags') return '["test-tag"]'; // For observability traces filtering

  // Version comparison query params (from/to are version IDs)
  // Both use the same known version ID - comparing a version to itself returns empty diffs,
  // which is valid for route integration tests that verify the endpoint responds correctly
  if (field === 'from') return 'test-version-id';
  if (field === 'to') return 'test-version-id';

  // Workspace filesystem - content and query fields
  if (field === 'content') return 'test content'; // For write/index operations
  if (field === 'query') return 'test'; // For search operations

  if (field.includes('agent')) return 'test-agent';
  if (field.includes('workflow')) return 'test-workflow';
  if (field.includes('tool') && field.includes('slug')) return 'test-tool-slug';
  if (field.includes('tool')) return 'test-tool';
  if (field.includes('skill')) return 'test-skill';
  if (field.includes('reference') && field.includes('path')) return 'test-reference.md';
  if (field.includes('thread')) return 'test-thread';
  if (field.includes('resource')) return 'test-resource';
  if (field.includes('run')) return 'test-run';
  if (field.includes('step')) return 'test-step';
  if (field.includes('task')) return 'test-task';
  if (field.includes('scorer') || field.includes('score')) return 'test-scorer';
  if (field.includes('processor')) return 'test-processor';
  if (field.includes('trace')) return 'test-trace';
  if (field.includes('span')) return 'test-span';
  if (field.includes('vector')) return 'test-vector';
  if (field.includes('index')) return 'test-index';
  if (field.includes('message')) return 'test-message';
  if (field.includes('transport')) return 'test-transport';
  if (field.includes('model')) return 'gpt-4o';
  if (field.includes('action')) return 'merge-template';
  if (field.includes('entity')) return 'test-entity';
  if (field.includes('provider')) return 'test-provider';
  if (field.includes('dataset') && field.includes('version')) return '1';
  if (field.includes('dataset')) return 'test-dataset';
  if (field.includes('item')) return 'test-item';
  if (field.includes('experiment')) return 'test-experiment';
  if (field.includes('mcp') && field.includes('client')) return 'test-mcp-client';
  if (field.includes('prompt') && field.includes('block')) return 'test-prompt-block';
  if (field.includes('block')) return 'test-prompt-block';

  return 'test-string';
}

/**
 * Generate valid test data from a Zod schema
 */
export function generateValidDataFromSchema(schema: z.ZodTypeAny, fieldName?: string): any {
  let typeName = getZodTypeName(schema);
  let def = getZodDef(schema);

  // Unwrap effects first
  while (typeName === 'ZodEffects') {
    schema = def.schema;
    typeName = getZodTypeName(schema);
    def = getZodDef(schema);
  }

  if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
    return generateValidDataFromSchema(def.innerType, fieldName);
  }
  if (typeName === 'ZodDefault') {
    return def.defaultValue();
  }

  if (typeName === 'ZodString') return generateContextualValue(fieldName);
  if (typeName === 'ZodNumber') return 10;
  if (typeName === 'ZodBoolean') return true;
  if (typeName === 'ZodNull') return null;
  if (typeName === 'ZodUndefined') return undefined;
  if (typeName === 'ZodDate') return new Date();
  if (typeName === 'ZodBigInt') return BigInt(0);

  if (typeName === 'ZodLiteral') return def.value;

  if (typeName === 'ZodEnum') return def.values[0];
  if (typeName === 'ZodNativeEnum') {
    const values = Object.values(def.values);
    return values[0];
  }

  if (typeName === 'ZodArray') {
    return [generateValidDataFromSchema(def.type, fieldName)];
  }

  if (typeName === 'ZodObject') {
    const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
    const obj: any = {};
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldTypeName = getZodTypeName(fieldSchema as z.ZodTypeAny);
      if (fieldTypeName === 'ZodOptional') {
        // Special case: workflow routes need inputData field even when optional
        // because _run.start() expects { inputData?, ... } structure, not just {}
        // Without this, z.object({}).safeParse(undefined) fails with "Required" error
        if (key === 'inputData') {
          const fieldDef = getZodDef(fieldSchema as z.ZodTypeAny);
          const innerType = fieldDef.innerType;
          obj[key] = generateValidDataFromSchema(innerType, key);
        }
        continue;
      }
      obj[key] = generateValidDataFromSchema(fieldSchema as z.ZodTypeAny, key);
    }
    return obj;
  }

  if (typeName === 'ZodRecord') {
    return { key: generateValidDataFromSchema(def.valueType, fieldName) };
  }

  if (typeName === 'ZodUnion') {
    // Special case: for content field in messages, use string format (simpler and more reliable)
    if (fieldName === 'content') {
      // Check if one of the options is ZodString
      for (const option of def.options) {
        if (getZodTypeName(option) === 'ZodString') {
          return 'test message content';
        }
      }
    }
    return generateValidDataFromSchema(def.options[0], fieldName);
  }

  if (typeName === 'ZodDiscriminatedUnion') {
    const options = Array.from(def.options.values());
    return generateValidDataFromSchema(options[0] as z.ZodTypeAny, fieldName);
  }

  if (typeName === 'ZodIntersection') {
    const left = generateValidDataFromSchema(def.left, fieldName);
    const right = generateValidDataFromSchema(def.right, fieldName);
    return { ...left, ...right };
  }

  if (typeName === 'ZodTuple') {
    return def.items.map((item: z.ZodTypeAny) => generateValidDataFromSchema(item, fieldName));
  }

  if (typeName === 'ZodAny' || typeName === 'ZodUnknown') {
    if (fieldName === 'content') {
      return [{ type: 'text', text: 'test message content' }];
    }
    // Special case: message parts for processor messages
    if (fieldName === 'parts') {
      return [{ type: 'text', text: 'test message part' }];
    }
    // Special case: workflow inputData is z.unknown() but needs to be an object
    // to match the workflow's inputSchema (typically z.object({}))
    if (fieldName === 'inputData') {
      return {};
    }
    // Special case: memory messages are z.any() but handler validates they have threadId/resourceId
    // Note: This assumes we're generating a single message in an array context
    if (fieldName === 'messages') {
      return {
        role: 'user',
        content: [{ type: 'text', text: 'test message' }],
        threadId: 'test-thread',
        resourceId: 'test-resource',
      };
    }
    return 'test-value';
  }

  return undefined;
}

export function getDefaultValidPathParams(route: ServerRoute): Record<string, any> {
  const params: Record<string, any> = {};

  // For stored agent routes (versions), use 'test-stored-agent' to match test context
  // For regular agent routes, use 'test-agent'
  if (route.path.includes(':agentId') && route.path.includes('/stored/agents/')) {
    params.agentId = 'test-stored-agent';
  } else if (route.path.includes(':agentId')) {
    params.agentId = 'test-agent';
  }
  if (route.path.includes(':workflowId')) params.workflowId = 'test-workflow';
  if (route.path.includes(':toolId')) params.toolId = 'test-tool';
  if (route.path.includes(':threadId')) params.threadId = 'test-thread';
  if (route.path.includes(':resourceId')) params.resourceId = 'test-resource';
  if (route.path.includes(':modelConfigId')) params.modelConfigId = 'id1';
  // For stored scorer version routes, use the stored scorer ID to match test context
  if (route.path.includes(':scorerId') && route.path.includes('/stored/scorers/')) {
    params.scorerId = 'test-stored-scorer';
  } else if (route.path.includes(':scorerId')) {
    params.scorerId = 'test-scorer';
  }
  if (route.path.includes(':traceId')) params.traceId = 'test-trace';
  if (route.path.includes(':runId')) params.runId = 'test-run';
  if (route.path.includes(':stepId')) params.stepId = 'test-step';
  if (route.path.includes(':taskId')) params.taskId = 'test-task-id';
  if (route.path.includes(':vectorName')) params.vectorName = 'test-vector';
  if (route.path.includes(':indexName')) params.indexName = 'test-index';
  if (route.path.includes(':transportId')) params.transportId = 'test-transport';
  if (route.path.includes(':spanId')) params.spanId = 'test-span';
  if (route.path.includes(':entityType')) params.entityType = 'AGENT';
  if (route.path.includes(':entityId')) params.entityId = 'test-agent';
  if (route.path.includes(':actionId')) params.actionId = 'merge-template';
  if (route.path.includes(':storedAgentId')) params.storedAgentId = 'test-stored-agent';
  if (route.path.includes(':storedScorerId')) params.storedScorerId = 'test-stored-scorer';
  if (route.path.includes(':versionId')) params.versionId = 'test-version-id';
  if (route.path.includes(':processorId')) params.processorId = 'test-processor';
  // MCP route params - need to get actual server ID from test context
  if (route.path.includes(':id') && route.path.includes('/mcp/v0/servers/')) params.id = 'test-server-1';
  if (route.path.includes(':serverId')) params.serverId = 'test-server-1';
  if (route.path.includes(':toolId') && route.path.includes('/mcp/')) params.toolId = 'getWeather';

  // Workspace route params
  if (route.path.includes(':workspaceId')) params.workspaceId = 'test-workspace';

  // Skills route params
  if (route.path.includes(':skillName')) params.skillName = 'test-skill';
  if (route.path.includes(':referencePath')) params.referencePath = 'test-reference.md';

  // Stored entity route params
  if (route.path.includes(':storedMCPClientId')) params.storedMCPClientId = 'test-stored-mcp-client';
  if (route.path.includes(':mcpClientId')) params.mcpClientId = 'test-stored-mcp-client';
  if (route.path.includes(':storedPromptBlockId')) params.storedPromptBlockId = 'test-stored-prompt-block';
  if (route.path.includes(':promptBlockId')) params.promptBlockId = 'test-stored-prompt-block';
  if (route.path.includes(':storedWorkspaceId')) params.storedWorkspaceId = 'test-stored-workspace';
  if (route.path.includes(':storedSkillId')) params.storedSkillId = 'test-stored-skill';
  if (route.path.includes(':scorerId') && route.path.includes('/stored/scorers/'))
    params.scorerId = 'test-stored-scorer';

  // Dataset route params
  if (route.path.includes(':datasetId')) params.datasetId = 'test-dataset';
  if (route.path.includes(':itemId')) params.itemId = 'test-item';
  if (route.path.includes(':experimentId')) params.experimentId = 'test-experiment';
  if (route.path.includes(':datasetVersion')) params.datasetVersion = '1';

  // Tool provider route params
  if (route.path.includes(':providerId')) params.providerId = 'test-provider';
  if (route.path.includes(':toolSlug')) params.toolSlug = 'test-tool-slug';

  return params;
}

export function getDefaultInvalidPathParams(route: ServerRoute): Array<Record<string, any>> {
  const invalid: Array<Record<string, any>> = [];
  invalid.push({});

  if (route.path.includes(':agentId')) {
    invalid.push({ agentId: 123 });
  }

  return invalid;
}

/**
 * Validate that a value matches a schema
 */
export function expectValidSchema(schema: ZodSchema, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(result.error.issues, null, 2)}`);
  }
}

/**
 * Validate that a value does NOT match a schema
 */
export function expectInvalidSchema(schema: ZodSchema, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) {
    throw new Error(`Expected schema validation to fail, but it succeeded`);
  }
}

/**
 * Validate route metadata
 */
export function validateRouteMetadata(
  route: ServerRoute,
  expected: {
    method?: string;
    path?: string;
    responseType?: 'json' | 'stream';
    hasPathParams?: boolean;
    hasQueryParams?: boolean;
    hasBody?: boolean;
    hasResponse?: boolean;
    hasOpenAPI?: boolean;
  },
) {
  if (expected.method && route.method !== expected.method) {
    throw new Error(`Expected method ${expected.method} but got ${route.method}`);
  }

  if (expected.path && route.path !== expected.path) {
    throw new Error(`Expected path ${expected.path} but got ${route.path}`);
  }

  if (expected.responseType && route.responseType !== expected.responseType) {
    throw new Error(`Expected responseType ${expected.responseType} but got ${route.responseType}`);
  }

  if (expected.hasPathParams !== undefined) {
    const hasPathParams = !!route.pathParamSchema;
    if (hasPathParams !== expected.hasPathParams) {
      throw new Error(
        `Expected pathParamSchema to be ${expected.hasPathParams ? 'defined' : 'undefined'} but got ${hasPathParams ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasQueryParams !== undefined) {
    const hasQueryParams = !!route.queryParamSchema;
    if (hasQueryParams !== expected.hasQueryParams) {
      throw new Error(
        `Expected queryParamSchema to be ${expected.hasQueryParams ? 'defined' : 'undefined'} but got ${hasQueryParams ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasBody !== undefined) {
    const hasBody = !!route.bodySchema;
    if (hasBody !== expected.hasBody) {
      throw new Error(
        `Expected bodySchema to be ${expected.hasBody ? 'defined' : 'undefined'} but got ${hasBody ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasResponse !== undefined) {
    const hasResponse = !!route.responseSchema;
    if (hasResponse !== expected.hasResponse) {
      throw new Error(
        `Expected responseSchema to be ${expected.hasResponse ? 'defined' : 'undefined'} but got ${hasResponse ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasOpenAPI !== undefined) {
    const hasOpenAPI = !!route.openapi;
    if (hasOpenAPI !== expected.hasOpenAPI) {
      throw new Error(
        `Expected openapi to be ${expected.hasOpenAPI ? 'defined' : 'undefined'} but got ${hasOpenAPI ? 'defined' : 'undefined'}`,
      );
    }
  }
}
