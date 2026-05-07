import type { Command as CommanderCommand } from 'commander';
import { getAnalytics } from '../../analytics/index.js';
import { requestApi } from './client.js';
import { ApiCliError, errorEnvelope, toApiCliError } from './errors.js';
import { parseInput, resolvePathParams, stripPathParamsFromInput } from './input.js';
import { normalizeData } from './normalizers.js';
import { normalizeSuccess, writeJson } from './output.js';
import { normalizeResponse } from './response-normalizer.js';
import { API_ROUTE_METADATA } from './route-metadata.generated.js';
import { buildCommandExamples, getCommandSchema } from './schema.js';
import { resolveTarget } from './target.js';
import type { ApiGlobalOptions } from './target.js';
import type { ApiCommandActionOptions, ApiCommandDescriptor, HttpMethod } from './types.js';

const API_ANALYTICS_SHUTDOWN_TIMEOUT_MS = 1000;

export const API_COMMANDS = {} as Record<string, ApiCommandDescriptor>;

export function registerApiCommand(program: CommanderCommand): void {
  for (const key of Object.keys(API_COMMANDS)) {
    delete API_COMMANDS[key];
  }

  const api = program
    .command('api')
    .description('Call Mastra APIs')
    .option('--url <url>', 'target Mastra server URL')
    .option('--header <header>', 'custom HTTP header (repeatable)', collect, [])
    .option('--timeout <ms>', 'client-side request timeout')
    .option('--pretty', 'pretty-print JSON output', false);

  const agent = api.command('agent').description('List, inspect, and run agents');
  addAction(agent, 'list', 'GET /agents', { description: 'List available agents', list: true });
  addAction(agent, 'get', 'GET /agents/:agentId', { description: 'Get agent details' });
  addAction(agent, 'run', 'POST /agents/:agentId/generate', {
    description: 'Run an agent with JSON input',
    input: 'required',
    examples: [
      {
        description: 'Run an agent with a text prompt',
        command: `mastra api agent run weather-agent '{"messages":"What is the weather in London?"}'`,
      },
      {
        description: 'Run an agent and persist messages to a thread',
        command: `mastra api agent run weather-agent '{"messages":"What is the weather in London?","memory":{"thread":"thread_abc123","resource":"user_123"}}'`,
      },
    ],
  });

  const workflow = api.command('workflow').description('List, inspect, and run workflows');
  addAction(workflow, 'list', 'GET /workflows', { description: 'List available workflows', list: true });
  addAction(workflow, 'get', 'GET /workflows/:workflowId', { description: 'Get workflow details' });
  const workflowRun = workflow.command('run').description('Manage workflow runs');
  addAction(workflowRun, 'start', 'POST /workflows/:workflowId/start-async', {
    description: 'Start a workflow run',
    input: 'required',
    defaultTimeoutMs: 120_000,
    examples: [
      {
        description: 'Start a workflow run',
        command: `mastra api workflow run start data-pipeline '{"inputData":{"source":"s3://bucket/data.csv"}}'`,
      },
    ],
  });
  addAction(workflowRun, 'list', 'GET /workflows/:workflowId/runs', {
    description: 'List workflow runs',
    input: 'optional',
    list: true,
  });
  addAction(workflowRun, 'get', 'GET /workflows/:workflowId/runs/:runId', {
    description: 'Get workflow run details',
  });
  addAction(workflowRun, 'resume', 'POST /workflows/:workflowId/resume-async', {
    description: 'Resume a suspended workflow run',
    input: 'required',
    positionals: ['workflowId', 'runId'],
    defaultTimeoutMs: 120_000,
    examples: [
      {
        description: 'Resume a suspended workflow run. The run must currently be suspended.',
        command: `mastra api workflow run resume data-pipeline run_123 '{"resumeData":{"approved":true}}'`,
      },
    ],
  });
  addAction(workflowRun, 'cancel', 'POST /workflows/:workflowId/runs/:runId/cancel', {
    description: 'Cancel a workflow run',
  });

  const tool = api.command('tool').description('List, inspect, and execute tools');
  addAction(tool, 'list', 'GET /tools', { description: 'List available tools', list: true });
  addAction(tool, 'get', 'GET /tools/:toolId', { description: 'Get tool details and input schema' });
  addAction(tool, 'execute', 'POST /tools/:toolId/execute', {
    description: 'Execute a tool with JSON input',
    input: 'required',
    examples: [
      {
        description: 'Execute a tool with raw tool input. The CLI sends this as the route data field.',
        command: `mastra api tool execute get-weather '{"location":"San Francisco"}'`,
      },
      {
        description: 'Execute a tool with an explicit data wrapper',
        command: `mastra api tool execute get-weather '{"data":{"location":"San Francisco"}}'`,
      },
    ],
  });

  const mcp = api.command('mcp').description('List and inspect MCP servers');
  addAction(mcp, 'list', 'GET /mcp/v0/servers', { description: 'List MCP servers', list: true });
  addAction(mcp, 'get', 'GET /mcp/v0/servers/:id', { description: 'Get MCP server details' });
  const mcpTool = mcp.command('tool').description('List, inspect, and execute MCP tools');
  addAction(mcpTool, 'list', 'GET /mcp/:serverId/tools', {
    description: 'List tools for an MCP server',
    input: 'optional',
    list: true,
  });
  addAction(mcpTool, 'get', 'GET /mcp/:serverId/tools/:toolId', {
    description: 'Get MCP tool details',
  });
  addAction(mcpTool, 'execute', 'POST /mcp/:serverId/tools/:toolId/execute', {
    description: 'Execute an MCP tool with JSON input',
    input: 'required',
    examples: [
      {
        description: 'Execute an MCP tool with raw tool input. The CLI sends this as the route data field.',
        command: `mastra api mcp tool execute my-server calculator '{"num1":2,"num2":3,"operation":"add"}'`,
      },
      {
        description: 'Execute an MCP tool with an explicit data wrapper',
        command: `mastra api mcp tool execute my-server calculator '{"data":{"num1":2,"num2":3,"operation":"add"}}'`,
      },
    ],
  });

  const thread = api.command('thread').description('Manage memory threads and messages');
  addAction(thread, 'list', 'GET /memory/threads', { description: 'List memory threads', list: true });
  addAction(thread, 'get', 'GET /memory/threads/:threadId', { description: 'Get thread details' });
  addAction(thread, 'create', 'POST /memory/threads', {
    description: 'Create a memory thread',
    input: 'required',
    examples: [
      {
        description: 'Create a memory thread',
        command: `mastra api thread create '{"agentId":"weather-agent","resourceId":"user_123","threadId":"thread_abc123","title":"Support conversation"}'`,
      },
    ],
  });
  addAction(thread, 'update', 'PATCH /memory/threads/:threadId', {
    description: 'Update a memory thread',
    input: 'required',
    examples: [
      {
        description: 'Update a memory thread',
        command: `mastra api thread update thread_abc123 '{"agentId":"weather-agent","title":"Updated title"}'`,
      },
    ],
  });
  addAction(thread, 'delete', 'DELETE /memory/threads/:threadId', {
    description: 'Delete a memory thread',
    input: 'required',
    examples: [
      {
        description: 'Delete a memory thread',
        command: `mastra api thread delete thread_abc123 '{"agentId":"weather-agent","resourceId":"user_123"}'`,
      },
    ],
  });
  addAction(thread, 'messages', 'GET /memory/threads/:threadId/messages', {
    description: 'List messages in a memory thread',
    input: 'optional',
    list: true,
  });

  const memory = api.command('memory').description('Search and manage agent memory');
  addAction(memory, 'search', 'GET /memory/search', {
    description: 'Search long-term memory',
    input: 'required',
    list: true,
    examples: [
      {
        description: 'Search long-term memory',
        command: `mastra api memory search '{"agentId":"weather-agent","resourceId":"user_123","searchQuery":"caching strategy","limit":10}'`,
      },
    ],
  });
  const current = memory.command('current').description('Read and update working memory');
  addAction(current, 'get', 'GET /memory/threads/:threadId/working-memory', {
    description: 'Get current working memory',
    input: 'required',
    pathParamsFromInput: ['threadId'],
    examples: [
      {
        description: 'Read current working memory',
        command: `mastra api memory current get '{"threadId":"thread_abc123","agentId":"code-reviewer"}'`,
      },
    ],
  });
  addAction(current, 'update', 'POST /memory/threads/:threadId/working-memory', {
    description: 'Update current working memory',
    input: 'required',
    pathParamsFromInput: ['threadId'],
    examples: [
      {
        description: 'Update current working memory. Requires working memory to be enabled for the memory instance.',
        command: `mastra api memory current update '{"threadId":"thread_abc123","agentId":"code-reviewer","workingMemory":"Remember the user prefers concise responses."}'`,
      },
    ],
  });
  addAction(memory, 'status', 'GET /memory/status', {
    description: 'Get memory system status',
    input: 'required',
    examples: [
      {
        description: 'Get memory status for an agent',
        command: `mastra api memory status '{"agentId":"weather-agent"}'`,
      },
      {
        description: 'Get memory status for an agent, resource, and thread',
        command: `mastra api memory status '{"agentId":"weather-agent","resourceId":"user_123","threadId":"thread_abc123"}'`,
      },
    ],
  });

  const trace = api.command('trace').description('Inspect observability traces');
  addAction(trace, 'list', 'GET /observability/traces', { description: 'List observability traces', list: true });
  addAction(trace, 'get', 'GET /observability/traces/:traceId', { description: 'Get trace details' });

  const log = api.command('log').description('Inspect runtime logs');
  addAction(log, 'list', 'GET /observability/logs', {
    description: 'List runtime logs',
    input: 'optional',
    list: true,
    examples: [
      { description: 'List recent logs', command: 'mastra api log list' },
      {
        description: 'List info logs with pagination',
        command: `mastra api log list '{"level":"info","page":0,"perPage":50}'`,
      },
    ],
  });

  const score = api.command('score').description('Create, list, and inspect scores');
  addAction(score, 'create', 'POST /observability/scores', {
    description: 'Create a score',
    input: 'required',
    examples: [
      {
        description: 'Create an observability score',
        command: `mastra api score create '{"score":{"scoreId":"score_123","scorerId":"quality","score":0.95,"runId":"run_123","entityType":"agent","entityId":"weather-agent"}}'`,
      },
    ],
  });
  addAction(score, 'list', 'GET /observability/scores', {
    description: 'List scores',
    input: 'optional',
    list: true,
    examples: [
      {
        description: 'List observability scores with pagination',
        command: `mastra api score list '{"page":0,"perPage":50}'`,
      },
      {
        description: 'List observability scores for a run',
        command: `mastra api score list '{"runId":"run_123","page":0,"perPage":50}'`,
      },
    ],
  });
  addAction(score, 'get', 'GET /observability/scores/:scoreId', {
    description: 'Get score details',
    examples: [{ description: 'Get an observability score by ID', command: 'mastra api score get score_123' }],
  });

  const dataset = api.command('dataset').description('Create, list, and inspect datasets');
  addAction(dataset, 'list', 'GET /datasets', { description: 'List datasets', list: true });
  addAction(dataset, 'get', 'GET /datasets/:datasetId', { description: 'Get dataset details' });
  addAction(dataset, 'create', 'POST /datasets', {
    description: 'Create a dataset',
    input: 'required',
    examples: [{ description: 'Create a dataset', command: `mastra api dataset create '{"name":"weather-eval"}'` }],
  });
  addAction(dataset, 'items', 'GET /datasets/:datasetId/items', {
    description: 'List dataset items',
    input: 'optional',
    list: true,
  });

  const experiment = api.command('experiment').description('Run and inspect dataset experiments');
  addAction(experiment, 'list', 'GET /datasets/:datasetId/experiments', {
    description: 'List dataset experiments',
    input: 'optional',
    list: true,
  });
  addAction(experiment, 'get', 'GET /datasets/:datasetId/experiments/:experimentId', {
    description: 'Get experiment details',
  });
  addAction(experiment, 'run', 'POST /datasets/:datasetId/experiments', {
    description: 'Run a dataset experiment',
    input: 'required',
    examples: [
      {
        description: 'Run a dataset experiment',
        command: `mastra api experiment run dataset_123 '{"name":"baseline"}'`,
      },
    ],
  });
  addAction(experiment, 'results', 'GET /datasets/:datasetId/experiments/:experimentId/results', {
    description: 'List experiment results',
    input: 'optional',
    list: true,
  });
}

