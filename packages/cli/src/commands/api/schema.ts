import { fetchSchemaManifest } from './client.js';
import type { ApiCommandDescriptor } from './commands.js';
import { ApiCliError } from './errors.js';
import type { ResolvedTarget } from './target.js';

interface CliSchemaExample {
  description: string;
  command: string;
}

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

export function buildCommandExamples(descriptor: ApiCommandDescriptor): CliSchemaExample[] {
  const command = `mastra api ${descriptor.name}`;

  switch (descriptor.key) {
    case 'agentList':
      return [{ description: 'List available agents', command }];
    case 'agentRun':
      return [
        {
          description: 'Run an agent with a text prompt',
          command: `${command} weather-agent '{"messages":"What is the weather in London?"}'`,
        },
        {
          description: 'Run an agent and persist messages to a thread',
          command: `${command} weather-agent '{"messages":"What is the weather in London?","memory":{"thread":"thread_abc123","resource":"user_123"}}'`,
        },
      ];
    case 'toolExecute':
      return [
        {
          description: 'Execute a tool with raw tool input. The CLI sends this as the route data field.',
          command: `${command} get-weather '{"location":"San Francisco"}'`,
        },
        {
          description: 'Execute a tool with an explicit data wrapper',
          command: `${command} get-weather '{"data":{"location":"San Francisco"}}'`,
        },
      ];
    case 'mcpToolExecute':
      return [
        {
          description: 'Execute an MCP tool with raw tool input. The CLI sends this as the route data field.',
          command: `${command} my-server calculator '{"num1":2,"num2":3,"operation":"add"}'`,
        },
        {
          description: 'Execute an MCP tool with an explicit data wrapper',
          command: `${command} my-server calculator '{"data":{"num1":2,"num2":3,"operation":"add"}}'`,
        },
      ];
    case 'workflowRunStart':
      return [
        {
          description: 'Start a workflow run',
          command: `${command} data-pipeline '{"inputData":{"source":"s3://bucket/data.csv"}}'`,
        },
      ];
    case 'workflowRunResume':
      return [
        {
          description: 'Resume a suspended workflow run. The run must currently be suspended.',
          command: `${command} data-pipeline run_123 '{"resumeData":{"approved":true}}'`,
        },
      ];
    case 'memorySearch':
      return [
        {
          description: 'Search long-term memory',
          command: `${command} '{"agentId":"weather-agent","resourceId":"user_123","searchQuery":"caching strategy","limit":10}'`,
        },
      ];
    case 'memoryCurrentGet':
      return [
        {
          description: 'Read current working memory',
          command: `${command} '{"threadId":"thread_abc123","agentId":"code-reviewer"}'`,
        },
      ];
    case 'memoryCurrentUpdate':
      return [
        {
          description: 'Update current working memory. Requires working memory to be enabled for the memory instance.',
          command: `${command} '{"threadId":"thread_abc123","agentId":"code-reviewer","workingMemory":"Remember the user prefers concise responses."}'`,
        },
      ];
    case 'memoryStatus':
      return [
        {
          description: 'Get memory status for an agent',
          command: `${command} '{"agentId":"weather-agent"}'`,
        },
        {
          description: 'Get memory status for an agent, resource, and thread',
          command: `${command} '{"agentId":"weather-agent","resourceId":"user_123","threadId":"thread_abc123"}'`,
        },
      ];
    case 'logList':
      return [
        {
          description: 'List recent logs',
          command,
        },
        {
          description: 'List info logs with pagination',
          command: `${command} '{"level":"info","page":0,"perPage":50}'`,
        },
      ];
    case 'threadCreate':
      return [
        {
          description: 'Create a memory thread',
          command: `${command} '{"agentId":"weather-agent","resourceId":"user_123","threadId":"thread_abc123","title":"Support conversation"}'`,
        },
      ];
    case 'threadUpdate':
      return [
        {
          description: 'Update a memory thread',
          command: `${command} thread_abc123 '{"agentId":"weather-agent","title":"Updated title"}'`,
        },
      ];
    case 'threadDelete':
      return [
        {
          description: 'Delete a memory thread',
          command: `${command} thread_abc123 '{"agentId":"weather-agent","resourceId":"user_123"}'`,
        },
      ];
    case 'scoreCreate':
      return [
        {
          description: 'Create an observability score',
          command: `${command} '{"score":{"scoreId":"score_123","scorerId":"quality","score":0.95,"runId":"run_123","entityType":"agent","entityId":"weather-agent"}}'`,
        },
      ];
    case 'scoreList':
      return [
        {
          description: 'List observability scores with pagination',
          command: `${command} '{"page":0,"perPage":50}'`,
        },
        {
          description: 'List observability scores for a run',
          command: `${command} '{"runId":"run_123","page":0,"perPage":50}'`,
        },
      ];
    case 'scoreGet':
      return [{ description: 'Get an observability score by ID', command: `${command} score_123` }];
    case 'datasetCreate':
      return [{ description: 'Create a dataset', command: `${command} '{"name":"weather-eval"}'` }];
    case 'experimentRun':
      return [{ description: 'Run a dataset experiment', command: `${command} dataset_123 '{"name":"baseline"}'` }];
    default:
      return buildGenericExamples(descriptor, command);
  }
}

function buildGenericExamples(descriptor: ApiCommandDescriptor, command: string): CliSchemaExample[] {
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
