"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioOutputFormatImpl = void 0;
const SpeechSynthesisOutputFormat_js_1 = require("../SpeechSynthesisOutputFormat.js");
const AudioStreamFormat_js_1 = require("./AudioStreamFormat.js");
/**
 * @private
 * @class AudioOutputFormatImpl
 * Updated in version 1.17.0
 */
// eslint-disable-next-line max-classes-per-file
class AudioOutputFormatImpl extends AudioStreamFormat_js_1.AudioStreamFormatImpl {
    /**
     * Creates an instance with the given values.
     * @constructor
     * @param formatTag
     * @param {number} channels - Number of channels.
     * @param {number} samplesPerSec - Samples per second.
     * @param {number} avgBytesPerSec - Average bytes per second.
     * @param {number} blockAlign - Block alignment.
     * @param {number} bitsPerSample - Bits per sample.
     * @param {string} audioFormatString - Audio format string
     * @param {string} requestAudioFormatString - Audio format string sent to service.
     * @param {boolean} hasHeader - If the format has header or not.
     */
    constructor(formatTag, channels, samplesPerSec, avgBytesPerSec, blockAlign, bitsPerSample, audioFormatString, requestAudioFormatString, hasHeader) {
        super(samplesPerSec, bitsPerSample, channels, formatTag);
        this.formatTag = formatTag;
        this.avgBytesPerSec = avgBytesPerSec;
        this.blockAlign = blockAlign;
        this.priAudioFormatString = audioFormatString;
        this.priRequestAudioFormatString = requestAudioFormatString;
        this.priHasHeader = hasHeader;
    }
    static fromSpeechSynthesisOutputFormat(speechSynthesisOutputFormat) {
        if (speechSynthesisOutputFormat === undefined) {
            return AudioOutputFormatImpl.getDefaultOutputFormat();
        }
        return AudioOutputFormatImpl.fromSpeechSynthesisOutputFormatString(AudioOutputFormatImpl.SpeechSynthesisOutputFormatToString[speechSynthesisOutputFormat]);
    }
    static fromSpeechSynthesisOutputFormatString(speechSynthesisOutputFormatString) {
        switch (speechSynthesisOutputFormatString) {
            case "raw-8khz-8bit-mono-mulaw":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.MuLaw, 1, 8000, 8000, 1, 8, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "riff-16khz-16kbps-mono-siren":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.Siren, 1, 16000, 2000, 40, 0, speechSynthesisOutputFormatString, "audio-16khz-16kbps-mono-siren", true);
            case "audio-16khz-16kbps-mono-siren":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.Siren, 1, 16000, 2000, 40, 0, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-16khz-32kbitrate-mono-mp3":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.MP3, 1, 16000, 32 << 7, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-16khz-128kbitrate-mono-mp3":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.MP3, 1, 16000, 128 << 7, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-16khz-64kbitrate-mono-mp3":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.MP3, 1, 16000, 64 << 7, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-24khz-48kbitrate-mono-mp3":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.MP3, 1, 24000, 48 << 7, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-24khz-96kbitrate-mono-mp3":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.MP3, 1, 24000, 96 << 7, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-24khz-160kbitrate-mono-mp3":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.MP3, 1, 24000, 160 << 7, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "raw-16khz-16bit-mono-truesilk":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.SILKSkype, 1, 16000, 32000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "riff-8khz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 8000, 16000, 2, 16, speechSynthesisOutputFormatString, "raw-8khz-16bit-mono-pcm", true);
            case "riff-24khz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 24000, 48000, 2, 16, speechSynthesisOutputFormatString, "raw-24khz-16bit-mono-pcm", true);
            case "riff-8khz-8bit-mono-mulaw":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.MuLaw, 1, 8000, 8000, 1, 8, speechSynthesisOutputFormatString, "raw-8khz-8bit-mono-mulaw", true);
            case "raw-16khz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 16000, 32000, 2, 16, speechSynthesisOutputFormatString, "raw-16khz-16bit-mono-pcm", false);
            case "raw-24khz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 24000, 48000, 2, 16, speechSynthesisOutputFormatString, "raw-24khz-16bit-mono-pcm", false);
            case "raw-8khz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 8000, 16000, 2, 16, speechSynthesisOutputFormatString, "raw-8khz-16bit-mono-pcm", false);
            case "ogg-16khz-16bit-mono-opus":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.OGG_OPUS, 1, 16000, 8192, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "ogg-24khz-16bit-mono-opus":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.OGG_OPUS, 1, 24000, 8192, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "raw-48khz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 48000, 96000, 2, 16, speechSynthesisOutputFormatString, "raw-48khz-16bit-mono-pcm", false);
            case "riff-48khz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 48000, 96000, 2, 16, speechSynthesisOutputFormatString, "raw-48khz-16bit-mono-pcm", true);
            case "audio-48khz-96kbitrate-mono-mp3":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.MP3, 1, 48000, 96 << 7, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-48khz-192kbitrate-mono-mp3":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.MP3, 1, 48000, 192 << 7, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "ogg-48khz-16bit-mono-opus":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.OGG_OPUS, 1, 48000, 12000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "webm-16khz-16bit-mono-opus":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.WEBM_OPUS, 1, 16000, 4000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "webm-24khz-16bit-mono-opus":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.WEBM_OPUS, 1, 24000, 6000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "webm-24khz-16bit-24kbps-mono-opus":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.WEBM_OPUS, 1, 24000, 3000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-16khz-16bit-32kbps-mono-opus":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.OPUS, 1, 16000, 4000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-24khz-16bit-48kbps-mono-opus":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.OPUS, 1, 24000, 6000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-24khz-16bit-24kbps-mono-opus":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.OPUS, 1, 24000, 3000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-24khz-16bit-mono-flac":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.FLAC, 1, 24000, 24000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "audio-48khz-16bit-mono-flac":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.FLAC, 1, 48000, 30000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "raw-24khz-16bit-mono-truesilk":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.SILKSkype, 1, 24000, 48000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "raw-8khz-8bit-mono-alaw":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.ALaw, 1, 8000, 8000, 1, 8, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "riff-8khz-8bit-mono-alaw":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.ALaw, 1, 8000, 8000, 1, 8, speechSynthesisOutputFormatString, "raw-8khz-8bit-mono-alaw", true);
            case "raw-22050hz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 22050, 44100, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "riff-22050hz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 22050, 44100, 2, 16, speechSynthesisOutputFormatString, "raw-22050hz-16bit-mono-pcm", true);
            case "raw-44100hz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 44100, 88200, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "riff-44100hz-16bit-mono-pcm":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 44100, 88200, 2, 16, speechSynthesisOutputFormatString, "raw-44100hz-16bit-mono-pcm", true);
            case "amr-wb-16000h":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.AMR_WB, 1, 16000, 3052, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "g722-16khz-64kbps":
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.G722, 1, 16000, 8000, 2, 16, speechSynthesisOutputFormatString, speechSynthesisOutputFormatString, false);
            case "riff-16khz-16bit-mono-pcm":
            default:
                return new AudioOutputFormatImpl(AudioStreamFormat_js_1.AudioFormatTag.PCM, 1, 16000, 32000, 2, 16, "riff-16khz-16bit-mono-pcm", "raw-16khz-16bit-mono-pcm", true);
        }
    }
    static getDefaultOutputFormat() {
        return AudioOutputFormatImpl.fromSpeechSynthesisOutputFormatString((typeof window !== "undefined") ? "audio-24khz-48kbitrate-mono-mp3" : "riff-16khz-16bit-mono-pcm");
    }
    /**
     * Specifies if this audio output format has a header
     * @boolean AudioOutputFormatImpl.prototype.hasHeader
     * @function
     * @public
     */
    get hasHeader() {
        return this.priHasHeader;
    }
    /**
     * Specifies the header of this format
     * @ArrayBuffer AudioOutputFormatImpl.prototype.header
     * @function
     * @public
     */
    get header() {
        if (this.hasHeader) {
            return this.privHeader;
        }
        return undefined;
    }
    /**
     * Updates the header based on the audio length
     * @member AudioOutputFormatImpl.updateHeader
     * @function
     * @public
     * @param {number} audioLength - the audio length
     */
    updateHeader(audioLength) {
        if (this.priHasHeader) {
            const view = new DataView(this.privHeader);
            view.setUint32(4, audioLength + this.privHeader.byteLength - 8, true);
            view.setUint32(40, audioLength, true);
        }
    }
    /**
     * Specifies the audio format string to be sent to the service
     * @string AudioOutputFormatImpl.prototype.requestAudioFormatString
     * @function
     * @public
     */
    get requestAudioFormatString() {
        return this.priRequestAudioFormatString;
    }
    /**
     * Adds audio header
     * @param audio the raw audio without header
     * @returns the audio with header if applicable
     */
    addHeader(audio) {
        if (!this.hasHeader) {
            return audio;
        }
        this.updateHeader(audio.byteLength);
        const tmp = new Uint8Array(audio.byteLength + this.header.byteLength);
        tmp.set(new Uint8Array(this.header), 0);
        tmp.set(new Uint8Array(audio), this.header.byteLength);
        return tmp.buffer;
    }
}
exports.AudioOutputFormatImpl = AudioOutputFormatImpl;
AudioOutputFormatImpl.SpeechSynthesisOutputFormatToString = {
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Raw8Khz8BitMonoMULaw]: "raw-8khz-8bit-mono-mulaw",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Riff16Khz16KbpsMonoSiren]: "riff-16khz-16kbps-mono-siren",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio16Khz16KbpsMonoSiren]: "audio-16khz-16kbps-mono-siren",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3]: "audio-16khz-32kbitrate-mono-mp3",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio16Khz128KBitRateMonoMp3]: "audio-16khz-128kbitrate-mono-mp3",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio16Khz64KBitRateMonoMp3]: "audio-16khz-64kbitrate-mono-mp3",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3]: "audio-24khz-48kbitrate-mono-mp3",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3]: "audio-24khz-96kbitrate-mono-mp3",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3]: "audio-24khz-160kbitrate-mono-mp3",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoTrueSilk]: "raw-16khz-16bit-mono-truesilk",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm]: "riff-16khz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Riff8Khz16BitMonoPcm]: "riff-8khz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm]: "riff-24khz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Riff8Khz8BitMonoMULaw]: "riff-8khz-8bit-mono-mulaw",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm]: "raw-16khz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm]: "raw-24khz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Raw8Khz16BitMonoPcm]: "raw-8khz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Ogg16Khz16BitMonoOpus]: "ogg-16khz-16bit-mono-opus",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Ogg24Khz16BitMonoOpus]: "ogg-24khz-16bit-mono-opus",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Raw48Khz16BitMonoPcm]: "raw-48khz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm]: "riff-48khz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio48Khz96KBitRateMonoMp3]: "audio-48khz-96kbitrate-mono-mp3",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3]: "audio-48khz-192kbitrate-mono-mp3",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Ogg48Khz16BitMonoOpus]: "ogg-48khz-16bit-mono-opus",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Webm16Khz16BitMonoOpus]: "webm-16khz-16bit-mono-opus",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Webm24Khz16BitMonoOpus]: "webm-24khz-16bit-mono-opus",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Webm24Khz16Bit24KbpsMonoOpus]: "webm-24khz-16bit-24kbps-mono-opus",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoTrueSilk]: "raw-24khz-16bit-mono-truesilk",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Raw8Khz8BitMonoALaw]: "raw-8khz-8bit-mono-alaw",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Riff8Khz8BitMonoALaw]: "riff-8khz-8bit-mono-alaw",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio16Khz16Bit32KbpsMonoOpus]: "audio-16khz-16bit-32kbps-mono-opus",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio24Khz16Bit48KbpsMonoOpus]: "audio-24khz-16bit-48kbps-mono-opus",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Audio24Khz16Bit24KbpsMonoOpus]: "audio-24khz-16bit-24kbps-mono-opus",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Raw22050Hz16BitMonoPcm]: "raw-22050hz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Riff22050Hz16BitMonoPcm]: "riff-22050hz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Raw44100Hz16BitMonoPcm]: "raw-44100hz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.Riff44100Hz16BitMonoPcm]: "riff-44100hz-16bit-mono-pcm",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.AmrWb16000Hz]: "amr-wb-16000hz",
    [SpeechSynthesisOutputFormat_js_1.SpeechSynthesisOutputFormat.G72216Khz64Kbps]: "g722-16khz-64kbps",
};

//# sourceMappingURL=AudioOutputFormat.js.map
