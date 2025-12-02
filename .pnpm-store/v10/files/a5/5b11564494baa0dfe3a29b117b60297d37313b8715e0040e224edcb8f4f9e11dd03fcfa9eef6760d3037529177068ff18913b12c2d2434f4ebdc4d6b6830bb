import { CHANNEL_EVENTS, CHANNEL_STATES, MAX_PUSH_BUFFER_SIZE } from './lib/constants'
import Push from './lib/push'
import type RealtimeClient from './RealtimeClient'
import Timer from './lib/timer'
import RealtimePresence, { REALTIME_PRESENCE_LISTEN_EVENTS } from './RealtimePresence'
import type {
  RealtimePresenceJoinPayload,
  RealtimePresenceLeavePayload,
  RealtimePresenceState,
} from './RealtimePresence'
import * as Transformers from './lib/transformers'
import { httpEndpointURL } from './lib/transformers'

type ReplayOption = {
  since: number
  limit?: number
}

export type RealtimeChannelOptions = {
  config: {
    /**
     * self option enables client to receive message it broadcast
     * ack option instructs server to acknowledge that broadcast message was received
     * replay option instructs server to replay broadcast messages
     */
    broadcast?: { self?: boolean; ack?: boolean; replay?: ReplayOption }
    /**
     * key option is used to track presence payload across clients
     */
    presence?: { key?: string; enabled?: boolean }
    /**
     * defines if the channel is private or not and if RLS policies will be used to check data
     */
    private?: boolean
  }
}

type RealtimeChangesPayloadBase = {
  schema: string
  table: string
}

type RealtimeBroadcastChangesPayloadBase = RealtimeChangesPayloadBase & {
  id: string
}

export type RealtimeBroadcastInsertPayload<T extends { [key: string]: any }> =
  RealtimeBroadcastChangesPayloadBase & {
    operation: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT}`
    record: T
    old_record: null
  }

export type RealtimeBroadcastUpdatePayload<T extends { [key: string]: any }> =
  RealtimeBroadcastChangesPayloadBase & {
    operation: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE}`
    record: T
    old_record: T
  }

export type RealtimeBroadcastDeletePayload<T extends { [key: string]: any }> =
  RealtimeBroadcastChangesPayloadBase & {
    operation: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE}`
    record: null
    old_record: T
  }

export type RealtimeBroadcastPayload<T extends { [key: string]: any }> =
  | RealtimeBroadcastInsertPayload<T>
  | RealtimeBroadcastUpdatePayload<T>
  | RealtimeBroadcastDeletePayload<T>

type RealtimePostgresChangesPayloadBase = {
  schema: string
  table: string
  commit_timestamp: string
  errors: string[]
}

export type RealtimePostgresInsertPayload<T extends { [key: string]: any }> =
  RealtimePostgresChangesPayloadBase & {
    eventType: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT}`
    new: T
    old: {}
  }

export type RealtimePostgresUpdatePayload<T extends { [key: string]: any }> =
  RealtimePostgresChangesPayloadBase & {
    eventType: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE}`
    new: T
    old: Partial<T>
  }

export type RealtimePostgresDeletePayload<T extends { [key: string]: any }> =
  RealtimePostgresChangesPayloadBase & {
    eventType: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE}`
    new: {}
    old: Partial<T>
  }

export type RealtimePostgresChangesPayload<T extends { [key: string]: any }> =
  | RealtimePostgresInsertPayload<T>
  | RealtimePostgresUpdatePayload<T>
  | RealtimePostgresDeletePayload<T>

export type RealtimePostgresChangesFilter<T extends `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT}`> = {
  /**
   * The type of database change to listen to.
   */
  event: T
  /**
   * The database schema to listen to.
   */
  schema: string
  /**
   * The database table to listen to.
   */
  table?: string
  /**
   * Receive database changes when filter is matched.
   */
  filter?: string
}

export type RealtimeChannelSendResponse = 'ok' | 'timed out' | 'error'

