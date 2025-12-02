"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationTranslatorCommandTypes = exports.ConversationTranslatorMessageTypes = exports.InternalParticipants = void 0;
/** Users participating in the conversation */
class InternalParticipants {
    constructor(participants = [], meId) {
        this.participants = participants;
        this.meId = meId;
    }
    /**
     * Add or update a participant
     * @param value
     */
    addOrUpdateParticipant(value) {
        if (value === undefined) {
            return;
        }
        const exists = this.getParticipantIndex(value.id);
        if (exists > -1) {
            this.participants.splice(exists, 1, value);
        }
        else {
            this.participants.push(value);
        }
        // ensure it was added ok
        return this.getParticipant(value.id);
    }
    /**
     * Find the participant's position in the participants list.
     * @param id
     */
    getParticipantIndex(id) {
        return this.participants.findIndex((p) => p.id === id);
    }
    /**
     * Find the participant by id.
     * @param id
     */
    getParticipant(id) {
        return this.participants.find((p) => p.id === id);
    }
    /**
     * Remove a participant from the participants list.
     */
    deleteParticipant(id) {
        this.participants = this.participants.filter((p) => p.id !== id);
    }
    /**
     * Helper to return the conversation host.
     */
    get host() {
        return this.participants.find((p) => p.isHost === true);
    }
    /**
     * Helper to return the current user.
     */
    get me() {
        return this.getParticipant(this.meId);
    }
}
exports.InternalParticipants = InternalParticipants;
/**
 * List of command message types
 */
exports.ConversationTranslatorMessageTypes = {
    command: "command",
    final: "final",
    info: "info",
    instantMessage: "instant_message",
    keepAlive: "keep_alive",
    partial: "partial",
    participantCommand: "participant_command",
    translatedMessage: "translated_message"
};
/**
 * List of command types
 */
exports.ConversationTranslatorCommandTypes = {
    changeNickname: "ChangeNickname",
    disconnectSession: "DisconnectSession",
    ejectParticipant: "EjectParticipant",
    instant_message: "instant_message",
    joinSession: "JoinSession",
    leaveSession: "LeaveSession",
    participantList: "ParticipantList",
    roomExpirationWarning: "RoomExpirationWarning",
    setLockState: "SetLockState",
    setMute: "SetMute",
    setMuteAll: "SetMuteAll",
    setProfanityFiltering: "SetProfanityFiltering",
    setTranslateToLanguages: "SetTranslateToLanguages",
    setUseTTS: "SetUseTTS"
};

//# sourceMappingURL=ConversationTranslatorInterfaces.js.map
