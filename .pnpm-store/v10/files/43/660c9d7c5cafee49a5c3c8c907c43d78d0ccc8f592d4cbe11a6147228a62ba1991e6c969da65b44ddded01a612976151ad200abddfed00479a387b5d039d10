import { CancellationEventArgs } from "./CancellationEventArgs.js";
import { CancellationErrorCode, CancellationReason, IntentRecognitionEventArgs, IntentRecognitionResult } from "./Exports.js";
/**
 * Define payload of intent recognition canceled result events.
 * @class IntentRecognitionCanceledEventArgs
 */
export declare class IntentRecognitionCanceledEventArgs extends IntentRecognitionEventArgs implements CancellationEventArgs {
    private privReason;
    private privErrorDetails;
    private privErrorCode;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {CancellationReason} result - The result of the intent recognition.
     * @param {string} offset - The offset.
     * @param {IntentRecognitionResult} sessionId - The session id.
     */
    constructor(reason: CancellationReason, errorDetails: string, errorCode: CancellationErrorCode, result?: IntentRecognitionResult, offset?: number, sessionId?: string);
    /**
     * The reason the recognition was canceled.
     * @member IntentRecognitionCanceledEventArgs.prototype.reason
     * @function
     * @public
     * @returns {CancellationReason} Specifies the reason canceled.
     */
    get reason(): CancellationReason;
    /**
     * The error code in case of an unsuccessful recognition.
     * Added in version 1.1.0.
     * @return An error code that represents the error reason.
     */
    get errorCode(): CancellationErrorCode;
    /**
     * In case of an unsuccessful recognition, provides details of the occurred error.
     * @member IntentRecognitionCanceledEventArgs.prototype.errorDetails
     * @function
     * @public
     * @returns {string} A String that represents the error details.
     */
    get errorDetails(): string;
}