export enum REALTIME_POSTGRES_CHANGES_LISTEN_EVENT {
  ALL = '*',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum REALTIME_LISTEN_TYPES {
  BROADCAST = 'broadcast',
  PRESENCE = 'presence',
  POSTGRES_CHANGES = 'postgres_changes',
  SYSTEM = 'system',
}

export enum REALTIME_SUBSCRIBE_STATES {
  SUBSCRIBED = 'SUBSCRIBED',
  TIMED_OUT = 'TIMED_OUT',
  CLOSED = 'CLOSED',
  CHANNEL_ERROR = 'CHANNEL_ERROR',
}

export const REALTIME_CHANNEL_STATES = CHANNEL_STATES

interface PostgresChangesFilters {
  postgres_changes: {
    id: string
    event: string
    schema?: string
    table?: string
    filter?: string
  }[]
}
/** A channel is the basic building block of Realtime
 * and narrows the scope of data flow to subscribed clients.
 * You can think of a channel as a chatroom where participants are able to see who's online
 * and send and receive messages.
 */
export default class RealtimeChannel {
  bindings: {
    [key: string]: {
      type: string
      filter: { [key: string]: any }
      callback: Function
      id?: string
    }[]
  } = {}
  timeout: number
  state: CHANNEL_STATES = CHANNEL_STATES.closed
  joinedOnce = false
  joinPush: Push
  rejoinTimer: Timer
  pushBuffer: Push[] = []
  presence: RealtimePresence
  broadcastEndpointURL: string
  subTopic: string
  private: boolean

  constructor(
    /** Topic name can be any string. */
    public topic: string,
    public params: RealtimeChannelOptions = { config: {} },
    public socket: RealtimeClient
  ) {
    this.subTopic = topic.replace(/^realtime:/i, '')
    this.params.config = {
      ...{
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: false,
      },
      ...params.config,
    }
    this.timeout = this.socket.timeout
    this.joinPush = new Push(this, CHANNEL_EVENTS.join, this.params, this.timeout)
    this.rejoinTimer = new Timer(() => this._rejoinUntilConnected(), this.socket.reconnectAfterMs)
    this.joinPush.receive('ok', () => {
      this.state = CHANNEL_STATES.joined
      this.rejoinTimer.reset()
      this.pushBuffer.forEach((pushEvent: Push) => pushEvent.send())
      this.pushBuffer = []
    })
    this._onClose(() => {
      this.rejoinTimer.reset()
      this.socket.log('channel', `close ${this.topic} ${this._joinRef()}`)
      this.state = CHANNEL_STATES.closed
      this.socket._remove(this)
    })
    this._onError((reason: string) => {
      if (this._isLeaving() || this._isClosed()) {
        return
      }
      this.socket.log('channel', `error ${this.topic}`, reason)
      this.state = CHANNEL_STATES.errored
      this.rejoinTimer.scheduleTimeout()
    })
    this.joinPush.receive('timeout', () => {
      if (!this._isJoining()) {
        return
      }
      this.socket.log('channel', `timeout ${this.topic}`, this.joinPush.timeout)
      this.state = CHANNEL_STATES.errored
      this.rejoinTimer.scheduleTimeout()
    })

    this.joinPush.receive('error', (reason: any) => {
      if (this._isLeaving() || this._isClosed()) {
        return
      }
      this.socket.log('channel', `error ${this.topic}`, reason)
      this.state = CHANNEL_STATES.errored
      this.rejoinTimer.scheduleTimeout()
    })
    this._on(CHANNEL_EVENTS.reply, {}, (payload: any, ref: string) => {
      this._trigger(this._replyEventName(ref), payload)
    })

    this.presence = new RealtimePresence(this)

    this.broadcastEndpointURL = httpEndpointURL(this.socket.endPoint)
    this.private = this.params.config.private || false

    if (!this.private && this.params.config?.broadcast?.replay) {
      throw `tried to use replay on public channel '${this.topic}'. It must be a private channel.`
    }
  }

