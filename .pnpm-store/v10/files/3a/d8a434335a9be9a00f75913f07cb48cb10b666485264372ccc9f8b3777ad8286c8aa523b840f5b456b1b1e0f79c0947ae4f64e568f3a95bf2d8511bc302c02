"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceProfileConnectionFactory = exports.SpeakerRecognitionConnectionFactory = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../sdk/Exports.js");
const ConnectionFactoryBase_js_1 = require("./ConnectionFactoryBase.js");
const Exports_js_3 = require("./Exports.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
class SpeakerRecognitionConnectionFactoryBase extends ConnectionFactoryBase_js_1.ConnectionFactoryBase {
    create(config, authInfo, endpointPath, connectionId) {
        let endpoint = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint);
        if (!endpoint) {
            const region = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region);
            const hostSuffix = ConnectionFactoryBase_js_1.ConnectionFactoryBase.getHostSuffix(region);
            const host = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, `wss://${region}.spr-frontend.speech${hostSuffix}`);
            const scenario = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SpeakerIdMode, "TextIndependentIdentification");
            endpoint = `${host}/speaker/ws/${this.scenarioToPath(scenario)}/${endpointPath}`;
        }
        const queryParams = {
            format: "simple",
            language: config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage),
        };
        this.setCommonUrlParams(config, queryParams, endpoint);
        const headers = {};
        if (authInfo.token !== undefined && authInfo.token !== "") {
            headers[authInfo.headerName] = authInfo.token;
        }
        headers[HeaderNames_js_1.HeaderNames.ConnectionId] = connectionId;
        headers[HeaderNames_js_1.HeaderNames.SpIDAuthKey] = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key);
        config.parameters.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Url, endpoint);
        const enableCompression = config.parameters.getProperty("SPEECH-EnableWebsocketCompression", "false") === "true";
        return Promise.resolve(new Exports_js_1.WebsocketConnection(endpoint, queryParams, headers, new Exports_js_3.WebsocketMessageFormatter(), Exports_js_1.ProxyInfo.fromRecognizerConfig(config), enableCompression, connectionId));
    }
    scenarioToPath(mode) {
        switch (mode) {
            case "TextIndependentVerification":
            case "2":
                return "verification/text-independent";
            case "TextDependentVerification":
            case "1":
                return "verification/text-dependent";
            default:
                return "identification/text-independent";
        }
    }
}
class SpeakerRecognitionConnectionFactory extends SpeakerRecognitionConnectionFactoryBase {
    create(config, authInfo, connectionId) {
        return super.create(config, authInfo, "recognition", connectionId);
    }
}
exports.SpeakerRecognitionConnectionFactory = SpeakerRecognitionConnectionFactory;
class VoiceProfileConnectionFactory extends SpeakerRecognitionConnectionFactoryBase {
    create(config, authInfo, connectionId) {
        return super.create(config, authInfo, "profile", connectionId);
    }
}
exports.VoiceProfileConnectionFactory = VoiceProfileConnectionFactory;

//# sourceMappingURL=SpeakerRecognitionConnectionFactory.js.map
