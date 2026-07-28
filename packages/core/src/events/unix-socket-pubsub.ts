import { randomUUID } from 'node:crypto';
import { mkdir, open, stat, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import net from 'node:net';
import { dirname } from 'node:path';

import { decode, encode } from './codec';
import { PubSub } from './pubsub';
import type { PubSubDeliveryMode } from './pubsub';
import type { Event, EventCallback, SubscribeOptions } from './types';

type ClientFrame =
  | { type: 'subscribe'; topic: string; group?: string }
  | { type: 'unsubscribe'; topic: string; group?: string }
  | { type: 'publish'; topic: string; event: Omit<Event, 'id' | 'createdAt'>; localOnly?: boolean }
  | { type: 'ack'; id?: string }
  | { type: 'nack'; id?: string };

type ServerFrame =
  | { type: 'event'; topic: string; event: Event; group?: string }
  | { type: 'subscribed'; topic: string; group?: string };

type LocalSubscription = {
  callback: EventCallback;
  group?: string;
};

type UnixSocketPubSubOptions = {
  maxRemoteClientQueuedBytes?: number;
};

type BrokerClient = {
  socket: net.Socket;
  subscriptions: Set<string>;
  writeChain: Promise<void>;
  queuedBytes: number;
};

type SubscribeWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
};

const DEFAULT_MAX_REMOTE_CLIENT_QUEUED_BYTES = 64 * 1024 * 1024;

/**
 * Max number of times a local subscriber callback may be redelivered after a
 * nack. MUST be >= the consumer-side retry budget
 * (`WorkflowEventProcessor.MAX_DELIVERY_ATTEMPTS`) — otherwise the transport
 * gives up before the consumer can exhaust its budget and surface the terminal
 * failure, which would leave the run silently hung.
 *
 * An invariant test in
 * `packages/core/src/events/unix-socket-pubsub-redelivery-budget.test.ts`
 * pins this ordering against the consumer constant so the two constants stay
 * in sync as the consumer budget changes.
 */
export const MAX_LOCAL_REDELIVERIES = 6;
const REDELIVERY_DELAY_MS = 100;

function serializeFrame(frame: ClientFrame | ServerFrame): string {
  // Encode through the codec so non-JSON-safe values (Date, Error, Map, Set,
  // RegExp, URL, BigInt, undefined, registered classes) survive the wire
  // round-trip via tagged envelopes.
  return `${JSON.stringify(encode(frame))}\n`;
}

function writeSerializedFrame(socket: net.Socket, serializedFrame: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let writeCompleted = false;
    let drainCompleted = true;
    let settled = false;

    const cleanup = () => {
      socket.off('error', onError);
      socket.off('close', onClose);
      socket.off('drain', onDrain);
    };
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };
    const maybeResolve = () => {
      if (writeCompleted && drainCompleted) {
        settle();
      }
    };
    const onError = (error: Error) => settle(error);
    // NOTE: keep this exact message in sync with the transient-error classifier
    // in #sendToBroker (search for 'socket closed before write completed').
    const onClose = () => settle(new Error('UnixSocketPubSub socket closed before write completed'));
    const onDrain = () => {
      drainCompleted = true;
      maybeResolve();
    };

    socket.once('error', onError);
    socket.once('close', onClose);
    let drained: boolean;
    try {
      drained = socket.write(serializedFrame, error => {
        if (error) {
          settle(error);
          return;
        }
        writeCompleted = true;
        maybeResolve();
      });
    } catch (error) {
      settle(error as Error);
      return;
    }
    if (!drained) {
      drainCompleted = false;
      socket.once('drain', onDrain);
    }
  });
}

function writeFrame(socket: net.Socket, frame: ClientFrame | ServerFrame): Promise<void> {
  return writeSerializedFrame(socket, serializeFrame(frame));
}

function nextTick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

function membershipKey(topic: string, group?: string): string {
  return JSON.stringify([topic, group ?? null]);
}

