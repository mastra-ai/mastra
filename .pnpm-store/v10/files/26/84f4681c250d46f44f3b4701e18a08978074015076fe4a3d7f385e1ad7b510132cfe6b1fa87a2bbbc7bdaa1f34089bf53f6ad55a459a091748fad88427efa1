"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurnStatusResponsePayload = void 0;
class TurnStatusResponsePayload {
    constructor(json) {
        this.privMessageStatusResponse = JSON.parse(json);
    }
    static fromJSON(json) {
        return new TurnStatusResponsePayload(json);
    }
    get interactionId() {
        return this.privMessageStatusResponse.interactionId;
    }
    get conversationId() {
        return this.privMessageStatusResponse.conversationId;
    }
    get statusCode() {
        // Payloads may contain a limited set of textual representations or a numeric status
        // code. The textual values are here converted into numeric ones.
        switch (this.privMessageStatusResponse.statusCode) {
            case "Success":
                return 200;
            case "Failed":
                return 400;
            case "TimedOut":
                return 429;
            default:
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return this.privMessageStatusResponse.statusCode;
        }
    }
}
exports.TurnStatusResponsePayload = TurnStatusResponsePayload;

//# sourceMappingURL=TurnStatusPayload.js.map
