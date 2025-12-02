"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Events = void 0;
const Error_js_1 = require("./Error.js");
const EventSource_js_1 = require("./EventSource.js");
class Events {
    static setEventSource(eventSource) {
        if (!eventSource) {
            throw new Error_js_1.ArgumentNullError("eventSource");
        }
        Events.privInstance = eventSource;
    }
    static get instance() {
        return Events.privInstance;
    }
}
exports.Events = Events;
Events.privInstance = new EventSource_js_1.EventSource();

//# sourceMappingURL=Events.js.map
