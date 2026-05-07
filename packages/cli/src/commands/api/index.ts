import type { Command } from 'commander';
import { getAnalytics } from '../../analytics/index.js';
import { requestApi } from './client.js';
import { API_COMMANDS } from './commands.js';
import type { ApiCommandDescriptor } from './commands.js';
import { ApiCliError, errorEnvelope, toApiCliError } from './errors.js';
import { parseInput, resolvePathParams, stripPathParamsFromInput } from './input.js';
import { normalizeData } from './normalizers.js';
import { normalizeSuccess, writeJson } from './output.js';
import { normalizeResponse } from './response-normalizer.js';
import { buildCommandExamples, getCommandSchema } from './schema.js';
import { resolveTarget } from './target.js';
import type { ApiGlobalOptions } from './target.js';

const API_ANALYTICS_SHUTDOWN_TIMEOUT_MS = 1000;

export function registerApiCommand(program: Command): void {
  const api = program
    .command('api')
    .description('Call Mastra APIs')
    .option('--url <url>', 'target Mastra server URL')
    .option('--header <header>', 'custom HTTP header (repeatable)', collect, [])
    .option('--timeout <ms>', 'client-side request timeout')
    .option('--pretty', 'pretty-print JSON output', false);

  const agent = api.command('agent').description('List, inspect, and run agents');
  addAction(agent, 'list [input]', API_COMMANDS.agentList);
  addAction(agent, 'get [agentId]', API_COMMANDS.agentGet);
  addAction(agent, 'run [agentId] [input]', API_COMMANDS.agentRun);

  const workflow = api.command('workflow').description('List, inspect, and run workflows');
  addAction(workflow, 'list [input]', API_COMMANDS.workflowList);
  addAction(workflow, 'get [workflowId]', API_COMMANDS.workflowGet);
  const workflowRun = workflow.command('run').description('Manage workflow runs');
  addAction(workflowRun, 'start [workflowId] [input]', API_COMMANDS.workflowRunStart);
  addAction(workflowRun, 'list [workflowId] [input]', API_COMMANDS.workflowRunList);
  addAction(workflowRun, 'get [workflowId] [runId]', API_COMMANDS.workflowRunGet);
  addAction(workflowRun, 'resume [workflowId] [runId] [input]', API_COMMANDS.workflowRunResume);
  addAction(workflowRun, 'cancel [workflowId] [runId]', API_COMMANDS.workflowRunCancel);

  const tool = api.command('tool').description('List, inspect, and execute tools');
  addAction(tool, 'list [input]', API_COMMANDS.toolList);
  addAction(tool, 'get [toolId]', API_COMMANDS.toolGet);
  addAction(tool, 'execute [toolId] [input]', API_COMMANDS.toolExecute);

  const mcp = api.command('mcp').description('List and inspect MCP servers');
  addAction(mcp, 'list [input]', API_COMMANDS.mcpList);
  addAction(mcp, 'get [id]', API_COMMANDS.mcpGet);
  const mcpTool = mcp.command('tool').description('List, inspect, and execute MCP tools');
  addAction(mcpTool, 'list [serverId] [input]', API_COMMANDS.mcpToolList);
  addAction(mcpTool, 'get [serverId] [toolId]', API_COMMANDS.mcpToolGet);
  addAction(mcpTool, 'execute [serverId] [toolId] [input]', API_COMMANDS.mcpToolExecute);

  const thread = api.command('thread').description('Manage memory threads and messages');
  addAction(thread, 'list [input]', API_COMMANDS.threadList);
  addAction(thread, 'get [threadId]', API_COMMANDS.threadGet);
  addAction(thread, 'create [input]', API_COMMANDS.threadCreate);
  addAction(thread, 'update [threadId] [input]', API_COMMANDS.threadUpdate);
  addAction(thread, 'delete [threadId] [input]', API_COMMANDS.threadDelete);
  addAction(thread, 'messages [threadId] [input]', API_COMMANDS.threadMessages);

  const memory = api.command('memory').description('Search and manage agent memory');
  addAction(memory, 'search [input]', API_COMMANDS.memorySearch);
  const current = memory.command('current').description('Read and update working memory');
  addAction(current, 'get [input]', API_COMMANDS.memoryCurrentGet);
  addAction(current, 'update [input]', API_COMMANDS.memoryCurrentUpdate);
  addAction(memory, 'status [input]', API_COMMANDS.memoryStatus);

  const trace = api.command('trace').description('Inspect observability traces');
  addAction(trace, 'list [input]', API_COMMANDS.traceList);
  addAction(trace, 'get [traceId]', API_COMMANDS.traceGet);

  const log = api.command('log').description('Inspect runtime logs');
  addAction(log, 'list [input]', API_COMMANDS.logList);

  const score = api.command('score').description('Create, list, and inspect scores');
  addAction(score, 'create [input]', API_COMMANDS.scoreCreate);
  addAction(score, 'list [input]', API_COMMANDS.scoreList);
  addAction(score, 'get [scoreId]', API_COMMANDS.scoreGet);

  const dataset = api.command('dataset').description('Create, list, and inspect datasets');
  addAction(dataset, 'list [input]', API_COMMANDS.datasetList);
  addAction(dataset, 'get [datasetId]', API_COMMANDS.datasetGet);
  addAction(dataset, 'create [input]', API_COMMANDS.datasetCreate);
  addAction(dataset, 'items [datasetId] [input]', API_COMMANDS.datasetItems);

  const experiment = api.command('experiment').description('Run and inspect dataset experiments');
  addAction(experiment, 'list [datasetId] [input]', API_COMMANDS.experimentList);
  addAction(experiment, 'get [datasetId] [experimentId]', API_COMMANDS.experimentGet);
  addAction(experiment, 'run [datasetId] [input]', API_COMMANDS.experimentRun);
  addAction(experiment, 'results [datasetId] [experimentId] [input]', API_COMMANDS.experimentResults);
}

