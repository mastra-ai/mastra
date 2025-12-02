"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialogServiceConfigImpl = exports.DialogServiceConfig = void 0;
/* eslint-disable max-classes-per-file */
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_1 = require("./Exports.js");
/**
 * Class that defines base configurations for dialog service connector
 * @class DialogServiceConfig
 */
class DialogServiceConfig {
    /**
     * Creates an instance of DialogService config.
     * @constructor
     */
    constructor() {
        return;
    }
    /**
     * Sets the corresponding backend application identifier.
     * @member DialogServiceConfig.prototype.Conversation_ApplicationId
     * @function
     * @public
     * @param {string} value - The application identifier to set.
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    set applicationId(value) { }
    static get DialogTypes() {
        return {
            BotFramework: "bot_framework",
            CustomCommands: "custom_commands"
        };
    }
}
exports.DialogServiceConfig = DialogServiceConfig;
/**
 * Dialog Service configuration.
 * @class DialogServiceConfigImpl
 */
class DialogServiceConfigImpl extends DialogServiceConfig {
    /**
     * Creates an instance of dialogService config.
     */
    constructor() {
        super();
        this.privSpeechConfig = new Exports_js_1.SpeechConfigImpl();
    }
    /**
     * Provides access to custom properties.
     * @member DialogServiceConfigImpl.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The properties.
     */
    get properties() {
        return this.privSpeechConfig.properties;
    }
    /**
     * Gets the speech recognition language.
     * @member DialogServiceConfigImpl.prototype.speechRecognitionLanguage
     * @function
     * @public
     */
    get speechRecognitionLanguage() {
        return this.privSpeechConfig.speechRecognitionLanguage;
    }
    /**
     * Sets the speech recognition language.
     * @member DialogServiceConfigImpl.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @param {string} value - The language to set.
     */
    set speechRecognitionLanguage(value) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(value, "value");
        this.privSpeechConfig.speechRecognitionLanguage = value;
    }
    get outputFormat() {
        return this.privSpeechConfig.outputFormat;
    }
    set outputFormat(value) {
        this.privSpeechConfig.outputFormat = value;
    }
    /**
     * Sets a named property as value
     * @member DialogServiceConfigImpl.prototype.setProperty
     * @function
     * @public
     * @param {PropertyId | string} name - The property to set.
     * @param {string} value - The value.
     */
    setProperty(name, value) {
        this.privSpeechConfig.setProperty(name, value);
    }
    /**
     * Sets a named property as value
     * @member DialogServiceConfigImpl.prototype.getProperty
     * @function
     * @public
     * @param {PropertyId | string} name - The property to get.
     * @param {string} def - The default value to return in case the property is not known.
     * @returns {string} The current value, or provided default, of the given property.
     */
    getProperty(name, def) {
        void def;
        return this.privSpeechConfig.getProperty(name);
    }
    /**
     * Sets the proxy configuration.
     * Only relevant in Node.js environments.
     * Added in version 1.4.0.
     * @param proxyHostName The host name of the proxy server, without the protocol scheme (http://)
     * @param proxyPort The port number of the proxy server.
     * @param proxyUserName The user name of the proxy server.
     * @param proxyPassword The password of the proxy server.
     */
    setProxy(proxyHostName, proxyPort, proxyUserName, proxyPassword) {
        this.setProperty(Exports_js_1.PropertyId.SpeechServiceConnection_ProxyHostName, proxyHostName);
        this.setProperty(Exports_js_1.PropertyId.SpeechServiceConnection_ProxyPort, `${proxyPort}`);
        if (proxyUserName) {
            this.setProperty(Exports_js_1.PropertyId.SpeechServiceConnection_ProxyUserName, proxyUserName);
        }
        if (proxyPassword) {
            this.setProperty(Exports_js_1.PropertyId.SpeechServiceConnection_ProxyPassword, proxyPassword);
        }
    }
    setServiceProperty(name, value, channel) {
        void channel;
        this.privSpeechConfig.setServiceProperty(name, value);
    }
    /**
     * Dispose of associated resources.
     * @member DialogServiceConfigImpl.prototype.close
     * @function
     * @public
     */
    close() {
        return;
    }
}
exports.DialogServiceConfigImpl = DialogServiceConfigImpl;

//# sourceMappingURL=DialogServiceConfig.js.map
