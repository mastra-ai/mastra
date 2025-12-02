"use strict";
//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE.md file in the project root for full license information.
//
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceEventArgs = void 0;
const Exports_js_1 = require("./Exports.js");
/**
 * Defines payload for any Service message event
 * Added in version 1.9.0
 */
class ServiceEventArgs extends Exports_js_1.SessionEventArgs {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {string} json - json payload of the USP message.
     */
    constructor(json, name, sessionId) {
        super(sessionId);
        this.privJsonResult = json;
        this.privEventName = name;
    }
    get jsonString() {
        return this.privJsonResult;
    }
    get eventName() {
        return this.privEventName;
    }
}
exports.ServiceEventArgs = ServiceEventArgs;

//# sourceMappingURL=ServiceEventArgs.js.map
