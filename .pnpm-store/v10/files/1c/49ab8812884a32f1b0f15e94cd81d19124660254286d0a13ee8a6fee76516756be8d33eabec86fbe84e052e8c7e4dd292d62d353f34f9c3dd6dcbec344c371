import { AvatarVideoFormat } from "./Exports.js";
/**
 * Defines the talking avatar configuration.
 * @class AvatarConfig
 * Added in version 1.33.0
 *
 * @experimental This feature is experimental and might change or have limited support.
 */
export declare class AvatarConfig {
    private privCustomized;
    private privUseBuiltInVoice;
    private privBackgroundColor;
    private privBackgroundImage;
    private privRemoteIceServers;
    /**
     * Defines the avatar character.
     */
    character: string;
    /**
     * Defines the avatar style.
     */
    style: string;
    /**
     * Defines the talking avatar output video format.
     */
    videoFormat: AvatarVideoFormat;
    /**
     * Indicates if the talking avatar is customized.
     */
    get customized(): boolean;
    /**
     * Sets if the talking avatar is customized.
     */
    set customized(value: boolean);
    /**
     * Indicates whether to use built-in voice for custom avatar.
     */
    get useBuiltInVoice(): boolean;
    /**
     * Sets whether to use built-in voice for custom avatar.
     */
    set useBuiltInVoice(value: boolean);
    /**
     * Gets the background color.
     */
    get backgroundColor(): string;
    /**
     * Sets the background color.
     */
    set backgroundColor(value: string);
    /**
     * Gets the background image.
     */
    get backgroundImage(): URL;
    /**
     * Sets the background image.
     * @param {URL} value - The background image.
     */
    set backgroundImage(value: URL);
    /**
     * Gets the remote ICE servers.
     * @remarks This method is designed to be used internally in the SDK.
     * @returns {RTCIceServer[]} The remote ICE servers.
     */
    get remoteIceServers(): RTCIceServer[];
    /**
     * Sets the remote ICE servers.
     * @remarks Normally, the ICE servers are gathered from the PeerConnection,
     * set this property to override the ICE servers. E.g., the ICE servers are
     * different in client and server side.
     * @param {RTCIceServer[]} value - The remote ICE servers.
     */
    set remoteIceServers(value: RTCIceServer[]);
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {string} character - The avatar character.
     * @param {string} style - The avatar style.
     * @param {AvatarVideoFormat} videoFormat - The talking avatar output video format.
     */
    constructor(character: string, style: string, videoFormat: AvatarVideoFormat);
}
