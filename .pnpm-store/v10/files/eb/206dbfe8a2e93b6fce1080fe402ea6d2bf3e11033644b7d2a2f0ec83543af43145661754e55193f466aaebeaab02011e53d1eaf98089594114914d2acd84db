import { OnSuccess } from "./OnSuccess";
import { OnUnknown } from "./OnUnknown";
import { LanguageIdOutput } from "./LanguageIdOutput";
/**
 * The enum that represents which mode will language detection take place
 * There is only detectAtAudioStart mode for now as language detection models are not trained for different modes
 * This enum can be extended in future to support different modes
 */
export declare enum LanguageIdDetectionMode {
    DetectAtAudioStart = "DetectAtAudioStart",
    DetectContinuous = "DetectContinuous",
    DetectSegments = "DetectSegments"
}
/**
 * The language id detection mode, setting this will load the detection setting of MaxAudioDuration and MaxSpeechDuration
 * If the maxAudioDuration and maxSpeechDuration is set in the speech.context, then this detection mode will be ignored
 */
export declare enum LanguageIdDetectionPriority {
    /**
     * default, Service decides the best mode to use.
     */
    Auto = "Auto",
    /**
     * Offers lower latency via a trade-off of accuracy.
     */
    PrioritizeLatency = "PrioritizeLatency",
    /**
     * Offers higher accuracy via a trade-off of latency.
     */
    PrioritizeAccuracy = "PrioritizeAccuracy"
}
/**
 * The language id context
 */
export interface LanguageIdContext {
    /**
     * The candidate languages for speaker language detection.
     */
    languages: string[];
    /**
     * The on success action.
     */
    onSuccess?: OnSuccess;
    /**
     * The language detection mode.
     */
    mode?: LanguageIdDetectionMode;
    /**
     * The fallback language.
     */
    onUnknown?: OnUnknown;
    /**
     * The output
     */
    output?: LanguageIdOutput;
    /**
     * The max audio duration
     */
    maxAudioDuration?: number;
    /**
     * The max speech duration
     */
    maxSpeechDuration?: number;
    /**
     * The priority.
     */
    priority?: LanguageIdDetectionPriority;
}
