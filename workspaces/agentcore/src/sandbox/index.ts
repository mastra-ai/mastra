/**
 * AWS Bedrock AgentCore Runtime sandbox provider.
 *
 * This provider maps Mastra's one-shot command execution contract to
 * InvokeAgentRuntimeCommand. It intentionally does not expose process
 * management or filesystem mounts because AgentCore Runtime command execution
 * does not provide those WorkspaceSandbox semantics.
 *
 * @see https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-execute-command.html
 */

import { randomUUID } from 'node:crypto';
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommandCommand,
  StopRuntimeSessionCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import type { RequestContext } from '@mastra/core/di';
import type {
  CommandResult,
  ExecuteCommandOptions,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxInfo,
} from '@mastra/core/workspace';
import { MastraSandbox, ProcessHandle } from '@mastra/core/workspace';

const LOG_PREFIX = '[AgentCoreRuntimeSandbox]';
const DEFAULT_COMMAND_TIMEOUT_MS = 300_000;
const MAX_AGENTCORE_TIMEOUT_SECONDS = 3600;
const DEFAULT_ACCEPT = 'application/vnd.amazon.eventstream';
const DEFAULT_CONTENT_TYPE = 'application/json';

type AgentCoreRuntimeClient = Pick<BedrockAgentCoreClient, 'send' | 'destroy'>;
type InstructionsOption = string | ((opts: { defaultInstructions: string; requestContext?: RequestContext }) => string);
type AgentCoreStreamException = {
  name?: string;
  message?: string;
};

type AgentCoreStreamEvent = {
  chunk?: {
    contentStart?: unknown;
    contentDelta?: {
      stdout?: string;
      stderr?: string;
    };
    contentStop?: {
      exitCode?: number;
      status?: string;
    };
  };
  accessDeniedException?: AgentCoreStreamException;
  internalServerException?: AgentCoreStreamException;
  resourceNotFoundException?: AgentCoreStreamException;
  serviceQuotaExceededException?: AgentCoreStreamException;
  throttlingException?: AgentCoreStreamException;
  validationException?: AgentCoreStreamException;
  runtimeClientError?: AgentCoreStreamException;
  $unknown?: [string, unknown];
};

class CommandOutputAccumulator extends ProcessHandle {
  readonly pid = 'agentcore-command';
  exitCode: number | undefined;

  async kill(): Promise<boolean> {
    return false;
  }

  async sendStdin(): Promise<void> {
    throw new Error('AgentCore Runtime command execution does not support stdin');
  }

  async wait(): Promise<CommandResult> {
    return {
      success: this.exitCode === 0,
      exitCode: this.exitCode ?? 1,
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: 0,
    };
  }
}

function shellQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function safeEnvName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function buildCommand(command: string, args: string[] | undefined, options: ExecuteCommandOptions | undefined): string {
  const baseCommand = args?.length ? `${command} ${args.map(arg => shellQuote(arg)).join(' ')}` : command;
  const parts: string[] = [];

  if (options?.cwd) {
    parts.push(`cd ${shellQuote(options.cwd)}`);
  }

  const env = options?.env ?? {};
  const envAssignments = Object.entries(env)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => {
      if (!safeEnvName(key)) {
        throw new Error(`Invalid environment variable name for AgentCore Runtime command: ${key}`);
      }
      return `${key}=${shellQuote(value)}`;
    });

  parts.push(`${envAssignments.length ? `${envAssignments.join(' ')} ` : ''}${baseCommand}`);
  return parts.join(' && ');
}

function toAgentCoreTimeoutSeconds(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('AgentCore Runtime command timeout must be a positive number of milliseconds');
  }

  const timeoutSeconds = Math.ceil(timeoutMs / 1000);
  if (timeoutSeconds > MAX_AGENTCORE_TIMEOUT_SECONDS) {
    throw new RangeError(`AgentCore Runtime command timeout must be at most ${MAX_AGENTCORE_TIMEOUT_SECONDS} seconds`);
  }

  return timeoutSeconds;
}

function generateSessionId(): string {
  return randomUUID();
}

function getStreamException(event: AgentCoreStreamEvent): { key: string; value: unknown } | undefined {
  const exceptionKeys = [
    'accessDeniedException',
    'internalServerException',
    'resourceNotFoundException',
    'serviceQuotaExceededException',
    'throttlingException',
    'validationException',
    'runtimeClientError',
  ] as const;

  for (const key of exceptionKeys) {
    const value = event[key];
    if (value) return { key, value };
  }

  if (event.$unknown) {
    return { key: event.$unknown[0], value: event.$unknown[1] };
  }

  return undefined;
}

