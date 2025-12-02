"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStreamFormatImpl = exports.AudioStreamFormat = exports.AudioFormatTag = void 0;
// eslint-disable-next-line max-classes-per-file
var AudioFormatTag;
(function (AudioFormatTag) {
    AudioFormatTag[AudioFormatTag["PCM"] = 1] = "PCM";
    AudioFormatTag[AudioFormatTag["MuLaw"] = 2] = "MuLaw";
    AudioFormatTag[AudioFormatTag["Siren"] = 3] = "Siren";
    AudioFormatTag[AudioFormatTag["MP3"] = 4] = "MP3";
    AudioFormatTag[AudioFormatTag["SILKSkype"] = 5] = "SILKSkype";
    AudioFormatTag[AudioFormatTag["OGG_OPUS"] = 6] = "OGG_OPUS";
    AudioFormatTag[AudioFormatTag["WEBM_OPUS"] = 7] = "WEBM_OPUS";
    AudioFormatTag[AudioFormatTag["ALaw"] = 8] = "ALaw";
    AudioFormatTag[AudioFormatTag["FLAC"] = 9] = "FLAC";
    AudioFormatTag[AudioFormatTag["OPUS"] = 10] = "OPUS";
    AudioFormatTag[AudioFormatTag["AMR_WB"] = 11] = "AMR_WB";
    AudioFormatTag[AudioFormatTag["G722"] = 12] = "G722";
})(AudioFormatTag = exports.AudioFormatTag || (exports.AudioFormatTag = {}));
/**
 * Represents audio stream format used for custom audio input configurations.
 * @class AudioStreamFormat
 */
class AudioStreamFormat {
    /**
     * Creates an audio stream format object representing the default audio stream
     * format (16KHz 16bit mono PCM).
     * @member AudioStreamFormat.getDefaultInputFormat
     * @function
     * @public
     * @returns {AudioStreamFormat} The audio stream format being created.
     */
    static getDefaultInputFormat() {
        return AudioStreamFormatImpl.getDefaultInputFormat();
    }
    /**
     * Creates an audio stream format object with the specified format characteristics.
     * @member AudioStreamFormat.getWaveFormat
     * @function
     * @public
     * @param {number} samplesPerSecond - Sample rate, in samples per second (Hertz).
     * @param {number} bitsPerSample - Bits per sample, typically 16.
     * @param {number} channels - Number of channels in the waveform-audio data. Monaural data
     * uses one channel and stereo data uses two channels.
     * @param {AudioFormatTag} format - Audio format (PCM, alaw or mulaw).
     * @returns {AudioStreamFormat} The audio stream format being created.
     */
    static getWaveFormat(samplesPerSecond, bitsPerSample, channels, format) {
        return new AudioStreamFormatImpl(samplesPerSecond, bitsPerSample, channels, format);
    }
    /**
     * Creates an audio stream format object with the specified pcm waveformat characteristics.
     * @member AudioStreamFormat.getWaveFormatPCM
     * @function
     * @public
     * @param {number} samplesPerSecond - Sample rate, in samples per second (Hertz).
     * @param {number} bitsPerSample - Bits per sample, typically 16.
     * @param {number} channels - Number of channels in the waveform-audio data. Monaural data
     * uses one channel and stereo data uses two channels.
     * @returns {AudioStreamFormat} The audio stream format being created.
     */
    static getWaveFormatPCM(samplesPerSecond, bitsPerSample, channels) {
        return new AudioStreamFormatImpl(samplesPerSecond, bitsPerSample, channels);
    }
}
exports.AudioStreamFormat = AudioStreamFormat;
/**
 * @private
 * @class AudioStreamFormatImpl
 */
class AudioStreamFormatImpl extends AudioStreamFormat {
    /**
     * Creates an instance with the given values.
     * @constructor
     * @param {number} samplesPerSec - Samples per second.
     * @param {number} bitsPerSample - Bits per sample.
     * @param {number} channels - Number of channels.
     * @param {AudioFormatTag} format - Audio format (PCM, alaw or mulaw).
     */
    constructor(samplesPerSec = 16000, bitsPerSample = 16, channels = 1, format = AudioFormatTag.PCM) {
        super();
        let isWavFormat = true;
        /* 1 for PCM; 6 for alaw; 7 for mulaw */
        switch (format) {
            case AudioFormatTag.PCM:
                this.formatTag = 1;
                break;
            case AudioFormatTag.ALaw:
                this.formatTag = 6;
                break;
            case AudioFormatTag.MuLaw:
                this.formatTag = 7;
                break;
            default:
                isWavFormat = false;
        }
        this.bitsPerSample = bitsPerSample;
        this.samplesPerSec = samplesPerSec;
        this.channels = channels;
        this.avgBytesPerSec = this.samplesPerSec * this.channels * (this.bitsPerSample / 8);
        this.blockAlign = this.channels * Math.max(this.bitsPerSample, 8);
        if (isWavFormat) {
            this.privHeader = new ArrayBuffer(44);
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView
            const view = new DataView(this.privHeader);
            /* RIFF identifier */
            this.setString(view, 0, "RIFF");
            /* file length */
            view.setUint32(4, 0, true);
            /* RIFF type & Format */
            this.setString(view, 8, "WAVEfmt ");
            /* format chunk length */
            view.setUint32(16, 16, true);
            /* audio format */
            view.setUint16(20, this.formatTag, true);
            /* channel count */
            view.setUint16(22, this.channels, true);
            /* sample rate */
            view.setUint32(24, this.samplesPerSec, true);
            /* byte rate (sample rate * block align) */
            view.setUint32(28, this.avgBytesPerSec, true);
            /* block align (channel count * bytes per sample) */
            view.setUint16(32, this.channels * (this.bitsPerSample / 8), true);
            /* bits per sample */
            view.setUint16(34, this.bitsPerSample, true);
            /* data chunk identifier */
            this.setString(view, 36, "data");
            /* data chunk length */
            view.setUint32(40, 0, true);
        }
    }
    /**
     * Retrieves the default input format.
     * @member AudioStreamFormatImpl.getDefaultInputFormat
     * @function
     * @public
     * @returns {AudioStreamFormatImpl} The default input format.
     */
    static getDefaultInputFormat() {
        return new AudioStreamFormatImpl();
    }
    /**
     * Creates an audio context appropriate to current browser
     * @member AudioStreamFormatImpl.getAudioContext
     * @function
     * @public
     * @returns {AudioContext} An audio context instance
     */
    /* eslint-disable */
    static getAudioContext(sampleRate) {
        // Workaround for Speech SDK bug in Safari.
        const AudioContext = window.AudioContext // our preferred impl
            || window.webkitAudioContext // fallback, mostly when on Safari
            || false; // could not find.
        // https://developer.mozilla.org/en-US/docs/Web/API/AudioContext
        if (!!AudioContext) {
            if (sampleRate !== undefined && navigator.mediaDevices.getSupportedConstraints().sampleRate) {
                return new AudioContext({ sampleRate });
            }
            else {
                return new AudioContext();
            }
        }
        else {
            throw new Error("Browser does not support Web Audio API (AudioContext is not available).");
        }
    }
    /* eslint-enable */
    /**
     * Closes the configuration object.
     * @member AudioStreamFormatImpl.prototype.close
     * @function
     * @public
     */
    close() {
        return;
    }
    get header() {
        return this.privHeader;
    }
    setString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }
}
exports.AudioStreamFormatImpl = AudioStreamFormatImpl;

//# sourceMappingURL=AudioStreamFormat.js.map
