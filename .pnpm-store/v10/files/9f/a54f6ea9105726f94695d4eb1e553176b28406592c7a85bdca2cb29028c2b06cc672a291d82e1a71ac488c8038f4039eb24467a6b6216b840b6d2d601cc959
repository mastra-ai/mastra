import { SpeakerResponse } from "../common.speech/Exports.js";
import { CancellationDetailsBase, CancellationErrorCode, PropertyCollection, ResultReason } from "./Exports.js";
export declare enum SpeakerRecognitionResultType {
    Verify = 0,
    Identify = 1
}
/**
 * Output format
 * @class SpeakerRecognitionResult
 */
export declare class SpeakerRecognitionResult {
    private privReason;
    private privProperties;
    private privProfileId;
    private privScore;
    private privErrorDetails;
    constructor(response: SpeakerResponse, resultReason?: ResultReason, cancellationErrorCode?: CancellationErrorCode, errorDetails?: string);
    get properties(): PropertyCollection;
    get reason(): ResultReason;
    get profileId(): string;
    get errorDetails(): string;
    get score(): number;
}
/**
 * @class SpeakerRecognitionCancellationDetails
 */
export declare class SpeakerRecognitionCancellationDetails extends CancellationDetailsBase {
    private constructor();
    /**
     * Creates an instance of SpeakerRecognitionCancellationDetails object for the canceled SpeakerRecognitionResult
     * @member SpeakerRecognitionCancellationDetails.fromResult
     * @function
     * @public
     * @param {SpeakerRecognitionResult} result - The result that was canceled.
     * @returns {SpeakerRecognitionCancellationDetails} The cancellation details object being created.
     */
    static fromResult(result: SpeakerRecognitionResult): SpeakerRecognitionCancellationDetails;
}
