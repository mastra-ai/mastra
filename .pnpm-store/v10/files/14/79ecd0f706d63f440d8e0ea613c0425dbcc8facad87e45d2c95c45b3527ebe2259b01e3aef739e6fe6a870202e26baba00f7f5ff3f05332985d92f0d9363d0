"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventSource = void 0;
const Error_js_1 = require("./Error.js");
const Guid_js_1 = require("./Guid.js");
class EventSource {
    constructor(metadata) {
        this.privEventListeners = {};
        this.privIsDisposed = false;
        this.privConsoleListener = undefined;
        this.privMetadata = metadata;
    }
    onEvent(event) {
        if (this.isDisposed()) {
            throw (new Error_js_1.ObjectDisposedError("EventSource"));
        }
        if (this.metadata) {
            for (const paramName in this.metadata) {
                if (paramName) {
                    if (event.metadata) {
                        if (!event.metadata[paramName]) {
                            event.metadata[paramName] = this.metadata[paramName];
                        }
                    }
                }
            }
        }
        for (const eventId in this.privEventListeners) {
            if (eventId && this.privEventListeners[eventId]) {
                this.privEventListeners[eventId](event);
            }
        }
    }
    attach(onEventCallback) {
        const id = (0, Guid_js_1.createNoDashGuid)();
        this.privEventListeners[id] = onEventCallback;
        return {
            detach: () => {
                delete this.privEventListeners[id];
                return Promise.resolve();
            },
        };
    }
    attachListener(listener) {
        return this.attach((e) => listener.onEvent(e));
    }
    attachConsoleListener(listener) {
        if (!!this.privConsoleListener) {
            void this.privConsoleListener.detach(); // Detach implementation for eventListeners is synchronous
        }
        this.privConsoleListener = this.attach((e) => listener.onEvent(e));
        return this.privConsoleListener;
    }
    isDisposed() {
        return this.privIsDisposed;
    }
    dispose() {
        this.privEventListeners = null;
        this.privIsDisposed = true;
    }
    get metadata() {
        return this.privMetadata;
    }
}
exports.EventSource = EventSource;

//# sourceMappingURL=EventSource.js.map