function formatStreamException(key: string, value: unknown): string {
  if (value && typeof value === 'object') {
    const exception = value as AgentCoreStreamException;
    const name = exception.name ?? key;
    return exception.message ? `${name}: ${exception.message}` : name;
  }

  return `${key}: ${String(value)}`;
}

// =============================================================================
// Options
// =============================================================================

export interface AgentCoreRuntimeSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** AWS region for the Bedrock AgentCore client. Falls back to the AWS SDK default region chain. */
  region?: string;
  /** AgentCore Runtime ARN where commands should execute. */
  agentRuntimeArn: string;
  /** Runtime session ID. Defaults to a generated UUID, which satisfies AgentCore's 33 character minimum. */
  runtimeSessionId?: string;
  /** Agent runtime qualifier/endpoint. Defaults to AWS AgentCore's DEFAULT qualifier. */
  qualifier?: string;
  /** MIME type sent for command requests. */
  contentType?: string;
  /** Accept header for command event streams. */
  accept?: string;
  /** Default command timeout in milliseconds. */
  commandTimeout?: number;
  /**
   * Stop the AgentCore Runtime session during stop()/destroy().
   *
   * Defaults to false because sessions are often shared with agent invocations
   * outside the WorkspaceSandbox instance.
   */
  stopSessionOnLifecycle?: boolean;
  /** Client token used for StopRuntimeSession. Defaults to a generated UUID when needed. */
  stopClientToken?: string;
  /** Optional preconfigured AWS SDK client, primarily for advanced credential setup and tests. */
  client?: AgentCoreRuntimeClient;
  /** Custom instructions for getInstructions(). String replaces the default; function receives it. */
  instructions?: InstructionsOption;
}

// =============================================================================
// Implementation
// =============================================================================

