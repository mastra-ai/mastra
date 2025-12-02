import WebSocketFactory, { WebSocketLike } from './lib/websocket-factory'

import {
  CHANNEL_EVENTS,
  CONNECTION_STATE,
  DEFAULT_VERSION,
  DEFAULT_TIMEOUT,
  SOCKET_STATES,
  TRANSPORTS,
  VSN,
  WS_CLOSE_NORMAL,
} from './lib/constants'

import Serializer from './lib/serializer'
import Timer from './lib/timer'

import { httpEndpointURL } from './lib/transformers'
import RealtimeChannel from './RealtimeChannel'
import type { RealtimeChannelOptions } from './RealtimeChannel'

type Fetch = typeof fetch

export type Channel = {
  name: string
  inserted_at: string
  updated_at: string
  id: number
}
export type LogLevel = 'info' | 'warn' | 'error'

export type RealtimeMessage = {
  topic: string
  event: string
  payload: any
  ref: string
  join_ref?: string
}

export type RealtimeRemoveChannelResponse = 'ok' | 'timed out' | 'error'
export type HeartbeatStatus = 'sent' | 'ok' | 'error' | 'timeout' | 'disconnected'

const noop = () => {}

type RealtimeClientState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected'

// Connection-related constants
const CONNECTION_TIMEOUTS = {
  HEARTBEAT_INTERVAL: 25000,
  RECONNECT_DELAY: 10,
  HEARTBEAT_TIMEOUT_FALLBACK: 100,
} as const

const RECONNECT_INTERVALS = [1000, 2000, 5000, 10000] as const
const DEFAULT_RECONNECT_FALLBACK = 10000

export interface WebSocketLikeConstructor {
  new (address: string | URL, subprotocols?: string | string[] | undefined): WebSocketLike
  // Allow additional properties that may exist on WebSocket constructors
  [key: string]: any
}

export interface WebSocketLikeError {
  error: any
  message: string
  type: string
}

export type RealtimeClientOptions = {
  transport?: WebSocketLikeConstructor
  timeout?: number
  heartbeatIntervalMs?: number
  heartbeatCallback?: (status: HeartbeatStatus) => void
  logger?: Function
  encode?: Function
  decode?: Function
  reconnectAfterMs?: Function
  headers?: { [key: string]: string }
  params?: { [key: string]: any }
  //Deprecated: Use it in favour of correct casing `logLevel`
  log_level?: LogLevel
  logLevel?: LogLevel
  fetch?: Fetch
  worker?: boolean
  workerUrl?: string
  accessToken?: () => Promise<string | null>
}

const WORKER_SCRIPT = `
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`

export default class RealtimeClient {
  accessTokenValue: string | null = null
  apiKey: string | null = null
  channels: RealtimeChannel[] = new Array()
  endPoint: string = ''
  httpEndpoint: string = ''
  /** @deprecated headers cannot be set on websocket connections */
  headers?: { [key: string]: string } = {}
  params?: { [key: string]: string } = {}
  timeout: number = DEFAULT_TIMEOUT
  transport: WebSocketLikeConstructor | null = null
  heartbeatIntervalMs: number = CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL
  heartbeatTimer: ReturnType<typeof setInterval> | undefined = undefined
  pendingHeartbeatRef: string | null = null
  heartbeatCallback: (status: HeartbeatStatus) => void = noop
  ref: number = 0
  reconnectTimer: Timer | null = null
  logger: Function = noop
  logLevel?: LogLevel
  encode!: Function
  decode!: Function
  reconnectAfterMs!: Function
  conn: WebSocketLike | null = null
  sendBuffer: Function[] = []
  serializer: Serializer = new Serializer()
  stateChangeCallbacks: {
    open: Function[]
    close: Function[]
    error: Function[]
    message: Function[]
  } = {
    open: [],
    close: [],
    error: [],
    message: [],
  }
  fetch: Fetch
  accessToken: (() => Promise<string | null>) | null = null
  worker?: boolean
  workerUrl?: string
  workerRef?: Worker
  private _connectionState: RealtimeClientState = 'disconnected'
  private _wasManualDisconnect: boolean = false
  private _authPromise: Promise<void> | null = null

