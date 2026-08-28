import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import {
  createMastraOutput,
  createNoopModel,
  createProviderMetadata,
  createSDKAgentTelemetry,
  enqueueFinishChunks,
  enqueueStartChunks,
  enqueueTextDelta,
  getStructuredOutputFromValue,
  getStructuredOutputSchema,
  getString,
  promptToText,
  sumDefined,
  toFullOutput,
  toLanguageModelUsage,
  toRecord,
  type SDKAgentRunOptions,
  type SDKAgentTelemetry,
  type SDKModelGenerateResult,
  type V3Usage,
} from '@internal/agent-sdk-base';
import type { Mastra } from '@mastra/core';
import { Agent, type StructuredOutputOptions } from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { CostContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import type { ChunkType, FullOutput, MastraModelOutput, ProviderMetadata } from '@mastra/core/stream';
import { ChunkFrom } from '@mastra/core/stream';

import {
  createOpencode,
  createOpencodeClient,
  type AssistantMessage,
  type Event,
  type OpencodeClient,
  type OpencodeClientConfig,
  type OutputFormat,
  type Part,
  type ServerOptions,
} from '@opencode-ai/sdk/v2';
import { OpenCodeEventType, OpenCodePartType } from './event-types';
import { OpenCodeStreamManager } from './stream';

export const PROVIDER = '@opencode/sdk';
export const MODEL_ID = 'opencode-sdk';

type OpenCodeStructuredOutputOption<OUTPUT> = OUTPUT extends {} ? StructuredOutputOptions<OUTPUT> : never;

type OpenCodeSDKAgentBaseOptions = {
  id: string;
  /** Defaults to `id`. */
  name?: string;
  description: string;
};

export type OpenCodeSDKAgentOptions = OpenCodeSDKAgentBaseOptions &
  (
    | {
        // pass preconfigured client
        client: OpencodeClient;
        serverOptions?: never;
        config?: never;
      }
    | {
        // start a server
        serverOptions: ServerOptions;
        client?: never;
        config?: never;
      }
    | {
        // connect to server
        config?: OpencodeClientConfig & {
          directory?: string;
        };
        serverOptions?: never;
        client?: never;
      }
  );

// `sessionID` is optional (the SDK requires it); runOpenCodeSession fills it in.
type OpenCodePromptAsyncOptions = Omit<Parameters<OpencodeClient['session']['promptAsync']>[0], 'parts' | 'sessionID'> & {
  sessionID?: string;
};

export type OpenCodeSDKAgentRunOptions<OUTPUT = unknown> = SDKAgentRunOptions<OUTPUT> & {
  /** Forwarded to `client.session.promptAsync`. Set `sessionID` to resume a session. */
  promptOptions?: OpenCodePromptAsyncOptions;
};

export type OpenCodeSDKAgentResumeData = {
  message: MessageListInput;
  sessionId: string;
};

function getModelId(options?: OpenCodeSDKAgentOptions): string {
  return options?.serverOptions?.config?.model ?? MODEL_ID;
}

export class OpenCodeSDKAgent extends Agent {
  readonly options: OpenCodeSDKAgentOptions;
  #mastra?: Mastra;
  #clientPromise?: Promise<OpencodeClient>;
  #streamManagerPromise?: Promise<OpenCodeStreamManager>;
  #serverHandle?: { url: string; close(): void };
  // Bumped by close() so a resolveClient() already in flight can detect it's
  // stale once it resolves, instead of silently repopulating #serverHandle.
  #clientGeneration = 0;

  constructor(options: OpenCodeSDKAgentOptions) {
    super({
      id: options.id,
      name: options.name ?? options.id,
      description: options.description,
      instructions: '',
      model: createNoopModel({
        modelId: getModelId(options),
        provider: PROVIDER,
      }),
    });
    this.options = options;
  }

  override __registerMastra(mastra: Mastra): void {
    super.__registerMastra(mastra);
    this.#mastra = mastra;
  }

  supportsMemory(): boolean {
    return false;
  }

  private resolveClient(): Promise<OpencodeClient> {
    const generation = this.#clientGeneration;
    this.#clientPromise ??= createOpenCodeClientFor(this.options).then(({ client, serverHandle }) => {
      if (generation === this.#clientGeneration) {
        this.#serverHandle = serverHandle;
      } else {
        // close() ran while this was spawning — never became active, so shut it down.
        serverHandle?.close();
      }
      return client;
    });
    return this.#clientPromise;
  }

  private async resolveStreamManager(): Promise<OpenCodeStreamManager> {
    this.#streamManagerPromise ??= this.resolveClient().then(client => new OpenCodeStreamManager(client));
    return this.#streamManagerPromise;
  }

  // Stops the server spawned via `serverOptions` (no-op otherwise) and
  // drops memoized client/stream-manager. Racing an unawaited generate()'s
  // still-spawning server isn't guaranteed to kill it — that process kill
  // goes through the SDK's stop(), which we can't override or escalate.
  close(): void {
    this.#clientGeneration++;
    this.#serverHandle?.close();
    this.#serverHandle = undefined;
    this.#clientPromise = undefined;
    this.#streamManagerPromise = undefined;
  }

  async generate<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: OpenCodeSDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    const prompt = promptToText(messages);
    const runId = options?.runId ?? randomUUID();
    const modelId = getModelId(this.options);
    const requestContext = options?.requestContext ?? new RequestContext();
    const instructions = options?.instructions ? promptToText(options.instructions) : undefined;
    const telemetry = createSDKAgentTelemetry({
      agentId: this.id,
      agentName: this.name,
      provider: PROVIDER,
      modelId,
      messages,
      prompt,
      runId,
      streaming: false,
      method: 'generate',
      requestContext,
      instructions,
      maxSteps: options?.maxSteps,
      tracingOptions: options?.tracingOptions,
      tracingContext: options?.tracingContext,
      onFinish: options?.onFinish,
      onStepFinish: options?.onStepFinish,
      mastra: this.#mastra,
    });

    let result: SDKModelGenerateResult;
    try {
      const client = await this.resolveClient();
      const streamManager = await this.resolveStreamManager();
      result = await telemetry.execute(() =>
        runOpenCodeGenerate(client, streamManager, prompt, telemetry, options),
      );
      telemetry.endGenerate(result);
    } catch (error) {
      telemetry.fail(error);
      throw error;
    }

    return toFullOutput<OUTPUT>({
      messages,
      runId,
      provider: PROVIDER,
      result,
      options: { ...telemetry.outputOptions(), structuredOutput: getStructuredOutputOption(options) },
    });
  }

  async stream<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: OpenCodeSDKAgentRunOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const runId = options?.runId ?? randomUUID();
    const prompt = promptToText(messages);
    const modelId = getModelId(this.options);
    const requestContext = options?.requestContext ?? new RequestContext();
    const instructions = options?.instructions ? promptToText(options.instructions) : undefined;
    const telemetry = createSDKAgentTelemetry({
      agentId: this.id,
      agentName: this.name,
      provider: PROVIDER,
      modelId,
      messages,
      prompt,
      runId,
      streaming: true,
      method: 'stream',
      requestContext,
      instructions,
      maxSteps: options?.maxSteps,
      tracingOptions: options?.tracingOptions,
      tracingContext: options?.tracingContext,
      onFinish: options?.onFinish,
      onStepFinish: options?.onStepFinish,
      mastra: this.#mastra,
    });

    const client = await this.resolveClient();
    const streamManager = await this.resolveStreamManager();

    return createMastraOutput<OUTPUT>({
      messages,
      runId,
      modelId,
      provider: PROVIDER,
      stream: telemetry.wrapStream(
        runOpenCodeAsMastraStream(client, streamManager, prompt, modelId, runId, telemetry, options),
      ),
      options: { ...telemetry.outputOptions(), structuredOutput: getStructuredOutputOption(options) },
    });
  }

  async resumeGenerate<OUTPUT = undefined>(
    resumeData: OpenCodeSDKAgentResumeData,
    options?: OpenCodeSDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    const data = validateOpenCodeResumeData(resumeData);
    return this.generate(data.message, createOpenCodeResumeRunOptions(data, options));
  }

  async resumeStream<OUTPUT = undefined>(
    resumeData: OpenCodeSDKAgentResumeData,
    options?: OpenCodeSDKAgentRunOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const data = validateOpenCodeResumeData(resumeData);
    return this.stream(data.message, createOpenCodeResumeRunOptions(data, options));
  }
}

