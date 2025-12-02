import { SynthesisRestAdapter } from "../common.speech/SynthesisRestAdapter.js";
import { SynthesizerConfig } from "../common.speech/SynthesizerConfig.js";
import { IAuthentication, ISynthesisConnectionFactory, SpeechServiceConfig, SynthesisAdapterBase } from "../common.speech/Exports.js";
import { AvatarConfig, AvatarEventArgs, PropertyCollection, SpeechConfig, SpeechSynthesisResult, SynthesisResult, Synthesizer } from "./Exports.js";
/**
 * Defines the avatar synthesizer.
 * @class AvatarSynthesizer
 * Added in version 1.33.0
 *
 * @experimental This feature is experimental and might change or have limited support.
 */
export declare class AvatarSynthesizer extends Synthesizer {
    protected privProperties: PropertyCollection;
    private privAvatarConfig;
    private privIceServers;
    /**
     * Defines event handler for avatar events.
     * @member AvatarSynthesizer.prototype.avatarEventReceived
     * @function
     * @public
     */
    avatarEventReceived: (sender: AvatarSynthesizer, event: AvatarEventArgs) => void;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {SpeechConfig} speechConfig - The speech config.
     * @param {AvatarConfig} avatarConfig - The talking avatar config.
     */
    constructor(speechConfig: SpeechConfig, avatarConfig: AvatarConfig);
    protected implCommonSynthesizeSetup(): void;
    /**
     * Starts the talking avatar session and establishes the WebRTC connection.
     * @member AvatarSynthesizer.prototype.startAvatarAsync
     * @function
     * @public
     * @param {AvatarWebRTCConnectionInfo} peerConnection - The peer connection.
     * @returns {Promise<SynthesisResult>} The promise of the connection result.
     */
    startAvatarAsync(peerConnection: RTCPeerConnection): Promise<SynthesisResult>;
    /**
     * Speaks plain text asynchronously. The rendered audio and video will be sent via the WebRTC connection.
     * @member AvatarSynthesizer.prototype.speakTextAsync
     * @function
     * @public
     * @param {string} text - The plain text to speak.
     * @returns {Promise<SynthesisResult>} The promise of the synthesis result.
     */
    speakTextAsync(text: string): Promise<SynthesisResult>;
    /**
     * Speaks SSML asynchronously. The rendered audio and video will be sent via the WebRTC connection.
     * @member AvatarSynthesizer.prototype.speakSsmlAsync
     * @function
     * @public
     * @param {string} ssml - The SSML text to speak.
     * @returns {Promise<SynthesisResult>} The promise of the synthesis result.
     */
    speakSsmlAsync(ssml: string): Promise<SynthesisResult>;
    /**
     * Speaks text asynchronously. The avatar will switch to idle state.
     * @member AvatarSynthesizer.prototype.stopSpeakingAsync
     * @function
     * @public
     * @returns {Promise<void>} The promise of the void result.
     */
    stopSpeakingAsync(): Promise<void>;
    /**
     * Stops the talking avatar session and closes the WebRTC connection.
     * For now, this is the same as close().
     * You need to create a new AvatarSynthesizer instance to start a new session.
     * @member AvatarSynthesizer.prototype.stopAvatarAsync
     * @function
     * @public
     * @returns {Promise<void>} The promise of the void result.
     */
    stopAvatarAsync(): Promise<void>;
    /**
     * Dispose of associated resources.
     * @member AvatarSynthesizer.prototype.close
     * @function
     * @public
     */
    close(): Promise<void>;
    /**
     * Gets the ICE servers. Internal use only.
     */
    get iceServers(): RTCIceServer[];
    protected createSynthesisAdapter(authentication: IAuthentication, connectionFactory: ISynthesisConnectionFactory, synthesizerConfig: SynthesizerConfig): SynthesisAdapterBase;
    protected createRestSynthesisAdapter(_authentication: IAuthentication, _synthesizerConfig: SynthesizerConfig): SynthesisRestAdapter;
    protected createSynthesizerConfig(speechConfig: SpeechServiceConfig): SynthesizerConfig;
    protected speak(text: string, isSSML: boolean): Promise<SpeechSynthesisResult>;
}