  /**
   * Initializes the Socket.
   *
   * @param endPoint The string WebSocket endpoint, ie, "ws://example.com/socket", "wss://example.com", "/socket" (inherited host & protocol)
   * @param httpEndpoint The string HTTP endpoint, ie, "https://example.com", "/" (inherited host & protocol)
   * @param options.transport The Websocket Transport, for example WebSocket. This can be a custom implementation
   * @param options.timeout The default timeout in milliseconds to trigger push timeouts.
   * @param options.params The optional params to pass when connecting.
   * @param options.headers Deprecated: headers cannot be set on websocket connections and this option will be removed in the future.
   * @param options.heartbeatIntervalMs The millisec interval to send a heartbeat message.
   * @param options.heartbeatCallback The optional function to handle heartbeat status.
   * @param options.logger The optional function for specialized logging, ie: logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
   * @param options.logLevel Sets the log level for Realtime
   * @param options.encode The function to encode outgoing messages. Defaults to JSON: (payload, callback) => callback(JSON.stringify(payload))
   * @param options.decode The function to decode incoming messages. Defaults to Serializer's decode.
   * @param options.reconnectAfterMs he optional function that returns the millsec reconnect interval. Defaults to stepped backoff off.
   * @param options.worker Use Web Worker to set a side flow. Defaults to false.
   * @param options.workerUrl The URL of the worker script. Defaults to https://realtime.supabase.com/worker.js that includes a heartbeat event call to keep the connection alive.
   */
  constructor(endPoint: string, options?: RealtimeClientOptions) {
    // Validate required parameters
    if (!options?.params?.apikey) {
      throw new Error('API key is required to connect to Realtime')
    }
    this.apiKey = options.params.apikey

    // Initialize endpoint URLs
    this.endPoint = `${endPoint}/${TRANSPORTS.websocket}`
    this.httpEndpoint = httpEndpointURL(endPoint)

    this._initializeOptions(options)
    this._setupReconnectionTimer()
    this.fetch = this._resolveFetch(options?.fetch)
  }

  /**
   * Connects the socket, unless already connected.
   */
  connect(): void {
    // Skip if already connecting, disconnecting, or connected
    if (
      this.isConnecting() ||
      this.isDisconnecting() ||
      (this.conn !== null && this.isConnected())
    ) {
      return
    }

    this._setConnectionState('connecting')
    this._setAuthSafely('connect')

    // Establish WebSocket connection
    if (this.transport) {
      // Use custom transport if provided
      this.conn = new this.transport(this.endpointURL()) as WebSocketLike
    } else {
      // Try to use native WebSocket
      try {
        this.conn = WebSocketFactory.createWebSocket(this.endpointURL())
      } catch (error) {
        this._setConnectionState('disconnected')
        const errorMessage = (error as Error).message

        // Provide helpful error message based on environment
        if (errorMessage.includes('Node.js')) {
          throw new Error(
            `${errorMessage}\n\n` +
              'To use Realtime in Node.js, you need to provide a WebSocket implementation:\n\n' +
              'Option 1: Use Node.js 22+ which has native WebSocket support\n' +
              'Option 2: Install and provide the "ws" package:\n\n' +
              '  npm install ws\n\n' +
              '  import ws from "ws"\n' +
              '  const client = new RealtimeClient(url, {\n' +
              '    ...options,\n' +
              '    transport: ws\n' +
              '  })'
          )
        }
        throw new Error(`WebSocket not available: ${errorMessage}`)
      }
    }
    this._setupConnectionHandlers()
  }

  /**
   * Returns the URL of the websocket.
   * @returns string The URL of the websocket.
   */
  endpointURL(): string {
    return this._appendParams(this.endPoint, Object.assign({}, this.params, { vsn: VSN }))
  }

  /**
   * Disconnects the socket.
   *
   * @param code A numeric status code to send on disconnect.
   * @param reason A custom reason for the disconnect.
   */
  disconnect(code?: number, reason?: string): void {
    if (this.isDisconnecting()) {
      return
    }

    this._setConnectionState('disconnecting', true)

    if (this.conn) {
      // Setup fallback timer to prevent hanging in disconnecting state
      const fallbackTimer = setTimeout(() => {
        this._setConnectionState('disconnected')
      }, 100)

      this.conn.onclose = () => {
        clearTimeout(fallbackTimer)
        this._setConnectionState('disconnected')
      }

      // Close the WebSocket connection
      if (code) {
        this.conn.close(code, reason ?? '')
      } else {
        this.conn.close()
      }

      this._teardownConnection()
    } else {
      this._setConnectionState('disconnected')
    }
  }

