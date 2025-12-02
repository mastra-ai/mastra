import { Logger } from "../logging.js";
import {
  ClientMessage,
  encodeClientMessage,
  parseServerMessage,
  ServerMessage,
  Transition,
  TransitionChunk,
} from "./protocol.js";

const CLOSE_NORMAL = 1000;
const CLOSE_GOING_AWAY = 1001;
const CLOSE_NO_STATUS = 1005;
/** Convex-specific close code representing a "404 Not Found".
 * The edge Onramp accepts websocket upgrades before confirming that the
 * intended destination exists, so this code is sent once we've discovered that
 * the destination does not exist.
 */
const CLOSE_NOT_FOUND = 4040;

/**
 * The various states our WebSocket can be in:
 *
 * - "disconnected": We don't have a WebSocket, but plan to create one.
 * - "connecting": We have created the WebSocket and are waiting for the
 *   `onOpen` callback.
 * - "ready": We have an open WebSocket.
 * - "stopped": The WebSocket was closed and a new one can be created via `.restart()`.
 * - "terminated": We have closed the WebSocket and will never create a new one.
 *
 *
 * WebSocket State Machine
 * -----------------------
 * initialState: disconnected
 * validTransitions:
 *   disconnected:
 *     new WebSocket() -> connecting
 *     terminate() -> terminated
 *   connecting:
 *     onopen -> ready
 *     close() -> disconnected
 *     terminate() -> terminated
 *   ready:
 *     close() -> disconnected
 *     stop() -> stopped
 *     terminate() -> terminated
 *   stopped:
 *     restart() -> connecting
 *     terminate() -> terminated
 * terminalStates:
 *   terminated
 *
 *
 *
 *                                        ┌────────────────┐
 *                ┌────terminate()────────│  disconnected  │◀─┐
 *                │                       └────────────────┘  │
 *                ▼                            │       ▲      │
 *       ┌────────────────┐           new WebSocket()  │      │
 *    ┌─▶│   terminated   │◀──────┐            │       │      │
 *    │  └────────────────┘       │            │       │      │
 *    │           ▲          terminate()       │    close() close()
 *    │      terminate()          │            │       │      │
 *    │           │               │            ▼       │      │
 *    │  ┌────────────────┐       └───────┌────────────────┐  │
 *    │  │    stopped     │──restart()───▶│   connecting   │  │
 *    │  └────────────────┘               └────────────────┘  │
 *    │           ▲                                │          │
 *    │           │                               onopen      │
 *    │           │                                │          │
 *    │           │                                ▼          │
 * terminate()    │                       ┌────────────────┐  │
 *    │           └────────stop()─────────│     ready      │──┘
 *    │                                   └────────────────┘
 *    │                                            │
 *    │                                            │
 *    └────────────────────────────────────────────┘
 *
 * The `connecting` and `ready` state have a sub-state-machine for pausing.
 */

type Socket =
  | { state: "disconnected" }
  | { state: "connecting"; ws: WebSocket; paused: "yes" | "no" }
  | { state: "ready"; ws: WebSocket; paused: "yes" | "no" | "uninitialized" }
  | { state: "stopped" }
  | { state: "terminated" };

export type ReconnectMetadata = {
  connectionCount: number;
  lastCloseReason: string | null;
  clientTs: number;
};

export type OnMessageResponse = {
  hasSyncedPastLastReconnect: boolean;
};

let firstTime: number | undefined;
function monotonicMillis() {
  if (firstTime === undefined) {
    firstTime = Date.now();
  }
  if (typeof performance === "undefined" || !performance.now) {
    return Date.now();
  }
  return Math.round(firstTime + performance.now());
}

function prettyNow() {
  return `t=${Math.round((monotonicMillis() - firstTime!) / 100) / 10}s`;
}