function getStructuredOutputOption<OUTPUT>(
  options: OpenCodeSDKAgentRunOptions<OUTPUT> | undefined,
): StructuredOutputOptions<OUTPUT> | undefined {
  return options?.structuredOutput as OpenCodeStructuredOutputOption<OUTPUT> | undefined;
}

async function createOpenCodeClientFor(
  options: OpenCodeSDKAgentOptions,
): Promise<{ client: OpencodeClient; serverHandle?: { url: string; close(): void } }> {
  if (options.client) {
    return { client: options.client };
  }
  if (options.serverOptions) {
    const { client, server } = await createOpencode(options.serverOptions);
    return { client, serverHandle: server };
  }
  return { client: createOpencodeClient(options.config) };
}

async function createOpenCodeSession(
  client: OpencodeClient,
  options?: Parameters<OpencodeClient['session']['create']>[0],
): Promise<string> {
  const result = await client.session.create(options);
  if (result.error) {
    throw new Error(getOpenCodeErrorMessage(result.error));
  }
  return result.data.id;
}

async function promptOpenCodeSessionAsync(
  client: OpencodeClient,
  prompt: string,
  options: OpenCodePromptAsyncOptions & { sessionID: string },
): Promise<void> {
  const result = await client.session.promptAsync({
    ...options,
    parts: [{ type: OpenCodePartType.Text, text: prompt }],
  });
  if (result.error) {
    throw new Error(getOpenCodeErrorMessage(result.error));
  }
}