  /**
   * Returns all created channels
   */
  getChannels(): RealtimeChannel[] {
    return this.channels
  }

  /**
   * Unsubscribes and removes a single channel
   * @param channel A RealtimeChannel instance
   */
  async removeChannel(channel: RealtimeChannel): Promise<RealtimeRemoveChannelResponse> {
    const status = await channel.unsubscribe()

    if (this.channels.length === 0) {
      this.disconnect()
    }

    return status
  }

  /**
   * Unsubscribes and removes all channels
   */
  async removeAllChannels(): Promise<RealtimeRemoveChannelResponse[]> {
    const values_1 = await Promise.all(this.channels.map((channel) => channel.unsubscribe()))
    this.channels = []
    this.disconnect()
    return values_1
  }

  /**
   * Logs the message.
   *
   * For customized logging, `this.logger` can be overridden.
   */
  log(kind: string, msg: string, data?: any) {
    this.logger(kind, msg, data)
  }

  /**
   * Returns the current state of the socket.
   */
  connectionState(): CONNECTION_STATE {
    switch (this.conn && this.conn.readyState) {
      case SOCKET_STATES.connecting:
        return CONNECTION_STATE.Connecting
      case SOCKET_STATES.open:
        return CONNECTION_STATE.Open
      case SOCKET_STATES.closing:
        return CONNECTION_STATE.Closing
      default:
        return CONNECTION_STATE.Closed
    }
  }

  /**
   * Returns `true` is the connection is open.
   */
  isConnected(): boolean {
    return this.connectionState() === CONNECTION_STATE.Open
  }

  /**
   * Returns `true` if the connection is currently connecting.
   */
  isConnecting(): boolean {
    return this._connectionState === 'connecting'
  }

  /**
   * Returns `true` if the connection is currently disconnecting.
   */
  isDisconnecting(): boolean {
    return this._connectionState === 'disconnecting'
  }

  channel(topic: string, params: RealtimeChannelOptions = { config: {} }): RealtimeChannel {
    const realtimeTopic = `realtime:${topic}`
    const exists = this.getChannels().find((c: RealtimeChannel) => c.topic === realtimeTopic)

    if (!exists) {
      const chan = new RealtimeChannel(`realtime:${topic}`, params, this)
      this.channels.push(chan)

      return chan
    } else {
      return exists
    }
  }

  /**
   * Push out a message if the socket is connected.
   *
   * If the socket is not connected, the message gets enqueued within a local buffer, and sent out when a connection is next established.
   */
  push(data: RealtimeMessage): void {
    const { topic, event, payload, ref } = data
    const callback = () => {
      this.encode(data, (result: any) => {
        this.conn?.send(result)
      })
    }
    this.log('push', `${topic} ${event} (${ref})`, payload)
    if (this.isConnected()) {
      callback()
    } else {
      this.sendBuffer.push(callback)
    }
  }

