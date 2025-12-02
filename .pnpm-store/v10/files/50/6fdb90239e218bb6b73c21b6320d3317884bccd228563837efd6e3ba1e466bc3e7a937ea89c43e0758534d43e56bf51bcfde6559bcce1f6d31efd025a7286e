import { DEFAULT_AGENT_URL } from "../lib/constants";
import { AgentEvents } from "../lib/enums/AgentEvents";
import { DeepgramError } from "../lib/errors";
import type { AgentLiveSchema, DeepgramClientOptions, FunctionCallResponse } from "../lib/types";
import { AbstractLiveClient } from "./AbstractLiveClient";

export class AgentLiveClient extends AbstractLiveClient {
  public namespace: string = "agent";

  constructor(options: DeepgramClientOptions, endpoint: string = "/:version/agent/converse") {
    super(options);
    this.baseUrl = options.agent?.websocket?.options?.url ?? DEFAULT_AGENT_URL;

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
  public setupConnection(): void {
    if (this.conn) {
      this.conn.onopen = () => {
        this.emit(AgentEvents.Open, this);
      };

      this.conn.onclose = (event: any) => {
        this.emit(AgentEvents.Close, event);
      };

      this.conn.onerror = (event: ErrorEvent) => {
        this.emit(AgentEvents.Error, event);
      };

      this.conn.onmessage = (event: MessageEvent) => {
        this.handleMessage(event);
      };
    }
  }

  /**
   * Handles incoming messages from the WebSocket connection.
   * @param event - The MessageEvent object representing the received message.
   */
  protected handleMessage(event: MessageEvent): void {
    if (typeof event.data === "string") {
      try {
        const data = JSON.parse(event.data);
        this.handleTextMessage(data);
      } catch (error) {
        this.emit(AgentEvents.Error, {
          event,
          data: event.data,
          message: "Unable to parse `data` as JSON.",
          error,
        });
      }
    } else if (event.data instanceof Blob) {
      event.data.arrayBuffer().then((buffer) => {
        this.handleBinaryMessage(Buffer.from(buffer));
      });
    } else if (event.data instanceof ArrayBuffer) {
      this.handleBinaryMessage(Buffer.from(event.data));
    } else if (Buffer.isBuffer(event.data)) {
      this.handleBinaryMessage(event.data);
    } else {
      console.log("Received unknown data type", event.data);
      this.emit(AgentEvents.Error, {
        event,
        message: "Received unknown data type.",
      });
    }
  }

  /**
   * Handles binary messages received from the WebSocket connection.
   * @param data - The binary data.
   */
  protected handleBinaryMessage(data: Buffer): void {
    this.emit(AgentEvents.Audio, data);
  }

  /**
   * Handles text messages received from the WebSocket connection.
   * @param data - The parsed JSON data.
   */
  protected handleTextMessage(data: any): void {
    if (data.type in AgentEvents) {
      this.emit(data.type, data);
    } else {
      this.emit(AgentEvents.Unhandled, data);
    }
  }

  /**
   * To be called with your model configuration BEFORE sending
   * any audio data.
   * @param options - The SettingsConfiguration object.
   */
  public configure(options: AgentLiveSchema): void {
    if (
      !options.agent.listen?.provider.model.startsWith("nova-3") &&
      options.agent.listen?.provider.keyterms?.length
    ) {
      throw new DeepgramError("Keyterms are only supported with the Nova 3 models.");
    }
    const string = JSON.stringify({
      type: "Settings",
      ...options,
    });
    this.send(string);
  }

  /**
   * Provide new system prompt to the LLM.
   * @param prompt - The system prompt to provide.
   */
  public updatePrompt(prompt: string): void {
    this.send(JSON.stringify({ type: "UpdatePrompt", prompt }));
  }

  /**
   * Change the speak model.
   * @param model - The new model to use.
   */
  public updateSpeak(speakConfig: Exclude<AgentLiveSchema["agent"]["speak"], undefined>): void {
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
  public injectAgentMessage(content: string): void {
    this.send(JSON.stringify({ type: "InjectAgentMessage", content }));
  }

  /**
   * Respond to a function call request.
   * @param response  - The response to the function call request.
   */
  public functionCallResponse(response: FunctionCallResponse): void {
    this.send(JSON.stringify({ type: "FunctionCallResponse", ...response }));
  }

  /**
   * Send a keepalive to avoid closing the websocket while you
   * are not transmitting audio. This should be sent at least
   * every 8 seconds.
   */
  public keepAlive(): void {
    this.send(JSON.stringify({ type: "KeepAlive" }));
  }
}
