import type { PipelineType } from "../pipelines.js";
import type { ChatCompletionInputMessage, GenerationParameters } from "../tasks/index.js";
import type { InferenceSnippet, ModelDataMinimal } from "./types.js";
export declare const snippetBasic: (model: ModelDataMinimal, accessToken: string) => InferenceSnippet;
export declare const snippetTextGeneration: (model: ModelDataMinimal, accessToken: string, opts?: {
    streaming?: boolean;
    messages?: ChatCompletionInputMessage[];
    temperature?: GenerationParameters["temperature"];
    max_tokens?: GenerationParameters["max_tokens"];
    top_p?: GenerationParameters["top_p"];
}) => InferenceSnippet | InferenceSnippet[];
export declare const snippetZeroShotClassification: (model: ModelDataMinimal, accessToken: string) => InferenceSnippet;
export declare const snippetTextToImage: (model: ModelDataMinimal, accessToken: string) => InferenceSnippet;
export declare const snippetTextToAudio: (model: ModelDataMinimal, accessToken: string) => InferenceSnippet;
export declare const snippetFile: (model: ModelDataMinimal, accessToken: string) => InferenceSnippet;
export declare const jsSnippets: Partial<Record<PipelineType, (model: ModelDataMinimal, accessToken: string, opts?: Record<string, unknown>) => InferenceSnippet | InferenceSnippet[]>>;
export declare function getJsInferenceSnippet(model: ModelDataMinimal, accessToken: string): InferenceSnippet | InferenceSnippet[];
export declare function hasJsInferenceSnippet(model: ModelDataMinimal): boolean;
//# sourceMappingURL=js.d.ts.map