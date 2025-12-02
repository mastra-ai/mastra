/**
 * A TransformStream that ingests a stream of strings and produces a stream of ParsedEvents.
 *
 * @example
 * ```
 * const eventStream =
 *   response.body
 *     .pipeThrough(new TextDecoderStream())
 *     .pipeThrough(new EventSourceParserStream())
 * ```
 * @public
 */
export declare class EventSourceParserStream extends TransformStream<string, ParsedEvent> {
  constructor()
}

/**
 * A parsed EventSource event
 *
 * @public
 */
export declare interface ParsedEvent {
  /**
   * Differentiates the type from reconnection intervals and other types of messages
   * Not to be confused with `event`.
   */
  type: 'event'
  /**
   * The event type sent from the server. Note that this differs from the browser `EventSource`
   * implementation in that browsers will default this to `message`, whereas this parser will
   * leave this as `undefined` if not explicitly declared.
   */
  event?: string
  /**
   * ID of the message, if any was provided by the server. Can be used by clients to keep the
   * last received message ID in sync when reconnecting.
   */
  id?: string
  /**
   * The data received for this message
   */
  data: string
}

export {}
