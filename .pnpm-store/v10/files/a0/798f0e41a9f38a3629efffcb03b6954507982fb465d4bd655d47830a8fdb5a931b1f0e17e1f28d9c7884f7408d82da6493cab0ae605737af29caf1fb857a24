"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationServiceRecognizer = void 0;
const Exports_js_1 = require("../common/Exports.js");
const Exports_js_2 = require("../sdk/Exports.js");
const Exports_js_3 = require("./Exports.js");
// eslint-disable-next-line max-classes-per-file
class TranslationServiceRecognizer extends Exports_js_3.ConversationServiceRecognizer {
    constructor(authentication, connectionFactory, audioSource, recognizerConfig, translationRecognizer) {
        super(authentication, connectionFactory, audioSource, recognizerConfig, translationRecognizer);
        this.privTranslationRecognizer = translationRecognizer;
        this.connectionEvents.attach((connectionEvent) => {
            if (connectionEvent.name === "ConnectionEstablishedEvent") {
                this.privTranslationRecognizer.onConnection();
            }
        });
    }
    async processTypeSpecificMessages(connectionMessage) {
        const resultProps = new Exports_js_2.PropertyCollection();
        let processed = await this.processSpeechMessages(connectionMessage);
        if (processed) {
            return true;
        }
        const handleTranslationPhrase = async (translatedPhrase) => {
            resultProps.setProperty(Exports_js_2.PropertyId.SpeechServiceResponse_JsonResult, translatedPhrase.asJson());
            this.privRequestSession.onPhraseRecognized(translatedPhrase.Offset + translatedPhrase.Duration);
            if (translatedPhrase.RecognitionStatus === Exports_js_3.RecognitionStatus.Success) {
                // OK, the recognition was successful. How'd the translation do?
                const result = this.fireEventForResult(translatedPhrase, resultProps);
                if (!!this.privTranslationRecognizer.recognized) {
                    try {
                        this.privTranslationRecognizer.recognized(this.privTranslationRecognizer, result);
                        /* eslint-disable no-empty */
                    }
                    catch (error) {
                        // Not going to let errors in the event handler
                        // trip things up.
                    }
                }
                // report result to promise.
                if (!!this.privSuccessCallback) {
                    try {
                        this.privSuccessCallback(result.result);
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
            else {
                const reason = Exports_js_3.EnumTranslation.implTranslateRecognitionResult(translatedPhrase.RecognitionStatus);
                const result = new Exports_js_2.TranslationRecognitionResult(undefined, this.privRequestSession.requestId, reason, translatedPhrase.Text, translatedPhrase.Duration, translatedPhrase.Offset, translatedPhrase.Language, translatedPhrase.Confidence, undefined, translatedPhrase.asJson(), resultProps);
                if (reason === Exports_js_2.ResultReason.Canceled) {
                    const cancelReason = Exports_js_3.EnumTranslation.implTranslateCancelResult(translatedPhrase.RecognitionStatus);
                    const cancellationErrorCode = Exports_js_3.EnumTranslation.implTranslateCancelErrorCode(translatedPhrase.RecognitionStatus);
                    await this.cancelRecognitionLocal(cancelReason, cancellationErrorCode, Exports_js_3.EnumTranslation.implTranslateErrorDetails(cancellationErrorCode));
                }
                else {
                    if (translatedPhrase.RecognitionStatus !== Exports_js_3.RecognitionStatus.EndOfDictation) {
                        const ev = new Exports_js_2.TranslationRecognitionEventArgs(result, result.offset, this.privRequestSession.sessionId);
                        if (!!this.privTranslationRecognizer.recognized) {
                            try {
                                this.privTranslationRecognizer.recognized(this.privTranslationRecognizer, ev);
                                /* eslint-disable no-empty */
                            }
                            catch (error) {
                                // Not going to let errors in the event handler
                                // trip things up.
                            }
                        }
                        // report result to promise.
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
                }
                processed = true;
            }
        };
        const handleTranslationHypothesis = (hypothesis) => {
            resultProps.setProperty(Exports_js_2.PropertyId.SpeechServiceResponse_JsonResult, hypothesis.asJson());
            const result = this.fireEventForResult(hypothesis, resultProps);
            this.privRequestSession.onHypothesis(result.offset);
            if (!!this.privTranslationRecognizer.recognizing) {
                try {
                    this.privTranslationRecognizer.recognizing(this.privTranslationRecognizer, result);
                    /* eslint-disable no-empty */
                }
                catch (error) {
                    // Not going to let errors in the event handler
                    // trip things up.
                }
            }
            processed = true;
        };
        if (connectionMessage.messageType === Exports_js_1.MessageType.Text) {
            resultProps.setProperty(Exports_js_2.PropertyId.SpeechServiceResponse_JsonResult, connectionMessage.textBody);
        }
        switch (connectionMessage.path.toLowerCase()) {
            case "translation.hypothesis":
                handleTranslationHypothesis(Exports_js_3.TranslationHypothesis.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset));
                break;
            case "translation.response":
                const phrase = JSON.parse(connectionMessage.textBody);
                if (!!phrase.SpeechPhrase) {
                    await handleTranslationPhrase(Exports_js_3.TranslationPhrase.fromTranslationResponse(phrase, this.privRequestSession.currentTurnAudioOffset));
                }
                else {
                    const hypothesis = JSON.parse(connectionMessage.textBody);
                    if (!!hypothesis.SpeechHypothesis) {
                        handleTranslationHypothesis(Exports_js_3.TranslationHypothesis.fromTranslationResponse(hypothesis, this.privRequestSession.currentTurnAudioOffset));
                    }
                }
                break;
            case "translation.phrase":
                await handleTranslationPhrase(Exports_js_3.TranslationPhrase.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset));
                break;
            case "translation.synthesis":
            case "audio":
                this.sendSynthesisAudio(connectionMessage.binaryBody, this.privRequestSession.sessionId);
                processed = true;
                break;
            case "audio.end":
            case "translation.synthesis.end":
                const synthEnd = Exports_js_3.TranslationSynthesisEnd.fromJSON(connectionMessage.textBody);
                switch (synthEnd.SynthesisStatus) {
                    case Exports_js_3.SynthesisStatus.Error:
                        if (!!this.privTranslationRecognizer.synthesizing) {
                            const result = new Exports_js_2.TranslationSynthesisResult(Exports_js_2.ResultReason.Canceled, undefined);
                            const retEvent = new Exports_js_2.TranslationSynthesisEventArgs(result, this.privRequestSession.sessionId);
                            try {
                                this.privTranslationRecognizer.synthesizing(this.privTranslationRecognizer, retEvent);
                                /* eslint-disable no-empty */
                            }
                            catch (error) {
                                // Not going to let errors in the event handler
                                // trip things up.
                            }
                        }
                        if (!!this.privTranslationRecognizer.canceled) {
                            // And raise a canceled event to send the rich(er) error message back.
                            const canceledResult = new Exports_js_2.TranslationRecognitionCanceledEventArgs(this.privRequestSession.sessionId, Exports_js_2.CancellationReason.Error, synthEnd.FailureReason, Exports_js_2.CancellationErrorCode.ServiceError, null);
                            try {
                                this.privTranslationRecognizer.canceled(this.privTranslationRecognizer, canceledResult);
                                /* eslint-disable no-empty */
                            }
                            catch (error) {
                                // Not going to let errors in the event handler
                                // trip things up.
                            }
                        }
                        break;
                    case Exports_js_3.SynthesisStatus.Success:
                        this.sendSynthesisAudio(undefined, this.privRequestSession.sessionId);
                        break;
                    default:
                        break;
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
        const properties = new Exports_js_2.PropertyCollection();
        properties.setProperty(Exports_js_3.CancellationErrorCodePropertyName, Exports_js_2.CancellationErrorCode[errorCode]);
        if (!!this.privTranslationRecognizer.canceled) {
            const cancelEvent = new Exports_js_2.TranslationRecognitionCanceledEventArgs(sessionId, cancellationReason, error, errorCode, undefined);
            try {
                this.privTranslationRecognizer.canceled(this.privTranslationRecognizer, cancelEvent);
                /* eslint-disable no-empty */
            }
            catch { }
        }
        if (!!this.privSuccessCallback) {
            const result = new Exports_js_2.TranslationRecognitionResult(undefined, // Translations
            requestId, Exports_js_2.ResultReason.Canceled, undefined, // Text
            undefined, // Druation
            undefined, // Offset
            undefined, // Language
            undefined, // LanguageDetectionConfidence
            error, undefined, // Json
            properties);
            try {
                this.privSuccessCallback(result);
                /* eslint-disable no-empty */
                this.privSuccessCallback = undefined;
            }
            catch { }
        }
    }
    handleRecognizingCallback(result, offset, sessionId) {
        try {
            const ev = new Exports_js_2.TranslationRecognitionEventArgs(Exports_js_2.TranslationRecognitionResult.fromSpeechRecognitionResult(result), offset, sessionId);
            this.privTranslationRecognizer.recognizing(this.privTranslationRecognizer, ev);
            /* eslint-disable no-empty */
        }
        catch (error) {
            // Not going to let errors in the event handler
            // trip things up.
        }
    }
    handleRecognizedCallback(result, offset, sessionId) {
        try {
            const ev = new Exports_js_2.TranslationRecognitionEventArgs(Exports_js_2.TranslationRecognitionResult.fromSpeechRecognitionResult(result), offset, sessionId);
            this.privTranslationRecognizer.recognized(this.privTranslationRecognizer, ev);
        }
        catch (error) {
            // Not going to let errors in the event handler
            // trip things up.
        }
    }
    fireEventForResult(serviceResult, properties) {
        let translations;
        if (undefined !== serviceResult.Translation.Translations) {
            translations = new Exports_js_2.Translations();
            for (const translation of serviceResult.Translation.Translations) {
                translations.set(translation.Language, translation.Text || translation.DisplayText);
            }
        }
        let resultReason;
        let confidence;
        if (serviceResult instanceof Exports_js_3.TranslationPhrase) {
            if (!!serviceResult.Translation && serviceResult.Translation.TranslationStatus === Exports_js_1.TranslationStatus.Success) {
                resultReason = Exports_js_2.ResultReason.TranslatedSpeech;
            }
            else {
                resultReason = Exports_js_2.ResultReason.RecognizedSpeech;
            }
            confidence = serviceResult.Confidence;
        }
        else {
            resultReason = Exports_js_2.ResultReason.TranslatingSpeech;
        }
        const language = serviceResult.Language;
        const result = new Exports_js_2.TranslationRecognitionResult(translations, this.privRequestSession.requestId, resultReason, serviceResult.Text, serviceResult.Duration, serviceResult.Offset, language, confidence, serviceResult.Translation.FailureReason, serviceResult.asJson(), properties);
        const ev = new Exports_js_2.TranslationRecognitionEventArgs(result, serviceResult.Offset, this.privRequestSession.sessionId);
        return ev;
    }
    sendSynthesisAudio(audio, sessionId) {
        const reason = (undefined === audio) ? Exports_js_2.ResultReason.SynthesizingAudioCompleted : Exports_js_2.ResultReason.SynthesizingAudio;
        const result = new Exports_js_2.TranslationSynthesisResult(reason, audio);
        const retEvent = new Exports_js_2.TranslationSynthesisEventArgs(result, sessionId);
        if (!!this.privTranslationRecognizer.synthesizing) {
            try {
                this.privTranslationRecognizer.synthesizing(this.privTranslationRecognizer, retEvent);
                /* eslint-disable no-empty */
            }
            catch (error) {
                // Not going to let errors in the event handler
                // trip things up.
            }
        }
    }
}
exports.TranslationServiceRecognizer = TranslationServiceRecognizer;

//# sourceMappingURL=TranslationServiceRecognizer.js.map
