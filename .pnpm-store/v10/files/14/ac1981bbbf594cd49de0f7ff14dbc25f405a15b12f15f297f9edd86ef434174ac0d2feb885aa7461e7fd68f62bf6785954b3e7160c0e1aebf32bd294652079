import { PropertyCollection, SpeechTranslationConfig } from "../Exports.js";
import { IParticipant, IUser, TranscriptionParticipant } from "./IParticipant.js";
export declare type Callback = (result?: any) => void;
/**
 * Manages meetings.
 */
export interface IMeeting {
    config: SpeechTranslationConfig;
    /**
     * Gets/sets authorization token used to communicate with the service.
     * Note: The caller needs to ensure that the authorization token is valid. Before the authorization token
     * expires, the caller needs to refresh it by calling this setter with a new valid token.
     * Otherwise, the recognizer will encounter errors during recognition.
     */
    authorizationToken: string;
    /** Gets the unique identifier for the current meeting. */
    readonly meetingId: string;
    /** Gets the collection of properties and their values defined for this instance. */
    readonly properties: PropertyCollection;
    /** Gets the language name that is used for recognition. */
    readonly speechRecognitionLanguage: string;
    /** Start a meeting.
     * The host must connect to the websocket within a minute for the meeting to remain open.
     */
    startMeetingAsync(cb?: () => void, err?: (e: string) => void): void;
    /** Delete a meeting. After this no one will be able to join the meeting. */
    deleteMeetingAsync(cb?: () => void, err?: (e: string) => void): void;
    /** End a meeting. */
    endMeetingAsync(cb?: () => void, err?: (e: string) => void): void;
    /** Lock a meeting. This will prevent new participants from joining. */
    lockMeetingAsync(cb?: () => void, err?: (e: string) => void): void;
    /**
     * Mute all other participants in the meeting. After this no other participants will
     * have their speech recognitions broadcast, nor be able to send text messages.
     */
    muteAllParticipantsAsync(cb?: () => void, err?: (e: string) => void): void;
    /**
     * Mute a participant.
     * @param userId A user identifier
     */
    muteParticipantAsync(userId: string, cb?: () => void, err?: (e: string) => void): void;
    /**
     * Remove a participant from a meeting using the user id, Participant or User object
     * @param userId A user identifier
     */
    removeParticipantAsync(userId: string | IParticipant | IUser, cb?: () => void, err?: (e: string) => void): void;
    /** Unlocks a meeting. */
    unlockMeetingAsync(): void;
    /** Unmute all other participants in the meeting. */
    unmuteAllParticipantsAsync(cb?: () => void, err?: (e: string) => void): void;
    /**
     * Unmute a participant.
     * @param userId A user identifier
     */
    unmuteParticipantAsync(userId: string, cb?: () => void, err?: (e: string) => void): void;
}
export interface MeetingProperties {
    [key: string]: any;
    id?: string;
    attendees?: TranscriptionParticipant[];
    record?: string;
}
export interface MeetingInfo {
    id: string;
    participants: TranscriptionParticipant[];
    meetingProperties: MeetingProperties;
}