// Explicit promptOptions.format wins; otherwise derived from structuredOutput.
function getOpenCodeOutputFormat<OUTPUT>(
  runOptions: OpenCodeSDKAgentRunOptions<OUTPUT> | undefined,
): OutputFormat | undefined {
  if (runOptions?.promptOptions?.format) {
    return runOptions.promptOptions.format;
  }

  const schema = getStructuredOutputSchema(runOptions?.structuredOutput, { format: 'raw' });
  if (!schema) {
    return undefined;
  }

  return { type: 'json_schema', schema };
}

type OpenCodeSessionRunResult = {
  text: string;
  lastInfo: AssistantMessage | undefined;
};

// Drives one session turn; shared by generate/stream so both see the same telemetry.
async function runOpenCodeSession<OUTPUT>(
  client: OpencodeClient,
  streamManager: OpenCodeStreamManager,
  prompt: string,
  telemetry: SDKAgentTelemetry<OUTPUT>,
  runOptions: OpenCodeSDKAgentRunOptions<OUTPUT> | undefined,
  onTextDelta?: (delta: string) => void,
): Promise<OpenCodeSessionRunResult> {
  const callId = randomUUID();
  const startedToolCallIds = new Set<string>();
  const startedSubtaskIds = new Set<string>();
  const startedPermissionIds = new Set<string>();
  let text = '';
  let lastPartText = '';
  let sawDelta = false;
  let assistantMessageId: string | undefined;
  let lastInfo: AssistantMessage | undefined;

  await streamManager.openStream(callId);
  try {
    const sessionId =
      runOptions?.promptOptions?.sessionID ??
      (await createOpenCodeSession(client, {
        directory: runOptions?.promptOptions?.directory,
        workspace: runOptions?.promptOptions?.workspace,
        agent: runOptions?.promptOptions?.agent,
      }));
    const events = streamManager.listenStream(sessionId);

    await promptOpenCodeSessionAsync(client, prompt, {
      ...runOptions?.promptOptions,
      sessionID: sessionId,
      format: getOpenCodeOutputFormat(runOptions),
    });

    for await (const event of events) {
      handleOpenCodeStreamEvent(event, {
        assistantMessageId,
        setAssistantMessageId: id => (assistantMessageId = id),
        // TODO : is lastinfo the last agent message after stream finish or mid messages multiple possible for acculatesd cost , ceck opencode docs , ts structs
        setLastInfo: info => (lastInfo = info),
        onTextDelta: delta => {
          sawDelta = true;
          text += delta;
          onTextDelta?.(delta);
        },
        onLastPartText: value => (lastPartText = value),
        onToolPart: part => recordOpenCodeToolPart(part, telemetry, startedToolCallIds),
        onSubtaskPart: part => recordOpenCodeSubtaskStart(part, telemetry, startedSubtaskIds),
        onPartRemoved: partId => recordOpenCodeSubtaskEnd(partId, telemetry, startedSubtaskIds),
        onCommandExecuted: properties =>
          recordOpenCodeInstantToolEvent(telemetry, `command:${properties.name}`, {
            arguments: properties.arguments,
            messageID: properties.messageID,
          }),
        onTodoUpdated: properties =>
          recordOpenCodeInstantToolEvent(telemetry, 'todo.updated', { todos: properties.todos }),
        onPermissionAsked: permission => recordOpenCodePermissionAsked(permission, telemetry, startedPermissionIds),
        onPermissionReplied: (requestId, reply) =>
          telemetry.endToolCall({ toolCallId: requestId, output: { reply } }),
        onPermissionV2Asked: permission => recordOpenCodePermissionV2Asked(permission, telemetry, startedPermissionIds),
        onPermissionV2Replied: (requestId, reply) =>
          telemetry.endToolCall({ toolCallId: requestId, output: { reply } }),
      });
    }

    if (!sawDelta && lastPartText) {
      text = lastPartText;
      onTextDelta?.(lastPartText);
    }

    if (lastInfo?.error) {
      throw new Error(getOpenCodeErrorMessage(lastInfo.error));
    }

    return { text, lastInfo };
  } finally {
    streamManager.closeStream(callId);
  }
}

