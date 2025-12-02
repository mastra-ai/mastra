"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingTranscriptionEventArgs = void 0;
const Exports_js_1 = require("../Exports.js");
/**
 * Defines contents of speech recognizing/recognized event.
 * @class SpeechRecognitionEventArgs
 */
class MeetingTranscriptionEventArgs extends Exports_js_1.RecognitionEventArgs {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {SpeechRecognitionResult} result - The speech recognition result.
     * @param {number} offset - The offset.
     * @param {string} sessionId - The session id.
     */
    constructor(result, offset, sessionId) {
        super(offset, sessionId);
        this.privResult = result;
    }
    /**
     * Specifies the recognition result.
     * @member MeetingTranscriptionEventArgs.prototype.result
     * @function
     * @public
     * @returns {SpeechRecognitionResult} the recognition result.
     */
    get result() {
        return this.privResult;
    }
}
exports.MeetingTranscriptionEventArgs = MeetingTranscriptionEventArgs;

//# sourceMappingURL=MeetingTranscriptionEventArgs.js.map
