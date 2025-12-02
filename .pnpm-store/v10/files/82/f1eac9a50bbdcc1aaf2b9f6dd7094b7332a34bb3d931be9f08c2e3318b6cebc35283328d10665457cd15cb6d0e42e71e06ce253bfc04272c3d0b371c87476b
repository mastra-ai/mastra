/**
 * Represents the type of keyword detection.
 */
export declare enum KeywordDetectionType {
    /**
     * Triggered at the start of input.
     */
    StartTrigger = "StartTrigger"
}
/**
 * Represents a keyword detected by the client.
 */
export interface ClientDetectedKeyword {
    /**
     * The text of the detected keyword.
     */
    text: string;
    /**
     * The confidence score of the detection.
     */
    confidence?: number;
    /**
     * The start offset in 100-nanoseconds.
     */
    startOffset?: number;
    /**
     * The duration in 100-nanoseconds.
     */
    duration?: number;
}
/**
 * The action to take when a keyword is rejected.
 */
export declare enum OnRejectAction {
    /**
     * End the current turn.
     */
    EndOfTurn = "EndOfTurn",
    /**
     * Continue processing.
     */
    Continue = "Continue"
}
/**
 * Settings for handling keyword rejection.
 */
export interface OnReject {
    /**
     * The action to take on keyword rejection.
     */
    action: OnRejectAction;
}
/**
 * Represents keyword detection configuration.
 */
export interface KeywordDetection {
    /**
     * The type of keyword detection.
     */
    type: KeywordDetectionType;
    /**
     * Keywords detected by the client.
     */
    clientDetectedKeywords: ClientDetectedKeyword[];
    /**
     * Settings for handling keyword rejection.
     */
    onReject: OnReject;
}
