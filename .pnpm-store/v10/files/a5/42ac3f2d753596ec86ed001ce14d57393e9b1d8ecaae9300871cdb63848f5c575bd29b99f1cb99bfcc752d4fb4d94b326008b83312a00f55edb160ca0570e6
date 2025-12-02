export declare enum AudioFormatTag {
    PCM = 1,
    MuLaw = 2,
    Siren = 3,
    MP3 = 4,
    SILKSkype = 5,
    OGG_OPUS = 6,
    WEBM_OPUS = 7,
    ALaw = 8,
    FLAC = 9,
    OPUS = 10,
    AMR_WB = 11,
    G722 = 12
}
/**
 * Represents audio stream format used for custom audio input configurations.
 * @class AudioStreamFormat
 */
export declare abstract class AudioStreamFormat {
    /**
     * Creates an audio stream format object representing the default audio stream
     * format (16KHz 16bit mono PCM).
     * @member AudioStreamFormat.getDefaultInputFormat
     * @function
     * @public
     * @returns {AudioStreamFormat} The audio stream format being created.
     */
    static getDefaultInputFormat(): AudioStreamFormat;
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
    static getWaveFormat(samplesPerSecond: number, bitsPerSample: number, channels: number, format: AudioFormatTag): AudioStreamFormat;
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
    static getWaveFormatPCM(samplesPerSecond: number, bitsPerSample: number, channels: number): AudioStreamFormat;
    /**
     * Explicitly frees any external resource attached to the object
     * @member AudioStreamFormat.prototype.close
     * @function
     * @public
     */
    abstract close(): void;
}
/**
 * @private
 * @class AudioStreamFormatImpl
 */
export declare class AudioStreamFormatImpl extends AudioStreamFormat {
    protected privHeader: ArrayBuffer;
    /**
     * Creates an instance with the given values.
     * @constructor
     * @param {number} samplesPerSec - Samples per second.
     * @param {number} bitsPerSample - Bits per sample.
     * @param {number} channels - Number of channels.
     * @param {AudioFormatTag} format - Audio format (PCM, alaw or mulaw).
     */
    constructor(samplesPerSec?: number, bitsPerSample?: number, channels?: number, format?: AudioFormatTag);
    /**
     * Retrieves the default input format.
     * @member AudioStreamFormatImpl.getDefaultInputFormat
     * @function
     * @public
     * @returns {AudioStreamFormatImpl} The default input format.
     */
    static getDefaultInputFormat(): AudioStreamFormatImpl;
    /**
     * Creates an audio context appropriate to current browser
     * @member AudioStreamFormatImpl.getAudioContext
     * @function
     * @public
     * @returns {AudioContext} An audio context instance
     */
    static getAudioContext(sampleRate?: number): AudioContext;
    /**
     * Closes the configuration object.
     * @member AudioStreamFormatImpl.prototype.close
     * @function
     * @public
     */
    close(): void;
    /**
     * The format of the audio, valid values: 1 (PCM)
     * @member AudioStreamFormatImpl.prototype.formatTag
     * @function
     * @public
     */
    formatTag: number;
    /**
     * The number of channels, valid values: 1 (Mono).
     * @member AudioStreamFormatImpl.prototype.channels
     * @function
     * @public
     */
    channels: number;
    /**
     * The sample rate, valid values: 16000.
     * @member AudioStreamFormatImpl.prototype.samplesPerSec
     * @function
     * @public
     */
    samplesPerSec: number;
    /**
     * The bits per sample, valid values: 16
     * @member AudioStreamFormatImpl.prototype.b
     * @function
     * @public
     */
    bitsPerSample: number;
    /**
     * Average bytes per second, usually calculated as nSamplesPerSec * nChannels * ceil(wBitsPerSample, 8).
     * @member AudioStreamFormatImpl.prototype.avgBytesPerSec
     * @function
     * @public
     */
    avgBytesPerSec: number;
    /**
     * The size of a single frame, valid values: nChannels * ceil(wBitsPerSample, 8).
     * @member AudioStreamFormatImpl.prototype.blockAlign
     * @function
     * @public
     */
    blockAlign: number;
    get header(): ArrayBuffer;
    protected setString(view: DataView, offset: number, str: string): void;
}
