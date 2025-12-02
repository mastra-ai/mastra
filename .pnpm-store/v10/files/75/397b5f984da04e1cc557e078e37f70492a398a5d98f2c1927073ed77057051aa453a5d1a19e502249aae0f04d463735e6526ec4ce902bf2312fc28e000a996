"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandResponsePayload = void 0;
const parseCommandResponse = (json) => JSON.parse(json);
class CommandResponsePayload {
    constructor(json) {
        this.privCommandResponse = parseCommandResponse(json);
    }
    get type() {
        return this.privCommandResponse.type;
    }
    get command() {
        return this.privCommandResponse.command;
    }
    get id() {
        return this.privCommandResponse.id;
    }
    get nickname() {
        return this.privCommandResponse.nickname;
    }
    get participantId() {
        return this.privCommandResponse.participantId;
    }
    get roomid() {
        return this.privCommandResponse.roomid;
    }
    get value() {
        return this.privCommandResponse.value;
    }
    get token() {
        return this.privCommandResponse.token;
    }
    static fromJSON(json) {
        return new CommandResponsePayload(json);
    }
}
exports.CommandResponsePayload = CommandResponsePayload;

//# sourceMappingURL=CommandResponsePayload.js.map
