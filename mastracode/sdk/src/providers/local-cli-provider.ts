import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import type { GatewayLanguageModel } from '@mastra/core/llm';

export const LOCAL_CLAUDE_CLI_MODEL_ID = 'claude-code-sonnet';
export const LOCAL_CODEX_CLI_MODEL_ID = 'codex-cli';

const LOCAL_CLI_TIMEOUT_MS = 180_000;
const LOCAL_CLI_STATUS_TIMEOUT_MS = 8_000;
const MAX_COMMAND_OUTPUT_BYTES = 8 * 1024 * 1024;
const FORCE_KILL_DELAY_MS = 5_000;

type CliProviderId = 'anthropic' | 'openai';
type LocalCliLanguageModel = Extract<GatewayLanguageModel, { readonly specificationVersion: 'v3' }>;
type CliCallOptions = Parameters<LocalCliLanguageModel['doGenerate']>[0];
type CliGenerateResult = Awaited<ReturnType<LocalCliLanguageModel['doGenerate']>>;
type CliStreamResult = Awaited<ReturnType<LocalCliLanguageModel['doStream']>>;
type CliStreamPart = CliStreamResult['stream'] extends ReadableStream<infer Part> ? Part : never;
type CliUsage = CliGenerateResult['usage'];
type CliFunctionTool = Extract<NonNullable<CliCallOptions['tools']>[number], { type: 'function' }>;

type RunCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type RunCommandOptions = {
  cwd?: string;
  input?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
};

interface LocalCliStructuredOutput {
  text: string;
  toolCalls: Array<{
    toolName: string;
    inputJson: string;
  }>;
}

interface LocalCliResult extends LocalCliStructuredOutput {
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

interface LocalCliOutputSchema {
  type: 'object';
  additionalProperties: false;
  properties: {
    text: { type: 'string' };
    toolCalls: {
      type: 'array';
      minItems?: number;
      maxItems?: number;
      items: {
        type: 'object';
        additionalProperties: false;
        properties: {
          toolName: { type: 'string'; enum?: string[] };
          inputJson: { type: 'string' };
        };
        required: ['toolName', 'inputJson'];
      };
    };
  };
  required: ['text', 'toolCalls'];
}

let statusCache: { expiresAt: number; value: Promise<{ claude: boolean; codex: boolean }> } | undefined;

function getCliSearchPaths(): string[] {
  const home = homedir();
  return [
    join(home, '.local/bin'),
    join(home, '.codex/packages/standalone/current/bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
  ];
}

function getCliEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const path = [...getCliSearchPaths(), env.PATH].filter(Boolean).join(':');
  return { ...env, PATH: path };
}

function resolveCommandPath(command: string): string {
  if (command.includes('/')) return command;
  for (const dir of getCliSearchPaths()) {
    const candidate = join(dir, command);
    if (existsSync(candidate)) return candidate;
  }
  return command;
}

function isRuntimeCliDiscoveryEnabled(): boolean {
  if (process.env.MASTRACODE_DISABLE_LOCAL_CLI_MODELS === '1') return false;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return process.env.MASTRACODE_ENABLE_LOCAL_CLI_MODELS === '1';
  }
  return true;
}

function commandFailureMessage(command: string, args: string[], result: RunCommandResult): string {
  const safeArgs = args.map((arg, index) => (args[index - 1] === '--json-schema' ? '<schema>' : arg));
  const output = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n').trim();
  return `${command} ${safeArgs.join(' ')} failed with exit code ${result.exitCode}${output ? `:\n${output}` : ''}`;
}

