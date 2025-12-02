import { CancellationErrorCode, CancellationEventArgs, CancellationReason, RecognitionEventArgs } from "./Exports.js";
/**
 * Defines content of a CancellationEvent.
 * @class CancellationEventArgsBase
 */
export declare class CancellationEventArgsBase extends RecognitionEventArgs implements CancellationEventArgs {
    private privReason;
    private privErrorDetails;
    private privErrorCode;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {CancellationReason} reason - The cancellation reason.
     * @param {string} errorDetails - Error details, if provided.
     * @param {number} offset - The offset.
     * @param {string} sessionId - The session id.
     */
    constructor(reason: CancellationReason, errorDetails: string, errorCode: CancellationErrorCode, offset?: number, sessionId?: string);
    /**
     * The reason the recognition was canceled.
     * @member CancellationEventArgsBase.prototype.reason
     * @function
     * @public
     * @returns {CancellationReason} Specifies the reason canceled.
     */
    get reason(): CancellationReason;
    /**
     * The error code in case of an unsuccessful operation.
     * @return An error code that represents the error reason.
     */
    get errorCode(): CancellationErrorCode;
    /**
     * In case of an unsuccessful operation, provides details of the occurred error.
     * @member CancellationEventArgsBase.prototype.errorDetails
     * @function
     * @public
     * @returns {string} A String that represents the error details.
     */
    get errorDetails(): string;
}
