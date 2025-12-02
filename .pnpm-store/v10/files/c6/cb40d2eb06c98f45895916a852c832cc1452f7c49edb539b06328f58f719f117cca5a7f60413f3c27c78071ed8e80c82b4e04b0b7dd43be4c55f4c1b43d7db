"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationConnectionMessage = void 0;
const Exports_js_1 = require("../../common/Exports.js");
class ConversationConnectionMessage extends Exports_js_1.ConnectionMessage {
    constructor(messageType, body, headers, id) {
        super(messageType, body, headers, id);
        const json = JSON.parse(this.textBody);
        if (json.type !== undefined) {
            this.privConversationMessageType = json.type;
        }
    }
    get conversationMessageType() {
        return this.privConversationMessageType;
    }
}
exports.ConversationConnectionMessage = ConversationConnectionMessage;

//# sourceMappingURL=ConversationConnectionMessage.js.map