function runCommand(command: string, args: string[], options: RunCommandOptions = {}): Promise<RunCommandResult> {
  return new Promise((resolveCommand, reject) => {
    const commandPath = resolveCommandPath(command);
    const child = spawn(commandPath, args, {
      cwd: options.cwd,
      env: getCliEnv(options.env),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let aborted = false;
    let failure: Error | undefined;
    let forceKillTimer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      clearTimeout(timeout);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      options.signal?.removeEventListener('abort', onAbort);
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const terminate = () => {
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), FORCE_KILL_DELAY_MS);
      forceKillTimer.unref();
    };

    const append = (kind: 'stdout' | 'stderr', chunk: Buffer) => {
      const current = kind === 'stdout' ? stdout : stderr;
      const next = current + chunk.toString('utf8');
      if (Buffer.byteLength(next, 'utf8') > MAX_COMMAND_OUTPUT_BYTES) {
        failure = new Error(`${command} produced too much output`);
        terminate();
        return;
      }
      if (kind === 'stdout') stdout = next;
      else stderr = next;
    };

    const onAbort = () => {
      aborted = true;
      terminate();
    };

    const timeoutMs = options.timeoutMs ?? LOCAL_CLI_TIMEOUT_MS;
    const timeout = setTimeout(() => {
      timedOut = true;
      terminate();
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => append('stdout', chunk));
    child.stderr.on('data', (chunk: Buffer) => append('stderr', chunk));
    child.stdin.on('error', () => undefined);
    child.on('error', error => {
      settle(() => reject(error));
    });
    child.on('close', code => {
      settle(() => {
        if (failure) return reject(failure);
        if (aborted) return reject(new Error(`${command} was aborted`));
        if (timedOut) return reject(new Error(`${command} timed out after ${timeoutMs}ms`));
        resolveCommand({ stdout, stderr, exitCode: code ?? 0 });
      });
    });

    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    child.stdin.end(options.input);
  });
}

async function safeRunCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<RunCommandResult | null> {
  try {
    const result = await runCommand(command, args, options);
    return result.exitCode === 0 ? result : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function usageFromCliText(
  input: string,
  output: LocalCliStructuredOutput,
  reported?: LocalCliResult['usage'],
): CliUsage {
  const serializedOutput = JSON.stringify(output);
  const inputTokens = reported?.inputTokens ?? Math.max(1, Math.ceil(input.length / 4));
  const outputTokens = reported?.outputTokens ?? Math.max(1, Math.ceil(serializedOutput.length / 4));
  return {
    inputTokens: {
      total: inputTokens,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
      reasoning: undefined,
    },
  };
}

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  const chunks: string[] = [];
  for (const part of content) {
    if (!isRecord(part)) continue;
    if (part.type === 'text' && typeof part.text === 'string') {
      chunks.push(part.text);
    } else if (part.type === 'reasoning' && typeof part.text === 'string') {
      chunks.push(`<reasoning>${part.text}</reasoning>`);
    } else if (part.type === 'tool-call') {
      chunks.push(`[tool call: ${String(part.toolName ?? 'unknown')}] ${String(part.input ?? '')}`);
    } else if (part.type === 'tool-result') {
      chunks.push(
        `[tool result: ${String(part.toolName ?? 'unknown')}] ${JSON.stringify(part.output ?? part.result ?? '')}`,
      );
    } else if (part.type === 'file') {
      chunks.push(`[file: ${String(part.mediaType ?? 'unknown')}]`);
    }
  }
  return chunks.join('\n');
}

function formatConversation(options: CliCallOptions): string {
  return options.prompt
    .map(message => {
      const content = stringifyContent(message.content).trim();
      if (!content) return '';
      return `<${message.role}>\n${content}\n</${message.role}>`;
    })
    .filter(Boolean)
    .join('\n\n');
}

function getFunctionTools(options: CliCallOptions): CliFunctionTool[] {
  return (options.tools ?? []).filter((tool): tool is CliFunctionTool => tool.type === 'function');
}

function getAllowedTools(options: CliCallOptions, tools: CliFunctionTool[]): CliFunctionTool[] {
  const toolChoice = options.toolChoice;
  if (toolChoice?.type === 'none') return [];
  if (toolChoice?.type !== 'tool') return tools;
  const selected = tools.find(tool => tool.name === toolChoice.toolName);
  if (!selected) throw new Error(`Requested local CLI tool is unavailable: ${toolChoice.toolName}`);
  return [selected];
}

function buildStructuredOutputSchema(options: CliCallOptions): LocalCliOutputSchema {
  const tools = getAllowedTools(options, getFunctionTools(options));
  if (options.toolChoice?.type === 'required' && tools.length === 0) {
    throw new Error('A tool call was required, but no function tools are available');
  }

  const toolCalls: LocalCliOutputSchema['properties']['toolCalls'] = {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        toolName: {
          type: 'string',
          ...(tools.length ? { enum: tools.map(tool => tool.name) } : {}),
        },
        inputJson: { type: 'string' },
      },
      required: ['toolName', 'inputJson'],
    },
  };
  if (tools.length === 0) toolCalls.maxItems = 0;
  if (options.toolChoice?.type === 'required' || options.toolChoice?.type === 'tool') toolCalls.minItems = 1;

  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: { type: 'string' },
      toolCalls,
    },
    required: ['text', 'toolCalls'],
  };
}

