/**
 * The enum of grading system for the score
 */
export declare enum GradingSystemKind {
    FivePoint = "FivePoint",
    HundredMark = "HundredMark"
}
/**
 * The enum of granularity for score coverage
 */
export declare enum GranularityKind {
    Phoneme = "Phoneme",
    Word = "Word",
    FullText = "FullText"
}
/**
 * The enum of dimension of the score
 */
export declare enum DimensionKind {
    Basic = "Basic",
    Comprehensive = "Comprehensive"
}
/**
 * The kind of phoneme alphabet
 */
export declare enum PhonemeAlphabetKind {
    SAPI = "SAPI",
    IPA = "IPA"
}
/**
 * The json payload for pronunciation assessment options
 */
export interface PronunciationAssessmentOptions {
    /**
     * The text that the input speech is following. This can help the assessment when provided.
     */
    referenceText?: string;
    /**
     * The grading system for the score
     */
    gradingSystem?: GradingSystemKind;
    /**
     * The granularity for score coverage
     */
    granularity?: GranularityKind;
    /**
     * The dimension of the score
     */
    dimension?: DimensionKind;
    /**
     * The phoneme alphabet
     */
    phonemeAlphabet?: PhonemeAlphabetKind;
    /**
     * The count of nbest phoneme
     */
    nBestPhonemeCount?: number;
    /**
     * Whether enable miscue or not
     */
    enableMiscue?: boolean;
    /**
     * Whether enable prosody assessment or not
     */
    enableProsodyAssessment?: boolean;
    /**
     * Whether enable two pass unscripted assessment or not
     */
    enableTwoPassUnscriptedAssessment?: boolean;
    /**
     * The scenario ID
     */
    scenarioId?: string;
}
