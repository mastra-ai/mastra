"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationTranscriptionServiceRecognizer = void 0;
const Exports_js_1 = require("../sdk/Exports.js");
const Exports_js_2 = require("./Exports.js");
const SpeakerDiarization_js_1 = require("./ServiceMessages/PhraseDetection/SpeakerDiarization.js");
const PhraseDetectionContext_js_1 = require("./ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
// eslint-disable-next-line max-classes-per-file
class ConversationTranscriptionServiceRecognizer extends Exports_js_2.ServiceRecognizerBase {
    constructor(authentication, connectionFactory, audioSource, recognizerConfig, conversationTranscriber) {
        super(authentication, connectionFactory, audioSource, recognizerConfig, conversationTranscriber);
        this.privConversationTranscriber = conversationTranscriber;
        this.setSpeakerDiarizationJson();
    }
    setSpeakerDiarizationJson() {
        if (this.privEnableSpeakerId) {
            const phraseDetection = this.privSpeechContext.getContext().phraseDetection || {};
            phraseDetection.mode = PhraseDetectionContext_js_1.RecognitionMode.Conversation;
            const speakerDiarization = {};
            speakerDiarization.mode = SpeakerDiarization_js_1.SpeakerDiarizationMode.Anonymous;
            speakerDiarization.audioSessionId = this.privDiarizationSessionId;
            speakerDiarization.audioOffsetMs = 0;
            speakerDiarization.diarizeIntermediates = this.privRecognizerConfig.parameters.getProperty(Exports_js_1.PropertyId.SpeechServiceResponse_DiarizeIntermediateResults, "false") === "true";
            phraseDetection.speakerDiarization = speakerDiarization;
            this.privSpeechContext.getContext().phraseDetection = phraseDetection;
        }
    }
    async processTypeSpecificMessages(connectionMessage) {
        let result;
        const resultProps = new Exports_js_1.PropertyCollection();
        resultProps.setProperty(Exports_js_1.PropertyId.SpeechServiceResponse_JsonResult, connectionMessage.textBody);
        let processed = false;
        switch (connectionMessage.path.toLowerCase()) {
            case "speech.hypothesis":
            case "speech.fragment":
                const hypothesis = Exports_js_2.SpeechHypothesis.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset);
                result = new Exports_js_1.ConversationTranscriptionResult(this.privRequestSession.requestId, Exports_js_1.ResultReason.RecognizingSpeech, hypothesis.Text, hypothesis.Duration, hypothesis.Offset, hypothesis.Language, hypothesis.LanguageDetectionConfidence, hypothesis.SpeakerId, undefined, hypothesis.asJson(), resultProps);
                this.privRequestSession.onHypothesis(hypothesis.Offset);
                const ev = new Exports_js_1.ConversationTranscriptionEventArgs(result, hypothesis.Duration, this.privRequestSession.sessionId);
                if (!!this.privConversationTranscriber.transcribing) {
                    try {
                        this.privConversationTranscriber.transcribing(this.privConversationTranscriber, ev);
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
                const resultReason = Exports_js_2.EnumTranslation.implTranslateRecognitionResult(simple.RecognitionStatus);
                this.privRequestSession.onPhraseRecognized(simple.Offset + simple.Duration);
                if (Exports_js_1.ResultReason.Canceled === resultReason) {
                    const cancelReason = Exports_js_2.EnumTranslation.implTranslateCancelResult(simple.RecognitionStatus);
                    const cancellationErrorCode = Exports_js_2.EnumTranslation.implTranslateCancelErrorCode(simple.RecognitionStatus);
                    await this.cancelRecognitionLocal(cancelReason, cancellationErrorCode, Exports_js_2.EnumTranslation.implTranslateErrorDetails(cancellationErrorCode));
                }
                else {
                    if (!(this.privRequestSession.isSpeechEnded && resultReason === Exports_js_1.ResultReason.NoMatch && simple.RecognitionStatus !== Exports_js_2.RecognitionStatus.InitialSilenceTimeout)) {
                        if (this.privRecognizerConfig.parameters.getProperty(Exports_js_2.OutputFormatPropertyName) === Exports_js_1.OutputFormat[Exports_js_1.OutputFormat.Simple]) {
                            result = new Exports_js_1.ConversationTranscriptionResult(this.privRequestSession.requestId, resultReason, simple.DisplayText, simple.Duration, simple.Offset, simple.Language, simple.LanguageDetectionConfidence, simple.SpeakerId, undefined, simple.asJson(), resultProps);
                        }
                        else {
                            const detailed = Exports_js_2.DetailedSpeechPhrase.fromJSON(connectionMessage.textBody, this.privRequestSession.currentTurnAudioOffset);
                            result = new Exports_js_1.ConversationTranscriptionResult(this.privRequestSession.requestId, resultReason, detailed.RecognitionStatus === Exports_js_2.RecognitionStatus.Success ? detailed.NBest[0].Display : undefined, detailed.Duration, detailed.Offset, detailed.Language, detailed.LanguageDetectionConfidence, simple.SpeakerId, undefined, detailed.asJson(), resultProps);
                        }
                        const event = new Exports_js_1.ConversationTranscriptionEventArgs(result, result.offset, this.privRequestSession.sessionId);
                        if (!!this.privConversationTranscriber.transcribed) {
                            try {
                                this.privConversationTranscriber.transcribed(this.privConversationTranscriber, event);
                                /* eslint-disable no-empty */
                            }
                            catch (error) {
                                // Not going to let errors in the event handler
                                // trip things up.
                            }
                        }
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
        if (!!this.privConversationTranscriber.canceled) {
            const cancelEvent = new Exports_js_1.ConversationTranscriptionCanceledEventArgs(cancellationReason, error, errorCode, undefined, sessionId);
            try {
                this.privConversationTranscriber.canceled(this.privConversationTranscriber, cancelEvent);
                /* eslint-disable no-empty */
            }
            catch { }
        }
    }
}
exports.ConversationTranscriptionServiceRecognizer = ConversationTranscriptionServiceRecognizer;

//# sourceMappingURL=ConversationTranscriptionServiceRecognizer.js.map
