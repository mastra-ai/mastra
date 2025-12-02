/// <reference types="node" />
import type { AgentLiveSchema, DeepgramClientOptions, FunctionCallResponse } from "../lib/types";
import { AbstractLiveClient } from "./AbstractLiveClient";
export declare class AgentLiveClient extends AbstractLiveClient {
    namespace: string;
    constructor(options: DeepgramClientOptions, endpoint?: string);
    /**
     * Sets up the connection event handlers.
     * This method is responsible for handling the various events that can occur on the WebSocket connection, such as opening, closing, and receiving messages.
     * - When the connection is opened, it emits the `AgentEvents.Open` event.
     * - When the connection is closed, it emits the `AgentEvents.Close` event.
     * - When an error occurs on the connection, it emits the `AgentEvents.Error` event.
     * - When a message is received, it parses the message and emits the appropriate event based on the message type.
     */
    setupConnection(): void;
    /**
     * Handles incoming messages from the WebSocket connection.
     * @param event - The MessageEvent object representing the received message.
     */
    protected handleMessage(event: MessageEvent): void;
    /**
     * Handles binary messages received from the WebSocket connection.
     * @param data - The binary data.
     */
    protected handleBinaryMessage(data: Buffer): void;
    /**
     * Handles text messages received from the WebSocket connection.
     * @param data - The parsed JSON data.
     */
    protected handleTextMessage(data: any): void;
    /**
     * To be called with your model configuration BEFORE sending
     * any audio data.
     * @param options - The SettingsConfiguration object.
     */
    configure(options: AgentLiveSchema): void;
    /**
     * Provide new system prompt to the LLM.
     * @param prompt - The system prompt to provide.
     */
    updatePrompt(prompt: string): void;
    /**
     * Change the speak model.
     * @param model - The new model to use.
     */
    updateSpeak(speakConfig: Exclude<AgentLiveSchema["agent"]["speak"], undefined>): void;
    /**
     * Immediately trigger an agent message. If this message
     * is sent while the user is speaking, or while the server is in the
     * middle of sending audio, then the request will be ignored and an InjectionRefused
     * event will be emitted.
     * @example "Hold on while I look that up for you."
     * @example "Are you still on the line?"
     * @param content - The message to speak.
     */
    injectAgentMessage(content: string): void;
    /**
     * Respond to a function call request.
     * @param response  - The response to the function call request.
     */
    functionCallResponse(response: FunctionCallResponse): void;
    /**
     * Send a keepalive to avoid closing the websocket while you
     * are not transmitting audio. This should be sent at least
     * every 8 seconds.
     */
    keepAlive(): void;
}
//# sourceMappingURL=AgentLiveClient.d.ts.map