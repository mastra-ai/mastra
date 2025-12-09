import { z, ZodSchema } from 'zod';
import type { ServerRoute } from '@mastra/server/server-adapter';

/**
 * Generate context-aware test value based on field name
 */
export function generateContextualValue(fieldName?: string): string {
  if (!fieldName) return 'test-string';

  const field = fieldName.toLowerCase();

  if (field === 'entitytype') return 'AGENT';
  if (field === 'entityid') return 'test-agent';
  if (field === 'role') return 'user';

  if (field.includes('agent')) return 'test-agent';
  if (field.includes('workflow')) return 'test-workflow';
  if (field.includes('tool')) return 'test-tool';
  if (field.includes('thread')) return 'test-thread';
  if (field.includes('resource')) return 'test-resource';
  if (field.includes('run')) return 'test-run';
  if (field.includes('step')) return 'test-step';
  if (field.includes('task')) return 'test-task';
  if (field.includes('scorer') || field.includes('score')) return 'test-scorer';
  if (field.includes('trace')) return 'test-trace';
  if (field.includes('span')) return 'test-span';
  if (field.includes('vector')) return 'test-vector';
  if (field.includes('index')) return 'test-index';
  if (field.includes('message')) return 'test-message';
  if (field.includes('transport')) return 'test-transport';
  if (field.includes('model')) return 'gpt-4o';
  if (field.includes('action')) return 'merge-template';
  if (field.includes('entity')) return 'test-entity';

  return 'test-string';
}

/**
 * Generate valid test data from a Zod schema
 */
export function generateValidDataFromSchema(schema: z.ZodTypeAny, fieldName?: string): any {
  while (schema instanceof z.ZodEffects) {
    schema = schema._def.schema;
  }

  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return generateValidDataFromSchema(schema._def.innerType, fieldName);
  }
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue();
  }

  if (schema instanceof z.ZodString) return generateContextualValue(fieldName);
  if (schema instanceof z.ZodNumber) return 10;
  if (schema instanceof z.ZodBoolean) return true;
  if (schema instanceof z.ZodNull) return null;
  if (schema instanceof z.ZodUndefined) return undefined;
  if (schema instanceof z.ZodDate) return new Date();
  if (schema instanceof z.ZodBigInt) return BigInt(0);

  if (schema instanceof z.ZodLiteral) return schema._def.value;

  if (schema instanceof z.ZodEnum) return schema._def.values[0];
  if (schema instanceof z.ZodNativeEnum) {
    const values = Object.values(schema._def.values);
    return values[0];
  }

  if (schema instanceof z.ZodArray) {
    return [generateValidDataFromSchema(schema._def.type, fieldName)];
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const obj: any = {};
    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (fieldSchema instanceof z.ZodOptional) {
        // Special case: workflow routes need inputData field even when optional
        // because _run.start() expects { inputData?, ... } structure, not just {}
        // Without this, z.object({}).safeParse(undefined) fails with "Required" error
        if (key === 'inputData') {
          const innerType = fieldSchema._def.innerType;
          obj[key] = generateValidDataFromSchema(innerType, key);
        }
        continue;
      }
      obj[key] = generateValidDataFromSchema(fieldSchema as z.ZodTypeAny, key);
    }
    return obj;
  }

  if (schema instanceof z.ZodRecord) {
    return { key: generateValidDataFromSchema(schema._def.valueType, fieldName) };
  }

  if (schema instanceof z.ZodUnion) {
    return generateValidDataFromSchema(schema._def.options[0], fieldName);
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = Array.from(schema._def.options.values());
    return generateValidDataFromSchema(options[0] as z.ZodTypeAny, fieldName);
  }

  if (schema instanceof z.ZodIntersection) {
    const left = generateValidDataFromSchema(schema._def.left, fieldName);
    const right = generateValidDataFromSchema(schema._def.right, fieldName);
    return { ...left, ...right };
  }

  if (schema instanceof z.ZodTuple) {
    return schema._def.items.map((item: z.ZodTypeAny) => generateValidDataFromSchema(item, fieldName));
  }

  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
    if (fieldName === 'content') {
      return [{ type: 'text', text: 'test message content' }];
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

  if (route.path.includes(':agentId')) params.agentId = 'test-agent';
  if (route.path.includes(':workflowId')) params.workflowId = 'test-workflow';
  if (route.path.includes(':toolId')) params.toolId = 'test-tool';
  if (route.path.includes(':threadId')) params.threadId = 'test-thread';
  if (route.path.includes(':resourceId')) params.resourceId = 'test-resource';
  if (route.path.includes(':modelConfigId')) params.modelConfigId = 'id1';
  if (route.path.includes(':scorerId')) params.scorerId = 'test-scorer';
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

  // MCP route params - need to get actual server ID from test context
  if (route.path.includes(':id') && route.path.includes('/mcp/v0/servers/')) params.id = 'test-server-1';
  if (route.path.includes(':serverId')) params.serverId = 'test-server-1';
  if (route.path.includes(':toolId') && route.path.includes('/mcp/')) params.toolId = 'getWeather';

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
