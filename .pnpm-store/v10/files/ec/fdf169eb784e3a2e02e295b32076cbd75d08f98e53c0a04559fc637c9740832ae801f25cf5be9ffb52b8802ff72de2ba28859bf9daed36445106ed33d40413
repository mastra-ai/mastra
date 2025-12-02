"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
// Multi-device Conversation is a Preview feature.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationTranslator = exports.SpeechState = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../../common.speech/Exports.js");
const ConversationTranslatorConnectionFactory_js_1 = require("../../common.speech/Transcription/ConversationTranslatorConnectionFactory.js");
const Exports_js_2 = require("../../common/Exports.js");
const Contracts_js_1 = require("../Contracts.js");
const Exports_js_3 = require("../Exports.js");
const Conversation_js_1 = require("./Conversation.js");
const Exports_js_4 = require("./Exports.js");
var SpeechState;
(function (SpeechState) {
    SpeechState[SpeechState["Inactive"] = 0] = "Inactive";
    SpeechState[SpeechState["Connecting"] = 1] = "Connecting";
    SpeechState[SpeechState["Connected"] = 2] = "Connected";
})(SpeechState = exports.SpeechState || (exports.SpeechState = {}));
// child class of TranslationRecognizer meant only for use with ConversationTranslator
class ConversationTranslationRecognizer extends Exports_js_3.TranslationRecognizer {
    constructor(speechConfig, audioConfig, translator, convGetter) {
        super(speechConfig, audioConfig, new ConversationTranslatorConnectionFactory_js_1.ConversationTranslatorConnectionFactory(convGetter));
        this.privSpeechState = SpeechState.Inactive;
        if (!!translator) {
            this.privTranslator = translator;
            this.sessionStarted = () => {
                this.privSpeechState = SpeechState.Connected;
            };
            this.sessionStopped = () => {
                this.privSpeechState = SpeechState.Inactive;
            };
            this.recognizing = (tr, e) => {
                if (!!this.privTranslator.recognizing) {
                    this.privTranslator.recognizing(this.privTranslator, e);
                }
            };
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            this.recognized = async (tr, e) => {
                // if there is an error connecting to the conversation service from the speech service the error will be returned in the ErrorDetails field.
                if (e.result?.errorDetails) {
                    await this.cancelSpeech();
                    // TODO: format the error message contained in 'errorDetails'
                    this.fireCancelEvent(e.result.errorDetails);
                }
                else {
                    if (!!this.privTranslator.recognized) {
                        this.privTranslator.recognized(this.privTranslator, e);
                    }
                }
                return;
            };
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            this.canceled = async () => {
                if (this.privSpeechState !== SpeechState.Inactive) {
                    try {
                        await this.cancelSpeech();
                    }
                    catch (error) {
                        this.privSpeechState = SpeechState.Inactive;
                    }
                }
            };
        }
    }
    get state() {
        return this.privSpeechState;
    }
    set state(newState) {
        this.privSpeechState = newState;
    }
    set authentication(token) {
        this.privReco.authentication = token;
    }
    onConnection() {
        this.privSpeechState = SpeechState.Connected;
    }
    async onCancelSpeech() {
        this.privSpeechState = SpeechState.Inactive;
        await this.cancelSpeech();
    }
    /**
     * Fire a cancel event
     * @param error
     */
    fireCancelEvent(error) {
        try {
            if (!!this.privTranslator.canceled) {
                const cancelEvent = new Exports_js_4.ConversationTranslationCanceledEventArgs(Exports_js_3.CancellationReason.Error, error, Exports_js_3.CancellationErrorCode.RuntimeError);
                this.privTranslator.canceled(this.privTranslator, cancelEvent);
            }
        }
        catch (e) {
            //
        }
    }
    async cancelSpeech() {
        try {
            this.stopContinuousRecognitionAsync();
            await this.privReco?.disconnect();
            this.privSpeechState = SpeechState.Inactive;
        }
        catch (e) {
            // ignore the error
        }
    }
}
/**
 * Join, leave or connect to a conversation.
 */
