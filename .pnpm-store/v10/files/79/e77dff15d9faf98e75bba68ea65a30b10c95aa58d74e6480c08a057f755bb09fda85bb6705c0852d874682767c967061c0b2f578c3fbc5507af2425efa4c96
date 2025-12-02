"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancellationDetailsBase = void 0;
/**
 * Contains detailed information about why a result was canceled.
 * @class CancellationDetailsBase
 */
class CancellationDetailsBase {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {CancellationReason} reason - The cancellation reason.
     * @param {string} errorDetails - The error details, if provided.
     */
    constructor(reason, errorDetails, errorCode) {
        this.privReason = reason;
        this.privErrorDetails = errorDetails;
        this.privErrorCode = errorCode;
    }
    /**
     * The reason the recognition was canceled.
     * @member CancellationDetailsBase.prototype.reason
     * @function
     * @public
     * @returns {CancellationReason} Specifies the reason canceled.
     */
    get reason() {
        return this.privReason;
    }
    /**
     * In case of an unsuccessful recognition, provides details of the occurred error.
     * @member CancellationDetailsBase.prototype.errorDetails
     * @function
     * @public
     * @returns {string} A String that represents the error details.
     */
    get errorDetails() {
        return this.privErrorDetails;
    }
    /**
     * The error code in case of an unsuccessful recognition.
     * Added in version 1.1.0.
     * @return An error code that represents the error reason.
     */
    get ErrorCode() {
        return this.privErrorCode;
    }
}
exports.CancellationDetailsBase = CancellationDetailsBase;

//# sourceMappingURL=CancellationDetailsBase.js.map
