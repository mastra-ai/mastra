import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase, SpeechServiceConfig } from "../../common.speech/Exports.js";
import { AudioConfig, ConnectionEventArgs, ConversationExpirationEventArgs, ConversationParticipantsChangedEventArgs, ConversationTranslationCanceledEventArgs, PropertyCollection, Recognizer, SessionEventArgs, SpeechTranslationConfig } from "../../sdk/Exports.js";
import { IConversation } from "../../sdk/Transcription/IConversation.js";
import { ConversationReceivedTranslationEventArgs, LockRoomEventArgs, MuteAllEventArgs, ParticipantAttributeEventArgs, ParticipantEventArgs, ParticipantsListEventArgs } from "./ConversationTranslatorEventArgs.js";
import { ConversationRecognizer } from "./ConversationTranslatorInterfaces.js";
export declare class ConversationRecognizerFactory {
    static fromConfig(conversation: IConversation, speechConfig: SpeechTranslationConfig, audioConfig?: AudioConfig): ConversationRecognizer;
}
/**
 * Sends messages to the Conversation Translator websocket and listens for incoming events containing websocket messages.
 * Based off the recognizers in the SDK folder.
 */
export declare class ConversationTranslatorRecognizer extends Recognizer implements ConversationRecognizer {
    private privIsDisposed;
    private privSpeechRecognitionLanguage;
    private privConnection;
    private privConversation;
    private privTimeoutToken;
    private privSetTimeout;
    private privClearTimeout;
    constructor(conversation: IConversation, speechConfig: SpeechTranslationConfig, audioConfig?: AudioConfig);
    canceled: (sender: ConversationRecognizer, event: ConversationTranslationCanceledEventArgs) => void;
    conversationExpiration: (sender: ConversationRecognizer, event: ConversationExpirationEventArgs) => void;
    lockRoomCommandReceived: (sender: ConversationRecognizer, event: LockRoomEventArgs) => void;
    muteAllCommandReceived: (sender: ConversationRecognizer, event: MuteAllEventArgs) => void;
    participantJoinCommandReceived: (sender: ConversationRecognizer, event: ParticipantEventArgs) => void;
    participantLeaveCommandReceived: (sender: ConversationRecognizer, event: ParticipantEventArgs) => void;
    participantUpdateCommandReceived: (sender: ConversationRecognizer, event: ParticipantAttributeEventArgs) => void;
    connectionOpened: (sender: ConversationRecognizer, event: SessionEventArgs) => void;
    connectionClosed: (sender: ConversationRecognizer, event: SessionEventArgs) => void;
    translationReceived: (sender: ConversationRecognizer, event: ConversationReceivedTranslationEventArgs) => void;
    participantsListReceived: (sender: ConversationRecognizer, event: ParticipantsListEventArgs) => void;
    participantsChanged: (sender: ConversationRecognizer, event: ConversationParticipantsChangedEventArgs) => void;
    set connected(cb: (e: ConnectionEventArgs) => void);
    set disconnected(cb: (e: ConnectionEventArgs) => void);
    /**
     * Return the speech language used by the recognizer
     */
    get speechRecognitionLanguage(): string;
    /**
     * Return the properties for the recognizer
     */
    get properties(): PropertyCollection;
    isDisposed(): boolean;
    /**
     * Connect to the recognizer
     * @param token
     */
    connect(token: string, cb?: () => void, err?: (e: string) => void): void;
    /**
     * Disconnect from the recognizer
     */
    disconnect(cb?: () => void, err?: (e: string) => void): void;
    /**
     * Send the mute all participants command to the websocket
     * @param conversationId
     * @param participantId
     * @param isMuted
     */
    sendRequest(command: string, cb?: () => void, err?: (e: string) => void): void;
    /**
     * Handle update of service auth token (#694)
     */
    onToken(token: IAuthentication): void;
    /**
     * Close and dispose the recognizer
     */
    close(): Promise<void>;
    /**
     * Dispose the recognizer
     * @param disposing
     */
    protected dispose(disposing: boolean): Promise<void>;
    /**
     * Create the config for the recognizer
     * @param speechConfig
     */
    protected createRecognizerConfig(speechConfig: SpeechServiceConfig): RecognizerConfig;
    /**
     * Create the service recognizer.
     * The audio source is redundnant here but is required by the implementation.
     * @param authentication
     * @param connectionFactory
     * @param audioConfig
     * @param recognizerConfig
     */
    protected createServiceRecognizer(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioConfig: AudioConfig, recognizerConfig: RecognizerConfig): ServiceRecognizerBase;
    private sendMessage;
    private resetConversationTimeout;
}