const serverDisconnectErrors = {
  // A known error, e.g. during a restart or push
  InternalServerError: { timeout: 1000 },
  // ErrorMetadata::overloaded() messages that we realy should back off
  SubscriptionsWorkerFullError: { timeout: 3000 },
  TooManyConcurrentRequests: { timeout: 3000 },
  CommitterFullError: { timeout: 3000 },
  AwsTooManyRequestsException: { timeout: 3000 },
  ExecuteFullError: { timeout: 3000 },
  SystemTimeoutError: { timeout: 3000 },
  ExpiredInQueue: { timeout: 3000 },
  // ErrorMetadata::feature_temporarily_unavailable() that typically indicate a deploy just happened
  VectorIndexesUnavailable: { timeout: 1000 },
  SearchIndexesUnavailable: { timeout: 1000 },
  TableSummariesUnavailable: { timeout: 1000 },
  // More ErrorMetadata::overloaded()
  VectorIndexTooLarge: { timeout: 3000 },
  SearchIndexTooLarge: { timeout: 3000 },
  TooManyWritesInTimePeriod: { timeout: 3000 },
} as const satisfies Record<string, { timeout: number }>;

type ServerDisconnectError = keyof typeof serverDisconnectErrors | "Unknown";

function classifyDisconnectError(s?: string): ServerDisconnectError {
  if (s === undefined) return "Unknown";
  // startsWith so more info could be at the end (although currently there isn't)

  for (const prefix of Object.keys(
    serverDisconnectErrors,
  ) as ServerDisconnectError[]) {
    if (s.startsWith(prefix)) {
      return prefix;
    }
  }
  return "Unknown";
}

/**
 * A wrapper around a websocket that handles errors, reconnection, and message
 * parsing.
 */
export class WebSocketManager {
  private socket: Socket;

  private connectionCount: number;
  private _hasEverConnected: boolean = false;
  private lastCloseReason:
    | "InitialConnect"
    | "OnCloseInvoked"
    | (string & {}) // a full serverErrorReason (not just the prefix) or a new one
    | null;

  // State for assembling the split-up Transition currently being received.
  private transitionChunkBuffer: {
    chunks: string[];
    totalParts: number;
    transitionId: string;
  } | null = null;

  /** Upon HTTPS/WSS failure, the first jittered backoff duration, in ms. */
  private readonly defaultInitialBackoff: number;

  /** We backoff exponentially, but we need to cap that--this is the jittered max. */
  private readonly maxBackoff: number;

  /** How many times have we failed consecutively? */
  private retries: number;

  /** How long before lack of server response causes us to initiate a reconnect,
   * in ms */
  private readonly serverInactivityThreshold: number;

  private reconnectDueToServerInactivityTimeout: ReturnType<
    typeof setTimeout
  > | null;

  private readonly uri: string;
  private readonly onOpen: (reconnectMetadata: ReconnectMetadata) => void;
  private readonly onResume: () => void;
  private readonly onMessage: (message: ServerMessage) => OnMessageResponse;
  private readonly webSocketConstructor: typeof WebSocket;
  private readonly logger: Logger;
  private readonly onServerDisconnectError:
    | ((message: string) => void)
    | undefined;

  constructor(
    uri: string,
    callbacks: {
      onOpen: (reconnectMetadata: ReconnectMetadata) => void;
      onResume: () => void;
      onMessage: (message: ServerMessage) => OnMessageResponse;
      onServerDisconnectError?: ((message: string) => void) | undefined;
    },
    webSocketConstructor: typeof WebSocket,
    logger: Logger,
    private readonly markConnectionStateDirty: () => void,
    private readonly debug: boolean,
  ) {
    this.webSocketConstructor = webSocketConstructor;
    this.socket = { state: "disconnected" };
    this.connectionCount = 0;
    this.lastCloseReason = "InitialConnect";

    // backoff for unknown errors
    this.defaultInitialBackoff = 1000;
    this.maxBackoff = 16000;
    this.retries = 0;

    // Ping messages (sync protocol Pings, not WebSocket protocol Pings) are
    // sent every 15s in the absence of other messages. But a single large
    // Transition or other downstream message can hog the line so this
    // threshold is set higher to prevent clients from giving up.
    this.serverInactivityThreshold = 60000;
    this.reconnectDueToServerInactivityTimeout = null;

    this.uri = uri;
    this.onOpen = callbacks.onOpen;
    this.onResume = callbacks.onResume;
    this.onMessage = callbacks.onMessage;
    this.onServerDisconnectError = callbacks.onServerDisconnectError;
    this.logger = logger;

    this.connect();
  }

  private setSocketState(state: Socket) {
    this.socket = state;
    this._logVerbose(
      `socket state changed: ${this.socket.state}, paused: ${
        "paused" in this.socket ? this.socket.paused : undefined
      }`,
    );
    this.markConnectionStateDirty();
  }

