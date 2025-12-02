import { AbstractLiveClient } from "./AbstractLiveClient";
import { LiveTranscriptionEvents } from "../lib/enums";
import type { LiveSchema, LiveConfigOptions, DeepgramClientOptions } from "../lib/types";
import { DeepgramError } from "../lib/errors";

/**
 * The `ListenLiveClient` class extends the `AbstractLiveClient` class and provides functionality for setting up and managing a WebSocket connection for live transcription.
 *
 * The constructor takes in `DeepgramClientOptions` and an optional `LiveSchema` object, as well as an optional `endpoint` string. It then calls the `connect` method of the parent `AbstractLiveClient` class to establish the WebSocket connection.
 *
 * The `setupConnection` method is responsible for handling the various events that can occur on the WebSocket connection, such as opening, closing, and receiving messages. It sets up event handlers for these events and emits the appropriate events based on the message type.
 *
 * The `configure` method allows you to send additional configuration options to the connected session, such as enabling numerals.
 *
 * The `keepAlive` method sends a "KeepAlive" message to the server to maintain the connection.
 *
 * The `requestClose` method requests the server to close the connection.
 *
 * The `finish` method is deprecated as of version 3.4 and will be removed in version 4.0. Use `requestClose` instead.
 */
export class ListenLiveClient extends AbstractLiveClient {
  public namespace: string = "listen";

  /**
   * Constructs a new `ListenLiveClient` instance with the provided options.
   *
   * @param options - The `DeepgramClientOptions` to use for the client connection.
   * @param transcriptionOptions - An optional `LiveSchema` object containing additional configuration options for the live transcription.
   * @param endpoint - An optional string representing the WebSocket endpoint to connect to. Defaults to `:version/listen`.
   */
  constructor(
    options: DeepgramClientOptions,
    transcriptionOptions: LiveSchema = {},
    endpoint: string = ":version/listen"
  ) {
    super(options);

    if (transcriptionOptions.keyterm?.length && !transcriptionOptions.model?.startsWith("nova-3")) {
      throw new DeepgramError("Keyterms are only supported with the Nova 3 models.");
    }

    this.connect(transcriptionOptions, endpoint);
  }

  /**
   * Sets up the connection event handlers.
   * This method is responsible for handling the various events that can occur on the WebSocket connection, such as opening, closing, and receiving messages.
   * - When the connection is opened, it emits the `LiveTranscriptionEvents.Open` event.
   * - When the connection is closed, it emits the `LiveTranscriptionEvents.Close` event.
   * - When an error occurs on the connection, it emits the `LiveTranscriptionEvents.Error` event.
   * - When a message is received, it parses the message and emits the appropriate event based on the message type, such as `LiveTranscriptionEvents.Metadata`, `LiveTranscriptionEvents.Transcript`, `LiveTranscriptionEvents.UtteranceEnd`, and `LiveTranscriptionEvents.SpeechStarted`.
   */
  public setupConnection(): void {
    if (this.conn) {
      this.conn.onopen = () => {
        this.emit(LiveTranscriptionEvents.Open, this);
      };

      this.conn.onclose = (event: any) => {
        this.emit(LiveTranscriptionEvents.Close, event);
      };

      this.conn.onerror = (event: ErrorEvent) => {
        this.emit(LiveTranscriptionEvents.Error, event);
      };

      this.conn.onmessage = (event: MessageEvent) => {
        try {
          const data: any = JSON.parse(event.data.toString());

          if (data.type === LiveTranscriptionEvents.Metadata) {
            this.emit(LiveTranscriptionEvents.Metadata, data);
          } else if (data.type === LiveTranscriptionEvents.Transcript) {
            this.emit(LiveTranscriptionEvents.Transcript, data);
          } else if (data.type === LiveTranscriptionEvents.UtteranceEnd) {
            this.emit(LiveTranscriptionEvents.UtteranceEnd, data);
          } else if (data.type === LiveTranscriptionEvents.SpeechStarted) {
            this.emit(LiveTranscriptionEvents.SpeechStarted, data);
          } else {
            this.emit(LiveTranscriptionEvents.Unhandled, data);
          }
        } catch (error) {
          this.emit(LiveTranscriptionEvents.Error, {
            event,
            message: "Unable to parse `data` as JSON.",
            error,
          });
        }
      };
    }
  }

  /**
   * Sends additional config to the connected session.
   *
   * @param config - The configuration options to apply to the LiveClient.
   * @param config.numerals - We currently only support numerals.
   */
  public configure(config: LiveConfigOptions): void {
    this.send(
      JSON.stringify({
        type: "Configure",
        processors: config,
      })
    );
  }

  /**
   * Sends a "KeepAlive" message to the server to maintain the connection.
   */
  public keepAlive(): void {
    this.send(
      JSON.stringify({
        type: "KeepAlive",
      })
    );
  }

  /**
   * Sends a "Finalize" message to flush any transcription sitting in the server's buffer.
   */
  public finalize(): void {
    this.send(
      JSON.stringify({
        type: "Finalize",
      })
    );
  }

  /**
   * @deprecated Since version 3.4. Will be removed in version 4.0. Use `requestClose` instead.
   */
  public finish(): void {
    this.requestClose();
  }

  /**
   * Requests the server close the connection.
   */
  public requestClose(): void {
    this.send(
      JSON.stringify({
        type: "CloseStream",
      })
    );
  }
}

export { ListenLiveClient as LiveClient };