/** Registers a Commander subcommand and forwards its parsed positionals to the shared API executor. */
function addAction(parent: Command, name: string, descriptor: ApiCommandDescriptor): void {
  const command = parent.command(name).description(descriptor.description);
  const examples = buildCommandExamples(descriptor);

  if (examples.length > 0) {
    command.addHelpText('after', `\nExamples:\n${examples.map(example => `  ${example.command}`).join('\n')}`);
  }

  if (descriptor.acceptsInput) {
    command.option('--schema', 'print request schema for this command');
  }

  command.action(async (...args: unknown[]) => {
    const command = args.at(-1) as Command;
    const positionalValues = args.slice(0, -1).filter(value => typeof value === 'string') as string[];
    const identityValues = positionalValues.slice(0, descriptor.positionals.length);
    const maybeInput = descriptor.acceptsInput ? positionalValues[descriptor.positionals.length] : undefined;
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

async function shutdownApiAnalytics(analytics: ReturnType<typeof getAnalytics>): Promise<void> {
  if (!analytics) {
    return;
  }

  const exitTimer = setTimeout(() => {
    process.exit(process.exitCode ?? 0);
  }, API_ANALYTICS_SHUTDOWN_TIMEOUT_MS);

  try {
    await analytics.shutdown();
  } finally {
    clearTimeout(exitTimer);
  }
}

/** Executes an API command descriptor by resolving the target, handling schema output, and normalizing JSON responses or errors. */
export async function executeDescriptor(
  descriptor: ApiCommandDescriptor,
  positionalValues: string[],
  inputText: string | undefined,
  options: ApiGlobalOptions,
): Promise<void> {
  try {
    const target = await resolveTarget(options);

    if (options.schema) {
      writeJson(await getCommandSchema(descriptor, target), options.pretty);
      return;
    }

    const input = parseInput(descriptor, inputText);
    const pathParams = resolvePathParams(descriptor, positionalValues, input);
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
