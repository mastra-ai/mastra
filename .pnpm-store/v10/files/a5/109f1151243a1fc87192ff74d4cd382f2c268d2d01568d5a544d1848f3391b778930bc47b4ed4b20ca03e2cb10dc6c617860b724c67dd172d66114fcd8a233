/**
 * Enumeration of events related to live text-to-speech synthesis.
 *
 * - `Open`: Built-in socket event for when the connection is opened.
 * - `Close`: Built-in socket event for when the connection is closed.
 * - `Error`: Built-in socket event for when an error occurs.
 * - `Metadata`: Event for when metadata is received.
 * - `Flushed`: Event for when the server has flushed the buffer.
 * - `Warning`: Event for when a warning is received.
 * - `Unhandled`: Catch-all event for any other message event.
 */
export enum LiveTTSEvents {
  /**
   * Built in socket events.
   */
  Open = "Open",
  Close = "Close",
  Error = "Error",

  /**
   * Message { type: string }
   */
  Metadata = "Metadata",
  Flushed = "Flushed",
  Warning = "Warning",

  /**
   * Audio data event.
   */
  Audio = "Audio",

  /**
   * Catch all for any other message event
   */
  Unhandled = "Unhandled",
}
