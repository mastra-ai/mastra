import type {
  Agent,
  AgentExecutionOptions,
  StructuredOutputOptions,
} from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { CoreMessage } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import type {
  ChunkType,
  FullOutput,
  MastraModelOutput,
  MastraOnFinishCallback,
} from '@mastra/core/stream';
import * as clients from '@restatedev/restate-sdk-clients';
import type { Ingress } from '@restatedev/restate-sdk-clients';

import { serializeMessages, serializeOptions } from '../serde';
import type {
  RestateAgentRunResult,
  RestateApprovalResolution,
  RestateRunState,
  RestateStreamEvent,
} from '../types';
import { rebuildOutput } from './output-bridge';
import { createRestateAgentService } from './restate-agent-service';
import type { RestateAgentService } from './restate-agent-service';

export interface CreateRestateAgentOptions {
  agent: Agent<any, any, any>;
  restate: Ingress | { url: string };
  id?: string;
  name?: string;
  serviceName?: string;
  mastra?: Mastra;
  maxRetryAttempts?: number;
}

export interface RestateAgentStreamOptions<OUTPUT = undefined> {
  instructions?: string;
  context?: CoreMessage[];
  memory?: { thread?: string; resource?: string };
  runId?: string;
  requestContext?: Record<string, unknown>;
  maxSteps?: number;
  stopWhen?: unknown;
  toolsets?: string[];
  clientTools?: string[];
  toolChoice?: string;
  activeTools?: string[];
  modelSettings?: Record<string, unknown>;
  requireToolApproval?: boolean;
  autoResumeSuspendedTools?: boolean;
  toolCallConcurrency?: number;
  includeRawChunks?: boolean;
  maxProcessorRetries?: number;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  versions?: Record<string, string>;
  system?: string;
  disableBackgroundTasks?: boolean;
  model?: string;
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  onStepFinish?: (result: unknown) => void | Promise<void>;
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
  onSuspended?: (data: unknown) => void | Promise<void>;
  onAbort?: AgentExecutionOptions<OUTPUT>['onAbort'];
  abortSignal?: AbortSignal;
}

export interface RestateAgentStreamResult<OUTPUT = undefined> {
  output: MastraModelOutput<OUTPUT>;
  readonly fullStream: ReadableStream<any>;
  runId: string;
  threadId?: string;
  resourceId?: string;
  cleanup: () => void;
  abort: (reason?: unknown) => Promise<void>;
}

export interface RestateAgentResumeOptions<OUTPUT = undefined> {
  threadId?: string;
  resourceId?: string;
  toolCallId?: string;
  requestContext?: Record<string, unknown>;
  actor?: AgentExecutionOptions<OUTPUT>['actor'];
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  onStepFinish?: (result: unknown) => void | Promise<void>;
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
  onSuspended?: (data: unknown) => void | Promise<void>;
  onAbort?: AgentExecutionOptions<OUTPUT>['onAbort'];
  abortSignal?: AbortSignal;
}

export interface RestateAgent<OUTPUT = undefined> {
  readonly id: string;
  readonly name: string;
  readonly agent: Agent<any, any, OUTPUT>;
  readonly restate: Ingress;
  readonly serviceName: string;

  stream(
    messages: MessageListInput,
    options?: RestateAgentStreamOptions<OUTPUT>,
  ): Promise<RestateAgentStreamResult<OUTPUT>>;

  resume(
    runId: string,
    resumeData: unknown,
    options?: RestateAgentResumeOptions<OUTPUT>,
  ): Promise<RestateAgentStreamResult<OUTPUT>>;

  prepare(messages: MessageListInput, options?: AgentExecutionOptions<OUTPUT>): Promise<{
    runId: string;
    messageId: string;
    threadId?: string;
    resourceId?: string;
  }>;

  observe(
    runId: string,
    options?: {
      onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
      onStepFinish?: (result: unknown) => void | Promise<void>;
      onFinish?: MastraOnFinishCallback<OUTPUT>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
      onSuspended?: (data: unknown) => void | Promise<void>;
    },
  ): Promise<{ runId: string; events: RestateStreamEvent[]; result?: RestateAgentRunResult }>;

  recover(runId: string, options?: unknown): Promise<never>;
  listActiveRuns(options?: unknown): Promise<never>;
  recoverActiveRuns(options?: unknown): Promise<{ recovered: never[]; succeeded: number; failed: number }>;

  getDurableWorkflows(): [];
  readonly durableLoopWorkflowName: string;
  __setMastra(mastra: Mastra): void;

