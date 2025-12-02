"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsocketConnection = void 0;
const Exports_js_1 = require("../common/Exports.js");
const WebsocketMessageAdapter_js_1 = require("./WebsocketMessageAdapter.js");
class WebsocketConnection {
    constructor(uri, queryParameters, headers, messageFormatter, proxyInfo, enableCompression = false, connectionId) {
        this.privIsDisposed = false;
        if (!uri) {
            throw new Exports_js_1.ArgumentNullError("uri");
        }
        if (!messageFormatter) {
            throw new Exports_js_1.ArgumentNullError("messageFormatter");
        }
        this.privMessageFormatter = messageFormatter;
        let queryParams = "";
        let i = 0;
        if (queryParameters) {
            for (const paramName in queryParameters) {
                if (paramName) {
                    queryParams += ((i === 0) && (uri.indexOf("?") === -1)) ? "?" : "&";
                    const key = encodeURIComponent(paramName);
                    queryParams += key;
                    let val = queryParameters[paramName];
                    if (val) {
                        val = encodeURIComponent(val);
                        queryParams += `=${val}`;
                    }
                    i++;
                }
            }
        }
        if (headers) {
            for (const headerName in headers) {
                if (headerName) {
                    queryParams += ((i === 0) && (uri.indexOf("?") === -1)) ? "?" : "&";
                    const val = encodeURIComponent(headers[headerName]);
                    queryParams += `${headerName}=${val}`;
                    i++;
                }
            }
        }
        this.privUri = uri + queryParams;
        this.privId = connectionId ? connectionId : (0, Exports_js_1.createNoDashGuid)();
        this.privConnectionMessageAdapter = new WebsocketMessageAdapter_js_1.WebsocketMessageAdapter(this.privUri, this.id, this.privMessageFormatter, proxyInfo, headers, enableCompression);
    }
    async dispose() {
        this.privIsDisposed = true;
        if (this.privConnectionMessageAdapter) {
            await this.privConnectionMessageAdapter.close();
        }
    }
    isDisposed() {
        return this.privIsDisposed;
    }
    get id() {
        return this.privId;
    }
    get uri() {
        return this.privUri;
    }
    state() {
        return this.privConnectionMessageAdapter.state;
    }
    open() {
        return this.privConnectionMessageAdapter.open();
    }
    send(message) {
        return this.privConnectionMessageAdapter.send(message);
    }
    read() {
        return this.privConnectionMessageAdapter.read();
    }
    get events() {
        return this.privConnectionMessageAdapter.events;
    }
}
exports.WebsocketConnection = WebsocketConnection;

//# sourceMappingURL=WebsocketConnection.js.map