async function runOpenCodeGenerate<OUTPUT>(
  client: OpencodeClient,
  streamManager: OpenCodeStreamManager,
  prompt: string,
  telemetry: SDKAgentTelemetry<OUTPUT>,
  runOptions: OpenCodeSDKAgentRunOptions<OUTPUT> | undefined,
): Promise<SDKModelGenerateResult> {
  const { text, lastInfo } = await runOpenCodeSession(client, streamManager, prompt, telemetry, runOptions);
  const usage = lastInfo ? toV3UsageFromTokens(lastInfo.tokens) : EMPTY_V3_USAGE;

  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage,
    response: {
      id: lastInfo?.id,
      modelId: lastInfo ? getResponseModelId(lastInfo) : MODEL_ID,
      timestamp: lastInfo ? new Date(lastInfo.time.completed ?? lastInfo.time.created) : new Date(),
    },
    providerMetadata: lastInfo ? getOpenCodeProviderMetadata(lastInfo) : undefined,
    costContext: lastInfo ? getOpenCodeCostContext(lastInfo) : undefined,
    object: await getStructuredOutputFromValue(lastInfo?.structured ?? text, runOptions?.structuredOutput),
  };
}

function runOpenCodeAsMastraStream<OUTPUT>(
  client: OpencodeClient,
  streamManager: OpenCodeStreamManager,
  prompt: string,
  modelId: string,
  runId: string,
  telemetry: SDKAgentTelemetry<OUTPUT>,
  runOptions?: OpenCodeSDKAgentRunOptions<OUTPUT>,
): ReadableStream<ChunkType> {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const textId = randomUUID();
      const responseId = randomUUID();

      try {
        enqueueStartChunks(controller, {
          runId,
          prompt,
          textId,
          responseId,
          modelId,
          providerMetadata: undefined,
        });

        const { text, lastInfo } = await runOpenCodeSession(
          client,
          streamManager,
          prompt,
          telemetry,
          runOptions,
          delta => enqueueTextDelta(controller, runId, textId, delta),
        );

        const finalModelId = lastInfo ? getResponseModelId(lastInfo) : modelId;
        const usage = lastInfo ? toV3UsageFromTokens(lastInfo.tokens) : EMPTY_V3_USAGE;

        enqueueFinishChunks(controller, {
          runId,
          prompt,
          textId,
          text,
          responseId,
          modelId: finalModelId,
          usage: toLanguageModelUsage(usage),
          providerMetadata: lastInfo ? getOpenCodeProviderMetadata(lastInfo) : undefined,
          costContext: lastInfo ? getOpenCodeCostContext(lastInfo) : undefined,
          object: await getStructuredOutputFromValue(lastInfo?.structured ?? text, runOptions?.structuredOutput),
        });
        controller.close();
      } catch (error) {
        controller.enqueue({
          type: 'error',
          runId,
          from: ChunkFrom.AGENT,
          payload: { error },
        });
        controller.close();
      }
    },
  });
}

