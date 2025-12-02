"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationServiceRecognizer = void 0;
const Exports_js_1 = require("../sdk/Exports.js");
const Exports_js_2 = require("./Exports.js");
class ConversationServiceRecognizer extends Exports_js_2.ServiceRecognizerBase {
    constructor(authentication, connectionFactory, audioSource, recognizerConfig, recognizer) {
        super(authentication, connectionFactory, audioSource, recognizerConfig, recognizer);
        this.handleSpeechPhraseMessage = async (textBody) => this.handleSpeechPhrase(textBody);
        this.handleSpeechHypothesisMessage = (textBody) => this.handleSpeechHypothesis(textBody);
    }
    processTypeSpecificMessages(connectionMessage) {
        void connectionMessage;
        return;
    }
    handleRecognizedCallback(result, offset, sessionId) {
        void result;
        void offset;
        void sessionId;
        return;
    }
    handleRecognizingCallback(result, duration, sessionId) {
        void result;
        void duration;
        void sessionId;
        return;
    }
    async processSpeechMessages(connectionMessage) {
        let processed = false;
        switch (connectionMessage.path.toLowerCase()) {
            case "speech.hypothesis":
            case "speech.fragment":
                if (!!this.handleSpeechHypothesisMessage) {
                    this.handleSpeechHypothesisMessage(connectionMessage.textBody);
                }
                processed = true;
                break;
            case "speech.phrase":
                if (!!this.handleSpeechPhraseMessage) {
                    await this.handleSpeechPhraseMessage(connectionMessage.textBody);
                }
                processed = true;
                break;
            default:
                break;
        }
        return processed;
    }
    cancelRecognition(sessionId, requestId, cancellationReason, errorCode, error) {
        // Implementing to allow inheritance
        void sessionId;
        void requestId;
        void cancellationReason;
        void errorCode;
        void error;
    }
    async handleSpeechPhrase(textBody) {
        const simple = Exports_js_2.SimpleSpeechPhrase.fromJSON(textBody, this.privRequestSession.currentTurnAudioOffset);
        const resultReason = Exports_js_2.EnumTranslation.implTranslateRecognitionResult(simple.RecognitionStatus);
        let result;
        const resultProps = new Exports_js_1.PropertyCollection();
        resultProps.setProperty(Exports_js_1.PropertyId.SpeechServiceResponse_JsonResult, textBody);
        this.privRequestSession.onPhraseRecognized(simple.Offset + simple.Duration);
        if (Exports_js_1.ResultReason.Canceled === resultReason) {
            const cancelReason = Exports_js_2.EnumTranslation.implTranslateCancelResult(simple.RecognitionStatus);
            const cancellationErrorCode = Exports_js_2.EnumTranslation.implTranslateCancelErrorCode(simple.RecognitionStatus);
            await this.cancelRecognitionLocal(cancelReason, cancellationErrorCode, Exports_js_2.EnumTranslation.implTranslateErrorDetails(cancellationErrorCode));
        }
        else {
            if (simple.RecognitionStatus !== Exports_js_2.RecognitionStatus.EndOfDictation) {
                if (this.privRecognizerConfig.parameters.getProperty(Exports_js_2.OutputFormatPropertyName) === Exports_js_1.OutputFormat[Exports_js_1.OutputFormat.Simple]) {
                    result = new Exports_js_1.SpeechRecognitionResult(this.privRequestSession.requestId, resultReason, simple.DisplayText, simple.Duration, simple.Offset, simple.Language, simple.LanguageDetectionConfidence, simple.SpeakerId, undefined, simple.asJson(), resultProps);
                }
                else {
                    const detailed = Exports_js_2.DetailedSpeechPhrase.fromJSON(textBody, this.privRequestSession.currentTurnAudioOffset);
                    result = new Exports_js_1.SpeechRecognitionResult(this.privRequestSession.requestId, resultReason, detailed.Text, detailed.Duration, detailed.Offset, detailed.Language, detailed.LanguageDetectionConfidence, detailed.SpeakerId, undefined, detailed.asJson(), resultProps);
                }
                this.handleRecognizedCallback(result, result.offset, this.privRequestSession.sessionId);
            }
        }
    }
    handleSpeechHypothesis(textBody) {
        const hypothesis = Exports_js_2.SpeechHypothesis.fromJSON(textBody, this.privRequestSession.currentTurnAudioOffset);
        const resultProps = new Exports_js_1.PropertyCollection();
        resultProps.setProperty(Exports_js_1.PropertyId.SpeechServiceResponse_JsonResult, textBody);
        const result = new Exports_js_1.SpeechRecognitionResult(this.privRequestSession.requestId, Exports_js_1.ResultReason.RecognizingSpeech, hypothesis.Text, hypothesis.Duration, hypothesis.Offset, hypothesis.Language, hypothesis.LanguageDetectionConfidence, hypothesis.SpeakerId, undefined, hypothesis.asJson(), resultProps);
        this.privRequestSession.onHypothesis(hypothesis.Offset);
        this.handleRecognizingCallback(result, hypothesis.Duration, this.privRequestSession.sessionId);
    }
}
exports.ConversationServiceRecognizer = ConversationServiceRecognizer;

//# sourceMappingURL=ConversationServiceRecognizer.js.map
