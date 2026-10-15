import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { APIStatusError, voice } from '@livekit/agents';
import type { llm } from '@livekit/agents';
import type { MastraClient } from '@mastra/client-js';
import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import type { IMastraLogger } from '@mastra/core/logger';
import type { MastraMemory } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import type { MastraVoiceAgentMemory, VoiceTurnContext } from './bridge';
import { extractNewTurnMessages } from './messages';
import type { VoiceTurnMessage } from './messages';
import type { RemoteMastraAgentOptions } from './remote';

export interface TranscriptPersistenceStatus {
  /** Distinct messages whose latest writes were acknowledged by Memory. */
  saved: number;
  /** Distinct messages still waiting for their latest writes. */
  pending: number;
  /** Failed latest writes, plus one if capture or shutdown was incomplete. */
  failed: number;
}

export interface TranscriptPersistenceError {
  code: 'write_failed' | 'shutdown_timeout' | 'shutdown_failed' | 'snapshot_failed';
  threadId: string;
  sessionId: string;
  messageId?: string;
}

export interface TranscriptPersistenceOptions {
  /** Defaults to console.warn. The built-in worker uses the configured Mastra logger. */
  logger?: Pick<IMastraLogger, 'warn'>;
  /** Defaults to 10 seconds. Includes session close and the final storage drain. */
  shutdownTimeoutMs?: number;
  /** Receives identifiers and error categories, without transcript text. */
  onError?: (error: TranscriptPersistenceError) => void;
  /** Time spent waiting for preceding writes before generation, in milliseconds. */
  onBarrier?: (durationMs: number) => void;
}

export type CreateLiveKitTranscriptPersistenceOptions = TranscriptPersistenceOptions & {
  /** The existing LiveKit job ID, or a stable application session ID for a custom session. */
  sessionId: string;
  memory: MastraVoiceAgentMemory;
  requestContext?: RequestContext | Record<string, unknown>;
} & ({ agent: Agent; remote?: never } | { remote: { client: MastraClient; agentId: string }; agent?: never });

const bindingSchema = z
  .object({
    agent: z
      .custom<Agent>(
        value => !!value && typeof value === 'object' && 'getMemory' in value && typeof value.getMemory === 'function',
      )
      .optional(),
    remote: z
      .object({
        client: z.custom<MastraClient>(
          value =>
            !!value &&
            typeof value === 'object' &&
            'saveMessageToMemory' in value &&
            typeof value.saveMessageToMemory === 'function',
        ),
        agentId: z.string().min(1),
      })
      .optional(),
    sessionId: z.string().min(1),
    memory: z.object({
      thread: z.string().min(1),
      resource: z.string().min(1).optional(),
      options: z
        .object({ readOnly: z.literal(true).optional() })
        .passthrough()
        .optional(),
    }),
    shutdownTimeoutMs: z.number().finite().positive().optional(),
  })
  .refine(value => !!value.agent !== !!value.remote, 'Transcript persistence requires exactly one agent source');

type Write = {
  id: string;
  message?: MastraDBMessage;
  signature: string;
  state: 'pending' | 'saved' | 'failed';
};

type Identity = { id: string; createdAt: Date; sequence: number };
type Store = {
  save(messages: MastraDBMessage[]): Promise<unknown>;
};

const owners = new WeakMap<voice.AgentSession, LiveKitTranscriptPersistence>();

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function notify<T>(callback: ((value: T) => void) | undefined, value: T): void {
  try {
    if (callback)
      void Promise.resolve(callback(value)).catch(() => {
        console.warn('@mastra/livekit: transcript persistence observer rejected');
      });
  } catch {
    console.warn('@mastra/livekit: transcript persistence observer threw');
  }
}

/**
 * Binds committed LiveKit conversation items and Mastra generation to one Memory thread.
 * Create with createLiveKitTranscriptPersistence, pass to MastraLLM, and attach before session.start.
 */
