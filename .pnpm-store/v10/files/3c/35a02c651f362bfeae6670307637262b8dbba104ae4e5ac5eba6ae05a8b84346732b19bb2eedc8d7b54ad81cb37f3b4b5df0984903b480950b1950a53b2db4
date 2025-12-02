"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitiveSubscriptionKeyAuthentication = void 0;
const Exports_js_1 = require("../common/Exports.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
const IAuthentication_js_1 = require("./IAuthentication.js");
/**
 * @class
 */
class CognitiveSubscriptionKeyAuthentication {
    /**
     * Creates and initializes an instance of the CognitiveSubscriptionKeyAuthentication class.
     * @constructor
     * @param {string} subscriptionKey - The subscription key
     */
    constructor(subscriptionKey) {
        if (!subscriptionKey) {
            throw new Exports_js_1.ArgumentNullError("subscriptionKey");
        }
        this.privAuthInfo = new IAuthentication_js_1.AuthInfo(HeaderNames_js_1.HeaderNames.AuthKey, subscriptionKey);
    }
    /**
     * Fetches the subscription key.
     * @member
     * @function
     * @public
     * @param {string} authFetchEventId - The id to fetch.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fetch(authFetchEventId) {
        return Promise.resolve(this.privAuthInfo);
    }
    /**
     * Fetches the subscription key.
     * @member
     * @function
     * @public
     * @param {string} authFetchEventId - The id to fetch.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fetchOnExpiry(authFetchEventId) {
        return Promise.resolve(this.privAuthInfo);
    }
}
exports.CognitiveSubscriptionKeyAuthentication = CognitiveSubscriptionKeyAuthentication;

//# sourceMappingURL=CognitiveSubscriptionKeyAuthentication.js.map