  /** Subscribe registers your client with the server */
  subscribe(
    callback?: (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void,
    timeout = this.timeout
  ): RealtimeChannel {
    if (!this.socket.isConnected()) {
      this.socket.connect()
    }
    if (this.state == CHANNEL_STATES.closed) {
      const {
        config: { broadcast, presence, private: isPrivate },
      } = this.params

      const postgres_changes = this.bindings.postgres_changes?.map((r) => r.filter) ?? []

      const presence_enabled =
        (!!this.bindings[REALTIME_LISTEN_TYPES.PRESENCE] &&
          this.bindings[REALTIME_LISTEN_TYPES.PRESENCE].length > 0) ||
        this.params.config.presence?.enabled === true
      const accessTokenPayload: { access_token?: string } = {}
      const config = {
        broadcast,
        presence: { ...presence, enabled: presence_enabled },
        postgres_changes,
        private: isPrivate,
      }

      if (this.socket.accessTokenValue) {
        accessTokenPayload.access_token = this.socket.accessTokenValue
      }

      this._onError((e: Error) => callback?.(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, e))

      this._onClose(() => callback?.(REALTIME_SUBSCRIBE_STATES.CLOSED))

      this.updateJoinPayload({ ...{ config }, ...accessTokenPayload })

      this.joinedOnce = true
      this._rejoin(timeout)

      this.joinPush
        .receive('ok', async ({ postgres_changes }: PostgresChangesFilters) => {
          this.socket.setAuth()
          if (postgres_changes === undefined) {
            callback?.(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED)
            return
          } else {
            const clientPostgresBindings = this.bindings.postgres_changes
            const bindingsLen = clientPostgresBindings?.length ?? 0
            const newPostgresBindings = []

            for (let i = 0; i < bindingsLen; i++) {
              const clientPostgresBinding = clientPostgresBindings[i]
              const {
                filter: { event, schema, table, filter },
              } = clientPostgresBinding
              const serverPostgresFilter = postgres_changes && postgres_changes[i]

              if (
                serverPostgresFilter &&
                serverPostgresFilter.event === event &&
                serverPostgresFilter.schema === schema &&
                serverPostgresFilter.table === table &&
                serverPostgresFilter.filter === filter
              ) {
                newPostgresBindings.push({
                  ...clientPostgresBinding,
                  id: serverPostgresFilter.id,
                })
              } else {
                this.unsubscribe()
                this.state = CHANNEL_STATES.errored

                callback?.(
                  REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
                  new Error('mismatch between server and client bindings for postgres changes')
                )
                return
              }
            }

            this.bindings.postgres_changes = newPostgresBindings

            callback && callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED)
            return
          }
        })
        .receive('error', (error: { [key: string]: any }) => {
          this.state = CHANNEL_STATES.errored
          callback?.(
            REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
            new Error(JSON.stringify(Object.values(error).join(', ') || 'error'))
          )
          return
        })
        .receive('timeout', () => {
          callback?.(REALTIME_SUBSCRIBE_STATES.TIMED_OUT)
          return
        })
    }
    return this
  }

  presenceState<T extends { [key: string]: any } = {}>(): RealtimePresenceState<T> {
    return this.presence.state as RealtimePresenceState<T>
  }

  async track(
    payload: { [key: string]: any },
    opts: { [key: string]: any } = {}
  ): Promise<RealtimeChannelSendResponse> {
    return await this.send(
      {
        type: 'presence',
        event: 'track',
        payload,
      },
      opts.timeout || this.timeout
    )
  }

  async untrack(opts: { [key: string]: any } = {}): Promise<RealtimeChannelSendResponse> {
    return await this.send(
      {
        type: 'presence',
        event: 'untrack',
      },
      opts
    )
  }

