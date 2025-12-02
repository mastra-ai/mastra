/**
 * Enumeration of events related to live transcription.
 *
 * - `Open`: Built-in socket event for when the connection is opened.
 * - `Close`: Built-in socket event for when the connection is closed.
 * - `Error`: Built-in socket event for when an error occurs.
 * - `Transcript`: Event for when a transcript message is received.
 * - `Metadata`: Event for when metadata is received.
 * - `UtteranceEnd`: Event for when an utterance ends.
 * - `SpeechStarted`: Event for when speech is detected.
 * - `Unhandled`: Catch-all event for any other message event.
 */
export enum LiveTranscriptionEvents {
  /**
   * Built in socket events.
   */
  Open = "open",
  Close = "close",
  Error = "error",

  /**
   * Message { type: string }
   */
  Transcript = "Results",
  Metadata = "Metadata",
  UtteranceEnd = "UtteranceEnd",
  SpeechStarted = "SpeechStarted",

  /**
   * Catch all for any other message event
   */
  Unhandled = "Unhandled",
}
