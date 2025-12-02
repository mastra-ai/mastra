import { Unsubscribe } from "../types/Unsubscribe";
import { Tool } from "assistant-stream";
export type LanguageModelV1CallSettings = {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    seed?: number;
    headers?: Record<string, string | undefined>;
};
export type LanguageModelConfig = {
    apiKey?: string;
    baseUrl?: string;
    modelName?: string;
};
export type ModelContext = {
    priority?: number | undefined;
    system?: string | undefined;
    tools?: Record<string, Tool<any, any>> | undefined;
    callSettings?: LanguageModelV1CallSettings | undefined;
    config?: LanguageModelConfig | undefined;
};
export type ModelContextProvider = {
    getModelContext: () => ModelContext;
    subscribe?: (callback: () => void) => Unsubscribe;
};
export declare const mergeModelContexts: (configSet: Set<ModelContextProvider>) => ModelContext;
//# sourceMappingURL=ModelContextTypes.d.ts.map