/**
 * Registers one leaf API command and stores the descriptor used by execution and tests.
 *
 * The `name` string is intentionally the source of truth for the leaf command name. Required identity arguments are declared from route metadata (or `options.positionals` for query-backed IDs), and JSON input syntax is declared from `options.input`.
 *
 * @param parent - Commander group that owns the leaf command, such as `agent` or `workflow run`.
 * @param name - Leaf command name, without arguments. Example: `run`, `list`, or `execute`.
 * @param routeKey - Generated route metadata key in the form `METHOD /path/:param`.
 * @param options - Hand-authored CLI details that cannot be derived from the server route.
 */
function addAction(
  parent: CommanderCommand,
  name: string,
  routeKey: keyof typeof API_ROUTE_METADATA,
  options: ApiCommandActionOptions,
): void {
  const descriptor = buildDescriptor(parent, name, routeKey, options);
  // Keep the exported descriptor map aligned with the actual Commander tree.
  API_COMMANDS[descriptor.key] = descriptor;

  const command = parent.command(name).description(descriptor.description);
  for (const positional of descriptor.positionals) {
    // Keep identity args optional at Commander level so `--schema` can run without real IDs.
    // Actual requests still validate IDs before making an HTTP request.
    command.argument(`[${positional}]`);
  }
  if (descriptor.acceptsInput) {
    // Keep JSON input optional at Commander level so `--schema` can run without sample input;
    // `parseInput` enforces required input for actual requests.
    command.argument('[input]');
  }
  const examples = buildCommandExamples(descriptor);

  if (examples.length > 0) {
    command.addHelpText('after', `\nExamples:\n${examples.map(example => `  ${example.command}`).join('\n')}`);
  }

  if (descriptor.acceptsInput) {
    command.option('--schema', 'print request schema for this command');
  }

  command.action(async (...args: unknown[]) => {
    const command = args.at(-1) as CommanderCommand;
    // Commander passes all declared args before the command object; split identity IDs from JSON input.
    const { identityValues, maybeInput } = splitActionArgs(descriptor, args.slice(0, -1));
    const analytics = getAnalytics();
    const startedAt = process.hrtime();

    try {
      await executeDescriptor(descriptor, identityValues, maybeInput, command.optsWithGlobals() as ApiGlobalOptions);
      const [seconds, nanoseconds] = process.hrtime(startedAt);
      analytics?.trackCommand({
        command: `api-${descriptor.name}`,
        args: {
          positionalCount: identityValues.length,
          positionalPresent: identityValues.length > 0,
          hasInput: maybeInput !== undefined,
        },
        durationMs: seconds * 1000 + nanoseconds / 1_000_000,
        status: process.exitCode ? 'error' : 'success',
      });
    } finally {
      await shutdownApiAnalytics(analytics);
    }
  });
}

