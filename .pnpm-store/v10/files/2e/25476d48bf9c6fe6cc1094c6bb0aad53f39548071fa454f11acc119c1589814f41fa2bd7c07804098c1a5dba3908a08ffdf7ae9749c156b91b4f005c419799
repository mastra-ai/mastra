import { PropertyCollection } from "../Exports.js";
/**
 * Represents a user in a conversation.
 * Added in version 1.4.0
 */
export interface IUser {
    /** Gets the user's ID */
    readonly userId: string;
}
export declare class User implements IUser {
    private privUserId;
    constructor(userId: string);
    get userId(): string;
}
export interface VoiceSignature {
    Version: number;
    Tag: string;
    Data: string;
}
export interface TranscriptionParticipant {
    /** The unique identifier for the participant. */
    readonly id: string;
    /** The participant's preferred spoken language. */
    readonly preferredLanguage: string;
    /** The participant's voice signature */
    readonly voice: string;
}
/**
 * Represents a participant in a conversation.
 * Added in version 1.4.0
 */
export interface IParticipant extends TranscriptionParticipant {
    /** Gets the colour of the user's avatar as an HTML hex string (e.g. FF0000 for red). */
    readonly avatar: string;
    /**
     * The participant's display name. Please note that there may be more than one participant
     * with the same name. You can use <see cref="Id"/> property to tell them apart.
     */
    readonly displayName: string;
    /** Gets whether or not this participant is the host. */
    readonly isHost: boolean;
    /** Gets whether or not this participant is muted. */
    readonly isMuted: boolean;
    /** Gets whether or not the participant is using Text To Speech (TTS). */
    readonly isUsingTts: boolean;
    /** Contains properties of the participant. */
    readonly properties: PropertyCollection;
}
export declare class Participant implements IParticipant {
    private privAvatar;
    private privDisplayName;
    private privId;
    private privIsHost;
    private privIsMuted;
    private privIsUsingTts;
    private privPreferredLanguage;
    private privVoice;
    private privProperties;
    constructor(id: string, avatar: string, displayName: string, isHost: boolean, isMuted: boolean, isUsingTts: boolean, preferredLanguage: string, voice?: string);
    get avatar(): string;
    get displayName(): string;
    get id(): string;
    get preferredLanguage(): string;
    get isHost(): boolean;
    get isMuted(): boolean;
    get isUsingTts(): boolean;
    get voice(): string;
    get properties(): PropertyCollection;
    static From(id: string, language: string, voice: string): IParticipant;
}
