"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParticipantPayloadResponse = exports.ParticipantsListPayloadResponse = void 0;
const parseListResponse = (json) => JSON.parse(json);
const parseParticipantResponse = (json) => JSON.parse(json);
class ParticipantsListPayloadResponse {
    constructor(json) {
        this.privParticipantsPayloadResponse = parseListResponse(json);
    }
    get roomid() {
        return this.privParticipantsPayloadResponse.roomid;
    }
    get id() {
        return this.privParticipantsPayloadResponse.id;
    }
    get command() {
        return this.privParticipantsPayloadResponse.command;
    }
    get participants() {
        return this.privParticipantsPayloadResponse.participants;
    }
    get token() {
        return this.privParticipantsPayloadResponse.token;
    }
    get translateTo() {
        return this.privParticipantsPayloadResponse.translateTo;
    }
    get profanityFilter() {
        return this.privParticipantsPayloadResponse.profanityFilter;
    }
    get roomProfanityFilter() {
        return this.privParticipantsPayloadResponse.roomProfanityFilter;
    }
    get roomLocked() {
        return this.privParticipantsPayloadResponse.roomLocked;
    }
    get muteAll() {
        return this.privParticipantsPayloadResponse.muteAll;
    }
    get type() {
        return this.privParticipantsPayloadResponse.type;
    }
    static fromJSON(json) {
        return new ParticipantsListPayloadResponse(json);
    }
}
exports.ParticipantsListPayloadResponse = ParticipantsListPayloadResponse;
class ParticipantPayloadResponse {
    constructor(json) {
        this.privParticipantPayloadResponse = parseParticipantResponse(json);
    }
    get nickname() {
        return this.privParticipantPayloadResponse.nickname;
    }
    get locale() {
        return this.privParticipantPayloadResponse.locale;
    }
    get usetts() {
        return this.privParticipantPayloadResponse.usetts;
    }
    get ismuted() {
        return this.privParticipantPayloadResponse.ismuted;
    }
    get ishost() {
        return this.privParticipantPayloadResponse.ishost;
    }
    get participantId() {
        return this.privParticipantPayloadResponse.participantId;
    }
    get avatar() {
        return this.privParticipantPayloadResponse.avatar;
    }
    static fromJSON(json) {
        return new ParticipantPayloadResponse(json);
    }
}
exports.ParticipantPayloadResponse = ParticipantPayloadResponse;

//# sourceMappingURL=ParticipantResponsePayload.js.map