  generate(messages: MessageListInput, options?: RestateAgentStreamOptions<OUTPUT>): Promise<FullOutput<OUTPUT>>;
  resumeGenerate(
    runId: string,
    resumeData: unknown,
    options?: RestateAgentResumeOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>>;

  getDescription(): string;
  getInstructions(...args: any[]): any;
  listTools(...args: any[]): any;
  getLLM(...args: any[]): any;
  getModel(...args: any[]): any;
  getMemory(...args: any[]): any;
  hasOwnMemory(): boolean;
  getWorkspace(...args: any[]): any;
  listAgents(...args: any[]): any;
  listWorkflows(...args: any[]): any;
  getDefaultOptions(...args: any[]): any;
  getModelList(...args: any[]): any;
  getConfiguredProcessorWorkflows(...args: any[]): any;
  toRawConfig(...args: any[]): any;

  approveToolCall(options: { runId: string; toolCallId?: string } & Record<string, any>): Promise<MastraModelOutput<OUTPUT>>;
  declineToolCall(
    options: { runId: string; toolCallId?: string; reason?: string } & Record<string, any>,
  ): Promise<MastraModelOutput<OUTPUT>>;

  [key: string]: any;
}

function isRestateAgentGuard(obj: unknown): obj is RestateAgent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    '__isRestateAgent' in obj &&
    (obj as any).__isRestateAgent === true
  );
}

export function isRestateAgent(obj: unknown): obj is RestateAgent {
  return isRestateAgentGuard(obj);
}