class ConversationTranslator extends Exports_js_4.ConversationCommon {
    constructor(audioConfig) {
        super(audioConfig);
        this.privErrors = Exports_js_1.ConversationConnectionConfig.restErrors;
        this.privIsDisposed = false;
        this.privIsSpeaking = false;
        this.privPlaceholderKey = "abcdefghijklmnopqrstuvwxyz012345";
        this.privPlaceholderRegion = "westus";
        this.privProperties = new Exports_js_3.PropertyCollection();
    }
    get properties() {
        return this.privProperties;
    }
    get speechRecognitionLanguage() {
        return this.privSpeechRecognitionLanguage;
    }
    get participants() {
        return this.privConversation?.participants;
    }
    get canSpeak() {
        // is there a Conversation websocket available and has the Recognizer been set up
        if (!this.privConversation.isConnected || !this.privCTRecognizer) {
            return false;
        }
        // is the user already speaking
        if (this.privIsSpeaking || this.privCTRecognizer.state === SpeechState.Connected || this.privCTRecognizer.state === SpeechState.Connecting) {
            return false;
        }
        // is the user muted
        if (this.privConversation.isMutedByHost) {
            return false;
        }
        return true;
    }
    onToken(token) {
        this.privCTRecognizer.authentication = token;
    }
    setServiceProperty(name, value) {
        const currentProperties = JSON.parse(this.privProperties.getProperty(Exports_js_1.ServicePropertiesPropertyName, "{}"));
        currentProperties[name] = value;
        this.privProperties.setProperty(Exports_js_1.ServicePropertiesPropertyName, JSON.stringify(currentProperties));
    }
    joinConversationAsync(conversation, nickname, param1, param2, param3) {
        try {
            if (typeof conversation === "string") {
                Contracts_js_1.Contracts.throwIfNullOrUndefined(conversation, this.privErrors.invalidArgs.replace("{arg}", "conversation id"));
                Contracts_js_1.Contracts.throwIfNullOrWhitespace(nickname, this.privErrors.invalidArgs.replace("{arg}", "nickname"));
                if (!!this.privConversation) {
                    this.handleError(new Error(this.privErrors.permissionDeniedStart), param3);
                }
                let lang = param1;
                if (lang === undefined || lang === null || lang === "") {
                    lang = Exports_js_1.ConversationConnectionConfig.defaultLanguageCode;
                }
                // create a placeholder config
                this.privSpeechTranslationConfig = Exports_js_3.SpeechTranslationConfig.fromSubscription(this.privPlaceholderKey, this.privPlaceholderRegion);
                this.privSpeechTranslationConfig.setProfanity(Exports_js_3.ProfanityOption.Masked);
                this.privSpeechTranslationConfig.addTargetLanguage(lang);
                this.privSpeechTranslationConfig.setProperty(Exports_js_3.PropertyId[Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage], lang);
                this.privSpeechTranslationConfig.setProperty(Exports_js_3.PropertyId[Exports_js_3.PropertyId.ConversationTranslator_Name], nickname);
                const propertyIdsToCopy = [
                    Exports_js_3.PropertyId.SpeechServiceConnection_Host,
                    Exports_js_3.PropertyId.ConversationTranslator_Host,
                    Exports_js_3.PropertyId.SpeechServiceConnection_Endpoint,
                    Exports_js_3.PropertyId.SpeechServiceConnection_ProxyHostName,
                    Exports_js_3.PropertyId.SpeechServiceConnection_ProxyPassword,
                    Exports_js_3.PropertyId.SpeechServiceConnection_ProxyPort,
                    Exports_js_3.PropertyId.SpeechServiceConnection_ProxyUserName,
                    "ConversationTranslator_MultiChannelAudio",
                    "ConversationTranslator_Region"
                ];
                for (const prop of propertyIdsToCopy) {
                    const value = this.privProperties.getProperty(prop);
                    if (value) {
                        const key = typeof prop === "string" ? prop : Exports_js_3.PropertyId[prop];
                        this.privSpeechTranslationConfig.setProperty(key, value);
                    }
                }
                const currentProperties = JSON.parse(this.privProperties.getProperty(Exports_js_1.ServicePropertiesPropertyName, "{}"));
                for (const prop of Object.keys(currentProperties)) {
                    this.privSpeechTranslationConfig.setServiceProperty(prop, currentProperties[prop], Exports_js_3.ServicePropertyChannel.UriQueryParameter);
                }
                // join the conversation
                this.privConversation = new Conversation_js_1.ConversationImpl(this.privSpeechTranslationConfig);
                this.privConversation.conversationTranslator = this;
                this.privConversation.joinConversationAsync(conversation, nickname, lang, ((result) => {
                    if (!result) {
                        this.handleError(new Error(this.privErrors.permissionDeniedConnect), param3);
                    }
                    this.privSpeechTranslationConfig.authorizationToken = result;
                    this.privConversation.room.isHost = false;
                    // connect to the ws
                    this.privConversation.startConversationAsync((() => {
                        this.handleCallback(param2, param3);
                    }), ((error) => {
                        this.handleError(error, param3);
                    }));
                }), ((error) => {
                    this.handleError(error, param3);
                }));
            }
            else if (typeof conversation === "object") {
                Contracts_js_1.Contracts.throwIfNullOrUndefined(conversation, this.privErrors.invalidArgs.replace("{arg}", "conversation id"));
                Contracts_js_1.Contracts.throwIfNullOrWhitespace(nickname, this.privErrors.invalidArgs.replace("{arg}", "nickname"));
                // save the nickname
                this.privProperties.setProperty(Exports_js_3.PropertyId.ConversationTranslator_Name, nickname);
                // ref the conversation object
                this.privConversation = conversation;
                // ref the conversation translator object
                this.privConversation.conversationTranslator = this;
                this.privConversation.room.isHost = true;
                Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privConversation, this.privErrors.permissionDeniedConnect);
                Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privConversation.room.token, this.privErrors.permissionDeniedConnect);
                this.privSpeechTranslationConfig = conversation.config;
                this.handleCallback(param1, param2);
            }
            else {
                this.handleError(new Error(this.privErrors.invalidArgs.replace("{arg}", "invalid conversation type")), param2);
            }
        }
        catch (error) {
            this.handleError(error, typeof param1 === "string" ? param3 : param2);
        }
    }
    /**
     * Leave the conversation
     * @param cb
     * @param err
     */
    leaveConversationAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)((async () => {
            // stop the speech websocket
            await this.cancelSpeech();
            // stop the websocket
            await this.privConversation.endConversationImplAsync();
            // https delete request
            await this.privConversation.deleteConversationImplAsync();
            this.dispose();
        })(), cb, err);
    }
    /**
     * Send a text message
     * @param message
     * @param cb
     * @param err
     */
    sendTextMessageAsync(message, cb, err) {
        try {
            Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privConversation, this.privErrors.permissionDeniedSend);
            Contracts_js_1.Contracts.throwIfNullOrWhitespace(message, this.privErrors.invalidArgs.replace("{arg}", message));
            this.privConversation.sendTextMessageAsync(message, cb, err);
        }
        catch (error) {
            this.handleError(error, err);
        }
    }
    /**
     * Start speaking
     * @param cb
     * @param err
     */
    startTranscribingAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)((async () => {
            try {
                Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privConversation, this.privErrors.permissionDeniedSend);
                Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privConversation.room.token, this.privErrors.permissionDeniedConnect);
                if (this.privCTRecognizer === undefined) {
                    await this.connectTranslatorRecognizer();
                }
                Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privCTRecognizer, this.privErrors.permissionDeniedSend);
                if (!this.canSpeak) {
                    this.handleError(new Error(this.privErrors.permissionDeniedSend), err);
                }
                await this.startContinuousRecognition();
                this.privIsSpeaking = true;
            }
            catch (error) {
                this.privIsSpeaking = false;
                await this.cancelSpeech();
                throw error;
            }
        })(), cb, err);
    }
    /**
     * Stop speaking
     * @param cb
     * @param err
     */
    stopTranscribingAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)((async () => {
            try {
                if (!this.privIsSpeaking) {
                    // stop speech
                    await this.cancelSpeech();
                    return;
                }
                // stop the recognition but leave the websocket open
                this.privIsSpeaking = false;
                await new Promise((resolve, reject) => {
                    this.privCTRecognizer.stopContinuousRecognitionAsync(resolve, reject);
                });
            }
            catch (error) {
                await this.cancelSpeech();
            }
        })(), cb, err);
    }
    isDisposed() {
        return this.privIsDisposed;
    }
    dispose(reason, success, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)((async () => {
            if (this.isDisposed && !this.privIsSpeaking) {
                return;
            }
            await this.cancelSpeech();
            this.privIsDisposed = true;
            this.privSpeechTranslationConfig.close();
            this.privSpeechRecognitionLanguage = undefined;
            this.privProperties = undefined;
            this.privAudioConfig = undefined;
            this.privSpeechTranslationConfig = undefined;
            this.privConversation.dispose();
            this.privConversation = undefined;
        })(), success, err);
    }
    /**
     * Cancel the speech websocket
     */
    async cancelSpeech() {
        try {
            this.privIsSpeaking = false;
            await this.privCTRecognizer?.onCancelSpeech();
            this.privCTRecognizer = undefined;
        }
        catch (e) {
            // ignore the error
        }
    }
    /**
     * Connect to the speech translation recognizer.
     * Currently there is no language validation performed before sending the SpeechLanguage code to the service.
     * If it's an invalid language the raw error will be: 'Error during WebSocket handshake: Unexpected response code: 400'
     * e.g. pass in 'fr' instead of 'fr-FR', or a text-only language 'cy'
     */
    async connectTranslatorRecognizer() {
        try {
            if (this.privAudioConfig === undefined) {
                this.privAudioConfig = Exports_js_3.AudioConfig.fromDefaultMicrophoneInput();
            }
            // clear the temp subscription key if it's a participant joining
            if (this.privSpeechTranslationConfig.getProperty(Exports_js_3.PropertyId[Exports_js_3.PropertyId.SpeechServiceConnection_Key])
                === this.privPlaceholderKey) {
                this.privSpeechTranslationConfig.setProperty(Exports_js_3.PropertyId[Exports_js_3.PropertyId.SpeechServiceConnection_Key], "");
            }
            const convGetter = () => this.privConversation;
            this.privCTRecognizer = new ConversationTranslationRecognizer(this.privSpeechTranslationConfig, this.privAudioConfig, this, convGetter);
        }
        catch (error) {
            await this.cancelSpeech();
            throw error;
        }
    }
    /**
     * Handle the start speaking request
     */
    startContinuousRecognition() {
        return new Promise((resolve, reject) => {
            this.privCTRecognizer.startContinuousRecognitionAsync(resolve, reject);
        });
    }
}
exports.ConversationTranslator = ConversationTranslator;

//# sourceMappingURL=ConversationTranslator.js.map