  private assembleTransition(chunk: TransitionChunk): Transition | null {
    if (
      chunk.partNumber < 0 ||
      chunk.partNumber >= chunk.totalParts ||
      chunk.totalParts === 0 ||
      (this.transitionChunkBuffer &&
        (this.transitionChunkBuffer.totalParts !== chunk.totalParts ||
          this.transitionChunkBuffer.transitionId !== chunk.transitionId))
    ) {
      // Throwing an error doesn't crash the client, so clear the buffer.
      this.transitionChunkBuffer = null;
      throw new Error("Invalid TransitionChunk");
    }

    if (this.transitionChunkBuffer === null) {
      this.transitionChunkBuffer = {
        chunks: [],
        totalParts: chunk.totalParts,
        transitionId: chunk.transitionId,
      };
    }

    if (chunk.partNumber !== this.transitionChunkBuffer.chunks.length) {
      // Throwing an error doesn't crash the client, so clear the buffer.
      const expectedLength = this.transitionChunkBuffer.chunks.length;
      this.transitionChunkBuffer = null;
      throw new Error(
        `TransitionChunk received out of order: expected part ${expectedLength}, got ${chunk.partNumber}`,
      );
    }

    this.transitionChunkBuffer.chunks.push(chunk.chunk);

    if (this.transitionChunkBuffer.chunks.length === chunk.totalParts) {
      const fullJson = this.transitionChunkBuffer.chunks.join("");
      this.transitionChunkBuffer = null;

      const transition = parseServerMessage(JSON.parse(fullJson));
      if (transition.type !== "Transition") {
        throw new Error(
          `Expected Transition, got ${transition.type} after assembling chunks`,
        );
      }
      return transition;
    }

    return null;
  }

  private connect() {
    if (this.socket.state === "terminated") {
      return;
    }
    if (
      this.socket.state !== "disconnected" &&
      this.socket.state !== "stopped"
    ) {
      throw new Error(
        "Didn't start connection from disconnected state: " + this.socket.state,
      );
    }

    const ws = new this.webSocketConstructor(this.uri);
    this._logVerbose("constructed WebSocket");
    this.setSocketState({
      state: "connecting",
      ws,
      paused: "no",
    });

    // Kick off server inactivity timer before WebSocket connection is established
    // so we can detect cases where handshake fails.
    // The `onopen` event only fires after the connection is established:
    // Source: https://datatracker.ietf.org/doc/html/rfc6455#page-19:~:text=_The%20WebSocket%20Connection%20is%20Established_,-and
    this.resetServerInactivityTimeout();

    ws.onopen = () => {
      this.logger.logVerbose("begin ws.onopen");
      if (this.socket.state !== "connecting") {
        throw new Error("onopen called with socket not in connecting state");
      }
      this.setSocketState({
        state: "ready",
        ws,
        paused: this.socket.paused === "yes" ? "uninitialized" : "no",
      });
      this.resetServerInactivityTimeout();
      if (this.socket.paused === "no") {
        this._hasEverConnected = true;
        this.onOpen({
          connectionCount: this.connectionCount,
          lastCloseReason: this.lastCloseReason,
          clientTs: monotonicMillis(),
        });
      }

      if (this.lastCloseReason !== "InitialConnect") {
        if (this.lastCloseReason) {
          this.logger.log(
            "WebSocket reconnected at",
            prettyNow(),
            "after disconnect due to",
            this.lastCloseReason,
          );
        } else {
          this.logger.log("WebSocket reconnected at", prettyNow());
        }
      }

      this.connectionCount += 1;
      this.lastCloseReason = null;
    };
    // NB: The WebSocket API calls `onclose` even if connection fails, so we can route all error paths through `onclose`.
    ws.onerror = (error) => {
      this.transitionChunkBuffer = null;
      const message = (error as ErrorEvent).message;
      if (message) {
        this.logger.log(`WebSocket error message: ${message}`);
      }
    };
    ws.onmessage = (message) => {
      this.resetServerInactivityTimeout();
      const messageLength = message.data.length;
      let serverMessage = parseServerMessage(JSON.parse(message.data));
      this._logVerbose(`received ws message with type ${serverMessage.type}`);

      // Ping's only purpose is to reset the server inactivity timer.
      if (serverMessage.type === "Ping") {
        return;
      }

      // TransitionChunks never reach the main client logic.
      if (serverMessage.type === "TransitionChunk") {
        const transition = this.assembleTransition(serverMessage);
        if (!transition) {
          return;
        }
        serverMessage = transition;
        this._logVerbose(
          `assembled full ws message of type ${serverMessage.type}`,
        );
      }

      if (this.transitionChunkBuffer !== null) {
        this.transitionChunkBuffer = null;
        this.logger.log(
          `Received unexpected ${serverMessage.type} while buffering TransitionChunks`,
        );
      }

      if (serverMessage.type === "Transition") {
        this.reportLargeTransition({
          messageLength,
          transition: serverMessage,
        });
      }
      const response = this.onMessage(serverMessage);
      if (response.hasSyncedPastLastReconnect) {
        // Reset backoff to 0 once all outstanding requests are complete.
        this.retries = 0;
        this.markConnectionStateDirty();
      }
    };
    ws.onclose = (event) => {
      this._logVerbose("begin ws.onclose");
      this.transitionChunkBuffer = null;
      if (this.lastCloseReason === null) {
        // event.reason is often an empty string
        this.lastCloseReason = event.reason || `closed with code ${event.code}`;
      }
      if (
        event.code !== CLOSE_NORMAL &&
        event.code !== CLOSE_GOING_AWAY && // This commonly gets fired on mobile apps when the app is backgrounded
        event.code !== CLOSE_NO_STATUS &&
        event.code !== CLOSE_NOT_FOUND // Note that we want to retry on a 404, as it can be transient during a push.
      ) {
        let msg = `WebSocket closed with code ${event.code}`;
        if (event.reason) {
          msg += `: ${event.reason}`;
        }
        this.logger.log(msg);
        if (this.onServerDisconnectError && event.reason) {
          // This callback is a unstable API, InternalServerErrors in particular may be removed
          // since they reflect expected temporary downtime. But until a quantitative measure
          // of uptime is reported this unstable API errs on the inclusive side.
          this.onServerDisconnectError(msg);
        }
      }
      const reason = classifyDisconnectError(event.reason);
      this.scheduleReconnect(reason);
      return;
    };
  }

