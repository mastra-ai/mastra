export declare const MODALITIES: readonly ["multimodal", "nlp", "cv", "audio", "tabular", "rl", "other"];
export type Modality = (typeof MODALITIES)[number];
export declare const MODALITY_LABELS: {
    multimodal: string;
    nlp: string;
    audio: string;
    cv: string;
    rl: string;
    tabular: string;
    other: string;
};
/**
 * Public interface for a sub task.
 *
 * This can be used in a model card's `model-index` metadata.
 * and is more granular classification that can grow significantly
 * over time as new tasks are added.
 */
export interface SubTask {
    /**
     * type of the task (e.g. audio-source-separation)
     */
    type: string;
    /**
     * displayed name of the task (e.g. Audio Source Separation)
     */
    name: string;
}
/**
 * Public interface for a PipelineData.
 *
 * This information corresponds to a pipeline type (aka task)
 * in the Hub.
 */
export interface PipelineData {
    /**
     * displayed name of the task (e.g. Text Classification)
     */
    name: string;
    subtasks?: SubTask[];
    modality: Modality;
    /**
     * color for the tag icon.
     */
    color: "blue" | "green" | "indigo" | "orange" | "red" | "yellow";
    /**
     * whether to hide in /models filters
     */
    hideInModels?: boolean;
    /**
     * whether to hide in /datasets filters
     */
    hideInDatasets?: boolean;
}
export declare const PIPELINE_DATA: {
    "text-classification": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "nlp";
        color: "orange";
    };
    "token-classification": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "nlp";
        color: "blue";
    };
    "table-question-answering": {
        name: string;
        modality: "nlp";
        color: "green";
    };
    "question-answering": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "nlp";
        color: "blue";
    };
    "zero-shot-classification": {
        name: string;
        modality: "nlp";
        color: "yellow";
    };
    translation: {
        name: string;
        modality: "nlp";
        color: "green";
    };
    summarization: {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "nlp";
        color: "indigo";
    };
    "feature-extraction": {
        name: string;
        modality: "nlp";
        color: "red";
    };
    "text-generation": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "nlp";
        color: "indigo";
    };
    "text2text-generation": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "nlp";
        color: "indigo";
    };
    "fill-mask": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "nlp";
        color: "red";
    };
    "sentence-similarity": {
        name: string;
        modality: "nlp";
        color: "yellow";
    };
    "text-to-speech": {
        name: string;
        modality: "audio";
        color: "yellow";
    };
    "text-to-audio": {
        name: string;
        modality: "audio";
        color: "yellow";
    };
    "automatic-speech-recognition": {
        name: string;
        modality: "audio";
        color: "yellow";
    };
    "audio-to-audio": {
        name: string;
        modality: "audio";
        color: "blue";
    };
    "audio-classification": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "audio";
        color: "green";
    };
    "voice-activity-detection": {
        name: string;
        modality: "audio";
        color: "red";
    };
    "depth-estimation": {
        name: string;
        modality: "cv";
        color: "yellow";
    };
    "image-classification": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "cv";
        color: "blue";
    };
    "object-detection": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "cv";
        color: "yellow";
    };
    "image-segmentation": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "cv";
        color: "green";
    };
    "text-to-image": {
        name: string;
        modality: "cv";
        color: "yellow";
    };
    "image-to-text": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "cv";
        color: "red";
    };
    "image-to-image": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "cv";
        color: "indigo";
    };
    "image-to-video": {
        name: string;
        modality: "cv";
        color: "indigo";
    };
    "unconditional-image-generation": {
        name: string;
        modality: "cv";
        color: "green";
    };
    "video-classification": {
        name: string;
        modality: "cv";
        color: "blue";
    };
    "reinforcement-learning": {
        name: string;
        modality: "rl";
        color: "red";
    };
    robotics: {
        name: string;
        modality: "rl";
        subtasks: {
            type: string;
            name: string;
        }[];
        color: "blue";
    };
    "tabular-classification": {
        name: string;
        modality: "tabular";
        subtasks: {
            type: string;
            name: string;
        }[];
        color: "blue";
    };
    "tabular-regression": {
        name: string;
        modality: "tabular";
        subtasks: {
            type: string;
            name: string;
        }[];
        color: "blue";
    };
    "tabular-to-text": {
        name: string;
        modality: "tabular";
        subtasks: {
            type: string;
            name: string;
        }[];
        color: "blue";
        hideInModels: true;
    };
    "table-to-text": {
        name: string;
        modality: "nlp";
        color: "blue";
        hideInModels: true;
    };
    "multiple-choice": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "nlp";
        color: "blue";
        hideInModels: true;
    };
    "text-retrieval": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "nlp";
        color: "indigo";
        hideInModels: true;
    };
    "time-series-forecasting": {
        name: string;
        modality: "tabular";
        subtasks: {
            type: string;
            name: string;
        }[];
        color: "blue";
    };
    "text-to-video": {
        name: string;
        modality: "cv";
        color: "green";
    };
    "image-text-to-text": {
        name: string;
        modality: "multimodal";
        color: "red";
        hideInDatasets: true;
    };
    "visual-question-answering": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "multimodal";
        color: "red";
    };
    "document-question-answering": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "multimodal";
        color: "blue";
        hideInDatasets: true;
    };
    "zero-shot-image-classification": {
        name: string;
        modality: "cv";
        color: "yellow";
    };
    "graph-ml": {
        name: string;
        modality: "other";
        color: "green";
    };
    "mask-generation": {
        name: string;
        modality: "cv";
        color: "indigo";
    };
    "zero-shot-object-detection": {
        name: string;
        modality: "cv";
        color: "yellow";
    };
    "text-to-3d": {
        name: string;
        modality: "cv";
        color: "yellow";
    };
    "image-to-3d": {
        name: string;
        modality: "cv";
        color: "green";
    };
    "image-feature-extraction": {
        name: string;
        modality: "cv";
        color: "indigo";
    };
    "video-text-to-text": {
        name: string;
        modality: "multimodal";
        color: "blue";
        hideInDatasets: false;
    };
    "keypoint-detection": {
        name: string;
        subtasks: {
            type: string;
            name: string;
        }[];
        modality: "cv";
        color: "red";
        hideInDatasets: true;
    };
    "any-to-any": {
        name: string;
        modality: "multimodal";
        color: "yellow";
        hideInDatasets: true;
    };
    other: {
        name: string;
        modality: "other";
        color: "blue";
        hideInModels: true;
        hideInDatasets: true;
    };
};
export type PipelineType = keyof typeof PIPELINE_DATA;
export type WidgetType = PipelineType | "conversational";
export declare const PIPELINE_TYPES: ("other" | "text-classification" | "token-classification" | "table-question-answering" | "question-answering" | "zero-shot-classification" | "translation" | "summarization" | "feature-extraction" | "text-generation" | "text2text-generation" | "fill-mask" | "sentence-similarity" | "text-to-speech" | "text-to-audio" | "automatic-speech-recognition" | "audio-to-audio" | "audio-classification" | "voice-activity-detection" | "depth-estimation" | "image-classification" | "object-detection" | "image-segmentation" | "text-to-image" | "image-to-text" | "image-to-image" | "image-to-video" | "unconditional-image-generation" | "video-classification" | "reinforcement-learning" | "robotics" | "tabular-classification" | "tabular-regression" | "tabular-to-text" | "table-to-text" | "multiple-choice" | "text-retrieval" | "time-series-forecasting" | "text-to-video" | "image-text-to-text" | "visual-question-answering" | "document-question-answering" | "zero-shot-image-classification" | "graph-ml" | "mask-generation" | "zero-shot-object-detection" | "text-to-3d" | "image-to-3d" | "image-feature-extraction" | "video-text-to-text" | "keypoint-detection" | "any-to-any")[];
export declare const SUBTASK_TYPES: string[];
export declare const PIPELINE_TYPES_SET: Set<"other" | "text-classification" | "token-classification" | "table-question-answering" | "question-answering" | "zero-shot-classification" | "translation" | "summarization" | "feature-extraction" | "text-generation" | "text2text-generation" | "fill-mask" | "sentence-similarity" | "text-to-speech" | "text-to-audio" | "automatic-speech-recognition" | "audio-to-audio" | "audio-classification" | "voice-activity-detection" | "depth-estimation" | "image-classification" | "object-detection" | "image-segmentation" | "text-to-image" | "image-to-text" | "image-to-image" | "image-to-video" | "unconditional-image-generation" | "video-classification" | "reinforcement-learning" | "robotics" | "tabular-classification" | "tabular-regression" | "tabular-to-text" | "table-to-text" | "multiple-choice" | "text-retrieval" | "time-series-forecasting" | "text-to-video" | "image-text-to-text" | "visual-question-answering" | "document-question-answering" | "zero-shot-image-classification" | "graph-ml" | "mask-generation" | "zero-shot-object-detection" | "text-to-3d" | "image-to-3d" | "image-feature-extraction" | "video-text-to-text" | "keypoint-detection" | "any-to-any">;
//# sourceMappingURL=pipelines.d.ts.map