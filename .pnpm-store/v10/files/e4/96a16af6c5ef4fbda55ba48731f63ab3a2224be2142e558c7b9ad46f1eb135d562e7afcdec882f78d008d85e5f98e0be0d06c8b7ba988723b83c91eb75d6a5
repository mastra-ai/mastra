"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechServiceRecognizer = void 0;
const Exports_js_1 = require("../sdk/Exports.js");
const Exports_js_2 = require("./Exports.js");
// eslint-disable-next-line max-classes-per-file
class SpeechServiceRecognizer extends Exports_js_2.ServiceRecognizerBase {
    constructor(authentication, connectionFactory, audioSource, recognizerConfig, speechRecognizer) {
        super(authentication, connectionFactory, audioSource, recognizerConfig, speechRecognizer);
        this.privSpeechRecognizer = speechRecognizer;
    }
    async processTypeSpecificMessages(connectionMessage) {
        let result;
        const resultProps = new Exports_js_1.PropertyCollection();
        let processed = false;
        switch (connectionMessage.path.toLowerCase()) {
            case "speech.hypothesis":
            case "speech.fragment":
                const hypothesis = Exports_js_2.SpeechHypothesis.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset);
                resultProps.setProperty(Exports_js_1.PropertyId.SpeechServiceResponse_JsonResult, hypothesis.asJson());
                result = new Exports_js_1.SpeechRecognitionResult(this.privRequestSession.requestId, Exports_js_1.ResultReason.RecognizingSpeech, hypothesis.Text, hypothesis.Duration, hypothesis.Offset, hypothesis.Language, hypothesis.LanguageDetectionConfidence, undefined, // Speaker Id
                undefined, hypothesis.asJson(), resultProps);
                this.privRequestSession.onHypothesis(hypothesis.Offset);
                const ev = new Exports_js_1.SpeechRecognitionEventArgs(result, hypothesis.Offset, this.privRequestSession.sessionId);
                if (!!this.privSpeechRecognizer.recognizing) {
                    try {
                        this.privSpeechRecognizer.recognizing(this.privSpeechRecognizer, ev);
                        /* eslint-disable no-empty */
                    }
                    catch (error) {
                        // Not going to let errors in the event handler
                        // trip things up.
                    }
                }
                processed = true;
                break;
            case "speech.phrase":
                const simple = Exports_js_2.SimpleSpeechPhrase.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset);
                resultProps.setProperty(Exports_js_1.PropertyId.SpeechServiceResponse_JsonResult, simple.asJson());
                const resultReason = Exports_js_2.EnumTranslation.implTranslateRecognitionResult(simple.RecognitionStatus, this.privExpectContentAssessmentResponse);
                this.privRequestSession.onPhraseRecognized(simple.Offset + simple.Duration);
                if (Exports_js_1.ResultReason.Canceled === resultReason) {
                    const cancelReason = Exports_js_2.EnumTranslation.implTranslateCancelResult(simple.RecognitionStatus);
                    const cancellationErrorCode = Exports_js_2.EnumTranslation.implTranslateCancelErrorCode(simple.RecognitionStatus);
                    await this.cancelRecognitionLocal(cancelReason, cancellationErrorCode, Exports_js_2.EnumTranslation.implTranslateErrorDetails(cancellationErrorCode));
                }
                else {
                    // Like the native SDK's, don't event / return an EndOfDictation message.
                    if (simple.RecognitionStatus === Exports_js_2.RecognitionStatus.EndOfDictation) {
                        break;
                    }
                    if (this.privRecognizerConfig.parameters.getProperty(Exports_js_2.OutputFormatPropertyName) === Exports_js_1.OutputFormat[Exports_js_1.OutputFormat.Simple]) {
                        result = new Exports_js_1.SpeechRecognitionResult(this.privRequestSession.requestId, resultReason, simple.DisplayText, simple.Duration, simple.Offset, simple.Language, simple.LanguageDetectionConfidence, undefined, // Speaker Id
                        undefined, simple.asJson(), resultProps);
                    }
                    else {
                        const detailed = Exports_js_2.DetailedSpeechPhrase.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset);
                        resultProps.setProperty(Exports_js_1.PropertyId.SpeechServiceResponse_JsonResult, detailed.asJson());
                        result = new Exports_js_1.SpeechRecognitionResult(this.privRequestSession.requestId, resultReason, detailed.RecognitionStatus === Exports_js_2.RecognitionStatus.Success ? detailed.NBest[0].Display : "", detailed.Duration, detailed.Offset, detailed.Language, detailed.LanguageDetectionConfidence, undefined, // Speaker Id
                        undefined, detailed.asJson(), resultProps);
                    }
                    const event = new Exports_js_1.SpeechRecognitionEventArgs(result, result.offset, this.privRequestSession.sessionId);
                    if (!!this.privSpeechRecognizer.recognized) {
                        try {
                            this.privSpeechRecognizer.recognized(this.privSpeechRecognizer, event);
                            /* eslint-disable no-empty */
                        }
                        catch (error) {
                            // Not going to let errors in the event handler
                            // trip things up.
                        }
                    }
                    if (!!this.privSuccessCallback) {
                        try {
                            this.privSuccessCallback(result);
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
                processed = true;
                break;
            default:
                break;
        }
        return processed;
    }
    // Cancels recognition.
    cancelRecognition(sessionId, requestId, cancellationReason, errorCode, error) {
        const properties = new Exports_js_1.PropertyCollection();
        properties.setProperty(Exports_js_2.CancellationErrorCodePropertyName, Exports_js_1.CancellationErrorCode[errorCode]);
        if (!!this.privSpeechRecognizer.canceled) {
            const cancelEvent = new Exports_js_1.SpeechRecognitionCanceledEventArgs(cancellationReason, error, errorCode, undefined, sessionId);
            try {
                this.privSpeechRecognizer.canceled(this.privSpeechRecognizer, cancelEvent);
                /* eslint-disable no-empty */
            }
            catch { }
        }
        if (!!this.privSuccessCallback) {
            const result = new Exports_js_1.SpeechRecognitionResult(requestId, Exports_js_1.ResultReason.Canceled, undefined, // Text
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
exports.SpeechServiceRecognizer = SpeechServiceRecognizer;

//# sourceMappingURL=SpeechServiceRecognizer.js.map
