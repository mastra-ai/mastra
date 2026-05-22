import { randomUUID } from 'node:crypto';
import { mkdir, open, stat, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import net from 'node:net';
import { dirname } from 'node:path';

import { PubSub } from './pubsub';
import type { PubSubDeliveryMode } from './pubsub';
import type { Event, EventCallback, SubscribeOptions } from './types';

type ClientFrame =
  | { type: 'subscribe'; topic: string }
  | { type: 'unsubscribe'; topic: string }
  | { type: 'publish'; topic: string; event: Omit<Event, 'id' | 'createdAt'> }
  | { type: 'ack'; id?: string }
  | { type: 'nack'; id?: string };

type ServerFrame = { type: 'event'; topic: string; event: Event } | { type: 'subscribed'; topic: string };

type BrokerClient = {
  socket: net.Socket;
  subscriptions: Set<string>;
};

type SubscribeWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
};

function writeFrame(socket: net.Socket, frame: ClientFrame | ServerFrame): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      socket.off('drain', onDrain);
      reject(error);
    };
    const onDrain = () => {
      socket.off('error', onError);
      resolve();
    };

    socket.once('error', onError);
    const drained = socket.write(`${JSON.stringify(frame)}\n`, () => {
      if (drained) {
        socket.off('error', onError);
        resolve();
      }
    });
    if (!drained) {
      socket.once('drain', onDrain);
    }
  });
}

