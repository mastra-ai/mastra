"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingTranscriptionEventArgs = exports.ConversationTranscriptionEventArgs = exports.SpeechRecognitionEventArgs = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("./Exports.js");
/**
 * Defines contents of speech recognizing/recognized event.
 * @class SpeechRecognitionEventArgs
 */
class SpeechRecognitionEventArgs extends Exports_js_1.RecognitionEventArgs {
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
     * @member SpeechRecognitionEventArgs.prototype.result
     * @function
     * @public
     * @returns {SpeechRecognitionResult} the recognition result.
     */
    get result() {
        return this.privResult;
    }
}
exports.SpeechRecognitionEventArgs = SpeechRecognitionEventArgs;
/**
 * Defines contents of conversation transcribed/transcribing event.
 * @class ConversationTranscriptionEventArgs
 */
class ConversationTranscriptionEventArgs extends Exports_js_1.RecognitionEventArgs {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {ConversationTranscriptionResult} result - The conversation transcription result.
     * @param {number} offset - The offset.
     * @param {string} sessionId - The session id.
     */
    constructor(result, offset, sessionId) {
        super(offset, sessionId);
        this.privResult = result;
    }
    /**
     * Specifies the transcription result.
     * @member ConversationTranscription1EventArgs.prototype.result
     * @function
     * @public
     * @returns {ConversationTranscriptionResult} the recognition result.
     */
    get result() {
        return this.privResult;
    }
}
exports.ConversationTranscriptionEventArgs = ConversationTranscriptionEventArgs;
/**
 * Defines contents of meeting transcribed/transcribing event.
 * @class MeetingTranscriptionEventArgs
 */
class MeetingTranscriptionEventArgs extends SpeechRecognitionEventArgs {
}
exports.MeetingTranscriptionEventArgs = MeetingTranscriptionEventArgs;

//# sourceMappingURL=SpeechRecognitionEventArgs.js.map
