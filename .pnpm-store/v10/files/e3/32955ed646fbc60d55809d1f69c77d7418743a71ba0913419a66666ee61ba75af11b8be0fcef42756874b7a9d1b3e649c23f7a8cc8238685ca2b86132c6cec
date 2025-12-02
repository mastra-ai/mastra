import { ConnectionEventArgs, ConversationExpirationEventArgs, ConversationTranslationCanceledEventArgs, SessionEventArgs } from "../../sdk/Exports.js";
import { ConversationReceivedTranslationEventArgs, LockRoomEventArgs, MuteAllEventArgs, ParticipantAttributeEventArgs, ParticipantEventArgs, ParticipantsListEventArgs } from "./ConversationTranslatorEventArgs.js";
/**
 * Internal conversation data
 */
export interface IInternalConversation {
    cognitiveSpeechAuthToken: string;
    cognitiveSpeechRegion: string;
    participantId: string;
    name: string;
    description: string;
    speechModel: string;
    modalities: number;
    isApproved: boolean;
    isMuted: boolean;
    roomId: string;
    avatar: string;
    token: string;
    correlationId: string;
    requestId: string;
    isHost: boolean;
}
/**
 * The user who is participating in the conversation.
 */
export interface IInternalParticipant {
    avatar?: string;
    displayName?: string;
    id?: string;
    isHost?: boolean;
    isMuted?: boolean;
    isUsingTts?: boolean;
    profanity?: boolean;
    preferredLanguage?: string;
    translateToLanguages?: string[];
    voice?: string;
}
/** Users participating in the conversation */
export declare class InternalParticipants {
    participants: IInternalParticipant[];
    meId?: string;
    constructor(participants?: IInternalParticipant[], meId?: string);
    /**
     * Add or update a participant
     * @param value
     */
    addOrUpdateParticipant(value: IInternalParticipant): IInternalParticipant;
    /**
     * Find the participant's position in the participants list.
     * @param id
     */
    getParticipantIndex(id: string): number;
    /**
     * Find the participant by id.
     * @param id
     */
    getParticipant(id: string): IInternalParticipant;
    /**
     * Remove a participant from the participants list.
     */
    deleteParticipant(id: string): void;
    /**
     * Helper to return the conversation host.
     */
    get host(): IInternalParticipant;
    /**
     * Helper to return the current user.
     */
    get me(): IInternalParticipant;
}
/**
 * Recognizer for handling Conversation Translator websocket messages
 */
export interface ConversationRecognizer {
    isDisposed(): boolean;
    sendRequest: (command: string, cb?: () => void, err?: (e: string) => void) => void;
    cancelSpeech?: () => Promise<void>;
    close?: () => Promise<void>;
    conversationExpiration?: (sender: ConversationRecognizer, event: ConversationExpirationEventArgs) => void;
    connected?: (e: ConnectionEventArgs) => void;
    disconnected?: (e: ConnectionEventArgs) => void;
    canceled?: (sender: ConversationRecognizer, event: ConversationTranslationCanceledEventArgs) => void;
    connectionOpened?: (sender: ConversationRecognizer, event: SessionEventArgs) => void;
    connectionClosed?: (sender: ConversationRecognizer, event: SessionEventArgs) => void;
    participantsListReceived?: (sender: ConversationRecognizer, event: ParticipantsListEventArgs) => void;
    translationReceived?: (sender: ConversationRecognizer, event: ConversationReceivedTranslationEventArgs) => void;
    lockRoomCommandReceived?: (sender: ConversationRecognizer, event: LockRoomEventArgs) => void;
    muteAllCommandReceived?: (sender: ConversationRecognizer, event: MuteAllEventArgs) => void;
    participantJoinCommandReceived?: (sender: ConversationRecognizer, event: ParticipantEventArgs) => void;
    participantLeaveCommandReceived?: (sender: ConversationRecognizer, event: ParticipantEventArgs) => void;
    participantUpdateCommandReceived?: (sender: ConversationRecognizer, event: ParticipantAttributeEventArgs) => void;
    connect?: (token: string, cb?: () => void, err?: (e: string) => void) => void;
}
/**
 * Error message returned from the Conversation Translator websocket
 */
export interface IConversationResponseErrorMessage {
    code: string;
    message: string;
}
/**
 * Error returned from the Conversation Translator websocket
 */
export interface IConversationResponseError {
    error: IConversationResponseErrorMessage;
}
/**
 * Base message command
 */
export interface IClientMessage {
    type: any;
}
/**
 * Command message
 */
export interface ICommandMessage extends IClientMessage {
    command?: string;
}
/**
 * Text message command
 */
export interface IInstantMessageCommand extends ICommandMessage {
    roomId: string;
    nickname?: string;
    participantId: string;
    text: string;
}
/**
 * Lock command
 */
export interface ILockConversationCommand extends ICommandMessage {
    id?: string;
    nickname?: string;
    participantId: string;
    roomid: string;
    value: boolean;
}
/**
 * Mute all command
 */
export interface IMuteAllCommand extends ICommandMessage {
    roomid: string;
    nickname?: string;
    participantId: string;
    value: boolean;
    id?: string;
}
/**
 * Mute participant command
 */
export interface IMuteCommand extends ICommandMessage {
    roomid: string;
    nickname?: string;
    participantId: string;
    value: boolean;
    id?: string;
}
/**
 * Remove participant command
 */
export interface IEjectParticipantCommand extends ICommandMessage {
    roomid: string;
    participantId: string;
}
/**
 * Change nickname command
 */
export interface IChangeNicknameCommand extends ICommandMessage {
    roomid: string;
    participantId: string;
    nickname: string;
    value: string;
}
/**
 * List of command message types
 */
export declare const ConversationTranslatorMessageTypes: {
    command: string;
    final: string;
    info: string;
    instantMessage: string;
    keepAlive: string;
    partial: string;
    participantCommand: string;
    translatedMessage: string;
};
/**
 * List of command types
 */
export declare const ConversationTranslatorCommandTypes: {
    changeNickname: string;
    disconnectSession: string;
    ejectParticipant: string;
    instant_message: string;
    joinSession: string;
    leaveSession: string;
    participantList: string;
    roomExpirationWarning: string;
    setLockState: string;
    setMute: string;
    setMuteAll: string;
    setProfanityFiltering: string;
    setTranslateToLanguages: string;
    setUseTTS: string;
};
/**
 * HTTP response helper
 */
export interface IResponse {
    ok: boolean;
    status: number;
    statusText: string;
    data: string;
    json: <T>() => T;
    headers: string;
}
