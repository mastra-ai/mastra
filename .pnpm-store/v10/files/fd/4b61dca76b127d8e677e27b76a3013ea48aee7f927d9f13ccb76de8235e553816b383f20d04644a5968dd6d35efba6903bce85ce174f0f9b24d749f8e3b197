"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationConnectionFactory = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const StringUtils_js_1 = require("../common/StringUtils.js");
const Exports_js_2 = require("../sdk/Exports.js");
const ConnectionFactoryBase_js_1 = require("./ConnectionFactoryBase.js");
const Exports_js_3 = require("./Exports.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
const QueryParameterNames_js_1 = require("./QueryParameterNames.js");
const PhraseDetectionContext_js_1 = require("./ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
class TranslationConnectionFactory extends ConnectionFactoryBase_js_1.ConnectionFactoryBase {
    constructor() {
        super(...arguments);
        this.universalUri = "/stt/speech/universal/v2";
        this.translationV1Uri = "/speech/translation/cognitiveservices/v1";
    }
    async create(config, authInfo, connectionId) {
        let endpoint = this.getEndpointUrl(config);
        const queryParams = {};
        // Determine if we're using V1 or V2 endpoint
        this.setQueryParams(queryParams, config, endpoint);
        if (!!endpoint) {
            const endpointUrl = new URL(endpoint);
            const pathName = endpointUrl.pathname;
            if (pathName === "" || pathName === "/") {
                // We need to generate the path, and we need to check for a redirect.
                endpointUrl.pathname = this.universalUri;
                endpoint = await ConnectionFactoryBase_js_1.ConnectionFactoryBase.getRedirectUrlFromEndpoint(endpointUrl.toString());
            }
        }
        const headers = {};
        if (authInfo.token !== undefined && authInfo.token !== "") {
            headers[authInfo.headerName] = authInfo.token;
        }
        headers[HeaderNames_js_1.HeaderNames.ConnectionId] = connectionId;
        config.parameters.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Url, endpoint);
        const enableCompression = config.parameters.getProperty("SPEECH-EnableWebsocketCompression", "false") === "true";
        const webSocketConnection = new Exports_js_1.WebsocketConnection(endpoint, queryParams, headers, new Exports_js_3.WebsocketMessageFormatter(), Exports_js_1.ProxyInfo.fromRecognizerConfig(config), enableCompression, connectionId);
        return webSocketConnection;
    }
    getEndpointUrl(config, returnRegionPlaceholder) {
        const region = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region);
        const hostSuffix = ConnectionFactoryBase_js_1.ConnectionFactoryBase.getHostSuffix(region);
        // First check for an explicitly specified endpoint
        let endpointUrl = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint, undefined);
        // If an explicit endpoint is provided, use it
        if (endpointUrl) {
            if (returnRegionPlaceholder === true) {
                return endpointUrl;
            }
            return StringUtils_js_1.StringUtils.formatString(endpointUrl, { region });
        }
        // Check if V1 endpoint is explicitly requested
        const forceV1Endpoint = config.parameters.getProperty("SPEECH-ForceV1Endpoint", "false") === "true";
        if (forceV1Endpoint) {
            // Use V1 endpoint with s2s.speech host
            const host = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, "wss://{region}.s2s.speech" + hostSuffix);
            endpointUrl = host + this.translationV1Uri;
        }
        else {
            // Default to V2 endpoint with stt.speech host
            const host = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, "wss://{region}.stt.speech" + hostSuffix);
            endpointUrl = host + this.universalUri;
        }
        if (returnRegionPlaceholder === true) {
            return endpointUrl;
        }
        return StringUtils_js_1.StringUtils.formatString(endpointUrl, { region });
    }
    setQueryParams(queryParams, config, endpointUrl) {
        // Common parameters for both V1 and V2 endpoints
        queryParams.from = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage);
        queryParams.to = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_TranslationToLanguages);
        queryParams.scenario = config.recognitionMode === PhraseDetectionContext_js_1.RecognitionMode.Interactive ? "interactive" :
            config.recognitionMode === PhraseDetectionContext_js_1.RecognitionMode.Conversation ? "conversation" : "";
        // Set common parameters
        this.setCommonUrlParams(config, queryParams, endpointUrl);
        this.setUrlParameter(Exports_js_2.PropertyId.SpeechServiceResponse_TranslationRequestStablePartialResult, QueryParameterNames_js_1.QueryParameterNames.StableTranslation, config, queryParams, endpointUrl);
        // Handle translation voice if specified
        const translationVoice = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_TranslationVoice, undefined);
        if (translationVoice !== undefined) {
            queryParams.voice = translationVoice;
            // Updated to match C++ implementation
            queryParams.features = "requireVoice";
        }
    }
}
exports.TranslationConnectionFactory = TranslationConnectionFactory;

//# sourceMappingURL=TranslationConnectionFactory.js.map
