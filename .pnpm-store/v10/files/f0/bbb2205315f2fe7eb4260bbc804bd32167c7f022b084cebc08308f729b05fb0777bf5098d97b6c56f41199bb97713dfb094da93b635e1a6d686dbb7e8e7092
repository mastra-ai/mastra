"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAudioPlayer = void 0;
const Error_js_1 = require("../../common/Error.js");
const Exports_js_1 = require("../Exports.js");
const AudioStreamFormat_js_1 = require("./AudioStreamFormat.js");
/**
 * Base audio player class
 * TODO: Plays only PCM for now.
 * @class
 */
class BaseAudioPlayer {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {AudioStreamFormat} audioFormat audio stream format recognized by the player.
     */
    constructor(audioFormat) {
        this.audioContext = null;
        this.gainNode = null;
        this.autoUpdateBufferTimer = 0;
        if (audioFormat === undefined) {
            audioFormat = Exports_js_1.AudioStreamFormat.getDefaultInputFormat();
        }
        this.init(audioFormat);
    }
    /**
     * play Audio sample
     * @param newAudioData audio data to be played.
     */
    playAudioSample(newAudioData, cb, err) {
        try {
            this.ensureInitializedContext();
            const audioData = this.formatAudioData(newAudioData);
            const newSamplesData = new Float32Array(this.samples.length + audioData.length);
            newSamplesData.set(this.samples, 0);
            newSamplesData.set(audioData, this.samples.length);
            this.samples = newSamplesData;
            if (!!cb) {
                cb();
            }
        }
        catch (e) {
            if (!!err) {
                err(e);
            }
        }
    }
    /**
     * stops audio and clears the buffers
     */
    stopAudio(cb, err) {
        if (this.audioContext !== null) {
            this.samples = new Float32Array();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            clearInterval(this.autoUpdateBufferTimer);
            this.audioContext.close().then(() => {
                if (!!cb) {
                    cb();
                }
            }, (error) => {
                if (!!err) {
                    err(error);
                }
            });
            this.audioContext = null;
        }
    }
    init(audioFormat) {
        this.audioFormat = audioFormat;
        this.samples = new Float32Array();
    }
    ensureInitializedContext() {
        if (this.audioContext === null) {
            this.createAudioContext();
            const timerPeriod = 200;
            this.autoUpdateBufferTimer = setInterval(() => {
                this.updateAudioBuffer();
            }, timerPeriod);
        }
    }
    createAudioContext() {
        // new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        this.audioContext = AudioStreamFormat_js_1.AudioStreamFormatImpl.getAudioContext();
        // TODO: Various examples shows this gain node, it does not seem to be needed unless we plan
        // to control the volume, not likely
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1;
        this.gainNode.connect(this.audioContext.destination);
        this.startTime = this.audioContext.currentTime;
    }
    formatAudioData(audioData) {
        switch (this.audioFormat.bitsPerSample) {
            case 8:
                return this.formatArrayBuffer(new Int8Array(audioData), 128);
            case 16:
                return this.formatArrayBuffer(new Int16Array(audioData), 32768);
            case 32:
                return this.formatArrayBuffer(new Int32Array(audioData), 2147483648);
            default:
                throw new Error_js_1.InvalidOperationError("Only WAVE_FORMAT_PCM (8/16/32 bps) format supported at this time");
        }
    }
    formatArrayBuffer(audioData, maxValue) {
        const float32Data = new Float32Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            float32Data[i] = audioData[i] / maxValue;
        }
        return float32Data;
    }
    updateAudioBuffer() {
        if (this.samples.length === 0) {
            return;
        }
        const channelCount = this.audioFormat.channels;
        const bufferSource = this.audioContext.createBufferSource();
        const frameCount = this.samples.length / channelCount;
        const audioBuffer = this.audioContext.createBuffer(channelCount, frameCount, this.audioFormat.samplesPerSec);
        // TODO: Should we do the conversion in the pushAudioSample instead?
        for (let channel = 0; channel < channelCount; channel++) {
            // Fill in individual channel data
            let channelOffset = channel;
            const audioData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < this.samples.length; i++, channelOffset += channelCount) {
                audioData[i] = this.samples[channelOffset];
            }
        }
        if (this.startTime < this.audioContext.currentTime) {
            this.startTime = this.audioContext.currentTime;
        }
        bufferSource.buffer = audioBuffer;
        bufferSource.connect(this.gainNode);
        bufferSource.start(this.startTime);
        // Make sure we play the next sample after the current one.
        this.startTime += audioBuffer.duration;
        // Clear the samples for the next pushed data.
        this.samples = new Float32Array();
    }
    async playAudio(audioData) {
        if (this.audioContext === null) {
            this.createAudioContext();
        }
        const source = this.audioContext.createBufferSource();
        const destination = this.audioContext.destination;
        await this.audioContext.decodeAudioData(audioData, (newBuffer) => {
            source.buffer = newBuffer;
            source.connect(destination);
            source.start(0);
        });
    }
}
exports.BaseAudioPlayer = BaseAudioPlayer;

//# sourceMappingURL=BaseAudioPlayer.js.map
