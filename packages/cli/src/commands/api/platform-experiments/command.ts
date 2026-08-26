import type { Command as CommanderCommand } from 'commander';
import { ApiCliError, errorEnvelope, toApiCliError } from '../errors.js';
import { normalizeSuccess, writeJson } from '../output.js';
import { pollPlatformExperiment, requestPlatformExperiment } from './client.js';
import { parsePlatformExperimentRunInput } from './schemas.js';
import { resolvePlatformExperimentTarget } from './target.js';
import type { PlatformExperimentTargetOptions } from './target.js';

interface PlatformOptions extends PlatformExperimentTargetOptions {
  timeout?: string;
  pretty?: boolean;
  interval?: string;
  pollTimeout?: string;
}

interface RequestDefinition {
  method?: 'GET' | 'POST';
  path: (args: string[]) => string;
  list?: boolean;
  input?: 'none' | 'optional' | 'required' | 'run';
}

export function registerPlatformExperimentCommands(experiment: CommanderCommand): void {
  const platform = experiment
    .command('platform')
    .description('Run and inspect Platform-hosted experiments through the authenticated control plane')
    .option('--project <projectId>', 'Platform project ID (defaults to MASTRA_PROJECT_ID or .mastra-project.json)')
    .option('--organization <organizationId>', 'Platform organization ID (defaults to the authenticated organization)');

  addRequest(platform, 'list', [], 'List Platform-hosted experiment runs', {
    path: () => '',
    list: true,
    input: 'optional',
  });
  addRequest(platform, 'get', ['experimentId'], 'Get a Platform-hosted experiment run', {
    path: ([experimentId]) => `/${encodeURIComponent(experimentId!)}`,
  });
  addRequest(platform, 'run', [], 'Submit a Platform-hosted experiment run', {
    method: 'POST',
    path: () => '/runs',
    input: 'run',
  });
  addPoll(platform);
  addRequest(platform, 'results', ['experimentId'], 'List results for a Platform-hosted experiment run', {
    path: ([experimentId]) => `/${encodeURIComponent(experimentId!)}/results`,
    list: true,
    input: 'optional',
  });

  const dataset = platform.command('dataset').description('Discover immutable Platform-hosted datasets');
  addRequest(dataset, 'list', [], 'List hosted datasets', {
    path: () => '/assets/datasets',
    list: true,
    input: 'optional',
  });
  addRequest(dataset, 'versions', ['datasetId'], 'List immutable versions for a hosted dataset', {
    path: ([datasetId]) => `/assets/datasets/${encodeURIComponent(datasetId!)}/versions`,
    list: true,
    input: 'optional',
  });
  addRequest(dataset, 'version', ['datasetId', 'versionId'], 'Get an immutable hosted dataset version by ID', {
    path: ([datasetId, versionId]) =>
      `/assets/datasets/${encodeURIComponent(datasetId!)}/versions/${encodeURIComponent(versionId!)}`,
  });
  addRequest(dataset, 'version-number', ['datasetId', 'versionNumber'], 'Resolve a hosted dataset version number', {
    path: ([datasetId, versionNumber]) =>
      `/assets/datasets/${encodeURIComponent(datasetId!)}/versions/by-number/${encodeURIComponent(versionNumber!)}`,
  });

  const scorer = platform.command('scorer').description('Discover immutable Platform-hosted scorers');
  addRequest(scorer, 'list', [], 'List hosted scorers', {
    path: () => '/assets/scorers',
    list: true,
    input: 'optional',
  });
  addRequest(scorer, 'versions', ['definitionId'], 'List immutable versions for a hosted scorer', {
    path: ([definitionId]) => `/assets/scorers/${encodeURIComponent(definitionId!)}/versions`,
    list: true,
    input: 'optional',
  });
  addRequest(scorer, 'version', ['definitionId', 'versionId'], 'Get an immutable hosted scorer version', {
    path: ([definitionId, versionId]) =>
      `/assets/scorers/${encodeURIComponent(definitionId!)}/versions/${encodeURIComponent(versionId!)}`,
  });
}

