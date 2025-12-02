import { CancellationErrorCode, CancellationReason, TranslationRecognitionResult } from "./Exports.js";
/**
 * Define payload of speech recognition canceled result events.
 * @class TranslationRecognitionCanceledEventArgs
 */
export declare class TranslationRecognitionCanceledEventArgs {
    private privResult;
    private privSessionId;
    private privCancelReason;
    private privErrorDetails;
    private privErrorCode;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {string} sessionid - The session id.
     * @param {CancellationReason} cancellationReason - The cancellation reason.
     * @param {string} errorDetails - Error details, if provided.
     * @param {TranslationRecognitionResult} result - The result.
     */
    constructor(sessionid: string, cancellationReason: CancellationReason, errorDetails: string, errorCode: CancellationErrorCode, result: TranslationRecognitionResult);
    /**
     * Specifies the recognition result.
     * @member TranslationRecognitionCanceledEventArgs.prototype.result
     * @function
     * @public
     * @returns {TranslationRecognitionResult} the recognition result.
     */
    get result(): TranslationRecognitionResult;
    /**
     * Specifies the session identifier.
     * @member TranslationRecognitionCanceledEventArgs.prototype.sessionId
     * @function
     * @public
     * @returns {string} the session identifier.
     */
    get sessionId(): string;
    /**
     * The reason the recognition was canceled.
     * @member TranslationRecognitionCanceledEventArgs.prototype.reason
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
     * @member TranslationRecognitionCanceledEventArgs.prototype.errorDetails
     * @function
     * @public
     * @returns {string} A String that represents the error details.
     */
    get errorDetails(): string;
}
