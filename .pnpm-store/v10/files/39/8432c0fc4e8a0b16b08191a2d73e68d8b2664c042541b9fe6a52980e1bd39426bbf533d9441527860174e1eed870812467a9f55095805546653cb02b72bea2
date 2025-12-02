"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileAudioSource = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
const AudioStreamFormat_js_1 = require("../sdk/Audio/AudioStreamFormat.js");
class FileAudioSource {
    constructor(file, filename, audioSourceId) {
        this.privStreams = {};
        this.privHeaderEnd = 44;
        this.privId = audioSourceId ? audioSourceId : (0, Exports_js_2.createNoDashGuid)();
        this.privEvents = new Exports_js_2.EventSource();
        this.privSource = file;
        if (typeof window !== "undefined" && typeof Blob !== "undefined" && this.privSource instanceof Blob) {
            this.privFilename = file.name;
        }
        else {
            this.privFilename = filename || "unknown.wav";
        }
        // Read the header.
        this.privAudioFormatPromise = this.readHeader();
    }
    get format() {
        return this.privAudioFormatPromise;
    }
    turnOn() {
        if (this.privFilename.lastIndexOf(".wav") !== this.privFilename.length - 4) {
            const errorMsg = this.privFilename + " is not supported. Only WAVE files are allowed at the moment.";
            this.onEvent(new Exports_js_2.AudioSourceErrorEvent(errorMsg, ""));
            return Promise.reject(errorMsg);
        }
        this.onEvent(new Exports_js_2.AudioSourceInitializingEvent(this.privId)); // no stream id
        this.onEvent(new Exports_js_2.AudioSourceReadyEvent(this.privId));
        return;
    }
    id() {
        return this.privId;
    }
    async attach(audioNodeId) {
        this.onEvent(new Exports_js_2.AudioStreamNodeAttachingEvent(this.privId, audioNodeId));
        const stream = await this.upload(audioNodeId);
        this.onEvent(new Exports_js_2.AudioStreamNodeAttachedEvent(this.privId, audioNodeId));
        return Promise.resolve({
            detach: async () => {
                stream.readEnded();
                delete this.privStreams[audioNodeId];
                this.onEvent(new Exports_js_2.AudioStreamNodeDetachedEvent(this.privId, audioNodeId));
                await this.turnOff();
            },
            id: () => audioNodeId,
            read: () => stream.read(),
        });
    }
    detach(audioNodeId) {
        if (audioNodeId && this.privStreams[audioNodeId]) {
            this.privStreams[audioNodeId].close();
            delete this.privStreams[audioNodeId];
            this.onEvent(new Exports_js_2.AudioStreamNodeDetachedEvent(this.privId, audioNodeId));
        }
    }
    turnOff() {
        for (const streamId in this.privStreams) {
            if (streamId) {
                const stream = this.privStreams[streamId];
                if (stream && !stream.isClosed) {
                    stream.close();
                }
            }
        }
        this.onEvent(new Exports_js_2.AudioSourceOffEvent(this.privId)); // no stream now
        return Promise.resolve();
    }
    get events() {
        return this.privEvents;
    }
    get deviceInfo() {
        return this.privAudioFormatPromise.then((result) => (Promise.resolve({
            bitspersample: result.bitsPerSample,
            channelcount: result.channels,
            connectivity: Exports_js_1.connectivity.Unknown,
            manufacturer: "Speech SDK",
            model: "File",
            samplerate: result.samplesPerSec,
            type: Exports_js_1.type.File,
        })));
    }
    readHeader() {
        // Read the wave header.
        const maxHeaderSize = 4296;
        const header = this.privSource.slice(0, maxHeaderSize);
        const headerResult = new Exports_js_2.Deferred();
        const processHeader = (header) => {
            const view = new DataView(header);
            const getWord = (index) => String.fromCharCode(view.getUint8(index), view.getUint8(index + 1), view.getUint8(index + 2), view.getUint8(index + 3));
            // RIFF 4 bytes.
            if ("RIFF" !== getWord(0)) {
                headerResult.reject("Invalid WAV header in file, RIFF was not found");
                return;
            }
            // length, 4 bytes
            // RIFF Type & fmt 8 bytes
            if ("WAVE" !== getWord(8) || "fmt " !== getWord(12)) {
                headerResult.reject("Invalid WAV header in file, WAVEfmt was not found");
                return;
            }
            const formatSize = view.getInt32(16, true);
            const channelCount = view.getUint16(22, true);
            const sampleRate = view.getUint32(24, true);
            const bitsPerSample = view.getUint16(34, true);
            // Confirm if header is 44 bytes long.
            let pos = 36 + Math.max(formatSize - 16, 0);
            for (; getWord(pos) !== "data"; pos += 2) {
                if (pos > maxHeaderSize - 8) {
                    headerResult.reject("Invalid WAV header in file, data block was not found");
                    return;
                }
            }
            this.privHeaderEnd = pos + 8;
            headerResult.resolve(AudioStreamFormat_js_1.AudioStreamFormat.getWaveFormatPCM(sampleRate, bitsPerSample, channelCount));
        };
        if (typeof window !== "undefined" && typeof Blob !== "undefined" && header instanceof Blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const header = event.target.result;
                processHeader(header);
            };
            reader.readAsArrayBuffer(header);
        }
        else {
            const h = header;
            processHeader(h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength));
        }
        return headerResult.promise;
    }
    async upload(audioNodeId) {
        const onerror = (error) => {
            const errorMsg = `Error occurred while processing '${this.privFilename}'. ${error}`;
            this.onEvent(new Exports_js_2.AudioStreamNodeErrorEvent(this.privId, audioNodeId, errorMsg));
            throw new Error(errorMsg);
        };
        try {
            await this.turnOn();
            const format = await this.privAudioFormatPromise;
            const stream = new Exports_js_2.ChunkedArrayBufferStream(format.avgBytesPerSec / 10, audioNodeId);
            this.privStreams[audioNodeId] = stream;
            const chunk = this.privSource.slice(this.privHeaderEnd);
            const processFile = (buff) => {
                if (stream.isClosed) {
                    return; // output stream was closed (somebody called TurnOff). We're done here.
                }
                stream.writeStreamChunk({
                    buffer: buff,
                    isEnd: false,
                    timeReceived: Date.now(),
                });
                stream.close();
            };
            if (typeof window !== "undefined" && typeof Blob !== "undefined" && chunk instanceof Blob) {
                const reader = new FileReader();
                reader.onerror = (ev) => onerror(ev.toString());
                reader.onload = (event) => {
                    const fileBuffer = event.target.result;
                    processFile(fileBuffer);
                };
                reader.readAsArrayBuffer(chunk);
            }
            else {
                const c = chunk;
                processFile(c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength));
            }
            return stream;
        }
        catch (e) {
            onerror(e);
        }
    }
    onEvent(event) {
        this.privEvents.onEvent(event);
        Exports_js_2.Events.instance.onEvent(event);
    }
}
exports.FileAudioSource = FileAudioSource;

//# sourceMappingURL=FileAudioSource.js.map
