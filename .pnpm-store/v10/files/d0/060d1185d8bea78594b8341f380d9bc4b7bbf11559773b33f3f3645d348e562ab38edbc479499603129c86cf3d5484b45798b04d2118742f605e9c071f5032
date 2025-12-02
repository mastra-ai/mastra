import { DynamicGrammarBuilder } from "./Exports.js";
import { SpeechContext as SpeechServiceContext } from "./ServiceMessages/SpeechContext.js";
/**
 * Represents the JSON used in the speech.context message sent to the speech service.
 * The dynamic grammar is always refreshed from the encapsulated dynamic grammar object.
 */
export declare class SpeechContext {
    private privContext;
    private privDynamicGrammar;
    constructor(dynamicGrammar: DynamicGrammarBuilder);
    getContext(): SpeechServiceContext;
    /**
     * @Internal
     * This is only used by pronunciation assessment config.
     * Do not use externally, object returned will change without warning or notice.
     */
    setPronunciationAssessmentParams(params: string, isSpeakerDiarizationEnabled?: boolean): void;
    setDetailedOutputFormat(): void;
    setWordLevelTimings(): void;
    setSpeakerDiarizationAudioOffsetMs(audioOffsetMs: number): void;
    toJSON(): string;
}
