"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PullAudioInputStreamImpl = exports.PullAudioInputStream = exports.PushAudioInputStreamImpl = exports.PushAudioInputStream = exports.AudioInputStream = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../../common.speech/Exports.js");
const Exports_js_2 = require("../../common/Exports.js");
const Guid_js_1 = require("../../common/Guid.js");
const Exports_js_3 = require("../Exports.js");
const AudioStreamFormat_js_1 = require("./AudioStreamFormat.js");
/**
 * Represents audio input stream used for custom audio input configurations.
 * @class AudioInputStream
 */
class AudioInputStream {
    /**
     * Creates and initializes an instance.
     * @constructor
     */
    constructor() {
        return;
    }
    /**
     * Creates a memory backed PushAudioInputStream with the specified audio format.
     * @member AudioInputStream.createPushStream
     * @function
     * @public
     * @param {AudioStreamFormat} format - The audio data format in which audio will be
     * written to the push audio stream's write() method (Required if format is not 16 kHz 16bit mono PCM).
     * @returns {PushAudioInputStream} The audio input stream being created.
     */
    static createPushStream(format) {
        return PushAudioInputStream.create(format);
    }
    /**
     * Creates a PullAudioInputStream that delegates to the specified callback interface for read()
     * and close() methods.
     * @member AudioInputStream.createPullStream
     * @function
     * @public
     * @param {PullAudioInputStreamCallback} callback - The custom audio input object, derived from
     * PullAudioInputStreamCallback
     * @param {AudioStreamFormat} format - The audio data format in which audio will be returned from
     * the callback's read() method (Required if format is not 16 kHz 16bit mono PCM).
     * @returns {PullAudioInputStream} The audio input stream being created.
     */
    static createPullStream(callback, format) {
        return PullAudioInputStream.create(callback, format);
        // throw new Error("Oops");
    }
}
exports.AudioInputStream = AudioInputStream;
/**
 * Represents memory backed push audio input stream used for custom audio input configurations.
 * @class PushAudioInputStream
 */
class PushAudioInputStream extends AudioInputStream {
    /**
     * Creates a memory backed PushAudioInputStream with the specified audio format.
     * @member PushAudioInputStream.create
     * @function
     * @public
     * @param {AudioStreamFormat} format - The audio data format in which audio will be written to the
     * push audio stream's write() method (Required if format is not 16 kHz 16bit mono PCM).
     * @returns {PushAudioInputStream} The push audio input stream being created.
     */
    static create(format) {
        return new PushAudioInputStreamImpl(format);
    }
}
exports.PushAudioInputStream = PushAudioInputStream;
/**
 * Represents memory backed push audio input stream used for custom audio input configurations.
 * @private
 * @class PushAudioInputStreamImpl
 */
