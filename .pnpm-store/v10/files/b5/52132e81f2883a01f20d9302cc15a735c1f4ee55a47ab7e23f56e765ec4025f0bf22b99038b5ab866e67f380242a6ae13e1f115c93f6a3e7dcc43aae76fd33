import { INumberDictionary } from "../../common/Exports.js";
import { SpeechSynthesisOutputFormat } from "../SpeechSynthesisOutputFormat.js";
import { AudioFormatTag, AudioStreamFormatImpl } from "./AudioStreamFormat.js";
/**
 * @private
 * @class AudioOutputFormatImpl
 * Updated in version 1.17.0
 */
export declare class AudioOutputFormatImpl extends AudioStreamFormatImpl {
    static SpeechSynthesisOutputFormatToString: INumberDictionary<string>;
    private priAudioFormatString;
    /**
     * audio format string for synthesis request, which may differ from priAudioFormatString.
     * e.g. for riff format, we will request raw format and add a header in SDK side.
     */
    private readonly priRequestAudioFormatString;
    private readonly priHasHeader;
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
    constructor(formatTag: AudioFormatTag, channels: number, samplesPerSec: number, avgBytesPerSec: number, blockAlign: number, bitsPerSample: number, audioFormatString: string, requestAudioFormatString: string, hasHeader: boolean);
    static fromSpeechSynthesisOutputFormat(speechSynthesisOutputFormat?: SpeechSynthesisOutputFormat): AudioOutputFormatImpl;
    static fromSpeechSynthesisOutputFormatString(speechSynthesisOutputFormatString: string): AudioOutputFormatImpl;
    static getDefaultOutputFormat(): AudioOutputFormatImpl;
    /**
     * The format tag of the audio
     * @AudioFormatTag AudioOutputFormatImpl.prototype.formatTag
     * @function
     * @public
     */
    formatTag: AudioFormatTag;
    /**
     * Specifies if this audio output format has a header
     * @boolean AudioOutputFormatImpl.prototype.hasHeader
     * @function
     * @public
     */
    get hasHeader(): boolean;
    /**
     * Specifies the header of this format
     * @ArrayBuffer AudioOutputFormatImpl.prototype.header
     * @function
     * @public
     */
    get header(): ArrayBuffer;
    /**
     * Updates the header based on the audio length
     * @member AudioOutputFormatImpl.updateHeader
     * @function
     * @public
     * @param {number} audioLength - the audio length
     */
    updateHeader(audioLength: number): void;
    /**
     * Specifies the audio format string to be sent to the service
     * @string AudioOutputFormatImpl.prototype.requestAudioFormatString
     * @function
     * @public
     */
    get requestAudioFormatString(): string;
    /**
     * Adds audio header
     * @param audio the raw audio without header
     * @returns the audio with header if applicable
     */
    addHeader(audio: ArrayBuffer): ArrayBuffer;
}