export class LiveKitTranscriptPersistence {
  readonly memory: MastraVoiceAgentMemory;
  readonly requestContext?: RequestContext;
  readonly agent?: Agent;
  readonly remote?: RemoteMastraAgentOptions;
  readonly memoryInstance?: MastraMemory;
  readonly sessionId: string;
  readonly #store: Store;
  readonly #options: TranscriptPersistenceOptions;
  readonly #identities = new Map<string, Identity>();
  readonly #writes = new Map<string, Write>();
  readonly #unfinished = new Map<string, Write>();
  readonly #toolArgs = new Map<string, unknown>();
  #tail: Promise<void> = Promise.resolve();
  #sequence = 0;
  #lastTime: number;
  #session?: voice.AgentSession;
  #closed = false;
  #closing?: Promise<TranscriptPersistenceStatus>;
  #snapshotFailed = false;
  #claimed = false;

  /** @internal Use createLiveKitTranscriptPersistence. */
  constructor(args: {
    options: CreateLiveKitTranscriptPersistenceOptions;
    store: Store;
    lastTime: number;
    memoryInstance?: MastraMemory;
    remote?: RemoteMastraAgentOptions;
    requestContext?: RequestContext;
  }) {
    this.#store = args.store;
    this.#lastTime = args.lastTime;
    this.#options = args.options;
    this.sessionId = args.options.sessionId;
    this.agent = args.options.agent;
    this.remote = args.remote;
    this.memoryInstance = args.memoryInstance;
    this.requestContext = args.requestContext;
    this.memory = Object.freeze({
      ...args.options.memory,
      resource: args.options.memory.resource ?? args.options.memory.thread,
      options: Object.freeze({ ...args.options.memory.options, readOnly: true }),
    });
  }