class PushAudioInputStreamImpl extends PushAudioInputStream {
    /**
     * Creates and initalizes an instance with the given values.
     * @constructor
     * @param {AudioStreamFormat} format - The audio stream format.
     */
    constructor(format) {
        super();
        if (format === undefined) {
            this.privFormat = AudioStreamFormat_js_1.AudioStreamFormatImpl.getDefaultInputFormat();
        }
        else {
            this.privFormat = format;
        }
        this.privEvents = new Exports_js_2.EventSource();
        this.privId = (0, Guid_js_1.createNoDashGuid)();
        this.privStream = new Exports_js_2.ChunkedArrayBufferStream(this.privFormat.avgBytesPerSec / 10);
    }
    /**
     * Format information for the audio
     */
    get format() {
        return Promise.resolve(this.privFormat);
    }
    /**
     * Writes the audio data specified by making an internal copy of the data.
     * @member PushAudioInputStreamImpl.prototype.write
     * @function
     * @public
     * @param {ArrayBuffer} dataBuffer - The audio buffer of which this function will make a copy.
     */
    write(dataBuffer) {
        this.privStream.writeStreamChunk({
            buffer: dataBuffer,
            isEnd: false,
            timeReceived: Date.now()
        });
    }
    /**
     * Closes the stream.
     * @member PushAudioInputStreamImpl.prototype.close
     * @function
     * @public
     */
    close() {
        this.privStream.close();
    }
    id() {
        return this.privId;
    }
    turnOn() {
        this.onEvent(new Exports_js_2.AudioSourceInitializingEvent(this.privId)); // no stream id
        this.onEvent(new Exports_js_2.AudioSourceReadyEvent(this.privId));
        return;
    }
    async attach(audioNodeId) {
        this.onEvent(new Exports_js_2.AudioStreamNodeAttachingEvent(this.privId, audioNodeId));
        await this.turnOn();
        const stream = this.privStream;
        this.onEvent(new Exports_js_2.AudioStreamNodeAttachedEvent(this.privId, audioNodeId));
        return {
            detach: async () => {
                this.onEvent(new Exports_js_2.AudioStreamNodeDetachedEvent(this.privId, audioNodeId));
                return this.turnOff();
            },
            id: () => audioNodeId,
            read: () => stream.read(),
        };
    }
    detach(audioNodeId) {
        this.onEvent(new Exports_js_2.AudioStreamNodeDetachedEvent(this.privId, audioNodeId));
    }
    turnOff() {
        return;
    }
    get events() {
        return this.privEvents;
    }
    get deviceInfo() {
        return Promise.resolve({
            bitspersample: this.privFormat.bitsPerSample,
            channelcount: this.privFormat.channels,
            connectivity: Exports_js_1.connectivity.Unknown,
            manufacturer: "Speech SDK",
            model: "PushStream",
            samplerate: this.privFormat.samplesPerSec,
            type: Exports_js_1.type.Stream,
        });
    }
    onEvent(event) {
        this.privEvents.onEvent(event);
        Exports_js_2.Events.instance.onEvent(event);
    }
    toBuffer(arrayBuffer) {
        const buf = Buffer.alloc(arrayBuffer.byteLength);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < buf.length; ++i) {
            buf[i] = view[i];
        }
        return buf;
    }
}
exports.PushAudioInputStreamImpl = PushAudioInputStreamImpl;
/*
 * Represents audio input stream used for custom audio input configurations.
 * @class PullAudioInputStream
 */
class PullAudioInputStream extends AudioInputStream {
    /**
     * Creates and initializes and instance.
     * @constructor
     */
    constructor() {
        super();
    }
    /**
     * Creates a PullAudioInputStream that delegates to the specified callback interface for
     * read() and close() methods, using the default format (16 kHz 16bit mono PCM).
     * @member PullAudioInputStream.create
     * @function
     * @public
     * @param {PullAudioInputStreamCallback} callback - The custom audio input object,
     * derived from PullAudioInputStreamCustomCallback
     * @param {AudioStreamFormat} format - The audio data format in which audio will be
     * returned from the callback's read() method (Required if format is not 16 kHz 16bit mono PCM).
     * @returns {PullAudioInputStream} The push audio input stream being created.
     */
    static create(callback, format) {
        return new PullAudioInputStreamImpl(callback, format);
    }
}
exports.PullAudioInputStream = PullAudioInputStream;
/**
 * Represents audio input stream used for custom audio input configurations.
 * @private
 * @class PullAudioInputStreamImpl
 */
