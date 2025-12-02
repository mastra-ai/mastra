"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyInfo = void 0;
const Exports_js_1 = require("../sdk/Exports.js");
class ProxyInfo {
    constructor(proxyHostName, proxyPort, proxyUserName, proxyPassword) {
        this.privProxyHostName = proxyHostName;
        this.privProxyPort = proxyPort;
        this.privProxyUserName = proxyUserName;
        this.privProxyPassword = proxyPassword;
    }
    static fromParameters(parameters) {
        return new ProxyInfo(parameters.getProperty(Exports_js_1.PropertyId.SpeechServiceConnection_ProxyHostName), parseInt(parameters.getProperty(Exports_js_1.PropertyId.SpeechServiceConnection_ProxyPort), 10), parameters.getProperty(Exports_js_1.PropertyId.SpeechServiceConnection_ProxyUserName), parameters.getProperty(Exports_js_1.PropertyId.SpeechServiceConnection_ProxyPassword));
    }
    static fromRecognizerConfig(config) {
        return this.fromParameters(config.parameters);
    }
    get HostName() {
        return this.privProxyHostName;
    }
    get Port() {
        return this.privProxyPort;
    }
    get UserName() {
        return this.privProxyUserName;
    }
    get Password() {
        return this.privProxyPassword;
    }
}
exports.ProxyInfo = ProxyInfo;

//# sourceMappingURL=ProxyInfo.js.map
