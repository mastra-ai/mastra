"use strict";
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RawWebsocketMessage = void 0;
const ConnectionMessage_js_1 = require("./ConnectionMessage.js");
const Error_js_1 = require("./Error.js");
const Guid_js_1 = require("./Guid.js");
class RawWebsocketMessage {
    constructor(messageType, payload, id) {
        this.privPayload = null;
        if (!payload) {
            throw new Error_js_1.ArgumentNullError("payload");
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (messageType === ConnectionMessage_js_1.MessageType.Binary && Object.getPrototypeOf(payload).constructor.name !== "ArrayBuffer") {
            throw new Error_js_1.InvalidOperationError("Payload must be ArrayBuffer");
        }
        if (messageType === ConnectionMessage_js_1.MessageType.Text && !(typeof (payload) === "string")) {
            throw new Error_js_1.InvalidOperationError("Payload must be a string");
        }
        this.privMessageType = messageType;
        this.privPayload = payload;
        this.privId = id ? id : (0, Guid_js_1.createNoDashGuid)();
    }
    get messageType() {
        return this.privMessageType;
    }
    get payload() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this.privPayload;
    }
    get textContent() {
        if (this.privMessageType === ConnectionMessage_js_1.MessageType.Binary) {
            throw new Error_js_1.InvalidOperationError("Not supported for binary message");
        }
        return this.privPayload;
    }
    get binaryContent() {
        if (this.privMessageType === ConnectionMessage_js_1.MessageType.Text) {
            throw new Error_js_1.InvalidOperationError("Not supported for text message");
        }
        return this.privPayload;
    }
    get id() {
        return this.privId;
    }
}
exports.RawWebsocketMessage = RawWebsocketMessage;

//# sourceMappingURL=RawWebsocketMessage.js.map