function nextTick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
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
        onFrame(JSON.parse(line));
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
  #callbacks = new Map<string, Set<EventCallback>>();
  #subscribeWaiters = new Map<string, SubscribeWaiter[]>();
  #brokerClients = new Map<net.Socket, BrokerClient>();
  #pendingWrites: Promise<void>[] = [];
  #recovering?: Promise<void>;

  constructor(socketPath: string) {
    super();
    this.socketPath = socketPath;
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

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    await this.#ensureStarted();
    if (this.#isBroker) {
      await this.#publishFromBroker(topic, event);
      return;
    }

    const socket = this.#clientSocket;
    if (!socket || socket.destroyed) {
      await this.#ensureStarted(true);
    }
    await this.#sendToBroker({ type: 'publish', topic, event });
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (options?.group) {
      throw new Error('UnixSocketPubSub does not support grouped subscriptions yet');
    }

    const callbacks = this.#callbacks.get(topic) ?? new Set<EventCallback>();
    const hadCallback = callbacks.has(cb);
    const wasConnected = Boolean(this.#clientSocket && !this.#clientSocket.destroyed);
    callbacks.add(cb);
    this.#callbacks.set(topic, callbacks);

    try {
      await this.#ensureStarted();
      if (!this.#isBroker && !hadCallback && wasConnected) {
        await this.#sendSubscribeToBroker(topic);
      }
    } catch (error) {
      if (!hadCallback) {
        callbacks.delete(cb);
        if (callbacks.size === 0) {
          this.#callbacks.delete(topic);
        }
      }
      throw error;
    }
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const callbacks = this.#callbacks.get(topic);
    callbacks?.delete(cb);
    if (callbacks?.size === 0) {
      this.#callbacks.delete(topic);
      if (!this.#isBroker && this.#clientSocket && !this.#clientSocket.destroyed) {
        await this.#sendToBroker({ type: 'unsubscribe', topic });
        await nextTick();
      }
    }
  }

  async flush(): Promise<void> {
    await Promise.allSettled(this.#pendingWrites);
    this.#pendingWrites = [];
  }

  async close(): Promise<void> {
    this.#closed = true;
    this.#callbacks.clear();

    this.#clientSocket?.destroy();
    this.#clientSocket = undefined;
    this.#rejectSubscribeWaiters(new Error('UnixSocketPubSub is closed'));

    for (const client of this.#brokerClients.values()) {
      client.socket.destroy();
    }
    this.#brokerClients.clear();

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
      if (code !== 'EADDRINUSE') throw error;
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
    for (const topic of this.#callbacks.keys()) {
      await this.#sendSubscribeToBroker(topic);
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

  async #sendSubscribeToBroker(topic: string): Promise<void> {
    let waiter: SubscribeWaiter | undefined;
    const subscribed = new Promise<void>((resolve, reject) => {
      waiter = { resolve, reject };
      const waiters = this.#subscribeWaiters.get(topic) ?? [];
      waiters.push(waiter);
      this.#subscribeWaiters.set(topic, waiters);
    });
    try {
      await this.#sendToBroker({ type: 'subscribe', topic });
    } catch (error) {
      this.#removeSubscribeWaiter(topic, waiter);
      throw error;
    }
    await subscribed;
  }

  #removeSubscribeWaiter(topic: string, waiter: SubscribeWaiter | undefined) {
    if (!waiter) return;
    const waiters = this.#subscribeWaiters.get(topic);
    if (!waiters) return;
    const nextWaiters = waiters.filter(item => item !== waiter);
    if (nextWaiters.length === 0) {
      this.#subscribeWaiters.delete(topic);
      return;
    }
    this.#subscribeWaiters.set(topic, nextWaiters);
  }

  #settleSubscribeWaiters(topic: string, error?: Error) {
    const waiters = this.#subscribeWaiters.get(topic);
    this.#subscribeWaiters.delete(topic);
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
    const client: BrokerClient = { socket, subscriptions: new Set() };
    this.#brokerClients.set(socket, client);
    readFrames(socket, frame => {
      const clientFrame = frame as ClientFrame;
      if (clientFrame.type === 'subscribe') {
        client.subscriptions.add(clientFrame.topic);
        void writeFrame(socket, { type: 'subscribed', topic: clientFrame.topic }).catch(() => {});
      } else if (clientFrame.type === 'unsubscribe') {
        client.subscriptions.delete(clientFrame.topic);
      } else if (clientFrame.type === 'publish') {
        void this.#publishFromBroker(clientFrame.topic, clientFrame.event);
      }
    });
    socket.on('close', () => this.#brokerClients.delete(socket));
    socket.on('error', () => this.#brokerClients.delete(socket));
  }

  #handleServerFrame(frame: ServerFrame) {
    if (frame.type === 'subscribed') {
      this.#settleSubscribeWaiters(frame.topic);
      return;
    }
    if (frame.type !== 'event') return;
    const event = {
      ...frame.event,
      createdAt: new Date(frame.event.createdAt),
    };
    this.#deliverLocal(frame.topic, event);
  }

  async #publishFromBroker(topic: string, event: Omit<Event, 'id' | 'createdAt'>) {
    const brokerEvent: Event = {
      ...event,
      id: randomUUID(),
      createdAt: new Date(),
      deliveryAttempt: 1,
    };

    this.#deliverLocal(topic, brokerEvent);

    // Skip serialization entirely when no remote clients could receive the event.
    if (this.#brokerClients.size === 0) return;

    let frame: ServerFrame | undefined;
    for (const client of this.#brokerClients.values()) {
      if (!client.subscriptions.has(topic) || client.socket.destroyed) continue;
      // Lazily build the frame only when we know at least one client needs it.
      frame ??= { type: 'event', topic, event: brokerEvent };
      const write = writeFrame(client.socket, frame).catch(() => {});
      this.#pendingWrites.push(write);
    }
    if (frame) await this.flush();
  }

  #deliverLocal(topic: string, event: Event) {
    const callbacks = this.#callbacks.get(topic);
    if (!callbacks) return;
    for (const cb of callbacks) {
      try {
        const result = (cb as (event: Event, ack: () => Promise<void>, nack: () => Promise<void>) => unknown)(
          event,
          async () => {},
          async () => {},
        );
        if (result && typeof (result as Promise<void>).catch === 'function') {
          void (result as Promise<void>).catch(() => {});
        }
      } catch {
        // Ignore subscriber failures so one callback cannot poison topic delivery.
      }
    }
  }

  async #sendToBroker(frame: ClientFrame) {
    const socket = this.#clientSocket;
    if (!socket || socket.destroyed) {
      await this.#ensureStarted(true);
    }
    const activeSocket = this.#clientSocket;
    if (!activeSocket || activeSocket.destroyed) {
      throw new Error('UnixSocketPubSub is not connected to a broker');
    }
    await writeFrame(activeSocket, frame);
  }
}