const EMPTY_V3_USAGE: V3Usage = {
  inputTokens: { total: undefined },
  outputTokens: { total: undefined },
};

function handleOpenCodeStreamEvent(
  event: Event,
  handlers: {
    assistantMessageId: string | undefined;
    setAssistantMessageId: (id: string) => void;
    setLastInfo: (info: AssistantMessage) => void;
    onTextDelta: (delta: string) => void;
    onLastPartText: (text: string) => void;
    onToolPart: (part: Extract<Part, { type: typeof OpenCodePartType.Tool }>) => void;
    onSubtaskPart: (part: Extract<Part, { type: typeof OpenCodePartType.Subtask }>) => void;
    onPartRemoved: (partId: string) => void;
    onCommandExecuted: (properties: Extract<Event, { type: typeof OpenCodeEventType.CommandExecuted }>['properties']) => void;
    onTodoUpdated: (properties: Extract<Event, { type: typeof OpenCodeEventType.TodoUpdated }>['properties']) => void;
    onPermissionAsked: (
      permission: Extract<Event, { type: typeof OpenCodeEventType.PermissionAsked }>['properties'],
    ) => void;
    onPermissionReplied: (requestId: string, reply: string) => void;
    onPermissionV2Asked: (
      permission: Extract<Event, { type: typeof OpenCodeEventType.PermissionV2Asked }>['properties'],
    ) => void;
    onPermissionV2Replied: (requestId: string, reply: string) => void;
  },
): void {
  if (event.type === OpenCodeEventType.MessageUpdated && event.properties.info.role === 'assistant') {
    handlers.setAssistantMessageId(event.properties.info.id);
    handlers.setLastInfo(event.properties.info);
    return;
  }

  if (event.type === OpenCodeEventType.MessagePartUpdated) {
    const part = event.properties.part;
    if (part.messageID !== handlers.assistantMessageId) {
      return;
    }

    if (part.type === OpenCodePartType.Text) {
      handlers.onLastPartText(part.text);
      return;
    }

    if (part.type === OpenCodePartType.Tool) {
      handlers.onToolPart(part);
      return;
    }

    if (part.type === OpenCodePartType.Subtask) {
      handlers.onSubtaskPart(part);
    }
    return;
  }

  if (event.type === OpenCodeEventType.MessagePartDelta) {
    if (event.properties.messageID !== handlers.assistantMessageId || event.properties.field !== 'text') {
      return;
    }
    handlers.onTextDelta(event.properties.delta);
    return;
  }

  if (event.type === OpenCodeEventType.MessagePartRemoved) {
    handlers.onPartRemoved(event.properties.partID);
    return;
  }

  if (event.type === OpenCodeEventType.CommandExecuted) {
    handlers.onCommandExecuted(event.properties);
    return;
  }

  if (event.type === OpenCodeEventType.TodoUpdated) {
    handlers.onTodoUpdated(event.properties);
    return;
  }

  if (event.type === OpenCodeEventType.PermissionAsked) {
    handlers.onPermissionAsked(event.properties);
    return;
  }

  if (event.type === OpenCodeEventType.PermissionReplied) {
    handlers.onPermissionReplied(event.properties.requestID, event.properties.reply);
    return;
  }

  if (event.type === OpenCodeEventType.PermissionV2Asked) {
    handlers.onPermissionV2Asked(event.properties);
    return;
  }

  if (event.type === OpenCodeEventType.PermissionV2Replied) {
    handlers.onPermissionV2Replied(event.properties.requestID, event.properties.reply);
    return;
  }

  if (event.type === OpenCodeEventType.SessionError && event.properties.error) {
    throw new Error(getOpenCodeErrorMessage(event.properties.error));
  }
}

