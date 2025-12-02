"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStreamNodeErrorEvent = exports.AudioStreamNodeDetachedEvent = exports.AudioStreamNodeAttachedEvent = exports.AudioStreamNodeAttachingEvent = exports.AudioStreamNodeEvent = exports.AudioSourceErrorEvent = exports.AudioSourceOffEvent = exports.AudioSourceReadyEvent = exports.AudioSourceInitializingEvent = exports.AudioSourceEvent = void 0;
/* eslint-disable max-classes-per-file */
const PlatformEvent_js_1 = require("./PlatformEvent.js");
class AudioSourceEvent extends PlatformEvent_js_1.PlatformEvent {
    constructor(eventName, audioSourceId, eventType = PlatformEvent_js_1.EventType.Info) {
        super(eventName, eventType);
        this.privAudioSourceId = audioSourceId;
    }
    get audioSourceId() {
        return this.privAudioSourceId;
    }
}
exports.AudioSourceEvent = AudioSourceEvent;
class AudioSourceInitializingEvent extends AudioSourceEvent {
    constructor(audioSourceId) {
        super("AudioSourceInitializingEvent", audioSourceId);
    }
}
exports.AudioSourceInitializingEvent = AudioSourceInitializingEvent;
class AudioSourceReadyEvent extends AudioSourceEvent {
    constructor(audioSourceId) {
        super("AudioSourceReadyEvent", audioSourceId);
    }
}
exports.AudioSourceReadyEvent = AudioSourceReadyEvent;
class AudioSourceOffEvent extends AudioSourceEvent {
    constructor(audioSourceId) {
        super("AudioSourceOffEvent", audioSourceId);
    }
}
exports.AudioSourceOffEvent = AudioSourceOffEvent;
class AudioSourceErrorEvent extends AudioSourceEvent {
    constructor(audioSourceId, error) {
        super("AudioSourceErrorEvent", audioSourceId, PlatformEvent_js_1.EventType.Error);
        this.privError = error;
    }
    get error() {
        return this.privError;
    }
}
exports.AudioSourceErrorEvent = AudioSourceErrorEvent;
class AudioStreamNodeEvent extends AudioSourceEvent {
    constructor(eventName, audioSourceId, audioNodeId) {
        super(eventName, audioSourceId);
        this.privAudioNodeId = audioNodeId;
    }
    get audioNodeId() {
        return this.privAudioNodeId;
    }
}
exports.AudioStreamNodeEvent = AudioStreamNodeEvent;
class AudioStreamNodeAttachingEvent extends AudioStreamNodeEvent {
    constructor(audioSourceId, audioNodeId) {
        super("AudioStreamNodeAttachingEvent", audioSourceId, audioNodeId);
    }
}
exports.AudioStreamNodeAttachingEvent = AudioStreamNodeAttachingEvent;
class AudioStreamNodeAttachedEvent extends AudioStreamNodeEvent {
    constructor(audioSourceId, audioNodeId) {
        super("AudioStreamNodeAttachedEvent", audioSourceId, audioNodeId);
    }
}
exports.AudioStreamNodeAttachedEvent = AudioStreamNodeAttachedEvent;
class AudioStreamNodeDetachedEvent extends AudioStreamNodeEvent {
    constructor(audioSourceId, audioNodeId) {
        super("AudioStreamNodeDetachedEvent", audioSourceId, audioNodeId);
    }
}
exports.AudioStreamNodeDetachedEvent = AudioStreamNodeDetachedEvent;
class AudioStreamNodeErrorEvent extends AudioStreamNodeEvent {
    constructor(audioSourceId, audioNodeId, error) {
        super("AudioStreamNodeErrorEvent", audioSourceId, audioNodeId);
        this.privError = error;
    }
    get error() {
        return this.privError;
    }
}
exports.AudioStreamNodeErrorEvent = AudioStreamNodeErrorEvent;

//# sourceMappingURL=AudioSourceEvents.js.map