function splitActionArgs(
  descriptor: ApiCommandDescriptor,
  args: unknown[],
): { identityValues: string[]; maybeInput: string | undefined } {
  const values = args.filter(value => typeof value === 'string') as string[];
  const possibleInput = descriptor.acceptsInput ? values.at(-1) : undefined;

  if (possibleInput && looksLikeJsonObject(possibleInput) && values.length <= descriptor.positionals.length) {
    return { identityValues: values.slice(0, -1), maybeInput: possibleInput };
  }

  return {
    identityValues: values.slice(0, descriptor.positionals.length),
    maybeInput: descriptor.acceptsInput ? values[descriptor.positionals.length] : undefined,
  };
}

function looksLikeJsonObject(value: string): boolean {
  return value.trimStart().startsWith('{');
}

/**
 * Converts Commander wiring plus generated route metadata into a stable API command descriptor.
 *
 * Descriptors are the bridge between the user-facing CLI tree and generic runtime behavior: execution, schema output, response normalization, and regression tests all consume this shape.
 *
 * @param parent - Commander group that owns the leaf command.
 * @param name - Leaf command name as registered with Commander.
 * @param routeKey - Generated route metadata key used to pull method, path, params, and response shape.
 * @param options - CLI-only metadata, including description, input mode, examples, and overrides.
 */
