"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRecognizerBase = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
const Exports_js_3 = require("../sdk/Exports.js");
const Exports_js_4 = require("./Exports.js");
const SpeechConnectionMessage_Internal_js_1 = require("./SpeechConnectionMessage.Internal.js");
const Segmentation_js_1 = require("./ServiceMessages/PhraseDetection/Segmentation.js");
const PhraseDetectionContext_js_1 = require("./ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
const OnSuccess_js_1 = require("./ServiceMessages/Translation/OnSuccess.js");
const InterimResults_js_1 = require("./ServiceMessages/Translation/InterimResults.js");
const LanguageIdContext_js_1 = require("./ServiceMessages/LanguageId/LanguageIdContext.js");
const OnSuccess_js_2 = require("./ServiceMessages/LanguageId/OnSuccess.js");
const OnUnknown_js_1 = require("./ServiceMessages/LanguageId/OnUnknown.js");
const InterimResults_js_2 = require("./ServiceMessages/PhraseOutput/InterimResults.js");
const PhraseResults_js_1 = require("./ServiceMessages/PhraseOutput/PhraseResults.js");
const OnSuccess_js_3 = require("./ServiceMessages/PhraseDetection/OnSuccess.js");
class ServiceRecognizerBase {
    constructor(authentication, connectionFactory, audioSource, recognizerConfig, recognizer) {
        // A promise for a configured connection.
        // Do not consume directly, call fetchConnection instead.
        this.privConnectionConfigurationPromise = undefined;
        // A promise for a connection, but one that has not had the speech context sent yet.
        // Do not consume directly, call fetchConnection instead.
        this.privConnectionPromise = undefined;
        this.privSetTimeout = setTimeout;
        this.privIsLiveAudio = false;
        this.privAverageBytesPerMs = 0;
        this.privEnableSpeakerId = false;
        this.privExpectContentAssessmentResponse = false;
        this.recognizeOverride = undefined;
        this.recognizeSpeaker = undefined;
        this.disconnectOverride = undefined;
        this.receiveMessageOverride = undefined;
        this.sendPrePayloadJSONOverride = undefined;
        this.postConnectImplOverride = undefined;
        this.configConnectionOverride = undefined;
        this.handleSpeechPhraseMessage = undefined;
        this.handleSpeechHypothesisMessage = undefined;
        if (!authentication) {
            throw new Exports_js_2.ArgumentNullError("authentication");
        }
        if (!connectionFactory) {
            throw new Exports_js_2.ArgumentNullError("connectionFactory");
        }
        if (!audioSource) {
            throw new Exports_js_2.ArgumentNullError("audioSource");
        }
        if (!recognizerConfig) {
            throw new Exports_js_2.ArgumentNullError("recognizerConfig");
        }
        this.privEnableSpeakerId = recognizerConfig.isSpeakerDiarizationEnabled;
        this.privMustReportEndOfStream = false;
        this.privAuthentication = authentication;
        this.privConnectionFactory = connectionFactory;
        this.privAudioSource = audioSource;
        this.privRecognizerConfig = recognizerConfig;
        this.privIsDisposed = false;
        this.privRecognizer = recognizer;
        this.privRequestSession = new Exports_js_4.RequestSession(this.privAudioSource.id());
        this.privConnectionEvents = new Exports_js_2.EventSource();
        this.privServiceEvents = new Exports_js_2.EventSource();
        this.privDynamicGrammar = new Exports_js_4.DynamicGrammarBuilder();
        this.privSpeechContext = new Exports_js_4.SpeechContext(this.privDynamicGrammar);
        this.privAgentConfig = new Exports_js_4.AgentConfig();
        const webWorkerLoadType = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.WebWorkerLoadType, "on").toLowerCase();
        if (webWorkerLoadType === "on" && typeof (Blob) !== "undefined" && typeof (Worker) !== "undefined") {
            this.privSetTimeout = Exports_js_2.Timeout.setTimeout;
        }
        else {
            if (typeof window !== "undefined") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                this.privSetTimeout = window.setTimeout.bind(window);
            }
            if (typeof globalThis !== "undefined") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                this.privSetTimeout = globalThis.setTimeout.bind(globalThis);
            }
        }
        this.connectionEvents.attach((connectionEvent) => {
            if (connectionEvent.name === "ConnectionClosedEvent") {
                const connectionClosedEvent = connectionEvent;
                if (connectionClosedEvent.statusCode === 1003 ||
                    connectionClosedEvent.statusCode === 1007 ||
                    connectionClosedEvent.statusCode === 1002 ||
                    connectionClosedEvent.statusCode === 4000 ||
                    this.privRequestSession.numConnectionAttempts > this.privRecognizerConfig.maxRetryCount) {
                    void this.cancelRecognitionLocal(Exports_js_3.CancellationReason.Error, connectionClosedEvent.statusCode === 1007 ? Exports_js_3.CancellationErrorCode.BadRequestParameters : Exports_js_3.CancellationErrorCode.ConnectionFailure, `${connectionClosedEvent.reason} websocket error code: ${connectionClosedEvent.statusCode}`);
                }
            }
        });
        if (this.privEnableSpeakerId) {
            this.privDiarizationSessionId = (0, Exports_js_2.createNoDashGuid)();
        }
    }
    setTranslationJson() {
        const targetLanguages = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages, undefined);
        if (targetLanguages !== undefined) {
            const languages = targetLanguages.split(",");
            const translationVoice = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationVoice, undefined);
            const categoryId = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationCategoryId, undefined);
            const action = (translationVoice !== undefined) ? OnSuccess_js_1.NextAction.Synthesize : OnSuccess_js_1.NextAction.None;
            this.privSpeechContext.getContext().translation = {
                onPassthrough: { action },
                onSuccess: { action },
                output: {
                    includePassThroughResults: true,
                    interimResults: { mode: InterimResults_js_1.Mode.Always }
                },
                targetLanguages: languages,
            };
            // Add category if specified
            if (categoryId !== undefined) {
                this.privSpeechContext.getContext().translation.category = categoryId;
            }
            if (translationVoice !== undefined) {
                const languageToVoiceMap = {};
                for (const lang of languages) {
                    languageToVoiceMap[lang] = translationVoice;
                }
                this.privSpeechContext.getContext().synthesis = {
                    defaultVoices: languageToVoiceMap
                };
            }
            // Configure phrase detection for translation
            const phraseDetection = this.privSpeechContext.getContext().phraseDetection || {};
            phraseDetection.onSuccess = { action: OnSuccess_js_3.NextAction.Translate };
            phraseDetection.onInterim = { action: OnSuccess_js_3.NextAction.Translate };
            this.privSpeechContext.getContext().phraseDetection = phraseDetection;
        }
    }
    setSpeechSegmentationTimeoutJson() {
        const speechSegmentationSilenceTimeoutMs = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.Speech_SegmentationSilenceTimeoutMs, undefined);
        const speechSegmentationMaximumTimeMs = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.Speech_SegmentationMaximumTimeMs, undefined);
        const speechSegmentationStrategy = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.Speech_SegmentationStrategy, undefined);
        const segmentation = {
            mode: Segmentation_js_1.SegmentationMode.Normal,
        };
        let configuredSegment = false;
        if (speechSegmentationStrategy !== undefined) {
            configuredSegment = true;
            let segMode = Segmentation_js_1.SegmentationMode.Normal;
            switch (speechSegmentationStrategy.toLowerCase()) {
                case "default":
                    break;
                case "time":
                    segMode = Segmentation_js_1.SegmentationMode.Custom;
                    break;
                case "semantic":
                    segMode = Segmentation_js_1.SegmentationMode.Semantic;
                    break;
            }
            segmentation.mode = segMode;
        }
        if (speechSegmentationSilenceTimeoutMs !== undefined) {
            configuredSegment = true;
            const segmentationSilenceTimeoutMs = parseInt(speechSegmentationSilenceTimeoutMs, 10);
            segmentation.mode = Segmentation_js_1.SegmentationMode.Custom;
            segmentation.segmentationSilenceTimeoutMs = segmentationSilenceTimeoutMs;
        }
        if (speechSegmentationMaximumTimeMs !== undefined) {
            configuredSegment = true;
            const segmentationMaximumTimeMs = parseInt(speechSegmentationMaximumTimeMs, 10);
            segmentation.mode = Segmentation_js_1.SegmentationMode.Custom;
            segmentation.segmentationForcedTimeoutMs = segmentationMaximumTimeMs;
        }
        if (configuredSegment) {
            const phraseDetection = this.privSpeechContext.getContext().phraseDetection || {};
            phraseDetection.mode = this.recognitionMode;
            switch (this.recognitionMode) {
                case PhraseDetectionContext_js_1.RecognitionMode.Conversation:
                    phraseDetection.conversation = phraseDetection.conversation ?? { segmentation: {} };
                    phraseDetection.conversation.segmentation = segmentation;
                    break;
                case PhraseDetectionContext_js_1.RecognitionMode.Interactive:
                    phraseDetection.interactive = phraseDetection.interactive ?? { segmentation: {} };
                    phraseDetection.interactive.segmentation = segmentation;
                    break;
                case PhraseDetectionContext_js_1.RecognitionMode.Dictation:
                    phraseDetection.dictation = phraseDetection.dictation ?? {};
                    phraseDetection.dictation.segmentation = segmentation;
                    break;
            }
            this.privSpeechContext.getContext().phraseDetection = phraseDetection;
        }
    }
    setLanguageIdJson() {
        const phraseDetection = this.privSpeechContext.getContext().phraseDetection || {};
        if (this.privRecognizerConfig.autoDetectSourceLanguages !== undefined) {
            const sourceLanguages = this.privRecognizerConfig.autoDetectSourceLanguages.split(",");
            if (sourceLanguages.length === 1 && sourceLanguages[0] === Exports_js_4.AutoDetectSourceLanguagesOpenRangeOptionName) {
                sourceLanguages[0] = "UND";
            }
            let speechContextLidMode;
            if (this.privRecognizerConfig.languageIdMode === "Continuous") {
                speechContextLidMode = LanguageIdContext_js_1.LanguageIdDetectionMode.DetectContinuous;
            }
            else { // recognizerConfig.languageIdMode === "AtStart"
                speechContextLidMode = LanguageIdContext_js_1.LanguageIdDetectionMode.DetectAtAudioStart;
            }
            this.privSpeechContext.getContext().languageId = {
                languages: sourceLanguages,
                mode: speechContextLidMode,
                onSuccess: { action: OnSuccess_js_2.NextAction.Recognize },
                onUnknown: { action: OnUnknown_js_1.OnUnknownAction.None },
                priority: LanguageIdContext_js_1.LanguageIdDetectionPriority.PrioritizeLatency
            };
            this.privSpeechContext.getContext().phraseOutput = {
                interimResults: {
                    resultType: InterimResults_js_2.ResultType.Auto
                },
                phraseResults: {
                    resultType: PhraseResults_js_1.PhraseResultOutputType.Always
                }
            };
            const customModels = this.privRecognizerConfig.sourceLanguageModels;
            if (customModels !== undefined) {
                phraseDetection.customModels = customModels;
                phraseDetection.onInterim = { action: OnSuccess_js_3.NextAction.None };
                phraseDetection.onSuccess = { action: OnSuccess_js_3.NextAction.None };
            }
        }
        // No longer setting translation-specific configuration here
        // This is now handled in setTranslationJson and setupTranslationWithLanguageId methods
        this.privSpeechContext.getContext().phraseDetection = phraseDetection;
    }
    setOutputDetailLevelJson() {
        if (this.privEnableSpeakerId) {
            const requestWordLevelTimestamps = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps, "false").toLowerCase();
            if (requestWordLevelTimestamps === "true") {
                this.privSpeechContext.setWordLevelTimings();
            }
            else {
                const outputFormat = this.privRecognizerConfig.parameters.getProperty(Exports_js_4.OutputFormatPropertyName, Exports_js_3.OutputFormat[Exports_js_3.OutputFormat.Simple]).toLowerCase();
                if (outputFormat === Exports_js_3.OutputFormat[Exports_js_3.OutputFormat.Detailed].toLocaleLowerCase()) {
                    this.privSpeechContext.setDetailedOutputFormat();
                }
            }
        }
    }
    setSpeechStartEventSensitivityJson() {
        const sensitivity = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.Speech_StartEventSensitivity, undefined);
        if (sensitivity !== undefined) {
            let configuredSensitivity = false;
            switch (sensitivity.toLowerCase()) {
                case PhraseDetectionContext_js_1.SpeechStartEventSensitivity.Low:
                case PhraseDetectionContext_js_1.SpeechStartEventSensitivity.Medium:
                case PhraseDetectionContext_js_1.SpeechStartEventSensitivity.High:
                    configuredSensitivity = true;
                    break;
            }
            if (configuredSensitivity) {
                const phraseDetection = this.privSpeechContext.getContext().phraseDetection || {};
                phraseDetection.voiceOnsetSensitivity = sensitivity.toLowerCase();
                this.privSpeechContext.getContext().phraseDetection = phraseDetection;
            }
        }
    }
    get isSpeakerDiarizationEnabled() {
        return this.privEnableSpeakerId;
    }
    get audioSource() {
        return this.privAudioSource;
    }
    get speechContext() {
        return this.privSpeechContext;
    }
    get dynamicGrammar() {
        return this.privDynamicGrammar;
    }
    get agentConfig() {
        return this.privAgentConfig;
    }
    set conversationTranslatorToken(token) {
        this.privRecognizerConfig.parameters.setProperty(Exports_js_3.PropertyId.ConversationTranslator_Token, token);
    }
    set voiceProfileType(type) {
        this.privRecognizerConfig.parameters.setProperty(Exports_js_3.PropertyId.SpeechServiceConnection_SpeakerIdMode, type);
    }
    set authentication(auth) {
        this.privAuthentication = auth;
    }
    isDisposed() {
        return this.privIsDisposed;
    }
    async dispose(reason) {
        this.privIsDisposed = true;
        if (this.privConnectionPromise !== undefined) {
            try {
                const connection = await this.privConnectionPromise;
                await connection.dispose(reason);
            }
            catch (error) {
                // The connection is in a bad state. But we're trying to kill it, so...
                return;
            }
        }
    }
    get connectionEvents() {
        return this.privConnectionEvents;
    }
    get serviceEvents() {
        return this.privServiceEvents;
    }
    get recognitionMode() {
        return this.privRecognizerConfig.recognitionMode;
    }
    async recognize(recoMode, successCallback, errorCallBack) {
        if (this.recognizeOverride !== undefined) {
            await this.recognizeOverride(recoMode, successCallback, errorCallBack);
            return;
        }
        // Clear the existing configuration promise to force a re-transmission of config and context.
        this.privConnectionConfigurationPromise = undefined;
        this.privRecognizerConfig.recognitionMode = recoMode;
        if (this.privRecognizerConfig.recognitionEndpointVersion === "2") {
            const phraseDetection = this.privSpeechContext.getContext().phraseDetection || {};
            phraseDetection.mode = recoMode;
            this.privSpeechContext.getContext().phraseDetection = phraseDetection;
        }
        // Set language ID (if configured)
        this.setLanguageIdJson();
        // Then set translation (if configured)
        this.setTranslationJson();
        // Configure the integration between language ID and translation (if both are used)
        if (this.privRecognizerConfig.autoDetectSourceLanguages !== undefined &&
            this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages, undefined) !== undefined) {
            this.setupTranslationWithLanguageId();
        }
        this.setSpeechSegmentationTimeoutJson();
        this.setOutputDetailLevelJson();
        this.setSpeechStartEventSensitivityJson();
        this.privSuccessCallback = successCallback;
        this.privErrorCallback = errorCallBack;
        this.privRequestSession.startNewRecognition();
        this.privRequestSession.listenForServiceTelemetry(this.privAudioSource.events);
        // Start the connection to the service. The promise this will create is stored and will be used by configureConnection().
        const conPromise = this.connectImpl();
        let audioNode;
        try {
            const audioStreamNode = await this.audioSource.attach(this.privRequestSession.audioNodeId);
            const format = await this.audioSource.format;
            const deviceInfo = await this.audioSource.deviceInfo;
            this.privIsLiveAudio = deviceInfo.type && deviceInfo.type === Exports_js_4.type.Microphones;
            audioNode = new Exports_js_1.ReplayableAudioNode(audioStreamNode, format.avgBytesPerSec);
            await this.privRequestSession.onAudioSourceAttachCompleted(audioNode, false);
            this.privRecognizerConfig.SpeechServiceConfig.Context.audio = { source: deviceInfo };
        }
        catch (error) {
            await this.privRequestSession.onStopRecognizing();
            throw error;
        }
        try {
            await conPromise;
        }
        catch (error) {
            await this.cancelRecognitionLocal(Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.ConnectionFailure, error);
            return;
        }
        const sessionStartEventArgs = new Exports_js_3.SessionEventArgs(this.privRequestSession.sessionId);
        if (!!this.privRecognizer.sessionStarted) {
            this.privRecognizer.sessionStarted(this.privRecognizer, sessionStartEventArgs);
        }
        void this.receiveMessage();
        const audioSendPromise = this.sendAudio(audioNode);
        audioSendPromise.catch(async (error) => {
            await this.cancelRecognitionLocal(Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.RuntimeError, error);
        });
        return;
    }
    async stopRecognizing() {
        if (this.privRequestSession.isRecognizing) {
            try {
                await this.audioSource.turnOff();
                await this.sendFinalAudio();
                await this.privRequestSession.onStopRecognizing();
                await this.privRequestSession.turnCompletionPromise;
            }
            finally {
                await this.privRequestSession.dispose();
            }
        }
        return;
    }
    async connect() {
        await this.connectImpl();
        return Promise.resolve();
    }
    connectAsync(cb, err) {
        this.connectImpl().then(() => {
            try {
                if (!!cb) {
                    cb();
                }
            }
            catch (e) {
                if (!!err) {
                    err(e);
                }
            }
        }, (reason) => {
            try {
                if (!!err) {
                    err(reason);
                }
                /* eslint-disable no-empty */
            }
            catch (error) {
            }
        });
    }
    async disconnect() {
        await this.cancelRecognitionLocal(Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.NoError, "Disconnecting");
        if (this.disconnectOverride !== undefined) {
            await this.disconnectOverride();
        }
        if (this.privConnectionPromise !== undefined) {
            try {
                await (await this.privConnectionPromise).dispose();
            }
            catch (error) {
            }
        }
        this.privConnectionPromise = undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sendMessage(message) {
        return;
    }
    async sendNetworkMessage(path, payload) {
        const type = typeof payload === "string" ? Exports_js_2.MessageType.Text : Exports_js_2.MessageType.Binary;
        const contentType = typeof payload === "string" ? "application/json" : "";
        const connection = await this.fetchConnection();
        return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(type, path, this.privRequestSession.requestId, contentType, payload));
    }
    set activityTemplate(messagePayload) {
        this.privActivityTemplate = messagePayload;
    }
    get activityTemplate() {
        return this.privActivityTemplate;
    }
    set expectContentAssessmentResponse(value) {
        this.privExpectContentAssessmentResponse = value;
    }
    async sendTelemetryData() {
        const telemetryData = this.privRequestSession.getTelemetry();
        if (ServiceRecognizerBase.telemetryDataEnabled !== true ||
            this.privIsDisposed ||
            null === telemetryData) {
            return;
        }
        if (!!ServiceRecognizerBase.telemetryData) {
            try {
                ServiceRecognizerBase.telemetryData(telemetryData);
                /* eslint-disable no-empty */
            }
            catch { }
        }
        const connection = await this.fetchConnection();
        await connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Text, "telemetry", this.privRequestSession.requestId, "application/json", telemetryData));
    }
    // Cancels recognition.
    async cancelRecognitionLocal(cancellationReason, errorCode, error) {
        if (!!this.privRequestSession.isRecognizing) {
            await this.privRequestSession.onStopRecognizing();
            this.cancelRecognition(this.privRequestSession.sessionId, this.privRequestSession.requestId, cancellationReason, errorCode, error);
        }
    }
    async receiveMessage() {
        try {
            if (this.privIsDisposed) {
                // We're done.
                return;
            }
            let connection = await this.fetchConnection();
            const message = await connection.read();
            if (this.receiveMessageOverride !== undefined) {
                return this.receiveMessageOverride();
            }
            // indicates we are draining the queue and it came with no message;
            if (!message) {
                return this.receiveMessage();
            }
            this.privServiceHasSentMessage = true;
            const connectionMessage = SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage.fromConnectionMessage(message);
            if (connectionMessage.requestId.toLowerCase() === this.privRequestSession.requestId.toLowerCase()) {
                switch (connectionMessage.path.toLowerCase()) {
                    case "turn.start":
                        this.privMustReportEndOfStream = true;
                        this.privRequestSession.onServiceTurnStartResponse();
                        break;
                    case "speech.startdetected":
                        const speechStartDetected = Exports_js_4.SpeechDetected.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset);
                        const speechStartEventArgs = new Exports_js_3.RecognitionEventArgs(speechStartDetected.Offset, this.privRequestSession.sessionId);
                        if (!!this.privRecognizer.speechStartDetected) {
                            this.privRecognizer.speechStartDetected(this.privRecognizer, speechStartEventArgs);
                        }
                        break;
                    case "speech.enddetected":
                        let json;
                        if (connectionMessage.textBody.length > 0) {
                            json = connectionMessage.textBody;
                        }
                        else {
                            // If the request was empty, the JSON returned is empty.
                            json = "{ Offset: 0 }";
                        }
                        const speechStopDetected = Exports_js_4.SpeechDetected.fromJSON(json, this.privRequestSession.currentTurnAudioOffset);
                        const speechStopEventArgs = new Exports_js_3.RecognitionEventArgs(speechStopDetected.Offset + this.privRequestSession.currentTurnAudioOffset, this.privRequestSession.sessionId);
                        if (!!this.privRecognizer.speechEndDetected) {
                            this.privRecognizer.speechEndDetected(this.privRecognizer, speechStopEventArgs);
                        }
                        break;
                    case "turn.end":
                        await this.sendTelemetryData();
                        if (this.privRequestSession.isSpeechEnded && this.privMustReportEndOfStream) {
                            this.privMustReportEndOfStream = false;
                            await this.cancelRecognitionLocal(Exports_js_3.CancellationReason.EndOfStream, Exports_js_3.CancellationErrorCode.NoError, undefined);
                        }
                        const sessionStopEventArgs = new Exports_js_3.SessionEventArgs(this.privRequestSession.sessionId);
                        await this.privRequestSession.onServiceTurnEndResponse(this.privRecognizerConfig.isContinuousRecognition);
                        if (!this.privRecognizerConfig.isContinuousRecognition || this.privRequestSession.isSpeechEnded || !this.privRequestSession.isRecognizing) {
                            if (!!this.privRecognizer.sessionStopped) {
                                this.privRecognizer.sessionStopped(this.privRecognizer, sessionStopEventArgs);
                            }
                            return;
                        }
                        else {
                            connection = await this.fetchConnection();
                            await this.sendPrePayloadJSON(connection);
                        }
                        break;
                    default:
                        if (!await this.processTypeSpecificMessages(connectionMessage)) {
                            // here are some messages that the derived class has not processed, dispatch them to connect class
                            if (!!this.privServiceEvents) {
                                this.serviceEvents.onEvent(new Exports_js_2.ServiceEvent(connectionMessage.path.toLowerCase(), connectionMessage.textBody));
                            }
                        }
                }
            }
            return this.receiveMessage();
        }
        catch (error) {
            return null;
        }
    }
    updateSpeakerDiarizationAudioOffset() {
        const bytesSent = this.privRequestSession.recognitionBytesSent;
        const audioOffsetMs = this.privAverageBytesPerMs !== 0 ? bytesSent / this.privAverageBytesPerMs : 0;
        this.privSpeechContext.setSpeakerDiarizationAudioOffsetMs(audioOffsetMs);
    }
    sendSpeechContext(connection, generateNewRequestId) {
        if (this.privEnableSpeakerId) {
            this.updateSpeakerDiarizationAudioOffset();
        }
        const speechContextJson = this.speechContext.toJSON();
        if (generateNewRequestId) {
            this.privRequestSession.onSpeechContext();
        }
        if (speechContextJson) {
            return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Text, "speech.context", this.privRequestSession.requestId, "application/json", speechContextJson));
        }
        return;
    }
    setupTranslationWithLanguageId() {
        const targetLanguages = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages, undefined);
        const hasLanguageId = this.privRecognizerConfig.autoDetectSourceLanguages !== undefined;
        if (targetLanguages !== undefined && hasLanguageId) {
            // Configure phraseOutput for translation + language ID scenario
            this.privSpeechContext.getContext().phraseOutput = {
                interimResults: {
                    resultType: InterimResults_js_2.ResultType.None
                },
                phraseResults: {
                    resultType: PhraseResults_js_1.PhraseResultOutputType.None
                }
            };
            // Handle custom language models and voice mapping
            const translationContext = this.privSpeechContext.getContext().translation;
            if (translationContext) {
                const customModels = this.privRecognizerConfig.sourceLanguageModels;
                if (customModels !== undefined && customModels.length > 0) {
                    const phraseDetection = this.privSpeechContext.getContext().phraseDetection || {};
                    phraseDetection.customModels = customModels;
                    this.privSpeechContext.getContext().phraseDetection = phraseDetection;
                }
                const translationVoice = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationVoice, undefined);
                if (translationVoice !== undefined) {
                    // Update translation actions for synthesis
                    translationContext.onSuccess = { action: OnSuccess_js_1.NextAction.Synthesize };
                    translationContext.onPassthrough = { action: OnSuccess_js_1.NextAction.Synthesize };
                }
            }
        }
    }
    noOp() {
        // operation not supported
        return;
    }
    // Encapsulated for derived service recognizers that need to send additional JSON
    async sendPrePayloadJSON(connection, generateNewRequestId = true) {
        if (this.sendPrePayloadJSONOverride !== undefined) {
            return this.sendPrePayloadJSONOverride(connection);
        }
        await this.sendSpeechContext(connection, generateNewRequestId);
        await this.sendWaveHeader(connection);
        return;
    }
    async sendWaveHeader(connection) {
        const format = await this.audioSource.format;
        // this.writeBufferToConsole(format.header);
        return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Binary, "audio", this.privRequestSession.requestId, "audio/x-wav", format.header));
    }
    // Establishes a websocket connection to the end point.
    connectImpl() {
        if (this.privConnectionPromise !== undefined) {
            return this.privConnectionPromise.then((connection) => {
                if (connection.state() === Exports_js_2.ConnectionState.Disconnected) {
                    this.privConnectionId = null;
                    this.privConnectionPromise = undefined;
                    this.privServiceHasSentMessage = false;
                    return this.connectImpl();
                }
                return this.privConnectionPromise;
            }, () => {
                this.privConnectionId = null;
                this.privConnectionPromise = undefined;
                this.privServiceHasSentMessage = false;
                return this.connectImpl();
            });
        }
        this.privConnectionPromise = this.retryableConnect();
        // Attach an empty handler to allow the promise to run in the background while
        // other startup events happen. It'll eventually be awaited on.
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        this.privConnectionPromise.catch(() => { });
        if (this.postConnectImplOverride !== undefined) {
            return this.postConnectImplOverride(this.privConnectionPromise);
        }
        return this.privConnectionPromise;
    }
    sendSpeechServiceConfig(connection, requestSession, SpeechServiceConfigJson) {
        requestSession.onSpeechContext();
        // filter out anything that is not required for the service to work.
        if (ServiceRecognizerBase.telemetryDataEnabled !== true) {
            const withTelemetry = JSON.parse(SpeechServiceConfigJson);
            const replacement = {
                context: {
                    system: withTelemetry.context.system,
                },
            };
            SpeechServiceConfigJson = JSON.stringify(replacement);
        }
        if (this.privRecognizerConfig.parameters.getProperty("f0f5debc-f8c9-4892-ac4b-90a7ab359fd2", "false").toLowerCase() === "true") {
            const json = JSON.parse(SpeechServiceConfigJson);
            json.context.DisableReferenceChannel = "True";
            json.context.MicSpec = "1_0_0";
            SpeechServiceConfigJson = JSON.stringify(json);
        }
        if (SpeechServiceConfigJson) {
            return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Text, "speech.config", requestSession.requestId, "application/json", SpeechServiceConfigJson));
        }
        return;
    }
    async fetchConnection() {
        if (this.privConnectionConfigurationPromise !== undefined) {
            return this.privConnectionConfigurationPromise.then((connection) => {
                if (connection.state() === Exports_js_2.ConnectionState.Disconnected) {
                    this.privConnectionId = null;
                    this.privConnectionConfigurationPromise = undefined;
                    this.privServiceHasSentMessage = false;
                    return this.fetchConnection();
                }
                return this.privConnectionConfigurationPromise;
            }, () => {
                this.privConnectionId = null;
                this.privConnectionConfigurationPromise = undefined;
                this.privServiceHasSentMessage = false;
                return this.fetchConnection();
            });
        }
        this.privConnectionConfigurationPromise = this.configureConnection();
        return await this.privConnectionConfigurationPromise;
    }
    async sendAudio(audioStreamNode) {
        const audioFormat = await this.audioSource.format;
        this.privAverageBytesPerMs = audioFormat.avgBytesPerSec / 1000;
        // The time we last sent data to the service.
        let nextSendTime = Date.now();
        // Max amount to send before we start to throttle
        const fastLaneSizeMs = this.privRecognizerConfig.parameters.getProperty("SPEECH-TransmitLengthBeforThrottleMs", "5000");
        const maxSendUnthrottledBytes = audioFormat.avgBytesPerSec / 1000 * parseInt(fastLaneSizeMs, 10);
        const startRecogNumber = this.privRequestSession.recogNumber;
        const readAndUploadCycle = async () => {
            // If speech is done, stop sending audio.
            if (!this.privIsDisposed &&
                !this.privRequestSession.isSpeechEnded &&
                this.privRequestSession.isRecognizing &&
                this.privRequestSession.recogNumber === startRecogNumber) {
                const connection = await this.fetchConnection();
                const audioStreamChunk = await audioStreamNode.read();
                // we have a new audio chunk to upload.
                if (this.privRequestSession.isSpeechEnded) {
                    // If service already recognized audio end then don't send any more audio
                    return;
                }
                let payload;
                let sendDelay;
                if (!audioStreamChunk || audioStreamChunk.isEnd) {
                    payload = null;
                    sendDelay = 0;
                }
                else {
                    payload = audioStreamChunk.buffer;
                    this.privRequestSession.onAudioSent(payload.byteLength);
                    if (maxSendUnthrottledBytes >= this.privRequestSession.bytesSent) {
                        sendDelay = 0;
                    }
                    else {
                        sendDelay = Math.max(0, nextSendTime - Date.now());
                    }
                }
                if (0 !== sendDelay) {
                    await this.delay(sendDelay);
                }
                if (payload !== null) {
                    nextSendTime = Date.now() + (payload.byteLength * 1000 / (audioFormat.avgBytesPerSec * 2));
                }
                // Are we still alive?
                if (!this.privIsDisposed &&
                    !this.privRequestSession.isSpeechEnded &&
                    this.privRequestSession.isRecognizing &&
                    this.privRequestSession.recogNumber === startRecogNumber) {
                    connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Binary, "audio", this.privRequestSession.requestId, null, payload)).catch(() => {
                        // eslint-disable-next-line @typescript-eslint/no-empty-function
                        this.privRequestSession.onServiceTurnEndResponse(this.privRecognizerConfig.isContinuousRecognition).catch(() => { });
                    });
                    if (!audioStreamChunk?.isEnd) {
                        // this.writeBufferToConsole(payload);
                        // Regardless of success or failure, schedule the next upload.
                        // If the underlying connection was broken, the next cycle will
                        // get a new connection and re-transmit missing audio automatically.
                        return readAndUploadCycle();
                    }
                    else {
                        // the audio stream has been closed, no need to schedule next
                        // read-upload cycle.
                        if (!this.privIsLiveAudio) {
                            this.privRequestSession.onSpeechEnded();
                        }
                    }
                }
            }
        };
        return readAndUploadCycle();
    }
    async retryableConnect() {
        let isUnAuthorized = false;
        this.privAuthFetchEventId = (0, Exports_js_2.createNoDashGuid)();
        const sessionId = this.privRequestSession.sessionId;
        this.privConnectionId = (sessionId !== undefined) ? sessionId : (0, Exports_js_2.createNoDashGuid)();
        this.privRequestSession.onPreConnectionStart(this.privAuthFetchEventId, this.privConnectionId);
        let lastStatusCode = 0;
        let lastReason = "";
        while (this.privRequestSession.numConnectionAttempts <= this.privRecognizerConfig.maxRetryCount) {
            this.privRequestSession.onRetryConnection();
            // Get the auth information for the connection. This is a bit of overkill for the current API surface, but leaving the plumbing in place to be able to raise a developer-customer
            // facing event when a connection fails to let them try and provide new auth information.
            const authPromise = isUnAuthorized ? this.privAuthentication.fetchOnExpiry(this.privAuthFetchEventId) : this.privAuthentication.fetch(this.privAuthFetchEventId);
            const auth = await authPromise;
            await this.privRequestSession.onAuthCompleted(false);
            // Create the connection
            const connection = await this.privConnectionFactory.create(this.privRecognizerConfig, auth, this.privConnectionId);
            // Attach the telemetry handlers.
            this.privRequestSession.listenForServiceTelemetry(connection.events);
            // Attach to the underlying event. No need to hold onto the detach pointers as in the event the connection goes away,
            // it'll stop sending events.
            connection.events.attach((event) => {
                this.connectionEvents.onEvent(event);
            });
            const response = await connection.open();
            // 200 == everything is fine.
            if (response.statusCode === 200) {
                await this.privRequestSession.onConnectionEstablishCompleted(response.statusCode);
                return Promise.resolve(connection);
            }
            else if (response.statusCode === 1006) {
                isUnAuthorized = true;
            }
            lastStatusCode = response.statusCode;
            lastReason = response.reason;
        }
        await this.privRequestSession.onConnectionEstablishCompleted(lastStatusCode, lastReason);
        return Promise.reject(`Unable to contact server. StatusCode: ${lastStatusCode}, ${this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_Endpoint)} Reason: ${lastReason}`);
    }
    delay(delayMs) {
        return new Promise((resolve) => this.privSetTimeout(resolve, delayMs));
    }
    writeBufferToConsole(buffer) {
        let out = "Buffer Size: ";
        if (null === buffer) {
            out += "null";
        }
        else {
            const readView = new Uint8Array(buffer);
            out += `${buffer.byteLength}\r\n`;
            for (let i = 0; i < buffer.byteLength; i++) {
                out += readView[i].toString(16).padStart(2, "0") + " ";
                if (((i + 1) % 16) === 0) {
                    // eslint-disable-next-line no-console
                    console.info(out);
                    out = "";
                }
            }
        }
        // eslint-disable-next-line no-console
        console.info(out);
    }
    async sendFinalAudio() {
        const connection = await this.fetchConnection();
        await connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Binary, "audio", this.privRequestSession.requestId, null, null));
        return;
    }
    // Takes an established websocket connection to the endpoint and sends speech configuration information.
    async configureConnection() {
        const connection = await this.connectImpl();
        if (this.configConnectionOverride !== undefined) {
            return this.configConnectionOverride(connection);
        }
        await this.sendSpeechServiceConfig(connection, this.privRequestSession, this.privRecognizerConfig.SpeechServiceConfig.serialize());
        await this.sendPrePayloadJSON(connection, false);
        return connection;
    }
}
exports.ServiceRecognizerBase = ServiceRecognizerBase;
ServiceRecognizerBase.telemetryDataEnabled = true;

//# sourceMappingURL=ServiceRecognizerBase.js.map
