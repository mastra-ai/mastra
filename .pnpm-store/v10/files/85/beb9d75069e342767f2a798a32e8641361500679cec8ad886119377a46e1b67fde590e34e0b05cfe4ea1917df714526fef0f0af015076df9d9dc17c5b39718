"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import {
  encodeClientMessage,
  parseServerMessage
} from "./protocol.js";
const CLOSE_NORMAL = 1e3;
const CLOSE_GOING_AWAY = 1001;
const CLOSE_NO_STATUS = 1005;
const CLOSE_NOT_FOUND = 4040;
let firstTime;
function monotonicMillis() {
  if (firstTime === void 0) {
    firstTime = Date.now();
  }
  if (typeof performance === "undefined" || !performance.now) {
    return Date.now();
  }
  return Math.round(firstTime + performance.now());
}
function prettyNow() {
  return `t=${Math.round((monotonicMillis() - firstTime) / 100) / 10}s`;
}
const serverDisconnectErrors = {
  // A known error, e.g. during a restart or push
  InternalServerError: { timeout: 1e3 },
  // ErrorMetadata::overloaded() messages that we realy should back off
  SubscriptionsWorkerFullError: { timeout: 3e3 },
  TooManyConcurrentRequests: { timeout: 3e3 },
  CommitterFullError: { timeout: 3e3 },
  AwsTooManyRequestsException: { timeout: 3e3 },
  ExecuteFullError: { timeout: 3e3 },
  SystemTimeoutError: { timeout: 3e3 },
  ExpiredInQueue: { timeout: 3e3 },
  // ErrorMetadata::feature_temporarily_unavailable() that typically indicate a deploy just happened
  VectorIndexesUnavailable: { timeout: 1e3 },
  SearchIndexesUnavailable: { timeout: 1e3 },
  TableSummariesUnavailable: { timeout: 1e3 },
  // More ErrorMetadata::overloaded()
  VectorIndexTooLarge: { timeout: 3e3 },
  SearchIndexTooLarge: { timeout: 3e3 },
  TooManyWritesInTimePeriod: { timeout: 3e3 }
};
function classifyDisconnectError(s) {
  if (s === void 0) return "Unknown";
  for (const prefix of Object.keys(
    serverDisconnectErrors
  )) {
    if (s.startsWith(prefix)) {
      return prefix;
    }
  }
  return "Unknown";
}
export class WebSocketManager {
  constructor(uri, callbacks, webSocketConstructor, logger, markConnectionStateDirty, debug) {
    this.markConnectionStateDirty = markConnectionStateDirty;
    this.debug = debug;
    __publicField(this, "socket");
    __publicField(this, "connectionCount");
    __publicField(this, "_hasEverConnected", false);
    __publicField(this, "lastCloseReason");
    // State for assembling the split-up Transition currently being received.
    __publicField(this, "transitionChunkBuffer", null);
    /** Upon HTTPS/WSS failure, the first jittered backoff duration, in ms. */
    __publicField(this, "defaultInitialBackoff");
    /** We backoff exponentially, but we need to cap that--this is the jittered max. */
    __publicField(this, "maxBackoff");
    /** How many times have we failed consecutively? */
    __publicField(this, "retries");
    /** How long before lack of server response causes us to initiate a reconnect,
     * in ms */
    __publicField(this, "serverInactivityThreshold");
    __publicField(this, "reconnectDueToServerInactivityTimeout");
    __publicField(this, "uri");
    __publicField(this, "onOpen");
    __publicField(this, "onResume");
    __publicField(this, "onMessage");
    __publicField(this, "webSocketConstructor");
    __publicField(this, "logger");
    __publicField(this, "onServerDisconnectError");
    this.webSocketConstructor = webSocketConstructor;
    this.socket = { state: "disconnected" };
    this.connectionCount = 0;
    this.lastCloseReason = "InitialConnect";
    this.defaultInitialBackoff = 1e3;
    this.maxBackoff = 16e3;
    this.retries = 0;
    this.serverInactivityThreshold = 6e4;
    this.reconnectDueToServerInactivityTimeout = null;
    this.uri = uri;
    this.onOpen = callbacks.onOpen;
    this.onResume = callbacks.onResume;
    this.onMessage = callbacks.onMessage;
    this.onServerDisconnectError = callbacks.onServerDisconnectError;
    this.logger = logger;
    this.connect();
  }
  setSocketState(state) {
    this.socket = state;
    this._logVerbose(
      `socket state changed: ${this.socket.state}, paused: ${"paused" in this.socket ? this.socket.paused : void 0}`
    );
    this.markConnectionStateDirty();
  }
  assembleTransition(chunk) {
    if (chunk.partNumber < 0 || chunk.partNumber >= chunk.totalParts || chunk.totalParts === 0 || this.transitionChunkBuffer && (this.transitionChunkBuffer.totalParts !== chunk.totalParts || this.transitionChunkBuffer.transitionId !== chunk.transitionId)) {
      this.transitionChunkBuffer = null;
      throw new Error("Invalid TransitionChunk");
    }
    if (this.transitionChunkBuffer === null) {
      this.transitionChunkBuffer = {
        chunks: [],
        totalParts: chunk.totalParts,
        transitionId: chunk.transitionId
      };
    }
    if (chunk.partNumber !== this.transitionChunkBuffer.chunks.length) {
      const expectedLength = this.transitionChunkBuffer.chunks.length;
      this.transitionChunkBuffer = null;
      throw new Error(
        `TransitionChunk received out of order: expected part ${expectedLength}, got ${chunk.partNumber}`
      );
    }
    this.transitionChunkBuffer.chunks.push(chunk.chunk);
    if (this.transitionChunkBuffer.chunks.length === chunk.totalParts) {
      const fullJson = this.transitionChunkBuffer.chunks.join("");
      this.transitionChunkBuffer = null;
      const transition = parseServerMessage(JSON.parse(fullJson));
      if (transition.type !== "Transition") {
        throw new Error(
          `Expected Transition, got ${transition.type} after assembling chunks`
        );
      }
      return transition;
    }
    return null;
  }
  connect() {
    if (this.socket.state === "terminated") {
      return;
    }
    if (this.socket.state !== "disconnected" && this.socket.state !== "stopped") {
      throw new Error(
        "Didn't start connection from disconnected state: " + this.socket.state
      );
    }
    const ws = new this.webSocketConstructor(this.uri);
    this._logVerbose("constructed WebSocket");
    this.setSocketState({
      state: "connecting",
      ws,
      paused: "no"
    });
    this.resetServerInactivityTimeout();
    ws.onopen = () => {
      this.logger.logVerbose("begin ws.onopen");
      if (this.socket.state !== "connecting") {
        throw new Error("onopen called with socket not in connecting state");
      }
      this.setSocketState({
        state: "ready",
        ws,
        paused: this.socket.paused === "yes" ? "uninitialized" : "no"
      });
      this.resetServerInactivityTimeout();
      if (this.socket.paused === "no") {
        this._hasEverConnected = true;
        this.onOpen({
          connectionCount: this.connectionCount,
          lastCloseReason: this.lastCloseReason,
          clientTs: monotonicMillis()
        });
      }
      if (this.lastCloseReason !== "InitialConnect") {
        if (this.lastCloseReason) {
          this.logger.log(
            "WebSocket reconnected at",
            prettyNow(),
            "after disconnect due to",
            this.lastCloseReason
          );
        } else {
          this.logger.log("WebSocket reconnected at", prettyNow());
        }
      }
      this.connectionCount += 1;
      this.lastCloseReason = null;
    };
    ws.onerror = (error) => {
      this.transitionChunkBuffer = null;
      const message = error.message;
      if (message) {
        this.logger.log(`WebSocket error message: ${message}`);
      }
    };
    ws.onmessage = (message) => {
      this.resetServerInactivityTimeout();
      const messageLength = message.data.length;
      let serverMessage = parseServerMessage(JSON.parse(message.data));
      this._logVerbose(`received ws message with type ${serverMessage.type}`);
      if (serverMessage.type === "Ping") {
        return;
      }
      if (serverMessage.type === "TransitionChunk") {
        const transition = this.assembleTransition(serverMessage);
        if (!transition) {
          return;
        }
        serverMessage = transition;
        this._logVerbose(
          `assembled full ws message of type ${serverMessage.type}`
        );
      }
      if (this.transitionChunkBuffer !== null) {
        this.transitionChunkBuffer = null;
        this.logger.log(
          `Received unexpected ${serverMessage.type} while buffering TransitionChunks`
        );
      }
      if (serverMessage.type === "Transition") {
        this.reportLargeTransition({
          messageLength,
          transition: serverMessage
        });
      }
      const response = this.onMessage(serverMessage);
      if (response.hasSyncedPastLastReconnect) {
        this.retries = 0;
        this.markConnectionStateDirty();
      }
    };
    ws.onclose = (event) => {
      this._logVerbose("begin ws.onclose");
      this.transitionChunkBuffer = null;
      if (this.lastCloseReason === null) {
        this.lastCloseReason = event.reason || `closed with code ${event.code}`;
      }
      if (event.code !== CLOSE_NORMAL && event.code !== CLOSE_GOING_AWAY && // This commonly gets fired on mobile apps when the app is backgrounded
      event.code !== CLOSE_NO_STATUS && event.code !== CLOSE_NOT_FOUND) {
        let msg = `WebSocket closed with code ${event.code}`;
        if (event.reason) {
          msg += `: ${event.reason}`;
        }
        this.logger.log(msg);
        if (this.onServerDisconnectError && event.reason) {
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
  socketState() {
    return this.socket.state;
  }
  /**
   * @param message - A ClientMessage to send.
   * @returns Whether the message (might have been) sent.
   */
  sendMessage(message) {
    const messageForLog = {
      type: message.type,
      ...message.type === "Authenticate" && message.tokenType === "User" ? {
        value: `...${message.value.slice(-7)}`
      } : {}
    };
    if (this.socket.state === "ready" && this.socket.paused === "no") {
      const encodedMessage = encodeClientMessage(message);
      const request = JSON.stringify(encodedMessage);
      let sent = false;
      try {
        this.socket.ws.send(request);
        sent = true;
      } catch (error) {
        this.logger.log(
          `Failed to send message on WebSocket, reconnecting: ${error}`
        );
        this.closeAndReconnect("FailedToSendMessage");
      }
      this._logVerbose(
        `${sent ? "sent" : "failed to send"} message with type ${message.type}: ${JSON.stringify(
          messageForLog
        )}`
      );
      return true;
    }
    this._logVerbose(
      `message not sent (socket state: ${this.socket.state}, paused: ${"paused" in this.socket ? this.socket.paused : void 0}): ${JSON.stringify(
        messageForLog
      )}`
    );
    return false;
  }
  resetServerInactivityTimeout() {
    if (this.socket.state === "terminated") {
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
  scheduleReconnect(reason) {
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
  closeAndReconnect(closeReason) {
    this._logVerbose(`begin closeAndReconnect with reason ${closeReason}`);
    switch (this.socket.state) {
      case "disconnected":
      case "terminated":
      case "stopped":
        return;
      case "connecting":
      case "ready": {
        this.lastCloseReason = closeReason;
        void this.close();
        this.scheduleReconnect("client");
        return;
      }
      default: {
        this.socket;
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
  close() {
    this.transitionChunkBuffer = null;
    switch (this.socket.state) {
      case "disconnected":
      case "terminated":
      case "stopped":
        return Promise.resolve();
      case "connecting": {
        const ws = this.socket.ws;
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
        ws.onmessage = (_message) => {
          this._logVerbose("Ignoring message received after close");
        };
        const result = new Promise((r) => {
          ws.onclose = () => {
            r();
          };
        });
        ws.close();
        return result;
      }
      default: {
        this.socket;
        return Promise.resolve();
      }
    }
  }
  /**
   * Close the WebSocket and do not reconnect.
   * @returns A Promise that resolves when the WebSocket `onClose` callback is called.
   */
  terminate() {
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
        this.socket;
        throw new Error(
          `Invalid websocket state: ${this.socket.state}`
        );
      }
    }
  }
  stop() {
    switch (this.socket.state) {
      case "terminated":
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
        this.socket;
        return Promise.resolve();
      }
    }
  }
  /**
   * Create a new WebSocket after a previous `stop()`, unless `terminate()` was
   * called before.
   */
  tryRestart() {
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
        this.socket;
      }
    }
    this.connect();
  }
  pause() {
    switch (this.socket.state) {
      case "disconnected":
      case "stopped":
      case "terminated":
        return;
      case "connecting":
      case "ready": {
        this.socket = { ...this.socket, paused: "yes" };
        return;
      }
      default: {
        this.socket;
        return;
      }
    }
  }
  /**
   * Resume the state machine if previously paused.
   */
  resume() {
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
            clientTs: monotonicMillis()
          });
        } else if (this.socket.paused === "yes") {
          this.socket = { ...this.socket, paused: "no" };
          this.onResume();
        }
        return;
      case "terminated":
      case "stopped":
      case "disconnected":
        return;
      default: {
        this.socket;
      }
    }
    this.connect();
  }
  connectionState() {
    return {
      isConnected: this.socket.state === "ready",
      hasEverConnected: this._hasEverConnected,
      connectionCount: this.connectionCount,
      connectionRetries: this.retries
    };
  }
  _logVerbose(message) {
    this.logger.logVerbose(message);
  }
  nextBackoff(reason) {
    const initialBackoff = reason === "client" ? 100 : reason === "Unknown" ? this.defaultInitialBackoff : serverDisconnectErrors[reason].timeout;
    const baseBackoff = initialBackoff * Math.pow(2, this.retries);
    this.retries += 1;
    const actualBackoff = Math.min(baseBackoff, this.maxBackoff);
    const jitter = actualBackoff * (Math.random() - 0.5);
    return actualBackoff + jitter;
  }
  reportLargeTransition({
    transition,
    messageLength
  }) {
    if (transition.clientClockSkew === void 0 || transition.serverTs === void 0) {
      return;
    }
    const transitionTransitTime = monotonicMillis() - // client time now
    // clientClockSkew = (server time + upstream latency) - client time
    // clientClockSkew is "how many milliseconds behind (slow) is the client clock"
    // but the latency of the Connect message inflates this, making it appear further behind
    transition.clientClockSkew - transition.serverTs / 1e6;
    const prettyTransitionTime = `${Math.round(transitionTransitTime)}ms`;
    const prettyMessageMB = `${Math.round(messageLength / 1e4) / 100}MB`;
    const bytesPerSecond = messageLength / (transitionTransitTime / 1e3);
    const prettyBytesPerSecond = `${Math.round(bytesPerSecond / 1e4) / 100}MB per second`;
    this._logVerbose(
      `received ${prettyMessageMB} transition in ${prettyTransitionTime} at ${prettyBytesPerSecond}`
    );
    if (messageLength > 2e7) {
      this.logger.log(
        `received query results totaling more that 20MB (${prettyMessageMB}) which will take a long time to download on slower connections`
      );
    } else if (transitionTransitTime > 2e4) {
      this.logger.log(
        `received query results totaling ${prettyMessageMB} which took more than 20s to arrive (${prettyTransitionTime})`
      );
    }
    if (this.debug) {
      this.sendMessage({
        type: "Event",
        eventType: "ClientReceivedTransition",
        event: { transitionTransitTime, messageLength }
      });
    }
  }
}
//# sourceMappingURL=web_socket_manager.js.map
