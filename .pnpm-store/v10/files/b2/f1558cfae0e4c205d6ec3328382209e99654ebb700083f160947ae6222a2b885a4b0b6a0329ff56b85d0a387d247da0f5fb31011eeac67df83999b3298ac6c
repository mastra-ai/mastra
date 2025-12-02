import type { PipelineType } from "../pipelines.js";
import type { ChatCompletionInputMessage, GenerationParameters } from "../tasks/index.js";
import type { InferenceSnippet, ModelDataMinimal } from "./types.js";
export declare const snippetConversational: (model: ModelDataMinimal, accessToken: string, opts?: {
    streaming?: boolean;
    messages?: ChatCompletionInputMessage[];
    temperature?: GenerationParameters["temperature"];
    max_tokens?: GenerationParameters["max_tokens"];
    top_p?: GenerationParameters["top_p"];
}) => InferenceSnippet[];
export declare const snippetZeroShotClassification: (model: ModelDataMinimal) => InferenceSnippet;
export declare const snippetZeroShotImageClassification: (model: ModelDataMinimal) => InferenceSnippet;
export declare const snippetBasic: (model: ModelDataMinimal) => InferenceSnippet;
export declare const snippetFile: (model: ModelDataMinimal) => InferenceSnippet;
export declare const snippetTextToImage: (model: ModelDataMinimal) => InferenceSnippet;
export declare const snippetTabular: (model: ModelDataMinimal) => InferenceSnippet;
export declare const snippetTextToAudio: (model: ModelDataMinimal) => InferenceSnippet;
export declare const snippetDocumentQuestionAnswering: (model: ModelDataMinimal) => InferenceSnippet;
export declare const pythonSnippets: Partial<Record<PipelineType, (model: ModelDataMinimal, accessToken: string, opts?: Record<string, unknown>) => InferenceSnippet | InferenceSnippet[]>>;
export declare function getPythonInferenceSnippet(model: ModelDataMinimal, accessToken: string, opts?: Record<string, unknown>): InferenceSnippet | InferenceSnippet[];
export declare function hasPythonInferenceSnippet(model: ModelDataMinimal): boolean;
//# sourceMappingURL=python.d.ts.map