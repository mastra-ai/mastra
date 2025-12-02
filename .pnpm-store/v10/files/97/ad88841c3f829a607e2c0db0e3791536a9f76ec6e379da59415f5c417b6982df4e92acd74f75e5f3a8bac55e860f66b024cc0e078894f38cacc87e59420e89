"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicAudioSource = exports.AudioWorkletSourceURLPropertyName = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
const AudioStreamFormat_js_1 = require("../sdk/Audio/AudioStreamFormat.js");
exports.AudioWorkletSourceURLPropertyName = "MICROPHONE-WorkletSourceUrl";
class MicAudioSource {
    constructor(privRecorder, deviceId, audioSourceId, mediaStream) {
        this.privRecorder = privRecorder;
        this.deviceId = deviceId;
        this.privStreams = {};
        this.privOutputChunkSize = MicAudioSource.AUDIOFORMAT.avgBytesPerSec / 10;
        this.privId = audioSourceId ? audioSourceId : (0, Exports_js_2.createNoDashGuid)();
        this.privEvents = new Exports_js_2.EventSource();
        this.privMediaStream = mediaStream || null;
        this.privIsClosing = false;
    }
    get format() {
        return Promise.resolve(MicAudioSource.AUDIOFORMAT);
    }
    turnOn() {
        if (this.privInitializeDeferral) {
            return this.privInitializeDeferral.promise;
        }
        this.privInitializeDeferral = new Exports_js_2.Deferred();
        try {
            this.createAudioContext();
        }
        catch (error) {
            if (error instanceof Error) {
                const typedError = error;
                this.privInitializeDeferral.reject(typedError.name + ": " + typedError.message);
            }
            else {
                this.privInitializeDeferral.reject(error);
            }
            return this.privInitializeDeferral.promise;
        }
        const nav = window.navigator;
        let getUserMedia = (
        // eslint-disable-next-line
        nav.getUserMedia ||
            nav.webkitGetUserMedia ||
            nav.mozGetUserMedia ||
            nav.msGetUserMedia);
        if (!!nav.mediaDevices) {
            getUserMedia = (constraints, successCallback, errorCallback) => {
                nav.mediaDevices
                    .getUserMedia(constraints)
                    .then(successCallback)
                    .catch(errorCallback);
            };
        }
        if (!getUserMedia) {
            const errorMsg = "Browser does not support getUserMedia.";
            this.privInitializeDeferral.reject(errorMsg);
            this.onEvent(new Exports_js_2.AudioSourceErrorEvent(errorMsg, "")); // mic initialized error - no streamid at this point
        }
        else {
            const next = () => {
                this.onEvent(new Exports_js_2.AudioSourceInitializingEvent(this.privId)); // no stream id
                if (this.privMediaStream && this.privMediaStream.active) {
                    this.onEvent(new Exports_js_2.AudioSourceReadyEvent(this.privId));
                    this.privInitializeDeferral.resolve();
                }
                else {
                    getUserMedia({ audio: this.deviceId ? { deviceId: this.deviceId } : true, video: false }, (mediaStream) => {
                        this.privMediaStream = mediaStream;
                        this.onEvent(new Exports_js_2.AudioSourceReadyEvent(this.privId));
                        this.privInitializeDeferral.resolve();
                    }, (error) => {
                        const errorMsg = `Error occurred during microphone initialization: ${error}`;
                        this.privInitializeDeferral.reject(errorMsg);
                        this.onEvent(new Exports_js_2.AudioSourceErrorEvent(this.privId, errorMsg));
                    });
                }
            };
            if (this.privContext.state === "suspended") {
                // NOTE: On iOS, the Web Audio API requires sounds to be triggered from an explicit user action.
                // https://github.com/WebAudio/web-audio-api/issues/790
                this.privContext.resume()
                    .then(next)
                    .catch((reason) => {
                    this.privInitializeDeferral.reject(`Failed to initialize audio context: ${reason}`);
                });
            }
            else {
                next();
            }
        }
        return this.privInitializeDeferral.promise;
    }
    id() {
        return this.privId;
    }
    attach(audioNodeId) {
        this.onEvent(new Exports_js_2.AudioStreamNodeAttachingEvent(this.privId, audioNodeId));
        return this.listen(audioNodeId).then((stream) => {
            this.onEvent(new Exports_js_2.AudioStreamNodeAttachedEvent(this.privId, audioNodeId));
            return {
                detach: async () => {
                    stream.readEnded();
                    delete this.privStreams[audioNodeId];
                    this.onEvent(new Exports_js_2.AudioStreamNodeDetachedEvent(this.privId, audioNodeId));
                    return this.turnOff();
                },
                id: () => audioNodeId,
                read: () => stream.read(),
            };
        });
    }
    detach(audioNodeId) {
        if (audioNodeId && this.privStreams[audioNodeId]) {
            this.privStreams[audioNodeId].close();
            delete this.privStreams[audioNodeId];
            this.onEvent(new Exports_js_2.AudioStreamNodeDetachedEvent(this.privId, audioNodeId));
        }
    }
    async turnOff() {
        for (const streamId in this.privStreams) {
            if (streamId) {
                const stream = this.privStreams[streamId];
                if (stream) {
                    stream.close();
                }
            }
        }
        this.onEvent(new Exports_js_2.AudioSourceOffEvent(this.privId)); // no stream now
        if (this.privInitializeDeferral) {
            // Correctly handle when browser forces mic off before turnOn() completes
            // eslint-disable-next-line @typescript-eslint/await-thenable
            await this.privInitializeDeferral;
            this.privInitializeDeferral = null;
        }
        await this.destroyAudioContext();
        return;
    }
    get events() {
        return this.privEvents;
    }
    get deviceInfo() {
        return this.getMicrophoneLabel().then((label) => ({
            bitspersample: MicAudioSource.AUDIOFORMAT.bitsPerSample,
            channelcount: MicAudioSource.AUDIOFORMAT.channels,
            connectivity: Exports_js_1.connectivity.Unknown,
            manufacturer: "Speech SDK",
            model: label,
            samplerate: MicAudioSource.AUDIOFORMAT.samplesPerSec,
            type: Exports_js_1.type.Microphones,
        }));
    }
    setProperty(name, value) {
        if (name === exports.AudioWorkletSourceURLPropertyName) {
            this.privRecorder.setWorkletUrl(value);
        }
        else {
            throw new Error("Property '" + name + "' is not supported on Microphone.");
        }
    }
    getMicrophoneLabel() {
        const defaultMicrophoneName = "microphone";
        // If we did this already, return the value.
        if (this.privMicrophoneLabel !== undefined) {
            return Promise.resolve(this.privMicrophoneLabel);
        }
        // If the stream isn't currently running, we can't query devices because security.
        if (this.privMediaStream === undefined || !this.privMediaStream.active) {
            return Promise.resolve(defaultMicrophoneName);
        }
        // Setup a default
        this.privMicrophoneLabel = defaultMicrophoneName;
        // Get the id of the device running the audio track.
        const microphoneDeviceId = this.privMediaStream.getTracks()[0].getSettings().deviceId;
        // If the browser doesn't support getting the device ID, set a default and return.
        if (undefined === microphoneDeviceId) {
            return Promise.resolve(this.privMicrophoneLabel);
        }
        const deferred = new Exports_js_2.Deferred();
        // Enumerate the media devices.
        navigator.mediaDevices.enumerateDevices().then((devices) => {
            for (const device of devices) {
                if (device.deviceId === microphoneDeviceId) {
                    // Found the device
                    this.privMicrophoneLabel = device.label;
                    break;
                }
            }
            deferred.resolve(this.privMicrophoneLabel);
        }, () => deferred.resolve(this.privMicrophoneLabel));
        return deferred.promise;
    }
    async listen(audioNodeId) {
        await this.turnOn();
        const stream = new Exports_js_2.ChunkedArrayBufferStream(this.privOutputChunkSize, audioNodeId);
        this.privStreams[audioNodeId] = stream;
        try {
            this.privRecorder.record(this.privContext, this.privMediaStream, stream);
        }
        catch (error) {
            this.onEvent(new Exports_js_2.AudioStreamNodeErrorEvent(this.privId, audioNodeId, error));
            throw error;
        }
        const result = stream;
        return result;
    }
    onEvent(event) {
        this.privEvents.onEvent(event);
        Exports_js_2.Events.instance.onEvent(event);
    }
    createAudioContext() {
        if (!!this.privContext) {
            return;
        }
        this.privContext = AudioStreamFormat_js_1.AudioStreamFormatImpl.getAudioContext(MicAudioSource.AUDIOFORMAT.samplesPerSec);
    }
    async destroyAudioContext() {
        if (!this.privContext) {
            return;
        }
        this.privRecorder.releaseMediaResources(this.privContext);
        // This pattern brought to you by a bug in the TypeScript compiler where it
        // confuses the ("close" in this.privContext) with this.privContext always being null as the alternate.
        // https://github.com/Microsoft/TypeScript/issues/11498
        let hasClose = false;
        if ("close" in this.privContext) {
            hasClose = true;
        }
        if (hasClose) {
            if (!this.privIsClosing) {
                // The audio context close may take enough time that the close is called twice
                this.privIsClosing = true;
                await this.privContext.close();
                this.privContext = null;
                this.privIsClosing = false;
            }
        }
        else if (null !== this.privContext && this.privContext.state === "running") {
            // Suspend actually takes a callback, but analogous to the
            // resume method, it'll be only fired if suspend is called
            // in a direct response to a user action. The later is not always
            // the case, as TurnOff is also called, when we receive an
            // end-of-speech message from the service. So, doing a best effort
            // fire-and-forget here.
            await this.privContext.suspend();
        }
    }
}
exports.MicAudioSource = MicAudioSource;
MicAudioSource.AUDIOFORMAT = AudioStreamFormat_js_1.AudioStreamFormat.getDefaultInputFormat();

//# sourceMappingURL=MicAudioSource.js.map