export class AgentCoreRuntimeSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'AgentCoreRuntimeSandbox';
  readonly provider = 'agentcore';
  status: ProviderStatus = 'pending';

  private _client?: AgentCoreRuntimeClient;
  private readonly _ownsClient: boolean;
  private readonly _region?: string;
  private readonly _agentRuntimeArn: string;
  private readonly _runtimeSessionId: string;
  private readonly _qualifier?: string;
  private readonly _contentType: string;
  private readonly _accept: string;
  private readonly _commandTimeout: number;
  private readonly _stopSessionOnLifecycle: boolean;
  private readonly _stopClientToken?: string;
  private readonly _instructionsOverride?: InstructionsOption;
  private readonly _createdAt = new Date();
  private _lastUsedAt?: Date;

  constructor(options: AgentCoreRuntimeSandboxOptions) {
    super({ ...options, name: 'AgentCoreRuntimeSandbox' });

    if (!options.agentRuntimeArn) {
      throw new Error(`${LOG_PREFIX} agentRuntimeArn is required`);
    }

    this.id = options.runtimeSessionId ?? generateSessionId();
    this._agentRuntimeArn = options.agentRuntimeArn;
    this._runtimeSessionId = this.id;
    this._qualifier = options.qualifier;
    this._contentType = options.contentType ?? DEFAULT_CONTENT_TYPE;
    this._accept = options.accept ?? DEFAULT_ACCEPT;
    this._commandTimeout = options.commandTimeout ?? DEFAULT_COMMAND_TIMEOUT_MS;
    this._stopSessionOnLifecycle = options.stopSessionOnLifecycle ?? false;
    this._stopClientToken = options.stopClientToken;
    this._instructionsOverride = options.instructions;
    this._client = options.client;
    this._ownsClient = !options.client;
    this._region = options.region;
  }

  get runtimeSessionId(): string {
    return this._runtimeSessionId;
  }

  get agentRuntimeArn(): string {
    return this._agentRuntimeArn;
  }

  async start(): Promise<void> {
    this.logger.debug(`${LOG_PREFIX} Using AgentCore Runtime session ${this._runtimeSessionId}`);
  }

  async stop(): Promise<void> {
    if (!this._stopSessionOnLifecycle) return;
    await this.stopRuntimeSession();
  }

  async destroy(): Promise<void> {
    if (this._stopSessionOnLifecycle) {
      await this.stopRuntimeSession();
    }

    if (this._ownsClient && this._client) {
      this._client.destroy();
      this._client = undefined;
    }
  }

  /**
   * Explicitly stops the AgentCore Runtime session used by this sandbox.
   *
   * This is separate from destroy() because AgentCore Runtime sessions can be
   * shared with agent invocations outside the WorkspaceSandbox lifecycle.
   */
  async stopRuntimeSession(): Promise<void> {
    await this._getClient().send(
      new StopRuntimeSessionCommand({
        agentRuntimeArn: this._agentRuntimeArn,
        runtimeSessionId: this._runtimeSessionId,
        qualifier: this._qualifier,
        clientToken: this._stopClientToken ?? generateSessionId(),
      }),
    );
  }

  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    await this.ensureRunning();

    const fullCommand = buildCommand(command, args, options);
    const timeoutMs = options?.timeout ?? this._commandTimeout;
    const timeoutSeconds = toAgentCoreTimeoutSeconds(timeoutMs);
    const startTime = Date.now();
    const output = new CommandOutputAccumulator({
      maxRetainedBytes: options?.maxRetainedBytes ?? Infinity,
      onStdout: options?.onStdout,
      onStderr: options?.onStderr,
    });
    let stopStatus: string | undefined;

    this.logger.debug(`${LOG_PREFIX} Executing command`, {
      runtimeSessionId: this._runtimeSessionId,
      command: fullCommand,
      timeoutSeconds,
    });

    const response = await this._getClient().send(
      new InvokeAgentRuntimeCommandCommand({
        agentRuntimeArn: this._agentRuntimeArn,
        runtimeSessionId: this._runtimeSessionId,
        qualifier: this._qualifier,
        contentType: this._contentType,
        accept: this._accept,
        body: {
          command: fullCommand,
          timeout: timeoutSeconds,
        },
      }),
      { abortSignal: options?.abortSignal },
    );

    for await (const event of response.stream ?? []) {
      const streamEvent = event as AgentCoreStreamEvent;
      const streamException = getStreamException(streamEvent);
      if (streamException) {
        throw new Error(`${LOG_PREFIX} ${formatStreamException(streamException.key, streamException.value)}`);
      }

      const chunk = streamEvent.chunk;
      if (!chunk) continue;

      if (chunk.contentDelta?.stdout) {
        output.emitStdout(chunk.contentDelta.stdout);
      }

      if (chunk.contentDelta?.stderr) {
        output.emitStderr(chunk.contentDelta.stderr);
      }

      if (chunk.contentStop) {
        output.exitCode = chunk.contentStop.exitCode ?? 1;
        stopStatus = chunk.contentStop.status;
      }
    }

    const executionTimeMs = Date.now() - startTime;
    const exitCode = output.exitCode ?? 1;
    const timedOut = stopStatus === 'TIMED_OUT';
    const finalExitCode = timedOut ? 124 : exitCode;
    this._lastUsedAt = new Date();

    return {
      command: fullCommand,
      args,
      success: finalExitCode === 0 && !timedOut,
      exitCode: finalExitCode,
      stdout: output.stdout,
      stderr: output.stderr,
      executionTimeMs,
      timedOut,
      stdoutTruncated: output.stdoutTruncated,
      stderrTruncated: output.stderrTruncated,
      stdoutDroppedBytes: output.stdoutDroppedBytes,
      stderrDroppedBytes: output.stderrDroppedBytes,
    };
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    const defaultInstructions = this._getDefaultInstructions();
    if (this._instructionsOverride === undefined) return defaultInstructions;
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt,
      lastUsedAt: this._lastUsedAt,
      metadata: {
        agentRuntimeArn: this._agentRuntimeArn,
        runtimeSessionId: this._runtimeSessionId,
        qualifier: this._qualifier ?? 'DEFAULT',
        stopSessionOnLifecycle: this._stopSessionOnLifecycle,
      },
    };
  }

  private _getDefaultInstructions(): string {
    return [
      'AWS Bedrock AgentCore Runtime sandbox.',
      'Commands run inside the configured AgentCore Runtime session container.',
      'Command output streams from AgentCore Runtime as stdout and stderr.',
      'Limitations:',
      '- Commands are one-shot and non-interactive.',
      '- There is no persistent shell session between commands.',
      '- Background process management is not exposed by this provider.',
      '- Filesystem mounts are not exposed by this provider.',
      '- Developer tools such as git, npm, Python, or Node must exist in the AgentCore container image.',
      '- AgentCore Code Interpreter is a separate service and is not part of this runtime sandbox.',
    ].join('\n');
  }

  private _getClient(): AgentCoreRuntimeClient {
    if (!this._client) {
      this._client = new BedrockAgentCoreClient({ region: this._region });
    }
    return this._client;
  }
}
