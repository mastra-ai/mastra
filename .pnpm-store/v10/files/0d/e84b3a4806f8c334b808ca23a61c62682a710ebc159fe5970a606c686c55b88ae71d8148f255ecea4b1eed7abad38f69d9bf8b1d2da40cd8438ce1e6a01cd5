"use strict";
//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE.md file in the project root for full license information.
//
Object.defineProperty(exports, "__esModule", { value: true });
exports.Diagnostics = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
/**
 * Defines diagnostics API for managing console output
 * Added in version 1.21.0
 */
class Diagnostics {
    static SetLoggingLevel(logLevel) {
        this.privListener = new Exports_js_1.ConsoleLoggingListener(logLevel);
        Exports_js_2.Events.instance.attachConsoleListener(this.privListener);
    }
    static StartConsoleOutput() {
        if (!!this.privListener) {
            this.privListener.enableConsoleOutput = true;
        }
    }
    static StopConsoleOutput() {
        if (!!this.privListener) {
            this.privListener.enableConsoleOutput = false;
        }
    }
    static SetLogOutputPath(path) {
        if (typeof window === "undefined") {
            if (!!this.privListener) {
                this.privListener.logPath = path;
            }
        }
        else {
            throw new Error("File system logging not available in browser.");
        }
    }
    static set onLogOutput(callback) {
        if (!!this.privListener) {
            this.privListener.logCallback = callback;
        }
    }
}
exports.Diagnostics = Diagnostics;
Diagnostics.privListener = undefined;

//# sourceMappingURL=Diagnostics.js.map
