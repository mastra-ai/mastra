"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextResponsePayload = exports.SpeechResponsePayload = void 0;
const parseSpeechResponse = (json) => JSON.parse(json);
const parseTextResponse = (json) => JSON.parse(json);
class SpeechResponsePayload {
    constructor(json) {
        this.privSpeechResponse = parseSpeechResponse(json);
    }
    get recognition() {
        return this.privSpeechResponse.recognition;
    }
    get translations() {
        return this.privSpeechResponse.translations;
    }
    get id() {
        return this.privSpeechResponse.id;
    }
    get language() {
        return this.privSpeechResponse.language;
    }
    get nickname() {
        return this.privSpeechResponse.nickname;
    }
    get participantId() {
        return this.privSpeechResponse.participantId;
    }
    get roomid() {
        return this.privSpeechResponse.roomid;
    }
    get timestamp() {
        return this.privSpeechResponse.timestamp;
    }
    get type() {
        return this.privSpeechResponse.type;
    }
    get isFinal() {
        return this.privSpeechResponse.type === "final";
    }
    static fromJSON(json) {
        return new SpeechResponsePayload(json);
    }
}
exports.SpeechResponsePayload = SpeechResponsePayload;
class TextResponsePayload {
    constructor(json) {
        this.privTextResponse = parseTextResponse(json);
    }
    get originalText() {
        return this.privTextResponse.originalText;
    }
    get translations() {
        return this.privTextResponse.translations;
    }
    get id() {
        return this.privTextResponse.id;
    }
    get language() {
        return this.privTextResponse.language;
    }
    get nickname() {
        return this.privTextResponse.nickname;
    }
    get participantId() {
        return this.privTextResponse.participantId;
    }
    get roomid() {
        return this.privTextResponse.roomid;
    }
    get timestamp() {
        return this.privTextResponse.timestamp;
    }
    get type() {
        return this.privTextResponse.type;
    }
    static fromJSON(json) {
        return new TextResponsePayload(json);
    }
}
exports.TextResponsePayload = TextResponsePayload;

//# sourceMappingURL=TranslationResponsePayload.js.map
