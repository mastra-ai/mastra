import type { PipelineType } from "../pipelines";
import { PIPELINE_DATA } from "../pipelines";

import audioClassification from "./audio-classification/data";
import audioToAudio from "./audio-to-audio/data";
import automaticSpeechRecognition from "./automatic-speech-recognition/data";
import documentQuestionAnswering from "./document-question-answering/data";
import featureExtraction from "./feature-extraction/data";
import fillMask from "./fill-mask/data";
import imageClassification from "./image-classification/data";
import imageFeatureExtraction from "./image-feature-extraction/data";
import imageToImage from "./image-to-image/data";
import imageToText from "./image-to-text/data";
import imageTextToText from "./image-text-to-text/data";
import imageSegmentation from "./image-segmentation/data";
import maskGeneration from "./mask-generation/data";
import objectDetection from "./object-detection/data";
import depthEstimation from "./depth-estimation/data";
import placeholder from "./placeholder/data";
import reinforcementLearning from "./reinforcement-learning/data";
import questionAnswering from "./question-answering/data";
import sentenceSimilarity from "./sentence-similarity/data";
import summarization from "./summarization/data";
import tableQuestionAnswering from "./table-question-answering/data";
import tabularClassification from "./tabular-classification/data";
import tabularRegression from "./tabular-regression/data";
import textToImage from "./text-to-image/data";
import textToSpeech from "./text-to-speech/data";
import tokenClassification from "./token-classification/data";
import translation from "./translation/data";
import textClassification from "./text-classification/data";
import textGeneration from "./text-generation/data";
import textToVideo from "./text-to-video/data";
import unconditionalImageGeneration from "./unconditional-image-generation/data";
import videoClassification from "./video-classification/data";
import visualQuestionAnswering from "./visual-question-answering/data";
import zeroShotClassification from "./zero-shot-classification/data";
import zeroShotImageClassification from "./zero-shot-image-classification/data";
import zeroShotObjectDetection from "./zero-shot-object-detection/data";
import imageTo3D from "./image-to-3d/data";
import textTo3D from "./text-to-3d/data";
import keypointDetection from "./keypoint-detection/data";
import videoTextToText from "./video-text-to-text/data";

export type * from "./audio-classification/inference";
export type * from "./automatic-speech-recognition/inference";
export type {
	ChatCompletionInput,
	ChatCompletionInputMessage,
	ChatCompletionOutput,
	ChatCompletionOutputComplete,
	ChatCompletionOutputMessage,
	ChatCompletionStreamOutput,
	ChatCompletionStreamOutputChoice,
	ChatCompletionStreamOutputDelta,
} from "./chat-completion/inference";
export type * from "./document-question-answering/inference";
export type * from "./feature-extraction/inference";
export type * from "./fill-mask/inference";
export type {
	ImageClassificationInput,
	ImageClassificationOutput,
	ImageClassificationOutputElement,
	ImageClassificationParameters,
} from "./image-classification/inference";
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
export type {
	ClassificationOutputTransform,
	TextClassificationInput,
	TextClassificationOutput,
	TextClassificationOutputElement,
	TextClassificationParameters,
} from "./text-classification/inference";
export type {
	TextGenerationOutputFinishReason,
	TextGenerationOutputPrefillToken,
	TextGenerationInput,
	TextGenerationOutput,
	TextGenerationOutputDetails,
	TextGenerationInputGenerateParameters,
	TextGenerationOutputBestOfSequence,
	TextGenerationOutputToken,
	TextGenerationStreamOutputStreamDetails,
	TextGenerationStreamOutput,
} from "./text-generation/inference";
export type * from "./video-classification/inference";
export type * from "./visual-question-answering/inference";
export type * from "./zero-shot-classification/inference";
export type * from "./zero-shot-image-classification/inference";
export type {
	BoundingBox,
	ZeroShotObjectDetectionInput,
	ZeroShotObjectDetectionInputData,
	ZeroShotObjectDetectionOutput,
	ZeroShotObjectDetectionOutputElement,
} from "./zero-shot-object-detection/inference";

