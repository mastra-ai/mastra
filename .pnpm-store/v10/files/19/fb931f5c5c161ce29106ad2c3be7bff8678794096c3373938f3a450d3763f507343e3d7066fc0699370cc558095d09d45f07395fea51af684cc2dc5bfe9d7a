import { AudioConfig, CancellationEventArgs, Connection, MeetingTranscriptionEventArgs, PropertyCollection, SessionEventArgs } from "../Exports.js";
import { MeetingHandler, MeetingTranscriptionHandler } from "./Exports.js";
import { Callback, IMeeting } from "./IMeeting.js";
export declare class MeetingTranscriber implements MeetingTranscriptionHandler {
    /**
     * The event canceled signals that an error occurred during the meeting.
     * @member MeetingTranscriber.prototype.MeetingCanceled
     * @function
     * @public
     */
    MeetingCanceled: (sender: MeetingHandler, event: CancellationEventArgs) => void;
    /**
     * The event canceled signals that an error occurred during transcription.
     * @member MeetingTranscriber.prototype.canceled
     * @function
     * @public
     */
    canceled: (sender: MeetingHandler, event: CancellationEventArgs) => void;
    /**
     * The event recognized signals that a final meeting transcription result is received.
     * @member MeetingTranscriber.prototype.transcribed
     * @function
     * @public
     */
    transcribed: (sender: MeetingTranscriptionHandler, event: MeetingTranscriptionEventArgs) => void;
    /**
     * The event recognizing signals that an intermediate meeting transcription result is received.
     * @member MeetingTranscriber.prototype.transcribing
     * @function
     * @public
     */
    transcribing: (sender: MeetingTranscriptionHandler, event: MeetingTranscriptionEventArgs) => void;
    /**
     * Defines event handler for session started events.
     * @member MeetingTranscriber.prototype.sessionStarted
     * @function
     * @public
     */
    sessionStarted: (sender: MeetingHandler, event: SessionEventArgs) => void;
    /**
     * Defines event handler for session stopped events.
     * @member MeetingTranscriber.prototype.sessionStopped
     * @function
     * @public
     */
    sessionStopped: (sender: MeetingHandler, event: SessionEventArgs) => void;
    /**
     * Defines event handler for meeting started events.
     * @member MeetingTranscriber.prototype.MeetingStarted
     * @function
     * @public
     */
    MeetingStarted: (sender: MeetingHandler, event: SessionEventArgs) => void;
    /**
     * Defines event handler for meeting stopped events.
     * @member MeetingTranscriber.prototype.MeetingStopped
     * @function
     * @public
     */
    meetingStopped: (sender: MeetingHandler, event: SessionEventArgs) => void;
    protected privAudioConfig: AudioConfig;
    private privDisposedRecognizer;
    private privRecognizer;
    private privProperties;
    /**
     * MeetingTranscriber constructor.
     * @constructor
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    constructor(audioConfig?: AudioConfig);
    /**
     * Gets the spoken language of recognition.
     * @member MeetingTranscriber.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @returns {string} The spoken language of recognition.
     */
    get speechRecognitionLanguage(): string;
    /**
     * The collection of properties and their values defined for this MeetingTranscriber.
     * @member MeetingTranscriber.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this MeetingTranscriber.
     */
    get properties(): PropertyCollection;
    /**
     * @Internal
     * Internal data member to support fromRecognizer* pattern methods on other classes.
     * Do not use externally, object returned will change without warning or notice.
     */
    get internalData(): object;
    /**
     * @Deprecated
     * @Obsolete
     * Please use the Connection.fromRecognizer pattern to obtain a connection object
     */
    get connection(): Connection;
    /**
     * Gets the authorization token used to communicate with the service.
     * @member MeetingTranscriber.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken(): string;
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member MeetingTranscriber.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token: string);
    /**
     * @param {Meeting} meeting - meeting to be recognized
     */
    joinMeetingAsync(meeting: IMeeting, cb?: Callback, err?: Callback): void;
    /**
     * Starts meeting transcription, until stopTranscribingAsync() is called.
     * User must subscribe to events to receive transcription results.
     * @member MeetingTranscriber.prototype.startTranscribingAsync
     * @function
     * @public
     * @param cb - Callback invoked once the transcription has started.
     * @param err - Callback invoked in case of an error.
     */
    startTranscribingAsync(cb?: Callback, err?: Callback): void;
    /**
     * Starts meeting transcription, until stopTranscribingAsync() is called.
     * User must subscribe to events to receive transcription results.
     * @member MeetingTranscriber.prototype.stopTranscribingAsync
     * @function
     * @public
     * @param cb - Callback invoked once the transcription has started.
     * @param err - Callback invoked in case of an error.
     */
    stopTranscribingAsync(cb?: Callback, err?: Callback): void;
    /**
     * Leave the current meeting. After this is called, you will no longer receive any events.
     */
    leaveMeetingAsync(cb?: Callback, err?: Callback): void;
    /**
     * closes all external resources held by an instance of this class.
     * @member MeetingTranscriber.prototype.close
     * @function
     * @public
     */
    close(cb?: () => void, errorCb?: (error: string) => void): void;
    /**
     * Disposes any resources held by the object.
     * @member MeetingTranscriber.prototype.dispose
     * @function
     * @public
     * @param {boolean} disposing - true if disposing the object.
     */
    protected dispose(disposing: boolean): Promise<void>;
}
