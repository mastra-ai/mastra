/// <reference types="node" />
import { AbstractLiveClient } from "./AbstractLiveClient";
import type { SpeakSchema, DeepgramClientOptions } from "../lib/types";
/**
 * The `SpeakLiveClient` class extends the `AbstractLiveClient` class and provides functionality for setting up and managing a WebSocket connection for live text-to-speech synthesis.
 *
 * The constructor takes in `DeepgramClientOptions` and an optional `SpeakSchema` object, as well as an optional `endpoint` string. It then calls the `connect` method of the parent `AbstractLiveClient` class to establish the WebSocket connection.
 *
 * The `setupConnection` method is responsible for handling the various events that can occur on the WebSocket connection, such as opening, closing, and receiving messages. It sets up event handlers for these events and emits the appropriate events based on the message type.
 *
 * The `configure` method allows you to send additional configuration options to the connected session.
 *
 * The `requestClose` method requests the server to close the connection.
 */
export declare class SpeakLiveClient extends AbstractLiveClient {
    namespace: string;
    /**
     * Constructs a new `SpeakLiveClient` instance with the provided options.
     *
     * @param options - The `DeepgramClientOptions` to use for the client connection.
     * @param speakOptions - An optional `SpeakSchema` object containing additional configuration options for the text-to-speech.
     * @param endpoint - An optional string representing the WebSocket endpoint to connect to. Defaults to `:version/speak`.
     */
    constructor(options: DeepgramClientOptions, speakOptions?: Omit<SpeakSchema, "container">, endpoint?: string);
    /**
     * Sets up the connection event handlers.
     * This method is responsible for handling the various events that can occur on the WebSocket connection, such as opening, closing, and receiving data.
     * - When the connection is opened, it emits the `LiveTTSEvents.Open` event.
     * - When the connection is closed, it emits the `LiveTTSEvents.Close` event.
     * - When an error occurs on the connection, it emits the `LiveTTSEvents.Error` event.
     * - When a message is received, it parses the message and emits the appropriate event based on the message type, such as `LiveTTSEvents.Metadata`, `LiveTTSEvents.Flushed`, and `LiveTTSEvents.Warning`.
     */
    setupConnection(): void;
    /**
     * Handles text messages received from the WebSocket connection.
     * @param data - The parsed JSON data.
     */
    protected handleTextMessage(data: any): void;
    /**
     * Handles binary messages received from the WebSocket connection.
     * @param data - The binary data.
     */
    protected handleBinaryMessage(data: Buffer): void;
    /**
     * Sends a text input message to the server.
     *
     * @param {string} text - The text to convert to speech.
     */
    sendText(text: string): void;
    /**
     * Requests the server flush the current buffer and return generated audio.
     */
    flush(): void;
    /**
     * Requests the server clear the current buffer.
     */
    clear(): void;
    /**
     * Requests the server close the connection.
     */
    requestClose(): void;
    /**
     * Handles incoming messages from the WebSocket connection.
     * @param event - The MessageEvent object representing the received message.
     */
    protected handleMessage(event: MessageEvent): void;
}
//# sourceMappingURL=SpeakLiveClient.d.ts.map