"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
// Multi-device Conversation is a Preview feature.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationParticipantsChangedEventArgs = void 0;
const Exports_js_1 = require("../Exports.js");
class ConversationParticipantsChangedEventArgs extends Exports_js_1.SessionEventArgs {
    constructor(reason, participants, sessionId) {
        super(sessionId);
        this.privReason = reason;
        this.privParticipant = participants;
    }
    get reason() {
        return this.privReason;
    }
    get participants() {
        return this.privParticipant;
    }
}
exports.ConversationParticipantsChangedEventArgs = ConversationParticipantsChangedEventArgs;

//# sourceMappingURL=ConversationParticipantsChangedEventArgs.js.map
