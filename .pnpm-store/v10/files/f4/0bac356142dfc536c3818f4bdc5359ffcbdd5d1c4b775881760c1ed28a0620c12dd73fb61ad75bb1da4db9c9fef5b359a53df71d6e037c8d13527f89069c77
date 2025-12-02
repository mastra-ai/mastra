"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationTranscriberConnectionFactory = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../sdk/Exports.js");
const Exports_js_3 = require("../common.speech/Exports.js");
const ConnectionFactoryBase_js_1 = require("./ConnectionFactoryBase.js");
const Exports_js_4 = require("./Exports.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
const QueryParameterNames_js_1 = require("./QueryParameterNames.js");
class ConversationTranscriberConnectionFactory extends ConnectionFactoryBase_js_1.ConnectionFactoryBase {
    constructor() {
        super(...arguments);
        this.universalUri = "/stt/speech/universal/v2";
        this.conversationRelativeUriV1 = "/speech/recognition/conversation/cognitiveservices/v1";
    }
    async create(config, authInfo, connectionId) {
        let endpoint = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint, undefined);
        const region = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region, undefined);
        const hostSuffix = ConnectionFactoryBase_js_1.ConnectionFactoryBase.getHostSuffix(region);
        const host = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, "wss://" + region + ".stt.speech" + hostSuffix);
        const queryParams = {};
        const endpointId = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_EndpointId, undefined);
        const language = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage, undefined);
        if (endpointId) {
            if (!endpoint || endpoint.search(QueryParameterNames_js_1.QueryParameterNames.CustomSpeechDeploymentId) === -1) {
                queryParams[QueryParameterNames_js_1.QueryParameterNames.CustomSpeechDeploymentId] = endpointId;
            }
        }
        else if (language) {
            if (!endpoint || endpoint.search(QueryParameterNames_js_1.QueryParameterNames.Language) === -1) {
                queryParams[QueryParameterNames_js_1.QueryParameterNames.Language] = language;
            }
        }
        if (config.autoDetectSourceLanguages !== undefined) {
            queryParams[QueryParameterNames_js_1.QueryParameterNames.EnableLanguageId] = "true";
        }
        const apiVersion = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecognitionEndpointVersion, undefined);
        if (apiVersion === "1") {
            endpoint = `${host}${this.universalUri}`;
        }
        else {
            this.setV2UrlParams(config, queryParams, endpoint);
            if (!!endpoint) {
                const endpointUrl = new URL(endpoint);
                const pathName = endpointUrl.pathname;
                if (pathName === "" || pathName === "/") {
                    // We need to generate the path, and we need to check for a redirect.
                    endpointUrl.pathname = this.universalUri;
                    endpoint = await ConnectionFactoryBase_js_1.ConnectionFactoryBase.getRedirectUrlFromEndpoint(endpointUrl.toString());
                }
            }
            if (!endpoint) {
                endpoint = `${host}${this.conversationRelativeUriV1}`;
            }
        }
        const headers = {};
        if (authInfo.token !== undefined && authInfo.token !== "") {
            headers[authInfo.headerName] = authInfo.token;
        }
        headers[HeaderNames_js_1.HeaderNames.ConnectionId] = connectionId;
        const enableCompression = config.parameters.getProperty("SPEECH-EnableWebsocketCompression", "false") === "true";
        const webSocketConnection = new Exports_js_1.WebsocketConnection(endpoint, queryParams, headers, new Exports_js_4.WebsocketMessageFormatter(), Exports_js_1.ProxyInfo.fromRecognizerConfig(config), enableCompression, connectionId);
        // Set the value of SpeechServiceConnection_Url to webSocketConnection.uri (and not to `endpoint`), since this value is the final
        // URI that was used to make the connection (including query parameters).
        const uri = webSocketConnection.uri;
        config.parameters.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Url, uri);
        return webSocketConnection;
    }
    setV2UrlParams(config, queryParams, endpoint) {
        const propertyIdToParameterMap = new Map([
            [Exports_js_2.PropertyId.Speech_SegmentationSilenceTimeoutMs, QueryParameterNames_js_1.QueryParameterNames.SegmentationSilenceTimeoutMs],
            [Exports_js_2.PropertyId.SpeechServiceConnection_EnableAudioLogging, QueryParameterNames_js_1.QueryParameterNames.EnableAudioLogging],
            [Exports_js_2.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, QueryParameterNames_js_1.QueryParameterNames.EndSilenceTimeoutMs],
            [Exports_js_2.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, QueryParameterNames_js_1.QueryParameterNames.InitialSilenceTimeoutMs],
            [Exports_js_2.PropertyId.SpeechServiceResponse_PostProcessingOption, QueryParameterNames_js_1.QueryParameterNames.Postprocessing],
            [Exports_js_2.PropertyId.SpeechServiceResponse_ProfanityOption, QueryParameterNames_js_1.QueryParameterNames.Profanity],
            [Exports_js_2.PropertyId.SpeechServiceResponse_StablePartialResultThreshold, QueryParameterNames_js_1.QueryParameterNames.StableIntermediateThreshold],
        ]);
        propertyIdToParameterMap.forEach((parameterName, propertyId) => {
            this.setUrlParameter(propertyId, parameterName, config, queryParams, endpoint);
        });
        const serviceProperties = JSON.parse(config.parameters.getProperty(Exports_js_3.ServicePropertiesPropertyName, "{}"));
        Object.keys(serviceProperties).forEach((value) => {
            queryParams[value] = serviceProperties[value];
        });
    }
}
exports.ConversationTranscriberConnectionFactory = ConversationTranscriberConnectionFactory;

//# sourceMappingURL=ConversationTranscriberConnectionFactory.js.map
