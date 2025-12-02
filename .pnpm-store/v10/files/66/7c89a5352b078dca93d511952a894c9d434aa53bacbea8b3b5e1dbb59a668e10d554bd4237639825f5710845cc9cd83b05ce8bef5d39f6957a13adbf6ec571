import { Dictation } from "./Dictation";
import { Enrichment } from "./Enrichment";
import { Interactive } from "./Interactive";
import { Conversation } from "./Conversation";
import { SpeakerDiarization } from "./SpeakerDiarization";
import { SentimentAnalysis } from "./SentimentAnalysis";
import { GeoLocation } from "./GeoLocation";
import { OnSuccess } from "./OnSuccess";
import { OnInterim } from "./OnInterim";
/**
 * The Recognition modes
 */
export declare enum RecognitionMode {
    Interactive = "Interactive",
    Dictation = "Dictation",
    Conversation = "Conversation",
    None = "None"
}
/**
 * The speech start event sensitivity.
 */
export declare enum SpeechStartEventSensitivity {
    Low = "low",
    Medium = "medium",
    High = "high"
}
/**
 * Defines the phrase detection payload in the speech Context message
 */
export interface PhraseDetectionContext {
    /**
     * The initial silence timeout.
     */
    initialSilenceTimeout?: number;
    /**
     * The trailing silence timeout.
     */
    trailingSilenceTimeout?: number;
    /**
     * The recognition mode.
     */
    mode?: RecognitionMode;
    /**
     * The enrichment option.
     */
    enrichment?: Enrichment;
    /**
     * The Interactive options.
     */
    interactive?: Interactive;
    /**
     * The Dictation options.
     */
    dictation?: Dictation;
    /**
     * The Conversation options.
     */
    conversation?: Conversation;
    /**
     * The grammar scenario that allows clients to use sophisticated acoustic and language models
     */
    grammarScenario?: string;
    /**
     * A flag that indicates whether to enable interim results or not. If true, interim results are returned to the client application.
     */
    interimResults?: boolean;
    /**
     * The configuration of speaker diarization.
     */
    speakerDiarization?: SpeakerDiarization;
    /**
     * The configuration of sentiment analysis.
     */
    sentimentAnalysis?: SentimentAnalysis;
    /**
     * The geo location.
     */
    geoLocation?: GeoLocation;
    /**
     * The on success.
     */
    onSuccess?: OnSuccess;
    /**
     * The on interim.
     */
    onInterim?: OnInterim;
    /**
     * The mapping from language to custom model id, if required.
     */
    customModels?: CustomLanguageMappingEntry[];
    /**
     * The detection language.
     */
    language?: string;
    /**
     * The speech start event sensitivity.
     */
    voiceOnsetSensitivity?: string;
}
/**
 * Defines a mapping entry from a language to a custom endpoint.
 */
export interface CustomLanguageMappingEntry {
    /**
     * The language for there is a custom endpoint.
     */
    language: string;
    /**
     * The custom endpoint id.
     */
    endpoint: string;
}
