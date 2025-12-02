"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationManager = void 0;
const Exports_js_1 = require("../../common.browser/Exports.js");
const Contracts_js_1 = require("../../sdk/Contracts.js");
const Exports_js_2 = require("../../sdk/Exports.js");
const ConversationConnectionConfig_js_1 = require("./ConversationConnectionConfig.js");
class ConversationManager {
    constructor() {
        //
        this.privRequestParams = ConversationConnectionConfig_js_1.ConversationConnectionConfig.configParams;
        this.privErrors = ConversationConnectionConfig_js_1.ConversationConnectionConfig.restErrors;
        this.privHost = ConversationConnectionConfig_js_1.ConversationConnectionConfig.host;
        this.privApiVersion = ConversationConnectionConfig_js_1.ConversationConnectionConfig.apiVersion;
        this.privRestPath = ConversationConnectionConfig_js_1.ConversationConnectionConfig.restPath;
        this.privRestAdapter = new Exports_js_1.RestMessageAdapter({});
    }
    /**
     * Make a POST request to the Conversation Manager service endpoint to create or join a conversation.
     * @param args
     * @param conversationCode
     * @param callback
     * @param errorCallback
     */
    createOrJoin(args, conversationCode, cb, err) {
        try {
            Contracts_js_1.Contracts.throwIfNullOrUndefined(args, "args");
            const languageCode = args.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage, ConversationConnectionConfig_js_1.ConversationConnectionConfig.defaultLanguageCode);
            const nickname = args.getProperty(Exports_js_2.PropertyId.ConversationTranslator_Name, "conversation_host");
            const endpointHost = args.getProperty(Exports_js_2.PropertyId.ConversationTranslator_Host, this.privHost);
            const correlationId = args.getProperty(Exports_js_2.PropertyId.ConversationTranslator_CorrelationId);
            const subscriptionKey = args.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key);
            const subscriptionRegion = args.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region);
            const authToken = args.getProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token);
            Contracts_js_1.Contracts.throwIfNullOrWhitespace(languageCode, "languageCode");
            Contracts_js_1.Contracts.throwIfNullOrWhitespace(nickname, "nickname");
            Contracts_js_1.Contracts.throwIfNullOrWhitespace(endpointHost, "endpointHost");
            const queryParams = {};
            queryParams[this.privRequestParams.apiVersion] = this.privApiVersion;
            queryParams[this.privRequestParams.languageCode] = languageCode;
            queryParams[this.privRequestParams.nickname] = nickname;
            const headers = {};
            if (correlationId) {
                headers[this.privRequestParams.correlationId] = correlationId;
            }
            headers[this.privRequestParams.clientAppId] = ConversationConnectionConfig_js_1.ConversationConnectionConfig.clientAppId;
            if (conversationCode !== undefined) {
                queryParams[this.privRequestParams.roomId] = conversationCode;
            }
            else {
                Contracts_js_1.Contracts.throwIfNullOrUndefined(subscriptionRegion, this.privErrors.authInvalidSubscriptionRegion);
                headers[this.privRequestParams.subscriptionRegion] = subscriptionRegion;
                if (subscriptionKey) {
                    headers[this.privRequestParams.subscriptionKey] = subscriptionKey;
                }
                else if (authToken) {
                    headers[this.privRequestParams.authorization] = `Bearer ${authToken}`;
                }
                else {
                    Contracts_js_1.Contracts.throwIfNullOrUndefined(subscriptionKey, this.privErrors.authInvalidSubscriptionKey);
                }
            }
            const config = {};
            config.headers = headers;
            this.privRestAdapter.options = config;
            const endpoint = `https://${endpointHost}${this.privRestPath}`;
            // TODO: support a proxy and certificate validation
            this.privRestAdapter.request(Exports_js_1.RestRequestType.Post, endpoint, queryParams, null).then((response) => {
                const requestId = Exports_js_1.RestMessageAdapter.extractHeaderValue(this.privRequestParams.requestId, response.headers);
                if (!response.ok) {
                    if (!!err) {
                        // get the error
                        let errorMessage = this.privErrors.invalidCreateJoinConversationResponse.replace("{status}", response.status.toString());
                        let errMessageRaw;
                        try {
                            errMessageRaw = JSON.parse(response.data);
                            errorMessage += ` [${errMessageRaw.error.code}: ${errMessageRaw.error.message}]`;
                        }
                        catch (e) {
                            errorMessage += ` [${response.data}]`;
                        }
                        if (requestId) {
                            errorMessage += ` ${requestId}`;
                        }
                        err(errorMessage);
                    }
                    return;
                }
                const conversation = JSON.parse(response.data);
                if (conversation) {
                    conversation.requestId = requestId;
                }
                if (!!cb) {
                    try {
                        cb(conversation);
                    }
                    catch (e) {
                        if (!!err) {
                            err(e);
                        }
                    }
                    cb = undefined;
                }
                // eslint-disable-next-line @typescript-eslint/no-empty-function
            }).catch(() => { });
        }
        catch (error) {
            if (!!err) {
                if (error instanceof Error) {
                    const typedError = error;
                    err(typedError.name + ": " + typedError.message);
                }
                else {
                    err(error);
                }
            }
        }
    }
    /**
     * Make a DELETE request to the Conversation Manager service endpoint to leave the conversation.
     * @param args
     * @param sessionToken
     * @param callback
     */
    leave(args, sessionToken) {
        return new Promise((resolve, reject) => {
            try {
                Contracts_js_1.Contracts.throwIfNullOrUndefined(args, this.privErrors.invalidArgs.replace("{arg}", "config"));
                Contracts_js_1.Contracts.throwIfNullOrWhitespace(sessionToken, this.privErrors.invalidArgs.replace("{arg}", "token"));
                const endpointHost = args.getProperty(Exports_js_2.PropertyId.ConversationTranslator_Host, this.privHost);
                const correlationId = args.getProperty(Exports_js_2.PropertyId.ConversationTranslator_CorrelationId);
                const queryParams = {};
                queryParams[this.privRequestParams.apiVersion] = this.privApiVersion;
                queryParams[this.privRequestParams.sessionToken] = sessionToken;
                const headers = {};
                if (correlationId) {
                    headers[this.privRequestParams.correlationId] = correlationId;
                }
                const config = {};
                config.headers = headers;
                this.privRestAdapter.options = config;
                const endpoint = `https://${endpointHost}${this.privRestPath}`;
                // TODO: support a proxy and certificate validation
                this.privRestAdapter.request(Exports_js_1.RestRequestType.Delete, endpoint, queryParams, null).then((response) => {
                    if (!response.ok) {
                        // ignore errors on delete
                    }
                    resolve();
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                }).catch(() => { });
            }
            catch (error) {
                if (error instanceof Error) {
                    const typedError = error;
                    reject(typedError.name + ": " + typedError.message);
                }
                else {
                    reject(error);
                }
            }
        });
    }
}
exports.ConversationManager = ConversationManager;

//# sourceMappingURL=ConversationManager.js.map
