"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationRecognitionCanceledEventArgs = void 0;
/**
 * Define payload of speech recognition canceled result events.
 * @class TranslationRecognitionCanceledEventArgs
 */
class TranslationRecognitionCanceledEventArgs {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {string} sessionid - The session id.
     * @param {CancellationReason} cancellationReason - The cancellation reason.
     * @param {string} errorDetails - Error details, if provided.
     * @param {TranslationRecognitionResult} result - The result.
     */
    constructor(sessionid, cancellationReason, errorDetails, errorCode, result) {
        this.privCancelReason = cancellationReason;
        this.privErrorDetails = errorDetails;
        this.privResult = result;
        this.privSessionId = sessionid;
        this.privErrorCode = errorCode;
    }
    /**
     * Specifies the recognition result.
     * @member TranslationRecognitionCanceledEventArgs.prototype.result
     * @function
     * @public
     * @returns {TranslationRecognitionResult} the recognition result.
     */
    get result() {
        return this.privResult;
    }
    /**
     * Specifies the session identifier.
     * @member TranslationRecognitionCanceledEventArgs.prototype.sessionId
     * @function
     * @public
     * @returns {string} the session identifier.
     */
    get sessionId() {
        return this.privSessionId;
    }
    /**
     * The reason the recognition was canceled.
     * @member TranslationRecognitionCanceledEventArgs.prototype.reason
     * @function
     * @public
     * @returns {CancellationReason} Specifies the reason canceled.
     */
    get reason() {
        return this.privCancelReason;
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
     * @member TranslationRecognitionCanceledEventArgs.prototype.errorDetails
     * @function
     * @public
     * @returns {string} A String that represents the error details.
     */
    get errorDetails() {
        return this.privErrorDetails;
    }
}
exports.TranslationRecognitionCanceledEventArgs = TranslationRecognitionCanceledEventArgs;

//# sourceMappingURL=TranslationRecognitionCanceledEventArgs.js.map