  /** @internal Prevent two generation sources from sharing a persistence owner. */
  claim(): void {
    if (this.#claimed) throw new Error('@mastra/livekit: transcript persistence already has a generation source');
    this.#claimed = true;
  }

  /** Register before starting the session, including before its greeting. */
  attach(session: voice.AgentSession): void {
    if (this.#closed || this.#session || owners.has(session)) {
      throw new Error('@mastra/livekit: transcript persistence is closed or already attached');
    }
    if (!this.#claimed)
      throw new Error('@mastra/livekit: pass transcript persistence to a Mastra generation source first');
    this.#session = session;
    owners.set(session, this);
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, this.#onItem);
  }

  get status(): TranscriptPersistenceStatus {
    const status = { saved: 0, pending: 0, failed: this.#snapshotFailed ? 1 : 0 };
    for (const write of this.#writes.values()) status[write.state]++;
    return status;
  }

  #identity(key: string, nativeTime: number): Identity {
    const existing = this.#identities.get(key);
    if (existing) return existing;
    // Stored timestamps order messages for existing Memory readers. The unmodified native
    // timestamp is retained in metadata. Reserve input identities before speculative tools run.
    const time = Math.max(Number.isFinite(nativeTime) ? nativeTime : Date.now(), this.#lastTime + 1);
    this.#lastTime = time;
    const identity = {
      id: `livekit:${digest(JSON.stringify([this.memory.thread, this.sessionId, key]))}`,
      createdAt: new Date(time),
      sequence: ++this.#sequence,
    };
    this.#identities.set(key, identity);
    return identity;
  }

  #message(
    key: string,
    nativeTime: number,
    role: 'user' | 'assistant',
    content: MastraDBMessage['content'],
  ): MastraDBMessage {
    const identity = this.#identity(key, nativeTime);
    return {
      id: identity.id,
      threadId: this.memory.thread,
      resourceId: this.memory.resource!,
      createdAt: identity.createdAt,
      role,
      type: 'v2',
      content: {
        ...content,
        metadata: {
          ...content.metadata,
          source: 'livekit',
          sessionId: this.sessionId,
          sequence: identity.sequence,
          nativeCreatedAt: nativeTime,
        },
      },
    };
  }

  #error(code: TranscriptPersistenceError['code'], messageId?: string): void {
    const error = { code, messageId, threadId: this.memory.thread, sessionId: this.sessionId };
    try {
      (this.#options.logger ?? console).warn('@mastra/livekit: transcript persistence error', error);
    } catch {
      // A logger must not reject the write queue or throw into a LiveKit event callback.
    }
    notify(this.#options.onError, error);
  }

  #enqueue(message: MastraDBMessage): void {
    // The SDK may revise an item. Serialize revisions and only let the newest revision
    // determine its final status. A failed older revision cannot overwrite a newer one.
    const signature = digest(JSON.stringify(message));
    const previous = this.#writes.get(message.id);
    if (previous?.signature === signature) return;
    const write: Write = { id: message.id, message: structuredClone(message), signature, state: 'pending' };
    this.#writes.set(message.id, write);
    this.#unfinished.set(message.id, write);
    this.#schedule(write);
  }

  #schedule(write: Write): void {
    write.state = 'pending';
    this.#tail = this.#tail.then(async () => {
      try {
        // Memory implementations may normalize their input; retries retain the original snapshot.
        await this.#store.save([structuredClone(write.message!)]);
        write.state = 'saved';
        if (this.#unfinished.get(write.id) === write) this.#unfinished.delete(write.id);
        // Retain only identity/signature/status after success, not a second full transcript.
        write.message = undefined;
      } catch {
        write.state = 'failed';
        this.#error('write_failed', write.id);
      }
    });
  }

  #onItem = (event: voice.ConversationItemAddedEvent): void => {
    const item = event.item;
    if (this.#closed || item.type !== 'message' || (item.role !== 'user' && item.role !== 'assistant')) return;
    // Preserve committed string parts exactly; textContent may strip markup and whitespace.
    // Instructions, audio and image parts aren't transcript text.
    const text = item.content.filter((part): part is string => typeof part === 'string').join('\n');
    if (!text?.trim()) return;
    try {
      this.#enqueue(
        this.#message(`item:${item.id}`, item.createdAt, item.role, {
          format: 2,
          parts: [{ type: 'text', text }],
          metadata: { kind: 'conversation_item', liveKitItemId: item.id, interrupted: item.interrupted },
        }),
      );
    } catch {
      this.#snapshotFailed = true;
      this.#error('snapshot_failed');
    }
  };

  /** @internal Extract the current input with the same IDs used by stored messages. */
  messages(chatCtx: llm.ChatContext): VoiceTurnMessage[] {
    if (!this.#session || this.#closed)
      throw new Error('@mastra/livekit: attach transcript persistence before generation');
    const messages = extractNewTurnMessages(chatCtx);
    const remaining = new Map(messages.filter(message => message.id).map(message => [message.id!, message]));
    // Walk only the new-turn suffix, rather than copying the entire call history every turn.
    for (let i = chatCtx.items.length - 1; i >= 0 && remaining.size > 0; i--) {
      const item = chatCtx.items[i]!;
      const message = remaining.get(item.id);
      if (!message || item.type !== 'message') continue;
      remaining.delete(item.id);
      message.content = item.content.filter((part): part is string => typeof part === 'string').join('\n');
      message.id = this.#identity(`item:${item.id}`, item.createdAt).id;
    }
    return messages;
  }

  /** @internal Runs once before a generation, never once per token or audio frame. */
  async beforeGeneration(): Promise<void> {
    const started = performance.now();
    // Capture this boundary: don't wait for items belonging to the generation being started.
    const preceding = this.#tail;
    const writes = [...this.#unfinished.values()];
    await preceding;
    notify(this.#options.onBarrier, performance.now() - started);
    if (this.#snapshotFailed || writes.some(write => write.state === 'failed')) {
      throw new Error('@mastra/livekit: preceding transcript writes failed; generation stopped');
    }
  }

  /** @internal Preserve public Mastra tool chunks independently of speech commitment. */
  toolChunk(type: string, payload: Record<string, unknown>, ctx: VoiceTurnContext): void {
    if (
      this.#closed ||
      !ctx.attemptId ||
      typeof payload.toolCallId !== 'string' ||
      typeof payload.toolName !== 'string'
    )
      return;
    if (type !== 'tool-call' && type !== 'tool-result' && type !== 'tool-error') return;
    try {
      const key = `tool:${ctx.attemptId}:${payload.toolCallId}`;
      const identity = this.#identity(key, Date.now());
      if (type !== 'tool-call' && payload.args === undefined && !this.#toolArgs.has(key)) {
        throw new Error('Tool result has no matching call or arguments');
      }
      const args = payload.args ?? this.#toolArgs.get(key) ?? {};
      if (type === 'tool-call') this.#toolArgs.set(key, structuredClone(args));
      const base = { toolCallId: payload.toolCallId, toolName: payload.toolName, args };
      const invocation =
        type === 'tool-call'
          ? { ...base, state: 'call' as const }
          : type === 'tool-error' || payload.isError
            ? {
                ...base,
                state: 'output-error' as const,
                errorText: String(payload.error ?? payload.result),
                result: payload.result,
              }
            : { ...base, state: 'result' as const, result: payload.result };
      this.#enqueue(
        this.#message(key, identity.createdAt.getTime(), 'assistant', {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: invocation,
              ...(payload.providerExecuted === true && { providerExecuted: true }),
            },
          ],
          metadata: { kind: 'tool', attemptId: ctx.attemptId, turnId: ctx.turnId },
        }),
      );
    } catch {
      this.#snapshotFailed = true;
      this.#error('snapshot_failed');
    }
  }

  /** @internal Tool arguments are needed only until their generation stream ends. */
  endGeneration(attemptId: string | undefined): void {
    if (!attemptId) return;
    for (const key of this.#toolArgs.keys()) if (key.startsWith(`tool:${attemptId}:`)) this.#toolArgs.delete(key);
  }

  /** Drain accepted writes. Explicit retries reuse the last failed snapshot and never run tools. */
  async flush({ retryFailed = false }: { retryFailed?: boolean } = {}): Promise<TranscriptPersistenceStatus> {
    if (retryFailed) {
      for (const write of this.#writes.values()) if (write.state === 'failed') this.#schedule(write);
    }
    await this.#tail;
    return this.status;
  }

  /** Close LiveKit first so its final interrupted item can be committed, then drain and detach. */
  close(): Promise<TranscriptPersistenceStatus> {
    if (this.#closing) return this.#closing;
    this.#closing = Promise.resolve().then(() => this.#close());
    return this.#closing;
  }

  async #close(): Promise<TranscriptPersistenceStatus> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = async () => {
      try {
        await this.#session?.close();
      } catch {
        this.#snapshotFailed = true;
        this.#error('shutdown_failed');
      }
      return this.flush();
    };
    try {
      return await Promise.race([
        finish(),
        new Promise<TranscriptPersistenceStatus>(resolve => {
          timer = setTimeout(() => {
            this.#snapshotFailed = true;
            this.#error('shutdown_timeout');
            resolve(this.status);
          }, this.#options.shutdownTimeoutMs ?? 10_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      this.#closed = true;
      if (this.#session) {
        this.#session.off(voice.AgentSessionEventTypes.ConversationItemAdded, this.#onItem);
        owners.delete(this.#session);
      }
    }
  }
}

/** Resolve Memory and verify the thread's ownership before starting any speech or generation. */
export async function createLiveKitTranscriptPersistence(
  options: CreateLiveKitTranscriptPersistenceOptions,
): Promise<LiveKitTranscriptPersistence> {
  bindingSchema.parse(options);
  const requestContext =
    options.requestContext instanceof RequestContext
      ? options.requestContext
      : options.requestContext
        ? new RequestContext<unknown>(Object.entries(options.requestContext))
        : undefined;
  const threadId = options.memory.thread;
  const resourceId = options.memory.resource ?? threadId;
  let memoryInstance: MastraMemory | undefined;
  let remote: RemoteMastraAgentOptions | undefined;
  let store: Store;
  let getThread: () => Promise<{ resourceId: string } | null | undefined>;
  let createThread: () => Promise<unknown>;
  let lastTime: () => Promise<number>;

  if (options.agent) {
    memoryInstance = await options.agent.getMemory({ requestContext });
    if (!memoryInstance) throw new Error('@mastra/livekit: transcript persistence requires agent Memory');
    const memory = memoryInstance;
    store = { save: messages => memory.saveMessages({ messages, memoryConfig: options.memory.options }) };
    getThread = () => memory.getThreadById({ threadId });
    createThread = () =>
      memory.createThread({ threadId, resourceId, title: 'Voice call', metadata: { source: 'livekit' } });
    lastTime = async () => {
      const result = await memory.recall({
        threadId,
        resourceId,
        perPage: 1,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages[0]?.createdAt.getTime() ?? 0;
    };
  } else {
    const { client, agentId } = options.remote!;
    // The save endpoint uses the agent's configured Memory settings. Only read-side overrides
    // can differ per run without making generation and persistence use different write settings.
    if (Object.keys(options.memory.options ?? {}).some(key => key !== 'readOnly' && key !== 'lastMessages')) {
      throw new Error(
        '@mastra/livekit: remote transcript persistence supports only readOnly and lastMessages memory overrides',
      );
    }
    const { config } = await client.getMemoryConfig({ agentId, requestContext });
    if (!config) throw new Error('@mastra/livekit: remote agent has no Memory');
    const thread = client.getMemoryThread({ threadId, agentId });
    store = { save: messages => client.saveMessageToMemory({ agentId, messages, requestContext }) };
    getThread = async () => {
      try {
        return await thread.get(requestContext);
      } catch (error) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) return null;
        throw error;
      }
    };
    createThread = () =>
      client.createMemoryThread({
        agentId,
        threadId,
        resourceId,
        title: 'Voice call',
        metadata: { source: 'livekit' },
        requestContext,
      });
    lastTime = async () => {
      const result = await thread.listMessages({
        perPage: 1,
        orderBy: { field: 'createdAt', direction: 'DESC' },
        requestContext,
      });
      return result.messages[0] ? new Date(result.messages[0].createdAt).getTime() : 0;
    };
    remote = {
      baseUrl: client.options.baseUrl,
      apiPrefix: client.options.apiPrefix,
      agentId,
      // Let the same client own prefix normalization, credentials, fetch and abort signals
      // for generation and persistence. LiveKit still owns generation retries/timeouts.
      fetch: async (_input, init) => {
        try {
          return await client.request<Response>(`/agents/${encodeURIComponent(agentId)}/stream`, {
            method: 'POST',
            body: JSON.parse(String(init?.body)),
            signal: init?.signal ?? undefined,
            stream: true,
            retries: 0,
          });
        } catch (error) {
          if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
            throw new APIStatusError({
              message: `Mastra server returned HTTP ${error.status}`,
              options: {
                statusCode: error.status,
                retryable: error.status === 429 || error.status >= 500,
              },
            });
          }
          throw error;
        }
      },
    };
  }
  let existing = await getThread();
  if (!existing) {
    try {
      await createThread();
    } catch (error) {
      existing = await getThread();
      if (!existing) throw error;
    }
    existing ??= await getThread();
  }
  if (!existing || existing.resourceId !== resourceId) {
    throw new Error('@mastra/livekit: transcript thread belongs to a different resource or could not be created');
  }
  return new LiveKitTranscriptPersistence({
    options,
    store,
    lastTime: await lastTime(),
    memoryInstance,
    remote,
    requestContext,
  });
}
