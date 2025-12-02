"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentConnectionFactory = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../sdk/Exports.js");
const ConnectionFactoryBase_js_1 = require("./ConnectionFactoryBase.js");
const Exports_js_3 = require("./Exports.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
class IntentConnectionFactory extends ConnectionFactoryBase_js_1.ConnectionFactoryBase {
    create(config, authInfo, connectionId) {
        let endpoint = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint);
        if (!endpoint) {
            const region = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_IntentRegion);
            const hostSuffix = ConnectionFactoryBase_js_1.ConnectionFactoryBase.getHostSuffix(region);
            const host = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, "wss://" + region + ".sr.speech" + hostSuffix);
            endpoint = host + "/speech/recognition/interactive/cognitiveservices/v1";
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
        config.parameters.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Url, endpoint);
        const enableCompression = config.parameters.getProperty("SPEECH-EnableWebsocketCompression", "false") === "true";
        return Promise.resolve(new Exports_js_1.WebsocketConnection(endpoint, queryParams, headers, new Exports_js_3.WebsocketMessageFormatter(), Exports_js_1.ProxyInfo.fromRecognizerConfig(config), enableCompression, connectionId));
    }
    getSpeechRegionFromIntentRegion(intentRegion) {
        switch (intentRegion) {
            case "West US":
            case "US West":
            case "westus":
                return "uswest";
            case "West US 2":
            case "US West 2":
            case "westus2":
                return "uswest2";
            case "South Central US":
            case "US South Central":
            case "southcentralus":
                return "ussouthcentral";
            case "West Central US":
            case "US West Central":
            case "westcentralus":
                return "uswestcentral";
            case "East US":
            case "US East":
            case "eastus":
                return "useast";
            case "East US 2":
            case "US East 2":
            case "eastus2":
                return "useast2";
            case "West Europe":
            case "Europe West":
            case "westeurope":
                return "europewest";
            case "North Europe":
            case "Europe North":
            case "northeurope":
                return "europenorth";
            case "Brazil South":
            case "South Brazil":
            case "southbrazil":
                return "brazilsouth";
            case "Australia East":
            case "East Australia":
            case "eastaustralia":
                return "australiaeast";
            case "Southeast Asia":
            case "Asia Southeast":
            case "southeastasia":
                return "asiasoutheast";
            case "East Asia":
            case "Asia East":
            case "eastasia":
                return "asiaeast";
            default:
                return intentRegion;
        }
    }
}
exports.IntentConnectionFactory = IntentConnectionFactory;

//# sourceMappingURL=IntentConnectionFactory.js.map
