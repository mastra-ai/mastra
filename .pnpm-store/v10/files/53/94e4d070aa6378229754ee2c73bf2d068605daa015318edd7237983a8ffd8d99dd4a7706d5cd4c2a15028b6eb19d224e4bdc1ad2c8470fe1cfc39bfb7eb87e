import { CancellationErrorCode, CancellationReason } from "./Exports.js";
/**
 * Contains detailed information about why a result was canceled.
 * @class CancellationDetailsBase
 */
export declare class CancellationDetailsBase {
    private privReason;
    private privErrorDetails;
    private privErrorCode;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {CancellationReason} reason - The cancellation reason.
     * @param {string} errorDetails - The error details, if provided.
     */
    protected constructor(reason: CancellationReason, errorDetails: string, errorCode: CancellationErrorCode);
    /**
     * The reason the recognition was canceled.
     * @member CancellationDetailsBase.prototype.reason
     * @function
     * @public
     * @returns {CancellationReason} Specifies the reason canceled.
     */
    get reason(): CancellationReason;
    /**
     * In case of an unsuccessful recognition, provides details of the occurred error.
     * @member CancellationDetailsBase.prototype.errorDetails
     * @function
     * @public
     * @returns {string} A String that represents the error details.
     */
    get errorDetails(): string;
    /**
     * The error code in case of an unsuccessful recognition.
     * Added in version 1.1.0.
     * @return An error code that represents the error reason.
     */
    get ErrorCode(): CancellationErrorCode;
}
