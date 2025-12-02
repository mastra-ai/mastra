"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialogServiceAdapter = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const DialogEvents_js_1 = require("../common/DialogEvents.js");
const Exports_js_2 = require("../common/Exports.js");
const AudioOutputFormat_js_1 = require("../sdk/Audio/AudioOutputFormat.js");
const Exports_js_3 = require("../sdk/Exports.js");
const DialogServiceTurnStateManager_js_1 = require("./DialogServiceTurnStateManager.js");
const Exports_js_4 = require("./Exports.js");
const ActivityResponsePayload_js_1 = require("./ServiceMessages/ActivityResponsePayload.js");
const InvocationSource_js_1 = require("./ServiceMessages/InvocationSource.js");
const KeywordDetection_js_1 = require("./ServiceMessages/KeywordDetection/KeywordDetection.js");
const SpeechConnectionMessage_Internal_js_1 = require("./SpeechConnectionMessage.Internal.js");
class DialogServiceAdapter extends Exports_js_4.ServiceRecognizerBase {
    constructor(authentication, connectionFactory, audioSource, recognizerConfig, dialogServiceConnector) {
        super(authentication, connectionFactory, audioSource, recognizerConfig, dialogServiceConnector);
        this.privEvents = new Exports_js_2.EventSource();
        this.privDialogServiceConnector = dialogServiceConnector;
        this.receiveMessageOverride = () => this.receiveDialogMessageOverride();
        this.privTurnStateManager = new DialogServiceTurnStateManager_js_1.DialogServiceTurnStateManager();
        this.recognizeOverride =
            (recoMode, successCallback, errorCallback) => this.listenOnce(recoMode, successCallback, errorCallback);
        this.postConnectImplOverride = (connection) => this.dialogConnectImpl(connection);
        this.configConnectionOverride = (connection) => this.configConnection(connection);
        this.disconnectOverride = () => this.privDisconnect();
        this.privDialogAudioSource = audioSource;
        this.agentConfigSent = false;
        this.privLastResult = null;
        this.connectionEvents.attach((connectionEvent) => {
            if (connectionEvent.name === "ConnectionClosedEvent") {
                this.terminateMessageLoop = true;
            }
        });
    }
    async sendMessage(message) {
        const interactionGuid = (0, Exports_js_2.createGuid)();
        const requestId = (0, Exports_js_2.createNoDashGuid)();
        const agentMessage = {
            context: {
                interactionId: interactionGuid
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            messagePayload: JSON.parse(message),
            version: 0.5
        };
        const agentMessageJson = JSON.stringify(agentMessage);
        const connection = await this.fetchConnection();
        await connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Text, "agent", requestId, "application/json", agentMessageJson));
    }
    async privDisconnect() {
        await this.cancelRecognition(this.privRequestSession.sessionId, this.privRequestSession.requestId, Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.NoError, "Disconnecting");
        this.terminateMessageLoop = true;
        this.agentConfigSent = false;
        return;
    }
    processTypeSpecificMessages(connectionMessage) {
        const resultProps = new Exports_js_3.PropertyCollection();
        if (connectionMessage.messageType === Exports_js_2.MessageType.Text) {
            resultProps.setProperty(Exports_js_3.PropertyId.SpeechServiceResponse_JsonResult, connectionMessage.textBody);
        }
        let result;
        let processed;
        switch (connectionMessage.path.toLowerCase()) {
            case "speech.phrase":
                const speechPhrase = Exports_js_4.SimpleSpeechPhrase.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset);
                this.privRequestSession.onPhraseRecognized(speechPhrase.Offset + speechPhrase.Duration);
                if (speechPhrase.RecognitionStatus !== Exports_js_4.RecognitionStatus.TooManyRequests && speechPhrase.RecognitionStatus !== Exports_js_4.RecognitionStatus.Error) {
                    const args = this.fireEventForResult(speechPhrase, resultProps);
                    this.privLastResult = args.result;
                    if (!!this.privDialogServiceConnector.recognized) {
                        try {
                            this.privDialogServiceConnector.recognized(this.privDialogServiceConnector, args);
                            /* eslint-disable no-empty */
                        }
                        catch (error) {
                            // Not going to let errors in the event handler
                            // trip things up.
                        }
                    }
                }
                processed = true;
                break;
            case "speech.hypothesis":
                const hypothesis = Exports_js_4.SpeechHypothesis.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset);
                result = new Exports_js_3.SpeechRecognitionResult(this.privRequestSession.requestId, Exports_js_3.ResultReason.RecognizingSpeech, hypothesis.Text, hypothesis.Duration, hypothesis.Offset, hypothesis.Language, hypothesis.LanguageDetectionConfidence, undefined, undefined, hypothesis.asJson(), resultProps);
                this.privRequestSession.onHypothesis(hypothesis.Offset);
                const ev = new Exports_js_3.SpeechRecognitionEventArgs(result, hypothesis.Offset, this.privRequestSession.sessionId);
                if (!!this.privDialogServiceConnector.recognizing) {
                    try {
                        this.privDialogServiceConnector.recognizing(this.privDialogServiceConnector, ev);
                        /* eslint-disable no-empty */
                    }
                    catch (error) {
                        // Not going to let errors in the event handler
                        // trip things up.
                    }
                }
                processed = true;
                break;
            case "speech.keyword":
                const keyword = Exports_js_4.SpeechKeyword.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset);
                result = new Exports_js_3.SpeechRecognitionResult(this.privRequestSession.requestId, keyword.Status === "Accepted" ? Exports_js_3.ResultReason.RecognizedKeyword : Exports_js_3.ResultReason.NoMatch, keyword.Text, keyword.Duration, keyword.Offset, undefined, undefined, undefined, undefined, keyword.asJson(), resultProps);
                if (keyword.Status !== "Accepted") {
                    this.privLastResult = result;
                }
                const event = new Exports_js_3.SpeechRecognitionEventArgs(result, result.duration, result.resultId);
                if (!!this.privDialogServiceConnector.recognized) {
                    try {
                        this.privDialogServiceConnector.recognized(this.privDialogServiceConnector, event);
                        /* eslint-disable no-empty */
                    }
                    catch (error) {
                        // Not going to let errors in the event handler
                        // trip things up.
                    }
                }
                processed = true;
                break;
            case "audio":
                {
                    const audioRequestId = connectionMessage.requestId.toUpperCase();
                    const turn = this.privTurnStateManager.GetTurn(audioRequestId);
                    try {
                        // Empty binary message signals end of stream.
                        if (!connectionMessage.binaryBody) {
                            turn.endAudioStream();
                        }
                        else {
                            turn.audioStream.write(connectionMessage.binaryBody);
                        }
                    }
                    catch (error) {
                        // Not going to let errors in the event handler
                        // trip things up.
                    }
                }
                processed = true;
                break;
            case "response":
                {
                    this.handleResponseMessage(connectionMessage);
                }
                processed = true;
                break;
            default:
                break;
        }
        const defferal = new Exports_js_2.Deferred();
        defferal.resolve(processed);
        return defferal.promise;
    }
    // Cancels recognition.
    async cancelRecognition(sessionId, requestId, cancellationReason, errorCode, error) {
        this.terminateMessageLoop = true;
        if (!!this.privRequestSession.isRecognizing) {
            await this.privRequestSession.onStopRecognizing();
        }
        if (!!this.privDialogServiceConnector.canceled) {
            const properties = new Exports_js_3.PropertyCollection();
            properties.setProperty(Exports_js_4.CancellationErrorCodePropertyName, Exports_js_3.CancellationErrorCode[errorCode]);
            const cancelEvent = new Exports_js_3.SpeechRecognitionCanceledEventArgs(cancellationReason, error, errorCode, undefined, sessionId);
            try {
                this.privDialogServiceConnector.canceled(this.privDialogServiceConnector, cancelEvent);
                /* eslint-disable no-empty */
            }
            catch { }
            if (!!this.privSuccessCallback) {
                const result = new Exports_js_3.SpeechRecognitionResult(undefined, // ResultId
                Exports_js_3.ResultReason.Canceled, undefined, // Text
                undefined, // Duration
                undefined, // Offset
                undefined, // Language
                undefined, // Language Detection Confidence
                undefined, // Speaker Id
                error, undefined, // Json
                properties);
                try {
                    this.privSuccessCallback(result);
                    this.privSuccessCallback = undefined;
                    /* eslint-disable no-empty */
                }
                catch { }
            }
        }
    }
    async listenOnce(recoMode, successCallback, errorCallback) {
        this.privRecognizerConfig.recognitionMode = recoMode;
        this.privSuccessCallback = successCallback;
        this.privErrorCallback = errorCallback;
        this.privRequestSession.startNewRecognition();
        this.privRequestSession.listenForServiceTelemetry(this.privDialogAudioSource.events);
        this.privRecognizerConfig.parameters.setProperty(Exports_js_3.PropertyId.Speech_SessionId, this.privRequestSession.sessionId);
        // Start the connection to the service. The promise this will create is stored and will be used by configureConnection().
        const conPromise = this.connectImpl();
        const preAudioPromise = this.sendPreAudioMessages();
        const node = await this.privDialogAudioSource.attach(this.privRequestSession.audioNodeId);
        const format = await this.privDialogAudioSource.format;
        const deviceInfo = await this.privDialogAudioSource.deviceInfo;
        const audioNode = new Exports_js_1.ReplayableAudioNode(node, format.avgBytesPerSec);
        await this.privRequestSession.onAudioSourceAttachCompleted(audioNode, false);
        this.privRecognizerConfig.SpeechServiceConfig.Context.audio = { source: deviceInfo };
        try {
            await conPromise;
            await preAudioPromise;
        }
        catch (error) {
            await this.cancelRecognition(this.privRequestSession.sessionId, this.privRequestSession.requestId, Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.ConnectionFailure, error);
            return Promise.resolve();
        }
        const sessionStartEventArgs = new Exports_js_3.SessionEventArgs(this.privRequestSession.sessionId);
        if (!!this.privRecognizer.sessionStarted) {
            this.privRecognizer.sessionStarted(this.privRecognizer, sessionStartEventArgs);
        }
        const audioSendPromise = this.sendAudio(audioNode);
        // /* eslint-disable no-empty */
        audioSendPromise.then(() => { }, async (error) => {
            await this.cancelRecognition(this.privRequestSession.sessionId, this.privRequestSession.requestId, Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.RuntimeError, error);
        });
    }
    // Establishes a websocket connection to the end point.
    dialogConnectImpl(connection) {
        this.privConnectionLoop = this.startMessageLoop();
        return connection;
    }
    receiveDialogMessageOverride() {
        // we won't rely on the cascading promises of the connection since we want to continually be available to receive messages
        const communicationCustodian = new Exports_js_2.Deferred();
        const loop = async () => {
            try {
                const isDisposed = this.isDisposed();
                const terminateMessageLoop = (!this.isDisposed() && this.terminateMessageLoop);
                if (isDisposed || terminateMessageLoop) {
                    // We're done.
                    communicationCustodian.resolve(undefined);
                    return;
                }
                const connection = await this.fetchConnection();
                const message = await connection.read();
                if (!message) {
                    return loop();
                }
                const connectionMessage = SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage.fromConnectionMessage(message);
                switch (connectionMessage.path.toLowerCase()) {
                    case "turn.start":
                        {
                            const turnRequestId = connectionMessage.requestId.toUpperCase();
                            const audioSessionReqId = this.privRequestSession.requestId.toUpperCase();
                            // turn started by the service
                            if (turnRequestId !== audioSessionReqId) {
                                this.privTurnStateManager.StartTurn(turnRequestId);
                            }
                            else {
                                this.privRequestSession.onServiceTurnStartResponse();
                            }
                        }
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
                        this.privRequestSession.onServiceRecognized(speechStopDetected.Offset);
                        const speechStopEventArgs = new Exports_js_3.RecognitionEventArgs(speechStopDetected.Offset, this.privRequestSession.sessionId);
                        if (!!this.privRecognizer.speechEndDetected) {
                            this.privRecognizer.speechEndDetected(this.privRecognizer, speechStopEventArgs);
                        }
                        break;
                    case "turn.end":
                        {
                            const turnEndRequestId = connectionMessage.requestId.toUpperCase();
                            const audioSessionReqId = this.privRequestSession.requestId.toUpperCase();
                            // turn started by the service
                            if (turnEndRequestId !== audioSessionReqId) {
                                this.privTurnStateManager.CompleteTurn(turnEndRequestId);
                            }
                            else {
                                // Audio session turn
                                const sessionStopEventArgs = new Exports_js_3.SessionEventArgs(this.privRequestSession.sessionId);
                                await this.privRequestSession.onServiceTurnEndResponse(false);
                                if (!this.privRecognizerConfig.isContinuousRecognition || this.privRequestSession.isSpeechEnded || !this.privRequestSession.isRecognizing) {
                                    if (!!this.privRecognizer.sessionStopped) {
                                        this.privRecognizer.sessionStopped(this.privRecognizer, sessionStopEventArgs);
                                    }
                                }
                                // report result to promise.
                                if (!!this.privSuccessCallback && this.privLastResult) {
                                    try {
                                        this.privSuccessCallback(this.privLastResult);
                                        this.privLastResult = null;
                                    }
                                    catch (e) {
                                        if (!!this.privErrorCallback) {
                                            this.privErrorCallback(e);
                                        }
                                    }
                                    // Only invoke the call back once.
                                    // and if it's successful don't invoke the
                                    // error after that.
                                    this.privSuccessCallback = undefined;
                                    this.privErrorCallback = undefined;
                                }
                            }
                        }
                        break;
                    default:
                        try {
                            const processed = await this.processTypeSpecificMessages(connectionMessage);
                            if (!processed) {
                                if (!!this.serviceEvents) {
                                    this.serviceEvents.onEvent(new Exports_js_2.ServiceEvent(connectionMessage.path.toLowerCase(), connectionMessage.textBody));
                                }
                            }
                        }
                        catch (e) {
                            //
                        }
                }
                const ret = loop();
                return ret;
            }
            catch (error) {
                this.terminateMessageLoop = true;
                communicationCustodian.resolve();
            }
        };
        loop().catch((reason) => {
            Exports_js_2.Events.instance.onEvent(new Exports_js_2.BackgroundEvent(reason));
        });
        return communicationCustodian.promise;
    }
    async startMessageLoop() {
        this.terminateMessageLoop = false;
        try {
            await this.receiveDialogMessageOverride();
        }
        catch (error) {
            await this.cancelRecognition(this.privRequestSession.sessionId, this.privRequestSession.requestId, Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.RuntimeError, error);
        }
        return Promise.resolve();
    }
    // Takes an established websocket connection to the endpoint and sends speech configuration information.
    async configConnection(connection) {
        if (this.terminateMessageLoop) {
            this.terminateMessageLoop = false;
            return Promise.reject("Connection to service terminated.");
        }
        await this.sendSpeechServiceConfig(connection, this.privRequestSession, this.privRecognizerConfig.SpeechServiceConfig.serialize());
        await this.sendAgentConfig(connection);
        return connection;
    }
    async sendPreAudioMessages() {
        const connection = await this.fetchConnection();
        this.addKeywordContextData();
        await this.sendSpeechContext(connection, true);
        await this.sendAgentContext(connection);
        await this.sendWaveHeader(connection);
    }
    sendAgentConfig(connection) {
        if (this.agentConfig && !this.agentConfigSent) {
            if (this.privRecognizerConfig
                .parameters
                .getProperty(Exports_js_3.PropertyId.Conversation_DialogType) === Exports_js_3.DialogServiceConfig.DialogTypes.CustomCommands) {
                const config = this.agentConfig.get();
                config.botInfo.commandsCulture = this.privRecognizerConfig.parameters.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage, "en-us");
                this.agentConfig.set(config);
            }
            this.onEvent(new DialogEvents_js_1.SendingAgentContextMessageEvent(this.agentConfig));
            const agentConfigJson = this.agentConfig.toJsonString();
            // guard against sending this multiple times on one connection
            this.agentConfigSent = true;
            return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Text, "agent.config", this.privRequestSession.requestId, "application/json", agentConfigJson));
        }
        return;
    }
    sendAgentContext(connection) {
        const guid = (0, Exports_js_2.createGuid)();
        const speechActivityTemplate = this.privDialogServiceConnector.properties.getProperty(Exports_js_3.PropertyId.Conversation_Speech_Activity_Template);
        const agentContext = {
            channelData: "",
            context: {
                interactionId: guid
            },
            messagePayload: typeof speechActivityTemplate === undefined ? undefined : speechActivityTemplate,
            version: 0.5
        };
        const agentContextJson = JSON.stringify(agentContext);
        return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Text, "speech.agent.context", this.privRequestSession.requestId, "application/json", agentContextJson));
    }
    fireEventForResult(serviceResult, properties) {
        const resultReason = Exports_js_4.EnumTranslation.implTranslateRecognitionResult(serviceResult.RecognitionStatus);
        const result = new Exports_js_3.SpeechRecognitionResult(this.privRequestSession.requestId, resultReason, serviceResult.DisplayText, serviceResult.Duration, serviceResult.Offset, serviceResult.Language, serviceResult.LanguageDetectionConfidence, undefined, undefined, serviceResult.asJson(), properties);
        const ev = new Exports_js_3.SpeechRecognitionEventArgs(result, serviceResult.Offset, this.privRequestSession.sessionId);
        return ev;
    }
    handleResponseMessage(responseMessage) {
        // "response" messages can contain either "message" (activity) or "MessageStatus" data. Fire the appropriate
        // event according to the message type that's specified.
        const responsePayload = JSON.parse(responseMessage.textBody);
        switch (responsePayload.messageType.toLowerCase()) {
            case "message":
                const responseRequestId = responseMessage.requestId.toUpperCase();
                const activityPayload = ActivityResponsePayload_js_1.ActivityPayloadResponse.fromJSON(responseMessage.textBody);
                const turn = this.privTurnStateManager.GetTurn(responseRequestId);
                // update the conversation Id
                if (activityPayload.conversationId) {
                    const updateAgentConfig = this.agentConfig.get();
                    updateAgentConfig.botInfo.conversationId = activityPayload.conversationId;
                    this.agentConfig.set(updateAgentConfig);
                }
                const pullAudioOutputStream = turn.processActivityPayload(activityPayload, AudioOutputFormat_js_1.AudioOutputFormatImpl.fromSpeechSynthesisOutputFormatString(this.privDialogServiceConnector.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_SynthOutputFormat, undefined)));
                const activity = new Exports_js_3.ActivityReceivedEventArgs(activityPayload.messagePayload, pullAudioOutputStream);
                if (!!this.privDialogServiceConnector.activityReceived) {
                    try {
                        this.privDialogServiceConnector.activityReceived(this.privDialogServiceConnector, activity);
                        /* eslint-disable-next-line no-empty */
                    }
                    catch (error) {
                        // Not going to let errors in the event handler
                        // trip things up.
                    }
                }
                break;
            case "messagestatus":
                if (!!this.privDialogServiceConnector.turnStatusReceived) {
                    try {
                        this.privDialogServiceConnector.turnStatusReceived(this.privDialogServiceConnector, new Exports_js_3.TurnStatusReceivedEventArgs(responseMessage.textBody));
                        /* eslint-disable-next-line no-empty */
                    }
                    catch (error) {
                        // Not going to let errors in the event handler
                        // trip things up.
                    }
                }
                break;
            default:
                Exports_js_2.Events.instance.onEvent(new Exports_js_2.BackgroundEvent(`Unexpected response of type ${responsePayload.messageType}. Ignoring.`));
                break;
        }
    }
    onEvent(event) {
        this.privEvents.onEvent(event);
        Exports_js_2.Events.instance.onEvent(event);
    }
    addKeywordContextData() {
        const keywordPropertyValue = this.privRecognizerConfig.parameters.getProperty("SPEECH-KeywordsToDetect");
        if (keywordPropertyValue === undefined) {
            return;
        }
        const keywordOffsetPropertyValue = this.privRecognizerConfig.parameters
            .getProperty("SPEECH-KeywordsToDetect-Offsets");
        const keywordDurationPropertyValue = this.privRecognizerConfig.parameters
            .getProperty("SPEECH-KeywordsToDetect-Durations");
        const keywords = keywordPropertyValue.split(";");
        const keywordOffsets = keywordOffsetPropertyValue === undefined ? [] : keywordOffsetPropertyValue.split(";");
        const keywordDurations = keywordDurationPropertyValue === undefined ? [] : keywordDurationPropertyValue.split(";");
        const keywordDefinitionArray = [];
        for (let i = 0; i < keywords.length; i++) {
            const definition = {
                text: keywords[i]
            };
            if (i < keywordOffsets.length) {
                definition.startOffset = Number(keywordOffsets[i]);
            }
            if (i < keywordDurations.length) {
                definition.duration = Number(keywordDurations[i]);
            }
            keywordDefinitionArray.push(definition);
        }
        this.speechContext.getContext().invocationSource = InvocationSource_js_1.InvocationSource.VoiceActivationWithKeyword;
        this.speechContext.getContext().keywordDetection = [{
                clientDetectedKeywords: keywordDefinitionArray,
                onReject: { action: KeywordDetection_js_1.OnRejectAction.EndOfTurn },
                type: KeywordDetection_js_1.KeywordDetectionType.StartTrigger
            }];
    }
}
exports.DialogServiceAdapter = DialogServiceAdapter;

//# sourceMappingURL=DialogServiceAdapter.js.map
