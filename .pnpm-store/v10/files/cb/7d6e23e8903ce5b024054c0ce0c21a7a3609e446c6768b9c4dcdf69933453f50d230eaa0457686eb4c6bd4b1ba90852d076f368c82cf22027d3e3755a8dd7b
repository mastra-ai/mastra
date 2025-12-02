"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageUnderstandingModelImpl = exports.LanguageUnderstandingModel = void 0;
// eslint-disable-next-line max-classes-per-file
const Contracts_js_1 = require("./Contracts.js");
/**
 * Language understanding model
 * @class LanguageUnderstandingModel
 */
class LanguageUnderstandingModel {
    /**
     * Creates and initializes a new instance
     * @constructor
     */
    constructor() {
        return;
    }
    /**
     * Creates an language understanding model using the specified endpoint.
     * @member LanguageUnderstandingModel.fromEndpoint
     * @function
     * @public
     * @param {URL} uri - A String that represents the endpoint of the language understanding model.
     * @returns {LanguageUnderstandingModel} The language understanding model being created.
     */
    static fromEndpoint(uri) {
        Contracts_js_1.Contracts.throwIfNull(uri, "uri");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(uri.hostname, "uri");
        const langModelImp = new LanguageUnderstandingModelImpl();
        // Need to extract the app ID from the URL.
        // URL is in the format: https://<region>.api.cognitive.microsoft.com/luis/v2.0/apps/<Guid>?subscription-key=<key>&timezoneOffset=-360
        // Start tearing the string apart.
        // region can be extracted from the host name.
        const firstDot = uri.host.indexOf(".");
        if (-1 === firstDot) {
            throw new Error("Could not determine region from endpoint");
        }
        langModelImp.region = uri.host.substr(0, firstDot);
        // Now the app ID.
        const lastSegment = uri.pathname.lastIndexOf("/") + 1;
        if (-1 === lastSegment) {
            throw new Error("Could not determine appId from endpoint");
        }
        langModelImp.appId = uri.pathname.substr(lastSegment);
        // And finally the key.
        langModelImp.subscriptionKey = uri.searchParams.get("subscription-key");
        if (undefined === langModelImp.subscriptionKey) {
            throw new Error("Could not determine subscription key from endpoint");
        }
        return langModelImp;
    }
    /**
     * Creates an language understanding model using the application id of Language Understanding service.
     * @member LanguageUnderstandingModel.fromAppId
     * @function
     * @public
     * @param {string} appId - A String that represents the application id of Language Understanding service.
     * @returns {LanguageUnderstandingModel} The language understanding model being created.
     */
    static fromAppId(appId) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(appId, "appId");
        const langModelImp = new LanguageUnderstandingModelImpl();
        langModelImp.appId = appId;
        return langModelImp;
    }
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
    static fromSubscription(subscriptionKey, appId, region) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(subscriptionKey, "subscriptionKey");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(appId, "appId");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(region, "region");
        const langModelImp = new LanguageUnderstandingModelImpl();
        langModelImp.appId = appId;
        langModelImp.region = region;
        langModelImp.subscriptionKey = subscriptionKey;
        return langModelImp;
    }
}
exports.LanguageUnderstandingModel = LanguageUnderstandingModel;
/**
 * @private
 * @class LanguageUnderstandingModelImpl
 */
class LanguageUnderstandingModelImpl extends LanguageUnderstandingModel {
}
exports.LanguageUnderstandingModelImpl = LanguageUnderstandingModelImpl;

//# sourceMappingURL=LanguageUnderstandingModel.js.map
