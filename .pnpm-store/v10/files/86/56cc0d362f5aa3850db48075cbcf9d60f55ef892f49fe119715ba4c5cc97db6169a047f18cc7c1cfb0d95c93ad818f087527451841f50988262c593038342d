import { CancellationErrorCode, CancellationReason } from "./Exports.js";
export interface CancellationEventArgs {
    readonly sessionId: string;
    readonly offset: number;
    readonly reason: CancellationReason;
    readonly errorCode: CancellationErrorCode;
    /**
     * In case of an unsuccessful recognition, provides details of the occurred error.
     * @member CancellationEventArgs.prototype.errorDetails
     * @function
     * @public
     * @returns {string} A String that represents the error details.
     */
    readonly errorDetails: string;
}
