"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecognitionEventArgs = void 0;
const Exports_js_1 = require("./Exports.js");
/**
 * Defines payload for session events like Speech Start/End Detected
 * @class
 */
class RecognitionEventArgs extends Exports_js_1.SessionEventArgs {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {number} offset - The offset.
     * @param {string} sessionId - The session id.
     */
    constructor(offset, sessionId) {
        super(sessionId);
        this.privOffset = offset;
    }
    /**
     * Represents the message offset
     * @member RecognitionEventArgs.prototype.offset
     * @function
     * @public
     */
    get offset() {
        return this.privOffset;
    }
}
exports.RecognitionEventArgs = RecognitionEventArgs;

//# sourceMappingURL=RecognitionEventArgs.js.map
