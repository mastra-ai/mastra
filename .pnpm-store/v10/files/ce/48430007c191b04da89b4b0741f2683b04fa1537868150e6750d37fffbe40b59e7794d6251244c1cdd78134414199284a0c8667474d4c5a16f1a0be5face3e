import { CancellationDetailsBase, PropertyCollection, ResultReason } from "./Exports.js";
export interface EnrollmentResultDetails {
    profileId: string;
    enrollmentsCount: number;
    enrollmentsLength: number;
    enrollmentsSpeechLength: number;
    remainingEnrollmentsCount: number;
    remainingEnrollmentsSpeechLength: number;
    audioLength: number;
    audioSpeechLength: number;
    enrollmentStatus: string;
}
export interface EnrollmentResultJSON {
    profileId: string;
    enrollmentsCount: number;
    enrollmentsLength: string;
    enrollmentsSpeechLength: string;
    remainingEnrollmentsCount: number;
    remainingEnrollmentsSpeechLength: string;
    audioLength: string;
    audioSpeechLength: string;
    enrollmentStatus: string;
    remainingEnrollments?: number;
    identificationProfileId?: string;
    verificationProfileId?: string;
}
/**
 * Output format
 * @class VoiceProfileEnrollmentResult
 */
export declare class VoiceProfileEnrollmentResult {
    private privReason;
    private privDetails;
    private privProperties;
    private privErrorDetails;
    constructor(reason: ResultReason, json: string, statusText: string);
    get reason(): ResultReason;
    get enrollmentsCount(): number;
    get enrollmentsLength(): number;
    get properties(): PropertyCollection;
    get enrollmentResultDetails(): EnrollmentResultDetails;
    get errorDetails(): string;
    static FromIdentificationProfileList(json: {
        value: EnrollmentResultJSON[];
    }): VoiceProfileEnrollmentResult[];
    static FromVerificationProfileList(json: {
        value: EnrollmentResultJSON[];
    }): VoiceProfileEnrollmentResult[];
    private static getIdentificationDetails;
    private static getVerificationDetails;
}
/**
 * @class VoiceProfileEnrollmentCancellationDetails
 */
export declare class VoiceProfileEnrollmentCancellationDetails extends CancellationDetailsBase {
    private constructor();
    /**
     * Creates an instance of VoiceProfileEnrollmentCancellationDetails object for the canceled VoiceProfileEnrollmentResult.
     * @member VoiceProfileEnrollmentCancellationDetails.fromResult
     * @function
     * @public
     * @param {VoiceProfileEnrollmentResult} result - The result that was canceled.
     * @returns {VoiceProfileEnrollmentCancellationDetails} The cancellation details object being created.
     */
    static fromResult(result: VoiceProfileEnrollmentResult): VoiceProfileEnrollmentCancellationDetails;
}
