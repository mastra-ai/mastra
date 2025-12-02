import type { PipelineType } from "../pipelines";
export type * from "./audio-classification/inference";
export type * from "./automatic-speech-recognition/inference";
export type { ChatCompletionInput, ChatCompletionInputMessage, ChatCompletionOutput, ChatCompletionOutputComplete, ChatCompletionOutputMessage, ChatCompletionStreamOutput, ChatCompletionStreamOutputChoice, ChatCompletionStreamOutputDelta, } from "./chat-completion/inference";
export type * from "./document-question-answering/inference";
export type * from "./feature-extraction/inference";
export type * from "./fill-mask/inference";
export type { ImageClassificationInput, ImageClassificationOutput, ImageClassificationOutputElement, ImageClassificationParameters, } from "./image-classification/inference";
export type * from "./image-to-image/inference";
export type { ImageToTextInput, ImageToTextOutput, ImageToTextParameters } from "./image-to-text/inference";
export type * from "./image-segmentation/inference";
export type * from "./object-detection/inference";
export type * from "./depth-estimation/inference";
export type * from "./question-answering/inference";
export type * from "./sentence-similarity/inference";
export type * from "./summarization/inference";
export type * from "./table-question-answering/inference";
export type { TextToImageInput, TextToImageOutput, TextToImageParameters } from "./text-to-image/inference";
export type { TextToSpeechParameters, TextToSpeechInput, TextToSpeechOutput } from "./text-to-speech/inference";
export type * from "./token-classification/inference";
export type { TranslationInput, TranslationOutput } from "./translation/inference";
export type { ClassificationOutputTransform, TextClassificationInput, TextClassificationOutput, TextClassificationOutputElement, TextClassificationParameters, } from "./text-classification/inference";
export type { TextGenerationOutputFinishReason, TextGenerationOutputPrefillToken, TextGenerationInput, TextGenerationOutput, TextGenerationOutputDetails, TextGenerationInputGenerateParameters, TextGenerationOutputBestOfSequence, TextGenerationOutputToken, TextGenerationStreamOutputStreamDetails, TextGenerationStreamOutput, } from "./text-generation/inference";
export type * from "./video-classification/inference";
export type * from "./visual-question-answering/inference";
export type * from "./zero-shot-classification/inference";
export type * from "./zero-shot-image-classification/inference";
export type { BoundingBox, ZeroShotObjectDetectionInput, ZeroShotObjectDetectionInputData, ZeroShotObjectDetectionOutput, ZeroShotObjectDetectionOutputElement, } from "./zero-shot-object-detection/inference";
import type { ModelLibraryKey } from "../model-libraries";
/**
 * Model libraries compatible with each ML task
 */
export declare const TASKS_MODEL_LIBRARIES: Record<PipelineType, ModelLibraryKey[]>;
export declare const TASKS_DATA: Record<PipelineType, TaskData | undefined>;
export interface ExampleRepo {
    description: string;
    id: string;
}
export type TaskDemoEntry = {
    filename: string;
    type: "audio";
} | {
    data: Array<{
        label: string;
        score: number;
    }>;
    type: "chart";
} | {
    filename: string;
    type: "img";
} | {
    table: string[][];
    type: "tabular";
} | {
    content: string;
    label: string;
    type: "text";
} | {
    text: string;
    tokens: Array<{
        end: number;
        start: number;
        type: string;
    }>;
    type: "text-with-tokens";
};
export interface TaskDemo {
    inputs: TaskDemoEntry[];
    outputs: TaskDemoEntry[];
}
export interface TaskData {
    datasets: ExampleRepo[];
    demo: TaskDemo;
    id: PipelineType;
    canonicalId?: PipelineType;
    isPlaceholder?: boolean;
    label: string;
    libraries: ModelLibraryKey[];
    metrics: ExampleRepo[];
    models: ExampleRepo[];
    spaces: ExampleRepo[];
    summary: string;
    widgetModels: string[];
    youtubeId?: string;
}
export type TaskDataCustom = Omit<TaskData, "id" | "label" | "libraries">;
//# sourceMappingURL=index.d.ts.map