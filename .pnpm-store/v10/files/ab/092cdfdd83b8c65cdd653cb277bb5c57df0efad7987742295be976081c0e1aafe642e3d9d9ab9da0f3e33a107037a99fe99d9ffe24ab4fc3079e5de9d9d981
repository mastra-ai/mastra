"use strict";
//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE.md file in the project root for full license information.
//
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionMessageImpl = exports.ConnectionMessage = void 0;
// eslint-disable-next-line max-classes-per-file
const HeaderNames_js_1 = require("../common.speech/HeaderNames.js");
const Exports_js_1 = require("../common/Exports.js");
const PropertyCollection_js_1 = require("./PropertyCollection.js");
const PropertyId_js_1 = require("./PropertyId.js");
/**
 * ConnectionMessage represents implementation specific messages sent to and received from
 * the speech service. These messages are provided for debugging purposes and should not
 * be used for production use cases with the Azure Cognitive Services Speech Service.
 * Messages sent to and received from the Speech Service are subject to change without
 * notice. This includes message contents, headers, payloads, ordering, etc.
 * Added in version 1.11.0.
 */
class ConnectionMessage {
}
exports.ConnectionMessage = ConnectionMessage;
class ConnectionMessageImpl {
    constructor(message) {
        this.privConnectionMessage = message;
        this.privProperties = new PropertyCollection_js_1.PropertyCollection();
        if (!!this.privConnectionMessage.headers[HeaderNames_js_1.HeaderNames.ConnectionId]) {
            this.privProperties.setProperty(PropertyId_js_1.PropertyId.Speech_SessionId, this.privConnectionMessage.headers[HeaderNames_js_1.HeaderNames.ConnectionId]);
        }
        Object.keys(this.privConnectionMessage.headers).forEach((header) => {
            this.privProperties.setProperty(header, this.privConnectionMessage.headers[header]);
        });
    }
    /**
     * The message path.
     */
    get path() {
        return this.privConnectionMessage.headers[Object.keys(this.privConnectionMessage.headers).find((key) => key.toLowerCase() === "path".toLowerCase())];
    }
    /**
     * Checks to see if the ConnectionMessage is a text message.
     * See also IsBinaryMessage().
     */
    get isTextMessage() {
        return this.privConnectionMessage.messageType === Exports_js_1.MessageType.Text;
    }
    /**
     * Checks to see if the ConnectionMessage is a binary message.
     * See also GetBinaryMessage().
     */
    get isBinaryMessage() {
        return this.privConnectionMessage.messageType === Exports_js_1.MessageType.Binary;
    }
    /**
     * Gets the text message payload. Typically the text message content-type is
     * application/json. To determine other content-types use
     * Properties.GetProperty("Content-Type").
     */
    get TextMessage() {
        return this.privConnectionMessage.textBody;
    }
    /**
     * Gets the binary message payload.
     */
    get binaryMessage() {
        return this.privConnectionMessage.binaryBody;
    }
    /**
     * A collection of properties and their values defined for this <see cref="ConnectionMessage"/>.
     * Message headers can be accessed via this collection (e.g. "Content-Type").
     */
    get properties() {
        return this.privProperties;
    }
    /**
     * Returns a string that represents the connection message.
     */
    toString() {
        return "";
    }
}
exports.ConnectionMessageImpl = ConnectionMessageImpl;

//# sourceMappingURL=ConnectionMessage.js.map
