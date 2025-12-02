import { RecognitionEventArgs, SpeechRecognitionResult, ConversationTranscriptionResult } from "./Exports.js";
/**
 * Defines contents of speech recognizing/recognized event.
 * @class SpeechRecognitionEventArgs
 */
export declare class SpeechRecognitionEventArgs extends RecognitionEventArgs {
    private privResult;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {SpeechRecognitionResult} result - The speech recognition result.
     * @param {number} offset - The offset.
     * @param {string} sessionId - The session id.
     */
    constructor(result: SpeechRecognitionResult, offset?: number, sessionId?: string);
    /**
     * Specifies the recognition result.
     * @member SpeechRecognitionEventArgs.prototype.result
     * @function
     * @public
     * @returns {SpeechRecognitionResult} the recognition result.
     */
    get result(): SpeechRecognitionResult;
}
/**
 * Defines contents of conversation transcribed/transcribing event.
 * @class ConversationTranscriptionEventArgs
 */
export declare class ConversationTranscriptionEventArgs extends RecognitionEventArgs {
    private privResult;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {ConversationTranscriptionResult} result - The conversation transcription result.
     * @param {number} offset - The offset.
     * @param {string} sessionId - The session id.
     */
    constructor(result: ConversationTranscriptionResult, offset?: number, sessionId?: string);
    /**
     * Specifies the transcription result.
     * @member ConversationTranscription1EventArgs.prototype.result
     * @function
     * @public
     * @returns {ConversationTranscriptionResult} the recognition result.
     */
    get result(): ConversationTranscriptionResult;
}
/**
 * Defines contents of meeting transcribed/transcribing event.
 * @class MeetingTranscriptionEventArgs
 */
export declare class MeetingTranscriptionEventArgs extends SpeechRecognitionEventArgs {
}
