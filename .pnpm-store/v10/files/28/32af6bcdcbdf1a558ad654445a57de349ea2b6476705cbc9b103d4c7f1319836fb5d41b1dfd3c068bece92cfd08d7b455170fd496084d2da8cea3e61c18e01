import { DialogServiceConfigImpl } from "./DialogServiceConfig.js";
/**
 * Class that defines configurations for the dialog service connector object for using a CustomCommands backend.
 * @class CustomCommandsConfig
 */
export declare class CustomCommandsConfig extends DialogServiceConfigImpl {
    /**
     * Creates an instance of CustomCommandsConfig.
     */
    constructor();
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
    static fromSubscription(applicationId: string, subscription: string, region: string): CustomCommandsConfig;
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
    static fromAuthorizationToken(applicationId: string, authorizationToken: string, region: string): CustomCommandsConfig;
    /**
     * Sets the corresponding backend application identifier.
     * @member CustomCommandsConfig.prototype.Conversation_ApplicationId
     * @function
     * @public
     * @param {string} value - The application identifier to set.
     */
    set applicationId(value: string);
    /**
     * Gets the corresponding backend application identifier.
     * @member CustomCommandsConfig.prototype.Conversation_ApplicationId
     * @function
     * @public
     * @param {string} value - The application identifier to get.
     */
    get applicationId(): string;
}
