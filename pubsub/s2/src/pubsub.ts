import { randomUUID } from 'node:crypto';
import { InMemoryServerCache } from '@mastra/core/cache';
import { CachingPubSub, EventEmitterPubSub } from '@mastra/core/events';
import type { CachingPubSubOptions, Event, PubSub } from '@mastra/core/events';
import type { ReadBatch, S2Basin, S2Endpoints, S2EndpointsInit } from '@s2-dev/streamstore';
import { AppendInput, AppendRecord, RangeNotSatisfiableError, S2, S2Error } from '@s2-dev/streamstore';

export interface S2PubSubConfig {
  /** An S2 client (takes precedence over `accessToken`). */
  client?: S2;
  /** An S2 access token, used to build a client when `client` is omitted. */
  accessToken?: string;
  /** Basin for the durable streams; enable create-on-append and create-on-read on it. */
  basin: string;
  /** Endpoint overrides, e.g. for `s2-lite`. */
  endpoints?: S2Endpoints | S2EndpointsInit;
}

export interface S2PubSubOptions {
  /** Live-delivery transport. Defaults to in-process `EventEmitterPubSub`. */
  inner?: PubSub;
  /** S2 stream-name prefix. Defaults to `mastra/durable/`. */
  streamPrefix?: string;
  /** Only topics with this prefix are persisted to S2. Defaults to `agent.stream.`. */
  topicPrefix?: string;
  /** Optional logger for persistence failures. Falls back to `console`. */
  logger?: CachingPubSubOptions['logger'];
}

function isGone(error: unknown): boolean {
  return error instanceof S2Error && (error.status === 404 || error.code === 'stream_deletion_pending');
}

/**
 * Durable, resumable {@link PubSub} for durable agents, backed by S2.
 * One S2 stream per topic where the sequence number S2 assigns to each append is the event's index.
 */
export class S2PubSub extends CachingPubSub {
  private readonly basin: S2Basin;
  private readonly streamPrefix: string;
  private readonly topicPrefix: string;
  private readonly log?: CachingPubSubOptions['logger'];

  constructor(config: S2PubSubConfig, options: S2PubSubOptions = {}) {
    // The inherited cache is unused; publish/getHistory/clearTopic use s2 directly.
    super(options.inner ?? new EventEmitterPubSub(), new InMemoryServerCache());

    if (!config.basin) {
      throw new Error('S2PubSub: `basin` is required');
    }
    let s2: S2;
    if (config.client) {
      s2 = config.client;
    } else if (config.accessToken) {
      s2 = new S2({ accessToken: config.accessToken, endpoints: config.endpoints });
    } else {
      throw new Error('S2PubSub: provide either `client` or `accessToken`');
    }
    this.basin = s2.basin(config.basin); // built once, reused for every op
    this.streamPrefix = options.streamPrefix ?? 'mastra/durable/';
    this.topicPrefix = options.topicPrefix ?? 'agent.stream.';
    this.log = options.logger;
  }

  /** Determine if a topic should be persisted. */
  private shouldPersist(topic: string): boolean {
    return topic.startsWith(this.topicPrefix);
  }

  private streamName(topic: string): string {
    return `${this.streamPrefix}${topic}`;
  }

  private stream(topic: string) {
    return this.basin.stream(this.streamName(topic));
  }

  private serialize(value: unknown): string {
    return JSON.stringify(value) ?? 'null';
  }

  private deserialize(body: string, topic: string, seqNum: number): Record<string, unknown> {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      (this.log ?? console).error(`[S2PubSub] malformed record in ${topic} at seqNum ${seqNum}; replaying as empty`);
      return {};
    }
  }

  /** Persist events to S2, then deliver live. */
  async publish(
    topic: string,
    event: Omit<Event, 'id' | 'createdAt' | 'index'>,
    options?: { localOnly?: boolean },
  ): Promise<void> {
    if (!this.shouldPersist(topic)) {
      await this.getInner().publish(topic, event, options);
      return;
    }

    const base: Event = { ...event, id: randomUUID(), createdAt: new Date() };
    let index: number | undefined;
    try {
      const ack = await this.stream(topic).append(
        AppendInput.create([AppendRecord.string({ body: this.serialize(base) })]),
      );
      index = ack.start.seqNum;
    } catch (error) {
      // Persistence must not block live delivery.
      (this.log ?? console).error(`[S2PubSub] failed to persist event for ${topic}`, error);
    }

    await this.getInner().publish(topic, index !== undefined ? { ...base, index } : base, options);
  }

  /** Replay from an `offset`. */
  async getHistory(topic: string, offset: number = 0): Promise<Event[]> {
    if (!this.shouldPersist(topic)) {
      return [];
    }
    const stream = this.stream(topic);
    const out: Event[] = [];
    let cursor = Math.max(0, offset);

    while (true) {
      let batch: ReadBatch<'string'>;
      try {
        batch = await stream.read({ start: { from: { seqNum: cursor } } });
      } catch (error) {
        if (isGone(error) || error instanceof RangeNotSatisfiableError) {
          break;
        }
        throw error;
      }
      if (batch.records.length === 0) {
        break;
      }
      for (const record of batch.records) {
        out.push({ ...this.deserialize(record.body, topic, record.seqNum), index: record.seqNum } as Event);
        cursor = record.seqNum + 1;
      }
      if (batch.tail && cursor >= batch.tail.seqNum) {
        break;
      }
    }
    return out;
  }

  /**
   * Delete the stream when its run completes. With create-on-read enabled, a
   * later read recreates it empty — replay just yields no history.
   */
  async clearTopic(topic: string): Promise<void> {
    if (!this.shouldPersist(topic)) {
      return;
    }
    try {
      await this.basin.streams.delete({ stream: this.streamName(topic) });
    } catch (error) {
      if (!isGone(error)) {
        throw error;
      }
    }
  }
}
