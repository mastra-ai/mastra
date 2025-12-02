"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitiveTokenAuthentication = void 0;
const Exports_js_1 = require("../common/Exports.js");
const IAuthentication_js_1 = require("./IAuthentication.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
class CognitiveTokenAuthentication {
    constructor(fetchCallback, fetchOnExpiryCallback) {
        if (!fetchCallback) {
            throw new Exports_js_1.ArgumentNullError("fetchCallback");
        }
        if (!fetchOnExpiryCallback) {
            throw new Exports_js_1.ArgumentNullError("fetchOnExpiryCallback");
        }
        this.privFetchCallback = fetchCallback;
        this.privFetchOnExpiryCallback = fetchOnExpiryCallback;
    }
    fetch(authFetchEventId) {
        return this.privFetchCallback(authFetchEventId).then((token) => new IAuthentication_js_1.AuthInfo(HeaderNames_js_1.HeaderNames.Authorization, token === undefined ? undefined : CognitiveTokenAuthentication.privTokenPrefix + token));
    }
    fetchOnExpiry(authFetchEventId) {
        return this.privFetchOnExpiryCallback(authFetchEventId).then((token) => new IAuthentication_js_1.AuthInfo(HeaderNames_js_1.HeaderNames.Authorization, token === undefined ? undefined : CognitiveTokenAuthentication.privTokenPrefix + token));
    }
}
exports.CognitiveTokenAuthentication = CognitiveTokenAuthentication;
CognitiveTokenAuthentication.privTokenPrefix = "Bearer ";

//# sourceMappingURL=CognitiveTokenAuthentication.js.map
