/**
 * The grading system for the score
 */
export declare enum GradingSystemKind {
    /**
     * Five-point grading system
     */
    FivePoint = "FivePoint"
}
/**
 * The granularity for score coverage
 */
export declare enum GranularityKind {
    /**
     * Phoneme granularity
     */
    Phoneme = "Phoneme"
}
/**
 * The dimension of the score
 */
export declare enum DimensionKind {
    /**
     * Basic dimension
     */
    Basic = "Basic"
}
/**
 * The json payload for pronunciation score context in speech.context
 */
export interface PronunciationScoreContext {
    /**
     * Whether pronunciation score is enabled or not
     */
    enablePronScore: boolean;
    /**
     * The text that the input speech is following. This can help the scoring when provided.
     */
    referenceText?: string;
    /**
     * The grading system for the score
     */
    gradingSystem: GradingSystemKind;
    /**
     * The granularity for score coverage
     */
    granularity: GranularityKind;
    /**
     * The dimension of the score
     */
    dimension: DimensionKind;
    /**
     * Whether miscue is enabled or not
     */
    enableMiscue: boolean;
    /**
     * The scenario ID
     */
    scenarioId: string;
}
