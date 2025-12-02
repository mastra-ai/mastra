import { ISpeechConfigAudioDevice } from "../../common.speech/Exports.js";
import { AudioSourceEvent, EventSource, IAudioSource, IAudioStreamNode } from "../../common/Exports.js";
import { AudioStreamFormat, PullAudioInputStreamCallback } from "../Exports.js";
import { AudioStreamFormatImpl } from "./AudioStreamFormat.js";
/**
 * Represents audio input stream used for custom audio input configurations.
 * @class AudioInputStream
 */
export declare abstract class AudioInputStream {
    /**
     * Creates and initializes an instance.
     * @constructor
     */
    protected constructor();
    /**
     * Creates a memory backed PushAudioInputStream with the specified audio format.
     * @member AudioInputStream.createPushStream
     * @function
     * @public
     * @param {AudioStreamFormat} format - The audio data format in which audio will be
     * written to the push audio stream's write() method (Required if format is not 16 kHz 16bit mono PCM).
     * @returns {PushAudioInputStream} The audio input stream being created.
     */
    static createPushStream(format?: AudioStreamFormat): PushAudioInputStream;
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
    static createPullStream(callback: PullAudioInputStreamCallback, format?: AudioStreamFormat): PullAudioInputStream;
    /**
     * Explicitly frees any external resource attached to the object
     * @member AudioInputStream.prototype.close
     * @function
     * @public
     */
    abstract close(): void;
}
/**
 * Represents memory backed push audio input stream used for custom audio input configurations.
 * @class PushAudioInputStream
 */
export declare abstract class PushAudioInputStream extends AudioInputStream {
    /**
     * Creates a memory backed PushAudioInputStream with the specified audio format.
     * @member PushAudioInputStream.create
     * @function
     * @public
     * @param {AudioStreamFormat} format - The audio data format in which audio will be written to the
     * push audio stream's write() method (Required if format is not 16 kHz 16bit mono PCM).
     * @returns {PushAudioInputStream} The push audio input stream being created.
     */
    static create(format?: AudioStreamFormat): PushAudioInputStream;
    /**
     * Writes the audio data specified by making an internal copy of the data.
     * @member PushAudioInputStream.prototype.write
     * @function
     * @public
     * @param {ArrayBuffer} dataBuffer - The audio buffer of which this function will make a copy.
     */
    abstract write(dataBuffer: ArrayBuffer): void;
    /**
     * Closes the stream.
     * @member PushAudioInputStream.prototype.close
     * @function
     * @public
     */
    abstract close(): void;
}
/**
 * Represents memory backed push audio input stream used for custom audio input configurations.
 * @private
 * @class PushAudioInputStreamImpl
 */
export declare class PushAudioInputStreamImpl extends PushAudioInputStream implements IAudioSource {
    private privFormat;
    private privId;
    private privEvents;
    private privStream;
    /**
     * Creates and initalizes an instance with the given values.
     * @constructor
     * @param {AudioStreamFormat} format - The audio stream format.
     */
    constructor(format?: AudioStreamFormat);
    /**
     * Format information for the audio
     */
    get format(): Promise<AudioStreamFormatImpl>;
    /**
     * Writes the audio data specified by making an internal copy of the data.
     * @member PushAudioInputStreamImpl.prototype.write
     * @function
     * @public
     * @param {ArrayBuffer} dataBuffer - The audio buffer of which this function will make a copy.
     */
    write(dataBuffer: ArrayBuffer): void;
    /**
     * Closes the stream.
     * @member PushAudioInputStreamImpl.prototype.close
     * @function
     * @public
     */
    close(): void;
    id(): string;
    turnOn(): Promise<void>;
    attach(audioNodeId: string): Promise<IAudioStreamNode>;
    detach(audioNodeId: string): void;
    turnOff(): Promise<void>;
    get events(): EventSource<AudioSourceEvent>;
    get deviceInfo(): Promise<ISpeechConfigAudioDevice>;
    private onEvent;
    private toBuffer;
}
export declare abstract class PullAudioInputStream extends AudioInputStream {
    /**
     * Creates and initializes and instance.
     * @constructor
     */
    protected constructor();
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
    static create(callback: PullAudioInputStreamCallback, format?: AudioStreamFormat): PullAudioInputStream;
    /**
     * Explicitly frees any external resource attached to the object
     * @member PullAudioInputStream.prototype.close
     * @function
     * @public
     */
    abstract close(): void;
}
/**
 * Represents audio input stream used for custom audio input configurations.
 * @private
 * @class PullAudioInputStreamImpl
 */
export declare class PullAudioInputStreamImpl extends PullAudioInputStream implements IAudioSource {
    private privCallback;
    private privFormat;
    private privId;
    private privEvents;
    private privIsClosed;
    private privBufferSize;
    /**
     * Creates a PullAudioInputStream that delegates to the specified callback interface for
     * read() and close() methods, using the default format (16 kHz 16bit mono PCM).
     * @constructor
     * @param {PullAudioInputStreamCallback} callback - The custom audio input object,
     * derived from PullAudioInputStreamCustomCallback
     * @param {AudioStreamFormat} format - The audio data format in which audio will be
     * returned from the callback's read() method (Required if format is not 16 kHz 16bit mono PCM).
     */
    constructor(callback: PullAudioInputStreamCallback, format?: AudioStreamFormatImpl);
    /**
     * Format information for the audio
     */
    get format(): Promise<AudioStreamFormatImpl>;
    /**
     * Closes the stream.
     * @member PullAudioInputStreamImpl.prototype.close
     * @function
     * @public
     */
    close(): void;
    id(): string;
    turnOn(): Promise<void>;
    attach(audioNodeId: string): Promise<IAudioStreamNode>;
    detach(audioNodeId: string): void;
    turnOff(): Promise<void>;
    get events(): EventSource<AudioSourceEvent>;
    get deviceInfo(): Promise<ISpeechConfigAudioDevice>;
    private onEvent;
}