  /**
   * @returns The state of the {@link Socket}.
   */
  socketState(): string {
    return this.socket.state;
  }

  /**
   * @param message - A ClientMessage to send.
   * @returns Whether the message (might have been) sent.
   */
  sendMessage(message: ClientMessage) {
    const messageForLog = {
      type: message.type,
      ...(message.type === "Authenticate" && message.tokenType === "User"
        ? {
            value: `...${message.value.slice(-7)}`,
          }
        : {}),
    };
    if (this.socket.state === "ready" && this.socket.paused === "no") {
      const encodedMessage = encodeClientMessage(message);
      const request = JSON.stringify(encodedMessage);
      let sent = false;
      try {
        this.socket.ws.send(request);
        sent = true;
      } catch (error: any) {
        this.logger.log(
          `Failed to send message on WebSocket, reconnecting: ${error}`,
        );
        this.closeAndReconnect("FailedToSendMessage");
      }
      this._logVerbose(
        `${sent ? "sent" : "failed to send"} message with type ${message.type}: ${JSON.stringify(
          messageForLog,
        )}`,
      );
      return true;
    }
    this._logVerbose(
      `message not sent (socket state: ${this.socket.state}, paused: ${"paused" in this.socket ? this.socket.paused : undefined}): ${JSON.stringify(
        messageForLog,
      )}`,
    );

    return false;
  }

  private resetServerInactivityTimeout() {
    if (this.socket.state === "terminated") {
      // Don't reset any timers if we were trying to terminate.
      return;
    }
    if (this.reconnectDueToServerInactivityTimeout !== null) {
      clearTimeout(this.reconnectDueToServerInactivityTimeout);
      this.reconnectDueToServerInactivityTimeout = null;
    }
    this.reconnectDueToServerInactivityTimeout = setTimeout(() => {
      this.closeAndReconnect("InactiveServer");
    }, this.serverInactivityThreshold);
  }

  private scheduleReconnect(reason: "client" | ServerDisconnectError) {
    this.socket = { state: "disconnected" };
    const backoff = this.nextBackoff(reason);
    this.markConnectionStateDirty();
    this.logger.log(`Attempting reconnect in ${Math.round(backoff)}ms`);
    setTimeout(() => this.connect(), backoff);
  }

