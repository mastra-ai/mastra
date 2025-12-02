"use strict";
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLoggingListener = void 0;
const fs = __importStar(require("fs"));
const LogLevel_js_1 = require("../sdk/LogLevel.js");
const Contracts_js_1 = require("../sdk/Contracts.js");
class ConsoleLoggingListener {
    constructor(logLevelFilter = LogLevel_js_1.LogLevel.None) {
        this.privLogPath = undefined;
        this.privEnableConsoleOutput = true;
        this.privLogLevelFilter = logLevelFilter;
    }
    set logPath(path) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(fs.openSync, "\nFile System access not available");
        this.privLogPath = path;
    }
    set enableConsoleOutput(enableOutput) {
        this.privEnableConsoleOutput = enableOutput;
    }
    onEvent(event) {
        if (event.eventType >= this.privLogLevelFilter) {
            const log = this.toString(event);
            if (!!this.logCallback) {
                this.logCallback(log);
            }
            if (!!this.privLogPath) {
                fs.writeFileSync(this.privLogPath, log + "\n", { flag: "a+" });
            }
            if (this.privEnableConsoleOutput) {
                switch (event.eventType) {
                    case LogLevel_js_1.LogLevel.Debug:
                        // eslint-disable-next-line no-console
                        console.debug(log);
                        break;
                    case LogLevel_js_1.LogLevel.Info:
                        // eslint-disable-next-line no-console
                        console.info(log);
                        break;
                    case LogLevel_js_1.LogLevel.Warning:
                        // eslint-disable-next-line no-console
                        console.warn(log);
                        break;
                    case LogLevel_js_1.LogLevel.Error:
                        // eslint-disable-next-line no-console
                        console.error(log);
                        break;
                    default:
                        // eslint-disable-next-line no-console
                        console.log(log);
                        break;
                }
            }
        }
    }
    toString(event) {
        const logFragments = [
            `${event.eventTime}`,
            `${event.name}`,
        ];
        const e = event;
        for (const prop in e) {
            if (prop && event.hasOwnProperty(prop) &&
                prop !== "eventTime" && prop !== "eventType" &&
                prop !== "eventId" && prop !== "name" &&
                prop !== "constructor") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const value = e[prop];
                let valueToLog = "<NULL>";
                if (value !== undefined && value !== null) {
                    if (typeof (value) === "number" || typeof (value) === "string") {
                        valueToLog = value.toString();
                    }
                    else {
                        valueToLog = JSON.stringify(value);
                    }
                }
                logFragments.push(`${prop}: ${valueToLog}`);
            }
        }
        return logFragments.join(" | ");
    }
}
exports.ConsoleLoggingListener = ConsoleLoggingListener;

//# sourceMappingURL=ConsoleLoggingListener.js.map