  /**
   * Creates an event handler that listens to changes.
   */
  on(
    type: `${REALTIME_LISTEN_TYPES.PRESENCE}`,
    filter: { event: `${REALTIME_PRESENCE_LISTEN_EVENTS.SYNC}` },
    callback: () => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.PRESENCE}`,
    filter: { event: `${REALTIME_PRESENCE_LISTEN_EVENTS.JOIN}` },
    callback: (payload: RealtimePresenceJoinPayload<T>) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.PRESENCE}`,
    filter: { event: `${REALTIME_PRESENCE_LISTEN_EVENTS.LEAVE}` },
    callback: (payload: RealtimePresenceLeavePayload<T>) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`,
    filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL}`>,
    callback: (payload: RealtimePostgresChangesPayload<T>) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`,
    filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT}`>,
    callback: (payload: RealtimePostgresInsertPayload<T>) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`,
    filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE}`>,
    callback: (payload: RealtimePostgresUpdatePayload<T>) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`,
    filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE}`>,
    callback: (payload: RealtimePostgresDeletePayload<T>) => void
  ): RealtimeChannel
  /**
   * The following is placed here to display on supabase.com/docs/reference/javascript/subscribe.
   * @param type One of "broadcast", "presence", or "postgres_changes".
   * @param filter Custom object specific to the Realtime feature detailing which payloads to receive.
   * @param callback Function to be invoked when event handler is triggered.
   */
  on(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: string },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: string
      meta?: {
        replayed?: boolean
        id: string
      }
      [key: string]: any
    }) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: string },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: string
      meta?: {
        replayed?: boolean
        id: string
      }
      payload: T
    }) => void
  ): RealtimeChannel
  on<T extends Record<string, unknown>>(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL
      payload: RealtimeBroadcastPayload<T>
    }) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT
      payload: RealtimeBroadcastInsertPayload<T>
    }) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE
      payload: RealtimeBroadcastUpdatePayload<T>
    }) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE
      payload: RealtimeBroadcastDeletePayload<T>
    }) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.SYSTEM}`,
    filter: {},
    callback: (payload: any) => void
  ): RealtimeChannel
  on(
    type: `${REALTIME_LISTEN_TYPES}`,
    filter: { event: string; [key: string]: string },
    callback: (payload: any) => void
  ): RealtimeChannel {
    if (this.state === CHANNEL_STATES.joined && type === REALTIME_LISTEN_TYPES.PRESENCE) {
      this.socket.log(
        'channel',
        `resubscribe to ${this.topic} due to change in presence callbacks on joined channel`
      )
      this.unsubscribe().then(() => this.subscribe())
    }
    return this._on(type, filter, callback)
  }
  /**
   * Sends a broadcast message explicitly via REST API.
   *
   * This method always uses the REST API endpoint regardless of WebSocket connection state.
   * Useful when you want to guarantee REST delivery or when gradually migrating from implicit REST fallback.
   *
   * @param event The name of the broadcast event
   * @param payload Payload to be sent (required)
   * @param opts Options including timeout
   * @returns Promise resolving to object with success status, and error details if failed
   */
  async httpSend(
    event: string,
    payload: any,
    opts: { timeout?: number } = {}
  ): Promise<{ success: true } | { success: false; status: number; error: string }> {
    const authorization = this.socket.accessTokenValue
      ? `Bearer ${this.socket.accessTokenValue}`
      : ''

    if (payload === undefined || payload === null) {
      return Promise.reject('Payload is required for httpSend()')
    }

    const options = {
      method: 'POST',
      headers: {
        Authorization: authorization,
        apikey: this.socket.apiKey ? this.socket.apiKey : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic: this.subTopic,
            event,
            payload: payload,
            private: this.private,
          },
        ],
      }),
    }

    const response = await this._fetchWithTimeout(
      this.broadcastEndpointURL,
      options,
      opts.timeout ?? this.timeout
    )

    if (response.status === 202) {
      return { success: true }
    }

    let errorMessage = response.statusText
    try {
      const errorBody = await response.json()
      errorMessage = errorBody.error || errorBody.message || errorMessage
    } catch {}

    return Promise.reject(new Error(errorMessage))
  }

  /**
   * Sends a message into the channel.
   *
   * @param args Arguments to send to channel
   * @param args.type The type of event to send
   * @param args.event The name of the event being sent
   * @param args.payload Payload to be sent
   * @param opts Options to be used during the send process
   */
  async send(
    args: {
      type: 'broadcast' | 'presence' | 'postgres_changes'
      event: string
      payload?: any
      [key: string]: any
    },
    opts: { [key: string]: any } = {}
  ): Promise<RealtimeChannelSendResponse> {
    if (!this._canPush() && args.type === 'broadcast') {
      console.warn(
        'Realtime send() is automatically falling back to REST API. ' +
          'This behavior will be deprecated in the future. ' +
          'Please use httpSend() explicitly for REST delivery.'
      )

      const { event, payload: endpoint_payload } = args
      const authorization = this.socket.accessTokenValue
        ? `Bearer ${this.socket.accessTokenValue}`
        : ''
      const options = {
        method: 'POST',
        headers: {
          Authorization: authorization,
          apikey: this.socket.apiKey ? this.socket.apiKey : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              topic: this.subTopic,
              event,
              payload: endpoint_payload,
              private: this.private,
            },
          ],
        }),
      }

      try {
        const response = await this._fetchWithTimeout(
          this.broadcastEndpointURL,
          options,
          opts.timeout ?? this.timeout
        )

        await response.body?.cancel()
        return response.ok ? 'ok' : 'error'
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return 'timed out'
        } else {
          return 'error'
        }
      }
    } else {
      return new Promise((resolve) => {
        const push = this._push(args.type, args, opts.timeout || this.timeout)

        if (args.type === 'broadcast' && !this.params?.config?.broadcast?.ack) {
          resolve('ok')
        }

        push.receive('ok', () => resolve('ok'))
        push.receive('error', () => resolve('error'))
        push.receive('timeout', () => resolve('timed out'))
      })
    }
  }

  updateJoinPayload(payload: { [key: string]: any }): void {
    this.joinPush.updatePayload(payload)
  }

  /**
   * Leaves the channel.
   *
   * Unsubscribes from server events, and instructs channel to terminate on server.
   * Triggers onClose() hooks.
   *
   * To receive leave acknowledgements, use the a `receive` hook to bind to the server ack, ie:
   * channel.unsubscribe().receive("ok", () => alert("left!") )
   */
  unsubscribe(timeout = this.timeout): Promise<'ok' | 'timed out' | 'error'> {
    this.state = CHANNEL_STATES.leaving
    const onClose = () => {
      this.socket.log('channel', `leave ${this.topic}`)
      this._trigger(CHANNEL_EVENTS.close, 'leave', this._joinRef())
    }

    this.joinPush.destroy()

    let leavePush: Push | null = null

    return new Promise<RealtimeChannelSendResponse>((resolve) => {
      leavePush = new Push(this, CHANNEL_EVENTS.leave, {}, timeout)
      leavePush
        .receive('ok', () => {
          onClose()
          resolve('ok')
        })
        .receive('timeout', () => {
          onClose()
          resolve('timed out')
        })
        .receive('error', () => {
          resolve('error')
        })

      leavePush.send()
      if (!this._canPush()) {
        leavePush.trigger('ok', {})
      }
    }).finally(() => {
      leavePush?.destroy()
    })
  }
  /**
   * Teardown the channel.
   *
   * Destroys and stops related timers.
   */
  teardown() {
    this.pushBuffer.forEach((push: Push) => push.destroy())
    this.pushBuffer = []
    this.rejoinTimer.reset()
    this.joinPush.destroy()
    this.state = CHANNEL_STATES.closed
    this.bindings = {}
  }

  /** @internal */

  async _fetchWithTimeout(url: string, options: { [key: string]: any }, timeout: number) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    const response = await this.socket.fetch(url, {
      ...options,
      signal: controller.signal,
    })

    clearTimeout(id)

    return response
  }

  /** @internal */
  _push(event: string, payload: { [key: string]: any }, timeout = this.timeout) {
    if (!this.joinedOnce) {
      throw `tried to push '${event}' to '${this.topic}' before joining. Use channel.subscribe() before pushing events`
    }
    let pushEvent = new Push(this, event, payload, timeout)
    if (this._canPush()) {
      pushEvent.send()
    } else {
      this._addToPushBuffer(pushEvent)
    }

    return pushEvent
  }

  /** @internal */
  _addToPushBuffer(pushEvent: Push) {
    pushEvent.startTimeout()
    this.pushBuffer.push(pushEvent)

    // Enforce buffer size limit
    if (this.pushBuffer.length > MAX_PUSH_BUFFER_SIZE) {
      const removedPush = this.pushBuffer.shift()
      if (removedPush) {
        removedPush.destroy()
        this.socket.log(
          'channel',
          `discarded push due to buffer overflow: ${removedPush.event}`,
          removedPush.payload
        )
      }
    }
  }

  /**
   * Overridable message hook
   *
   * Receives all events for specialized message handling before dispatching to the channel callbacks.
   * Must return the payload, modified or unmodified.
   *
   * @internal
   */
  _onMessage(_event: string, payload: any, _ref?: string) {
    return payload
  }

  /** @internal */
  _isMember(topic: string): boolean {
    return this.topic === topic
  }

  /** @internal */
  _joinRef(): string {
    return this.joinPush.ref
  }

  /** @internal */
  _trigger(type: string, payload?: any, ref?: string) {
    const typeLower = type.toLocaleLowerCase()
    const { close, error, leave, join } = CHANNEL_EVENTS
    const events: string[] = [close, error, leave, join]
    if (ref && events.indexOf(typeLower) >= 0 && ref !== this._joinRef()) {
      return
    }
    let handledPayload = this._onMessage(typeLower, payload, ref)
    if (payload && !handledPayload) {
      throw 'channel onMessage callbacks must return the payload, modified or unmodified'
    }

    if (['insert', 'update', 'delete'].includes(typeLower)) {
      this.bindings.postgres_changes
        ?.filter((bind) => {
          return bind.filter?.event === '*' || bind.filter?.event?.toLocaleLowerCase() === typeLower
        })
        .map((bind) => bind.callback(handledPayload, ref))
    } else {
      this.bindings[typeLower]
        ?.filter((bind) => {
          if (['broadcast', 'presence', 'postgres_changes'].includes(typeLower)) {
            if ('id' in bind) {
              const bindId = bind.id
              const bindEvent = bind.filter?.event
              return (
                bindId &&
                payload.ids?.includes(bindId) &&
                (bindEvent === '*' ||
                  bindEvent?.toLocaleLowerCase() === payload.data?.type.toLocaleLowerCase())
              )
            } else {
              const bindEvent = bind?.filter?.event?.toLocaleLowerCase()
              return bindEvent === '*' || bindEvent === payload?.event?.toLocaleLowerCase()
            }
          } else {
            return bind.type.toLocaleLowerCase() === typeLower
          }
        })
        .map((bind) => {
          if (typeof handledPayload === 'object' && 'ids' in handledPayload) {
            const postgresChanges = handledPayload.data
            const { schema, table, commit_timestamp, type, errors } = postgresChanges
            const enrichedPayload = {
              schema: schema,
              table: table,
              commit_timestamp: commit_timestamp,
              eventType: type,
              new: {},
              old: {},
              errors: errors,
            }
            handledPayload = {
              ...enrichedPayload,
              ...this._getPayloadRecords(postgresChanges),
            }
          }
          bind.callback(handledPayload, ref)
        })
    }
  }

  /** @internal */
  _isClosed(): boolean {
    return this.state === CHANNEL_STATES.closed
  }

  /** @internal */
  _isJoined(): boolean {
    return this.state === CHANNEL_STATES.joined
  }

  /** @internal */
  _isJoining(): boolean {
    return this.state === CHANNEL_STATES.joining
  }

  /** @internal */
  _isLeaving(): boolean {
    return this.state === CHANNEL_STATES.leaving
  }

  /** @internal */
  _replyEventName(ref: string): string {
    return `chan_reply_${ref}`
  }

  /** @internal */
  _on(type: string, filter: { [key: string]: any }, callback: Function) {
    const typeLower = type.toLocaleLowerCase()
    const binding = {
      type: typeLower,
      filter: filter,
      callback: callback,
    }

    if (this.bindings[typeLower]) {
      this.bindings[typeLower].push(binding)
    } else {
      this.bindings[typeLower] = [binding]
    }

    return this
  }

  /** @internal */
  _off(type: string, filter: { [key: string]: any }) {
    const typeLower = type.toLocaleLowerCase()

    if (this.bindings[typeLower]) {
      this.bindings[typeLower] = this.bindings[typeLower].filter((bind) => {
        return !(
          bind.type?.toLocaleLowerCase() === typeLower &&
          RealtimeChannel.isEqual(bind.filter, filter)
        )
      })
    }
    return this
  }

  /** @internal */
  private static isEqual(obj1: { [key: string]: string }, obj2: { [key: string]: string }) {
    if (Object.keys(obj1).length !== Object.keys(obj2).length) {
      return false
    }

    for (const k in obj1) {
      if (obj1[k] !== obj2[k]) {
        return false
      }
    }

    return true
  }

  /** @internal */
  private _rejoinUntilConnected() {
    this.rejoinTimer.scheduleTimeout()
    if (this.socket.isConnected()) {
      this._rejoin()
    }
  }

  /**
   * Registers a callback that will be executed when the channel closes.
   *
   * @internal
   */
  private _onClose(callback: Function) {
    this._on(CHANNEL_EVENTS.close, {}, callback)
  }

  /**
   * Registers a callback that will be executed when the channel encounteres an error.
   *
   * @internal
   */
  private _onError(callback: Function) {
    this._on(CHANNEL_EVENTS.error, {}, (reason: string) => callback(reason))
  }

  /**
   * Returns `true` if the socket is connected and the channel has been joined.
   *
   * @internal
   */
  private _canPush(): boolean {
    return this.socket.isConnected() && this._isJoined()
  }

  /** @internal */
  private _rejoin(timeout = this.timeout): void {
    if (this._isLeaving()) {
      return
    }
    this.socket._leaveOpenTopic(this.topic)
    this.state = CHANNEL_STATES.joining
    this.joinPush.resend(timeout)
  }

  /** @internal */
  private _getPayloadRecords(payload: any) {
    const records = {
      new: {},
      old: {},
    }

    if (payload.type === 'INSERT' || payload.type === 'UPDATE') {
      records.new = Transformers.convertChangeData(payload.columns, payload.record)
    }

    if (payload.type === 'UPDATE' || payload.type === 'DELETE') {
      records.old = Transformers.convertChangeData(payload.columns, payload.old_record)
    }

    return records
  }
}
