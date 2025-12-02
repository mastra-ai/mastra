import { AbstractClient, noop } from "./AbstractClient";
import { CONNECTION_STATE, SOCKET_STATES } from "../lib/constants";
import type { DeepgramClientOptions, LiveSchema } from "../lib/types";
import type { WebSocket as WSWebSocket } from "ws";
import { isBun } from "../lib/runtime";

/**
 * Represents a constructor for a WebSocket-like object that can be used in the application.
 * The constructor takes the following parameters:
 * @param address - The URL or address of the WebSocket server.
 * @param _ignored - An optional parameter that is ignored.
 * @param options - An optional object containing headers to be included in the WebSocket connection.
 * @returns A WebSocket-like object that implements the WebSocketLike interface.
 */
interface WebSocketLikeConstructor {
  new (
    address: string | URL,
    _ignored?: any,
    options?: { headers: object | undefined }
  ): WebSocketLike;
}

/**
 * Represents the types of WebSocket-like connections that can be used in the application.
 * This type is used to provide a common interface for different WebSocket implementations,
 * such as the native WebSocket API, a WebSocket wrapper library, or a dummy implementation
 * for testing purposes.
 */
type WebSocketLike = WebSocket | WSWebSocket | WSWebSocketDummy;

/**
 * Represents the types of data that can be sent or received over a WebSocket-like connection.
 */
type SocketDataLike = string | ArrayBufferLike | Blob;

/**
 * Represents an error that occurred in a WebSocket-like connection.
 * @property {any} error - The underlying error object.
 * @property {string} message - A human-readable error message.
 * @property {string} type - The type of the error.
 */
// interface WebSocketLikeError {
//   error: any;
//   message: string;
//   type: string;
// }

/**
 * Indicates whether a native WebSocket implementation is available in the current environment.
 */
const NATIVE_WEBSOCKET_AVAILABLE = typeof WebSocket !== "undefined";

/**
 * Represents an abstract live client that extends the AbstractClient class.
 * The AbstractLiveClient class provides functionality for connecting, reconnecting, and disconnecting a WebSocket connection, as well as sending data over the connection.
 * Subclasses of this class are responsible for setting up the connection event handlers.
 *
 * @abstract
 */
export abstract class AbstractLiveClient extends AbstractClient {
  public headers: { [key: string]: string };
  public transport: WebSocketLikeConstructor | null;
  public conn: WebSocketLike | null = null;
  public sendBuffer: Function[] = [];

  constructor(options: DeepgramClientOptions) {
    super(options);

    const {
      key,
      websocket: { options: websocketOptions, client },
    } = this.namespaceOptions;

    if (this.proxy) {
      this.baseUrl = websocketOptions.proxy!.url;
    } else {
      this.baseUrl = websocketOptions.url;
    }

    if (client) {
      this.transport = client;
    } else {
      this.transport = null;
    }

    if (websocketOptions._nodeOnlyHeaders) {
      this.headers = websocketOptions._nodeOnlyHeaders;
    } else {
      this.headers = {};
    }

    if (!("Authorization" in this.headers)) {
      this.headers["Authorization"] = `Token ${key}`; // Add default token
    }
  }

  /**
   * Connects the socket, unless already connected.
   *
   * @protected Can only be called from within the class.
   */
  protected connect(transcriptionOptions: LiveSchema, endpoint: string): void {
    if (this.conn) {
      return;
    }

    this.reconnect = (options = transcriptionOptions) => {
      this.connect(options, endpoint);
    };

    const requestUrl = this.getRequestUrl(endpoint, {}, transcriptionOptions);

    /**
     * Custom websocket transport
     */
    if (this.transport) {
      this.conn = new this.transport(requestUrl, undefined, {
        headers: this.headers,
      });
      return;
    }

    /**
     * @summary Bun websocket transport has a bug where it's native WebSocket implementation messes up the headers
     * @summary This is a workaround to use the WS package for the websocket connection instead of the native Bun WebSocket
     * @summary you can track the issue here
     * @link https://github.com/oven-sh/bun/issues/4529
     */
    if (isBun()) {
      import("ws").then(({ default: WS }) => {
        this.conn = new WS(requestUrl, {
          headers: this.headers,
        });
        console.log(`Using WS package`);
        this.setupConnection();
      });
      return;
    }

    /**
     * Native websocket transport (browser)
     */
    if (NATIVE_WEBSOCKET_AVAILABLE) {
      this.conn = new WebSocket(requestUrl, ["token", this.namespaceOptions.key]);
      this.setupConnection();
      return;
    }

    /**
     * Dummy websocket
     */
    this.conn = new WSWebSocketDummy(requestUrl, undefined, {
      close: () => {
        this.conn = null;
      },
    });

    /**
     * WS package for node environment
     */
    import("ws").then(({ default: WS }) => {
      this.conn = new WS(requestUrl, undefined, {
        headers: this.headers,
      });
      this.setupConnection();
    });
  }

