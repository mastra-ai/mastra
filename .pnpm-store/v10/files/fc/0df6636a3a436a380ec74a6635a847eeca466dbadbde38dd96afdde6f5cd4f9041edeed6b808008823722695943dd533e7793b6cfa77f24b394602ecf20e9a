import { IntentRecognitionResult, NoMatchReason, SpeechRecognitionResult, TranslationRecognitionResult } from "./Exports.js";
/**
 * Contains detailed information for NoMatch recognition results.
 * @class NoMatchDetails
 */
export declare class NoMatchDetails {
    private privReason;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {NoMatchReason} reason - The no-match reason.
     */
    private constructor();
    /**
     * Creates an instance of NoMatchDetails object for the NoMatch SpeechRecognitionResults.
     * @member NoMatchDetails.fromResult
     * @function
     * @public
     * @param {SpeechRecognitionResult | IntentRecognitionResult | TranslationRecognitionResult}
     * result - The recognition result that was not recognized.
     * @returns {NoMatchDetails} The no match details object being created.
     */
    static fromResult(result: SpeechRecognitionResult | IntentRecognitionResult | TranslationRecognitionResult): NoMatchDetails;
    /**
     * The reason the recognition was canceled.
     * @member NoMatchDetails.prototype.reason
     * @function
     * @public
     * @returns {NoMatchReason} Specifies the reason canceled.
     */
    get reason(): NoMatchReason;
}
