import {
  ModelContextProvider,
  ModelContext,
} from "../../model-context/ModelContextTypes";
import { Unsubscribe } from "../../types/Unsubscribe";
import { Tool } from "assistant-stream";
import { z } from "zod";
import {
  FrameMessage,
  FRAME_MESSAGE_CHANNEL,
  SerializedModelContext,
  SerializedTool,
} from "./AssistantFrameTypes";

/**
 * Converts tools to JSON Schema format for serialization
 */
const serializeTool = (tool: Tool<any, any>): SerializedTool => ({
  ...(tool.description && { description: tool.description }),
  parameters:
    tool.parameters instanceof z.ZodType
      ? ((z as any).toJSONSchema?.(tool.parameters) ?? tool.parameters)
      : tool.parameters,
  ...(tool.disabled !== undefined && { disabled: tool.disabled }),
  ...(tool.type && { type: tool.type }),
});

/**
 * Serializes a ModelContext for transmission across iframe boundary
 */
const serializeModelContext = (
  context: ModelContext,
): SerializedModelContext => ({
  ...(context.system !== undefined && { system: context.system }),
  ...(context.tools && {
    tools: Object.fromEntries(
      Object.entries(context.tools).map(([name, tool]) => [
        name,
        serializeTool(tool),
      ]),
    ),
  }),
});

/**
 * AssistantFrameProvider - Runs inside an iframe and provides ModelContextProviders
 * to the parent window's AssistantFrameHost.
 *
 * Usage example:
 * ```typescript
 * // Inside the iframe
 * // Add model context providers
 * const registry = new ModelContextRegistry();
 * AssistantFrameProvider.addModelContextProvider(registry);
 *
 * // Add tools to registry
 * registry.addTool({
 *   toolName: "search",
 *   description: "Search the web",
 *   parameters: z.object({ query: z.string() }),
 *   execute: async (args) => {
 *     // Tool implementation runs in iframe
 *     return { results: ["..."] };
 *   }
 * });
 * ```
 */
export class AssistantFrameProvider {
  private static _instance: AssistantFrameProvider | null = null;

  private _providers = new Set<ModelContextProvider>();
  private _providerUnsubscribes = new Map<
    ModelContextProvider,
    Unsubscribe | undefined
  >();
  private _targetOrigin: string;

  private constructor(targetOrigin: string = "*") {
    this._targetOrigin = targetOrigin;
    this.handleMessage = this.handleMessage.bind(this);
    window.addEventListener("message", this.handleMessage);

    // Send initial update on initialization
    setTimeout(() => this.broadcastUpdate(), 0);
  }

  private static getInstance(targetOrigin?: string): AssistantFrameProvider {
    if (!AssistantFrameProvider._instance) {
      AssistantFrameProvider._instance = new AssistantFrameProvider(
        targetOrigin,
      );
    }
    return AssistantFrameProvider._instance;
  }

  private handleMessage(event: MessageEvent) {
    // Security: Validate origin if specified
    if (this._targetOrigin !== "*" && event.origin !== this._targetOrigin)
      return;
    if (event.data?.channel !== FRAME_MESSAGE_CHANNEL) return;

    const message = event.data.message as FrameMessage;

    switch (message.type) {
      case "model-context-request":
        // Respond with current context
        this.sendMessage(event, {
          type: "model-context-update",
          context: serializeModelContext(this.getModelContext()),
        });
        break;

      case "tool-call":
        this.handleToolCall(message, event);
        break;
    }
  }

  private async handleToolCall(
    message: Extract<FrameMessage, { type: "tool-call" }>,
    event: MessageEvent,
  ) {
    const tool = this.getModelContext().tools?.[message.toolName];

    let result: any;
    let error: string | undefined;

    if (!tool) {
      error = `Tool "${message.toolName}" not found`;
    } else {
      try {
        result = tool.execute
          ? await tool.execute(message.args, {
              toolCallId: message.id,
              abortSignal: new AbortController().signal,
            })
          : undefined;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }

    this.sendMessage(event, {
      type: "tool-result",
      id: message.id,
      ...(error ? { error } : { result }),
    });
  }

  private sendMessage(event: MessageEvent, message: FrameMessage) {
    event.source?.postMessage(
      { channel: FRAME_MESSAGE_CHANNEL, message },
      { targetOrigin: event.origin },
    );
  }

  private getModelContext(): ModelContext {
    const contexts = Array.from(this._providers).map((p) =>
      p.getModelContext(),
    );

    return contexts.reduce(
      (merged, context) => ({
        system: context.system
          ? merged.system
            ? `${merged.system}\n\n${context.system}`
            : context.system
          : merged.system,
        tools: { ...(merged.tools || {}), ...(context.tools || {}) },
      }),
      {} as ModelContext,
    );
  }

  private broadcastUpdate() {
    // Always broadcast to parent window
    if (window.parent && window.parent !== window) {
      const updateMessage: FrameMessage = {
        type: "model-context-update",
        context: serializeModelContext(this.getModelContext()),
      };

      window.parent.postMessage(
        { channel: FRAME_MESSAGE_CHANNEL, message: updateMessage },
        this._targetOrigin,
      );
    }
  }

  static addModelContextProvider(
    provider: ModelContextProvider,
    targetOrigin?: string,
  ): Unsubscribe {
    const instance = AssistantFrameProvider.getInstance(targetOrigin);
    instance._providers.add(provider);

    const unsubscribe = provider.subscribe?.(() => instance.broadcastUpdate());
    if (unsubscribe) {
      instance._providerUnsubscribes.set(provider, unsubscribe);
    }

    instance.broadcastUpdate();

    return () => {
      instance._providers.delete(provider);
      instance._providerUnsubscribes.get(provider)?.();
      instance._providerUnsubscribes.delete(provider);
      instance.broadcastUpdate();
    };
  }

  static dispose() {
    if (AssistantFrameProvider._instance) {
      const instance = AssistantFrameProvider._instance;
      window.removeEventListener("message", instance.handleMessage);

      // Unsubscribe from all providers
      instance._providerUnsubscribes.forEach((unsubscribe) => unsubscribe?.());
      instance._providerUnsubscribes.clear();
      instance._providers.clear();

      AssistantFrameProvider._instance = null;
    }
  }
}