function buildDescriptor(
  parent: CommanderCommand,
  name: string,
  routeKey: keyof typeof API_ROUTE_METADATA,
  options: ApiCommandActionOptions,
): ApiCommandDescriptor {
  const route = API_ROUTE_METADATA[routeKey];
  const commandName = [...commandPath(parent), parseCommandName(name)].join(' ');
  const pathParamsFromInput = new Set(options.pathParamsFromInput ?? []);
  // Most path params become positional CLI args; a few commands intentionally read IDs from JSON input.
  const positionals = options.positionals ?? route.pathParams.filter(param => !pathParamsFromInput.has(param));
  // List commands default to optional JSON so callers can pass pagination/filter objects.
  const inputMode = options.input ?? (options.list ? 'optional' : route.hasBody ? 'optional' : 'none');

  return {
    key: commandName.replace(/ ([a-z])/g, (_, letter: string) => letter.toUpperCase()),
    name: commandName,
    description: options.description,
    method: route.method as HttpMethod,
    path: route.path,
    positionals,
    acceptsInput: inputMode !== 'none',
    inputRequired: inputMode === 'required',
    list: options.list ?? false,
    responseShape: route.responseShape,
    queryParams: [...route.queryParams],
    bodyParams: [...route.bodyParams],
    defaultTimeoutMs: options.defaultTimeoutMs,
    examples: options.examples,
  };
}