import type { ModelLibraryKey } from "../model-libraries";

/**
 * Model libraries compatible with each ML task
 */
export const TASKS_MODEL_LIBRARIES: Record<PipelineType, ModelLibraryKey[]> = {
	"audio-classification": ["speechbrain", "transformers", "transformers.js"],
	"audio-to-audio": ["asteroid", "fairseq", "speechbrain"],
	"automatic-speech-recognition": ["espnet", "nemo", "speechbrain", "transformers", "transformers.js"],
	"depth-estimation": ["transformers", "transformers.js"],
	"document-question-answering": ["transformers", "transformers.js"],
	"feature-extraction": ["sentence-transformers", "transformers", "transformers.js"],
	"fill-mask": ["transformers", "transformers.js"],
	"graph-ml": ["transformers"],
	"image-classification": ["keras", "timm", "transformers", "transformers.js"],
	"image-feature-extraction": ["timm", "transformers"],
	"image-segmentation": ["transformers", "transformers.js"],
	"image-text-to-text": ["transformers"],
	"image-to-image": ["diffusers", "transformers", "transformers.js"],
	"image-to-text": ["transformers", "transformers.js"],
	"image-to-video": ["diffusers"],
	"keypoint-detection": ["transformers"],
	"video-classification": ["transformers"],
	"mask-generation": ["transformers"],
	"multiple-choice": ["transformers"],
	"object-detection": ["transformers", "transformers.js"],
	other: [],
	"question-answering": ["adapter-transformers", "allennlp", "transformers", "transformers.js"],
	robotics: [],
	"reinforcement-learning": ["transformers", "stable-baselines3", "ml-agents", "sample-factory"],
	"sentence-similarity": ["sentence-transformers", "spacy", "transformers.js"],
	summarization: ["transformers", "transformers.js"],
	"table-question-answering": ["transformers"],
	"table-to-text": ["transformers"],
	"tabular-classification": ["sklearn"],
	"tabular-regression": ["sklearn"],
	"tabular-to-text": ["transformers"],
	"text-classification": ["adapter-transformers", "setfit", "spacy", "transformers", "transformers.js"],
	"text-generation": ["transformers", "transformers.js"],
	"text-retrieval": [],
	"text-to-image": ["diffusers"],
	"text-to-speech": ["espnet", "tensorflowtts", "transformers", "transformers.js"],
	"text-to-audio": ["transformers", "transformers.js"],
	"text-to-video": ["diffusers"],
	"text2text-generation": ["transformers", "transformers.js"],
	"time-series-forecasting": [],
	"token-classification": [
		"adapter-transformers",
		"flair",
		"spacy",
		"span-marker",
		"stanza",
		"transformers",
		"transformers.js",
	],
	translation: ["transformers", "transformers.js"],
	"unconditional-image-generation": ["diffusers"],
	"video-text-to-text": ["transformers"],
	"visual-question-answering": ["transformers", "transformers.js"],
	"voice-activity-detection": [],
	"zero-shot-classification": ["transformers", "transformers.js"],
	"zero-shot-image-classification": ["transformers", "transformers.js"],
	"zero-shot-object-detection": ["transformers", "transformers.js"],
	"text-to-3d": ["diffusers"],
	"image-to-3d": ["diffusers"],
	"any-to-any": ["transformers"],
};

/**
 * Return the whole TaskData object for a certain task.
 * If the partialTaskData argument is left undefined,
 * the default placholder data will be used.
 */
function getData(type: PipelineType, partialTaskData: TaskDataCustom = placeholder): TaskData {
	return {
		...partialTaskData,
		id: type,
		label: PIPELINE_DATA[type].name,
		libraries: TASKS_MODEL_LIBRARIES[type],
	};
}

