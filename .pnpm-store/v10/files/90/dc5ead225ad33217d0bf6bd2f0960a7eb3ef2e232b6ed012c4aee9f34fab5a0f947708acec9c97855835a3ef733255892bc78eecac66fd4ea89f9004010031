"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveClient = exports.ListenLiveClient = void 0;
const AbstractLiveClient_1 = require("./AbstractLiveClient");
const enums_1 = require("../lib/enums");
const errors_1 = require("../lib/errors");
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
class ListenLiveClient extends AbstractLiveClient_1.AbstractLiveClient {
    /**
     * Constructs a new `ListenLiveClient` instance with the provided options.
     *
     * @param options - The `DeepgramClientOptions` to use for the client connection.
     * @param transcriptionOptions - An optional `LiveSchema` object containing additional configuration options for the live transcription.
     * @param endpoint - An optional string representing the WebSocket endpoint to connect to. Defaults to `:version/listen`.
     */
    constructor(options, transcriptionOptions = {}, endpoint = ":version/listen") {
        var _a, _b;
        super(options);
        this.namespace = "listen";
        if (((_a = transcriptionOptions.keyterm) === null || _a === void 0 ? void 0 : _a.length) && !((_b = transcriptionOptions.model) === null || _b === void 0 ? void 0 : _b.startsWith("nova-3"))) {
            throw new errors_1.DeepgramError("Keyterms are only supported with the Nova 3 models.");
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
    setupConnection() {
        if (this.conn) {
            this.conn.onopen = () => {
                this.emit(enums_1.LiveTranscriptionEvents.Open, this);
            };
            this.conn.onclose = (event) => {
                this.emit(enums_1.LiveTranscriptionEvents.Close, event);
            };
            this.conn.onerror = (event) => {
                this.emit(enums_1.LiveTranscriptionEvents.Error, event);
            };
            this.conn.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data.toString());
                    if (data.type === enums_1.LiveTranscriptionEvents.Metadata) {
                        this.emit(enums_1.LiveTranscriptionEvents.Metadata, data);
                    }
                    else if (data.type === enums_1.LiveTranscriptionEvents.Transcript) {
                        this.emit(enums_1.LiveTranscriptionEvents.Transcript, data);
                    }
                    else if (data.type === enums_1.LiveTranscriptionEvents.UtteranceEnd) {
                        this.emit(enums_1.LiveTranscriptionEvents.UtteranceEnd, data);
                    }
                    else if (data.type === enums_1.LiveTranscriptionEvents.SpeechStarted) {
                        this.emit(enums_1.LiveTranscriptionEvents.SpeechStarted, data);
                    }
                    else {
                        this.emit(enums_1.LiveTranscriptionEvents.Unhandled, data);
                    }
                }
                catch (error) {
                    this.emit(enums_1.LiveTranscriptionEvents.Error, {
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
    configure(config) {
        this.send(JSON.stringify({
            type: "Configure",
            processors: config,
        }));
    }
    /**
     * Sends a "KeepAlive" message to the server to maintain the connection.
     */
    keepAlive() {
        this.send(JSON.stringify({
            type: "KeepAlive",
        }));
    }
    /**
     * Sends a "Finalize" message to flush any transcription sitting in the server's buffer.
     */
    finalize() {
        this.send(JSON.stringify({
            type: "Finalize",
        }));
    }
    /**
     * @deprecated Since version 3.4. Will be removed in version 4.0. Use `requestClose` instead.
     */
    finish() {
        this.requestClose();
    }
    /**
     * Requests the server close the connection.
     */
    requestClose() {
        this.send(JSON.stringify({
            type: "CloseStream",
        }));
    }
}
exports.ListenLiveClient = ListenLiveClient;
exports.LiveClient = ListenLiveClient;
//# sourceMappingURL=ListenLiveClient.js.map