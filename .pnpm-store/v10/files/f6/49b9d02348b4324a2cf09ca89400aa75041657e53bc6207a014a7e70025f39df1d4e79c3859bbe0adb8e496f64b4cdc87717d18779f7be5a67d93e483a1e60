"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentLiveClient = void 0;
const constants_1 = require("../lib/constants");
const AgentEvents_1 = require("../lib/enums/AgentEvents");
const errors_1 = require("../lib/errors");
const AbstractLiveClient_1 = require("./AbstractLiveClient");
class AgentLiveClient extends AbstractLiveClient_1.AbstractLiveClient {
    constructor(options, endpoint = "/:version/agent/converse") {
        var _a, _b, _c, _d;
        super(options);
        this.namespace = "agent";
        this.baseUrl = (_d = (_c = (_b = (_a = options.agent) === null || _a === void 0 ? void 0 : _a.websocket) === null || _b === void 0 ? void 0 : _b.options) === null || _c === void 0 ? void 0 : _c.url) !== null && _d !== void 0 ? _d : constants_1.DEFAULT_AGENT_URL;
        this.connect({}, endpoint);
    }
    /**
     * Sets up the connection event handlers.
     * This method is responsible for handling the various events that can occur on the WebSocket connection, such as opening, closing, and receiving messages.
     * - When the connection is opened, it emits the `AgentEvents.Open` event.
     * - When the connection is closed, it emits the `AgentEvents.Close` event.
     * - When an error occurs on the connection, it emits the `AgentEvents.Error` event.
     * - When a message is received, it parses the message and emits the appropriate event based on the message type.
     */
    setupConnection() {
        if (this.conn) {
            this.conn.onopen = () => {
                this.emit(AgentEvents_1.AgentEvents.Open, this);
            };
            this.conn.onclose = (event) => {
                this.emit(AgentEvents_1.AgentEvents.Close, event);
            };
            this.conn.onerror = (event) => {
                this.emit(AgentEvents_1.AgentEvents.Error, event);
            };
            this.conn.onmessage = (event) => {
                this.handleMessage(event);
            };
        }
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
                this.emit(AgentEvents_1.AgentEvents.Error, {
                    event,
                    data: event.data,
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
            this.emit(AgentEvents_1.AgentEvents.Error, {
                event,
                message: "Received unknown data type.",
            });
        }
    }
    /**
     * Handles binary messages received from the WebSocket connection.
     * @param data - The binary data.
     */
    handleBinaryMessage(data) {
        this.emit(AgentEvents_1.AgentEvents.Audio, data);
    }
    /**
     * Handles text messages received from the WebSocket connection.
     * @param data - The parsed JSON data.
     */
    handleTextMessage(data) {
        if (data.type in AgentEvents_1.AgentEvents) {
            this.emit(data.type, data);
        }
        else {
            this.emit(AgentEvents_1.AgentEvents.Unhandled, data);
        }
    }
    /**
     * To be called with your model configuration BEFORE sending
     * any audio data.
     * @param options - The SettingsConfiguration object.
     */
    configure(options) {
        var _a, _b, _c;
        if (!((_a = options.agent.listen) === null || _a === void 0 ? void 0 : _a.provider.model.startsWith("nova-3")) &&
            ((_c = (_b = options.agent.listen) === null || _b === void 0 ? void 0 : _b.provider.keyterms) === null || _c === void 0 ? void 0 : _c.length)) {
            throw new errors_1.DeepgramError("Keyterms are only supported with the Nova 3 models.");
        }
        const string = JSON.stringify(Object.assign({ type: "Settings" }, options));
        this.send(string);
    }
    /**
     * Provide new system prompt to the LLM.
     * @param prompt - The system prompt to provide.
     */
    updatePrompt(prompt) {
        this.send(JSON.stringify({ type: "UpdatePrompt", prompt }));
    }
    /**
     * Change the speak model.
     * @param model - The new model to use.
     */
    updateSpeak(speakConfig) {
        this.send(JSON.stringify({ type: "UpdateSpeak", speak: speakConfig }));
    }
    /**
     * Immediately trigger an agent message. If this message
     * is sent while the user is speaking, or while the server is in the
     * middle of sending audio, then the request will be ignored and an InjectionRefused
     * event will be emitted.
     * @example "Hold on while I look that up for you."
     * @example "Are you still on the line?"
     * @param content - The message to speak.
     */
    injectAgentMessage(content) {
        this.send(JSON.stringify({ type: "InjectAgentMessage", content }));
    }
    /**
     * Respond to a function call request.
     * @param response  - The response to the function call request.
     */
    functionCallResponse(response) {
        this.send(JSON.stringify(Object.assign({ type: "FunctionCallResponse" }, response)));
    }
    /**
     * Send a keepalive to avoid closing the websocket while you
     * are not transmitting audio. This should be sent at least
     * every 8 seconds.
     */
    keepAlive() {
        this.send(JSON.stringify({ type: "KeepAlive" }));
    }
}
exports.AgentLiveClient = AgentLiveClient;
//# sourceMappingURL=AgentLiveClient.js.map