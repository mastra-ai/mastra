"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationRecognitionEventArgs = void 0;
const Exports_js_1 = require("./Exports.js");
/**
 * Translation text result event arguments.
 * @class TranslationRecognitionEventArgs
 */
class TranslationRecognitionEventArgs extends Exports_js_1.RecognitionEventArgs {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {TranslationRecognitionResult} result - The translation recognition result.
     * @param {number} offset - The offset.
     * @param {string} sessionId - The session id.
     */
    constructor(result, offset, sessionId) {
        super(offset, sessionId);
        this.privResult = result;
    }
    /**
     * Specifies the recognition result.
     * @member TranslationRecognitionEventArgs.prototype.result
     * @function
     * @public
     * @returns {TranslationRecognitionResult} the recognition result.
     */
    get result() {
        return this.privResult;
    }
}
exports.TranslationRecognitionEventArgs = TranslationRecognitionEventArgs;

//# sourceMappingURL=TranslationRecognitionEventArgs.js.map
