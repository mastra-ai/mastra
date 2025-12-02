"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationConnectionFactory = void 0;
const Exports_js_1 = require("../../common.browser/Exports.js");
const Exports_js_2 = require("../../common/Exports.js");
const Contracts_js_1 = require("../../sdk/Contracts.js");
const Exports_js_3 = require("../../sdk/Exports.js");
const ConnectionFactoryBase_js_1 = require("../ConnectionFactoryBase.js");
const ConversationConnectionConfig_js_1 = require("./ConversationConnectionConfig.js");
const ConversationWebsocketMessageFormatter_js_1 = require("./ConversationWebsocketMessageFormatter.js");
/**
 * Create a connection to the Conversation Translator websocket for sending instant messages and commands, and for receiving translated messages.
 * The conversation must already have been started or joined.
 */
class ConversationConnectionFactory extends ConnectionFactoryBase_js_1.ConnectionFactoryBase {
    create(config, authInfo, connectionId) {
        const endpointHost = config.parameters.getProperty(Exports_js_3.PropertyId.ConversationTranslator_Host, ConversationConnectionConfig_js_1.ConversationConnectionConfig.host);
        const correlationId = config.parameters.getProperty(Exports_js_3.PropertyId.ConversationTranslator_CorrelationId, (0, Exports_js_2.createGuid)());
        const endpoint = `wss://${endpointHost}${ConversationConnectionConfig_js_1.ConversationConnectionConfig.webSocketPath}`;
        const token = config.parameters.getProperty(Exports_js_3.PropertyId.ConversationTranslator_Token, undefined);
        Contracts_js_1.Contracts.throwIfNullOrUndefined(token, "token");
        const queryParams = {};
        queryParams[ConversationConnectionConfig_js_1.ConversationConnectionConfig.configParams.apiVersion] = ConversationConnectionConfig_js_1.ConversationConnectionConfig.apiVersion;
        queryParams[ConversationConnectionConfig_js_1.ConversationConnectionConfig.configParams.token] = token;
        queryParams[ConversationConnectionConfig_js_1.ConversationConnectionConfig.configParams.correlationId] = correlationId;
        const enableCompression = config.parameters.getProperty("SPEECH-EnableWebsocketCompression", "false") === "true";
        return Promise.resolve(new Exports_js_1.WebsocketConnection(endpoint, queryParams, {}, new ConversationWebsocketMessageFormatter_js_1.ConversationWebsocketMessageFormatter(), Exports_js_1.ProxyInfo.fromRecognizerConfig(config), enableCompression, connectionId));
    }
}
exports.ConversationConnectionFactory = ConversationConnectionFactory;

//# sourceMappingURL=ConversationConnectionFactory.js.map