function recordOpenCodeToolPart<OUTPUT>(
  part: Extract<Part, { type: typeof OpenCodePartType.Tool }>,
  telemetry: SDKAgentTelemetry<OUTPUT>,
  startedToolCallIds: Set<string>,
): void {
  if (!startedToolCallIds.has(part.callID)) {
    startedToolCallIds.add(part.callID);
    telemetry.startToolCall({ toolCallId: part.callID, toolName: part.tool, input: part.state.input });
  }

  if (part.state.status === 'completed') {
    telemetry.endToolCall({ toolCallId: part.callID, output: part.state.output });
  } else if (part.state.status === 'error') {
    telemetry.endToolCall({ toolCallId: part.callID, output: part.state.error, isError: true });
  }
}

function recordOpenCodeSubtaskStart<OUTPUT>(
  part: Extract<Part, { type: typeof OpenCodePartType.Subtask }>,
  telemetry: SDKAgentTelemetry<OUTPUT>,
  startedSubtaskIds: Set<string>,
): void {
  if (startedSubtaskIds.has(part.id)) {
    return;
  }

  startedSubtaskIds.add(part.id);
  telemetry.startToolCall({
    toolCallId: part.id,
    toolName: `subtask:${part.agent}`,
    input: { prompt: part.prompt, description: part.description },
  });
}

function recordOpenCodeSubtaskEnd<OUTPUT>(
  partId: string,
  telemetry: SDKAgentTelemetry<OUTPUT>,
  startedSubtaskIds: Set<string>,
): void {
  if (!startedSubtaskIds.has(partId)) {
    return;
  }

  startedSubtaskIds.delete(partId);
  telemetry.endToolCall({ toolCallId: partId });
}

function recordOpenCodeInstantToolEvent<OUTPUT>(
  telemetry: SDKAgentTelemetry<OUTPUT>,
  toolName: string,
  input: unknown,
): void {
  const toolCallId = randomUUID();
  telemetry.startToolCall({ toolCallId, toolName, input });
  telemetry.endToolCall({ toolCallId, output: input });
}

function recordOpenCodePermissionAsked<OUTPUT>(
  permission: Extract<Event, { type: typeof OpenCodeEventType.PermissionAsked }>['properties'],
  telemetry: SDKAgentTelemetry<OUTPUT>,
  startedPermissionIds: Set<string>,
): void {
  if (startedPermissionIds.has(permission.id)) {
    return;
  }

  startedPermissionIds.add(permission.id);
  telemetry.startToolCall({
    toolCallId: permission.id,
    toolName: `permission:${permission.permission}`,
    input: { patterns: permission.patterns, always: permission.always, callID: permission.tool?.callID },
  });
}

