"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialogConnectionFactory = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../common.speech/Exports.js");
const Exports_js_3 = require("../sdk/Exports.js");
const ConnectionFactoryBase_js_1 = require("./ConnectionFactoryBase.js");
const Exports_js_4 = require("./Exports.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
const QueryParameterNames_js_1 = require("./QueryParameterNames.js");
class DialogConnectionFactory extends ConnectionFactoryBase_js_1.ConnectionFactoryBase {
    create(config, authInfo, connectionId) {
        const applicationId = config.parameters.getProperty(Exports_js_3.PropertyId.Conversation_ApplicationId, "");
        const dialogType = config.parameters.getProperty(Exports_js_3.PropertyId.Conversation_DialogType);
        const region = config.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_Region);
        const language = config.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage, "en-US");
        const requestTurnStatus = config.parameters.getProperty(Exports_js_3.PropertyId.Conversation_Request_Bot_Status_Messages, "true");
        const queryParams = {};
        queryParams[HeaderNames_js_1.HeaderNames.ConnectionId] = connectionId;
        queryParams[QueryParameterNames_js_1.QueryParameterNames.Format] = config.parameters.getProperty(Exports_js_2.OutputFormatPropertyName, Exports_js_3.OutputFormat[Exports_js_3.OutputFormat.Simple]).toLowerCase();
        queryParams[QueryParameterNames_js_1.QueryParameterNames.Language] = language;
        queryParams[QueryParameterNames_js_1.QueryParameterNames.RequestBotStatusMessages] = requestTurnStatus;
        if (applicationId) {
            queryParams[QueryParameterNames_js_1.QueryParameterNames.BotId] = applicationId;
            if (dialogType === Exports_js_3.DialogServiceConfig.DialogTypes.CustomCommands) {
                queryParams[HeaderNames_js_1.HeaderNames.CustomCommandsAppId] = applicationId;
            }
        }
        const resourceInfix = dialogType === Exports_js_3.DialogServiceConfig.DialogTypes.CustomCommands ? "commands/"
            : "";
        const version = dialogType === Exports_js_3.DialogServiceConfig.DialogTypes.CustomCommands ? "v1"
            : dialogType === Exports_js_3.DialogServiceConfig.DialogTypes.BotFramework ? "v3"
                : "v0";
        const headers = {};
        if (authInfo.token != null && authInfo.token !== "") {
            headers[authInfo.headerName] = authInfo.token;
        }
        // The URL used for connection is chosen in a priority order of specification:
        //  1. If a custom endpoint is provided, that URL is used verbatim.
        //  2. If a custom host is provided (e.g. "wss://my.custom.endpoint.com:1123"), a URL is constructed from it.
        //  3. If no custom connection details are provided, a URL is constructed from default values.
        let endpoint = config.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_Endpoint, "");
        if (!endpoint) {
            const hostSuffix = ConnectionFactoryBase_js_1.ConnectionFactoryBase.getHostSuffix(region);
            const host = config.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_Host, `wss://${region}.${DialogConnectionFactory.BaseUrl}${hostSuffix}`);
            const standardizedHost = host.endsWith("/") ? host : host + "/";
            endpoint = `${standardizedHost}${resourceInfix}${DialogConnectionFactory.ApiKey}/${version}`;
        }
        this.setCommonUrlParams(config, queryParams, endpoint);
        const enableCompression = config.parameters.getProperty("SPEECH-EnableWebsocketCompression", "false") === "true";
        return Promise.resolve(new Exports_js_1.WebsocketConnection(endpoint, queryParams, headers, new Exports_js_4.WebsocketMessageFormatter(), Exports_js_1.ProxyInfo.fromRecognizerConfig(config), enableCompression, connectionId));
    }
}
exports.DialogConnectionFactory = DialogConnectionFactory;
DialogConnectionFactory.ApiKey = "api";
DialogConnectionFactory.BaseUrl = "convai.speech";

//# sourceMappingURL=DialogConnectorFactory.js.map
