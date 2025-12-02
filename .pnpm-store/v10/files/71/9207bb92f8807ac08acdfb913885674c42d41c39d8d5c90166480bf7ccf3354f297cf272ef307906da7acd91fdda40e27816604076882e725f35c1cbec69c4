"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechSynthesizer = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
const AudioFileWriter_js_1 = require("./Audio/AudioFileWriter.js");
const AudioOutputFormat_js_1 = require("./Audio/AudioOutputFormat.js");
const AudioOutputStream_js_1 = require("./Audio/AudioOutputStream.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_3 = require("./Exports.js");
const Synthesizer_js_1 = require("./Synthesizer.js");
/**
 * Defines the class SpeechSynthesizer for text to speech.
 * Updated in version 1.16.0
 * @class SpeechSynthesizer
 */
class SpeechSynthesizer extends Exports_js_3.Synthesizer {
    /**
     * SpeechSynthesizer constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - An set of initial properties for this synthesizer.
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the synthesizer.
     */
    constructor(speechConfig, audioConfig) {
        super(speechConfig);
        if (audioConfig !== null) {
            if (audioConfig === undefined) {
                this.audioConfig = (typeof window === "undefined") ? undefined : Exports_js_3.AudioConfig.fromDefaultSpeakerOutput();
            }
            else {
                this.audioConfig = audioConfig;
            }
        }
        this.privConnectionFactory = new Exports_js_1.SpeechSynthesisConnectionFactory();
        this.implCommonSynthesizeSetup();
    }
    /**
     * SpeechSynthesizer constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - an set of initial properties for this synthesizer
     * @param {AutoDetectSourceLanguageConfig} autoDetectSourceLanguageConfig - An source language detection configuration associated with the synthesizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the synthesizer
     */
    static FromConfig(speechConfig, autoDetectSourceLanguageConfig, audioConfig) {
        const speechConfigImpl = speechConfig;
        autoDetectSourceLanguageConfig.properties.mergeTo(speechConfigImpl.properties);
        return new SpeechSynthesizer(speechConfig, audioConfig);
    }
    /**
     * Executes speech synthesis on plain text.
     * The task returns the synthesis result.
     * @member SpeechSynthesizer.prototype.speakTextAsync
     * @function
     * @public
     * @param text - Text to be synthesized.
     * @param cb - Callback that received the SpeechSynthesisResult.
     * @param err - Callback invoked in case of an error.
     * @param stream - AudioOutputStream to receive the synthesized audio.
     */
    speakTextAsync(text, cb, err, stream) {
        this.speakImpl(text, false, cb, err, stream);
    }
    /**
     * Executes speech synthesis on SSML.
     * The task returns the synthesis result.
     * @member SpeechSynthesizer.prototype.speakSsmlAsync
     * @function
     * @public
     * @param ssml - SSML to be synthesized.
     * @param cb - Callback that received the SpeechSynthesisResult.
     * @param err - Callback invoked in case of an error.
     * @param stream - AudioOutputStream to receive the synthesized audio.
     */
    speakSsmlAsync(ssml, cb, err, stream) {
        this.speakImpl(ssml, true, cb, err, stream);
    }
    /**
     * Get list of synthesis voices available.
     * The task returns the synthesis voice result.
     * @member SpeechSynthesizer.prototype.getVoicesAsync
     * @function
     * @async
     * @public
     * @param locale - Locale of voices in BCP-47 format; if left empty, get all available voices.
     * @return {Promise<SynthesisVoicesResult>} - Promise of a SynthesisVoicesResult.
     */
    async getVoicesAsync(locale = "") {
        return this.getVoices(locale);
    }
    /**
     * Dispose of associated resources.
     * @member SpeechSynthesizer.prototype.close
     * @function
     * @public
     */
    close(cb, err) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposed);
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.dispose(true), cb, err);
    }
    /**
     * @Internal
     * Do not use externally, object returned will change without warning or notice.
     */
    get internalData() {
        return this.privAdapter;
    }
    //
    // ################################################################################################################
    // IMPLEMENTATION.
    // ################################################################################################################
    //
    // Creates the synthesis adapter
    createSynthesisAdapter(authentication, connectionFactory, synthesizerConfig) {
        return new Exports_js_1.SpeechSynthesisAdapter(authentication, connectionFactory, synthesizerConfig, this, this.audioConfig);
    }
    createRestSynthesisAdapter(authentication, synthesizerConfig) {
        return new Exports_js_1.SynthesisRestAdapter(synthesizerConfig, authentication);
    }
    implCommonSynthesizeSetup() {
        super.implCommonSynthesizeSetup();
        this.privAdapter.audioOutputFormat = AudioOutputFormat_js_1.AudioOutputFormatImpl.fromSpeechSynthesisOutputFormat(Exports_js_3.SpeechSynthesisOutputFormat[this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_SynthOutputFormat, undefined)]);
    }
    speakImpl(text, IsSsml, cb, err, dataStream) {
        try {
            Contracts_js_1.Contracts.throwIfDisposed(this.privDisposed);
            const requestId = (0, Exports_js_2.createNoDashGuid)();
            let audioDestination;
            if (dataStream instanceof Exports_js_3.PushAudioOutputStreamCallback) {
                audioDestination = new AudioOutputStream_js_1.PushAudioOutputStreamImpl(dataStream);
            }
            else if (dataStream instanceof Exports_js_3.PullAudioOutputStream) {
                audioDestination = dataStream;
            }
            else if (dataStream !== undefined) {
                audioDestination = new AudioFileWriter_js_1.AudioFileWriter(dataStream);
            }
            else {
                audioDestination = undefined;
            }
            this.synthesisRequestQueue.enqueue(new Synthesizer_js_1.SynthesisRequest(requestId, text, IsSsml, (e) => {
                this.privSynthesizing = false;
                if (!!cb) {
                    try {
                        cb(e);
                    }
                    catch (e) {
                        if (!!err) {
                            err(e);
                        }
                    }
                }
                cb = undefined;
                /* eslint-disable no-empty */
                this.adapterSpeak().catch(() => { });
            }, (e) => {
                if (!!err) {
                    err(e);
                }
            }, audioDestination));
            /* eslint-disable no-empty-function */
            this.adapterSpeak().catch(() => { });
        }
        catch (error) {
            if (!!err) {
                if (error instanceof Error) {
                    const typedError = error;
                    err(typedError.name + ": " + typedError.message);
                }
                else {
                    err(error);
                }
            }
            // Destroy the synthesizer.
            /* eslint-disable no-empty */
            this.dispose(true).catch(() => { });
        }
    }
    async getVoices(locale) {
        const requestId = (0, Exports_js_2.createNoDashGuid)();
        const response = await this.privRestAdapter.getVoicesList(requestId);
        if (response.ok && Array.isArray(response.json)) {
            let json = response.json;
            if (!!locale && locale.length > 0) {
                json = json.filter((item) => !!item.Locale && item.Locale.toLowerCase() === locale.toLowerCase());
            }
            return new Exports_js_3.SynthesisVoicesResult(requestId, json, undefined);
        }
        else {
            return new Exports_js_3.SynthesisVoicesResult(requestId, undefined, `Error: ${response.status}: ${response.statusText}`);
        }
    }
}
exports.SpeechSynthesizer = SpeechSynthesizer;

//# sourceMappingURL=SpeechSynthesizer.js.map