  /**
   * Reconnects the socket using new or existing transcription options.
   *
   * @param options - The transcription options to use when reconnecting the socket.
   */
  public reconnect: (options: LiveSchema) => void = noop;

  /**
   * Disconnects the socket from the client.
   *
   * @param code A numeric status code to send on disconnect.
   * @param reason A custom reason for the disconnect.
   */
  public disconnect(code?: number, reason?: string): void {
    if (this.conn) {
      this.conn.onclose = function () {}; // noop
      if (code) {
        this.conn.close(code, reason ?? "");
      } else {
        this.conn.close();
      }
      this.conn = null;
    }
  }

  /**
   * Returns the current connection state of the WebSocket connection.
   *
   * @returns The current connection state of the WebSocket connection.
   */
  public connectionState(): CONNECTION_STATE {
    switch (this.conn && this.conn.readyState) {
      case SOCKET_STATES.connecting:
        return CONNECTION_STATE.Connecting;
      case SOCKET_STATES.open:
        return CONNECTION_STATE.Open;
      case SOCKET_STATES.closing:
        return CONNECTION_STATE.Closing;
      default:
        return CONNECTION_STATE.Closed;
    }
  }

  /**
   * Returns the current ready state of the WebSocket connection.
   *
   * @returns The current ready state of the WebSocket connection.
   */
  public getReadyState(): SOCKET_STATES {
    return this.conn?.readyState ?? SOCKET_STATES.closed;
  }

  /**
   * Returns `true` is the connection is open.
   */
  public isConnected(): boolean {
    return this.connectionState() === CONNECTION_STATE.Open;
  }

  /**
   * Sends data to the Deepgram API via websocket connection
   * @param data Audio data to send to Deepgram
   *
   * Conforms to RFC #146 for Node.js - does not send an empty byte.
   * @see https://github.com/deepgram/deepgram-python-sdk/issues/146
   */
  send(data: SocketDataLike): void {
    const callback = async () => {
      if (data instanceof Blob) {
        if (data.size === 0) {
          this.log("warn", "skipping `send` for zero-byte blob", data);

          return;
        }

        data = await data.arrayBuffer();
      }

      if (typeof data !== "string") {
        if (!data?.byteLength) {
          this.log("warn", "skipping `send` for zero-byte payload", data);

          return;
        }
      }

      this.conn?.send(data);
    };

    if (this.isConnected()) {
      callback();
    } else {
      this.sendBuffer.push(callback);
    }
  }

  /**
   * Determines whether the current instance should proxy requests.
   * @returns {boolean} true if the current instance should proxy requests; otherwise, false
   */
  get proxy(): boolean {
    return this.key === "proxy" && !!this.namespaceOptions.websocket.options.proxy?.url;
  }

  /**
   * Sets up the connection event handlers.
   *
   * @abstract Requires subclasses to set up context aware event handlers.
   */
  abstract setupConnection(): void;
}

class WSWebSocketDummy {
  binaryType: string = "arraybuffer";
  close: Function;
  onclose: Function = () => {};
  onerror: Function = () => {};
  onmessage: Function = () => {};
  onopen: Function = () => {};
  readyState: number = SOCKET_STATES.connecting;
  send: Function = () => {};
  url: string | URL | null = null;

  constructor(address: URL, _protocols: undefined, options: { close: Function }) {
    this.url = address.toString();
    this.close = options.close;
  }
}

export { AbstractLiveClient as AbstractWsClient };
