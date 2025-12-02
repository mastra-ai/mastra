"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentRecognitionCanceledEventArgs = void 0;
const Exports_js_1 = require("./Exports.js");
/**
 * Define payload of intent recognition canceled result events.
 * @class IntentRecognitionCanceledEventArgs
 */
class IntentRecognitionCanceledEventArgs extends Exports_js_1.IntentRecognitionEventArgs {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {CancellationReason} result - The result of the intent recognition.
     * @param {string} offset - The offset.
     * @param {IntentRecognitionResult} sessionId - The session id.
     */
    constructor(reason, errorDetails, errorCode, result, offset, sessionId) {
        super(result, offset, sessionId);
        this.privReason = reason;
        this.privErrorDetails = errorDetails;
        this.privErrorCode = errorCode;
    }
    /**
     * The reason the recognition was canceled.
     * @member IntentRecognitionCanceledEventArgs.prototype.reason
     * @function
     * @public
     * @returns {CancellationReason} Specifies the reason canceled.
     */
    get reason() {
        return this.privReason;
    }
    /**
     * The error code in case of an unsuccessful recognition.
     * Added in version 1.1.0.
     * @return An error code that represents the error reason.
     */
    get errorCode() {
        return this.privErrorCode;
    }
    /**
     * In case of an unsuccessful recognition, provides details of the occurred error.
     * @member IntentRecognitionCanceledEventArgs.prototype.errorDetails
     * @function
     * @public
     * @returns {string} A String that represents the error details.
     */
    get errorDetails() {
        return this.privErrorDetails;
    }
}
exports.IntentRecognitionCanceledEventArgs = IntentRecognitionCanceledEventArgs;

//# sourceMappingURL=IntentRecognitionCanceledEventArgs.js.map
