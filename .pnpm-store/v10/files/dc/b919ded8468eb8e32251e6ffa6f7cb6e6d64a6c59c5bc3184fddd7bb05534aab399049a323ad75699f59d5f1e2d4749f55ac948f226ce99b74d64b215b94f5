import { ConversationTranslationResult, SessionEventArgs } from "../../sdk/Exports.js";
import { IInternalParticipant } from "./ConversationTranslatorInterfaces.js";
export declare class MuteAllEventArgs extends SessionEventArgs {
    private privIsMuted;
    constructor(isMuted: boolean, sessionId?: string);
    get isMuted(): boolean;
}
export declare class LockRoomEventArgs extends SessionEventArgs {
    private privIsLocked;
    constructor(isLocked: boolean, sessionId?: string);
    get isMuted(): boolean;
}
export declare class ParticipantEventArgs extends SessionEventArgs {
    private privParticipant;
    constructor(participant: IInternalParticipant, sessionId?: string);
    get participant(): IInternalParticipant;
}
export declare class ParticipantAttributeEventArgs extends SessionEventArgs {
    private privValue;
    private privKey;
    private privParticipantId;
    constructor(participantId: string, key: string, value: boolean | number | string | string[], sessionId?: string);
    get value(): boolean | number | string | string[];
    get key(): string;
    get id(): string;
}
export declare class ParticipantsListEventArgs extends SessionEventArgs {
    private privRoomId;
    private privSessionToken;
    private privTranslateTo;
    private privProfanityFilter;
    private privRoomProfanityFilter;
    private privIsRoomLocked;
    private privIsMuteAll;
    private privParticipants;
    constructor(conversationId: string, token: string, translateTo: string[], profanityFilter: string, roomProfanityFilter: string, isRoomLocked: boolean, isMuteAll: boolean, participants: IInternalParticipant[], sessionId?: string);
    get sessionToken(): string;
    get conversationId(): string;
    get translateTo(): string[];
    get profanityFilter(): string;
    get roomProfanityFilter(): string;
    get isRoomLocked(): boolean;
    get isMuteAll(): boolean;
    get participants(): IInternalParticipant[];
}
export declare class ConversationReceivedTranslationEventArgs {
    private privPayload;
    private privCommand;
    private privSessionId;
    constructor(command: string, payload: ConversationTranslationResult, sessionId?: string);
    get payload(): ConversationTranslationResult;
    get command(): string;
    get sessionId(): string;
}
