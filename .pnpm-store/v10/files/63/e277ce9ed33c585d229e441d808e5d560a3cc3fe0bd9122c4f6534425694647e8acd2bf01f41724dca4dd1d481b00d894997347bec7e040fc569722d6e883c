import { ModelContextProvider } from "../../model-context/ModelContextTypes";
import { Unsubscribe } from "../../types/Unsubscribe";
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
export declare class AssistantFrameProvider {
    private static _instance;
    private _providers;
    private _providerUnsubscribes;
    private _targetOrigin;
    private constructor();
    private static getInstance;
    private handleMessage;
    private handleToolCall;
    private sendMessage;
    private getModelContext;
    private broadcastUpdate;
    static addModelContextProvider(provider: ModelContextProvider, targetOrigin?: string): Unsubscribe;
    static dispose(): void;
}
//# sourceMappingURL=AssistantFrameProvider.d.ts.map