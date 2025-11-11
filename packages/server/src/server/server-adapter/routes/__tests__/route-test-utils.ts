import { z } from 'zod';
import type { ServerRoute } from '../index';

/**
 * Generate context-aware test value based on field name
 */
export function generateContextualValue(fieldName?: string): string {
  if (!fieldName) return 'test-string';

  const field = fieldName.toLowerCase();

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
  if (route.path.includes(':entityType')) params.entityType = 'test-entity-type';
  if (route.path.includes(':entityId')) params.entityId = 'test-entity-id';
  if (route.path.includes(':actionId')) params.actionId = 'merge-template';

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

export interface RouteRequestPayload {
  method: ServerRoute['method'];
  path: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
}

export interface RouteRequestOverrides {
  pathParams?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export function buildRouteRequest(route: ServerRoute, overrides: RouteRequestOverrides = {}): RouteRequestPayload {
  const method = route.method;
  let path = route.path;

  if (route.pathParamSchema) {
    const defaults = getDefaultValidPathParams(route);
    const params = { ...defaults, ...(overrides.pathParams ?? {}) };
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`:${key}`, encodeURIComponent(String(value)));
    }
  }

  let query: Record<string, string | string[]> | undefined;
  if (route.queryParamSchema) {
    const generated = generateValidDataFromSchema(route.queryParamSchema) as Record<string, unknown>;
    query = convertQueryValues({ ...generated, ...(overrides.query ?? {}) });
  } else if (overrides.query) {
    query = convertQueryValues(overrides.query);
  }

  let body: Record<string, unknown> | undefined;
  if (route.bodySchema) {
    const generated = generateValidDataFromSchema(route.bodySchema) as Record<string, unknown>;
    body = { ...generated, ...(overrides.body ?? {}) };
  } else if (overrides.body) {
    body = { ...overrides.body };
  }

  return {
    method,
    path,
    query,
    body,
  };
}

export function convertQueryValues(values: Record<string, unknown>): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      query[key] = value.map(item => convertQueryValue(item));
      continue;
    }
    query[key] = convertQueryValue(value);
  }
  return query;
}

function convertQueryValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