function formatToolInstructions(options: CliCallOptions): string {
  const tools = getAllowedTools(options, getFunctionTools(options));
  if (tools.length === 0) return 'No tool calls are allowed for this response.';

  const choice =
    options.toolChoice?.type === 'required'
      ? 'You must call at least one tool.'
      : options.toolChoice?.type === 'tool'
        ? `You must call ${options.toolChoice.toolName}.`
        : 'Call tools when they are needed; otherwise return a final answer.';
  const definitions = tools
    .map(
      tool =>
        `Tool ${tool.name}\nDescription: ${tool.description ?? '(none)'}\nInput JSON Schema: ${JSON.stringify(tool.inputSchema)}`,
    )
    .join('\n\n');
  return `${choice}\n\n${definitions}`;
}

function formatResponseInstructions(options: CliCallOptions): string {
  if (options.responseFormat?.type !== 'json') return 'Put the final user-facing answer in text.';
  return [
    'The final answer must be JSON. Put its serialized JSON value in text.',
    options.responseFormat.schema ? `Required JSON Schema: ${JSON.stringify(options.responseFormat.schema)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatPromptForCli(options: CliCallOptions): string {
  const conversation = formatConversation(options);
  if (!conversation) throw new Error('Cannot call a local CLI model with an empty prompt');

  return [
    'You are the language-model backend for MastraCode. Mastra owns every tool, permission, and file change.',
    'Do not inspect the workspace or run built-in CLI tools. Use only the conversation and tool definitions below.',
    'Return the schema object directly. Use an empty toolCalls array for a final answer.',
    'For each tool call, set inputJson to a valid serialized JSON value matching that tool input schema.',
    'When toolCalls is non-empty, text may contain a short lead-in but must not claim the tool already ran.',
    formatResponseInstructions(options),
    '<available_tools>',
    formatToolInstructions(options),
    '</available_tools>',
    '<conversation>',
    conversation,
    '</conversation>',
  ].join('\n\n');
}

function parseStructuredOutput(value: unknown, options: CliCallOptions): LocalCliStructuredOutput {
  if (!isRecord(value) || typeof value.text !== 'string' || !Array.isArray(value.toolCalls)) {
    throw new Error('Local CLI returned an invalid structured response');
  }

  const allowedTools = new Set(getAllowedTools(options, getFunctionTools(options)).map(tool => tool.name));
  const toolCalls = value.toolCalls.map((toolCall, index) => {
    if (!isRecord(toolCall) || typeof toolCall.toolName !== 'string' || typeof toolCall.inputJson !== 'string') {
      throw new Error(`Local CLI returned an invalid tool call at index ${index}`);
    }
    if (!allowedTools.has(toolCall.toolName)) {
      throw new Error(`Local CLI requested unavailable tool: ${toolCall.toolName}`);
    }
    try {
      JSON.parse(toolCall.inputJson);
    } catch (error) {
      throw new Error(`Local CLI returned invalid JSON for tool ${toolCall.toolName}`, { cause: error });
    }
    return { toolName: toolCall.toolName, inputJson: toolCall.inputJson };
  });

  if ((options.toolChoice?.type === 'required' || options.toolChoice?.type === 'tool') && toolCalls.length === 0) {
    throw new Error('Local CLI did not return the required tool call');
  }
  if (toolCalls.length === 0 && !value.text.trim()) {
    throw new Error('Local CLI completed without text or tool calls');
  }
  return { text: value.text.trim(), toolCalls };
}

function parseClaudeUsage(value: Record<string, unknown>): LocalCliResult['usage'] | undefined {
  if (!isRecord(value.usage)) return undefined;
  const inputTokens = value.usage.input_tokens;
  const outputTokens = value.usage.output_tokens;
  if (typeof inputTokens !== 'number' || typeof outputTokens !== 'number') return undefined;

  const cacheRead = typeof value.usage.cache_read_input_tokens === 'number' ? value.usage.cache_read_input_tokens : 0;
  const cacheCreation =
    typeof value.usage.cache_creation_input_tokens === 'number' ? value.usage.cache_creation_input_tokens : 0;
  return { inputTokens: inputTokens + cacheRead + cacheCreation, outputTokens };
}

async function runCodexCli(
  prompt: string,
  schema: LocalCliOutputSchema,
  options: { signal?: AbortSignal; callOptions: CliCallOptions },
): Promise<LocalCliResult> {
  const dir = await mkdtemp(join(tmpdir(), 'mastracode-codex-cli-'));
  const outputFile = join(dir, 'response.json');
  const schemaFile = join(dir, 'response-schema.json');
  try {
    await writeFile(schemaFile, JSON.stringify(schema), 'utf8');
    const args = [
      'exec',
      '--ignore-user-config',
      '--strict-config',
      '--skip-git-repo-check',
      '--ephemeral',
      '--sandbox',
      'read-only',
      '-C',
      dir,
      '--output-schema',
      schemaFile,
      '-o',
      outputFile,
      '-',
    ];
    const result = await runCommand('codex', args, { cwd: dir, input: prompt, signal: options.signal });
    if (result.exitCode !== 0) throw new Error(commandFailureMessage('codex', args, result));
    const raw = (await readFile(outputFile, 'utf8')).trim();
    if (!raw) throw new Error('codex exec completed without a final message');
    return parseStructuredOutput(JSON.parse(raw), options.callOptions);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runClaudeCli(
  modelId: string,
  prompt: string,
  schema: LocalCliOutputSchema,
  options: { signal?: AbortSignal; callOptions: CliCallOptions },
): Promise<LocalCliResult> {
  const dir = await mkdtemp(join(tmpdir(), 'mastracode-claude-cli-'));
  const model = modelId === LOCAL_CLAUDE_CLI_MODEL_ID ? 'sonnet' : modelId;
  const args = [
    '-p',
    '--safe-mode',
    '--model',
    model,
    '--output-format',
    'json',
    '--no-session-persistence',
    '--strict-mcp-config',
    '--tools',
    '',
    '--json-schema',
    JSON.stringify(schema),
  ];
  try {
    const result = await runCommand('claude', args, { cwd: dir, input: prompt, signal: options.signal });
    if (result.exitCode !== 0) throw new Error(commandFailureMessage('claude', args, result));
    const parsed: unknown = JSON.parse(result.stdout.trim());
    if (!isRecord(parsed)) throw new Error('claude returned an invalid JSON envelope');
    if (parsed.is_error === true) throw new Error(`claude returned an error: ${JSON.stringify(parsed)}`);

    let structuredOutput = parsed.structured_output;
    if (!structuredOutput && typeof parsed.result === 'string') {
      structuredOutput = JSON.parse(parsed.result);
    }
    return {
      ...parseStructuredOutput(structuredOutput, options.callOptions),
      usage: parseClaudeUsage(parsed),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runLocalCliModel(
  providerId: CliProviderId,
  modelId: string,
  options: CliCallOptions,
  prompt: string,
): Promise<LocalCliResult> {
  const schema = buildStructuredOutputSchema(options);
  const callOptions = { signal: options.abortSignal, callOptions: options };

  if (providerId === 'openai' && modelId === LOCAL_CODEX_CLI_MODEL_ID) {
    return runCodexCli(prompt, schema, callOptions);
  }
  if (providerId === 'anthropic' && modelId === LOCAL_CLAUDE_CLI_MODEL_ID) {
    return runClaudeCli(modelId, prompt, schema, callOptions);
  }
  throw new Error(`Unsupported local CLI model: ${providerId}/${modelId}`);
}

function toGenerateResult(
  providerId: CliProviderId,
  modelId: string,
  prompt: string,
  result: LocalCliResult,
): CliGenerateResult {
  const content: CliGenerateResult['content'] = [];
  if (result.text) content.push({ type: 'text', text: result.text });
  for (const toolCall of result.toolCalls) {
    content.push({
      type: 'tool-call',
      toolCallId: `local-cli-${randomUUID()}`,
      toolName: toolCall.toolName,
      input: toolCall.inputJson,
      providerExecuted: false,
    });
  }
  const hasToolCalls = result.toolCalls.length > 0;
  return {
    content,
    finishReason: { unified: hasToolCalls ? 'tool-calls' : 'stop', raw: hasToolCalls ? 'tool-calls' : 'stop' },
    usage: usageFromCliText(prompt, result, result.usage),
    warnings: [],
    response: {
      id: `local-cli-${randomUUID()}`,
      timestamp: new Date(),
      modelId: `${providerId}/${modelId}`,
    },
  };
}

function createStreamFromResult(resultPromise: Promise<CliGenerateResult>): ReadableStream<CliStreamPart> {
  return new ReadableStream<CliStreamPart>({
    async start(controller) {
      try {
        const result = await resultPromise;
        controller.enqueue({ type: 'stream-start', warnings: result.warnings });
        controller.enqueue({ type: 'response-metadata', ...result.response });
        for (const part of result.content) {
          if (part.type === 'text') {
            const id = `text-${randomUUID()}`;
            controller.enqueue({ type: 'text-start', id });
            if (part.text) controller.enqueue({ type: 'text-delta', id, delta: part.text });
            controller.enqueue({ type: 'text-end', id });
          } else if (part.type === 'tool-call') {
            controller.enqueue(part);
          }
        }
        controller.enqueue({ type: 'finish', usage: result.usage, finishReason: result.finishReason });
        controller.close();
      } catch (error) {
        controller.enqueue({ type: 'error', error });
        controller.close();
      }
    },
  });
}

export function isLocalCliModel(providerId: string, modelId: string): providerId is CliProviderId {
  return (
    (providerId === 'anthropic' && modelId === LOCAL_CLAUDE_CLI_MODEL_ID) ||
    (providerId === 'openai' && modelId === LOCAL_CODEX_CLI_MODEL_ID)
  );
}

export function createLocalCliLanguageModel(providerId: CliProviderId, modelId: string): GatewayLanguageModel {
  const doGenerate: LocalCliLanguageModel['doGenerate'] = async callOptions => {
    const prompt = formatPromptForCli(callOptions);
    const result = await runLocalCliModel(providerId, modelId, callOptions, prompt);
    return toGenerateResult(providerId, modelId, prompt, result);
  };

  const model: LocalCliLanguageModel = {
    specificationVersion: 'v3',
    provider: `${providerId}-cli`,
    modelId,
    supportedUrls: {},
    doGenerate,
    async doStream(callOptions) {
      return { stream: createStreamFromResult(Promise.resolve(doGenerate(callOptions))) };
    },
  };
  return model;
}

async function isClaudeCliAuthenticated(): Promise<boolean> {
  const result = await safeRunCommand('claude', ['auth', 'status', '--json'], {
    timeoutMs: LOCAL_CLI_STATUS_TIMEOUT_MS,
  });
  if (!result) return false;
  try {
    const parsed: unknown = JSON.parse(result.stdout);
    return isRecord(parsed) && parsed.loggedIn === true;
  } catch {
    return false;
  }
}

async function isCodexCliAuthenticated(): Promise<boolean> {
  const result = await safeRunCommand('codex', ['login', 'status'], { timeoutMs: LOCAL_CLI_STATUS_TIMEOUT_MS });
  return Boolean(result && /logged in/i.test(`${result.stdout}\n${result.stderr}`));
}

export async function getLocalCliAuthStatus(): Promise<{ claude: boolean; codex: boolean }> {
  if (!isRuntimeCliDiscoveryEnabled()) return { claude: false, codex: false };

  const now = Date.now();
  if (statusCache && statusCache.expiresAt > now) return statusCache.value;

  statusCache = {
    expiresAt: now + 30_000,
    value: Promise.all([isClaudeCliAuthenticated(), isCodexCliAuthenticated()]).then(([claude, codex]) => ({
      claude,
      codex,
    })),
  };
  return statusCache.value;
}

export const __testing = {
  buildStructuredOutputSchema,
  formatPromptForCli,
  isRuntimeCliDiscoveryEnabled,
  parseStructuredOutput,
  runCommand,
};
