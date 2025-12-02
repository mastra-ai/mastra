"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechSynthesisConnectionFactory = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../sdk/Exports.js");
const ConnectionFactoryBase_js_1 = require("./ConnectionFactoryBase.js");
const Exports_js_3 = require("./Exports.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
const QueryParameterNames_js_1 = require("./QueryParameterNames.js");
class SpeechSynthesisConnectionFactory {
    constructor() {
        this.synthesisUri = "/tts/cognitiveservices/websocket/v1";
    }
    async create(config, authInfo, connectionId) {
        let endpoint = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint, undefined);
        const region = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region, undefined);
        const hostSuffix = ConnectionFactoryBase_js_1.ConnectionFactoryBase.getHostSuffix(region);
        const endpointId = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_EndpointId, undefined);
        const hostPrefix = (endpointId === undefined) ? "tts" : "voice";
        const host = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, "wss://" + region + "." + hostPrefix + ".speech" + hostSuffix);
        const queryParams = {};
        const headers = {};
        if (authInfo.token !== undefined && authInfo.token !== "") {
            headers[authInfo.headerName] = authInfo.token;
        }
        headers[HeaderNames_js_1.HeaderNames.ConnectionId] = connectionId;
        if (endpointId !== undefined && endpointId !== "") {
            if (!endpoint || endpoint.search(QueryParameterNames_js_1.QueryParameterNames.CustomVoiceDeploymentId) === -1) {
                queryParams[QueryParameterNames_js_1.QueryParameterNames.CustomVoiceDeploymentId] = endpointId;
            }
        }
        if (config.avatarEnabled) {
            if (!endpoint || endpoint.search(QueryParameterNames_js_1.QueryParameterNames.EnableAvatar) === -1) {
                queryParams[QueryParameterNames_js_1.QueryParameterNames.EnableAvatar] = "true";
            }
        }
        if (!!endpoint) {
            const endpointUrl = new URL(endpoint);
            const pathName = endpointUrl.pathname;
            if (pathName === "" || pathName === "/") {
                // We need to generate the path, and we need to check for a redirect.
                endpointUrl.pathname = this.synthesisUri;
                endpoint = await ConnectionFactoryBase_js_1.ConnectionFactoryBase.getRedirectUrlFromEndpoint(endpointUrl.toString());
            }
        }
        if (!endpoint) {
            endpoint = host + this.synthesisUri;
        }
        config.parameters.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Url, endpoint);
        const enableCompression = config.parameters.getProperty("SPEECH-EnableWebsocketCompression", "false") === "true";
        return new Exports_js_1.WebsocketConnection(endpoint, queryParams, headers, new Exports_js_3.WebsocketMessageFormatter(), Exports_js_1.ProxyInfo.fromParameters(config.parameters), enableCompression, connectionId);
    }
}
exports.SpeechSynthesisConnectionFactory = SpeechSynthesisConnectionFactory;

//# sourceMappingURL=SpeechSynthesisConnectionFactory.js.map