// To make comparisons easier, task order is the same as in const.ts
// Tasks set to undefined won't have an associated task page.
// Tasks that call getData() without the second argument will
// have a "placeholder" page.
export const TASKS_DATA: Record<PipelineType, TaskData | undefined> = {
	"any-to-any": getData("any-to-any", placeholder),
	"audio-classification": getData("audio-classification", audioClassification),
	"audio-to-audio": getData("audio-to-audio", audioToAudio),
	"automatic-speech-recognition": getData("automatic-speech-recognition", automaticSpeechRecognition),
	"depth-estimation": getData("depth-estimation", depthEstimation),
	"document-question-answering": getData("document-question-answering", documentQuestionAnswering),
	"feature-extraction": getData("feature-extraction", featureExtraction),
	"fill-mask": getData("fill-mask", fillMask),
	"graph-ml": undefined,
	"image-classification": getData("image-classification", imageClassification),
	"image-feature-extraction": getData("image-feature-extraction", imageFeatureExtraction),
	"image-segmentation": getData("image-segmentation", imageSegmentation),
	"image-to-image": getData("image-to-image", imageToImage),
	"image-text-to-text": getData("image-text-to-text", imageTextToText),
	"image-to-text": getData("image-to-text", imageToText),
	"image-to-video": undefined,
	"keypoint-detection": getData("keypoint-detection", keypointDetection),
	"mask-generation": getData("mask-generation", maskGeneration),
	"multiple-choice": undefined,
	"object-detection": getData("object-detection", objectDetection),
	"video-classification": getData("video-classification", videoClassification),
	other: undefined,
	"question-answering": getData("question-answering", questionAnswering),
	"reinforcement-learning": getData("reinforcement-learning", reinforcementLearning),
	robotics: undefined,
	"sentence-similarity": getData("sentence-similarity", sentenceSimilarity),
	summarization: getData("summarization", summarization),
	"table-question-answering": getData("table-question-answering", tableQuestionAnswering),
	"table-to-text": undefined,
	"tabular-classification": getData("tabular-classification", tabularClassification),
	"tabular-regression": getData("tabular-regression", tabularRegression),
	"tabular-to-text": undefined,
	"text-classification": getData("text-classification", textClassification),
	"text-generation": getData("text-generation", textGeneration),
	"text-retrieval": undefined,
	"text-to-image": getData("text-to-image", textToImage),
	"text-to-speech": getData("text-to-speech", textToSpeech),
	"text-to-audio": undefined,
	"text-to-video": getData("text-to-video", textToVideo),
	"text2text-generation": undefined,
	"time-series-forecasting": undefined,
	"token-classification": getData("token-classification", tokenClassification),
	translation: getData("translation", translation),
	"unconditional-image-generation": getData("unconditional-image-generation", unconditionalImageGeneration),
	"video-text-to-text": getData("video-text-to-text", videoTextToText),
	"visual-question-answering": getData("visual-question-answering", visualQuestionAnswering),
	"voice-activity-detection": undefined,
	"zero-shot-classification": getData("zero-shot-classification", zeroShotClassification),
	"zero-shot-image-classification": getData("zero-shot-image-classification", zeroShotImageClassification),
	"zero-shot-object-detection": getData("zero-shot-object-detection", zeroShotObjectDetection),
	"text-to-3d": getData("text-to-3d", textTo3D),
	"image-to-3d": getData("image-to-3d", imageTo3D),
} as const;

export interface ExampleRepo {
	description: string;
	id: string;
}

export type TaskDemoEntry =
	| {
			filename: string;
			type: "audio";
	  }
	| {
			data: Array<{
				label: string;
				score: number;
			}>;
			type: "chart";
	  }
	| {
			filename: string;
			type: "img";
	  }
	| {
			table: string[][];
			type: "tabular";
	  }
	| {
			content: string;
			label: string;
			type: "text";
	  }
	| {
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