  /**
   * Close the WebSocket and schedule a reconnect.
   *
   * This should be used when we hit an error and would like to restart the session.
   */
  private closeAndReconnect(closeReason: string) {
    this._logVerbose(`begin closeAndReconnect with reason ${closeReason}`);
    switch (this.socket.state) {
      case "disconnected":
      case "terminated":
      case "stopped":
        // Nothing to do if we don't have a WebSocket.
        return;
      case "connecting":
      case "ready": {
        this.lastCloseReason = closeReason;
        // Close the old socket asynchronously, we'll open a new socket in reconnect.
        void this.close();
        this.scheduleReconnect("client");
        return;
      }
      default: {
        // Enforce that the switch-case is exhaustive.
        this.socket satisfies never;
      }
    }
  }

  /**
   * Close the WebSocket, being careful to clear the onclose handler to avoid re-entrant
   * calls. Use this instead of directly calling `ws.close()`
   *
   * It is the callers responsibility to update the state after this method is called so that the
   * closed socket is not accessible or used again after this method is called
   */
  private close(): Promise<void> {
    this.transitionChunkBuffer = null;
    switch (this.socket.state) {
      case "disconnected":
      case "terminated":
      case "stopped":
        // Nothing to do if we don't have a WebSocket.
        return Promise.resolve();
      case "connecting": {
        const ws = this.socket.ws;
        // Messages can still be received after close but we're not interested.
        ws.onmessage = (_message) => {
          this._logVerbose("Ignoring message received after close");
        };
        return new Promise((r) => {
          ws.onclose = () => {
            this._logVerbose("Closed after connecting");
            r();
          };
          ws.onopen = () => {
            this._logVerbose("Opened after connecting");
            ws.close();
          };
        });
      }
      case "ready": {
        this._logVerbose("ws.close called");
        const ws = this.socket.ws;
        // Messages can still be received after close but we're not interested.
        ws.onmessage = (_message) => {
          this._logVerbose("Ignoring message received after close");
        };
        const result: Promise<void> = new Promise((r) => {
          ws.onclose = () => {
            r();
          };
        });
        ws.close();
        return result;
      }
      default: {
        // Enforce that the switch-case is exhaustive.
        this.socket satisfies never;
        return Promise.resolve();
      }
    }
  }

  /**
   * Close the WebSocket and do not reconnect.
   * @returns A Promise that resolves when the WebSocket `onClose` callback is called.
   */
  terminate(): Promise<void> {
    if (this.reconnectDueToServerInactivityTimeout) {
      clearTimeout(this.reconnectDueToServerInactivityTimeout);
    }
    switch (this.socket.state) {
      case "terminated":
      case "stopped":
      case "disconnected":
      case "connecting":
      case "ready": {
        const result = this.close();
        this.setSocketState({ state: "terminated" });
        return result;
      }
      default: {
        // Enforce that the switch-case is exhaustive.
        this.socket satisfies never;
        throw new Error(
          `Invalid websocket state: ${(this.socket as any).state}`,
        );
      }
    }
  }

  stop(): Promise<void> {
    switch (this.socket.state) {
      case "terminated":
        // If we're terminating we ignore stop
        return Promise.resolve();
      case "connecting":
      case "stopped":
      case "disconnected":
      case "ready": {
        const result = this.close();
        this.socket = { state: "stopped" };
        return result;
      }
      default: {
        // Enforce that the switch-case is exhaustive.
        this.socket satisfies never;
        return Promise.resolve();
      }
    }
  }

  /**
   * Create a new WebSocket after a previous `stop()`, unless `terminate()` was
   * called before.
   */
  tryRestart(): void {
    switch (this.socket.state) {
      case "stopped":
        break;
      case "terminated":
      case "connecting":
      case "ready":
      case "disconnected":
        this.logger.logVerbose("Restart called without stopping first");
        return;
      default: {
        // Enforce that the switch-case is exhaustive.
        this.socket satisfies never;
      }
    }
    this.connect();
  }

