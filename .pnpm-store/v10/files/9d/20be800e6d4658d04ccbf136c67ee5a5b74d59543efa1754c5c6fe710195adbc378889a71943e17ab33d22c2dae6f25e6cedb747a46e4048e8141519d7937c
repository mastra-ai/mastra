/// <reference types="node" />
import { PathLike } from "fs";
import { ISpeechConfigAudioDevice } from "../../common.speech/Exports.js";
import { AudioSourceEvent, EventSource, IAudioDestination, IAudioSource, IAudioStreamNode } from "../../common/Exports.js";
import { AudioInputStream, AudioOutputStream, AudioStreamFormat, IPlayer, PullAudioInputStreamCallback, PushAudioOutputStreamCallback } from "../Exports.js";
import { AudioStreamFormatImpl } from "./AudioStreamFormat.js";
/**
 * Represents audio input configuration used for specifying what type of input to use (microphone, file, stream).
 * @class AudioConfig
 * Updated in version 1.11.0
 */
export declare abstract class AudioConfig {
    /**
     * Creates an AudioConfig object representing the default microphone on the system.
     * @member AudioConfig.fromDefaultMicrophoneInput
     * @function
     * @public
     * @returns {AudioConfig} The audio input configuration being created.
     */
    static fromDefaultMicrophoneInput(): AudioConfig;
    /**
     * Creates an AudioConfig object representing a microphone with the specified device ID.
     * @member AudioConfig.fromMicrophoneInput
     * @function
     * @public
     * @param {string | undefined} deviceId - Specifies the device ID of the microphone to be used.
     * Default microphone is used the value is omitted.
     * @returns {AudioConfig} The audio input configuration being created.
     */
    static fromMicrophoneInput(deviceId?: string): AudioConfig;
    /**
     * Creates an AudioConfig object representing the specified file.
     * @member AudioConfig.fromWavFileInput
     * @function
     * @public
     * @param {File} fileName - Specifies the audio input file. Currently, only WAV / PCM is supported.
     * @returns {AudioConfig} The audio input configuration being created.
     */
    static fromWavFileInput(file: File | Buffer, name?: string): AudioConfig;
    /**
     * Creates an AudioConfig object representing the specified stream.
     * @member AudioConfig.fromStreamInput
     * @function
     * @public
     * @param {AudioInputStream | PullAudioInputStreamCallback | MediaStream} audioStream - Specifies the custom audio input
     * stream. Currently, only WAV / PCM is supported.
     * @returns {AudioConfig} The audio input configuration being created.
     */
    static fromStreamInput(audioStream: AudioInputStream | PullAudioInputStreamCallback | MediaStream): AudioConfig;
    /**
     * Creates an AudioConfig object representing the default speaker.
     * @member AudioConfig.fromDefaultSpeakerOutput
     * @function
     * @public
     * @returns {AudioConfig} The audio output configuration being created.
     * Added in version 1.11.0
     */
    static fromDefaultSpeakerOutput(): AudioConfig;
    /**
     * Creates an AudioConfig object representing the custom IPlayer object.
     * You can use the IPlayer object to control pause, resume, etc.
     * @member AudioConfig.fromSpeakerOutput
     * @function
     * @public
     * @param {IPlayer} player - the IPlayer object for playback.
     * @returns {AudioConfig} The audio output configuration being created.
     * Added in version 1.12.0
     */
    static fromSpeakerOutput(player?: IPlayer): AudioConfig;
    /**
     * Creates an AudioConfig object representing a specified output audio file
     * @member AudioConfig.fromAudioFileOutput
     * @function
     * @public
     * @param {PathLike} filename - the filename of the output audio file
     * @returns {AudioConfig} The audio output configuration being created.
     * Added in version 1.11.0
     */
    static fromAudioFileOutput(filename: PathLike): AudioConfig;
    /**
     * Creates an AudioConfig object representing a specified audio output stream
     * @member AudioConfig.fromStreamOutput
     * @function
     * @public
     * @param {AudioOutputStream | PushAudioOutputStreamCallback} audioStream - Specifies the custom audio output
     * stream.
     * @returns {AudioConfig} The audio output configuration being created.
     * Added in version 1.11.0
     */
    static fromStreamOutput(audioStream: AudioOutputStream | PushAudioOutputStreamCallback): AudioConfig;
    /**
     * Explicitly frees any external resource attached to the object
     * @member AudioConfig.prototype.close
     * @function
     * @public
     */
    abstract close(): void;
    /**
     * Sets an arbitrary property.
     * @member SpeechConfig.prototype.setProperty
     * @function
     * @public
     * @param {string} name - The name of the property to set.
     * @param {string} value - The new value of the property.
     */
    abstract setProperty(name: string, value: string): void;
    /**
     * Returns the current value of an arbitrary property.
     * @member SpeechConfig.prototype.getProperty
     * @function
     * @public
     * @param {string} name - The name of the property to query.
     * @param {string} def - The value to return in case the property is not known.
     * @returns {string} The current value, or provided default, of the given property.
     */
    abstract getProperty(name: string, def?: string): string;
}
/**
 * Represents audio input stream used for custom audio input configurations.
 * @private
 * @class AudioConfigImpl
 */
export declare class AudioConfigImpl extends AudioConfig implements IAudioSource {
    private privSource;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {IAudioSource} source - An audio source.
     */
    constructor(source: IAudioSource);
    /**
     * Format information for the audio
     */
    get format(): Promise<AudioStreamFormatImpl>;
    /**
     * @member AudioConfigImpl.prototype.close
     * @function
     * @public
     */
    close(cb?: () => void, err?: (error: string) => void): void;
    /**
     * @member AudioConfigImpl.prototype.id
     * @function
     * @public
     */
    id(): string;
    /**
     * @member AudioConfigImpl.prototype.turnOn
     * @function
     * @public
     * @returns {Promise<void>} A promise.
     */
    turnOn(): Promise<void>;
    /**
     * @member AudioConfigImpl.prototype.attach
     * @function
     * @public
     * @param {string} audioNodeId - The audio node id.
     * @returns {Promise<IAudioStreamNode>} A promise.
     */
    attach(audioNodeId: string): Promise<IAudioStreamNode>;
    /**
     * @member AudioConfigImpl.prototype.detach
     * @function
     * @public
     * @param {string} audioNodeId - The audio node id.
     */
    detach(audioNodeId: string): void;
    /**
     * @member AudioConfigImpl.prototype.turnOff
     * @function
     * @public
     * @returns {Promise<void>} A promise.
     */
    turnOff(): Promise<void>;
    /**
     * @member AudioConfigImpl.prototype.events
     * @function
     * @public
     * @returns {EventSource<AudioSourceEvent>} An event source for audio events.
     */
    get events(): EventSource<AudioSourceEvent>;
    setProperty(name: string, value: string): void;
    getProperty(name: string, def?: string): string;
    get deviceInfo(): Promise<ISpeechConfigAudioDevice>;
}
export declare class AudioOutputConfigImpl extends AudioConfig implements IAudioDestination {
    private privDestination;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {IAudioDestination} destination - An audio destination.
     */
    constructor(destination: IAudioDestination);
    set format(format: AudioStreamFormat);
    write(buffer: ArrayBuffer): void;
    close(): void;
    id(): string;
    setProperty(): void;
    getProperty(): string;
}
