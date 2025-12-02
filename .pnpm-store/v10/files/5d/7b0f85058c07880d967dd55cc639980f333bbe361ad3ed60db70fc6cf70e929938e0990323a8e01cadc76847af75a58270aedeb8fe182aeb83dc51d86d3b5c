"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriberConnectionFactory = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../sdk/Exports.js");
const ConnectionFactoryBase_js_1 = require("./ConnectionFactoryBase.js");
const Exports_js_3 = require("./Exports.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
const QueryParameterNames_js_1 = require("./QueryParameterNames.js");
class TranscriberConnectionFactory extends ConnectionFactoryBase_js_1.ConnectionFactoryBase {
    constructor() {
        super(...arguments);
        this.multiaudioRelativeUri = "/speech/recognition/multiaudio";
    }
    create(config, authInfo, connectionId) {
        let endpoint = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint, undefined);
        const region = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region, "centralus");
        const hostSuffix = ConnectionFactoryBase_js_1.ConnectionFactoryBase.getHostSuffix(region);
        const hostDefault = "wss://transcribe." + region + ".cts.speech" + hostSuffix + this.multiaudioRelativeUri;
        const host = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, hostDefault);
        const queryParams = {};
        this.setQueryParams(queryParams, config, endpoint);
        if (!endpoint) {
            endpoint = host;
        }
        const headers = {};
        if (authInfo.token !== undefined && authInfo.token !== "") {
            headers[authInfo.headerName] = authInfo.token;
        }
        headers[HeaderNames_js_1.HeaderNames.ConnectionId] = connectionId;
        config.parameters.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Url, endpoint);
        const enableCompression = config.parameters.getProperty("SPEECH-EnableWebsocketCompression", "false") === "true";
        return Promise.resolve(new Exports_js_1.WebsocketConnection(endpoint, queryParams, headers, new Exports_js_3.WebsocketMessageFormatter(), Exports_js_1.ProxyInfo.fromRecognizerConfig(config), enableCompression, connectionId));
    }
    setQueryParams(queryParams, config, endpointUrl) {
        const endpointId = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_EndpointId, undefined);
        const language = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage, undefined);
        if (endpointId && !(QueryParameterNames_js_1.QueryParameterNames.CustomSpeechDeploymentId in queryParams)) {
            queryParams[QueryParameterNames_js_1.QueryParameterNames.CustomSpeechDeploymentId] = endpointId;
        }
        if (language && !(QueryParameterNames_js_1.QueryParameterNames.Language in queryParams)) {
            queryParams[QueryParameterNames_js_1.QueryParameterNames.Language] = language;
        }
        const wordLevelTimings = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps, "false").toLowerCase() === "true";
        const detailed = config.parameters.getProperty(Exports_js_3.OutputFormatPropertyName, Exports_js_2.OutputFormat[Exports_js_2.OutputFormat.Simple]) !== Exports_js_2.OutputFormat[Exports_js_2.OutputFormat.Simple];
        if (wordLevelTimings || detailed) {
            queryParams[QueryParameterNames_js_1.QueryParameterNames.Format] = Exports_js_2.OutputFormat[Exports_js_2.OutputFormat.Detailed].toLowerCase();
        }
        this.setCommonUrlParams(config, queryParams, endpointUrl);
    }
}
exports.TranscriberConnectionFactory = TranscriberConnectionFactory;

//# sourceMappingURL=TranscriberConnectionFactory.js.map
