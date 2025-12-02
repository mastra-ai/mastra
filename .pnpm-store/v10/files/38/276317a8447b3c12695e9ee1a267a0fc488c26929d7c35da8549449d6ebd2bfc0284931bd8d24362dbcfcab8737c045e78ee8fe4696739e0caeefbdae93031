"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
// response
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageDataStreamType = exports.ActivityPayloadResponse = void 0;
class ActivityPayloadResponse {
    constructor(json) {
        this.privActivityResponse = JSON.parse(json);
    }
    static fromJSON(json) {
        return new ActivityPayloadResponse(json);
    }
    get conversationId() {
        return this.privActivityResponse.conversationId;
    }
    get messageDataStreamType() {
        return this.privActivityResponse.messageDataStreamType;
    }
    get messagePayload() {
        return this.privActivityResponse.messagePayload;
    }
    get version() {
        return this.privActivityResponse.version;
    }
}
exports.ActivityPayloadResponse = ActivityPayloadResponse;
var MessageDataStreamType;
(function (MessageDataStreamType) {
    MessageDataStreamType[MessageDataStreamType["None"] = 0] = "None";
    MessageDataStreamType[MessageDataStreamType["TextToSpeechAudio"] = 1] = "TextToSpeechAudio";
})(MessageDataStreamType = exports.MessageDataStreamType || (exports.MessageDataStreamType = {}));

//# sourceMappingURL=ActivityResponsePayload.js.map