  pause(): void {
    switch (this.socket.state) {
      case "disconnected":
      case "stopped":
      case "terminated":
        // If already stopped or stopping ignore.
        return;
      case "connecting":
      case "ready": {
        this.socket = { ...this.socket, paused: "yes" };
        return;
      }
      default: {
        // Enforce that the switch-case is exhaustive.
        this.socket satisfies never;
        return;
      }
    }
  }

  /**
   * Resume the state machine if previously paused.
   */
  resume(): void {
    switch (this.socket.state) {
      case "connecting":
        this.socket = { ...this.socket, paused: "no" };
        return;
      case "ready":
        if (this.socket.paused === "uninitialized") {
          this.socket = { ...this.socket, paused: "no" };
          this.onOpen({
            connectionCount: this.connectionCount,
            lastCloseReason: this.lastCloseReason,
            clientTs: monotonicMillis(),
          });
        } else if (this.socket.paused === "yes") {
          this.socket = { ...this.socket, paused: "no" };
          this.onResume();
        }
        return;
      case "terminated":
      case "stopped":
      case "disconnected":
        // Ignore resume if not paused, perhaps we already resumed.
        return;
      default: {
        // Enforce that the switch-case is exhaustive.
        this.socket satisfies never;
      }
    }
    this.connect();
  }

  connectionState(): {
    isConnected: boolean;
    hasEverConnected: boolean;
    connectionCount: number;
    connectionRetries: number;
  } {
    return {
      isConnected: this.socket.state === "ready",
      hasEverConnected: this._hasEverConnected,
      connectionCount: this.connectionCount,
      connectionRetries: this.retries,
    };
  }

  private _logVerbose(message: string) {
    this.logger.logVerbose(message);
  }

  private nextBackoff(reason: "client" | ServerDisconnectError): number {
    const initialBackoff: number =
      reason === "client"
        ? 100 // There's no evidence of a server problem, retry quickly
        : reason === "Unknown"
          ? this.defaultInitialBackoff
          : serverDisconnectErrors[reason].timeout;

    const baseBackoff = initialBackoff * Math.pow(2, this.retries);
    this.retries += 1;
    const actualBackoff = Math.min(baseBackoff, this.maxBackoff);
    const jitter = actualBackoff * (Math.random() - 0.5);
    return actualBackoff + jitter;
  }

  private reportLargeTransition({
    transition,
    messageLength,
  }: {
    transition: Transition;
    messageLength: number;
  }) {
    if (
      transition.clientClockSkew === undefined ||
      transition.serverTs === undefined
    ) {
      return;
    }

    const transitionTransitTime =
      monotonicMillis() - // client time now
      // clientClockSkew = (server time + upstream latency) - client time
      // clientClockSkew is "how many milliseconds behind (slow) is the client clock"
      // but the latency of the Connect message inflates this, making it appear further behind
      transition.clientClockSkew -
      transition.serverTs / 1_000_000; // server time when transition was sent
    const prettyTransitionTime = `${Math.round(transitionTransitTime)}ms`;
    const prettyMessageMB = `${Math.round(messageLength / 10_000) / 100}MB`;
    const bytesPerSecond = messageLength / (transitionTransitTime / 1000);
    const prettyBytesPerSecond = `${Math.round(bytesPerSecond / 10_000) / 100}MB per second`;
    this._logVerbose(
      `received ${prettyMessageMB} transition in ${prettyTransitionTime} at ${prettyBytesPerSecond}`,
    );

    // Warnings that will show up for *all users*, so don't be too aggressive.
    // These can be silenced (along with reconnection messages) by setting `logger: false` in client options.
    if (messageLength > 20_000_000) {
      // Big enough that the developer should be made aware of this.
      this.logger.log(
        `received query results totaling more that 20MB (${prettyMessageMB}) which will take a long time to download on slower connections`,
      );
    } else if (transitionTransitTime > 20_000) {
      // Long enough that a pattern of these should be interesting to a developer, but be aware that
      // weak connections, putting clients to sleep, backgrounding etc. could all cause this too.
      this.logger.log(
        `received query results totaling ${prettyMessageMB} which took more than 20s to arrive (${prettyTransitionTime})`,
      );
    }

    if (this.debug) {
      // debug means "reportDebugInfoToConvex" is set so this can be aggressive.
      this.sendMessage({
        type: "Event",
        eventType: "ClientReceivedTransition",
        event: { transitionTransitTime, messageLength },
      });
    }
  }
}
