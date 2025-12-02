"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationTranslatorRecognizer = exports.ConversationRecognizerFactory = void 0;
// eslint-disable-next-line max-classes-per-file
const Exports_js_1 = require("../../common.speech/Exports.js");
const Exports_js_2 = require("../../common/Exports.js");
const Contracts_js_1 = require("../../sdk/Contracts.js");
const Exports_js_3 = require("../../sdk/Exports.js");
const ConversationConnectionFactory_js_1 = require("./ConversationConnectionFactory.js");
const ConversationServiceAdapter_js_1 = require("./ConversationServiceAdapter.js");
class ConversationRecognizerFactory {
    static fromConfig(conversation, speechConfig, audioConfig) {
        return new ConversationTranslatorRecognizer(conversation, speechConfig, audioConfig);
    }
}
exports.ConversationRecognizerFactory = ConversationRecognizerFactory;
/**
 * Sends messages to the Conversation Translator websocket and listens for incoming events containing websocket messages.
 * Based off the recognizers in the SDK folder.
 */
class ConversationTranslatorRecognizer extends Exports_js_3.Recognizer {
    constructor(conversation, speechConfig, audioConfig) {
        const serviceConfigImpl = speechConfig;
        Contracts_js_1.Contracts.throwIfNull(serviceConfigImpl, "speechConfig");
        const conversationImpl = conversation;
        Contracts_js_1.Contracts.throwIfNull(conversationImpl, "conversationImpl");
        super(audioConfig, serviceConfigImpl.properties, new ConversationConnectionFactory_js_1.ConversationConnectionFactory());
        this.privConversation = conversationImpl;
        this.privIsDisposed = false;
        this.privProperties = serviceConfigImpl.properties.clone();
        this.privConnection = Exports_js_3.Connection.fromRecognizer(this);
        const webWorkerLoadType = this.privProperties.getProperty(Exports_js_3.PropertyId.WebWorkerLoadType, "on").toLowerCase();
        if (webWorkerLoadType === "on" && typeof (Blob) !== "undefined" && typeof (Worker) !== "undefined") {
            this.privSetTimeout = Exports_js_2.Timeout.setTimeout;
            this.privClearTimeout = Exports_js_2.Timeout.clearTimeout;
        }
        else {
            if (typeof window !== "undefined") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                this.privSetTimeout = window.setTimeout.bind(window);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                this.privClearTimeout = window.clearTimeout.bind(window);
            }
            else {
                this.privSetTimeout = setTimeout;
                this.privClearTimeout = clearTimeout;
            }
        }
    }
    set connected(cb) {
        this.privConnection.connected = cb;
    }
    set disconnected(cb) {
        this.privConnection.disconnected = cb;
    }
    /**
     * Return the speech language used by the recognizer
     */
    get speechRecognitionLanguage() {
        return this.privSpeechRecognitionLanguage;
    }
    /**
     * Return the properties for the recognizer
     */
    get properties() {
        return this.privProperties;
    }
    isDisposed() {
        return this.privIsDisposed;
    }
    /**
     * Connect to the recognizer
     * @param token
     */
    connect(token, cb, err) {
        try {
            Contracts_js_1.Contracts.throwIfDisposed(this.privIsDisposed);
            Contracts_js_1.Contracts.throwIfNullOrWhitespace(token, "token");
            this.privReco.conversationTranslatorToken = token;
            this.resetConversationTimeout();
            this.privReco.connectAsync(cb, err);
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
     * Disconnect from the recognizer
     */
    disconnect(cb, err) {
        try {
            Contracts_js_1.Contracts.throwIfDisposed(this.privIsDisposed);
            if (this.privTimeoutToken !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                this.privClearTimeout(this.privTimeoutToken);
            }
            this.privReco.disconnect().then(() => {
                if (!!cb) {
                    cb();
                }
            }, (error) => {
                if (!!err) {
                    err(error);
                }
            });
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
            // Destroy the recognizer.
            this.dispose(true).catch((reason) => {
                Exports_js_2.Events.instance.onEvent(new Exports_js_2.BackgroundEvent(reason));
            });
        }
    }
    /**
     * Send the mute all participants command to the websocket
     * @param conversationId
     * @param participantId
     * @param isMuted
     */
    sendRequest(command, cb, err) {
        try {
            Contracts_js_1.Contracts.throwIfDisposed(this.privIsDisposed);
            this.sendMessage(command, cb, err);
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
            // Destroy the recognizer.
            this.dispose(true).catch((reason) => {
                Exports_js_2.Events.instance.onEvent(new Exports_js_2.BackgroundEvent(reason));
            });
        }
    }
    /**
     * Handle update of service auth token (#694)
     */
    onToken(token) {
        this.privConversation.onToken(token);
    }
    /**
     * Close and dispose the recognizer
     */
    async close() {
        if (!this.privIsDisposed) {
            if (!!this.privConnection) {
                this.privConnection.closeConnection();
                this.privConnection.close();
            }
            this.privConnection = undefined;
            await this.dispose(true);
        }
    }
    /**
     * Dispose the recognizer
     * @param disposing
     */
    async dispose(disposing) {
        if (this.privIsDisposed) {
            return;
        }
        if (disposing) {
            if (this.privTimeoutToken !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                this.privClearTimeout(this.privTimeoutToken);
            }
            this.privIsDisposed = true;
            if (!!this.privConnection) {
                this.privConnection.closeConnection();
                this.privConnection.close();
                this.privConnection = undefined;
            }
            await super.dispose(disposing);
        }
    }
    /**
     * Create the config for the recognizer
     * @param speechConfig
     */
    createRecognizerConfig(speechConfig) {
        return new Exports_js_1.RecognizerConfig(speechConfig, this.privProperties);
    }
    /**
     * Create the service recognizer.
     * The audio source is redundnant here but is required by the implementation.
     * @param authentication
     * @param connectionFactory
     * @param audioConfig
     * @param recognizerConfig
     */
    createServiceRecognizer(authentication, connectionFactory, audioConfig, recognizerConfig) {
        const audioSource = audioConfig;
        return new ConversationServiceAdapter_js_1.ConversationServiceAdapter(authentication, connectionFactory, audioSource, recognizerConfig, this);
    }
    sendMessage(msg, cb, err) {
        const withAsync = this.privReco;
        const PromiseToEmptyCallback = (promise, cb, err) => {
            if (promise !== undefined) {
                promise.then(() => {
                    try {
                        if (!!cb) {
                            cb();
                        }
                    }
                    catch (e) {
                        if (!!err) {
                            err(`'Unhandled error on promise callback: ${e}'`);
                        }
                    }
                }, (reason) => {
                    try {
                        if (!!err) {
                            err(reason);
                        }
                        // eslint-disable-next-line no-empty
                    }
                    catch (error) { }
                });
            }
            else {
                if (!!err) {
                    err("Null promise");
                }
            }
        };
        PromiseToEmptyCallback(withAsync.sendMessageAsync(msg), cb, err);
        this.resetConversationTimeout();
    }
    resetConversationTimeout() {
        if (this.privTimeoutToken !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            this.privClearTimeout(this.privTimeoutToken);
        }
        this.privTimeoutToken = this.privSetTimeout(() => {
            this.sendRequest(this.privConversation.getKeepAlive());
        }, 60000);
    }
}
exports.ConversationTranslatorRecognizer = ConversationTranslatorRecognizer;

//# sourceMappingURL=ConversationTranslatorRecognizer.js.map
