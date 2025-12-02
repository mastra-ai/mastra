"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarSynthesizer = void 0;
const SpeechSynthesisConnectionFactory_js_1 = require("../common.speech/SpeechSynthesisConnectionFactory.js");
const Exports_js_1 = require("../common.speech/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
const AudioOutputFormat_js_1 = require("./Audio/AudioOutputFormat.js");
const Exports_js_3 = require("./Exports.js");
const Contracts_js_1 = require("./Contracts.js");
const Synthesizer_js_1 = require("./Synthesizer.js");
/**
 * Defines the avatar synthesizer.
 * @class AvatarSynthesizer
 * Added in version 1.33.0
 *
 * @experimental This feature is experimental and might change or have limited support.
 */
class AvatarSynthesizer extends Exports_js_3.Synthesizer {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {SpeechConfig} speechConfig - The speech config.
     * @param {AvatarConfig} avatarConfig - The talking avatar config.
     */
    constructor(speechConfig, avatarConfig) {
        super(speechConfig);
        Contracts_js_1.Contracts.throwIfNullOrUndefined(avatarConfig, "avatarConfig");
        this.privConnectionFactory = new SpeechSynthesisConnectionFactory_js_1.SpeechSynthesisConnectionFactory();
        this.privAvatarConfig = avatarConfig;
        this.implCommonSynthesizeSetup();
    }
    implCommonSynthesizeSetup() {
        super.implCommonSynthesizeSetup();
        // The service checks the audio format setting while it ignores it in avatar synthesis.
        this.privAdapter.audioOutputFormat = AudioOutputFormat_js_1.AudioOutputFormatImpl.fromSpeechSynthesisOutputFormat(Exports_js_3.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm);
    }
    /**
     * Starts the talking avatar session and establishes the WebRTC connection.
     * @member AvatarSynthesizer.prototype.startAvatarAsync
     * @function
     * @public
     * @param {AvatarWebRTCConnectionInfo} peerConnection - The peer connection.
     * @returns {Promise<SynthesisResult>} The promise of the connection result.
     */
    async startAvatarAsync(peerConnection) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(peerConnection, "peerConnection");
        this.privIceServers = peerConnection.getConfiguration().iceServers;
        Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privIceServers, "Ice servers must be set.");
        const iceGatheringDone = new Exports_js_2.Deferred();
        // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/icegatheringstatechange_event
        peerConnection.onicegatheringstatechange = () => {
            Exports_js_2.Events.instance.onEvent(new Exports_js_2.PlatformEvent("peer connection: ice gathering state: " + peerConnection.iceGatheringState, Exports_js_2.EventType.Debug));
            if (peerConnection.iceGatheringState === "complete") {
                Exports_js_2.Events.instance.onEvent(new Exports_js_2.PlatformEvent("peer connection: ice gathering complete.", Exports_js_2.EventType.Info));
                iceGatheringDone.resolve();
            }
        };
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                Exports_js_2.Events.instance.onEvent(new Exports_js_2.PlatformEvent("peer connection: ice candidate: " + event.candidate.candidate, Exports_js_2.EventType.Debug));
            }
            else {
                Exports_js_2.Events.instance.onEvent(new Exports_js_2.PlatformEvent("peer connection: ice candidate: complete", Exports_js_2.EventType.Debug));
                iceGatheringDone.resolve();
            }
        };
        // Set a timeout for ice gathering, currently 2 seconds.
        setTimeout(() => {
            if (peerConnection.iceGatheringState !== "complete") {
                Exports_js_2.Events.instance.onEvent(new Exports_js_2.PlatformEvent("peer connection: ice gathering timeout.", Exports_js_2.EventType.Warning));
                iceGatheringDone.resolve();
            }
        }, 2000);
        const sdp = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(sdp);
        await iceGatheringDone.promise;
        Exports_js_2.Events.instance.onEvent(new Exports_js_2.PlatformEvent("peer connection: got local SDP.", Exports_js_2.EventType.Info));
        this.privProperties.setProperty(Exports_js_3.PropertyId.TalkingAvatarService_WebRTC_SDP, JSON.stringify(peerConnection.localDescription));
        const result = await this.speak("", false);
        if (result.reason !== Exports_js_3.ResultReason.SynthesizingAudioCompleted) {
            return new Exports_js_3.SynthesisResult(result.resultId, result.reason, result.errorDetails, result.properties);
        }
        const sdpAnswerString = atob(result.properties.getProperty(Exports_js_3.PropertyId.TalkingAvatarService_WebRTC_SDP));
        const sdpAnswer = new RTCSessionDescription(JSON.parse(sdpAnswerString));
        await peerConnection.setRemoteDescription(sdpAnswer);
        return new Exports_js_3.SynthesisResult(result.resultId, result.reason, undefined, result.properties);
    }
    /**
     * Speaks plain text asynchronously. The rendered audio and video will be sent via the WebRTC connection.
     * @member AvatarSynthesizer.prototype.speakTextAsync
     * @function
     * @public
     * @param {string} text - The plain text to speak.
     * @returns {Promise<SynthesisResult>} The promise of the synthesis result.
     */
    async speakTextAsync(text) {
        const r = await this.speak(text, false);
        return new Exports_js_3.SynthesisResult(r.resultId, r.reason, r.errorDetails, r.properties);
    }
    /**
     * Speaks SSML asynchronously. The rendered audio and video will be sent via the WebRTC connection.
     * @member AvatarSynthesizer.prototype.speakSsmlAsync
     * @function
     * @public
     * @param {string} ssml - The SSML text to speak.
     * @returns {Promise<SynthesisResult>} The promise of the synthesis result.
     */
    async speakSsmlAsync(ssml) {
        const r = await this.speak(ssml, true);
        return new Exports_js_3.SynthesisResult(r.resultId, r.reason, r.errorDetails, r.properties);
    }
    /**
     * Speaks text asynchronously. The avatar will switch to idle state.
     * @member AvatarSynthesizer.prototype.stopSpeakingAsync
     * @function
     * @public
     * @returns {Promise<void>} The promise of the void result.
     */
    async stopSpeakingAsync() {
        while (this.synthesisRequestQueue.length() > 0) {
            const request = await this.synthesisRequestQueue.dequeue();
            request.err("Synthesis is canceled by user.");
        }
        return this.privAdapter.stopSpeaking();
    }
    /**
     * Stops the talking avatar session and closes the WebRTC connection.
     * For now, this is the same as close().
     * You need to create a new AvatarSynthesizer instance to start a new session.
     * @member AvatarSynthesizer.prototype.stopAvatarAsync
     * @function
     * @public
     * @returns {Promise<void>} The promise of the void result.
     */
    async stopAvatarAsync() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposed);
        return this.dispose(true);
    }
    /**
     * Dispose of associated resources.
     * @member AvatarSynthesizer.prototype.close
     * @function
     * @public
     */
    async close() {
        if (this.privDisposed) {
            return;
        }
        return this.dispose(true);
    }
    /**
     * Gets the ICE servers. Internal use only.
     */
    get iceServers() {
        return this.privIceServers;
    }
    // Creates the synthesis adapter
    createSynthesisAdapter(authentication, connectionFactory, synthesizerConfig) {
        return new Exports_js_1.AvatarSynthesisAdapter(authentication, connectionFactory, synthesizerConfig, this, this.privAvatarConfig);
    }
    createRestSynthesisAdapter(_authentication, _synthesizerConfig) {
        return undefined;
    }
    createSynthesizerConfig(speechConfig) {
        const config = super.createSynthesizerConfig(speechConfig);
        config.avatarEnabled = true;
        return config;
    }
    async speak(text, isSSML) {
        const requestId = (0, Exports_js_2.createNoDashGuid)();
        const deferredResult = new Exports_js_2.Deferred();
        this.synthesisRequestQueue.enqueue(new Synthesizer_js_1.SynthesisRequest(requestId, text, isSSML, (e) => {
            deferredResult.resolve(e);
            this.privSynthesizing = false;
            void this.adapterSpeak();
        }, (e) => {
            deferredResult.reject(e);
            this.privSynthesizing = false;
        }));
        void this.adapterSpeak();
        return deferredResult.promise;
    }
}
exports.AvatarSynthesizer = AvatarSynthesizer;

//# sourceMappingURL=AvatarSynthesizer.js.map
