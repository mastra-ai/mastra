import { ModelContextProvider, ModelContext } from "../../model-context/ModelContextTypes";
import { Unsubscribe } from "../../types/Unsubscribe";
/**
 * AssistantFrameHost - Runs in the parent window and acts as a ModelContextProvider
 * that receives context from an iframe's AssistantFrameProvider.
 *
 * Usage example:
 * ```typescript
 * // In parent window
 * const frameHost = new AssistantFrameHost(iframeWindow);
 *
 * // Register with assistant runtime
 * const runtime = useAssistantRuntime();
 * runtime.registerModelContextProvider(frameHost);
 *
 * // The assistant now has access to tools from the iframe
 * ```
 */
export declare class AssistantFrameHost implements ModelContextProvider {
    private _context;
    private _subscribers;
    private _pendingRequests;
    private _requestCounter;
    private _iframeWindow;
    private _targetOrigin;
    constructor(iframeWindow: Window, targetOrigin?: string);
    private handleMessage;
    private updateContext;
    private callTool;
    private sendRequest;
    private requestContext;
    private notifySubscribers;
    getModelContext(): ModelContext;
    subscribe(callback: () => void): Unsubscribe;
    dispose(): void;
}
//# sourceMappingURL=AssistantFrameHost.d.ts.map