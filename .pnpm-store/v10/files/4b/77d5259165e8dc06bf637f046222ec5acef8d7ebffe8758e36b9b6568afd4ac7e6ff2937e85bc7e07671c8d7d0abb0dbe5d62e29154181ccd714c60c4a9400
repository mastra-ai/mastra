/**
 * An abstract base class that defines callback methods (read() and close()) for
 * custom audio input streams).
 * @class PullAudioInputStreamCallback
 */
export declare abstract class PullAudioInputStreamCallback {
    /**
     * Reads data from audio input stream into the data buffer. The maximal number of bytes
     * to be read is determined by the size of dataBuffer.
     * @member PullAudioInputStreamCallback.prototype.read
     * @function
     * @public
     * @param {ArrayBuffer} dataBuffer - The byte array to store the read data.
     * @returns {number} the number of bytes have been read.
     */
    abstract read(dataBuffer: ArrayBuffer): number;
    /**
     * Closes the audio input stream.
     * @member PullAudioInputStreamCallback.prototype.close
     * @function
     * @public
     */
    abstract close(): void;
}
