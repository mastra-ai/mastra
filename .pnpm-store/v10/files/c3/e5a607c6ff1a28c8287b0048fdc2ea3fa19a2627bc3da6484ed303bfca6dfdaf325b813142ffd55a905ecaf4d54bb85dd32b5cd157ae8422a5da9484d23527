import { AudioConfig, CancellationEventArgs, Conversation, ConversationInfo, Meeting, MeetingInfo, MeetingTranscriber, PropertyCollection, Recognizer, SpeechRecognitionEventArgs, SpeechTranslationConfig } from "../../sdk/Exports.js";
import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase, SpeechServiceConfig } from "../Exports.js";
export declare class TranscriberRecognizer extends Recognizer {
    recognizing: (sender: Recognizer, event: SpeechRecognitionEventArgs) => void;
    recognized: (sender: Recognizer, event: SpeechRecognitionEventArgs) => void;
    canceled: (sender: Recognizer, event: CancellationEventArgs) => void;
    private privDisposedRecognizer;
    private privConversation;
    private privMeeting;
    private isMeetingRecognizer;
    /**
     * TranscriberRecognizer constructor.
     * @constructor
     * @param {SpeechTranslationConfig} speechTranslationConfig - Non-audio configuration associated with the recognizer
     * @param {AudioConfig} audioConfig - An audio configuration associated with the recognizer
     */
    constructor(speechTranslationConfig: SpeechTranslationConfig, audioConfig: AudioConfig);
    get speechRecognitionLanguage(): string;
    get properties(): PropertyCollection;
    get authorizationToken(): string;
    set authorizationToken(token: string);
    set conversation(c: Conversation);
    getConversationInfo(): ConversationInfo;
    set meeting(m: Meeting);
    getMeetingInfo(): MeetingInfo;
    IsMeetingRecognizer(): boolean;
    startContinuousRecognitionAsync(cb?: () => void, err?: (e: string) => void): void;
    stopContinuousRecognitionAsync(cb?: () => void, err?: (e: string) => void): void;
    close(): Promise<void>;
    pushConversationEvent(conversationInfo: ConversationInfo, command: string): Promise<void>;
    pushMeetingEvent(meetingInfo: MeetingInfo, command: string): Promise<void>;
    enforceAudioGating(): Promise<void>;
    connectMeetingCallbacks(transcriber: MeetingTranscriber): void;
    disconnectCallbacks(): void;
    /**
     * Disposes any resources held by the object.
     * @member ConversationTranscriber.prototype.dispose
     * @function
     * @public
     * @param {boolean} disposing - true if disposing the object.
     */
    protected dispose(disposing: boolean): Promise<void>;
    protected createRecognizerConfig(speechConfig: SpeechServiceConfig): RecognizerConfig;
    protected createServiceRecognizer(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioConfig: AudioConfig, recognizerConfig: RecognizerConfig): ServiceRecognizerBase;
}
