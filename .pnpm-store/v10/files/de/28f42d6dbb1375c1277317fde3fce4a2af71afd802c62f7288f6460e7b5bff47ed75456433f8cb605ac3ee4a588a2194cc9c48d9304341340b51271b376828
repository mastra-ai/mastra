"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationReceivedTranslationEventArgs = exports.ParticipantsListEventArgs = exports.ParticipantAttributeEventArgs = exports.ParticipantEventArgs = exports.LockRoomEventArgs = exports.MuteAllEventArgs = void 0;
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../../sdk/Exports.js");
class MuteAllEventArgs extends Exports_js_1.SessionEventArgs {
    constructor(isMuted, sessionId) {
        super(sessionId);
        this.privIsMuted = isMuted;
    }
    get isMuted() {
        return this.privIsMuted;
    }
}
exports.MuteAllEventArgs = MuteAllEventArgs;
class LockRoomEventArgs extends Exports_js_1.SessionEventArgs {
    constructor(isLocked, sessionId) {
        super(sessionId);
        this.privIsLocked = isLocked;
    }
    get isMuted() {
        return this.privIsLocked;
    }
}
exports.LockRoomEventArgs = LockRoomEventArgs;
class ParticipantEventArgs extends Exports_js_1.SessionEventArgs {
    constructor(participant, sessionId) {
        super(sessionId);
        this.privParticipant = participant;
    }
    get participant() {
        return this.privParticipant;
    }
}
exports.ParticipantEventArgs = ParticipantEventArgs;
class ParticipantAttributeEventArgs extends Exports_js_1.SessionEventArgs {
    constructor(participantId, key, value, sessionId) {
        super(sessionId);
        this.privKey = key;
        this.privValue = value;
        this.privParticipantId = participantId;
    }
    get value() {
        return this.privValue;
    }
    get key() {
        return this.privKey;
    }
    get id() {
        return this.privParticipantId;
    }
}
exports.ParticipantAttributeEventArgs = ParticipantAttributeEventArgs;
class ParticipantsListEventArgs extends Exports_js_1.SessionEventArgs {
    constructor(conversationId, token, translateTo, profanityFilter, roomProfanityFilter, isRoomLocked, isMuteAll, participants, sessionId) {
        super(sessionId);
        this.privRoomId = conversationId;
        this.privSessionToken = token;
        this.privTranslateTo = translateTo;
        this.privProfanityFilter = profanityFilter;
        this.privRoomProfanityFilter = roomProfanityFilter;
        this.privIsRoomLocked = isRoomLocked;
        this.privIsRoomLocked = isMuteAll;
        this.privParticipants = participants;
    }
    get sessionToken() {
        return this.privSessionToken;
    }
    get conversationId() {
        return this.privRoomId;
    }
    get translateTo() {
        return this.privTranslateTo;
    }
    get profanityFilter() {
        return this.privProfanityFilter;
    }
    get roomProfanityFilter() {
        return this.privRoomProfanityFilter;
    }
    get isRoomLocked() {
        return this.privIsRoomLocked;
    }
    get isMuteAll() {
        return this.privIsMuteAll;
    }
    get participants() {
        return this.privParticipants;
    }
}
exports.ParticipantsListEventArgs = ParticipantsListEventArgs;
class ConversationReceivedTranslationEventArgs {
    constructor(command, payload, sessionId) {
        this.privPayload = payload;
        this.privCommand = command;
        this.privSessionId = sessionId;
    }
    get payload() {
        return this.privPayload;
    }
    get command() {
        return this.privCommand;
    }
    get sessionId() {
        return this.privSessionId;
    }
}
exports.ConversationReceivedTranslationEventArgs = ConversationReceivedTranslationEventArgs;

//# sourceMappingURL=ConversationTranslatorEventArgs.js.map
