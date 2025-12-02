"use strict";
/* eslint-disable @typescript-eslint/no-unsafe-return */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionMessage = exports.MessageType = void 0;
const Error_js_1 = require("./Error.js");
const Guid_js_1 = require("./Guid.js");
var MessageType;
(function (MessageType) {
    MessageType[MessageType["Text"] = 0] = "Text";
    MessageType[MessageType["Binary"] = 1] = "Binary";
})(MessageType = exports.MessageType || (exports.MessageType = {}));
class ConnectionMessage {
    constructor(messageType, body, headers, id) {
        this.privBody = null;
        if (messageType === MessageType.Text && body && !(typeof (body) === "string")) {
            throw new Error_js_1.InvalidOperationError("Payload must be a string");
        }
        if (messageType === MessageType.Binary && body && !(body instanceof ArrayBuffer)) {
            throw new Error_js_1.InvalidOperationError("Payload must be ArrayBuffer");
        }
        this.privMessageType = messageType;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.privBody = body;
        this.privHeaders = headers ? headers : {};
        this.privId = id ? id : (0, Guid_js_1.createNoDashGuid)();
        switch (this.messageType) {
            case MessageType.Binary:
                this.privSize = this.binaryBody !== null ? this.binaryBody.byteLength : 0;
                break;
            case MessageType.Text:
                this.privSize = this.textBody.length;
        }
    }
    get messageType() {
        return this.privMessageType;
    }
    get headers() {
        return this.privHeaders;
    }
    get body() {
        return this.privBody;
    }
    get textBody() {
        if (this.privMessageType === MessageType.Binary) {
            throw new Error_js_1.InvalidOperationError("Not supported for binary message");
        }
        return this.privBody;
    }
    get binaryBody() {
        if (this.privMessageType === MessageType.Text) {
            throw new Error_js_1.InvalidOperationError("Not supported for text message");
        }
        return this.privBody;
    }
    get id() {
        return this.privId;
    }
}
exports.ConnectionMessage = ConnectionMessage;

//# sourceMappingURL=ConnectionMessage.js.map
