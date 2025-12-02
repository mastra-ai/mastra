"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationWebsocketMessageFormatter = void 0;
const Exports_js_1 = require("../../common/Exports.js");
const ConversationConnectionMessage_js_1 = require("./ConversationConnectionMessage.js");
/**
 * Based off WebsocketMessageFormatter. The messages for Conversation Translator have some variations from the Speech messages.
 */
class ConversationWebsocketMessageFormatter {
    /**
     * Format incoming messages: text (speech partial/final, IM) or binary (tts)
     */
    toConnectionMessage(message) {
        const deferral = new Exports_js_1.Deferred();
        try {
            if (message.messageType === Exports_js_1.MessageType.Text) {
                const incomingMessage = new ConversationConnectionMessage_js_1.ConversationConnectionMessage(message.messageType, message.textContent, {}, message.id);
                deferral.resolve(incomingMessage);
            }
            else if (message.messageType === Exports_js_1.MessageType.Binary) {
                deferral.resolve(new ConversationConnectionMessage_js_1.ConversationConnectionMessage(message.messageType, message.binaryContent, undefined, message.id));
            }
        }
        catch (e) {
            deferral.reject(`Error formatting the message. Error: ${e}`);
        }
        return deferral.promise;
    }
    /**
     * Format outgoing messages: text (commands or IM)
     */
    fromConnectionMessage(message) {
        const deferral = new Exports_js_1.Deferred();
        try {
            if (message.messageType === Exports_js_1.MessageType.Text) {
                const payload = `${message.textBody ? message.textBody : ""}`;
                deferral.resolve(new Exports_js_1.RawWebsocketMessage(Exports_js_1.MessageType.Text, payload, message.id));
            }
        }
        catch (e) {
            deferral.reject(`Error formatting the message. ${e}`);
        }
        return deferral.promise;
    }
}
exports.ConversationWebsocketMessageFormatter = ConversationWebsocketMessageFormatter;

//# sourceMappingURL=ConversationWebsocketMessageFormatter.js.map