  /**
   * Sets the JWT access token used for channel subscription authorization and Realtime RLS.
   *
   * If param is null it will use the `accessToken` callback function or the token set on the client.
   *
   * On callback used, it will set the value of the token internal to the client.
   *
   * @param token A JWT string to override the token set on the client.
   */
  async setAuth(token: string | null = null): Promise<void> {
    this._authPromise = this._performAuth(token)
    try {
      await this._authPromise
    } finally {
      this._authPromise = null
    }
  }
  /**
   * Sends a heartbeat message if the socket is connected.
   */
  async sendHeartbeat() {
    if (!this.isConnected()) {
      try {
        this.heartbeatCallback('disconnected')
      } catch (e) {
        this.log('error', 'error in heartbeat callback', e)
      }
      return
    }

    // Handle heartbeat timeout and force reconnection if needed
    if (this.pendingHeartbeatRef) {
      this.pendingHeartbeatRef = null
      this.log('transport', 'heartbeat timeout. Attempting to re-establish connection')
      try {
        this.heartbeatCallback('timeout')
      } catch (e) {
        this.log('error', 'error in heartbeat callback', e)
      }

      // Force reconnection after heartbeat timeout
      this._wasManualDisconnect = false
      this.conn?.close(WS_CLOSE_NORMAL, 'heartbeat timeout')

      setTimeout(() => {
        if (!this.isConnected()) {
          this.reconnectTimer?.scheduleTimeout()
        }
      }, CONNECTION_TIMEOUTS.HEARTBEAT_TIMEOUT_FALLBACK)
      return
    }

    // Send heartbeat message to server
    this.pendingHeartbeatRef = this._makeRef()
    this.push({
      topic: 'phoenix',
      event: 'heartbeat',
      payload: {},
      ref: this.pendingHeartbeatRef,
    })
    try {
      this.heartbeatCallback('sent')
    } catch (e) {
      this.log('error', 'error in heartbeat callback', e)
    }

    this._setAuthSafely('heartbeat')
  }

  onHeartbeat(callback: (status: HeartbeatStatus) => void): void {
    this.heartbeatCallback = callback
  }
  /**
   * Flushes send buffer
   */
  flushSendBuffer() {
    if (this.isConnected() && this.sendBuffer.length > 0) {
      this.sendBuffer.forEach((callback) => callback())
      this.sendBuffer = []
    }
  }

  /**
   * Use either custom fetch, if provided, or default fetch to make HTTP requests
   *
   * @internal
   */
  _resolveFetch = (customFetch?: Fetch): Fetch => {
    let _fetch: Fetch
    if (customFetch) {
      _fetch = customFetch
    } else if (typeof fetch === 'undefined') {
      // Node.js environment without native fetch
      _fetch = (...args) =>
        import('@supabase/node-fetch' as any)
          .then(({ default: fetch }) => fetch(...args))
          .catch((error) => {
            throw new Error(
              `Failed to load @supabase/node-fetch: ${error.message}. ` +
                `This is required for HTTP requests in Node.js environments without native fetch.`
            )
          })
    } else {
      _fetch = fetch
    }
    return (...args) => _fetch(...args)
  }

  /**
   * Return the next message ref, accounting for overflows
   *
   * @internal
   */
  _makeRef(): string {
    let newRef = this.ref + 1
    if (newRef === this.ref) {
      this.ref = 0
    } else {
      this.ref = newRef
    }

    return this.ref.toString()
  }

  /**
   * Unsubscribe from channels with the specified topic.
   *
   * @internal
   */
  _leaveOpenTopic(topic: string): void {
    let dupChannel = this.channels.find(
      (c) => c.topic === topic && (c._isJoined() || c._isJoining())
    )
    if (dupChannel) {
      this.log('transport', `leaving duplicate topic "${topic}"`)
      dupChannel.unsubscribe()
    }
  }

  /**
   * Removes a subscription from the socket.
   *
   * @param channel An open subscription.
   *
   * @internal
   */
  _remove(channel: RealtimeChannel) {
    this.channels = this.channels.filter((c) => c.topic !== channel.topic)
  }

  /** @internal */
  private _onConnMessage(rawMessage: { data: any }) {
    this.decode(rawMessage.data, (msg: RealtimeMessage) => {
      // Handle heartbeat responses
      if (msg.topic === 'phoenix' && msg.event === 'phx_reply') {
        try {
          this.heartbeatCallback(msg.payload.status === 'ok' ? 'ok' : 'error')
        } catch (e) {
          this.log('error', 'error in heartbeat callback', e)
        }
      }

      // Handle pending heartbeat reference cleanup
      if (msg.ref && msg.ref === this.pendingHeartbeatRef) {
        this.pendingHeartbeatRef = null
      }

      // Log incoming message
      const { topic, event, payload, ref } = msg
      const refString = ref ? `(${ref})` : ''
      const status = payload.status || ''
      this.log('receive', `${status} ${topic} ${event} ${refString}`.trim(), payload)

      // Route message to appropriate channels
      this.channels
        .filter((channel: RealtimeChannel) => channel._isMember(topic))
        .forEach((channel: RealtimeChannel) => channel._trigger(event, payload, ref))

      this._triggerStateCallbacks('message', msg)
    })
  }