class PullAudioInputStreamImpl extends PullAudioInputStream {
    /**
     * Creates a PullAudioInputStream that delegates to the specified callback interface for
     * read() and close() methods, using the default format (16 kHz 16bit mono PCM).
     * @constructor
     * @param {PullAudioInputStreamCallback} callback - The custom audio input object,
     * derived from PullAudioInputStreamCustomCallback
     * @param {AudioStreamFormat} format - The audio data format in which audio will be
     * returned from the callback's read() method (Required if format is not 16 kHz 16bit mono PCM).
     */
    constructor(callback, format) {
        super();
        if (undefined === format) {
            this.privFormat = Exports_js_3.AudioStreamFormat.getDefaultInputFormat();
        }
        else {
            this.privFormat = format;
        }
        this.privEvents = new Exports_js_2.EventSource();
        this.privId = (0, Guid_js_1.createNoDashGuid)();
        this.privCallback = callback;
        this.privIsClosed = false;
        this.privBufferSize = this.privFormat.avgBytesPerSec / 10;
    }
    /**
     * Format information for the audio
     */
    get format() {
        return Promise.resolve(this.privFormat);
    }
    /**
     * Closes the stream.
     * @member PullAudioInputStreamImpl.prototype.close
     * @function
     * @public
     */
    close() {
        this.privIsClosed = true;
        this.privCallback.close();
    }
    id() {
        return this.privId;
    }
    turnOn() {
        this.onEvent(new Exports_js_2.AudioSourceInitializingEvent(this.privId)); // no stream id
        this.onEvent(new Exports_js_2.AudioSourceReadyEvent(this.privId));
        return;
    }
    async attach(audioNodeId) {
        this.onEvent(new Exports_js_2.AudioStreamNodeAttachingEvent(this.privId, audioNodeId));
        await this.turnOn();
        this.onEvent(new Exports_js_2.AudioStreamNodeAttachedEvent(this.privId, audioNodeId));
        return {
            detach: () => {
                this.privCallback.close();
                this.onEvent(new Exports_js_2.AudioStreamNodeDetachedEvent(this.privId, audioNodeId));
                return this.turnOff();
            },
            id: () => audioNodeId,
            read: () => {
                let totalBytes = 0;
                let transmitBuff;
                // Until we have the minimum number of bytes to send in a transmission, keep asking for more.
                while (totalBytes < this.privBufferSize) {
                    // Sizing the read buffer to the delta between the perfect size and what's left means we won't ever get too much
                    // data back.
                    const readBuff = new ArrayBuffer(this.privBufferSize - totalBytes);
                    const pulledBytes = this.privCallback.read(readBuff);
                    // If there is no return buffer yet defined, set the return buffer to the that was just populated.
                    // This was, if we have enough data there's no copy penalty, but if we don't we have a buffer that's the
                    // preferred size allocated.
                    if (undefined === transmitBuff) {
                        transmitBuff = readBuff;
                    }
                    else {
                        // Not the first bite at the apple, so fill the return buffer with the data we got back.
                        const intView = new Int8Array(transmitBuff);
                        intView.set(new Int8Array(readBuff), totalBytes);
                    }
                    // If there are no bytes to read, just break out and be done.
                    if (0 === pulledBytes) {
                        break;
                    }
                    totalBytes += pulledBytes;
                }
                return Promise.resolve({
                    buffer: transmitBuff.slice(0, totalBytes),
                    isEnd: this.privIsClosed || totalBytes === 0,
                    timeReceived: Date.now(),
                });
            },
        };
    }
    detach(audioNodeId) {
        this.onEvent(new Exports_js_2.AudioStreamNodeDetachedEvent(this.privId, audioNodeId));
    }
    turnOff() {
        return;
    }
    get events() {
        return this.privEvents;
    }
    get deviceInfo() {
        return Promise.resolve({
            bitspersample: this.privFormat.bitsPerSample,
            channelcount: this.privFormat.channels,
            connectivity: Exports_js_1.connectivity.Unknown,
            manufacturer: "Speech SDK",
            model: "PullStream",
            samplerate: this.privFormat.samplesPerSec,
            type: Exports_js_1.type.Stream,
        });
    }
    onEvent(event) {
        this.privEvents.onEvent(event);
        Exports_js_2.Events.instance.onEvent(event);
    }
}
exports.PullAudioInputStreamImpl = PullAudioInputStreamImpl;

//# sourceMappingURL=AudioInputStream.js.map
