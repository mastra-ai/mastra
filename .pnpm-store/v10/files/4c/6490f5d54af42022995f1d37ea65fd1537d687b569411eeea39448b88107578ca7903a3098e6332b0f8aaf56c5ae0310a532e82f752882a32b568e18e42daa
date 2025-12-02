import { InvocationSource } from "./InvocationSource";
import { KeywordDetection } from "./KeywordDetection/KeywordDetection";
import { PhraseDetectionContext } from "./PhraseDetection/PhraseDetectionContext";
import { Intent } from "./Intent/Intent";
import { Dgi } from "./Dgi/Dgi";
import { PhraseOutput } from "./PhraseOutput/PhraseOutput";
import { LanguageIdContext } from "./LanguageId/LanguageIdContext";
import { TranslationContext } from "./Translation/TranslationContext";
import { SynthesisContext } from "./Synthesis/SynthesisContext";
import { PronunciationScoreContext } from "./PronunciationScore/PronunciationScoreContext";
import { CtsAudioContinuation } from "./MultichannelAudio/CtsAudioContinuation";
import { Dictation } from "./Scenario/Dictation";
/**
 * The speech context type.
 * Note: Deserialization won't fail if certain context attribute is null since they are all optional.
 * This interface will eventually support all speech context use cases, in practice, depending on the use case
 * only a portion of the following context attributes will be present during deserialization.
 */
export interface SpeechContext {
    /**
     * CTS Continuation token for audio stream
     */
    continuation?: CtsAudioContinuation;
    /**
     * The invocation source.
     */
    invocationSource?: InvocationSource;
    /**
     * The keyword detection.
     */
    keywordDetection?: KeywordDetection[];
    /**
     * The dictation.
     */
    dictation?: Dictation;
    /**
     * The phrase detection.
     */
    phraseDetection?: PhraseDetectionContext;
    /**
     * The intent context
     */
    intent?: Intent;
    /**
     * Dynamic Grammar Information
     */
    dgi?: Dgi;
    /**
     * Phrase Output
     */
    phraseOutput?: PhraseOutput;
    /**
     * The language identifier.
     */
    languageId?: LanguageIdContext;
    /**
     * The translation.
     */
    translation?: TranslationContext;
    /**
     * The synthesis.
     */
    synthesis?: SynthesisContext;
    /**
     * The pronunciaion score configuration.
     */
    pronunciationScore?: PronunciationScoreContext;
    /**
     * Allow adding ability to add custom context attributes.
     * This is useful for adding custom context attributes that are not part of the Speech SDK.
     */
    [key: string]: any;
}
