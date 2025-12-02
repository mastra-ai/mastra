import type { MastraLanguageModelV2 } from '../../llm/model/shared.types.js';
import type { StreamInternal } from '../types.js';
type State = {
    stepResult: Record<string, any> | undefined;
    responseMetadata: Record<string, any> | undefined;
    modelMetadata: {
        modelId: string;
        modelVersion: string;
        modelProvider: string;
    };
    hasToolCallStreaming: boolean;
    hasErrored: boolean;
    reasoningDeltas: string[];
    textDeltas: string[];
    isReasoning: boolean;
    isStreaming: boolean;
    providerOptions: Record<string, any> | undefined;
};
export declare class AgenticRunState {
    #private;
    constructor({ _internal, model }: {
        _internal: StreamInternal;
        model: MastraLanguageModelV2;
    });
    setState(state: Partial<State>): void;
    get state(): State;
}
export {};
//# sourceMappingURL=run-state.d.ts.map