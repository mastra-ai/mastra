"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeakerServiceRecognizer = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
const Exports_js_3 = require("../sdk/Exports.js");
const Exports_js_4 = require("./Exports.js");
const SpeechConnectionMessage_Internal_js_1 = require("./SpeechConnectionMessage.Internal.js");
// eslint-disable-next-line max-classes-per-file
class SpeakerServiceRecognizer extends Exports_js_4.ServiceRecognizerBase {
    constructor(authentication, connectionFactory, audioSource, recognizerConfig, recognizer) {
        super(authentication, connectionFactory, audioSource, recognizerConfig, recognizer);
        this.privSpeakerRecognizer = recognizer;
        this.privSpeakerAudioSource = audioSource;
        this.recognizeSpeaker = (model) => this.recognizeSpeakerOnce(model);
        this.sendPrePayloadJSONOverride = () => this.noOp();
    }
    processTypeSpecificMessages(connectionMessage) {
        let processed = false;
        const resultProps = new Exports_js_3.PropertyCollection();
        if (connectionMessage.messageType === Exports_js_2.MessageType.Text) {
            resultProps.setProperty(Exports_js_3.PropertyId.SpeechServiceResponse_JsonResult, connectionMessage.textBody);
        }
        switch (connectionMessage.path.toLowerCase()) {
            case "speaker.response":
                const response = JSON.parse(connectionMessage.textBody);
                let result;
                if (response.status.statusCode.toLowerCase() !== "success") {
                    result = new Exports_js_3.SpeakerRecognitionResult(response, Exports_js_3.ResultReason.Canceled, Exports_js_3.CancellationErrorCode.ServiceError, response.status.reason);
                }
                else {
                    result = new Exports_js_3.SpeakerRecognitionResult(response, Exports_js_3.ResultReason.RecognizedSpeaker);
                }
                if (!!this.privResultDeferral) {
                    this.privResultDeferral.resolve(result);
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
    cancelRecognition(sessionId, requestId, cancellationReason, errorCode, error) {
        const properties = new Exports_js_3.PropertyCollection();
        properties.setProperty(Exports_js_4.CancellationErrorCodePropertyName, Exports_js_3.CancellationErrorCode[errorCode]);
        if (!!this.privResultDeferral) {
            const result = new Exports_js_3.SpeakerRecognitionResult({
                scenario: this.privSpeakerModel.scenario,
                status: { statusCode: error, reason: error }
            }, Exports_js_3.ResultReason.Canceled, errorCode, error);
            try {
                this.privResultDeferral.resolve(result);
            }
            catch (error) {
                this.privResultDeferral.reject(error);
            }
        }
    }
    async recognizeSpeakerOnce(model) {
        this.privSpeakerModel = model;
        this.voiceProfileType = model.scenario;
        if (!this.privResultDeferral) {
            this.privResultDeferral = new Exports_js_2.Deferred();
        }
        this.privRequestSession.startNewRecognition();
        this.privRequestSession.listenForServiceTelemetry(this.privSpeakerAudioSource.events);
        this.privRecognizerConfig.parameters.setProperty(Exports_js_3.PropertyId.Speech_SessionId, this.privRequestSession.sessionId);
        // Start the connection to the service. The promise this will create is stored and will be used by configureConnection().
        const conPromise = this.connectImpl();
        const preAudioPromise = this.sendPreAudioMessages(this.extractSpeakerContext(model));
        const node = await this.privSpeakerAudioSource.attach(this.privRequestSession.audioNodeId);
        const format = await this.privSpeakerAudioSource.format;
        const deviceInfo = await this.privSpeakerAudioSource.deviceInfo;
        const audioNode = new Exports_js_1.ReplayableAudioNode(node, format.avgBytesPerSec);
        await this.privRequestSession.onAudioSourceAttachCompleted(audioNode, false);
        this.privRecognizerConfig.SpeechServiceConfig.Context.audio = { source: deviceInfo };
        try {
            await conPromise;
            await preAudioPromise;
        }
        catch (err) {
            this.cancelRecognition(this.privRequestSession.sessionId, this.privRequestSession.requestId, Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.ConnectionFailure, err);
        }
        const sessionStartEventArgs = new Exports_js_3.SessionEventArgs(this.privRequestSession.sessionId);
        if (!!this.privRecognizer.sessionStarted) {
            this.privRecognizer.sessionStarted(this.privRecognizer, sessionStartEventArgs);
        }
        void this.receiveMessage();
        const audioSendPromise = this.sendAudio(audioNode);
        // /* eslint-disable no-empty */
        audioSendPromise.then(() => { }, (error) => {
            this.cancelRecognition(this.privRequestSession.sessionId, this.privRequestSession.requestId, Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.RuntimeError, error);
        });
        return this.privResultDeferral.promise;
    }
    async sendPreAudioMessages(context) {
        const connection = await this.fetchConnection();
        await this.sendSpeakerRecognition(connection, context);
        // await this.sendWaveHeader(connection);
    }
    async sendSpeakerRecognition(connection, context) {
        const speakerContextJson = JSON.stringify(context);
        return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Text, "speaker.context", this.privRequestSession.requestId, "application/json; charset=utf-8", speakerContextJson));
    }
    extractSpeakerContext(model) {
        return {
            features: {
                interimResult: "enabled",
                progressiveDetection: "disabled",
            },
            profileIds: model.profileIds,
            scenario: model.scenario,
        };
    }
}
exports.SpeakerServiceRecognizer = SpeakerServiceRecognizer;

//# sourceMappingURL=SpeakerServiceRecognizer.js.map
