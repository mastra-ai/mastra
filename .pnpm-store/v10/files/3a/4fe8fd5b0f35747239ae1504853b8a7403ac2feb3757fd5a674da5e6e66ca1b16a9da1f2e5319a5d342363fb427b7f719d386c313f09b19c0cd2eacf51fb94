import { ModelContext, ModelContextProvider } from "../../model-context/ModelContextTypes";
import { Unsubscribe } from "../../types/Unsubscribe";
import { ModelContextRegistryToolHandle, ModelContextRegistryInstructionHandle, ModelContextRegistryProviderHandle } from "./ModelContextRegistryHandles";
import type { AssistantToolProps } from "../../model-context/useAssistantTool";
import type { AssistantInstructionsConfig } from "../../model-context/useAssistantInstructions";
export declare class ModelContextRegistry implements ModelContextProvider {
    private _tools;
    private _instructions;
    private _providers;
    private _subscribers;
    private _providerUnsubscribes;
    getModelContext(): ModelContext;
    subscribe(callback: () => void): Unsubscribe;
    private notifySubscribers;
    addTool<TArgs extends Record<string, unknown>, TResult>(tool: AssistantToolProps<TArgs, TResult>): ModelContextRegistryToolHandle<TArgs, TResult>;
    addInstruction(config: string | AssistantInstructionsConfig): ModelContextRegistryInstructionHandle;
    addProvider(provider: ModelContextProvider): ModelContextRegistryProviderHandle;
}
//# sourceMappingURL=ModelContextRegistry.d.ts.map