"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
/* eslint-disable max-classes-per-file */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecognitionEndedEvent = exports.RecognitionCompletionStatus = exports.RecognitionStartedEvent = exports.ConnectingToServiceEvent = exports.ListeningStartedEvent = exports.RecognitionTriggeredEvent = exports.SpeechRecognitionEvent = void 0;
const Exports_js_1 = require("../common/Exports.js");
class SpeechRecognitionEvent extends Exports_js_1.PlatformEvent {
    constructor(eventName, requestId, sessionId, eventType = Exports_js_1.EventType.Info) {
        super(eventName, eventType);
        this.privRequestId = requestId;
        this.privSessionId = sessionId;
    }
    get requestId() {
        return this.privRequestId;
    }
    get sessionId() {
        return this.privSessionId;
    }
}
exports.SpeechRecognitionEvent = SpeechRecognitionEvent;
class RecognitionTriggeredEvent extends SpeechRecognitionEvent {
    constructor(requestId, sessionId, audioSourceId, audioNodeId) {
        super("RecognitionTriggeredEvent", requestId, sessionId);
        this.privAudioSourceId = audioSourceId;
        this.privAudioNodeId = audioNodeId;
    }
    get audioSourceId() {
        return this.privAudioSourceId;
    }
    get audioNodeId() {
        return this.privAudioNodeId;
    }
}
exports.RecognitionTriggeredEvent = RecognitionTriggeredEvent;
class ListeningStartedEvent extends SpeechRecognitionEvent {
    constructor(requestId, sessionId, audioSourceId, audioNodeId) {
        super("ListeningStartedEvent", requestId, sessionId);
        this.privAudioSourceId = audioSourceId;
        this.privAudioNodeId = audioNodeId;
    }
    get audioSourceId() {
        return this.privAudioSourceId;
    }
    get audioNodeId() {
        return this.privAudioNodeId;
    }
}
exports.ListeningStartedEvent = ListeningStartedEvent;
class ConnectingToServiceEvent extends SpeechRecognitionEvent {
    constructor(requestId, authFetchEventid, sessionId) {
        super("ConnectingToServiceEvent", requestId, sessionId);
        this.privAuthFetchEventid = authFetchEventid;
    }
    get authFetchEventid() {
        return this.privAuthFetchEventid;
    }
}
exports.ConnectingToServiceEvent = ConnectingToServiceEvent;
class RecognitionStartedEvent extends SpeechRecognitionEvent {
    constructor(requestId, audioSourceId, audioNodeId, authFetchEventId, sessionId) {
        super("RecognitionStartedEvent", requestId, sessionId);
        this.privAudioSourceId = audioSourceId;
        this.privAudioNodeId = audioNodeId;
        this.privAuthFetchEventId = authFetchEventId;
    }
    get audioSourceId() {
        return this.privAudioSourceId;
    }
    get audioNodeId() {
        return this.privAudioNodeId;
    }
    get authFetchEventId() {
        return this.privAuthFetchEventId;
    }
}
exports.RecognitionStartedEvent = RecognitionStartedEvent;
var RecognitionCompletionStatus;
(function (RecognitionCompletionStatus) {
    RecognitionCompletionStatus[RecognitionCompletionStatus["Success"] = 0] = "Success";
    RecognitionCompletionStatus[RecognitionCompletionStatus["AudioSourceError"] = 1] = "AudioSourceError";
    RecognitionCompletionStatus[RecognitionCompletionStatus["AudioSourceTimeout"] = 2] = "AudioSourceTimeout";
    RecognitionCompletionStatus[RecognitionCompletionStatus["AuthTokenFetchError"] = 3] = "AuthTokenFetchError";
    RecognitionCompletionStatus[RecognitionCompletionStatus["AuthTokenFetchTimeout"] = 4] = "AuthTokenFetchTimeout";
    RecognitionCompletionStatus[RecognitionCompletionStatus["UnAuthorized"] = 5] = "UnAuthorized";
    RecognitionCompletionStatus[RecognitionCompletionStatus["ConnectTimeout"] = 6] = "ConnectTimeout";
    RecognitionCompletionStatus[RecognitionCompletionStatus["ConnectError"] = 7] = "ConnectError";
    RecognitionCompletionStatus[RecognitionCompletionStatus["ClientRecognitionActivityTimeout"] = 8] = "ClientRecognitionActivityTimeout";
    RecognitionCompletionStatus[RecognitionCompletionStatus["UnknownError"] = 9] = "UnknownError";
})(RecognitionCompletionStatus = exports.RecognitionCompletionStatus || (exports.RecognitionCompletionStatus = {}));
class RecognitionEndedEvent extends SpeechRecognitionEvent {
    constructor(requestId, audioSourceId, audioNodeId, authFetchEventId, sessionId, serviceTag, status, error) {
        super("RecognitionEndedEvent", requestId, sessionId, status === RecognitionCompletionStatus.Success ? Exports_js_1.EventType.Info : Exports_js_1.EventType.Error);
        this.privAudioSourceId = audioSourceId;
        this.privAudioNodeId = audioNodeId;
        this.privAuthFetchEventId = authFetchEventId;
        this.privStatus = status;
        this.privError = error;
        this.privServiceTag = serviceTag;
    }
    get audioSourceId() {
        return this.privAudioSourceId;
    }
    get audioNodeId() {
        return this.privAudioNodeId;
    }
    get authFetchEventId() {
        return this.privAuthFetchEventId;
    }
    get serviceTag() {
        return this.privServiceTag;
    }
    get status() {
        return this.privStatus;
    }
    get error() {
        return this.privError;
    }
}
exports.RecognitionEndedEvent = RecognitionEndedEvent;

//# sourceMappingURL=RecognitionEvents.js.map
