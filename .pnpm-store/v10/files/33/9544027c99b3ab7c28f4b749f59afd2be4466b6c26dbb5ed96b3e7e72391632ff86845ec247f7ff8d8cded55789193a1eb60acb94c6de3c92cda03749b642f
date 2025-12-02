import { AbstractLiveClient } from "./AbstractLiveClient";
import { LiveTTSEvents } from "../lib/enums";
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
export class SpeakLiveClient extends AbstractLiveClient {
    /**
     * Constructs a new `SpeakLiveClient` instance with the provided options.
     *
     * @param options - The `DeepgramClientOptions` to use for the client connection.
     * @param speakOptions - An optional `SpeakSchema` object containing additional configuration options for the text-to-speech.
     * @param endpoint - An optional string representing the WebSocket endpoint to connect to. Defaults to `:version/speak`.
     */
    constructor(options, speakOptions = {}, endpoint = ":version/speak") {
        super(options);
        this.namespace = "speak";
        this.connect(speakOptions, endpoint);
    }
    /**
     * Sets up the connection event handlers.
     * This method is responsible for handling the various events that can occur on the WebSocket connection, such as opening, closing, and receiving data.
     * - When the connection is opened, it emits the `LiveTTSEvents.Open` event.
     * - When the connection is closed, it emits the `LiveTTSEvents.Close` event.
     * - When an error occurs on the connection, it emits the `LiveTTSEvents.Error` event.
     * - When a message is received, it parses the message and emits the appropriate event based on the message type, such as `LiveTTSEvents.Metadata`, `LiveTTSEvents.Flushed`, and `LiveTTSEvents.Warning`.
     */
    setupConnection() {
        if (this.conn) {
            this.conn.onopen = () => {
                this.emit(LiveTTSEvents.Open, this);
            };
            this.conn.onclose = (event) => {
                this.emit(LiveTTSEvents.Close, event);
            };
            this.conn.onerror = (event) => {
                this.emit(LiveTTSEvents.Error, event);
            };
            this.conn.onmessage = (event) => {
                this.handleMessage(event);
            };
        }
    }
    /**
     * Handles text messages received from the WebSocket connection.
     * @param data - The parsed JSON data.
     */
    handleTextMessage(data) {
        if (data.type === LiveTTSEvents.Metadata) {
            this.emit(LiveTTSEvents.Metadata, data);
        }
        else if (data.type === LiveTTSEvents.Flushed) {
            this.emit(LiveTTSEvents.Flushed, data);
        }
        else if (data.type === LiveTTSEvents.Warning) {
            this.emit(LiveTTSEvents.Warning, data);
        }
        else {
            this.emit(LiveTTSEvents.Unhandled, data);
        }
    }
    /**
     * Handles binary messages received from the WebSocket connection.
     * @param data - The binary data.
     */
    handleBinaryMessage(data) {
        this.emit(LiveTTSEvents.Audio, data);
    }
    /**
     * Sends a text input message to the server.
     *
     * @param {string} text - The text to convert to speech.
     */
    sendText(text) {
        this.send(JSON.stringify({
            type: "Speak",
            text,
        }));
    }
    /**
     * Requests the server flush the current buffer and return generated audio.
     */
    flush() {
        this.send(JSON.stringify({
            type: "Flush",
        }));
    }
    /**
     * Requests the server clear the current buffer.
     */
    clear() {
        this.send(JSON.stringify({
            type: "Clear",
        }));
    }
    /**
     * Requests the server close the connection.
     */
    requestClose() {
        this.send(JSON.stringify({
            type: "Close",
        }));
    }
    /**
     * Handles incoming messages from the WebSocket connection.
     * @param event - The MessageEvent object representing the received message.
     */
    handleMessage(event) {
        if (typeof event.data === "string") {
            try {
                const data = JSON.parse(event.data);
                this.handleTextMessage(data);
            }
            catch (error) {
                this.emit(LiveTTSEvents.Error, {
                    event,
                    message: "Unable to parse `data` as JSON.",
                    error,
                });
            }
        }
        else if (event.data instanceof Blob) {
            event.data.arrayBuffer().then((buffer) => {
                this.handleBinaryMessage(Buffer.from(buffer));
            });
        }
        else if (event.data instanceof ArrayBuffer) {
            this.handleBinaryMessage(Buffer.from(event.data));
        }
        else if (Buffer.isBuffer(event.data)) {
            this.handleBinaryMessage(event.data);
        }
        else {
            console.log("Received unknown data type", event.data);
            this.emit(LiveTTSEvents.Error, {
                event,
                message: "Received unknown data type.",
            });
        }
    }
}
//# sourceMappingURL=SpeakLiveClient.js.map