import { fetchSchemaManifest } from './client.js';
import { ApiCliError } from './errors.js';
import type { ResolvedTarget } from './target.js';
import type { ApiCommandDescriptor, ApiCommandExample } from './types.js';

export async function getCommandSchema(descriptor: ApiCommandDescriptor, target: ResolvedTarget): Promise<unknown> {
  if (!descriptor.acceptsInput) {
    throw new ApiCliError('SCHEMA_UNAVAILABLE', 'This command does not accept JSON input');
  }

  const manifest = await fetchSchemaManifest(target.baseUrl, target.headers, target.timeoutMs);
  if (!manifest || typeof manifest !== 'object' || !Array.isArray((manifest as { routes?: unknown }).routes)) {
    throw new ApiCliError('SCHEMA_UNAVAILABLE', 'Target server returned an invalid schema manifest', {
      reason: 'invalid_manifest',
    });
  }

  const route = manifest.routes.find(
    (candidate: any) => candidate.method === descriptor.method && candidate.path === descriptor.path,
  );

  if (!route) {
    throw new ApiCliError('SCHEMA_UNAVAILABLE', 'Target server did not expose a schema for this command', {
      method: descriptor.method,
      path: descriptor.path,
    });
  }

  const source = descriptor.method === 'GET' ? 'query' : route.queryParamSchema ? 'query+body' : 'body';
  const inputSchema =
    descriptor.method === 'GET' ? route.queryParamSchema : mergeObjectSchemas(route.queryParamSchema, route.bodySchema);

  return {
    command: buildCommandUsage(descriptor),
    description: descriptor.description,
    method: descriptor.method,
    path: descriptor.path,
    positionals: buildPositionals(descriptor, route.pathParamSchema),
    examples: buildCommandExamples(descriptor),
    input: {
      required: descriptor.inputRequired,
      source,
      schema: inputSchema,
    },
    schemas: {
      pathParams: route.pathParamSchema,
      query: route.queryParamSchema,
      body: route.bodySchema,
    },
    response: {
      list: descriptor.list,
      shape: descriptor.responseShape,
      schema: route.responseSchema,
    },
  };
}

export function buildCommandUsage(descriptor: ApiCommandDescriptor): string {
  const positionals = descriptor.positionals.map(name => `<${name}>`).join(' ');
  const input = descriptor.acceptsInput ? (descriptor.inputRequired ? '<input>' : '[input]') : '';
  return ['mastra api', descriptor.name, positionals, input].filter(Boolean).join(' ');
}

function mergeObjectSchemas(querySchema: any, bodySchema: any): any {
  if (!querySchema) return bodySchema;
  if (!bodySchema) return querySchema;

  return {
    type: 'object',
    properties: {
      ...(querySchema.properties ?? {}),
      ...(bodySchema.properties ?? {}),
    },
    required: [...new Set([...(querySchema.required ?? []), ...(bodySchema.required ?? [])])],
    additionalProperties: bodySchema.additionalProperties ?? querySchema.additionalProperties,
  };
}

function buildPositionals(descriptor: ApiCommandDescriptor, pathParamSchema: any): Array<Record<string, unknown>> {
  const properties = pathParamSchema?.properties ?? {};
  const required = new Set<string>(Array.isArray(pathParamSchema?.required) ? pathParamSchema.required : []);

  return descriptor.positionals.map(name => ({
    name,
    required: required.has(name) || descriptor.path.includes(`:${name}`),
    description: properties[name]?.description,
    schema: properties[name],
  }));
}

export function buildCommandExamples(descriptor: ApiCommandDescriptor): ApiCommandExample[] {
  if (descriptor.examples && descriptor.examples.length > 0) {
    return descriptor.examples;
  }

  return buildGenericExamples(descriptor, `mastra api ${descriptor.name}`);
}

function buildGenericExamples(descriptor: ApiCommandDescriptor, command: string): ApiCommandExample[] {
  if (descriptor.list) {
    return [
      {
        description: descriptor.description,
        command: descriptor.acceptsInput ? `${command} '{"page":0,"perPage":50}'` : command,
      },
    ];
  }

  if (!descriptor.acceptsInput) {
    return [{ description: descriptor.description, command: [command, ...samplePositionals(descriptor)].join(' ') }];
  }

  const sampleInput =
    descriptor.method === 'GET' && descriptor.inputRequired ? sampleInputWithPathParams(descriptor) : '{}';
  return [{ description: descriptor.description, command: `${command} '${sampleInput}'` }];
}

function samplePositionals(descriptor: ApiCommandDescriptor): string[] {
  return descriptor.positionals.map(name => `${name}_123`);
}

function sampleInputWithPathParams(descriptor: ApiCommandDescriptor): string {
  const pathParams = [...descriptor.path.matchAll(/:([A-Za-z0-9_]+)/g)].flatMap(match => (match[1] ? [match[1]] : []));
  const inputOnlyParams = pathParams.filter(param => !descriptor.positionals.includes(param));
  if (inputOnlyParams.length === 0) return '{}';

  return JSON.stringify(Object.fromEntries(inputOnlyParams.map(param => [param, `${param}_123`])));
}
