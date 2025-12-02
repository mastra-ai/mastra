// src/node/relay-server.ts
import { WebSocketServer } from "ws";

// src/utils.ts
import { customAlphabet } from "nanoid";
var isBrowser = !!globalThis.document;
function getEnv(name) {
  try {
    return typeof process !== "undefined" ? (
      // eslint-disable-next-line no-process-env
      process.env?.[name]
    ) : void 0;
  } catch {
    return void 0;
  }
}
function assert(value, message) {
  if (value) {
    return;
  }
  if (!message) {
    throw new Error("Assertion failed");
  }
  throw typeof message === "string" ? new Error(message) : message;
}
var alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var generateIdImpl = customAlphabet(alphabet, 21);

// src/node/relay-server.ts
var RealtimeRelay = class {
  client;
  wss;
  constructor({ client }) {
    assert(
      client.relay,
      'RealtimeRelay client must have the "relay" option set'
    );
    assert(
      client.realtime.apiKey,
      "RealtimeRelay client must have an API key set"
    );
    this.client = client;
  }
  /**
   * Creates a `WebSocketServer` and begins listening for connections.
   *
   * @param port Port to listen on; defaults to the PORT environment variable or 8081.
   */
  listen(port) {
    assert(!this.wss, "RealtimeRelay is already listening");
    if (!port) {
      port = Number.parseInt(getEnv("PORT") ?? "8081");
      assert(!Number.isNaN(port), `Invalid port: ${port}`);
    }
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", this._connectionHandler.bind(this));
    this._info(`Listening on ws://localhost:${port}`);
  }
  /**
   * Closes the WebSocket server.
   */
  close() {
    this.wss?.close();
    this.wss = void 0;
  }
  async _connectionHandler(ws, req) {
    if (!req.url) {
      this._error("No URL provided, closing connection.");
      ws.close();
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    if (pathname !== "/") {
      this._error(`Invalid pathname: "${pathname}"`);
      ws.close();
      return;
    }
    this.client.realtime.on("server.*", (event) => {
      this._debug(`Relaying "${event.type}" to client`);
      ws.send(JSON.stringify(event));
    });
    this.client.realtime.on("close", () => ws.close());
    const messageQueue = [];
    const messageHandler = (data) => {
      try {
        const event = JSON.parse(data);
        this._debug(`Relaying "${event.type}" to server`);
        this.client.realtime.send(event.type, event);
      } catch (err) {
        this._error(`Error parsing event from client: ${data}`, err.message);
      }
    };
    ws.on("message", (data) => {
      if (!this.client.isConnected) {
        messageQueue.push(data.toString());
      } else {
        messageHandler(data.toString());
      }
    });
    ws.on("close", () => this.client.disconnect());
    try {
      this._info("Connecting to server...", this.client.realtime.url);
      await this.client.connect();
    } catch (err) {
      this._error("Error connecting to server", err.message);
      ws.close();
      return;
    }
    this._info("Connected to server successfully", this.client.realtime.url);
    while (messageQueue.length) {
      messageHandler(messageQueue.shift());
    }
  }
  _info(...args) {
    console.log("[RealtimeRelay]", ...args);
  }
  _debug(...args) {
    if (this.client.realtime.debug) {
      console.log("[RealtimeRelay]", ...args);
    }
  }
  _error(...args) {
    console.error("[RealtimeRelay]", ...args);
  }
};
export {
  RealtimeRelay
};
//# sourceMappingURL=index.js.map