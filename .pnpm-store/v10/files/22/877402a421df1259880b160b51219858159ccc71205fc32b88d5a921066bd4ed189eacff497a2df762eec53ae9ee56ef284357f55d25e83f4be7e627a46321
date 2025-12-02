"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceProfileEnrollmentCancellationDetails = exports.VoiceProfileEnrollmentResult = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../common.speech/Exports.js");
const Exports_js_2 = require("./Exports.js");
/**
 * Output format
 * @class VoiceProfileEnrollmentResult
 */
class VoiceProfileEnrollmentResult {
    constructor(reason, json, statusText) {
        this.privReason = reason;
        this.privProperties = new Exports_js_2.PropertyCollection();
        if (this.privReason !== Exports_js_2.ResultReason.Canceled) {
            if (!!json) {
                this.privDetails = JSON.parse(json);
                if (this.privDetails.enrollmentStatus.toLowerCase() === "enrolling") {
                    this.privReason = Exports_js_2.ResultReason.EnrollingVoiceProfile;
                }
            }
        }
        else {
            this.privErrorDetails = statusText;
            this.privProperties.setProperty(Exports_js_1.CancellationErrorCodePropertyName, Exports_js_2.CancellationErrorCode[Exports_js_2.CancellationErrorCode.ServiceError]);
        }
    }
    get reason() {
        return this.privReason;
    }
    get enrollmentsCount() {
        return this.privDetails.enrollmentsCount;
    }
    get enrollmentsLength() {
        return this.privDetails.enrollmentsLength;
    }
    get properties() {
        return this.privProperties;
    }
    get enrollmentResultDetails() {
        return this.privDetails;
    }
    get errorDetails() {
        return this.privErrorDetails;
    }
    static FromIdentificationProfileList(json) {
        const results = [];
        for (const item of json.value) {
            const reason = item.enrollmentStatus.toLowerCase() === "enrolling" ?
                Exports_js_2.ResultReason.EnrollingVoiceProfile : item.enrollmentStatus.toLowerCase() === "enrolled" ?
                Exports_js_2.ResultReason.EnrolledVoiceProfile : Exports_js_2.ResultReason.Canceled;
            const result = new VoiceProfileEnrollmentResult(reason, null, null);
            result.privDetails = this.getIdentificationDetails(item);
            results.push(result);
        }
        return results;
    }
    static FromVerificationProfileList(json) {
        const results = [];
        for (const item of json.value) {
            const reason = item.enrollmentStatus.toLowerCase() === "enrolling" ?
                Exports_js_2.ResultReason.EnrollingVoiceProfile : item.enrollmentStatus.toLowerCase() === "enrolled" ?
                Exports_js_2.ResultReason.EnrolledVoiceProfile : Exports_js_2.ResultReason.Canceled;
            const result = new VoiceProfileEnrollmentResult(reason, null, null);
            result.privDetails = this.getVerificationDetails(item);
            results.push(result);
        }
        return results;
    }
    static getIdentificationDetails(json) {
        return {
            audioLength: json.audioLength ? parseFloat(json.audioLength) : 0,
            audioSpeechLength: json.audioSpeechLength ? parseFloat(json.audioSpeechLength) : 0,
            enrollmentStatus: json.enrollmentStatus,
            enrollmentsCount: json.enrollmentsCount || 0,
            enrollmentsLength: json.enrollmentsLength ? parseFloat(json.enrollmentsLength) : 0,
            enrollmentsSpeechLength: json.enrollmentsSpeechLength ? parseFloat(json.enrollmentsSpeechLength) : 0,
            profileId: json.profileId || json.identificationProfileId,
            remainingEnrollmentsSpeechLength: json.remainingEnrollmentsSpeechLength ? parseFloat(json.remainingEnrollmentsSpeechLength) : 0
        };
    }
    static getVerificationDetails(json) {
        return {
            audioLength: json.audioLength ? parseFloat(json.audioLength) : 0,
            audioSpeechLength: json.audioSpeechLength ? parseFloat(json.audioSpeechLength) : 0,
            enrollmentStatus: json.enrollmentStatus,
            enrollmentsCount: json.enrollmentsCount,
            enrollmentsLength: json.enrollmentsLength ? parseFloat(json.enrollmentsLength) : 0,
            enrollmentsSpeechLength: json.enrollmentsSpeechLength ? parseFloat(json.enrollmentsSpeechLength) : 0,
            profileId: json.profileId || json.verificationProfileId,
            remainingEnrollmentsCount: json.remainingEnrollments || json.remainingEnrollmentsCount,
            remainingEnrollmentsSpeechLength: json.remainingEnrollmentsSpeechLength ? parseFloat(json.remainingEnrollmentsSpeechLength) : 0
        };
    }
}
exports.VoiceProfileEnrollmentResult = VoiceProfileEnrollmentResult;
/**
 * @class VoiceProfileEnrollmentCancellationDetails
 */
class VoiceProfileEnrollmentCancellationDetails extends Exports_js_2.CancellationDetailsBase {
    constructor(reason, errorDetails, errorCode) {
        super(reason, errorDetails, errorCode);
    }
    /**
     * Creates an instance of VoiceProfileEnrollmentCancellationDetails object for the canceled VoiceProfileEnrollmentResult.
     * @member VoiceProfileEnrollmentCancellationDetails.fromResult
     * @function
     * @public
     * @param {VoiceProfileEnrollmentResult} result - The result that was canceled.
     * @returns {VoiceProfileEnrollmentCancellationDetails} The cancellation details object being created.
     */
    static fromResult(result) {
        const reason = Exports_js_2.CancellationReason.Error;
        let errorCode = Exports_js_2.CancellationErrorCode.NoError;
        if (!!result.properties) {
            errorCode = Exports_js_2.CancellationErrorCode[result.properties.getProperty(Exports_js_1.CancellationErrorCodePropertyName, Exports_js_2.CancellationErrorCode[Exports_js_2.CancellationErrorCode.NoError])]; //eslint-disable-line
        }
        return new VoiceProfileEnrollmentCancellationDetails(reason, result.errorDetails, errorCode);
    }
}
exports.VoiceProfileEnrollmentCancellationDetails = VoiceProfileEnrollmentCancellationDetails;

//# sourceMappingURL=VoiceProfileEnrollmentResult.js.map
