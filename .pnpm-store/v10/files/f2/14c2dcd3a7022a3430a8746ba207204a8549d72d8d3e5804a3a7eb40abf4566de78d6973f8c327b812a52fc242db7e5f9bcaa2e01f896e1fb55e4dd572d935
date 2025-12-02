"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandFailedEvent = exports.CommandSucceededEvent = exports.CommandStartedEvent = exports.CommandEvent = void 0;
const api_1 = require("../api");
class CommandEvent {
        constructor(info) {
                Object.defineProperty(this, "command", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "keyspace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "collection", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "commandName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.command = info.command;
        this.keyspace = this.namespace = info.keyspace || api_1.DEFAULT_KEYSPACE;
        this.collection = info.collection;
        this.commandName = Object.keys(info.command)[0];
        this.url = info.url;
    }
}
exports.CommandEvent = CommandEvent;
class CommandStartedEvent extends CommandEvent {
        constructor(info) {
        super(info);
                Object.defineProperty(this, "timeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.timeout = info.timeoutManager.ms;
    }
}
exports.CommandStartedEvent = CommandStartedEvent;
class CommandSucceededEvent extends CommandEvent {
        constructor(info, reply, warnings, started) {
        super(info);
                Object.defineProperty(this, "duration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "resp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "warnings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.duration = (0, api_1.hrTimeMs)() - started;
        this.warnings = warnings;
        this.resp = reply;
    }
}
exports.CommandSucceededEvent = CommandSucceededEvent;
class CommandFailedEvent extends CommandEvent {
        constructor(info, error, started) {
        super(info);
                Object.defineProperty(this, "duration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
                Object.defineProperty(this, "error", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.duration = (0, api_1.hrTimeMs)() - started;
        this.error = error;
    }
}
exports.CommandFailedEvent = CommandFailedEvent;
