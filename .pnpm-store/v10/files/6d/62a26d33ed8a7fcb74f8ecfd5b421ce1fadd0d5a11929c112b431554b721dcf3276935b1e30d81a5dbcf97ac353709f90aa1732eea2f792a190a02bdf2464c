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
}) => InferenceSnippet;
export declare const snippetZeroShotClassification: (model: ModelDataMinimal, accessToken: string) => InferenceSnippet;
export declare const snippetFile: (model: ModelDataMinimal, accessToken: string) => InferenceSnippet;
export declare const curlSnippets: Partial<Record<PipelineType, (model: ModelDataMinimal, accessToken: string, opts?: Record<string, unknown>) => InferenceSnippet>>;
export declare function getCurlInferenceSnippet(model: ModelDataMinimal, accessToken: string): InferenceSnippet;
export declare function hasCurlInferenceSnippet(model: Pick<ModelDataMinimal, "pipeline_tag">): boolean;
//# sourceMappingURL=curl.d.ts.map