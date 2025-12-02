"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarConfig = void 0;
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_1 = require("./Exports.js");
/**
 * Defines the talking avatar configuration.
 * @class AvatarConfig
 * Added in version 1.33.0
 *
 * @experimental This feature is experimental and might change or have limited support.
 */
class AvatarConfig {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {string} character - The avatar character.
     * @param {string} style - The avatar style.
     * @param {AvatarVideoFormat} videoFormat - The talking avatar output video format.
     */
    constructor(character, style, videoFormat) {
        this.privCustomized = false;
        this.privUseBuiltInVoice = false;
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(character, "character");
        this.character = character;
        this.style = style;
        if (videoFormat === undefined) {
            videoFormat = new Exports_js_1.AvatarVideoFormat();
        }
        this.videoFormat = videoFormat;
    }
    /**
     * Indicates if the talking avatar is customized.
     */
    get customized() {
        return this.privCustomized;
    }
    /**
     * Sets if the talking avatar is customized.
     */
    set customized(value) {
        this.privCustomized = value;
    }
    /**
     * Indicates whether to use built-in voice for custom avatar.
     */
    get useBuiltInVoice() {
        return this.privUseBuiltInVoice;
    }
    /**
     * Sets whether to use built-in voice for custom avatar.
     */
    set useBuiltInVoice(value) {
        this.privUseBuiltInVoice = value;
    }
    /**
     * Gets the background color.
     */
    get backgroundColor() {
        return this.privBackgroundColor;
    }
    /**
     * Sets the background color.
     */
    set backgroundColor(value) {
        this.privBackgroundColor = value;
    }
    /**
     * Gets the background image.
     */
    get backgroundImage() {
        return this.privBackgroundImage;
    }
    /**
     * Sets the background image.
     * @param {URL} value - The background image.
     */
    set backgroundImage(value) {
        this.privBackgroundImage = value;
    }
    /**
     * Gets the remote ICE servers.
     * @remarks This method is designed to be used internally in the SDK.
     * @returns {RTCIceServer[]} The remote ICE servers.
     */
    get remoteIceServers() {
        return this.privRemoteIceServers;
    }
    /**
     * Sets the remote ICE servers.
     * @remarks Normally, the ICE servers are gathered from the PeerConnection,
     * set this property to override the ICE servers. E.g., the ICE servers are
     * different in client and server side.
     * @param {RTCIceServer[]} value - The remote ICE servers.
     */
    set remoteIceServers(value) {
        this.privRemoteIceServers = value;
    }
}
exports.AvatarConfig = AvatarConfig;

//# sourceMappingURL=AvatarConfig.js.map
