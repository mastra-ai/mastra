/**
 * Defines the payload for incoming list of participants
 */
export interface IParticipantsListPayloadResponse {
    roomid: string;
    id: string;
    command: string;
    participants: IParticipantPayloadResponse[];
    token: string;
    translateTo: string[];
    profanityFilter: string;
    roomProfanityFilter: string;
    roomLocked: boolean;
    muteAll: boolean;
    type: string;
}
/**
 * Defines the payload for incoming participant
 */
export interface IParticipantPayloadResponse {
    nickname: string;
    locale: string;
    usetts: boolean;
    ismuted: boolean;
    ishost: boolean;
    participantId: string;
    avatar?: string;
}
export declare class ParticipantsListPayloadResponse implements IParticipantsListPayloadResponse {
    private privParticipantsPayloadResponse;
    private constructor();
    get roomid(): string;
    get id(): string;
    get command(): string;
    get participants(): IParticipantPayloadResponse[];
    get token(): string;
    get translateTo(): string[];
    get profanityFilter(): string;
    get roomProfanityFilter(): string;
    get roomLocked(): boolean;
    get muteAll(): boolean;
    get type(): string;
    static fromJSON(json: string): ParticipantsListPayloadResponse;
}
export declare class ParticipantPayloadResponse implements IParticipantPayloadResponse {
    private privParticipantPayloadResponse;
    private constructor();
    get nickname(): string;
    get locale(): string;
    get usetts(): boolean;
    get ismuted(): boolean;
    get ishost(): boolean;
    get participantId(): string;
    get avatar(): string;
    static fromJSON(json: string): ParticipantPayloadResponse;
}
