"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsocketMessageFormatter = void 0;
const Exports_js_1 = require("../common/Exports.js");
const CRLF = "\r\n";
class WebsocketMessageFormatter {
    toConnectionMessage(message) {
        const deferral = new Exports_js_1.Deferred();
        try {
            if (message.messageType === Exports_js_1.MessageType.Text) {
                const textMessage = message.textContent;
                let headers = {};
                let body = null;
                if (textMessage) {
                    const headerBodySplit = textMessage.split("\r\n\r\n");
                    if (headerBodySplit && headerBodySplit.length > 0) {
                        headers = this.parseHeaders(headerBodySplit[0]);
                        if (headerBodySplit.length > 1) {
                            body = headerBodySplit[1];
                        }
                    }
                }
                deferral.resolve(new Exports_js_1.ConnectionMessage(message.messageType, body, headers, message.id));
            }
            else if (message.messageType === Exports_js_1.MessageType.Binary) {
                const binaryMessage = message.binaryContent;
                let headers = {};
                let body = null;
                if (!binaryMessage || binaryMessage.byteLength < 2) {
                    throw new Error("Invalid binary message format. Header length missing.");
                }
                const dataView = new DataView(binaryMessage);
                const headerLength = dataView.getInt16(0);
                if (binaryMessage.byteLength < headerLength + 2) {
                    throw new Error("Invalid binary message format. Header content missing.");
                }
                let headersString = "";
                for (let i = 0; i < headerLength; i++) {
                    headersString += String.fromCharCode((dataView).getInt8(i + 2));
                }
                headers = this.parseHeaders(headersString);
                if (binaryMessage.byteLength > headerLength + 2) {
                    body = binaryMessage.slice(2 + headerLength);
                }
                deferral.resolve(new Exports_js_1.ConnectionMessage(message.messageType, body, headers, message.id));
            }
        }
        catch (e) {
            deferral.reject(`Error formatting the message. Error: ${e}`);
        }
        return deferral.promise;
    }
    fromConnectionMessage(message) {
        const deferral = new Exports_js_1.Deferred();
        try {
            if (message.messageType === Exports_js_1.MessageType.Text) {
                const payload = `${this.makeHeaders(message)}${CRLF}${message.textBody ? message.textBody : ""}`;
                deferral.resolve(new Exports_js_1.RawWebsocketMessage(Exports_js_1.MessageType.Text, payload, message.id));
            }
            else if (message.messageType === Exports_js_1.MessageType.Binary) {
                const headersString = this.makeHeaders(message);
                const content = message.binaryBody;
                const headerBuffer = this.stringToArrayBuffer(headersString);
                const headerInt8Array = new Int8Array(headerBuffer);
                const headerLength = headerInt8Array.byteLength;
                const payloadInt8Array = new Int8Array(2 + headerLength + (content ? content.byteLength : 0));
                payloadInt8Array[0] = ((headerLength >> 8) & 0xff);
                payloadInt8Array[1] = headerLength & 0xff;
                payloadInt8Array.set(headerInt8Array, 2);
                if (content) {
                    const bodyInt8Array = new Int8Array(content);
                    payloadInt8Array.set(bodyInt8Array, 2 + headerLength);
                }
                const payload = payloadInt8Array.buffer;
                deferral.resolve(new Exports_js_1.RawWebsocketMessage(Exports_js_1.MessageType.Binary, payload, message.id));
            }
        }
        catch (e) {
            deferral.reject(`Error formatting the message. ${e}`);
        }
        return deferral.promise;
    }
    makeHeaders(message) {
        let headersString = "";
        if (message.headers) {
            for (const header in message.headers) {
                if (header) {
                    headersString += `${header}: ${message.headers[header]}${CRLF}`;
                }
            }
        }
        return headersString;
    }
    parseHeaders(headersString) {
        const headers = {};
        if (headersString) {
            const headerMatches = headersString.match(/[^\r\n]+/g);
            if (headers) {
                for (const header of headerMatches) {
                    if (header) {
                        const separatorIndex = header.indexOf(":");
                        const headerName = separatorIndex > 0 ? header.substr(0, separatorIndex).trim().toLowerCase() : header;
                        const headerValue = separatorIndex > 0 && header.length > (separatorIndex + 1) ?
                            header.substr(separatorIndex + 1).trim() :
                            "";
                        headers[headerName] = headerValue;
                    }
                }
            }
        }
        return headers;
    }
    stringToArrayBuffer(str) {
        const buffer = new ArrayBuffer(str.length);
        const view = new DataView(buffer);
        for (let i = 0; i < str.length; i++) {
            view.setUint8(i, str.charCodeAt(i));
        }
        return buffer;
    }
}
exports.WebsocketMessageFormatter = WebsocketMessageFormatter;

//# sourceMappingURL=WebsocketMessageFormatter.js.map
