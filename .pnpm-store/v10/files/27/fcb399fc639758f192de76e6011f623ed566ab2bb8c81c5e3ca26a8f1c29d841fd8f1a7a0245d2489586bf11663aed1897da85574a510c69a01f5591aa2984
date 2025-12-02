"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionFactoryBase = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
const Exports_js_3 = require("../sdk/Exports.js");
const QueryParameterNames_js_1 = require("./QueryParameterNames.js");
class ConnectionFactoryBase {
    static getHostSuffix(region) {
        if (!!region) {
            if (region.toLowerCase().startsWith("china")) {
                return ".azure.cn";
            }
            if (region.toLowerCase().startsWith("usgov")) {
                return ".azure.us";
            }
        }
        return ".microsoft.com";
    }
    setCommonUrlParams(config, queryParams, endpoint) {
        const propertyIdToParameterMap = new Map([
            [Exports_js_3.PropertyId.Speech_SegmentationSilenceTimeoutMs, QueryParameterNames_js_1.QueryParameterNames.SegmentationSilenceTimeoutMs],
            [Exports_js_3.PropertyId.SpeechServiceConnection_EnableAudioLogging, QueryParameterNames_js_1.QueryParameterNames.EnableAudioLogging],
            [Exports_js_3.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, QueryParameterNames_js_1.QueryParameterNames.EndSilenceTimeoutMs],
            [Exports_js_3.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, QueryParameterNames_js_1.QueryParameterNames.InitialSilenceTimeoutMs],
            [Exports_js_3.PropertyId.SpeechServiceResponse_PostProcessingOption, QueryParameterNames_js_1.QueryParameterNames.Postprocessing],
            [Exports_js_3.PropertyId.SpeechServiceResponse_ProfanityOption, QueryParameterNames_js_1.QueryParameterNames.Profanity],
            [Exports_js_3.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps, QueryParameterNames_js_1.QueryParameterNames.EnableWordLevelTimestamps],
            [Exports_js_3.PropertyId.SpeechServiceResponse_StablePartialResultThreshold, QueryParameterNames_js_1.QueryParameterNames.StableIntermediateThreshold],
        ]);
        propertyIdToParameterMap.forEach((parameterName, propertyId) => {
            this.setUrlParameter(propertyId, parameterName, config, queryParams, endpoint);
        });
        const serviceProperties = JSON.parse(config.parameters.getProperty(Exports_js_1.ServicePropertiesPropertyName, "{}"));
        Object.keys(serviceProperties).forEach((value) => {
            queryParams[value] = serviceProperties[value];
        });
    }
    setUrlParameter(propId, parameterName, config, queryParams, endpoint) {
        const value = config.parameters.getProperty(propId, undefined);
        // FIXME: The .search() check will incorrectly match parameter name anywhere in the string
        //        including e.g. the path portion, or even as a substring of other query parameters
        if (value && (!endpoint || endpoint.search(parameterName) === -1)) {
            queryParams[parameterName] = value.toLocaleLowerCase();
        }
    }
    static async getRedirectUrlFromEndpoint(endpoint) {
        // make a rest call to the endpoint to get the redirect url
        const redirectUrl = new URL(endpoint);
        redirectUrl.protocol = "https:";
        redirectUrl.port = "443";
        const params = redirectUrl.searchParams;
        params.append("GenerateRedirectResponse", "true");
        const redirectedUrlString = redirectUrl.toString();
        Exports_js_2.Events.instance.onEvent(new Exports_js_2.ConnectionRedirectEvent("", redirectedUrlString, undefined, "ConnectionFactoryBase: redirectUrl request"));
        const redirectResponse = await fetch(redirectedUrlString);
        if (redirectResponse.status !== 200) {
            return endpoint;
        }
        // Fix: properly read the response text
        const redirectUrlString = await redirectResponse.text();
        Exports_js_2.Events.instance.onEvent(new Exports_js_2.ConnectionRedirectEvent("", redirectUrlString, endpoint, "ConnectionFactoryBase: redirectUrlString"));
        try {
            // Validate the URL before returning
            return new URL(redirectUrlString.trim()).toString();
        }
        catch (error) {
            return endpoint; // Return original endpoint if the redirect URL is invalid
        }
    }
}
exports.ConnectionFactoryBase = ConnectionFactoryBase;

//# sourceMappingURL=ConnectionFactoryBase.js.map