function addRequest(
  parent: CommanderCommand,
  name: string,
  positionals: string[],
  description: string,
  definition: RequestDefinition,
): void {
  const command = parent.command(name).description(description);
  for (const positional of positionals) command.argument(`<${positional}>`);
  if (definition.input && definition.input !== 'none') {
    command.argument(definition.input === 'required' || definition.input === 'run' ? '<input>' : '[input]');
  }
  command.action(async (...values: unknown[]) => {
    const command = values.at(-1) as CommanderCommand;
    const args = values.slice(0, positionals.length) as Array<string | undefined>;
    const inputText =
      definition.input && definition.input !== 'none' ? (values[positionals.length] as string | undefined) : undefined;
    await executeRequest(
      definition,
      positionals.map((positional, index) => requireArgument(args[index], positional)),
      inputText,
      command.optsWithGlobals() as PlatformOptions,
    );
  });
}

async function executeRequest(
  definition: RequestDefinition,
  args: string[],
  inputText: string | undefined,
  options: PlatformOptions,
): Promise<void> {
  try {
    const target = await resolvePlatformExperimentTarget(options);
    const rawInput = parseJsonObject(inputText, definition.input === 'required' || definition.input === 'run');
    const input = definition.input === 'run' ? parsePlatformExperimentRunInput(rawInput) : rawInput;
    const response = await requestPlatformExperiment({
      target,
      path: definition.path(args),
      method: definition.method,
      input: input as Record<string, unknown> | undefined,
      timeoutMs: parsePositiveInteger(options.timeout, 30_000, '--timeout'),
    });
    writeJson(normalizeSuccess(response, definition.list ?? false), options.pretty ?? false);
  } catch (error) {
    writePlatformError(error, options.pretty ?? false);
  }
}

function addPoll(platform: CommanderCommand): void {
  platform
    .command('poll')
    .description('Poll a Platform-hosted experiment run until it reaches a terminal status')
    .argument('<experimentId>')
    .option('--interval <ms>', 'poll interval in milliseconds', '2000')
    .option('--poll-timeout <ms>', 'maximum total polling time in milliseconds', '600000')
    .action(async (experimentId, localOptions, command) => {
      const options = { ...command.optsWithGlobals(), ...localOptions } as PlatformOptions;
      try {
        const target = await resolvePlatformExperimentTarget(options);
        const response = await pollPlatformExperiment({
          target,
          experimentId: requireArgument(experimentId, 'experimentId'),
          intervalMs: parsePositiveInteger(options.interval, 2_000, '--interval'),
          pollTimeoutMs: parsePositiveInteger(options.pollTimeout, 600_000, '--poll-timeout'),
          requestTimeoutMs: parsePositiveInteger(options.timeout, 30_000, '--timeout'),
        });
        writeJson({ data: response }, options.pretty ?? false);
      } catch (error) {
        writePlatformError(error, options.pretty ?? false);
      }
    });
}

function parseJsonObject(value: string | undefined, required: boolean): Record<string, unknown> | undefined {
  if (!value) {
    if (required) throw new ApiCliError('MISSING_INPUT', 'This command requires a JSON object input');
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Input must be an object');
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new ApiCliError('INVALID_JSON', 'Input must be a valid JSON object', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function requireArgument(value: string | undefined, name: string): string {
  if (!value) throw new ApiCliError('MISSING_ARGUMENT', `Missing required argument: ${name}`, { argument: name });
  return value;
}

function parsePositiveInteger(value: string | undefined, fallback: number, flag: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiCliError('INVALID_JSON', `${flag} must be a positive integer`, { value });
  }
  return parsed;
}

function writePlatformError(error: unknown, pretty: boolean): void {
  const apiError = error instanceof ApiCliError ? error : toApiCliError(error);
  const body = apiError.details.body;
  if (apiError.code === 'HTTP_ERROR' && body && typeof body === 'object' && !Array.isArray(body)) {
    const platformBody = body as Record<string, unknown>;
    if (typeof platformBody.error === 'string') {
      writeJson(
        {
          error: {
            code: platformBody.error,
            message: typeof platformBody.message === 'string' ? platformBody.message : apiError.message,
            details: { status: apiError.details.status, ...platformBody },
          },
        },
        pretty,
        process.stderr,
      );
      process.exitCode = 1;
      return;
    }
  }
  writeJson(errorEnvelope(apiError), pretty, process.stderr);
  process.exitCode = 1;
}
