import { randomUUID } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
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
    let settled = false;
    const cleanup = () => {
      socket.off('error', onError);
    };
    const settle = (error?: Error | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };
    const onError = (error: Error) => {
      settle(error);
    };

    if (socket.destroyed || !socket.writable) {
      reject(new Error('UnixSocketPubSub socket is not writable'));
      return;
    }

    socket.once('error', onError);
    try {
      socket.write(`${JSON.stringify(frame)}\n`, error => {
        if (error) {
          settle(error);
          return;
        }
        settle();
      });
    } catch (error) {
      settle(error as Error);
    }
  });
}

function isBrokerWriteFailure(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EPIPE' || code === 'ECONNRESET' || code === 'ERR_STREAM_DESTROYED';
}

async function closeSocket(socket: net.Socket): Promise<void> {
  if (socket.destroyed) return;
  await new Promise<void>(resolve => {
    socket.once('close', () => resolve());
    socket.destroy();
  });
}

function getWritableSocket(socket: net.Socket | undefined): net.Socket | undefined {
  if (!socket || socket.destroyed || !socket.writable) {
    return undefined;
  }
  return socket;
}

async function writeFrameToBroker(socket: net.Socket, frame: ClientFrame): Promise<void> {
  try {
    await writeFrame(socket, frame);
  } catch (error) {
    if (isBrokerWriteFailure(error)) {
      await closeSocket(socket);
    }
    throw error;
  }
}

async function writeFrameToClient(socket: net.Socket, frame: ServerFrame): Promise<void> {
  try {
    await writeFrame(socket, frame);
  } catch (error) {
    if (isBrokerWriteFailure(error)) {
      await closeSocket(socket);
    }
    throw error;
  }
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
        await unlink(this.socketPath).catch(() => {});
        this.#throwIfClosed();
        await this.#listen();
        this.#throwIfClosed();
        this.#isBroker = true;
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
        socket.on('close', () => {
          if (this.#clientSocket === socket) this.#clientSocket = undefined;
          this.#rejectSubscribeWaiters(new Error('UnixSocketPubSub broker connection closed'));
        });
        socket.on('error', error => {
          if (this.#clientSocket === socket) this.#clientSocket = undefined;
          this.#rejectSubscribeWaiters(error);
        });
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

    const frame: ServerFrame = { type: 'event', topic, event: brokerEvent };
    for (const client of this.#brokerClients.values()) {
      if (!client.subscriptions.has(topic) || client.socket.destroyed) continue;
      const write = writeFrameToClient(client.socket, frame).catch(() => {});
      this.#pendingWrites.push(write);
    }
    await this.flush();
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
    const socket = getWritableSocket(this.#clientSocket);
    if (!socket) {
      await this.#ensureStarted(true);
    }
    const activeSocket = getWritableSocket(this.#clientSocket);
    if (!activeSocket) {
      throw new Error('UnixSocketPubSub is not connected to a broker');
    }
    try {
      await writeFrameToBroker(activeSocket, frame);
    } catch (error) {
      if (!isBrokerWriteFailure(error) || this.#closed) {
        throw error;
      }
      if (this.#clientSocket === activeSocket) {
        this.#clientSocket = undefined;
      }
      await this.#ensureStarted(true);
      const reconnectedSocket = getWritableSocket(this.#clientSocket);
      if (!reconnectedSocket) {
        throw new Error('UnixSocketPubSub is not connected to a broker');
      }
      await writeFrameToBroker(reconnectedSocket, frame);
    }
  }
}
