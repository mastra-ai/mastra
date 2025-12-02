/**
 * Language understanding model
 * @class LanguageUnderstandingModel
 */
export declare class LanguageUnderstandingModel {
    /**
     * Creates and initializes a new instance
     * @constructor
     */
    protected constructor();
    /**
     * Creates an language understanding model using the specified endpoint.
     * @member LanguageUnderstandingModel.fromEndpoint
     * @function
     * @public
     * @param {URL} uri - A String that represents the endpoint of the language understanding model.
     * @returns {LanguageUnderstandingModel} The language understanding model being created.
     */
    static fromEndpoint(uri: URL): LanguageUnderstandingModel;
    /**
     * Creates an language understanding model using the application id of Language Understanding service.
     * @member LanguageUnderstandingModel.fromAppId
     * @function
     * @public
     * @param {string} appId - A String that represents the application id of Language Understanding service.
     * @returns {LanguageUnderstandingModel} The language understanding model being created.
     */
    static fromAppId(appId: string): LanguageUnderstandingModel;
    /**
     * Creates a language understanding model using hostname, subscription key and application
     * id of Language Understanding service.
     * @member LanguageUnderstandingModel.fromSubscription
     * @function
     * @public
     * @param {string} subscriptionKey - A String that represents the subscription key of
     * Language Understanding service.
     * @param {string} appId - A String that represents the application id of Language
     * Understanding service.
     * @param {LanguageUnderstandingModel} region - A String that represents the region
     * of the Language Understanding service (see the <a href="https://aka.ms/csspeech/region">region page</a>).
     * @returns {LanguageUnderstandingModel} The language understanding model being created.
     */
    static fromSubscription(subscriptionKey: string, appId: string, region: string): LanguageUnderstandingModel;
}
/**
 * @private
 * @class LanguageUnderstandingModelImpl
 */
export declare class LanguageUnderstandingModelImpl extends LanguageUnderstandingModel {
    appId: string;
    region: string;
    subscriptionKey: string;
}
