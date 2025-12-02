"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushAudioOutputStreamImpl = exports.PushAudioOutputStream = exports.PullAudioOutputStreamImpl = exports.PullAudioOutputStream = exports.AudioOutputStream = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../../common/Exports.js");
const Contracts_js_1 = require("../Contracts.js");
const AudioOutputFormat_js_1 = require("./AudioOutputFormat.js");
/**
 * Represents audio output stream used for custom audio output configurations.
 * @class AudioOutputStream
 */
class AudioOutputStream {
    /**
     * Creates and initializes an instance.
     * @constructor
     */
    constructor() {
        return;
    }
    /**
     * Creates a memory backed PullAudioOutputStream with the specified audio format.
     * @member AudioOutputStream.createPullStream
     * @function
     * @public
     * @returns {PullAudioOutputStream} The audio output stream being created.
     */
    static createPullStream() {
        return PullAudioOutputStream.create();
    }
}
exports.AudioOutputStream = AudioOutputStream;
/**
 * Represents memory backed push audio output stream used for custom audio output configurations.
 * @class PullAudioOutputStream
 */
class PullAudioOutputStream extends AudioOutputStream {
    /**
     * Creates a memory backed PullAudioOutputStream with the specified audio format.
     * @member PullAudioOutputStream.create
     * @function
     * @public
     * @returns {PullAudioOutputStream} The push audio output stream being created.
     */
    static create() {
        return new PullAudioOutputStreamImpl();
    }
}
exports.PullAudioOutputStream = PullAudioOutputStream;
/**
 * Represents memory backed push audio output stream used for custom audio output configurations.
 * @private
 * @class PullAudioOutputStreamImpl
 */
class PullAudioOutputStreamImpl extends PullAudioOutputStream {
    /**
     * Creates and initializes an instance with the given values.
     * @constructor
     */
    constructor() {
        super();
        this.privId = (0, Exports_js_1.createNoDashGuid)();
        this.privStream = new Exports_js_1.Stream();
    }
    /**
     * Sets the format information to the stream. For internal use only.
     * @param {AudioStreamFormat} format - the format to be set.
     */
    set format(format) {
        if (format === undefined || format === null) {
            this.privFormat = AudioOutputFormat_js_1.AudioOutputFormatImpl.getDefaultOutputFormat();
        }
        this.privFormat = format;
    }
    /**
     * Format information for the audio
     */
    get format() {
        return this.privFormat;
    }
    /**
     * Checks if the stream is closed
     * @member PullAudioOutputStreamImpl.prototype.isClosed
     * @property
     * @public
     */
    get isClosed() {
        return this.privStream.isClosed;
    }
    /**
     * Gets the id of the stream
     * @member PullAudioOutputStreamImpl.prototype.id
     * @property
     * @public
     */
    id() {
        return this.privId;
    }
    /**
     * Reads audio data from the internal buffer.
     * @member PullAudioOutputStreamImpl.prototype.read
     * @function
     * @public
     * @param {ArrayBuffer} dataBuffer - An ArrayBuffer to store the read data.
     * @returns {Promise<number>} - Audio buffer length has been read.
     */
    async read(dataBuffer) {
        const intView = new Int8Array(dataBuffer);
        let totalBytes = 0;
        if (this.privLastChunkView !== undefined) {
            if (this.privLastChunkView.length > dataBuffer.byteLength) {
                intView.set(this.privLastChunkView.slice(0, dataBuffer.byteLength));
                this.privLastChunkView = this.privLastChunkView.slice(dataBuffer.byteLength);
                return Promise.resolve(dataBuffer.byteLength);
            }
            intView.set(this.privLastChunkView);
            totalBytes = this.privLastChunkView.length;
            this.privLastChunkView = undefined;
        }
        // Until we have the minimum number of bytes to send in a transmission, keep asking for more.
        while (totalBytes < dataBuffer.byteLength && !this.privStream.isReadEnded) {
            const chunk = await this.privStream.read();
            if (chunk !== undefined && !chunk.isEnd) {
                let tmpBuffer;
                if (chunk.buffer.byteLength > dataBuffer.byteLength - totalBytes) {
                    tmpBuffer = chunk.buffer.slice(0, dataBuffer.byteLength - totalBytes);
                    this.privLastChunkView = new Int8Array(chunk.buffer.slice(dataBuffer.byteLength - totalBytes));
                }
                else {
                    tmpBuffer = chunk.buffer;
                }
                intView.set(new Int8Array(tmpBuffer), totalBytes);
                totalBytes += tmpBuffer.byteLength;
            }
            else {
                this.privStream.readEnded();
            }
        }
        return totalBytes;
    }
    /**
     * Writes the audio data specified by making an internal copy of the data.
     * @member PullAudioOutputStreamImpl.prototype.write
     * @function
     * @public
     * @param {ArrayBuffer} dataBuffer - The audio buffer of which this function will make a copy.
     */
    write(dataBuffer) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privStream, "must set format before writing");
        this.privStream.writeStreamChunk({
            buffer: dataBuffer,
            isEnd: false,
            timeReceived: Date.now()
        });
    }
    /**
     * Closes the stream.
     * @member PullAudioOutputStreamImpl.prototype.close
     * @function
     * @public
     */
    close() {
        this.privStream.close();
    }
}
exports.PullAudioOutputStreamImpl = PullAudioOutputStreamImpl;
/*
 * Represents audio output stream used for custom audio output configurations.
 * @class PushAudioOutputStream
 */
class PushAudioOutputStream extends AudioOutputStream {
    /**
     * Creates and initializes and instance.
     * @constructor
     */
    constructor() {
        super();
    }
    /**
     * Creates a PushAudioOutputStream that delegates to the specified callback interface for
     * write() and close() methods.
     * @member PushAudioOutputStream.create
     * @function
     * @public
     * @param {PushAudioOutputStreamCallback} callback - The custom audio output object,
     * derived from PushAudioOutputStreamCallback
     * @returns {PushAudioOutputStream} The push audio output stream being created.
     */
    static create(callback) {
        return new PushAudioOutputStreamImpl(callback);
    }
}
exports.PushAudioOutputStream = PushAudioOutputStream;
/**
 * Represents audio output stream used for custom audio output configurations.
 * @private
 * @class PushAudioOutputStreamImpl
 */
class PushAudioOutputStreamImpl extends PushAudioOutputStream {
    /**
     * Creates a PushAudioOutputStream that delegates to the specified callback interface for
     * read() and close() methods.
     * @constructor
     * @param {PushAudioOutputStreamCallback} callback - The custom audio output object,
     * derived from PushAudioOutputStreamCallback
     */
    constructor(callback) {
        super();
        this.privId = (0, Exports_js_1.createNoDashGuid)();
        this.privCallback = callback;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    set format(format) { }
    write(buffer) {
        if (!!this.privCallback.write) {
            this.privCallback.write(buffer);
        }
    }
    close() {
        if (!!this.privCallback.close) {
            this.privCallback.close();
        }
    }
    id() {
        return this.privId;
    }
}
exports.PushAudioOutputStreamImpl = PushAudioOutputStreamImpl;

//# sourceMappingURL=AudioOutputStream.js.map