  /**
   * Clear specific timer
   * @internal
   */
  private _clearTimer(timer: 'heartbeat' | 'reconnect'): void {
    if (timer === 'heartbeat' && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    } else if (timer === 'reconnect') {
      this.reconnectTimer?.reset()
    }
  }

  /**
   * Clear all timers
   * @internal
   */
  private _clearAllTimers(): void {
    this._clearTimer('heartbeat')
    this._clearTimer('reconnect')
  }

  /**
   * Setup connection handlers for WebSocket events
   * @internal
   */
  private _setupConnectionHandlers(): void {
    if (!this.conn) return

    // Set binary type if supported (browsers and most WebSocket implementations)
    if ('binaryType' in this.conn) {
      ;(this.conn as any).binaryType = 'arraybuffer'
    }

    this.conn.onopen = () => this._onConnOpen()
    this.conn.onerror = (error: Event) => this._onConnError(error)
    this.conn.onmessage = (event: any) => this._onConnMessage(event)
    this.conn.onclose = (event: any) => this._onConnClose(event)
  }

  /**
   * Teardown connection and cleanup resources
   * @internal
   */
  private _teardownConnection(): void {
    if (this.conn) {
      this.conn.onopen = null
      this.conn.onerror = null
      this.conn.onmessage = null
      this.conn.onclose = null
      this.conn = null
    }
    this._clearAllTimers()
    this.channels.forEach((channel) => channel.teardown())
  }