/**
 * Returns the nested command path below `api`, e.g. `workflow run` or `mcp tool`.
 *
 * @param command - Commander group whose ancestry should be converted into descriptor name segments.
 */
function commandPath(command: CommanderCommand): string[] {
  const names: string[] = [];
  let current: CommanderCommand | undefined = command;

  while (current && current.name() !== 'api') {
    // Walk upward then unshift so the descriptor name matches the visible CLI order.
    names.unshift(current.name());
    current = current.parent as CommanderCommand | undefined;
  }

  return names;
}

/**
 * Extracts the leaf command token from the string passed to `parent.command()`.
 *
 * @param name - Commander command declaration. Currently just the leaf token, but kept tolerant of future declarations like `run [input]`.
 */
function parseCommandName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

/**
 * Flushes API command analytics without letting telemetry keep the CLI alive indefinitely.
 *
 * @param analytics - Lazily-created analytics client, if telemetry is enabled.
 */
async function shutdownApiAnalytics(analytics: ReturnType<typeof getAnalytics>): Promise<void> {
  if (!analytics) {
    return;
  }

  // Bound PostHog flush time; otherwise API commands can appear to hang after printing output.
  const exitTimer = setTimeout(() => {
    process.exit(process.exitCode ?? 0);
  }, API_ANALYTICS_SHUTDOWN_TIMEOUT_MS);

  try {
    await analytics.shutdown();
  } finally {
    clearTimeout(exitTimer);
  }
}

/**
 * Executes a descriptor-backed API command and writes a machine-readable JSON result.
 *
 * @param descriptor - Command metadata built from the Commander tree and generated route metadata.
 * @param positionalValues - Identity argument values captured from Commander, in descriptor order.
 * @param inputText - Optional inline JSON argument provided by the user.
 * @param options - Global `mastra api` flags such as target URL, headers, timeout, schema, and pretty output.
 */
export async function executeDescriptor(
  descriptor: ApiCommandDescriptor,
  positionalValues: string[],
  inputText: string | undefined,
  options: ApiGlobalOptions,
): Promise<void> {
  try {
    const target = await resolveTarget(options);

    if (options.schema) {
      // Schema output is a discovery path, so it intentionally skips required argument validation.
      writeJson(await getCommandSchema(descriptor, target), options.pretty);
      return;
    }

    const input = parseInput(descriptor, inputText);
    const pathParams = resolvePathParams(descriptor, positionalValues, input);
    // Do not send IDs twice when a route path param was supplied through JSON input.
    const requestInput = stripPathParamsFromInput(input, pathParams);

    const response = await requestApi({
      baseUrl: target.baseUrl,
      headers: target.headers,
      timeoutMs: descriptor.defaultTimeoutMs && !options.timeout ? descriptor.defaultTimeoutMs : target.timeoutMs,
      descriptor,
      pathParams,
      input: requestInput,
    });
    const normalized = normalizeData(descriptor, normalizeResponse(response));
    writeJson(normalizeSuccess(normalized, descriptor.list, descriptor.responseShape), options.pretty);
  } catch (error) {
    const apiError = error instanceof ApiCliError ? error : toApiCliError(error);
    writeJson(errorEnvelope(apiError), options.pretty, process.stderr);
    process.exitCode = 1;
  }
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