export function createRestateAgent<TOutput = undefined>(
  options: CreateRestateAgentOptions,
): RestateAgent<TOutput> {
  const { agent, id: idOverride, name: nameOverride, serviceName, mastra: mastraOption, maxRetryAttempts } = options;
  const ingress: Ingress =
    'serviceClient' in options.restate ? options.restate : clients.connect({ url: (options.restate as { url: string }).url });

  const { service, serviceName: resolvedServiceName } = createRestateAgentService({
    agent,
    serviceName,
    mastra: mastraOption,
    maxRetryAttempts,
  });

  const id = idOverride ?? agent.id;
  const name = nameOverride ?? agent.name ?? agent.id;

  let mastra: Mastra | undefined = mastraOption;

  const getClient = () =>
    ingress.serviceClient({ name: resolvedServiceName }) as unknown as {
      run(request: {
        runId: string;
        messages: CoreMessage[];
        options: import('../types').RestateSerializableOptions;
        resumeData?: unknown;
      }): Promise<{
        status: string;
        runId: string;
        result: RestateAgentRunResult;
      }>;
      getRun(request: { runId: string }): Promise<RestateRunState | null>;
      resolveAwakeable(request: { awakeableId: string; resolution: RestateApprovalResolution }): Promise<{ ok: boolean }>;
      rejectAwakeable(request: { awakeableId: string; reason?: string }): Promise<{ ok: boolean }>;
    };

  const buildExecOptions = (opts: RestateAgentStreamOptions<any> | undefined) => {
    return serializeOptions(opts as AgentExecutionOptions<any>);
  };

  const stream = async (
    messages: MessageListInput,
    opts?: RestateAgentStreamOptions<TOutput>,
  ): Promise<RestateAgentStreamResult<TOutput>> => {
    const runId = opts?.runId ?? crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const wireMessages = serializeMessages(messages);
    const wireOptions = buildExecOptions(opts);

    const response = await getClient().run({
      runId,
      messages: wireMessages,
      options: wireOptions,
    });

    const output = rebuildOutput(response.result, { runId, messageId, messages: wireMessages });

    return {
      output: output as MastraModelOutput<TOutput>,
      get fullStream() {
        return output.fullStream as ReadableStream<any>;
      },
      runId,
      cleanup: () => {},
      abort: async (reason?: unknown) => {
        await abortRun(runId, reason);
      },
    };
  };

  const resume = async (
    runId: string,
    resumeData: unknown,
    _opts?: RestateAgentResumeOptions<TOutput>,
  ): Promise<RestateAgentStreamResult<TOutput>> => {
    const response = await getClient().run({
      runId,
      messages: [],
      options: {},
      resumeData,
    });

    const messageId = crypto.randomUUID();
    const output = rebuildOutput(response.result, { runId, messageId, messages: [] });

    return {
      output: output as MastraModelOutput<TOutput>,
      get fullStream() {
        return output.fullStream as ReadableStream<any>;
      },
      runId,
      cleanup: () => {},
      abort: async (reason?: unknown) => {
        await abortRun(runId, reason);
      },
    };
  };

  const observe = async (
    runId: string,
    _options?: {
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: unknown) => void | Promise<string>;
      onFinish?: MastraOnFinishCallback<TOutput>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
      onSuspended?: (data: unknown) => void | Promise<void>;
    },
  ): Promise<{ runId: string; events: RestateStreamEvent[]; result?: RestateAgentRunResult }> => {
    const run = await getClient().getRun({ runId });
    return { runId, events: run?.events ?? [], result: run?.result };
  };

  const prepare = async (messages: MessageListInput, opts?: AgentExecutionOptions<TOutput>) => {
    const runId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const memory = (opts as any)?.memory;
    return {
      runId,
      messageId,
      threadId: typeof memory?.thread === 'string' ? memory.thread : undefined,
      resourceId: memory?.resource as string | undefined,
    };
  };

  const abortRun = async (runId: string, _reason?: unknown): Promise<void> => {
    const run = await getClient().getRun({ runId });
    if (run?.awakeableId) {
      await getClient().rejectAwakeable({ awakeableId: run.awakeableId, reason: 'Run aborted' });
    }
  };

  const approveToolCall = async (options: { runId: string; toolCallId?: string }): Promise<MastraModelOutput> => {
    const { runId, toolCallId } = options;
    const run = (await getClient().getRun({ runId })) as RestateRunState | null;
    if (!run?.awakeableId) {
      throw new MastraError({
        id: 'RESTATE_AGENT_NO_PENDING_APPROVAL',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `No pending approval found for run "${runId}".`,
        details: { runId },
      });
    }
    const resolution: RestateApprovalResolution = { approved: true, toolCallId: toolCallId ?? run.toolCall?.toolCallId };
    await getClient().resolveAwakeable({ awakeableId: run.awakeableId, resolution });
    return undefined as any;
  };

  const declineToolCall = async (options: {
    runId: string;
    toolCallId?: string;
    reason?: string;
  }): Promise<MastraModelOutput> => {
    const { runId, toolCallId } = options;
    const run = (await getClient().getRun({ runId })) as RestateRunState | null;
    if (!run?.awakeableId) {
      throw new MastraError({
        id: 'RESTATE_AGENT_NO_PENDING_APPROVAL',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `No pending approval found for run "${runId}".`,
        details: { runId },
      });
    }
    const resolution: RestateApprovalResolution = { approved: false, toolCallId: toolCallId ?? run.toolCall?.toolCallId };
    await getClient().rejectAwakeable({ awakeableId: run.awakeableId, reason: options.reason ?? 'Declined' });
    return undefined as any;
  };

  const generate = async (
    messages: MessageListInput,
    opts?: RestateAgentStreamOptions<TOutput>,
  ): Promise<FullOutput<TOutput>> => {
    const runId = opts?.runId ?? crypto.randomUUID();
    const wireMessages = serializeMessages(messages);
    const wireOptions = buildExecOptions(opts);
    const response = await getClient().run({ runId, messages: wireMessages, options: wireOptions });
    return {
      text: response.result.text,
      steps: response.result.steps,
      usage: response.result.usage,
      finishReason: response.result.finishReason as any,
      suspendPayload: response.result.suspendPayload,
      warnings: response.result.warnings,
    } as FullOutput<TOutput>;
  };

  const resumeGenerate = async (
    runId: string,
    resumeData: unknown,
    _opts?: RestateAgentResumeOptions<TOutput>,
  ): Promise<FullOutput<TOutput>> => {
    const response = await getClient().run({ runId, messages: [], options: {}, resumeData });
    return {
      text: response.result.text,
      steps: response.result.steps,
      usage: response.result.usage,
      finishReason: response.result.finishReason as any,
      suspendPayload: response.result.suspendPayload,
      warnings: response.result.warnings,
    } as FullOutput<TOutput>;
  };

  const recover = async (_runId: string, _options?: unknown): Promise<never> => {
    throw new MastraError({
      id: 'RESTATE_AGENT_RECOVER_NOT_SUPPORTED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `RestateAgent.recover() is not supported. Restate owns durability for this agent: use observe(runId) to reconnect to a running run's events.`,
    });
  };

  const listActiveRuns = async (_options?: unknown): Promise<never> => {
    throw new MastraError({
      id: 'RESTATE_AGENT_LIST_ACTIVE_RUNS_NOT_SUPPORTED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `RestateAgent.listActiveRuns() is not supported. Use the Restate UI or admin API to list invocations.`,
    });
  };

  const recoverActiveRuns = async (_options?: unknown): Promise<{ recovered: never[]; succeeded: number; failed: number }> => {
    return { recovered: [], succeeded: 0, failed: 0 };
  };

  const __setMastra = (m: Mastra) => {
    mastra = m;
  };

  const base = {
    __isRestateAgent: true,
    id,
    name,
    agent,
    restate: ingress,
    serviceName: resolvedServiceName,
    stream: stream as any,
    resume: resume as any,
    prepare: prepare as any,
    observe: observe as any,
    recover,
    listActiveRuns,
    recoverActiveRuns,
    getDurableWorkflows: () => [],
    durableLoopWorkflowName: `restate:${resolvedServiceName}`,
    __setMastra,
    generate: generate as any,
    resumeGenerate: resumeGenerate as any,
    approveToolCall: approveToolCall as any,
    declineToolCall: declineToolCall as any,
  };

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      const value = (agent as any)[prop];
      if (typeof value === 'function') {
        return value.bind(agent);
      }
      return value;
    },
  }) as unknown as RestateAgent<TOutput>;
}
