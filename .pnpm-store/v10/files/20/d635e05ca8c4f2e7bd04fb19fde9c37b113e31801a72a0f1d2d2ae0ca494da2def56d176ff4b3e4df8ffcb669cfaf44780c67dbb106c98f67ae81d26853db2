import { Base64 } from "../../values/index.js";
import { Long } from "../../vendor/long.js";

// --experimental-vm-modules which we use for jest doesn't support named exports
import WebSocket, { WebSocketServer } from "ws";

// Let's pretend this ws WebSocket is a browser WebSocket (it's very close)
export const nodeWebSocket = WebSocket as unknown as typeof window.WebSocket;

import { ClientMessage, WireServerMessage } from "./protocol.js";
import { QueryToken } from "./udf_path_utils.js";
import { BaseConvexClient } from "./client.js";

export type InMemoryWebSocketTest = (args: {
  address: string;
  socket: () => WebSocket;
  receive: () => Promise<ClientMessage>;
  send: (message: WireServerMessage) => void;
  close: () => void;
}) => Promise<void>;

function listeningSocketServer(): Promise<WebSocketServer> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0 });
    wss.on("listening", () => resolve(wss));
  });
}

// Run a test with a real node WebSocket instance connected
export async function withInMemoryWebSocket(
  cb: InMemoryWebSocketTest,
  debug = false,
) {
  // These state variables are consistent over multiple sockets.
  let received: (msg: string) => void;
  // prettier-ignore
  const messages: Promise<string>[] = [ new Promise((r) => { received = r; }) ];
  let socket: WebSocket | null = null;

  const wss = await listeningSocketServer();

  const setUpSocket = () => {
    wss.once("connection", function connection(ws: WebSocket) {
      socket = ws;
      ws.on("message", function message(data: string) {
        received(data);
        // eslint-disable-next-line no-console
        if (debug) console.debug(`client --${JSON.parse(data).type}--> `);
        messages.push(
          new Promise((r) => {
            received = r;
          }),
        );
      });
    });
  };
  setUpSocket();

  // receive and send are stable across multiple socket connections
  async function receive(): Promise<ClientMessage> {
    const msgP = messages.shift();
    if (!msgP) {
      throw new Error("Receive() called twice? No message promise found.");
    }
    const text = await msgP;
    const structured = JSON.parse(text);
    return structured;
  }
  function send(message: WireServerMessage) {
    // eslint-disable-next-line no-console
    if (debug) console.debug(`      <--${message.type}-- server`);
    socket!.send(encodeServerMessage(message));
  }

  const s: any = wss.address();
  const address = typeof s === "string" ? s : `http://127.0.0.1:${s.port}`;

  try {
    await cb({
      address,
      socket: () => socket as unknown as WebSocket,
      receive,
      send,
      close: () => {
        // eslint-disable-next-line no-console
        if (debug) console.debug(`           --CLOSE-->8-- server`);
        socket!.close();
        setUpSocket();
      },
    });
  } finally {
    const s = socket!;
    if (s!) {
      socket!.close();
    }
    wss.close();
  }
}

export function encodeServerMessage(message: WireServerMessage): string {
  function replacer(_key: string, value: any) {
    if (Long.isLong(value)) {
      return encodeLong(value);
    }
    return value;
  }
  return JSON.stringify(message, replacer);
}

function encodeLong(n: Long) {
  const integerBytes = Uint8Array.from(n.toBytesLE());
  return Base64.fromByteArray(integerBytes);
}

/**
 * const q = new UpdateQueue();
 * const client = new Client("http://...", q.onTransition);
 *
 * await q.updatePromises[3];
 *
 */
export class UpdateQueue {
  updateResolves: ((v: Record<QueryToken, any>) => void)[];
  updatePromises: Promise<Record<QueryToken, any>>[];
  updates: Record<QueryToken, any>[];
  allResults: Record<QueryToken, any>;
  nextIndex: number;

  constructor(maxLength = 10) {
    this.updateResolves = [];
    this.updatePromises = [];
    this.allResults = {};
    this.updates = [];
    this.nextIndex = 0;

    let nextResolve: (v: Record<QueryToken, any>) => void;
    let nextPromise: Promise<Record<QueryToken, any>>;

    for (let i = 0; i < maxLength; i++) {
      nextPromise = new Promise((r) => {
        nextResolve = r;
      });
      this.updateResolves.push(nextResolve!);
      this.updatePromises.push(nextPromise);
    }
  }

  /**
   * Useful to use instead of directly awaiting so that the timeout has a line number
   * unlike the default Vite test timeout.
   */
  async awaitPromiseAtIndexWithTimeout(i: number) {
    if (!this.updatePromises[i]) {
      throw new Error("That promise doesn't exist yet");
    }
    const inBandSignal = "UpdateQueue await timed out";
    const result = await Promise.race([
      new Promise((r) => setTimeout(() => r(inBandSignal), 1000)),
      this.updatePromises[i],
    ]);
    if (result === inBandSignal) {
      throw new Error("Awaiting promise in UpdateQueue");
    }
    return result;
  }

  onTransition =
    (client: BaseConvexClient) => (updatedQueryTokens: QueryToken[]) => {
      const update: Record<QueryToken, any> = {};
      for (const queryToken of updatedQueryTokens) {
        const value = client.localQueryResultByToken(queryToken);
        update[queryToken] = value;
        this.allResults[queryToken] = value;
      }
      this.updateResolves[this.nextIndex](update);
      this.updates.push(update);
      this.nextIndex++;
    };
}
