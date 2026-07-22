import type { AgentCard, Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@a2a-js/sdk';
import type { AgentExecutionOptionsBase } from '../agent/agent.types';
import { MessageList } from '../agent/message-list';
import type { MastraDBMessage, MessageListInput } from '../agent/message-list';
import { convertMessages } from '../agent/message-list/utils/convert-messages';
import type { SubAgent } from '../agent/subagent';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import { RequestContext } from '../request-context';
import type { ChunkType } from '../stream/types';
import type { DynamicArgument } from '../types';
import { MastraA2AError } from './error';
import type {
  A2AAgentCardVerificationContext,
  A2AAgentGenerateResult,
  A2AAgentOptions,
  A2AAgentResumePayload,
  A2AAgentRunState,
  A2AAgentStreamResult,
  JSONRPCResponse,
  RequestCredentialsMode,
} from './types';

type FetchLike = typeof fetch;

type JSONRPCRequestBody = {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  stream?: boolean;
  credentials?: RequestCredentialsMode;
  signal?: AbortSignal;
};

type AgentBootstrap = {
  card: AgentCard;
  cardUrl: string;
  executionUrl: string;
  streamingSupported: boolean;
};

type TerminalEvaluation =
  | {
      kind: 'completed';
      text: string;
      task?: Task;
      message?: Message;
    }
  | {
      kind: 'suspended';
      text: string;
      task: Task;
      resumePayload: A2AAgentResumePayload;
      resumeSchema?: string;
    };

type StreamConsumptionResult = {
  text: string;
  task?: Task;
  suspended?: {
    payload: A2AAgentResumePayload;
    resumeSchema?: string;
  };
};

type A2AStreamEventData = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;
type A2AAgentFullStreamChunkBase =
  | { type: 'start'; payload: { id: string } }
  | { type: 'text-start'; payload: { id: string } }
  | { type: 'text-delta'; payload: { id: string; text: string } }
  | { type: 'text-end'; payload: { id: string } }
  | {
      type: 'tool-call-suspended';
      payload: {
        toolCallId: string;
        toolName: string;
        args: Record<string, never>;
        suspendPayload: A2AAgentResumePayload;
        resumeSchema: string;
      };
    }
  | {
      type: 'finish';
      payload: A2AAgentFinishPayload;
    };

type AgentFinishPayload = Extract<ChunkType, { type: 'finish' }>['payload'];

type A2AAgentFinishPayload = AgentFinishPayload & {
  /** @deprecated Use `stepResult.reason`. Kept for consumers of the previous flat payload shape. */
  finishReason: 'stop';
  /** @deprecated Use `output.usage`. Kept for consumers of the previous flat payload shape. */
  usage: typeof EMPTY_USAGE;
};
type A2AAgentFullStreamChunk = A2AAgentFullStreamChunkBase & {
  runId: string;
  from: 'AGENT';
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const EMPTY_USAGE = {
  inputTokens: undefined,
  outputTokens: undefined,
  totalTokens: undefined,
};

function toAgentStreamChunk(runId: string, chunk: A2AAgentFullStreamChunkBase): A2AAgentFullStreamChunk {
  return {
    ...chunk,
    runId,
    from: 'AGENT',
  };
}

function createFinishPayload(): A2AAgentFinishPayload {
  return {
    stepResult: {
      reason: 'stop',
    },
    output: {
      usage: EMPTY_USAGE,
    },
    metadata: {},
    messages: {
      all: [],
      user: [],
      nonUser: [],
    },
    finishReason: 'stop',
    usage: EMPTY_USAGE,
  };
}

function isTask(result: Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent): result is Task {
  return typeof result === 'object' && result !== null && 'status' in result && 'id' in result && 'kind' in result;
}

function isMessage(result: Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent): result is Message {
  return typeof result === 'object' && result !== null && 'messageId' in result && 'parts' in result;
}

function isTerminalTaskState(state: Task['status']['state'] | undefined) {
  return state === 'completed' || state === 'failed' || state === 'canceled' || state === 'rejected';
}

function splitNextEvent(buffer: string): { eventBlock?: string; rest: string } {
  const normalizedBuffer = buffer.replace(/\x1E/g, '\n\n');
  const match = normalizedBuffer.match(/\r?\n\r?\n/);

  if (!match || match.index === undefined) {
    return { rest: normalizedBuffer };
  }

  return {
    eventBlock: normalizedBuffer.slice(0, match.index),
    rest: normalizedBuffer.slice(match.index + match[0].length),
  };
}

function parseEventBlock(eventBlock: string): { done: true } | { event?: A2AStreamEventData } {
  const trimmedBlock = eventBlock.trim();

  if (!trimmedBlock) {
    return {};
  }

  const lines = trimmedBlock.split(/\r?\n/);
  const dataLines = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());
  const payload = dataLines.length > 0 ? dataLines.join('\n') : trimmedBlock;

  if (payload === '[DONE]') {
    return { done: true };
  }

  let parsed: JSONRPCResponse<A2AStreamEventData> | A2AStreamEventData;

  try {
    parsed = JSON.parse(payload) as JSONRPCResponse<A2AStreamEventData> | A2AStreamEventData;
  } catch {
    return {};
  }

  if ('result' in parsed && parsed.result) {
    return { event: parsed.result };
  }

  return { event: parsed as A2AStreamEventData };
}

function extractTextParts(parts: { kind: string; text?: string }[] | undefined): string {
  return (parts ?? [])
    .filter((part): part is { kind: string; text: string } => part.kind === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n');
}

function extractTaskText(task: Task): string {
  const artifactText = (task.artifacts ?? [])
    .flatMap(
      artifact =>
        artifact.parts?.flatMap(part => {
          if (part.kind === 'text' && 'text' in part && typeof part.text === 'string') {
            return [part.text];
          }

          return [];
        }) ?? [],
    )
    .join('\n');
  const statusText = task.status.message ? extractMessageText(task.status.message) : '';
  return [artifactText, statusText].filter(Boolean).join('\n').trim();
}

function extractTaskArtifactText(task: Task): string {
  return (task.artifacts ?? [])
    .flatMap(
      artifact =>
        artifact.parts?.flatMap(part => {
          if (part.kind === 'text' && 'text' in part && typeof part.text === 'string') {
            return [part.text];
          }

          return [];
        }) ?? [],
    )
    .join('');
}

function extractMessageText(message: Message): string {
  return extractTextParts(message.parts as { kind: string; text?: string }[] | undefined).trim();
}

function messagesToPrompt<OUTPUT>(messages: MessageListInput, options?: AgentExecutionOptionsBase<OUTPUT>): string {
  if (typeof messages === 'string') {
    return messages;
  }

  const converted = convertMessages(messages).to('AIV5.Model');
  const lines: string[] = [];

  if (options?.instructions) {
    lines.push(`Instructions:\n${options.instructions}`);
  }

  const contextMessages = options?.context as Array<{ role?: string; content?: unknown }> | undefined;
  if (contextMessages?.length) {
    lines.push(
      'Context:\n' +
        contextMessages
          .map(message => {
            const role = message.role ?? 'unknown';
            const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
            return `${role}: ${content}`;
          })
          .join('\n'),
    );
  }

  for (const message of converted) {
    if (message.role === 'system') {
      const content = Array.isArray(message.content)
        ? message.content
            .map((part: { type: string; text?: string }) => {
              if ('type' in part && part.type === 'text') {
                return part.text;
              }

              return '';
            })
            .filter(Boolean)
            .join('\n')
        : typeof message.content === 'string'
          ? message.content
          : '';

      if (content) {
        lines.push(`system: ${content}`);
      }
      continue;
    }

    const content = Array.isArray(message.content)
      ? message.content
          .map((part: { type: string; text?: string; filename?: string }) => {
            if ('type' in part && part.type === 'text') {
              return part.text;
            }

            if ('type' in part && part.type === 'file') {
              return `[file:${part.filename ?? 'attachment'}]`;
            }

            return '';
          })
          .filter(Boolean)
          .join('\n')
      : typeof message.content === 'string'
        ? message.content
        : '';

    lines.push(`${message.role}: ${content}`);
  }

  return lines.join('\n\n').trim();
}

function resumeDataToPrompt(resumeData: unknown): string {
  if (typeof resumeData === 'string') {
    return resumeData;
  }

  if (resumeData == null) {
    return '';
  }

  return JSON.stringify(resumeData, null, 2);
}

function createResumeSchema(): string {
  return JSON.stringify({
    type: 'object',
    additionalProperties: true,
    description: 'Data to continue the remote A2A task.',
  });
}

function resolveStreamTextId(candidateIds: Array<string | undefined>): string {
  for (const candidate of candidateIds) {
    if (candidate) {
      return candidate;
    }
  }

  return 'text-1';
}

function resolveMemoryInfo<OUTPUT>(options?: AgentExecutionOptionsBase<OUTPUT>) {
  const threadId = typeof options?.memory?.thread === 'string' ? options.memory.thread : options?.memory?.thread?.id;

  return {
    threadId,
    resourceId: options?.memory?.resource,
  };
}

function createResponseMessages(
  text: string,
  memoryInfo: { threadId?: string; resourceId?: string } = {},
): MastraDBMessage[] {
  if (!text) {
    return [];
  }

  return new MessageList(memoryInfo)
    .add(
      {
        role: 'assistant',
        content: text,
      },
      'response',
    )
    .get.response.db();
}

function createGenerateResult({
  runId,
  text,
  task,
  message,
  resumePayload,
  resumeSchema,
  threadId,
  resourceId,
}: {
  runId: string;
  text: string;
  task?: Task;
  message?: Message;
  resumePayload?: A2AAgentResumePayload;
  resumeSchema?: string;
  threadId?: string;
  resourceId?: string;
}): A2AAgentGenerateResult {
  const responseMessages = createResponseMessages(text, { threadId, resourceId });

  return {
    text,
    usage: EMPTY_USAGE,
    steps: [],
    finishReason: resumePayload ? 'suspended' : 'stop',
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: {
      id: message?.messageId ?? task?.id ?? runId,
      timestamp: new Date(),
      modelId: 'a2a/remote-agent',
      messages: [],
      uiMessages: [],
      dbMessages: responseMessages,
    },
    totalUsage: EMPTY_USAGE,
    object: undefined,
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId,
    suspendPayload: resumePayload,
    resumeSchema,
    messages: responseMessages,
    rememberedMessages: [],
    task,
    message,
    resumePayload,
  };
}

function unwrapA2AResult(result: unknown): Message | Task {
  if (!result || typeof result !== 'object') {
    throw MastraA2AError.invalidAgentResponse('Remote A2A agent returned an invalid response.');
  }

  if ('result' in result && result.result && typeof result.result === 'object') {
    return result.result as Message | Task;
  }

  return result as Message | Task;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function requireResponseBody(response: Response, operation: string) {
  if (!response.body) {
    throw MastraA2AError.invalidAgentResponse(`Remote A2A agent returned an empty stream for ${operation}.`);
  }

  return response.body;
}

export class A2AAgent implements SubAgent {
  readonly id: string;
  readonly name: string;

  readonly #url: string;
  readonly #description: string;
  readonly #headers: Record<string, string>;
  readonly #fetch: FetchLike;
  readonly #retries: number;
  readonly #backoffMs: number;
  readonly #maxBackoffMs: number;
  readonly #credentials?: RequestCredentialsMode;
  readonly #abortSignal?: AbortSignal;
  readonly #timeoutMs?: number;
  readonly #verifyAgentCard?: A2AAgentOptions['verifyAgentCard'];

  #cachedBootstrap?: AgentBootstrap;
  readonly #runState = new Map<string, A2AAgentRunState>();
  #memory?: DynamicArgument<MastraMemory>;
  #mastra?: Mastra;

  constructor(options: A2AAgentOptions) {
    this.#url = options.url.replace(/\/$/, '');
    this.#description = options.description ?? `Remote A2A agent at ${this.#url}`;
    this.#headers = options.headers ?? {};
    this.#fetch = options.fetch ?? fetch;
    this.#retries = options.retries ?? 0;
    this.#backoffMs = options.backoffMs ?? 250;
    this.#maxBackoffMs = options.maxBackoffMs ?? 1_000;
    this.#credentials = options.credentials;
    this.#abortSignal = options.abortSignal;
    this.#timeoutMs = options.timeoutMs;
    this.#verifyAgentCard = options.verifyAgentCard;
    this.id = options.id ?? `a2a-${crypto.randomUUID()}`;
    this.name = options.name ?? options.description ?? 'A2A Agent';
  }

  async getAgentCard({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<AgentCard> {
    return (await this.#getBootstrap({ forceRefresh })).card;
  }

  getDescription(): string {
    return this.#description;
  }

  getModel: SubAgent['getModel'] = async () =>
    ({ specificationVersion: 'v2' }) as Awaited<ReturnType<SubAgent['getModel']>>;

  hasOwnMemory(): boolean {
    return Boolean(this.#memory);
  }

  __setMemory(memory: DynamicArgument<MastraMemory>): void {
    this.#memory = memory;
  }

  async getMemory({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}) {
    if (!this.#memory) {
      return undefined;
    }

    if (typeof this.#memory !== 'function') {
      return this.#memory;
    }

    return await this.#memory({
      requestContext,
      mastra: this.#mastra,
    });
  }

  getInstructions: SubAgent['getInstructions'] = async () => '';

  __registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }

  async generate(
    messages: MessageListInput,
    options?: AgentExecutionOptionsBase<unknown>,
  ): Promise<A2AAgentGenerateResult> {
    const bootstrap = await this.#getBootstrap();
    const runId = options?.runId ?? crypto.randomUUID();
    const prompt = messagesToPrompt(messages, options);
    const memoryInfo = resolveMemoryInfo(options);

    return this.#sendAndResolve({
      bootstrap,
      runId,
      prompt,
      signal: options?.abortSignal,
      ...memoryInfo,
    });
  }

  async resumeGenerate(
    resumeData: unknown,
    options?: AgentExecutionOptionsBase<unknown>,
  ): Promise<A2AAgentGenerateResult> {
    const runId = options?.runId;
    if (!runId) {
      throw MastraA2AError.invalidParams('A2AAgent.resumeGenerate requires a runId.');
    }

    const state = this.#runState.get(runId);
    if (!state) {
      throw MastraA2AError.invalidParams(`No resumable A2A run state found for runId "${runId}".`);
    }

    const bootstrap = await this.#getBootstrap();
    const memoryInfo = resolveMemoryInfo(options);

    if (state.waitingForInput) {
      const prompt = resumeDataToPrompt(resumeData);
      return this.#sendAndResolve({
        bootstrap,
        runId,
        prompt,
        signal: options?.abortSignal,
        contextId: state.contextId,
        referenceTaskIds: state.taskId ? [state.taskId] : undefined,
        ...memoryInfo,
      });
    }

    if (!state.taskId) {
      throw MastraA2AError.invalidParams(`A2AAgent resume state for "${runId}" is missing a taskId.`);
    }

    const task = await this.#getTask({
      bootstrap,
      taskId: state.taskId,
      signal: options?.abortSignal,
    });

    return this.#resolveTaskToGenerateResult({
      bootstrap,
      runId,
      task,
      signal: options?.abortSignal,
      ...memoryInfo,
    });
  }

  async stream(
    messages: MessageListInput,
    options?: AgentExecutionOptionsBase<unknown>,
  ): Promise<A2AAgentStreamResult> {
    const bootstrap = await this.#getBootstrap();
    const runId = options?.runId ?? crypto.randomUUID();
    const prompt = messagesToPrompt(messages, options);
    const memoryInfo = resolveMemoryInfo(options);

    if (!bootstrap.streamingSupported) {
      const result = await this.generate(messages, { ...options, runId });
      return this.#createBufferedStreamResult({ runId, result, emitStart: true, ...memoryInfo });
    }

    return this.#runRemoteStream({
      bootstrap,
      runId,
      prompt,
      signal: options?.abortSignal,
      emitStart: true,
      ...memoryInfo,
    });
  }

  async resumeStream(resumeData: unknown, options?: AgentExecutionOptionsBase<unknown>): Promise<A2AAgentStreamResult> {
    const runId = options?.runId;
    if (!runId) {
      throw MastraA2AError.invalidParams('A2AAgent.resumeStream requires a runId.');
    }

    const state = this.#runState.get(runId);
    if (!state) {
      throw MastraA2AError.invalidParams(`No resumable A2A run state found for runId "${runId}".`);
    }

    const bootstrap = await this.#getBootstrap();
    const memoryInfo = resolveMemoryInfo(options);

    if (state.waitingForInput) {
      const prompt = resumeDataToPrompt(resumeData);

      if (!bootstrap.streamingSupported) {
        const result = await this.resumeGenerate(resumeData, options);
        return this.#createBufferedStreamResult({ runId, result, emitStart: false, ...memoryInfo });
      }

      return this.#runRemoteStream({
        bootstrap,
        runId,
        prompt,
        signal: options?.abortSignal,
        contextId: state.contextId,
        referenceTaskIds: state.taskId ? [state.taskId] : undefined,
        // Resumed runs skip the `start` chunk, mirroring the regular Agent loop.
        emitStart: false,
        ...memoryInfo,
      });
    }

    if (!state.taskId) {
      throw MastraA2AError.invalidParams(`A2AAgent resume state for "${runId}" is missing a taskId.`);
    }

    if (!bootstrap.streamingSupported) {
      const result = await this.resumeGenerate(resumeData, options);
      return this.#createBufferedStreamResult({ runId, result, emitStart: false, ...memoryInfo });
    }

    return this.#resubscribeToRemoteStream({
      bootstrap,
      runId,
      taskId: state.taskId,
      initialTask: state.lastTask,
      signal: options?.abortSignal,
      ...memoryInfo,
    });
  }

  async #getBootstrap({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<AgentBootstrap> {
    if (!forceRefresh && this.#cachedBootstrap) {
      return this.#cachedBootstrap;
    }

    const cardUrl = this.#resolveCardUrl();
    const response = await this.#request(cardUrl, {
      method: 'GET',
      signal: this.#abortSignal,
    });

    const card = (await response.json()) as AgentCard;
    const fetchedAt = new Date();

    if (this.#verifyAgentCard) {
      const context: A2AAgentCardVerificationContext = { cardUrl, fetchedAt };
      await this.#verifyAgentCard.verify(card, context);
    }

    const bootstrap: AgentBootstrap = {
      card,
      cardUrl,
      executionUrl: card.url,
      streamingSupported: card.capabilities?.streaming ?? false,
    };

    this.#cachedBootstrap = bootstrap;
    return bootstrap;
  }

  #resolveCardUrl() {
    return this.#url.endsWith('/agent-card.json') ? this.#url : `${this.#url}/.well-known/agent-card.json`;
  }

  async #sendMessage({
    bootstrap,
    prompt,
    signal,
    contextId,
    referenceTaskIds,
  }: {
    bootstrap: AgentBootstrap;
    prompt: string;
    signal?: AbortSignal;
    contextId?: string;
    referenceTaskIds?: string[];
  }): Promise<Message | Task> {
    const response = await this.#request(bootstrap.executionUrl, {
      method: 'POST',
      signal,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'message/send',
        params: {
          message: {
            role: 'user',
            kind: 'message',
            messageId: crypto.randomUUID(),
            parts: [{ kind: 'text', text: prompt }],
            ...(contextId ? { contextId } : {}),
            ...(referenceTaskIds?.length ? { referenceTaskIds } : {}),
          },
        },
      } satisfies JSONRPCRequestBody,
    });

    const json = await response.json();
    return unwrapA2AResult(json);
  }

  async #sendAndResolve({
    bootstrap,
    runId,
    prompt,
    signal,
    contextId,
    referenceTaskIds,
    threadId,
    resourceId,
  }: {
    bootstrap: AgentBootstrap;
    runId: string;
    prompt: string;
    signal?: AbortSignal;
    contextId?: string;
    referenceTaskIds?: string[];
    threadId?: string;
    resourceId?: string;
  }): Promise<A2AAgentGenerateResult> {
    const response = await this.#sendMessage({
      bootstrap,
      prompt,
      signal,
      contextId,
      referenceTaskIds,
    });

    if (isMessage(response)) {
      this.#runState.delete(runId);
      return createGenerateResult({
        runId,
        text: extractMessageText(response),
        message: response,
        threadId,
        resourceId,
      });
    }

    return this.#resolveTaskToGenerateResult({
      bootstrap,
      runId,
      task: response,
      signal,
      threadId,
      resourceId,
    });
  }

  async #getTask({
    bootstrap,
    taskId,
    signal,
  }: {
    bootstrap: AgentBootstrap;
    taskId: string;
    signal?: AbortSignal;
  }): Promise<Task> {
    const response = await this.#request(bootstrap.executionUrl, {
      method: 'POST',
      signal,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/get',
        params: { id: taskId },
      } satisfies JSONRPCRequestBody,
    });

    const json = await response.json();
    const result = unwrapA2AResult(json);

    if (!isTask(result)) {
      throw MastraA2AError.invalidAgentResponse('Remote A2A agent returned a non-task response for tasks/get.');
    }

    return result;
  }

  async #resolveTaskToGenerateResult({
    bootstrap,
    runId,
    task,
    signal,
    threadId,
    resourceId,
  }: {
    bootstrap: AgentBootstrap;
    runId: string;
    task: Task;
    signal?: AbortSignal;
    threadId?: string;
    resourceId?: string;
  }): Promise<A2AAgentGenerateResult> {
    let currentTask = task;

    while (true) {
      const evaluation = this.#evaluateTask({
        bootstrap,
        task: currentTask,
      });

      if (evaluation.kind === 'completed') {
        this.#runState.delete(runId);

        return createGenerateResult({
          runId,
          text: evaluation.text,
          task: evaluation.task,
          message: evaluation.message,
          threadId,
          resourceId,
        });
      }

      this.#runState.set(runId, {
        runId,
        contextId: evaluation.task.contextId,
        taskId: evaluation.task.id,
        executionUrl: bootstrap.executionUrl,
        cardUrl: bootstrap.cardUrl,
        streamingSupported: bootstrap.streamingSupported,
        waitingForInput: evaluation.resumePayload.waitingForInput,
        lastTask: evaluation.task,
      });

      if (evaluation.task.status.state === 'input-required') {
        return createGenerateResult({
          runId,
          text: evaluation.text,
          task: evaluation.task,
          resumePayload: evaluation.resumePayload,
          resumeSchema: evaluation.resumeSchema,
          threadId,
          resourceId,
        });
      }

      await this.#delay();

      currentTask = await this.#getTask({
        bootstrap,
        taskId: evaluation.task.id,
        signal,
      });
    }
  }

  #evaluateTask({ bootstrap, task }: { bootstrap: AgentBootstrap; task: Task }): TerminalEvaluation {
    const text = extractTaskText(task);

    if (task.status.state === 'input-required') {
      return {
        kind: 'suspended',
        text,
        task,
        resumePayload: {
          taskId: task.id,
          contextId: task.contextId,
          executionUrl: bootstrap.executionUrl,
          cardUrl: bootstrap.cardUrl,
          waitingForInput: true,
          task: structuredClone(task),
        },
        resumeSchema: createResumeSchema(),
      };
    }

    if (isTerminalTaskState(task.status.state)) {
      return {
        kind: 'completed',
        text,
        task,
      };
    }

    return {
      kind: 'suspended',
      text,
      task,
      resumePayload: {
        taskId: task.id,
        contextId: task.contextId,
        executionUrl: bootstrap.executionUrl,
        cardUrl: bootstrap.cardUrl,
        waitingForInput: false,
        task: structuredClone(task),
      },
    };
  }

  async #runRemoteStream({
    bootstrap,
    runId,
    prompt,
    signal,
    contextId,
    referenceTaskIds,
    threadId,
    resourceId,
    emitStart,
  }: {
    bootstrap: AgentBootstrap;
    runId: string;
    prompt: string;
    signal?: AbortSignal;
    contextId?: string;
    referenceTaskIds?: string[];
    threadId?: string;
    resourceId?: string;
    emitStart: boolean;
  }): Promise<A2AAgentStreamResult> {
    const response = await this.#request(bootstrap.executionUrl, {
      method: 'POST',
      signal,
      stream: true,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'message/stream',
        params: {
          message: {
            role: 'user',
            kind: 'message',
            messageId: crypto.randomUUID(),
            parts: [{ kind: 'text', text: prompt }],
            ...(contextId ? { contextId } : {}),
            ...(referenceTaskIds?.length ? { referenceTaskIds } : {}),
          },
        },
      } satisfies JSONRPCRequestBody,
    });

    return this.#consumeA2AStream({
      bootstrap,
      runId,
      stream: await requireResponseBody(response, 'message/stream'),
      threadId,
      resourceId,
      emitStart,
    });
  }

  async #resubscribeToRemoteStream({
    bootstrap,
    runId,
    taskId,
    initialTask,
    signal,
    threadId,
    resourceId,
  }: {
    bootstrap: AgentBootstrap;
    runId: string;
    taskId: string;
    initialTask?: Task;
    signal?: AbortSignal;
    threadId?: string;
    resourceId?: string;
  }): Promise<A2AAgentStreamResult> {
    const response = await this.#request(bootstrap.executionUrl, {
      method: 'POST',
      signal,
      stream: true,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/resubscribe',
        params: { id: taskId },
      } satisfies JSONRPCRequestBody,
    });

    return this.#consumeA2AStream({
      bootstrap,
      runId,
      initialTask,
      stream: await requireResponseBody(response, 'tasks/resubscribe'),
      threadId,
      resourceId,
      // Resubscribing continues an existing run; `start` is only emitted for fresh runs,
      // mirroring the regular Agent loop which skips `start` when resuming.
      emitStart: false,
    });
  }

  async #consumeA2AStream({
    bootstrap,
    runId,
    initialTask,
    stream,
    threadId,
    resourceId,
    emitStart,
  }: {
    bootstrap: AgentBootstrap;
    runId: string;
    initialTask?: Task;
    stream: ReadableStream<Uint8Array>;
    threadId?: string;
    resourceId?: string;
    emitStart: boolean;
  }): Promise<A2AAgentStreamResult> {
    const [consumerStream, accumulatorStream] = stream.tee();
    const resultDeferred = createDeferred<A2AAgentGenerateResult>();
    const textDeferred = createDeferred<string>();
    const taskDeferred = createDeferred<Task | undefined>();
    const suspendPayloadDeferred = createDeferred<A2AAgentResumePayload | undefined>();
    const resumeSchemaDeferred = createDeferred<string | undefined>();
    const messageList = new MessageList({ threadId, resourceId });

    void this.#collectStreamEvents({
      bootstrap,
      initialTask,
      stream: accumulatorStream,
    })
      .then(consumed => {
        if (consumed.task && consumed.suspended) {
          this.#runState.set(runId, {
            runId,
            contextId: consumed.task.contextId,
            taskId: consumed.task.id,
            executionUrl: bootstrap.executionUrl,
            cardUrl: bootstrap.cardUrl,
            streamingSupported: bootstrap.streamingSupported,
            waitingForInput: consumed.suspended.payload.waitingForInput,
            lastTask: consumed.task,
          });
        } else {
          this.#runState.delete(runId);
        }

        textDeferred.resolve(consumed.text);
        taskDeferred.resolve(consumed.task);
        suspendPayloadDeferred.resolve(consumed.suspended?.payload);
        resumeSchemaDeferred.resolve(consumed.suspended?.resumeSchema);
        if (consumed.text) {
          messageList.add(
            {
              role: 'assistant',
              content: consumed.text,
            },
            'response',
          );
        }
        resultDeferred.resolve(
          createGenerateResult({
            runId,
            text: consumed.text,
            task: consumed.task,
            threadId,
            resourceId,
            ...(consumed.suspended
              ? {
                  resumePayload: consumed.suspended.payload,
                  resumeSchema: consumed.suspended.resumeSchema,
                }
              : {}),
          }),
        );
      })
      .catch(error => {
        textDeferred.reject(error);
        taskDeferred.reject(error);
        suspendPayloadDeferred.reject(error);
        resumeSchemaDeferred.reject(error);
        resultDeferred.reject(error);
      });

    const streamResult = {
      runId,
      fullStream: this.#streamEvents({ bootstrap, runId, stream: consumerStream, emitStart }),
      text: textDeferred.promise,
      toolResults: Promise.resolve([]),
      messageList,
      task: taskDeferred.promise,
      suspendPayload: suspendPayloadDeferred.promise,
      resumeSchema: resumeSchemaDeferred.promise,
      getResult: async () => resultDeferred.promise,
    };

    return streamResult as unknown as A2AAgentStreamResult;
  }

  async *#streamEvents({
    bootstrap,
    runId,
    stream,
    emitStart,
  }: {
    bootstrap: AgentBootstrap;
    runId: string;
    stream: ReadableStream<Uint8Array>;
    emitStart: boolean;
  }): AsyncIterable<A2AAgentFullStreamChunk> {
    if (emitStart) {
      yield toAgentStreamChunk(runId, { type: 'start', payload: { id: this.id } });
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let textId: string | undefined;
    let textStarted = false;
    let task: Task | undefined;
    let suspended: A2AAgentResumePayload | undefined;
    let receivedDone = false;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
      } else if (value) {
        buffer += decoder.decode(value, { stream: true });
      }

      let next = splitNextEvent(buffer);
      while (next.eventBlock !== undefined) {
        const parsed = parseEventBlock(next.eventBlock);
        if ('done' in parsed && parsed.done) {
          receivedDone = true;
          buffer = next.rest;
          break;
        }

        if ('event' in parsed && parsed.event) {
          const event = parsed.event;

          if (isTask(event)) {
            task = event;
            if (event.status.state === 'input-required') {
              suspended = {
                taskId: event.id,
                contextId: event.contextId,
                executionUrl: bootstrap.executionUrl,
                cardUrl: bootstrap.cardUrl,
                waitingForInput: true,
                task: structuredClone(event),
              };
            }
          } else if (isMessage(event)) {
            const text = extractMessageText(event);
            if (text) {
              textId ??= resolveStreamTextId([event.messageId, task?.id]);
              if (textId) {
                if (!textStarted) {
                  yield toAgentStreamChunk(runId, { type: 'text-start', payload: { id: textId } });
                  textStarted = true;
                }
                yield toAgentStreamChunk(runId, { type: 'text-delta', payload: { id: textId, text } });
              }
            }
          } else if (event.kind === 'artifact-update') {
            const text = event.artifact.parts
              ?.flatMap(part =>
                part.kind === 'text' && 'text' in part && typeof part.text === 'string' ? [part.text] : [],
              )
              .join('');
            if (text) {
              textId ??= resolveStreamTextId([event.artifact.artifactId, task?.id]);
              if (textId) {
                if (!textStarted) {
                  yield toAgentStreamChunk(runId, { type: 'text-start', payload: { id: textId } });
                  textStarted = true;
                }
                yield toAgentStreamChunk(runId, { type: 'text-delta', payload: { id: textId, text } });
              }
            }
          } else if (event.kind === 'status-update') {
            task = task
              ? {
                  ...task,
                  status: event.status,
                }
              : task;
            if (event.status.state === 'input-required' && task) {
              suspended = {
                taskId: task.id,
                contextId: task.contextId,
                executionUrl: bootstrap.executionUrl,
                cardUrl: bootstrap.cardUrl,
                waitingForInput: true,
                task: structuredClone(task),
              };
            }
          }
        }

        buffer = next.rest;
        next = splitNextEvent(buffer);
      }

      if (done || receivedDone) {
        if (textId && textStarted) {
          yield toAgentStreamChunk(runId, { type: 'text-end', payload: { id: textId } });
        }

        if (!suspended && task && !isTerminalTaskState(task.status.state)) {
          suspended = {
            taskId: task.id,
            contextId: task.contextId,
            executionUrl: bootstrap.executionUrl,
            cardUrl: bootstrap.cardUrl,
            waitingForInput: false,
            task: structuredClone(task),
          };
        }

        if (suspended) {
          yield toAgentStreamChunk(runId, {
            type: 'tool-call-suspended',
            payload: {
              toolCallId: runId,
              toolName: this.id,
              args: {},
              suspendPayload: suspended,
              resumeSchema: createResumeSchema(),
            },
          });
        } else {
          yield toAgentStreamChunk(runId, {
            type: 'finish',
            payload: createFinishPayload(),
          });
        }
        return;
      }
    }
  }

  async #collectStreamEvents({
    bootstrap,
    initialTask,
    stream,
  }: {
    bootstrap: AgentBootstrap;
    initialTask?: Task;
    stream: ReadableStream<Uint8Array>;
  }): Promise<StreamConsumptionResult> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let textBuffer = '';
    let task: Task | undefined = initialTask ? structuredClone(initialTask) : undefined;
    let suspended: StreamConsumptionResult['suspended'];

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
      } else if (value) {
        buffer += decoder.decode(value, { stream: true });
      }

      let next = splitNextEvent(buffer);
      while (next.eventBlock !== undefined) {
        const parsed = parseEventBlock(next.eventBlock);
        if ('done' in parsed && parsed.done) {
          break;
        }

        if ('event' in parsed && parsed.event) {
          const event = parsed.event;

          if (isTask(event)) {
            task = event;
            textBuffer = extractTaskArtifactText(event) || textBuffer;

            if (event.status.state === 'input-required') {
              suspended = {
                payload: {
                  taskId: event.id,
                  contextId: event.contextId,
                  executionUrl: bootstrap.executionUrl,
                  cardUrl: bootstrap.cardUrl,
                  waitingForInput: true,
                  task: structuredClone(event),
                },
                resumeSchema: createResumeSchema(),
              };
            }
          } else if (isMessage(event)) {
            const messageText = extractMessageText(event);
            if (messageText) {
              textBuffer = messageText;
            }
          } else if (event.kind === 'artifact-update') {
            task = task
              ? {
                  ...task,
                  artifacts: [
                    ...(task.artifacts ?? []).filter(artifact => artifact.artifactId !== event.artifact.artifactId),
                    event.artifact,
                  ],
                }
              : task;

            const artifactText = event.artifact.parts
              ?.flatMap(part =>
                part.kind === 'text' && 'text' in part && typeof part.text === 'string' ? [part.text] : [],
              )
              .join('');
            if (artifactText) {
              textBuffer += artifactText;
            }
          } else if (event.kind === 'status-update') {
            task = task
              ? {
                  ...task,
                  status: event.status,
                }
              : task;

            if (event.status.state === 'input-required' && task) {
              suspended = {
                payload: {
                  taskId: task.id,
                  contextId: task.contextId,
                  executionUrl: bootstrap.executionUrl,
                  cardUrl: bootstrap.cardUrl,
                  waitingForInput: true,
                  task: structuredClone(task),
                },
                resumeSchema: createResumeSchema(),
              };
            }
          }
        }

        buffer = next.rest;
        next = splitNextEvent(buffer);
      }

      if (done) {
        break;
      }
    }

    if (!suspended && task && !isTerminalTaskState(task.status.state)) {
      suspended = {
        payload: {
          taskId: task.id,
          contextId: task.contextId,
          executionUrl: bootstrap.executionUrl,
          cardUrl: bootstrap.cardUrl,
          waitingForInput: false,
          task: structuredClone(task),
        },
      };
    }

    return {
      text: textBuffer,
      task,
      suspended,
    };
  }

  #createBufferedStreamResult({
    runId,
    result,
    threadId,
    resourceId,
    emitStart,
  }: {
    runId: string;
    result: A2AAgentGenerateResult;
    threadId?: string;
    resourceId?: string;
    emitStart: boolean;
  }): A2AAgentStreamResult {
    const messageList = new MessageList({ threadId, resourceId });
    const toolName = this.id;
    const agentId = this.id;
    const textId = resolveStreamTextId([result.message?.messageId, result.task?.id]);
    if (result.text) {
      messageList.add(
        {
          role: 'assistant',
          content: result.text,
        },
        'response',
      );
    }

    const fullStream = (async function* (): AsyncIterable<A2AAgentFullStreamChunk> {
      if (emitStart) {
        yield toAgentStreamChunk(runId, { type: 'start', payload: { id: agentId } });
      }

      if (result.text) {
        yield toAgentStreamChunk(runId, { type: 'text-start', payload: { id: textId } });
        yield toAgentStreamChunk(runId, { type: 'text-delta', payload: { id: textId, text: result.text } });
        yield toAgentStreamChunk(runId, { type: 'text-end', payload: { id: textId } });
      }

      if (result.resumePayload) {
        yield toAgentStreamChunk(runId, {
          type: 'tool-call-suspended',
          payload: {
            toolCallId: runId,
            toolName,
            args: {},
            suspendPayload: result.resumePayload,
            resumeSchema: result.resumeSchema ?? createResumeSchema(),
          },
        });
        return;
      }

      yield toAgentStreamChunk(runId, {
        type: 'finish',
        payload: createFinishPayload(),
      });
    })();

    const streamResult = {
      runId,
      fullStream,
      text: Promise.resolve(result.text),
      toolResults: Promise.resolve([]),
      messageList,
      task: Promise.resolve(result.task),
      suspendPayload: Promise.resolve(result.resumePayload),
      resumeSchema: Promise.resolve(result.resumeSchema),
      getResult: async () => result,
    };

    return streamResult as unknown as A2AAgentStreamResult;
  }

  async #request(
    url: string,
    { method = 'POST', headers = {}, body, stream = false, credentials, signal }: RequestOptions = {},
  ): Promise<Response> {
    let attempts = 0;
    let lastError: unknown;

    const finalHeaders = {
      accept: stream ? 'text/event-stream' : 'application/json',
      ...this.#headers,
      ...headers,
    };

    while (attempts <= this.#retries) {
      try {
        const requestSignal = this.#resolveRequestSignal(signal);
        const response = await this.#fetch(url, {
          method,
          headers: {
            ...finalHeaders,
            ...(body ? { 'content-type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          credentials: credentials ?? this.#credentials,
          signal: requestSignal,
        });

        if (!response.ok) {
          throw MastraA2AError.invalidAgentResponse(`Remote A2A request failed with status ${response.status}.`, {
            status: response.status,
            url,
          });
        }

        return response;
      } catch (error) {
        lastError = error;

        if (!shouldRetryRequest(error)) {
          throw lastError;
        }

        if (attempts === this.#retries) {
          break;
        }

        attempts += 1;
        await this.#delay(attempts);
      }
    }

    throw lastError;
  }

  async #delay(attempt: number = 0) {
    const delayMs = Math.min(this.#backoffMs * Math.max(1, attempt), this.#maxBackoffMs);
    if (delayMs <= 0) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  #resolveRequestSignal(signal?: AbortSignal) {
    if (this.#timeoutMs == null) {
      return signal ?? this.#abortSignal;
    }

    const timeoutSignal = AbortSignal.timeout(this.#timeoutMs);
    const signals = [signal, this.#abortSignal, timeoutSignal].filter(Boolean) as AbortSignal[];

    if (signals.length === 0) {
      return undefined;
    }

    return signals.length === 1 ? signals[0] : AbortSignal.any(signals);
  }
}

function shouldRetryRequest(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  const status =
    typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
      ? error.status
      : typeof error === 'object' &&
          error !== null &&
          'data' in error &&
          typeof error.data === 'object' &&
          error.data !== null &&
          'status' in error.data &&
          typeof error.data.status === 'number'
        ? error.data.status
        : undefined;

  if (status === undefined) {
    return true;
  }

  return status === 408 || status === 429 || status >= 500;
}
