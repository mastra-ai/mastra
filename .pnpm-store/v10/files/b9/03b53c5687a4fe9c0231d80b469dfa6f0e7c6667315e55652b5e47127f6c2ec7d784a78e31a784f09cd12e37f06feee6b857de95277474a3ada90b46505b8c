"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesisStartedEvent = exports.ConnectingToSynthesisServiceEvent = exports.SynthesisTriggeredEvent = exports.SpeechSynthesisEvent = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../common/Exports.js");
class SpeechSynthesisEvent extends Exports_js_1.PlatformEvent {
    constructor(eventName, requestId, eventType = Exports_js_1.EventType.Info) {
        super(eventName, eventType);
        this.privRequestId = requestId;
    }
    get requestId() {
        return this.privRequestId;
    }
}
exports.SpeechSynthesisEvent = SpeechSynthesisEvent;
class SynthesisTriggeredEvent extends SpeechSynthesisEvent {
    constructor(requestId, sessionAudioDestinationId, turnAudioDestinationId) {
        super("SynthesisTriggeredEvent", requestId);
        this.privSessionAudioDestinationId = sessionAudioDestinationId;
        this.privTurnAudioDestinationId = turnAudioDestinationId;
    }
    get audioSessionDestinationId() {
        return this.privSessionAudioDestinationId;
    }
    get audioTurnDestinationId() {
        return this.privTurnAudioDestinationId;
    }
}
exports.SynthesisTriggeredEvent = SynthesisTriggeredEvent;
class ConnectingToSynthesisServiceEvent extends SpeechSynthesisEvent {
    constructor(requestId, authFetchEventId) {
        super("ConnectingToSynthesisServiceEvent", requestId);
        this.privAuthFetchEventId = authFetchEventId;
    }
    get authFetchEventId() {
        return this.privAuthFetchEventId;
    }
}
exports.ConnectingToSynthesisServiceEvent = ConnectingToSynthesisServiceEvent;
class SynthesisStartedEvent extends SpeechSynthesisEvent {
    constructor(requestId, authFetchEventId) {
        super("SynthesisStartedEvent", requestId);
        this.privAuthFetchEventId = authFetchEventId;
    }
    get authFetchEventId() {
        return this.privAuthFetchEventId;
    }
}
exports.SynthesisStartedEvent = SynthesisStartedEvent;

//# sourceMappingURL=SynthesisEvents.js.map
