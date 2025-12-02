"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceProfileCancellationDetails = exports.VoiceProfileResult = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../common.speech/Exports.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_2 = require("./Exports.js");
/**
 * Output format
 * @class VoiceProfileResult
 */
class VoiceProfileResult {
    constructor(reason, statusText) {
        this.privReason = reason;
        this.privProperties = new Exports_js_2.PropertyCollection();
        if (reason === Exports_js_2.ResultReason.Canceled) {
            Contracts_js_1.Contracts.throwIfNullOrUndefined(statusText, "statusText");
            this.privErrorDetails = statusText;
            this.privProperties.setProperty(Exports_js_1.CancellationErrorCodePropertyName, Exports_js_2.CancellationErrorCode[Exports_js_2.CancellationErrorCode.ServiceError]);
        }
    }
    get reason() {
        return this.privReason;
    }
    get properties() {
        return this.privProperties;
    }
    get errorDetails() {
        return this.privErrorDetails;
    }
}
exports.VoiceProfileResult = VoiceProfileResult;
/**
 * @class VoiceProfileCancellationDetails
 */
class VoiceProfileCancellationDetails extends Exports_js_2.CancellationDetailsBase {
    constructor(reason, errorDetails, errorCode) {
        super(reason, errorDetails, errorCode);
    }
    /**
     * Creates an instance of VoiceProfileCancellationDetails object for the canceled VoiceProfileResult.
     * @member VoiceProfileCancellationDetails.fromResult
     * @function
     * @public
     * @param {VoiceProfileResult} result - The result that was canceled.
     * @returns {VoiceProfileCancellationDetails} The cancellation details object being created.
     */
    static fromResult(result) {
        const reason = Exports_js_2.CancellationReason.Error;
        let errorCode = Exports_js_2.CancellationErrorCode.NoError;
        if (!!result.properties) {
            errorCode = Exports_js_2.CancellationErrorCode[result.properties.getProperty(Exports_js_1.CancellationErrorCodePropertyName, Exports_js_2.CancellationErrorCode[Exports_js_2.CancellationErrorCode.NoError])]; //eslint-disable-line
        }
        return new VoiceProfileCancellationDetails(reason, result.errorDetails, errorCode);
    }
}
exports.VoiceProfileCancellationDetails = VoiceProfileCancellationDetails;

//# sourceMappingURL=VoiceProfileResult.js.map
