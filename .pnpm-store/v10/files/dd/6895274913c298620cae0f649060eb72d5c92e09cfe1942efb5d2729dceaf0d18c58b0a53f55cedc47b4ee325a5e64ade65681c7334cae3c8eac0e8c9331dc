"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancellationEventArgsBase = void 0;
const Exports_js_1 = require("./Exports.js");
/**
 * Defines content of a CancellationEvent.
 * @class CancellationEventArgsBase
 */
class CancellationEventArgsBase extends Exports_js_1.RecognitionEventArgs {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {CancellationReason} reason - The cancellation reason.
     * @param {string} errorDetails - Error details, if provided.
     * @param {number} offset - The offset.
     * @param {string} sessionId - The session id.
     */
    constructor(reason, errorDetails, errorCode, offset, sessionId) {
        super(offset, sessionId);
        this.privReason = reason;
        this.privErrorDetails = errorDetails;
        this.privErrorCode = errorCode;
    }
    /**
     * The reason the recognition was canceled.
     * @member CancellationEventArgsBase.prototype.reason
     * @function
     * @public
     * @returns {CancellationReason} Specifies the reason canceled.
     */
    get reason() {
        return this.privReason;
    }
    /**
     * The error code in case of an unsuccessful operation.
     * @return An error code that represents the error reason.
     */
    get errorCode() {
        return this.privErrorCode;
    }
    /**
     * In case of an unsuccessful operation, provides details of the occurred error.
     * @member CancellationEventArgsBase.prototype.errorDetails
     * @function
     * @public
     * @returns {string} A String that represents the error details.
     */
    get errorDetails() {
        return this.privErrorDetails;
    }
}
exports.CancellationEventArgsBase = CancellationEventArgsBase;

//# sourceMappingURL=CancellationEventArgsBase.js.map