// Parallel to permission.asked/replied; tracked the same way.
function recordOpenCodePermissionV2Asked<OUTPUT>(
  permission: Extract<Event, { type: typeof OpenCodeEventType.PermissionV2Asked }>['properties'],
  telemetry: SDKAgentTelemetry<OUTPUT>,
  startedPermissionIds: Set<string>,
): void {
  if (startedPermissionIds.has(permission.id)) {
    return;
  }

  startedPermissionIds.add(permission.id);
  telemetry.startToolCall({
    toolCallId: permission.id,
    toolName: `permission.v2:${permission.action}`,
    input: { resources: permission.resources, save: permission.save, source: permission.source },
  });
}

function getResponseModelId(info: AssistantMessage): string {
  return `${info.providerID}/${info.modelID}`;
}

function toV3UsageFromTokens(tokens: AssistantMessage['tokens']): V3Usage {
  const noCache = tokens.input;
  const cacheRead = tokens.cache.read;
  const cacheWrite = tokens.cache.write;

  return {
    inputTokens: {
      total: sumDefined(noCache, cacheRead, cacheWrite),
      noCache,
      cacheRead,
      cacheWrite,
    },
    outputTokens: {
      total: tokens.output,
      text: tokens.output,
      reasoning: tokens.reasoning || undefined,
    },
  };
}

function getOpenCodeProviderMetadata(info: AssistantMessage): ProviderMetadata {
  return createProviderMetadata('opencode', {
    sessionId: info.sessionID,
    messageId: info.id,
    providerID: info.providerID,
    modelID: info.modelID,
    mode: info.mode,
    cost: info.cost,
    variant: info.variant,
    finish: info.finish,
  });
}

function getOpenCodeCostContext(info: AssistantMessage): CostContext | undefined {
  if (typeof info.cost !== 'number') {
    return undefined;
  }

  return {
    provider: 'opencode',
    model: getResponseModelId(info),
    estimatedCost: info.cost,
    costUnit: 'USD',
    costMetadata: {
      source: 'sdk_estimate',
      sdkProvider: PROVIDER,
      sdkCostField: 'cost',
      scope: 'message_total',
    },
  };
}

function getOpenCodeErrorMessage(error: unknown): string {
  const record = toRecord(error);
  const name = getString(record, 'name');
  const data = toRecord(record?.data);
  const message = getString(record, 'message') ?? getString(data, 'message');

  if (name === 'StructuredOutputError' && message) {
    const retries = data?.retries;
    return typeof retries === 'number' ? `${name}: ${message} (after ${retries} retries)` : `${name}: ${message}`;
  }

  if (message) {
    return name ? `${name}: ${message}` : message;
  }
  return name ?? 'OpenCode SDK request failed.';
}

function validateOpenCodeResumeData(resumeData: OpenCodeSDKAgentResumeData): OpenCodeSDKAgentResumeData {
  if (!isRecord(resumeData) || !('message' in resumeData)) {
    throw new Error('OpenCodeSDKAgent resumeData must include a message.');
  }
  if (typeof resumeData.sessionId !== 'string' || !resumeData.sessionId) {
    throw new Error('OpenCodeSDKAgent resumeData must include a sessionId.');
  }

  return resumeData;
}

function createOpenCodeResumeRunOptions<OUTPUT>(
  resumeData: OpenCodeSDKAgentResumeData,
  options?: OpenCodeSDKAgentRunOptions<OUTPUT>,
): OpenCodeSDKAgentRunOptions<OUTPUT> {
  return {
    ...options,
    promptOptions: {
      ...options?.promptOptions,
      sessionID: resumeData.sessionId,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
