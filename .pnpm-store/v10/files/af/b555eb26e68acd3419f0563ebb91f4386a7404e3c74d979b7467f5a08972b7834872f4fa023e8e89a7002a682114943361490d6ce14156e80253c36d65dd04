"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioOutputConfigImpl = exports.AudioConfigImpl = exports.AudioConfig = void 0;
const Exports_js_1 = require("../../common.browser/Exports.js");
const Contracts_js_1 = require("../Contracts.js");
const Exports_js_2 = require("../Exports.js");
const AudioFileWriter_js_1 = require("./AudioFileWriter.js");
const AudioInputStream_js_1 = require("./AudioInputStream.js");
const AudioOutputStream_js_1 = require("./AudioOutputStream.js");
/**
 * Represents audio input configuration used for specifying what type of input to use (microphone, file, stream).
 * @class AudioConfig
 * Updated in version 1.11.0
 */
class AudioConfig {
    /**
     * Creates an AudioConfig object representing the default microphone on the system.
     * @member AudioConfig.fromDefaultMicrophoneInput
     * @function
     * @public
     * @returns {AudioConfig} The audio input configuration being created.
     */
    static fromDefaultMicrophoneInput() {
        const pcmRecorder = new Exports_js_1.PcmRecorder(true);
        return new AudioConfigImpl(new Exports_js_1.MicAudioSource(pcmRecorder));
    }
    /**
     * Creates an AudioConfig object representing a microphone with the specified device ID.
     * @member AudioConfig.fromMicrophoneInput
     * @function
     * @public
     * @param {string | undefined} deviceId - Specifies the device ID of the microphone to be used.
     * Default microphone is used the value is omitted.
     * @returns {AudioConfig} The audio input configuration being created.
     */
    static fromMicrophoneInput(deviceId) {
        const pcmRecorder = new Exports_js_1.PcmRecorder(true);
        return new AudioConfigImpl(new Exports_js_1.MicAudioSource(pcmRecorder, deviceId));
    }
    /**
     * Creates an AudioConfig object representing the specified file.
     * @member AudioConfig.fromWavFileInput
     * @function
     * @public
     * @param {File} fileName - Specifies the audio input file. Currently, only WAV / PCM is supported.
     * @returns {AudioConfig} The audio input configuration being created.
     */
    static fromWavFileInput(file, name = "unnamedBuffer.wav") {
        return new AudioConfigImpl(new Exports_js_1.FileAudioSource(file, name));
    }
    /**
     * Creates an AudioConfig object representing the specified stream.
     * @member AudioConfig.fromStreamInput
     * @function
     * @public
     * @param {AudioInputStream | PullAudioInputStreamCallback | MediaStream} audioStream - Specifies the custom audio input
     * stream. Currently, only WAV / PCM is supported.
     * @returns {AudioConfig} The audio input configuration being created.
     */
    static fromStreamInput(audioStream) {
        if (audioStream instanceof Exports_js_2.PullAudioInputStreamCallback) {
            return new AudioConfigImpl(new AudioInputStream_js_1.PullAudioInputStreamImpl(audioStream));
        }
        if (audioStream instanceof Exports_js_2.AudioInputStream) {
            return new AudioConfigImpl(audioStream);
        }
        if (typeof MediaStream !== "undefined" && audioStream instanceof MediaStream) {
            const pcmRecorder = new Exports_js_1.PcmRecorder(false);
            return new AudioConfigImpl(new Exports_js_1.MicAudioSource(pcmRecorder, null, null, audioStream));
        }
        throw new Error("Not Supported Type");
    }
    /**
     * Creates an AudioConfig object representing the default speaker.
     * @member AudioConfig.fromDefaultSpeakerOutput
     * @function
     * @public
     * @returns {AudioConfig} The audio output configuration being created.
     * Added in version 1.11.0
     */
    static fromDefaultSpeakerOutput() {
        return new AudioOutputConfigImpl(new Exports_js_2.SpeakerAudioDestination());
    }
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
    static fromSpeakerOutput(player) {
        if (player === undefined) {
            return AudioConfig.fromDefaultSpeakerOutput();
        }
        if (player instanceof Exports_js_2.SpeakerAudioDestination) {
            return new AudioOutputConfigImpl(player);
        }
        throw new Error("Not Supported Type");
    }
    /**
     * Creates an AudioConfig object representing a specified output audio file
     * @member AudioConfig.fromAudioFileOutput
     * @function
     * @public
     * @param {PathLike} filename - the filename of the output audio file
     * @returns {AudioConfig} The audio output configuration being created.
     * Added in version 1.11.0
     */
    static fromAudioFileOutput(filename) {
        return new AudioOutputConfigImpl(new AudioFileWriter_js_1.AudioFileWriter(filename));
    }
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
    static fromStreamOutput(audioStream) {
        if (audioStream instanceof Exports_js_2.PushAudioOutputStreamCallback) {
            return new AudioOutputConfigImpl(new AudioOutputStream_js_1.PushAudioOutputStreamImpl(audioStream));
        }
        if (audioStream instanceof Exports_js_2.PushAudioOutputStream) {
            return new AudioOutputConfigImpl(audioStream);
        }
        if (audioStream instanceof Exports_js_2.PullAudioOutputStream) {
            return new AudioOutputConfigImpl(audioStream);
        }
        throw new Error("Not Supported Type");
    }
}
exports.AudioConfig = AudioConfig;
/**
 * Represents audio input stream used for custom audio input configurations.
 * @private
 * @class AudioConfigImpl
 */
