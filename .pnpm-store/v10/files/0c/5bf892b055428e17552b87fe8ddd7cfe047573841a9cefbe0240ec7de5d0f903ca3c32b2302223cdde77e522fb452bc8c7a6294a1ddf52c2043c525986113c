"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomCommandsConfig = void 0;
const Contracts_js_1 = require("./Contracts.js");
const DialogServiceConfig_js_1 = require("./DialogServiceConfig.js");
const Exports_js_1 = require("./Exports.js");
/**
 * Class that defines configurations for the dialog service connector object for using a CustomCommands backend.
 * @class CustomCommandsConfig
 */
class CustomCommandsConfig extends DialogServiceConfig_js_1.DialogServiceConfigImpl {
    /**
     * Creates an instance of CustomCommandsConfig.
     */
    constructor() {
        super();
    }
    /**
     * Creates an instance of the bot framework config with the specified subscription and region.
     * @member CustomCommandsConfig.fromSubscription
     * @function
     * @public
     * @param applicationId Speech Commands application id.
     * @param subscription Subscription key associated with the bot
     * @param region The region name (see the <a href="https://aka.ms/csspeech/region">region page</a>).
     * @returns {CustomCommandsConfig} A new bot framework config.
     */
    static fromSubscription(applicationId, subscription, region) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(applicationId, "applicationId");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(subscription, "subscription");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(region, "region");
        const customCommandsConfig = new DialogServiceConfig_js_1.DialogServiceConfigImpl();
        customCommandsConfig.setProperty(Exports_js_1.PropertyId.Conversation_DialogType, DialogServiceConfig_js_1.DialogServiceConfig.DialogTypes.CustomCommands);
        customCommandsConfig.setProperty(Exports_js_1.PropertyId.Conversation_ApplicationId, applicationId);
        customCommandsConfig.setProperty(Exports_js_1.PropertyId.SpeechServiceConnection_Key, subscription);
        customCommandsConfig.setProperty(Exports_js_1.PropertyId.SpeechServiceConnection_Region, region);
        return customCommandsConfig;
    }
    /**
     * Creates an instance of the bot framework config with the specified Speech Commands application id, authorization token and region.
     * Note: The caller needs to ensure that the authorization token is valid. Before the authorization token
     * expires, the caller needs to refresh it by calling this setter with a new valid token.
     * As configuration values are copied when creating a new recognizer, the new token value will not apply to recognizers that have already been created.
     * For recognizers that have been created before, you need to set authorization token of the corresponding recognizer
     * to refresh the token. Otherwise, the recognizers will encounter errors during recognition.
     * @member CustomCommandsConfig.fromAuthorizationToken
     * @function
     * @public
     * @param applicationId Speech Commands application id.
     * @param authorizationToken The authorization token associated with the application.
     * @param region The region name (see the <a href="https://aka.ms/csspeech/region">region page</a>).
     * @returns {CustomCommandsConfig} A new speech commands config.
     */
    static fromAuthorizationToken(applicationId, authorizationToken, region) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(applicationId, "applicationId");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(authorizationToken, "authorizationToken");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(region, "region");
        const customCommandsConfig = new DialogServiceConfig_js_1.DialogServiceConfigImpl();
        customCommandsConfig.setProperty(Exports_js_1.PropertyId.Conversation_DialogType, DialogServiceConfig_js_1.DialogServiceConfig.DialogTypes.CustomCommands);
        customCommandsConfig.setProperty(Exports_js_1.PropertyId.Conversation_ApplicationId, applicationId);
        customCommandsConfig.setProperty(Exports_js_1.PropertyId.SpeechServiceAuthorization_Token, authorizationToken);
        customCommandsConfig.setProperty(Exports_js_1.PropertyId.SpeechServiceConnection_Region, region);
        return customCommandsConfig;
    }
    /**
     * Sets the corresponding backend application identifier.
     * @member CustomCommandsConfig.prototype.Conversation_ApplicationId
     * @function
     * @public
     * @param {string} value - The application identifier to set.
     */
    set applicationId(value) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(value, "value");
        this.setProperty(Exports_js_1.PropertyId.Conversation_ApplicationId, value);
    }
    /**
     * Gets the corresponding backend application identifier.
     * @member CustomCommandsConfig.prototype.Conversation_ApplicationId
     * @function
     * @public
     * @param {string} value - The application identifier to get.
     */
    get applicationId() {
        return this.getProperty(Exports_js_1.PropertyId.Conversation_ApplicationId);
    }
}
exports.CustomCommandsConfig = CustomCommandsConfig;

//# sourceMappingURL=CustomCommandsConfig.js.map
