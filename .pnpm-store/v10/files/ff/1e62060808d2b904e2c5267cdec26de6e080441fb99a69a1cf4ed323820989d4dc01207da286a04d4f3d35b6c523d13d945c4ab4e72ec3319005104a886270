import { IAudioDestination } from "../../common/Exports.js";
import { AudioStreamFormat, PushAudioOutputStreamCallback } from "../Exports.js";
/**
 * Represents audio output stream used for custom audio output configurations.
 * @class AudioOutputStream
 */
export declare abstract class AudioOutputStream {
    /**
     * Creates and initializes an instance.
     * @constructor
     */
    protected constructor();
    /**
     * Sets the format of the AudioOutputStream
     * Note: the format is set by the synthesizer before writing. Do not set it before passing it to AudioConfig
     * @member AudioOutputStream.prototype.format
     */
    abstract set format(format: AudioStreamFormat);
    /**
     * Creates a memory backed PullAudioOutputStream with the specified audio format.
     * @member AudioOutputStream.createPullStream
     * @function
     * @public
     * @returns {PullAudioOutputStream} The audio output stream being created.
     */
    static createPullStream(): PullAudioOutputStream;
    /**
     * Explicitly frees any external resource attached to the object
     * @member AudioOutputStream.prototype.close
     * @function
     * @public
     */
    abstract close(): void;
}
/**
 * Represents memory backed push audio output stream used for custom audio output configurations.
 * @class PullAudioOutputStream
 */
export declare abstract class PullAudioOutputStream extends AudioOutputStream {
    /**
     * Creates a memory backed PullAudioOutputStream with the specified audio format.
     * @member PullAudioOutputStream.create
     * @function
     * @public
     * @returns {PullAudioOutputStream} The push audio output stream being created.
     */
    static create(): PullAudioOutputStream;
    /**
     * Reads audio data from the internal buffer.
     * @member PullAudioOutputStream.prototype.read
     * @function
     * @public
     * @param {ArrayBuffer} dataBuffer - An ArrayBuffer to store the read data.
     * @returns {Promise<number>} Audio buffer length has been read.
     */
    abstract read(dataBuffer: ArrayBuffer): Promise<number>;
    /**
     * Closes the stream.
     * @member PullAudioOutputStream.prototype.close
     * @function
     * @public
     */
    abstract close(): void;
}
/**
 * Represents memory backed push audio output stream used for custom audio output configurations.
 * @private
 * @class PullAudioOutputStreamImpl
 */
export declare class PullAudioOutputStreamImpl extends PullAudioOutputStream implements IAudioDestination {
    private privFormat;
    private privId;
    private privStream;
    private privLastChunkView;
    /**
     * Creates and initializes an instance with the given values.
     * @constructor
     */
    constructor();
    /**
     * Sets the format information to the stream. For internal use only.
     * @param {AudioStreamFormat} format - the format to be set.
     */
    set format(format: AudioStreamFormat);
    /**
     * Format information for the audio
     */
    get format(): AudioStreamFormat;
    /**
     * Checks if the stream is closed
     * @member PullAudioOutputStreamImpl.prototype.isClosed
     * @property
     * @public
     */
    get isClosed(): boolean;
    /**
     * Gets the id of the stream
     * @member PullAudioOutputStreamImpl.prototype.id
     * @property
     * @public
     */
    id(): string;
    /**
     * Reads audio data from the internal buffer.
     * @member PullAudioOutputStreamImpl.prototype.read
     * @function
     * @public
     * @param {ArrayBuffer} dataBuffer - An ArrayBuffer to store the read data.
     * @returns {Promise<number>} - Audio buffer length has been read.
     */
    read(dataBuffer: ArrayBuffer): Promise<number>;
    /**
     * Writes the audio data specified by making an internal copy of the data.
     * @member PullAudioOutputStreamImpl.prototype.write
     * @function
     * @public
     * @param {ArrayBuffer} dataBuffer - The audio buffer of which this function will make a copy.
     */
    write(dataBuffer: ArrayBuffer): void;
    /**
     * Closes the stream.
     * @member PullAudioOutputStreamImpl.prototype.close
     * @function
     * @public
     */
    close(): void;
}
export declare abstract class PushAudioOutputStream extends AudioOutputStream {
    /**
     * Creates and initializes and instance.
     * @constructor
     */
    protected constructor();
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
    static create(callback: PushAudioOutputStreamCallback): PushAudioOutputStream;
    /**
     * Explicitly frees any external resource attached to the object
     * @member PushAudioOutputStream.prototype.close
     * @function
     * @public
     */
    abstract close(): void;
}
/**
 * Represents audio output stream used for custom audio output configurations.
 * @private
 * @class PushAudioOutputStreamImpl
 */
export declare class PushAudioOutputStreamImpl extends PushAudioOutputStream implements IAudioDestination {
    private readonly privId;
    private privCallback;
    /**
     * Creates a PushAudioOutputStream that delegates to the specified callback interface for
     * read() and close() methods.
     * @constructor
     * @param {PushAudioOutputStreamCallback} callback - The custom audio output object,
     * derived from PushAudioOutputStreamCallback
     */
    constructor(callback: PushAudioOutputStreamCallback);
    set format(format: AudioStreamFormat);
    write(buffer: ArrayBuffer): void;
    close(): void;
    id(): string;
}