function readFrames(socket: net.Socket, onFrame: (frame: any) => void) {
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', chunk => {
    buffer += chunk;
    while (true) {
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) break;
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.trim()) continue;
      try {
        onFrame(decode(JSON.parse(line)));
      } catch {
        // Ignore malformed frames. The transport is local IPC and callers can retry.
      }
    }
  });
}

export class UnixSocketPubSub extends PubSub {
  readonly socketPath: string;
  #server?: net.Server;
  #clientSocket?: net.Socket;
  #isBroker = false;
  #closed = false;
  #starting?: Promise<void>;
  #subscriptions = new Map<string, Map<EventCallback, LocalSubscription>>();
  #localGroupCursors = new Map<string, number>();
  #brokerGroupCursors = new Map<string, number>();
  #subscribeWaiters = new Map<string, SubscribeWaiter[]>();
  #brokerClients = new Map<net.Socket, BrokerClient>();
  #pendingWrites = new Set<Promise<void>>();
  #recovering?: Promise<void>;
  #maxRemoteClientQueuedBytes: number;

  constructor(socketPath: string, options: UnixSocketPubSubOptions = {}) {
    super();
    this.socketPath = socketPath;
    this.#maxRemoteClientQueuedBytes = options.maxRemoteClientQueuedBytes ?? DEFAULT_MAX_REMOTE_CLIENT_QUEUED_BYTES;
  }

  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['push'];
  }

  get isBroker(): boolean {
    return this.#isBroker;
  }

  /** Number of remote clients currently connected to this broker. Always 0 for non-broker instances. */
  get remoteClientCount(): number {
    return this.#isBroker ? this.#brokerClients.size : 0;
  }

  async publish(
    topic: string,
    event: Omit<Event, 'id' | 'createdAt'>,
    options?: { localOnly?: boolean },
  ): Promise<void> {
    await this.#ensureStarted();

    // `localOnly` events stay entirely within the publishing process. They are
    // never serialized over a unix socket, so live methods on payload values
    // (e.g. `MastraModelOutput.getFullOutput`, `step.condition` functions on
    // serialized step graphs) survive intact. This is the semantic the agent's
    // execution-workflow relies on: the run result is delivered via
    // `workflows-finish` and includes the `MastraModelOutput` instance —
    // round-tripping it through the broker would strip its methods.
    if (options?.localOnly) {
      const localEvent: Event = {
        ...event,
        id: randomUUID(),
        createdAt: new Date(),
        deliveryAttempt: 1,
      };
      this.#deliverLocal(topic, localEvent);
      return;
    }

    if (this.#isBroker) {
      await this.#publishFromBroker(topic, event, undefined, options?.localOnly);
      return;
    }

    const socket = this.#clientSocket;
    if (!socket || socket.destroyed) {
      await this.#ensureStarted(true);
    }
    await this.#sendToBroker({ type: 'publish', topic, event, localOnly: options?.localOnly });
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    const subscriptions = this.#subscriptions.get(topic) ?? new Map<EventCallback, LocalSubscription>();
    const existing = subscriptions.get(cb);
    if (existing && existing.group === options?.group) return;
    if (existing) {
      await this.unsubscribe(topic, cb);
    }

    const group = options?.group;
    const hadMembership = this.#hasLocalMembership(topic, group);
    const wasConnected = Boolean(this.#clientSocket && !this.#clientSocket.destroyed);
    subscriptions.set(cb, { callback: cb, group });
    this.#subscriptions.set(topic, subscriptions);

    try {
      await this.#ensureStarted();
      if (!this.#isBroker && !hadMembership && wasConnected) {
        await this.#sendSubscribeToBroker(topic, group);
      }
    } catch (error) {
      subscriptions.delete(cb);
      if (subscriptions.size === 0) {
        this.#subscriptions.delete(topic);
      }
      throw error;
    }
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const subscriptions = this.#subscriptions.get(topic);
    const subscription = subscriptions?.get(cb);
    if (!subscription) return;

    subscriptions!.delete(cb);
    if (subscriptions!.size === 0) {
      this.#subscriptions.delete(topic);
    }
    if (
      !this.#hasLocalMembership(topic, subscription.group) &&
      !this.#isBroker &&
      this.#clientSocket &&
      !this.#clientSocket.destroyed
    ) {
      await this.#sendToBroker({ type: 'unsubscribe', topic, group: subscription.group });
      await nextTick();
    }
  }

  async flush(): Promise<void> {
    await Promise.allSettled([...this.#pendingWrites]);
  }

  #hasLocalMembership(topic: string, group?: string): boolean {
    return [...(this.#subscriptions.get(topic)?.values() ?? [])].some(subscription => subscription.group === group);
  }

  #localGroups(topic: string): string[] {
    return [
      ...new Set(
        [...(this.#subscriptions.get(topic)?.values() ?? [])]
          .map(subscription => subscription.group)
          .filter((group): group is string => Boolean(group)),
      ),
    ];
  }

  async close(): Promise<void> {
    this.#closed = true;
    this.#subscriptions.clear();
    this.#localGroupCursors.clear();
    this.#brokerGroupCursors.clear();

    this.#clientSocket?.destroy();
    this.#clientSocket = undefined;
    this.#rejectSubscribeWaiters(new Error('UnixSocketPubSub is closed'));

    const clientClosures = [...this.#brokerClients.values()].map(
      client =>
        new Promise<void>(resolve => {
          if (client.socket.destroyed) {
            this.#removeBrokerClient(client);
            resolve();
            return;
          }
          client.socket.once('close', resolve);
          this.#removeBrokerClient(client);
        }),
    );
    await Promise.allSettled(clientClosures);

    if (this.#server) {
      await new Promise<void>(resolve => this.#server?.close(() => resolve()));
      this.#server = undefined;
    }

    if (this.#isBroker) {
      await unlink(this.socketPath).catch(() => {});
    }
    this.#isBroker = false;
  }

  async #ensureStarted(forceReconnect = false): Promise<void> {
    if (this.#closed) {
      throw new Error('UnixSocketPubSub is closed');
    }
    if (!forceReconnect && (this.#isBroker || (this.#clientSocket && !this.#clientSocket.destroyed))) {
      return;
    }
    if (this.#starting) {
      return this.#starting;
    }

    this.#starting = this.#start(forceReconnect).finally(() => {
      this.#starting = undefined;
    });
    return this.#starting;
  }

  async #start(forceReconnect: boolean): Promise<void> {
    if (forceReconnect) {
      this.#clientSocket?.destroy();
      this.#clientSocket = undefined;
      this.#isBroker = false;
    }

    this.#throwIfClosed();
    await mkdir(dirname(this.socketPath), { recursive: true });
    this.#throwIfClosed();

    try {
      await this.#listen();
      this.#throwIfClosed();
      this.#isBroker = true;
      return;
    } catch (error) {
      if (this.#closed) {
        await this.close();
        throw new Error('UnixSocketPubSub is closed');
      }
      const code = (error as NodeJS.ErrnoException).code;
      // EADDRINUSE: another broker bound the socket. EEXIST: another process
      // created the socket file but hasn't bound yet (macOS race). Both mean
      // "fall through and try to connect as a client".
      if (code !== 'EADDRINUSE' && code !== 'EEXIST') throw error;
    }

    try {
      await this.#connectClient();
      this.#throwIfClosed();
    } catch (error) {
      if (this.#closed) {
        await this.close();
        throw new Error('UnixSocketPubSub is closed');
      }
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ECONNREFUSED' || code === 'ENOENT' || code === 'ENOTSOCK') {
        this.#throwIfClosed();
        await this.#electBroker();
        return;
      }
      throw error;
    }
  }

  #throwIfClosed() {
    if (this.#closed) {
      throw new Error('UnixSocketPubSub is closed');
    }
  }

  #listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = net.createServer(socket => this.#handleBrokerClient(socket));
      const onError = (error: Error) => {
        server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        this.#server = server;
        resolve();
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(this.socketPath);
    });
  }

  #connectClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);
      const onError = (error: Error) => {
        socket.off('connect', onConnect);
        reject(error);
      };
      const onConnect = () => {
        socket.off('error', onError);
        this.#clientSocket = socket;
        this.#isBroker = false;
        readFrames(socket, frame => this.#handleServerFrame(frame));
        // NOTE: keep this exact message in sync with the transient-error
        // classifier in #sendToBroker (search for 'broker connection closed').
        socket.on('close', () =>
          this.#handleClientDisconnect(socket, new Error('UnixSocketPubSub broker connection closed')),
        );
        socket.on('error', error => this.#handleClientDisconnect(socket, error));
        void this.#resubscribeClient().then(resolve, reject);
      };

      socket.once('error', onError);
      socket.once('connect', onConnect);
    });
  }

  async #resubscribeClient() {
    for (const [topic, subscriptions] of this.#subscriptions) {
      const groups = new Set([...subscriptions.values()].map(subscription => subscription.group));
      for (const group of groups) {
        await this.#sendSubscribeToBroker(topic, group);
      }
    }
  }

  #handleClientDisconnect(socket: net.Socket, error: Error) {
    if (this.#clientSocket !== socket) return;
    this.#clientSocket = undefined;
    this.#rejectSubscribeWaiters(error);
    if (!this.#closed) {
      void this.#recoverClientConnection();
    }
  }

  async #recoverClientConnection(): Promise<void> {
    if (this.#recovering) return this.#recovering;
    this.#recovering = this.#recoverClientConnectionLoop().finally(() => {
      this.#recovering = undefined;
    });
    return this.#recovering;
  }

  async #recoverClientConnectionLoop(): Promise<void> {
    while (!this.#closed && !this.#isBroker && !(this.#clientSocket && !this.#clientSocket.destroyed)) {
      try {
        await this.#ensureStarted(true);
        return;
      } catch {
        if (this.#closed) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Serializes broker election across processes using an exclusive lock file.
   * Only the lock winner unlinks the stale socket and listens; losers wait
   * then connect as clients to the newly elected broker.
   */
  async #electBroker(): Promise<void> {
    const lockPath = this.socketPath + '.elect';
    let lockFd: FileHandle | undefined;
    try {
      lockFd = await open(lockPath, 'wx');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
        if (await this.#isElectionLockStale(lockPath)) {
          await unlink(lockPath).catch(() => {});
          throw new Error('Stale broker election lock removed');
        }
        await new Promise(resolve => setTimeout(resolve, 150));
        try {
          await this.#connectClient();
          this.#throwIfClosed();
          return;
        } catch {
          throw new Error('Broker election in progress by another process');
        }
      }
      throw e;
    }

    try {
      // Re-check: a previous election round may have installed a broker
      // between our initial connectClient() and acquiring this lock.
      try {
        await this.#connectClient();
        this.#throwIfClosed();
        return;
      } catch {
        // Still no live broker — proceed with election.
      }
      await unlink(this.socketPath).catch(() => {});
      this.#throwIfClosed();
      await this.#listen();
      this.#throwIfClosed();
      this.#isBroker = true;
    } finally {
      await lockFd.close().catch(() => {});
      await unlink(lockPath).catch(() => {});
    }
  }

  async #isElectionLockStale(lockPath: string): Promise<boolean> {
    try {
      const lockStat = await stat(lockPath);
      return Date.now() - lockStat.mtimeMs > 2000;
    } catch {
      return true;
    }
  }

  async #sendSubscribeToBroker(topic: string, group?: string): Promise<void> {
    const key = membershipKey(topic, group);
    let waiter: SubscribeWaiter | undefined;
    const subscribed = new Promise<void>((resolve, reject) => {
      waiter = { resolve, reject };
      const waiters = this.#subscribeWaiters.get(key) ?? [];
      waiters.push(waiter);
      this.#subscribeWaiters.set(key, waiters);
    });
    try {
      await this.#sendToBroker({ type: 'subscribe', topic, group });
    } catch (error) {
      this.#removeSubscribeWaiter(key, waiter);
      throw error;
    }
    await subscribed;
  }

  #removeSubscribeWaiter(key: string, waiter: SubscribeWaiter | undefined) {
    if (!waiter) return;
    const waiters = this.#subscribeWaiters.get(key);
    if (!waiters) return;
    const nextWaiters = waiters.filter(item => item !== waiter);
    if (nextWaiters.length === 0) {
      this.#subscribeWaiters.delete(key);
      return;
    }
    this.#subscribeWaiters.set(key, nextWaiters);
  }

  #settleSubscribeWaiters(key: string, error?: Error) {
    const waiters = this.#subscribeWaiters.get(key);
    this.#subscribeWaiters.delete(key);
    if (error) {
      waiters?.forEach(waiter => waiter.reject(error));
      return;
    }
    waiters?.forEach(waiter => waiter.resolve());
  }

  #rejectSubscribeWaiters(error: Error) {
    for (const topic of this.#subscribeWaiters.keys()) {
      this.#settleSubscribeWaiters(topic, error);
    }
  }

  #handleBrokerClient(socket: net.Socket) {
    const client: BrokerClient = {
      socket,
      subscriptions: new Set(),
      writeChain: Promise.resolve(),
      queuedBytes: 0,
    };
    this.#brokerClients.set(socket, client);
    readFrames(socket, frame => {
      const clientFrame = frame as ClientFrame;
      if (clientFrame.type === 'subscribe') {
        client.subscriptions.add(membershipKey(clientFrame.topic, clientFrame.group));
        this.#enqueueBrokerClientWrite(client, {
          type: 'subscribed',
          topic: clientFrame.topic,
          group: clientFrame.group,
        });
      } else if (clientFrame.type === 'unsubscribe') {
        client.subscriptions.delete(membershipKey(clientFrame.topic, clientFrame.group));
      } else if (clientFrame.type === 'publish') {
        void this.#publishFromBroker(clientFrame.topic, clientFrame.event, client, clientFrame.localOnly);
      }
    });
    socket.on('close', () => this.#removeBrokerClient(client));
    socket.on('error', () => this.#removeBrokerClient(client));
  }

  #enqueueBrokerClientWrite(client: BrokerClient, frame: ServerFrame) {
    if (this.#brokerClients.get(client.socket) !== client || client.socket.destroyed) return;

    const serializedFrame = serializeFrame(frame);
    const queuedBytes = Buffer.byteLength(serializedFrame);
    if (client.queuedBytes + queuedBytes > this.#maxRemoteClientQueuedBytes) {
      this.#removeBrokerClient(client);
      return;
    }

    client.queuedBytes += queuedBytes;

    const write = client.writeChain
      .catch(() => {})
      .then(async () => {
        if (this.#brokerClients.get(client.socket) !== client || client.socket.destroyed) return;
        await writeSerializedFrame(client.socket, serializedFrame);
      })
      .catch(() => {
        this.#removeBrokerClient(client);
      })
      .finally(() => {
        client.queuedBytes = Math.max(0, client.queuedBytes - queuedBytes);
      });

    client.writeChain = write;
    this.#pendingWrites.add(write);
    void write.finally(() => this.#pendingWrites.delete(write));
  }

  #removeBrokerClient(client: BrokerClient) {
    if (this.#brokerClients.get(client.socket) !== client) return;
    this.#brokerClients.delete(client.socket);
    client.subscriptions.clear();
    client.queuedBytes = 0;
    client.writeChain = Promise.resolve();
    if (!client.socket.destroyed) {
      client.socket.destroy();
    }
  }

  #handleServerFrame(frame: ServerFrame) {
    if (frame.type === 'subscribed') {
      this.#settleSubscribeWaiters(membershipKey(frame.topic, frame.group));
      return;
    }
    if (frame.type !== 'event') return;
    // `createdAt` is already a Date — the codec rehydrates it during JSON.parse
    // in `readFrames`. No ad-hoc conversion needed.
    if (frame.group) {
      this.#deliverLocalGroup(frame.topic, frame.group, frame.event);
    } else {
      this.#deliverLocalFanout(frame.topic, frame.event);
    }
  }

  async #publishFromBroker(
    topic: string,
    event: Omit<Event, 'id' | 'createdAt'>,
    sourceClient?: BrokerClient,
    localOnly?: boolean,
  ) {
    const brokerEvent: Event = {
      ...event,
      id: randomUUID(),
      createdAt: new Date(),
      deliveryAttempt: 1,
    };

    this.#deliverLocalFanout(topic, brokerEvent);

    // `localOnly` events are scoped to the publishing instance. Client-side
    // localOnly publishes bypass the broker entirely, so this branch only
    // protects compatibility with older clients that may still send the flag.
    if (localOnly) {
      if (sourceClient && sourceClient.subscriptions.has(membershipKey(topic)) && !sourceClient.socket.destroyed) {
        this.#enqueueBrokerClientWrite(sourceClient, { type: 'event', topic, event: brokerEvent });
      }
      return;
    }

    const fanoutFrame: ServerFrame = { type: 'event', topic, event: brokerEvent };
    for (const client of this.#brokerClients.values()) {
      if (!client.subscriptions.has(membershipKey(topic)) || client.socket.destroyed) continue;
      this.#enqueueBrokerClientWrite(client, fanoutFrame);
    }

    const groups = new Set(this.#localGroups(topic));
    for (const client of this.#brokerClients.values()) {
      for (const subscription of client.subscriptions) {
        const [subscriptionTopic, group] = JSON.parse(subscription) as [string, string | null];
        if (subscriptionTopic === topic && group) groups.add(group);
      }
    }

    for (const group of groups) {
      const members: Array<'local' | BrokerClient> = [];
      if (this.#hasLocalMembership(topic, group)) members.push('local');
      for (const client of this.#brokerClients.values()) {
        if (client.subscriptions.has(membershipKey(topic, group)) && !client.socket.destroyed) members.push(client);
      }
      if (members.length === 0) continue;
      const key = membershipKey(topic, group);
      const cursor = this.#brokerGroupCursors.get(key) ?? 0;
      const member = members[cursor % members.length]!;
      this.#brokerGroupCursors.set(key, (cursor + 1) % members.length);
      if (member === 'local') {
        this.#deliverLocalGroup(topic, group, brokerEvent);
      } else {
        this.#enqueueBrokerClientWrite(member, { type: 'event', topic, event: brokerEvent, group });
      }
    }
  }

  #deliverLocal(topic: string, event: Event) {
    this.#deliverLocalFanout(topic, event);
    for (const group of this.#localGroups(topic)) {
      this.#deliverLocalGroup(topic, group, event);
    }
  }

  #deliverLocalFanout(topic: string, event: Event) {
    for (const subscription of this.#subscriptions.get(topic)?.values() ?? []) {
      if (subscription.group) continue;
      this.#invokeLocalCallback(topic, event, subscription.callback, subscription.group, 0);
    }
  }

  #deliverLocalGroup(topic: string, group: string, event: Event) {
    const members = [...(this.#subscriptions.get(topic)?.values() ?? [])].filter(
      subscription => subscription.group === group,
    );
    if (members.length === 0) return;
    const key = membershipKey(topic, group);
    const cursor = this.#localGroupCursors.get(key) ?? 0;
    const member = members[cursor % members.length]!;
    this.#localGroupCursors.set(key, (cursor + 1) % members.length);
    this.#invokeLocalCallback(topic, event, member.callback, group, 0);
  }

  #invokeLocalCallback(topic: string, event: Event, cb: EventCallback, group: string | undefined, attempt: number) {
    let nacked = false;
    const nack = async () => {
      if (nacked || this.#closed) return;
      nacked = true;
      if (attempt >= MAX_LOCAL_REDELIVERIES) return;
      const currentSubscription = this.#subscriptions.get(topic)?.get(cb);
      if (!currentSubscription || currentSubscription.group !== group) return;
      const timer = setTimeout(
        () => {
          if (this.#closed) return;
          const currentSubscription = this.#subscriptions.get(topic)?.get(cb);
          if (!currentSubscription || currentSubscription.group !== group) return;
          const redeliveredEvent: Event = {
            ...event,
            deliveryAttempt: (event.deliveryAttempt ?? 1) + 1,
          };
          this.#invokeLocalCallback(topic, redeliveredEvent, cb, group, attempt + 1);
        },
        REDELIVERY_DELAY_MS * (attempt + 1),
      );
      // Unrefed so a queued redelivery never holds the event loop open at
      // shutdown. The trade-off: an in-flight redelivery during process exit
      // is silently dropped. That's acceptable because the consumer (WEP)
      // is itself shutting down and the workflow will be re-driven from
      // durable state on the next start.
      timer.unref?.();
    };
    try {
      const result = (cb as (event: Event, ack: () => Promise<void>, nack: () => Promise<void>) => unknown)(
        event,
        async () => {},
        nack,
      );
      if (result && typeof (result as Promise<void>).catch === 'function') {
        void (result as Promise<void>).catch(() => {});
      }
    } catch {
      // Ignore subscriber failures so one callback cannot poison topic delivery.
    }
  }

  async #sendToBroker(frame: ClientFrame) {
    // If the broker died mid-write (EPIPE) or while election is rotating, we
    // reconnect and retry. The first attempt is the normal path. Each retry
    // forces a fresh broker resolution. Retry budget is bounded so a truly
    // unreachable broker still errors instead of looping forever.
    const maxRetries = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt === 0) {
          await this.#sendToActiveBroker(frame);
        } else {
          if (this.#closed) throw lastError;
          const failedSocket = this.#clientSocket;
          this.#clientSocket = undefined;
          failedSocket?.destroy();
          await this.#ensureStarted(true);
          await this.#sendToActiveBroker(frame);
        }
        return;
      } catch (error) {
        lastError = error;
        if (this.#closed) throw error;
        const code = (error as NodeJS.ErrnoException)?.code;
        // EPIPE/ECONNRESET/ENOTCONN: broker died mid-write — retry against a
        // fresh broker. Anything else (e.g. closed pubsub, validation error)
        // is not safe to retry blindly. The string-message checks cover three
        // internal errors thrown from within this file that don't carry an
        // ErrnoException-style `code` — keep them in lockstep with those
        // throw sites:
        //   - "socket closed before write completed" (writeSerializedFrame,
        //     when the broker dies mid-write before the drain settles)
        //   - "broker connection closed" (#handleClientDisconnect)
        //   - "not connected to a broker" (#sendToActiveBroker)
        const transient =
          code === 'EPIPE' ||
          code === 'ECONNRESET' ||
          code === 'ENOTCONN' ||
          (error as Error)?.message?.includes('socket closed before write completed') ||
          (error as Error)?.message?.includes('broker connection closed') ||
          (error as Error)?.message?.includes('not connected to a broker');
        if (!transient || attempt === maxRetries) throw error;
        // Tiny backoff so concurrent senders don't dogpile re-election.
        await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
      }
    }
  }

  async #sendToActiveBroker(frame: ClientFrame) {
    const socket = this.#clientSocket;
    if (!socket || socket.destroyed) {
      await this.#ensureStarted(true);
    }
    if (this.#isBroker) {
      await this.#handlePromotedBrokerFrame(frame);
      return;
    }
    const activeSocket = this.#clientSocket;
    if (!activeSocket || activeSocket.destroyed) {
      // NOTE: keep this exact message in sync with the transient-error
      // classifier in #sendToBroker (search for 'not connected to a broker').
      throw new Error('UnixSocketPubSub is not connected to a broker');
    }
    await writeFrame(activeSocket, frame);
  }

  async #handlePromotedBrokerFrame(frame: ClientFrame) {
    if (frame.type === 'subscribe') {
      this.#settleSubscribeWaiters(frame.topic);
    } else if (frame.type === 'publish') {
      await this.#publishFromBroker(frame.topic, frame.event);
    }
  }
}
