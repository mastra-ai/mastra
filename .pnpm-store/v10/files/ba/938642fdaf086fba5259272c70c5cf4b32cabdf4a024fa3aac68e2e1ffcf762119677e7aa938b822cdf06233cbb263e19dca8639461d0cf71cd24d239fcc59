import { SessionEventArgs } from "../Exports.js";
import { ParticipantChangedReason } from "./Exports.js";
import { IParticipant } from "./IParticipant.js";
export declare class ConversationParticipantsChangedEventArgs extends SessionEventArgs {
    private privReason;
    private privParticipant;
    constructor(reason: ParticipantChangedReason, participants: IParticipant[], sessionId?: string);
    get reason(): ParticipantChangedReason;
    get participants(): IParticipant[];
}
