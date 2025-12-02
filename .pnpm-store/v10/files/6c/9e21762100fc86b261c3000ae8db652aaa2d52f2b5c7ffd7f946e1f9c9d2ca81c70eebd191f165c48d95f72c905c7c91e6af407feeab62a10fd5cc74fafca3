"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechConnectionFactory = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../common.speech/Exports.js");
const Exports_js_3 = require("../sdk/Exports.js");
const ConnectionFactoryBase_js_1 = require("./ConnectionFactoryBase.js");
const Exports_js_4 = require("./Exports.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
const QueryParameterNames_js_1 = require("./QueryParameterNames.js");
const PhraseDetectionContext_js_1 = require("./ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
class SpeechConnectionFactory extends ConnectionFactoryBase_js_1.ConnectionFactoryBase {
    constructor() {
        super(...arguments);
        this.interactiveRelativeUri = "/speech/recognition/interactive/cognitiveservices/v1";
        this.conversationRelativeUri = "/speech/recognition/conversation/cognitiveservices/v1";
        this.dictationRelativeUri = "/speech/recognition/dictation/cognitiveservices/v1";
        this.universalUri = "/stt/speech/universal/v";
    }
    async create(config, authInfo, connectionId) {
        let endpoint = config.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_Endpoint, undefined);
        const region = config.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_Region, undefined);
        const hostSuffix = ConnectionFactoryBase_js_1.ConnectionFactoryBase.getHostSuffix(region);
        const host = config.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_Host, "wss://" + region + ".stt.speech" + hostSuffix);
        const queryParams = {};
        const endpointId = config.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_EndpointId, undefined);
        const language = config.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage, undefined);
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
        if (!endpoint || endpoint.search(QueryParameterNames_js_1.QueryParameterNames.Format) === -1) {
            queryParams[QueryParameterNames_js_1.QueryParameterNames.Format] = config.parameters.getProperty(Exports_js_2.OutputFormatPropertyName, Exports_js_3.OutputFormat[Exports_js_3.OutputFormat.Simple]).toLowerCase();
        }
        if (config.autoDetectSourceLanguages !== undefined) {
            queryParams[QueryParameterNames_js_1.QueryParameterNames.EnableLanguageId] = "true";
        }
        this.setCommonUrlParams(config, queryParams, endpoint);
        if (!!endpoint) {
            const endpointUrl = new URL(endpoint);
            const pathName = endpointUrl.pathname;
            if (pathName === "" || pathName === "/") {
                // We need to generate the path, and we need to check for a redirect.
                endpointUrl.pathname = this.universalUri + config.recognitionEndpointVersion;
                endpoint = await ConnectionFactoryBase_js_1.ConnectionFactoryBase.getRedirectUrlFromEndpoint(endpointUrl.toString());
            }
        }
        if (!endpoint) {
            switch (config.recognitionMode) {
                case PhraseDetectionContext_js_1.RecognitionMode.Conversation:
                    if (config.parameters.getProperty(Exports_js_2.ForceDictationPropertyName, "false") === "true") {
                        endpoint = host + this.dictationRelativeUri;
                    }
                    else {
                        if (config.recognitionEndpointVersion !== undefined && parseInt(config.recognitionEndpointVersion, 10) > 1) {
                            endpoint = `${host}${this.universalUri}${config.recognitionEndpointVersion}`;
                        }
                        else {
                            endpoint = host + this.conversationRelativeUri;
                        }
                    }
                    break;
                case PhraseDetectionContext_js_1.RecognitionMode.Dictation:
                    endpoint = host + this.dictationRelativeUri;
                    break;
                default:
                    if (config.recognitionEndpointVersion !== undefined && parseInt(config.recognitionEndpointVersion, 10) > 1) {
                        endpoint = `${host}${this.universalUri}${config.recognitionEndpointVersion}`;
                    }
                    else {
                        endpoint = host + this.interactiveRelativeUri; // default is interactive
                    }
                    break;
            }
        }
        const headers = {};
        if (authInfo.token !== undefined && authInfo.token !== "") {
            headers[authInfo.headerName] = authInfo.token;
        }
        headers[HeaderNames_js_1.HeaderNames.ConnectionId] = connectionId;
        headers.connectionId = connectionId;
        const enableCompression = config.parameters.getProperty("SPEECH-EnableWebsocketCompression", "false") === "true";
        const webSocketConnection = new Exports_js_1.WebsocketConnection(endpoint, queryParams, headers, new Exports_js_4.WebsocketMessageFormatter(), Exports_js_1.ProxyInfo.fromRecognizerConfig(config), enableCompression, connectionId);
        // Set the value of SpeechServiceConnection_Url to webSocketConnection.uri (and not to `endpoint`), since this value is the final
        // URI that was used to make the connection (including query parameters).
        const uri = webSocketConnection.uri;
        config.parameters.setProperty(Exports_js_3.PropertyId.SpeechServiceConnection_Url, uri);
        return webSocketConnection;
    }
}
exports.SpeechConnectionFactory = SpeechConnectionFactory;

//# sourceMappingURL=SpeechConnectionFactory.js.map
