import { IAuthentication } from "../../common.speech/Exports.js";
import { IDisposable } from "../../common/Exports.js";
import { AudioConfig, PropertyCollection, SessionEventArgs, TranslationRecognitionEventArgs } from "../Exports.js";
import { ConversationCommon, ConversationExpirationEventArgs, ConversationHandler, ConversationParticipantsChangedEventArgs, ConversationTranslationCanceledEventArgs, ConversationTranslationEventArgs, IConversationTranslator, Participant } from "./Exports.js";
import { Callback, IConversation } from "./IConversation.js";
export declare enum SpeechState {
    Inactive = 0,
    Connecting = 1,
    Connected = 2
}
/**
 * Join, leave or connect to a conversation.
 */
export declare class ConversationTranslator extends ConversationCommon implements IConversationTranslator, IDisposable {
    canceled: (sender: ConversationHandler, event: ConversationTranslationCanceledEventArgs) => void;
    conversationExpiration: (sender: IConversationTranslator, event: ConversationExpirationEventArgs) => void;
    participantsChanged: (sender: IConversationTranslator, event: ConversationParticipantsChangedEventArgs) => void;
    sessionStarted: (sender: ConversationHandler, event: SessionEventArgs) => void;
    sessionStopped: (sender: ConversationHandler, event: SessionEventArgs) => void;
    textMessageReceived: (sender: IConversationTranslator, event: ConversationTranslationEventArgs) => void;
    transcribed: (sender: IConversationTranslator, event: ConversationTranslationEventArgs) => void;
    transcribing: (sender: IConversationTranslator, event: ConversationTranslationEventArgs) => void;
    recognized: (sender: IConversationTranslator, event: TranslationRecognitionEventArgs) => void;
    recognizing: (sender: IConversationTranslator, event: TranslationRecognitionEventArgs) => void;
    private privSpeechRecognitionLanguage;
    private privProperties;
    private privIsDisposed;
    private privCTRecognizer;
    private privIsSpeaking;
    private privConversation;
    private privErrors;
    private privPlaceholderKey;
    private privPlaceholderRegion;
    constructor(audioConfig?: AudioConfig);
    get properties(): PropertyCollection;
    get speechRecognitionLanguage(): string;
    get participants(): Participant[];
    private get canSpeak();
    onToken(token: IAuthentication): void;
    setServiceProperty(name: string, value: string): void;
    /**
     * Join a conversation. If this is the host, pass in the previously created Conversation object.
     * @param conversation
     * @param nickname
     * @param lang
     * @param cb
     * @param err
     */
    joinConversationAsync(conversation: IConversation, nickname: string, cb?: Callback, err?: Callback): void;
    joinConversationAsync(conversationId: string, nickname: string, lang: string, cb?: Callback, err?: Callback): void;
    /**
     * Leave the conversation
     * @param cb
     * @param err
     */
    leaveConversationAsync(cb?: Callback, err?: Callback): void;
    /**
     * Send a text message
     * @param message
     * @param cb
     * @param err
     */
    sendTextMessageAsync(message: string, cb?: Callback, err?: Callback): void;
    /**
     * Start speaking
     * @param cb
     * @param err
     */
    startTranscribingAsync(cb?: Callback, err?: Callback): void;
    /**
     * Stop speaking
     * @param cb
     * @param err
     */
    stopTranscribingAsync(cb?: Callback, err?: Callback): void;
    isDisposed(): boolean;
    dispose(reason?: string, success?: () => void, err?: (error: string) => void): void;
    /**
     * Cancel the speech websocket
     */
    private cancelSpeech;
    /**
     * Connect to the speech translation recognizer.
     * Currently there is no language validation performed before sending the SpeechLanguage code to the service.
     * If it's an invalid language the raw error will be: 'Error during WebSocket handshake: Unexpected response code: 400'
     * e.g. pass in 'fr' instead of 'fr-FR', or a text-only language 'cy'
     */
    private connectTranslatorRecognizer;
    /**
     * Handle the start speaking request
     */
    private startContinuousRecognition;
}
