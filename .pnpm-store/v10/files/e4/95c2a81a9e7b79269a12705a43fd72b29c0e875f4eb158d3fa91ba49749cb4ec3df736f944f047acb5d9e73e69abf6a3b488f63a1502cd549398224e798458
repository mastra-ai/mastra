"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendingAgentContextMessageEvent = exports.DialogEvent = void 0;
const PlatformEvent_js_1 = require("./PlatformEvent.js");
class DialogEvent extends PlatformEvent_js_1.PlatformEvent {
    constructor(eventName, eventType = PlatformEvent_js_1.EventType.Info) {
        super(eventName, eventType);
    }
}
exports.DialogEvent = DialogEvent;
class SendingAgentContextMessageEvent extends DialogEvent {
    constructor(agentConfig) {
        super("SendingAgentContextMessageEvent");
        this.privAgentConfig = agentConfig;
    }
    get agentConfig() {
        return this.privAgentConfig;
    }
}
exports.SendingAgentContextMessageEvent = SendingAgentContextMessageEvent;

//# sourceMappingURL=DialogEvents.js.map
