import { ConversationRecognizer, IAuthentication, IInternalConversation, TranscriberRecognizer } from "../../common.speech/Exports.js";
import { IDisposable } from "../../common/Exports.js";
import { ConversationTranslator, Participant, PropertyCollection, SpeechTranslationConfig } from "../Exports.js";
import { Callback, ConversationInfo, IConversation } from "./IConversation.js";
import { IParticipant, IUser } from "./IParticipant.js";
export declare abstract class Conversation implements IConversation {
    protected constructor();
    abstract get authorizationToken(): string;
    abstract get config(): SpeechTranslationConfig;
    abstract get conversationId(): string;
    abstract get conversationInfo(): ConversationInfo;
    abstract get properties(): PropertyCollection;
    abstract get speechRecognitionLanguage(): string;
    abstract get participants(): Participant[];
    abstract set authorizationToken(value: string);
    abstract get isConnected(): boolean;
    /**
     * Create a conversation
     * @param speechConfig
     * @param cb
     * @param err
     */
    static createConversationAsync(speechConfig: SpeechTranslationConfig, arg2?: string | Callback, arg3?: Callback, arg4?: Callback): Conversation;
    /** Start a conversation. */
    abstract startConversationAsync(cb?: Callback, err?: Callback): void;
    /** Delete a conversation. After this no one will be able to join the conversation. */
    abstract deleteConversationAsync(cb?: Callback, err?: Callback): void;
    /** End a conversation. */
    abstract endConversationAsync(cb?: Callback, err?: Callback): void;
    /** Lock a conversation. This will prevent new participants from joining. */
    abstract lockConversationAsync(cb?: Callback, err?: Callback): void;
    /** Add Participant to Conversation. */
    abstract addParticipantAsync(participant: IParticipant, cb?: Callback, err?: Callback): void;
    /**
     * Mute all other participants in the conversation. After this no other participants will
     * have their speech recognitions broadcast, nor be able to send text messages.
     */
    abstract muteAllParticipantsAsync(cb?: Callback, err?: Callback): void;
    /**
     * Mute a participant.
     * @param userId A user identifier
     */
    abstract muteParticipantAsync(userId: string, cb?: Callback, err?: Callback): void;
    /**
     * Remove a participant from a conversation using the user id, Participant or User object
     * @param userId A user identifier
     */
    abstract removeParticipantAsync(userId: string | IParticipant | IUser, cb?: Callback, err?: Callback): void;
    /** Unlocks a conversation. */
    abstract unlockConversationAsync(cb?: Callback, err?: Callback): void;
    /** Unmute all other participants in the conversation. */
    abstract unmuteAllParticipantsAsync(cb?: Callback, err?: Callback): void;
    /**
     * Unmute a participant.
     * @param userId A user identifier
     */
    abstract unmuteParticipantAsync(userId: string, cb?: Callback, err?: Callback): void;
}
export declare class ConversationImpl extends Conversation implements IDisposable {
    private privConfig;
    private privProperties;
    private privLanguage;
    private privToken;
    private privIsDisposed;
    private privRoom;
    private privManager;
    private privConversationRecognizer;
    private privIsConnected;
    private privParticipants;
    private privIsReady;
    private privConversationTranslator;
    private privTranscriberRecognizer;
    private privErrors;
    private privConversationId;
    private readonly privTextMessageMaxLength;
    /**
     * Create a conversation impl
     * @param speechConfig
     * @param {string} id - optional conversationId
     */
    constructor(speechConfig: SpeechTranslationConfig, id?: string);
    get room(): IInternalConversation;
    get connection(): ConversationRecognizer;
    get config(): SpeechTranslationConfig;
    get conversationId(): string;
    get properties(): PropertyCollection;
    get speechRecognitionLanguage(): string;
    get isMutedByHost(): boolean;
    get isConnected(): boolean;
    get participants(): Participant[];
    get me(): Participant;
    get host(): Participant;
    get transcriberRecognizer(): TranscriberRecognizer;
    get conversationInfo(): ConversationInfo;
    private get canSend();
    private get canSendAsHost();
    get authorizationToken(): string;
    set authorizationToken(value: string);
    set conversationTranslator(conversationTranslator: ConversationTranslator);
    onToken(token: IAuthentication): void;
    /**
     * Create a new conversation as Host
     * @param cb
     * @param err
     */
    createConversationAsync(cb?: Callback, err?: Callback): void;
    /**
     * Starts a new conversation as host.
     * @param cb
     * @param err
     */
    startConversationAsync(cb?: Callback, err?: Callback): void;
    /**
     * Join a conversation as a participant.
     * @param { IParticipant } participant - participant to add
     * @param cb
     * @param err
     */
    addParticipantAsync(participant: IParticipant, cb?: Callback, err?: Callback): void;
    /**
     * Join a conversation as a participant.
     * @param conversation
     * @param nickname
     * @param lang
     * @param cb
     * @param err
     */
    joinConversationAsync(conversationId: string, nickname: string, lang: string, cb?: Callback, err?: Callback): void;
    /**
     * Deletes a conversation
     * @param cb
     * @param err
     */
    deleteConversationAsync(cb?: Callback, err?: Callback): void;
    deleteConversationImplAsync(): Promise<void>;
    /**
     * Issues a request to close the client websockets
     * @param cb
     * @param err
     */
    endConversationAsync(cb?: Callback, err?: Callback): void;
    endConversationImplAsync(): Promise<void>;
    /**
     * Issues a request to lock the conversation
     * @param cb
     * @param err
     */
    lockConversationAsync(cb?: Callback, err?: Callback): void;
    /**
     * Issues a request to mute the conversation
     * @param cb
     * @param err
     */
    muteAllParticipantsAsync(cb?: Callback, err?: Callback): void;
    /**
     * Issues a request to mute a participant in the conversation
     * @param userId
     * @param cb
     * @param err
     */
    muteParticipantAsync(userId: string, cb?: Callback, err?: Callback): void;
    /**
     * Issues a request to remove a participant from the conversation
     * @param userId
     * @param cb
     * @param err
     */
    removeParticipantAsync(userId: string | IParticipant | IUser, cb?: Callback, err?: Callback): void;
    /**
     * Issues a request to unlock the conversation
     * @param cb
     * @param err
     */
    unlockConversationAsync(cb?: Callback, err?: Callback): void;
    /**
     * Issues a request to unmute all participants in the conversation
     * @param cb
     * @param err
     */
    unmuteAllParticipantsAsync(cb?: Callback, err?: Callback): void;
    /**
     * Issues a request to unmute a participant in the conversation
     * @param userId
     * @param cb
     * @param err
     */
    unmuteParticipantAsync(userId: string, cb?: Callback, err?: Callback): void;
    /**
     * Send a text message
     * @param message
     * @param cb
     * @param err
     */
    sendTextMessageAsync(message: string, cb?: Callback, err?: Callback): void;
    /**
     * Set translated to languages
     * @param {string[]} languages - languages to translate to
     * @param cb
     * @param err
     */
    setTranslatedLanguagesAsync(languages: string[], cb?: Callback, err?: Callback): void;
    /**
     * Change nickname
     * @param {string} nickname - new nickname for the room
     * @param cb
     * @param err
     */
    changeNicknameAsync(nickname: string, cb?: Callback, err?: Callback): void;
    isDisposed(): boolean;
    dispose(): void;
    connectTranscriberRecognizer(recognizer: TranscriberRecognizer): Promise<void>;
    getKeepAlive(): string;
    /** websocket callbacks */
    private onConnected;
    private onDisconnected;
    private onCanceled;
    private onParticipantUpdateCommandReceived;
    private onLockRoomCommandReceived;
    private onMuteAllCommandReceived;
    private onParticipantJoinCommandReceived;
    private onParticipantLeaveCommandReceived;
    private onTranslationReceived;
    private onParticipantsListReceived;
    private onConversationExpiration;
    private addParticipantImplAsync;
    private removeParticipantImplAsync;
    private close;
    /** Helpers */
    private handleCallback;
    private handleError;
    /** Participant Helpers */
    private toParticipants;
    private toParticipant;
    private getMuteAllCommand;
    private getMuteCommand;
    private getLockCommand;
    private getEjectCommand;
    private getSetTranslateToLanguagesCommand;
    private getChangeNicknameCommand;
    private getMessageCommand;
}
