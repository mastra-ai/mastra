import type {
  ListMemoryThreadMessagesResponse,
  MastraClient,
  MastraDBMessage,
  StreamParamsBaseWithoutMessages,
  StructuredOutputOptions,
} from '@mastra/client-js';
import type { FullOutput } from '@mastra/core/stream';

type ClientAgent = ReturnType<MastraClient['getAgent']>;

export type PlatformAgentMessages = Parameters<ClientAgent['stream']>[0];

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

export type PlatformAgentRunOptions<OUTPUT = undefined> = StreamParamsBaseWithoutMessages<OUTPUT> & {
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  /**
   * The end user the run acts for. Its memory, threads, and Connect accounts are scoped to it.
   * Defaults to `memory.resource`. Required unless `memory.resource` is set, since a project
   * access token is not tied to a user.
   */
  resourceId?: string;
};

export function toAgentBody(input: UpdatePlatformAgentInput): Record<string, unknown> {
  const { model, ...rest } = input;
  return model === undefined ? rest : { ...rest, model: { provider: 'mastra', name: model } };
}

/**
 * The Platform reads the caller's end user from a top-level `resourceId`; `memory.resource` alone
 * is not enough for a project access token.
 */
function withResourceId<O extends PlatformAgentRunOptions<any> | undefined>(options: O) {
  const resourceId = options?.resourceId ?? options?.memory?.resource;
  return (resourceId === undefined ? options : { ...options, resourceId }) as PlatformAgentRunOptions<any>;
}

/** A managed agent on Mastra Platform. Get one from `MastraPlatform.createAgent` or `getAgent`. */
export class PlatformAgent {
  readonly #client: MastraClient;
  readonly #agent: ClientAgent;

  constructor(
    client: MastraClient,
    readonly id: string,
  ) {
    this.#client = client;
    this.#agent = client.getAgent(id);
  }

  /** The agent's resolved configuration: instructions, model, tools, and skills. */
  details() {
    return this.#agent.details();
  }

  /** Updates the agent and publishes a new version. Only the fields you pass change. */
  update(input: UpdatePlatformAgentInput): Promise<PlatformAgentRecord> {
    return this.#client.request(this.#path, { method: 'PATCH', body: toAgentBody(input) });
  }

  /** Deletes the agent, its workspace bucket, and its Gateway key. */
  async delete(): Promise<void> {
    // The API answers 204 with no body; `stream` returns the response instead of parsing JSON.
    await this.#client.request(this.#path, { method: 'DELETE', stream: true });
  }

  /** Runs the agent and streams its output. */
  stream<OUTPUT = undefined>(messages: PlatformAgentMessages, options?: PlatformAgentRunOptions<OUTPUT>) {
    return this.#agent.stream(messages, withResourceId(options));
  }

  /** Runs the agent to completion. */
  generate<OUTPUT extends {}>(
    messages: PlatformAgentMessages,
    options: PlatformAgentRunOptions<OUTPUT> & { structuredOutput: StructuredOutputOptions<OUTPUT> },
  ): Promise<FullOutput<OUTPUT>>;
  generate(messages: PlatformAgentMessages, options?: PlatformAgentRunOptions): Promise<FullOutput<undefined>>;
  generate(messages: PlatformAgentMessages, options?: PlatformAgentRunOptions<any>) {
    return this.#agent.generate(messages, withResourceId(options));
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

  get #path() {
    return `/agents/${encodeURIComponent(this.id)}`;
  }
}
