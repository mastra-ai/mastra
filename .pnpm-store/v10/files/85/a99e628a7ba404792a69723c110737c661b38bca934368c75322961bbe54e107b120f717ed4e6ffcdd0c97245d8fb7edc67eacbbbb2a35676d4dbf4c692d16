import { CancellationDetailsBase, PropertyCollection, ResultReason } from "./Exports.js";
/**
 * Output format
 * @class VoiceProfileResult
 */
export declare class VoiceProfileResult {
    private privReason;
    private privProperties;
    private privErrorDetails;
    constructor(reason: ResultReason, statusText: string);
    get reason(): ResultReason;
    get properties(): PropertyCollection;
    get errorDetails(): string;
}
/**
 * @class VoiceProfileCancellationDetails
 */
export declare class VoiceProfileCancellationDetails extends CancellationDetailsBase {
    private constructor();
    /**
     * Creates an instance of VoiceProfileCancellationDetails object for the canceled VoiceProfileResult.
     * @member VoiceProfileCancellationDetails.fromResult
     * @function
     * @public
     * @param {VoiceProfileResult} result - The result that was canceled.
     * @returns {VoiceProfileCancellationDetails} The cancellation details object being created.
     */
    static fromResult(result: VoiceProfileResult): VoiceProfileCancellationDetails;
}