  /** @internal */
  private _onConnOpen() {
    this._setConnectionState('connected')
    this.log('transport', `connected to ${this.endpointURL()}`)
    this.flushSendBuffer()
    this._clearTimer('reconnect')

    if (!this.worker) {
      this._startHeartbeat()
    } else {
      if (!this.workerRef) {
        this._startWorkerHeartbeat()
      }
    }

    this._triggerStateCallbacks('open')
  }
  /** @internal */
  private _startHeartbeat() {
    this.heartbeatTimer && clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs)
  }

  /** @internal */
  private _startWorkerHeartbeat() {
    if (this.workerUrl) {
      this.log('worker', `starting worker for from ${this.workerUrl}`)
    } else {
      this.log('worker', `starting default worker`)
    }
    const objectUrl = this._workerObjectUrl(this.workerUrl!)
    this.workerRef = new Worker(objectUrl)
    this.workerRef.onerror = (error) => {
      this.log('worker', 'worker error', (error as ErrorEvent).message)
      this.workerRef!.terminate()
    }
    this.workerRef.onmessage = (event) => {
      if (event.data.event === 'keepAlive') {
        this.sendHeartbeat()
      }
    }
    this.workerRef.postMessage({
      event: 'start',
      interval: this.heartbeatIntervalMs,
    })
  }
  /** @internal */
  private _onConnClose(event: any) {
    this._setConnectionState('disconnected')
    this.log('transport', 'close', event)
    this._triggerChanError()
    this._clearTimer('heartbeat')

    // Only schedule reconnection if it wasn't a manual disconnect
    if (!this._wasManualDisconnect) {
      this.reconnectTimer?.scheduleTimeout()
    }

    this._triggerStateCallbacks('close', event)
  }

  /** @internal */
  private _onConnError(error: Event) {
    this._setConnectionState('disconnected')
    this.log('transport', `${error}`)
    this._triggerChanError()
    this._triggerStateCallbacks('error', error)
  }

  /** @internal */
  private _triggerChanError() {
    this.channels.forEach((channel: RealtimeChannel) => channel._trigger(CHANNEL_EVENTS.error))
  }

  /** @internal */
  private _appendParams(url: string, params: { [key: string]: string }): string {
    if (Object.keys(params).length === 0) {
      return url
    }
    const prefix = url.match(/\?/) ? '&' : '?'
    const query = new URLSearchParams(params)
    return `${url}${prefix}${query}`
  }

  private _workerObjectUrl(url: string | undefined): string {
    let result_url: string
    if (url) {
      result_url = url
    } else {
      const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' })
      result_url = URL.createObjectURL(blob)
    }
    return result_url
  }

  /**
   * Set connection state with proper state management
   * @internal
   */
  private _setConnectionState(state: RealtimeClientState, manual = false): void {
    this._connectionState = state

    if (state === 'connecting') {
      this._wasManualDisconnect = false
    } else if (state === 'disconnecting') {
      this._wasManualDisconnect = manual
    }
  }

  /**
   * Perform the actual auth operation
   * @internal
   */
  private async _performAuth(token: string | null = null): Promise<void> {
    let tokenToSend: string | null

    if (token) {
      tokenToSend = token
    } else if (this.accessToken) {
      // Always call the accessToken callback to get fresh token
      tokenToSend = await this.accessToken()
    } else {
      tokenToSend = this.accessTokenValue
    }

    if (this.accessTokenValue != tokenToSend) {
      this.accessTokenValue = tokenToSend
      this.channels.forEach((channel) => {
        const payload = {
          access_token: tokenToSend,
          version: DEFAULT_VERSION,
        }

        tokenToSend && channel.updateJoinPayload(payload)

        if (channel.joinedOnce && channel._isJoined()) {
          channel._push(CHANNEL_EVENTS.access_token, {
            access_token: tokenToSend,
          })
        }
      })
    }
  }

  /**
   * Wait for any in-flight auth operations to complete
   * @internal
   */
  private async _waitForAuthIfNeeded(): Promise<void> {
    if (this._authPromise) {
      await this._authPromise
    }
  }

  /**
   * Safely call setAuth with standardized error handling
   * @internal
   */
  private _setAuthSafely(context = 'general'): void {
    this.setAuth().catch((e) => {
      this.log('error', `error setting auth in ${context}`, e)
    })
  }

  /**
   * Trigger state change callbacks with proper error handling
   * @internal
   */
  private _triggerStateCallbacks(event: keyof typeof this.stateChangeCallbacks, data?: any): void {
    try {
      this.stateChangeCallbacks[event].forEach((callback) => {
        try {
          callback(data)
        } catch (e) {
          this.log('error', `error in ${event} callback`, e)
        }
      })
    } catch (e) {
      this.log('error', `error triggering ${event} callbacks`, e)
    }
  }

  /**
   * Setup reconnection timer with proper configuration
   * @internal
   */
  private _setupReconnectionTimer(): void {
    this.reconnectTimer = new Timer(async () => {
      setTimeout(async () => {
        await this._waitForAuthIfNeeded()
        if (!this.isConnected()) {
          this.connect()
        }
      }, CONNECTION_TIMEOUTS.RECONNECT_DELAY)
    }, this.reconnectAfterMs)
  }

  /**
   * Initialize client options with defaults
   * @internal
   */
  private _initializeOptions(options?: RealtimeClientOptions): void {
    // Set defaults
    this.transport = options?.transport ?? null
    this.timeout = options?.timeout ?? DEFAULT_TIMEOUT
    this.heartbeatIntervalMs =
      options?.heartbeatIntervalMs ?? CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL
    this.worker = options?.worker ?? false
    this.accessToken = options?.accessToken ?? null
    this.heartbeatCallback = options?.heartbeatCallback ?? noop
    // Handle special cases
    if (options?.params) this.params = options.params
    if (options?.logger) this.logger = options.logger
    if (options?.logLevel || options?.log_level) {
      this.logLevel = options.logLevel || options.log_level
      this.params = { ...this.params, log_level: this.logLevel as string }
    }

    // Set up functions with defaults
    this.reconnectAfterMs =
      options?.reconnectAfterMs ??
      ((tries: number) => {
        return RECONNECT_INTERVALS[tries - 1] || DEFAULT_RECONNECT_FALLBACK
      })

    this.encode =
      options?.encode ??
      ((payload: JSON, callback: Function) => {
        return callback(JSON.stringify(payload))
      })

    this.decode = options?.decode ?? this.serializer.decode.bind(this.serializer)

    // Handle worker setup
    if (this.worker) {
      if (typeof window !== 'undefined' && !window.Worker) {
        throw new Error('Web Worker is not supported')
      }
      this.workerUrl = options?.workerUrl
    }
  }
}
