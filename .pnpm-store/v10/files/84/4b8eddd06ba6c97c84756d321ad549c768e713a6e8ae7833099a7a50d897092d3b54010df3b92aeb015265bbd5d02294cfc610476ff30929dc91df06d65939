import { DialogServiceConfigImpl } from "./DialogServiceConfig.js";
/**
 * Class that defines configurations for the dialog service connector object for using a Bot Framework backend.
 * @class BotFrameworkConfig
 */
export declare class BotFrameworkConfig extends DialogServiceConfigImpl {
    /**
     * Creates an instance of BotFrameworkConfig.
     */
    constructor();
    /**
     * Creates a bot framework configuration instance with the provided subscription information.
     * @member BotFrameworkConfig.fromSubscription
     * @function
     * @public
     * @param subscription Subscription key associated with the bot
     * @param region The region name (see the <a href="https://aka.ms/csspeech/region">region page</a>).
     * @param botId Optional. Identifier for using a specific bot within an Azure resource group. Equivalent to the
     * resource name.
     * @returns {BotFrameworkConfig} A new bot framework configuration instance.
     */
    static fromSubscription(subscription: string, region: string, botId?: string): BotFrameworkConfig;
    /**
     * Creates a bot framework configuration instance for the specified authorization token and region.
     * Note: The caller must ensure that an authorization token is valid. Before an authorization token expires, the
     * caller must refresh it by setting the authorizationToken property on the corresponding
     * DialogServiceConnector instance created with this config. The contents of configuration objects are copied
     * when connectors are created, so setting authorizationToken on a DialogServiceConnector will not update the
     * original configuration's authorization token. Create a new configuration instance or set the
     * SpeechServiceAuthorization_Token property to update an existing instance if it will be used to create
     * further DialogServiceConnectors.
     * @member BotFrameworkConfig.fromAuthorizationToken
     * @function
     * @public
     * @param authorizationToken The authorization token associated with the bot
     * @param region The region name (see the <a href="https://aka.ms/csspeech/region">region page</a>).
     * @param botId Optional. Identifier for using a specific bot within an Azure resource group. Equivalent to the
     * resource name.
     * @returns {BotFrameworkConfig} A new bot framework configuration instance.
     */
    static fromAuthorizationToken(authorizationToken: string, region: string, botId?: string): BotFrameworkConfig;
    /**
     * Creates an instance of a BotFrameworkConfig.
     * This method is intended only for users who use a non-default service host. The standard resource path will be
     * assumed. For services with a non-standard resource path or no path at all, use fromEndpoint instead.
     * Note: Query parameters are not allowed in the host URI and must be set by other APIs.
     * Note: To use an authorization token with fromHost, use fromHost(URL) and then set the AuthorizationToken
     * property on the created BotFrameworkConfig instance.
     * Note: Added in version 1.15.0.
     * @member BotFrameworkConfig.fromHost
     * @function
     * @public
     * @param {URL | string} host - If a URL is provided, the fully-qualified host with protocol (e.g.
     * wss://your.host.com:1234) will be used. If a string is provided, it will be embedded in
     * wss://{host}.convai.speech.azure.us.
     * @param {string} subscriptionKey - The subscription key. If a subscription key is not specified, an authorization
     * token must be set.
     * @param botId Optional. Identifier for using a specific bot within an Azure resource group. Equivalent to the
     * resource name.
     * @returns {BotFrameworkConfig} A new bot framework configuration instance.
     */
    static fromHost(host: URL | string, subscriptionKey?: string, botId?: string): BotFrameworkConfig;
    /**
     * Creates an instance of a BotFrameworkConfig.
     * This method is intended only for users who use a non-standard service endpoint or parameters.
     * Note: The query parameters specified in the endpoint URL are not changed, even if they are set by any other APIs.
     * Note: To use authorization token with fromEndpoint, pass an empty string to the subscriptionKey in the
     * fromEndpoint method, and then set authorizationToken="token" on the created BotFrameworkConfig instance to
     * use the authorization token.
     * Note: Added in version 1.15.0.
     * @member BotFrameworkConfig.fromEndpoint
     * @function
     * @public
     * @param {URL} endpoint - The service endpoint to connect to.
     * @param {string} subscriptionKey - The subscription key. If a subscription key is not specified, an authorization
     * token must be set.
     * @returns {BotFrameworkConfig} - A new bot framework configuration instance using the provided endpoint.
     */
    static fromEndpoint(endpoint: URL, subscriptionKey?: string): BotFrameworkConfig;
}