class AudioConfigImpl extends AudioConfig {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {IAudioSource} source - An audio source.
     */
    constructor(source) {
        super();
        this.privSource = source;
    }
    /**
     * Format information for the audio
     */
    get format() {
        return this.privSource.format;
    }
    /**
     * @member AudioConfigImpl.prototype.close
     * @function
     * @public
     */
    close(cb, err) {
        this.privSource.turnOff().then(() => {
            if (!!cb) {
                cb();
            }
        }, (error) => {
            if (!!err) {
                err(error);
            }
        });
    }
    /**
     * @member AudioConfigImpl.prototype.id
     * @function
     * @public
     */
    id() {
        return this.privSource.id();
    }
    /**
     * @member AudioConfigImpl.prototype.turnOn
     * @function
     * @public
     * @returns {Promise<void>} A promise.
     */
    turnOn() {
        return this.privSource.turnOn();
    }
    /**
     * @member AudioConfigImpl.prototype.attach
     * @function
     * @public
     * @param {string} audioNodeId - The audio node id.
     * @returns {Promise<IAudioStreamNode>} A promise.
     */
    attach(audioNodeId) {
        return this.privSource.attach(audioNodeId);
    }
    /**
     * @member AudioConfigImpl.prototype.detach
     * @function
     * @public
     * @param {string} audioNodeId - The audio node id.
     */
    detach(audioNodeId) {
        return this.privSource.detach(audioNodeId);
    }
    /**
     * @member AudioConfigImpl.prototype.turnOff
     * @function
     * @public
     * @returns {Promise<void>} A promise.
     */
    turnOff() {
        return this.privSource.turnOff();
    }
    /**
     * @member AudioConfigImpl.prototype.events
     * @function
     * @public
     * @returns {EventSource<AudioSourceEvent>} An event source for audio events.
     */
    get events() {
        return this.privSource.events;
    }
    setProperty(name, value) {
        Contracts_js_1.Contracts.throwIfNull(value, "value");
        if (undefined !== this.privSource.setProperty) {
            this.privSource.setProperty(name, value);
        }
        else {
            throw new Error("This AudioConfig instance does not support setting properties.");
        }
    }
    getProperty(name, def) {
        if (undefined !== this.privSource.getProperty) {
            return this.privSource.getProperty(name, def);
        }
        else {
            throw new Error("This AudioConfig instance does not support getting properties.");
        }
        return def;
    }
    get deviceInfo() {
        return this.privSource.deviceInfo;
    }
}
exports.AudioConfigImpl = AudioConfigImpl;
class AudioOutputConfigImpl extends AudioConfig {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {IAudioDestination} destination - An audio destination.
     */
    constructor(destination) {
        super();
        this.privDestination = destination;
    }
    set format(format) {
        this.privDestination.format = format;
    }
    write(buffer) {
        this.privDestination.write(buffer);
    }
    close() {
        this.privDestination.close();
    }
    id() {
        return this.privDestination.id();
    }
    setProperty() {
        throw new Error("This AudioConfig instance does not support setting properties.");
    }
    getProperty() {
        throw new Error("This AudioConfig instance does not support getting properties.");
    }
}
exports.AudioOutputConfigImpl = AudioOutputConfigImpl;

//# sourceMappingURL=AudioConfig.js.map
