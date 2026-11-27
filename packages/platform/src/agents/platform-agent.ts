import type {
  ListMemoryThreadMessagesResponse,
  MastraClient,
  MastraDBMessage,
  StreamParamsBaseWithoutMessages,
} from '@mastra/client-js';
import { Agent, MessageList } from '@mastra/core/agent';
import type { AgentExecutionOptionsBase, PublicStructuredOutputOptions, ToolsInput } from '@mastra/core/agent';
import type { AIV5ResponseMessage, MessageListInput } from '@mastra/core/agent/message-list';
import type { LanguageModel } from '@mastra/core/llm';
import type { MastraMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { MastraModelOutput } from '@mastra/core/stream';
import type { ChunkType, FullOutput } from '@mastra/core/stream';
import { createTool } from '@mastra/core/tools';

type ClientAgent = ReturnType<MastraClient['getAgent']>;

/** Agent configuration accepted by the Managed Agents API when creating an agent. */
export interface CreatePlatformAgentInput {
  name: string;
  description?: string;
  instructions: string;
  /**
   * Gateway model as `provider/model`, e.g. `openai/gpt-5-mini`. Inference is billed to the
   * agent's own Mastra Gateway key. Defaults to the Platform's default model.
   */
  model?: string;
  /** Project Connect connections whose tools the agent can use. */
  connectionIds?: string[];
  /** Stored skills in the project to attach to the agent. */
  skillIds?: string[];
  /** Built-in Platform tools to enable, by id (e.g. `list_agents`). */
  builtinTools?: string[];
  /** Expose the agent's tools through code mode. On unless set to `false`. */
  codeMode?: boolean;
}

export type UpdatePlatformAgentInput = Partial<CreatePlatformAgentInput>;

/** A stored managed agent as the Managed Agents API returns it. */
export interface PlatformAgentRecord {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

/** One of a managed agent's tools, as the Platform describes it. */
export interface PlatformAgentToolInfo {
  id: string;
  description?: string;
  /** JSON Schema of the tool's input, serialized as the Platform sends it. */
  inputSchema?: string;
  outputSchema?: string;
  requireApproval?: boolean;
}

/** What a `PlatformAgent` knows about its managed agent before it runs. */
export interface PlatformAgentConfig {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  /** Gateway model as `provider/model`, e.g. `openai/gpt-5-mini`. */
  model?: string;
  /** The agent's tools, keyed by name, as the Platform's agent details list them. */
  tools?: Record<string, PlatformAgentToolInfo>;
  /** Resolves the Memory the agent's conversations are kept in. */
  memory?: () => Promise<MastraMemory | undefined>;
}

/**
 * Run options for a managed agent. The run happens on the Platform, so only options that cross the
 * wire apply: `memory`, `resourceId`, `runId`, `requestContext`, `structuredOutput`,
 * `maxSteps`, `modelSettings`, `toolChoice`, `activeTools`, `instructions`, `system`, `context`,
 * `savePerStep`, `providerOptions`, and `abortSignal`. `onChunk`, `onStepFinish`, `onFinish`, and
 * `onError` run locally. Options that act on a local run, such as tools or processors, are ignored.
 *
 * A project access token is not tied to a user, so a run must name the end user it acts for with
 * `resourceId`, `memory.resource`, or the request context's `mastra__resourceId`.
 */
export type PlatformAgentRunOptions<OUTPUT = unknown> = AgentExecutionOptionsBase<OUTPUT> & {
  /** The end user the run acts for. Defaults to `memory.resource`. */
  resourceId?: string;
  structuredOutput?: PublicStructuredOutputOptions<OUTPUT>;
};

const FORWARDED_OPTIONS = [
  'memory',
  'resourceId',
  'runId',
  'maxSteps',
  'modelSettings',
  'toolChoice',
  'activeTools',
  'instructions',
  'system',
  'context',
  'savePerStep',
  'providerOptions',
  'abortSignal',
] as const;

export function toAgentBody(input: UpdatePlatformAgentInput): Record<string, unknown> {
  const { model, ...rest } = input;
  return model === undefined ? rest : { ...rest, model: { provider: 'mastra', name: model } };
}

/**
 * The agent's model as the framework sees it: the same Gateway model the Platform runs. With
 * `MASTRA_GATEWAY_API_KEY` set it runs locally through the Mastra Gateway, billed to that key;
 * without one it reports the model and refuses to be called.
 */
function platformModel(model: string | undefined) {
  return (): LanguageModel | string => {
    if (model && process.env.MASTRA_GATEWAY_API_KEY) return `mastra/${model}`;
    const id = model ?? 'platform-default';
    const slash = id.indexOf('/');
    const refuse = () => {
      throw new Error(
        `Set MASTRA_GATEWAY_API_KEY to call managed agent model ${id} locally through the Mastra Gateway`,
      );
    };
    return {
      specificationVersion: 'v2',
      provider: slash > 0 ? id.slice(0, slash) : 'mastra-platform',
      modelId: slash > 0 ? id.slice(slash + 1) : id,
      supportedUrls: {},
      doGenerate: refuse,
      doStream: refuse,
    };
  };
}

/** A schema the Platform sent through superjson; plain JSON Schema keeps its body under `json`. */
function wireSchema(serialized: string | undefined) {
  if (!serialized) return undefined;
  const parsed = JSON.parse(serialized) as { json?: unknown };
  return (parsed && typeof parsed === 'object' && 'json' in parsed ? parsed.json : parsed) as never;
}

/**
 * Entries of a request context that can travel to the Platform: caller data only, as JSON. Mastra's
 * own `mastra__`/`__mastra_` keys hold local run state, sometimes live objects, and the Platform
 * would refuse them anyway.
 */
function wireRequestContext(context: AgentExecutionOptionsBase<unknown>['requestContext']) {
  if (!context) return undefined;
  const entries = context instanceof RequestContext ? context.entries() : Object.entries(context);
  const out: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (key.startsWith('mastra__') || key.startsWith('__mastra_') || key === 'MastraMemory') continue;
    try {
      const json = JSON.stringify(value);
      if (json !== undefined) out[key] = JSON.parse(json);
    } catch {
      // Not JSON (a live object or a cycle): it stays local.
    }
  }
  return out;
}

/**
 * A managed agent on Mastra Platform, as a Mastra `Agent`. Register it in `new Mastra({ agents })`,
 * give it to another agent as a sub-agent, or use it as a workflow step like any other agent; its
 * runs happen on the Platform with the agent's own instructions, tools, and memory. Get one from
 * `MastraPlatform.createAgent` or `getAgent`.
 */
export class PlatformAgent extends Agent<string> {
  readonly #client: MastraClient;
  readonly #remote: ClientAgent;
  readonly #memory: PlatformAgentConfig['memory'];

  constructor(client: MastraClient, config: PlatformAgentConfig) {
    super({
      id: config.id,
      name: config.name,
      description: config.description,
      instructions: config.instructions ?? '',
      model: platformModel(config.model),
    });
    this.#client = client;
    this.#remote = client.getAgent(config.id);
    this.#memory = config.memory;
    this.__setTools(this.#tools(config.tools ?? {}));
  }

  /**
   * The agent's tools, described as the Platform reports them. Calling one runs it on the Platform
   * with the agent's own connections, for the end user named by the calling agent's
   * `resourceId`, or the request context's `mastra__resourceId`.
   */
  #tools(infos: Record<string, PlatformAgentToolInfo>): ToolsInput {
    const tools: ToolsInput = {};
    for (const [name, info] of Object.entries(infos)) {
      tools[name] = createTool({
        id: info.id,
        description: info.description ?? '',
        inputSchema: wireSchema(info.inputSchema),
        outputSchema: wireSchema(info.outputSchema),
        requireApproval: info.requireApproval,
        execute: async (data, context) => {
          const contextResourceId = context?.requestContext?.get(MASTRA_RESOURCE_ID_KEY);
          const resourceId =
            context?.agent?.resourceId ?? (typeof contextResourceId === 'string' ? contextResourceId : undefined);
          const requestContext = wireRequestContext(context?.requestContext);
          return this.#client.request(`${this.#path}/tools/${encodeURIComponent(info.id)}/execute`, {
            method: 'POST',
            body: {
              data,
              ...(resourceId && { resourceId }),
              ...(requestContext && Object.keys(requestContext).length > 0 && { requestContext }),
            },
          });
        },
      });
    }
    return tools;
  }

  /** The agent's resolved configuration on the Platform: instructions, model, tools, and skills. */
  details() {
    return this.#remote.details();
  }

  /** Updates the agent and publishes a new version. Only the fields you pass change. */
  async update(input: UpdatePlatformAgentInput): Promise<PlatformAgentRecord> {
    const record = await this.#client.request<PlatformAgentRecord>(this.#path, {
      method: 'PATCH',
      body: toAgentBody(input),
    });
    if (input.name !== undefined) this.name = input.name;
    if (input.instructions !== undefined) this.__updateInstructions(input.instructions);
    if (input.model !== undefined) this.__updateModel({ model: platformModel(input.model) });
    // Connections, skills, and built-in tools change the agent's tools.
    if (input.connectionIds || input.skillIds || input.builtinTools || input.codeMode !== undefined) {
      this.__setTools(this.#tools((await this.details()).tools ?? {}));
    }
    return record;
  }

  /** Deletes the agent, its workspace bucket, and its Gateway key. */
  async delete(): Promise<void> {
    // The API answers 204 with no body; `stream` returns the response instead of parsing JSON.
    await this.#client.request(this.#path, { method: 'DELETE', stream: true });
  }

  /** The end user's threads with this agent, most recently updated first. */
  listThreads(params: { resourceId: string; page?: number; perPage?: number }) {
    return this.#client.listMemoryThreads({ ...params, agentId: this.id });
  }

  /** Messages in one of the end user's threads with this agent. */
  listMessages(
    threadId: string,
    params: { resourceId: string; page?: number; perPage?: number },
  ): Promise<Omit<ListMemoryThreadMessagesResponse, 'messages'> & { messages: MastraDBMessage[] }> {
    return this.#client.listThreadMessages(threadId, { ...params, agentId: this.id });
  }

  // Same overloads as `Agent.stream`, so a managed agent types like any other agent.
  override async stream<OUTPUT extends {}>(
    messages: MessageListInput,
    options: PlatformAgentRunOptions<OUTPUT> & { structuredOutput: PublicStructuredOutputOptions<OUTPUT> },
  ): Promise<MastraModelOutput<OUTPUT>>;
  override async stream(
    messages: MessageListInput,
    options?: PlatformAgentRunOptions,
  ): Promise<MastraModelOutput<undefined>>;
  /** Runs the agent on the Platform and streams its output. */
  override async stream(
    messages: MessageListInput,
    options?: PlatformAgentRunOptions<any>,
  ): Promise<MastraModelOutput<any>> {
    return this.#run(messages, options);
  }

  override async generate<OUTPUT extends {}>(
    messages: MessageListInput,
    options: PlatformAgentRunOptions<OUTPUT> & { structuredOutput: PublicStructuredOutputOptions<OUTPUT> },
  ): Promise<FullOutput<OUTPUT>>;
  override async generate(
    messages: MessageListInput,
    options?: PlatformAgentRunOptions,
  ): Promise<FullOutput<undefined>>;
  /** Runs the agent on the Platform to completion. Rejects with the run's error if it fails. */
  override async generate(
    messages: MessageListInput,
    options?: PlatformAgentRunOptions<any>,
  ): Promise<FullOutput<any>> {
    // Rejects with the run's error, as a local agent's `generate` does.
    return (await this.#run(messages, options)).getFullOutput();
  }

  async #run(messages: MessageListInput, options: PlatformAgentRunOptions<any> = {}) {
    const runId = options.runId ?? crypto.randomUUID();
    // The Platform reads the caller's end user from a top-level `resourceId`; `memory.resource`
    // alone is not enough for a project access token. A server that authenticated the end user
    // carries it in the request context, which also reaches agents run as workflow steps.
    const contextResourceId =
      options.requestContext instanceof RequestContext ? options.requestContext.get(MASTRA_RESOURCE_ID_KEY) : undefined;
    // As in a local run, the request context's end user wins over `memory.resource`.
    const resourceId =
      options.resourceId ??
      (typeof contextResourceId === 'string' && contextResourceId ? contextResourceId : undefined) ??
      options.memory?.resource;
    const thread = options.memory?.thread;
    const threadId = typeof thread === 'string' ? thread : thread?.id;

    const body: Record<string, unknown> = { runId };
    for (const key of FORWARDED_OPTIONS) {
      if (options[key] !== undefined) body[key] = options[key];
    }
    if (resourceId !== undefined) body.resourceId = resourceId;
    const requestContext = wireRequestContext(options.requestContext);
    if (requestContext && Object.keys(requestContext).length > 0) body.requestContext = requestContext;
    if (options.structuredOutput) {
      // The model that would repair structured output locally cannot cross the wire.
      const { model: _model, ...structuredOutput } = options.structuredOutput;
      body.structuredOutput = structuredOutput;
    }

    const cancel = new AbortController();
    const signals = [cancel.signal, options.abortSignal].filter((signal): signal is AbortSignal => !!signal);
    body.abortSignal = AbortSignal.any(signals);

    const response = await this.#remote.stream(messages, body as StreamParamsBaseWithoutMessages);

    let replyId: string | undefined;
    const messageList = new MessageList({
      threadId,
      resourceId,
      generateMessageId: () => replyId ?? crypto.randomUUID(),
    });
    messageList.add(messages, 'input');

    // Each part of the reply keeps the ID the Platform saved it under, so saving the reply again
    // (as a supervisor does with a sub-agent's transcript) updates those messages instead of
    // adding copies. Observational Memory can move the reply to a new message between steps; each
    // step reports the message its output went to and the reply so far, tool results included.
    const steps: { messageId?: string; replied: number }[] = [];
    const addReply = (reply: AIV5ResponseMessage[]) => {
      let from = 0;
      for (const [index, step] of steps.entries()) {
        const to = index === steps.length - 1 ? reply.length : step.replied;
        if (index > 0 && step.messageId !== steps[index - 1]!.messageId) messageList.markResponseMessageBoundary();
        replyId = step.messageId;
        if (to > from) messageList.add(reply.slice(from, to), 'response');
        from = Math.max(from, to);
      }
      replyId = undefined;
      if (from < reply.length) messageList.add(reply.slice(from), 'response');
    };
    const { onChunk } = options;
    const chunks = new ReadableStream<ChunkType<any>>({
      start(controller) {
        response
          .processDataStream({
            onChunk: async chunk => {
              if (chunk.type === 'step-finish') {
                const { messageId } = chunk.payload;
                steps.push({
                  messageId: typeof messageId === 'string' ? messageId : undefined,
                  replied: chunk.payload.messages?.nonUser.length ?? 0,
                });
              }
              // Mastra's output reads the run's reply from its message list, which the Platform
              // filled on its side; the finish chunk carries it.
              if (chunk.type === 'finish' && chunk.payload.messages?.nonUser) {
                addReply(chunk.payload.messages.nonUser);
              }
              await onChunk?.(chunk as never);
              controller.enqueue(chunk as ChunkType<any>);
            },
          })
          .then(
            () => controller.close(),
            error => controller.error(error),
          );
      },
      cancel() {
        cancel.abort();
      },
    });

    const model = await this.getModel();
    return new MastraModelOutput<any>({
      model: { modelId: model.modelId, provider: model.provider, version: 'v2' },
      stream: chunks,
      messageList,
      messageId: crypto.randomUUID(),
      options: {
        runId,
        requestContext: options.requestContext instanceof RequestContext ? options.requestContext : undefined,
        onFinish: options.onFinish,
        onStepFinish: options.onStepFinish,
      },
    });
  }

  /** A managed agent always keeps its conversations on the Platform. */
  override hasOwnMemory(): boolean {
    return true;
  }

  /**
   * The Platform Memory the agent's conversations are kept in, to read its threads directly.
   * `undefined` until the project's agent memory is ready.
   */
  override async getMemory(): Promise<MastraMemory | undefined> {
    return this.#memory?.();
  }

  get #path() {
    return `/agents/${encodeURIComponent(this.id)}`;
  }
}
