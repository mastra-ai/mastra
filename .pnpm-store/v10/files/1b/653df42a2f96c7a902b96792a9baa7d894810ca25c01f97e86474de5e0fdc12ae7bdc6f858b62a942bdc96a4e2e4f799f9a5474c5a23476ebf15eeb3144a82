"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationTranslatorConnectionFactory = void 0;
const Exports_js_1 = require("../../common.browser/Exports.js");
const StringUtils_js_1 = require("../../common/StringUtils.js");
const Contracts_js_1 = require("../../sdk/Contracts.js");
const Exports_js_2 = require("../../sdk/Exports.js");
const HeaderNames_js_1 = require("../HeaderNames.js");
const QueryParameterNames_js_1 = require("../QueryParameterNames.js");
const ConnectionFactoryBase_js_1 = require("./../ConnectionFactoryBase.js");
const Exports_js_3 = require("./../Exports.js");
/**
 * Connection factory for the conversation translator. Handles connecting to the regular translator endpoint,
 * as well as the virtual microphone array transcription endpoint
 */
class ConversationTranslatorConnectionFactory extends ConnectionFactoryBase_js_1.ConnectionFactoryBase {
    constructor(convGetter) {
        super();
        Contracts_js_1.Contracts.throwIfNullOrUndefined(convGetter, "convGetter");
        this.privConvGetter = convGetter;
    }
    create(config, authInfo, connectionId) {
        const isVirtMicArrayEndpoint = config.parameters.getProperty("ConversationTranslator_MultiChannelAudio", "").toUpperCase() === "TRUE";
        const convInfo = this.privConvGetter().room;
        const region = convInfo.cognitiveSpeechRegion || config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region, "");
        const replacementValues = {
            hostSuffix: ConnectionFactoryBase_js_1.ConnectionFactoryBase.getHostSuffix(region),
            path: ConversationTranslatorConnectionFactory.CTS_VIRT_MIC_PATH,
            region: encodeURIComponent(region)
        };
        replacementValues[QueryParameterNames_js_1.QueryParameterNames.Language] = encodeURIComponent(config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage, ""));
        replacementValues[QueryParameterNames_js_1.QueryParameterNames.CtsMeetingId] = encodeURIComponent(convInfo.roomId);
        replacementValues[QueryParameterNames_js_1.QueryParameterNames.CtsDeviceId] = encodeURIComponent(convInfo.participantId);
        replacementValues[QueryParameterNames_js_1.QueryParameterNames.CtsIsParticipant] = convInfo.isHost ? "" : ("&" + QueryParameterNames_js_1.QueryParameterNames.CtsIsParticipant);
        let endpointUrl = "";
        const queryParams = {};
        const headers = {};
        if (isVirtMicArrayEndpoint) {
            // connecting to the conversation transcription virtual microphone array endpoint
            endpointUrl = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint);
            if (!endpointUrl) {
                const hostName = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, "transcribe.{region}.cts.speech{hostSuffix}");
                endpointUrl = "wss://" + hostName + "{path}";
            }
            // because the region can change during a session, we support being passed a format string which we can then
            // replace with the correct information.
            endpointUrl = StringUtils_js_1.StringUtils.formatString(endpointUrl, replacementValues);
            const parsedUrl = new URL(endpointUrl);
            parsedUrl.searchParams.forEach((val, key) => {
                queryParams[key] = val;
            });
            const connFactory = new Exports_js_3.TranscriberConnectionFactory();
            connFactory.setQueryParams(queryParams, config, endpointUrl);
            // Some query parameters are required for the CTS endpoint, let's explicity set them here
            queryParams[QueryParameterNames_js_1.QueryParameterNames.CtsMeetingId] = replacementValues[QueryParameterNames_js_1.QueryParameterNames.CtsMeetingId];
            queryParams[QueryParameterNames_js_1.QueryParameterNames.CtsDeviceId] = replacementValues[QueryParameterNames_js_1.QueryParameterNames.CtsDeviceId];
            if (!convInfo.isHost) {
                queryParams[QueryParameterNames_js_1.QueryParameterNames.CtsIsParticipant] = ""; // this doesn't have a value so set to an empty string
            }
            if (!(QueryParameterNames_js_1.QueryParameterNames.Format in queryParams)) {
                queryParams[QueryParameterNames_js_1.QueryParameterNames.Format] = "simple";
            }
            parsedUrl.searchParams.forEach((val, key) => {
                parsedUrl.searchParams.set(key, queryParams[key]);
                delete queryParams[key];
            });
            endpointUrl = parsedUrl.toString();
        }
        else {
            // connecting to regular translation endpoint
            const connFactory = new Exports_js_3.TranslationConnectionFactory();
            endpointUrl = connFactory.getEndpointUrl(config, true);
            endpointUrl = StringUtils_js_1.StringUtils.formatString(endpointUrl, replacementValues);
            connFactory.setQueryParams(queryParams, config, endpointUrl);
        }
        headers[HeaderNames_js_1.HeaderNames.ConnectionId] = connectionId;
        headers[Exports_js_1.RestConfigBase.configParams.token] = convInfo.token;
        if (!!authInfo.token) {
            headers[authInfo.headerName] = authInfo.token;
        }
        const enableCompression = config.parameters.getProperty("SPEECH-EnableWebsocketCompression", "").toUpperCase() === "TRUE";
        return Promise.resolve(new Exports_js_1.WebsocketConnection(endpointUrl, queryParams, headers, new Exports_js_3.WebsocketMessageFormatter(), Exports_js_1.ProxyInfo.fromRecognizerConfig(config), enableCompression, connectionId));
    }
}
exports.ConversationTranslatorConnectionFactory = ConversationTranslatorConnectionFactory;
ConversationTranslatorConnectionFactory.CTS_VIRT_MIC_PATH = "/speech/recognition/dynamicaudio";

//# sourceMappingURL=ConversationTranslatorConnectionFactory.js.map
