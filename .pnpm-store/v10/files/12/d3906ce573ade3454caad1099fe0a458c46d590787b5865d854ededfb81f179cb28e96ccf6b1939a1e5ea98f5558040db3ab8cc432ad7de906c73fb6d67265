import { PropertyCollection, PropertyId, ServicePropertyChannel } from "./Exports.js";
import { OutputFormat } from "./OutputFormat.js";
/**
 * Class that defines base configurations for dialog service connector
 * @class DialogServiceConfig
 */
export declare abstract class DialogServiceConfig {
    /**
     * Creates an instance of DialogService config.
     * @constructor
     */
    protected constructor();
    /**
     * Sets an arbitrary property.
     * @member DialogServiceConfig.prototype.setProperty
     * @function
     * @public
     * @param {string} name - The name of the property to set.
     * @param {string} value - The new value of the property.
     */
    abstract setProperty(name: string | PropertyId, value: string): void;
    /**
     * Returns the current value of an arbitrary property.
     * @member DialogServiceConfig.prototype.getProperty
     * @function
     * @public
     * @param {string} name - The name of the property to query.
     * @param {string} def - The value to return in case the property is not known.
     * @returns {string} The current value, or provided default, of the given property.
     */
    abstract getProperty(name: string | PropertyId, def?: string): string;
    /**
     * @member DialogServiceConfig.prototype.setServiceProperty
     * @function
     * @public
     * @param {name} The name of the property.
     * @param {value} Value to set.
     * @param {channel} The channel used to pass the specified property to service.
     * @summary Sets a property value that will be passed to service using the specified channel.
     */
    abstract setServiceProperty(name: string, value: string, channel: ServicePropertyChannel): void;
    /**
     * Sets the proxy configuration.
     * Only relevant in Node.js environments.
     * Added in version 1.4.0.
     * @param proxyHostName The host name of the proxy server.
     * @param proxyPort The port number of the proxy server.
     */
    abstract setProxy(proxyHostName: string, proxyPort: number): void;
    /**
     * Sets the proxy configuration.
     * Only relevant in Node.js environments.
     * Added in version 1.4.0.
     * @param proxyHostName The host name of the proxy server, without the protocol scheme (http://)
     * @param porxyPort The port number of the proxy server.
     * @param proxyUserName The user name of the proxy server.
     * @param proxyPassword The password of the proxy server.
     */
    abstract setProxy(proxyHostName: string, proxyPort: number, proxyUserName: string, proxyPassword: string): void;
    /**
     * Returns the configured language.
     * @member DialogServiceConfig.prototype.speechRecognitionLanguage
     * @function
     * @public
     */
    abstract get speechRecognitionLanguage(): string;
    /**
     * Gets/Sets the input language.
     * @member DialogServiceConfig.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @param {string} value - The language to use for recognition.
     */
    abstract set speechRecognitionLanguage(value: string);
    /**
     * Sets the corresponding backend application identifier.
     * @member DialogServiceConfig.prototype.Conversation_ApplicationId
     * @function
     * @public
     * @param {string} value - The application identifier to set.
     */
    set applicationId(value: string);
    static get DialogTypes(): {
        BotFramework: string;
        CustomCommands: string;
    };
}
/**
 * Dialog Service configuration.
 * @class DialogServiceConfigImpl
 */
export declare class DialogServiceConfigImpl extends DialogServiceConfig {
    private privSpeechConfig;
    /**
     * Creates an instance of dialogService config.
     */
    constructor();
    /**
     * Provides access to custom properties.
     * @member DialogServiceConfigImpl.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The properties.
     */
    get properties(): PropertyCollection;
    /**
     * Gets the speech recognition language.
     * @member DialogServiceConfigImpl.prototype.speechRecognitionLanguage
     * @function
     * @public
     */
    get speechRecognitionLanguage(): string;
    /**
     * Sets the speech recognition language.
     * @member DialogServiceConfigImpl.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @param {string} value - The language to set.
     */
    set speechRecognitionLanguage(value: string);
    get outputFormat(): OutputFormat;
    set outputFormat(value: OutputFormat);
    /**
     * Sets a named property as value
     * @member DialogServiceConfigImpl.prototype.setProperty
     * @function
     * @public
     * @param {PropertyId | string} name - The property to set.
     * @param {string} value - The value.
     */
    setProperty(name: string | PropertyId, value: string): void;
    /**
     * Sets a named property as value
     * @member DialogServiceConfigImpl.prototype.getProperty
     * @function
     * @public
     * @param {PropertyId | string} name - The property to get.
     * @param {string} def - The default value to return in case the property is not known.
     * @returns {string} The current value, or provided default, of the given property.
     */
    getProperty(name: string | PropertyId, def?: string): string;
    /**
     * Sets the proxy configuration.
     * Only relevant in Node.js environments.
     * Added in version 1.4.0.
     * @param proxyHostName The host name of the proxy server, without the protocol scheme (http://)
     * @param proxyPort The port number of the proxy server.
     * @param proxyUserName The user name of the proxy server.
     * @param proxyPassword The password of the proxy server.
     */
    setProxy(proxyHostName: string, proxyPort: number, proxyUserName?: string, proxyPassword?: string): void;
    setServiceProperty(name: string, value: string, channel: ServicePropertyChannel): void;
    /**
     * Dispose of associated resources.
     * @member DialogServiceConfigImpl.prototype.close
     * @function
     * @public
     */
    close(): void;
}
