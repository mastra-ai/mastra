"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechContext = void 0;
const PhraseDetectionContext_js_1 = require("./ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
const PhraseOutput_js_1 = require("./ServiceMessages/PhraseOutput/PhraseOutput.js");
/**
 * Represents the JSON used in the speech.context message sent to the speech service.
 * The dynamic grammar is always refreshed from the encapsulated dynamic grammar object.
 */
class SpeechContext {
    constructor(dynamicGrammar) {
        this.privContext = {};
        this.privDynamicGrammar = dynamicGrammar;
    }
    getContext() {
        return this.privContext;
    }
    /**
     * @Internal
     * This is only used by pronunciation assessment config.
     * Do not use externally, object returned will change without warning or notice.
     */
    setPronunciationAssessmentParams(params, isSpeakerDiarizationEnabled = false) {
        if (this.privContext.phraseDetection === undefined) {
            this.privContext.phraseDetection = {
                enrichment: {
                    pronunciationAssessment: {}
                }
            };
        }
        if (this.privContext.phraseDetection.enrichment === undefined) {
            this.privContext.phraseDetection.enrichment = {
                pronunciationAssessment: {}
            };
        }
        this.privContext.phraseDetection.enrichment.pronunciationAssessment = JSON.parse(params) || {};
        if (isSpeakerDiarizationEnabled) {
            this.privContext.phraseDetection.mode = PhraseDetectionContext_js_1.RecognitionMode.Conversation;
        }
        this.setWordLevelTimings();
        this.privContext.phraseOutput.detailed.options.push(PhraseOutput_js_1.PhraseOption.PronunciationAssessment);
        if (this.privContext.phraseOutput.detailed.options.indexOf(PhraseOutput_js_1.PhraseOption.SNR) === -1) {
            this.privContext.phraseOutput.detailed.options.push(PhraseOutput_js_1.PhraseOption.SNR);
        }
    }
    setDetailedOutputFormat() {
        if (this.privContext.phraseOutput === undefined) {
            this.privContext.phraseOutput = {
                detailed: {
                    options: []
                }
            };
        }
        if (this.privContext.phraseOutput.detailed === undefined) {
            this.privContext.phraseOutput.detailed = {
                options: []
            };
        }
        this.privContext.phraseOutput.format = PhraseOutput_js_1.OutputFormat.Detailed;
    }
    setWordLevelTimings() {
        if (this.privContext.phraseOutput === undefined) {
            this.privContext.phraseOutput = {
                detailed: {
                    options: []
                }
            };
        }
        if (this.privContext.phraseOutput.detailed === undefined) {
            this.privContext.phraseOutput.detailed = {
                options: []
            };
        }
        this.privContext.phraseOutput.format = PhraseOutput_js_1.OutputFormat.Detailed;
        if (this.privContext.phraseOutput.detailed.options.indexOf(PhraseOutput_js_1.PhraseOption.WordTimings) === -1) {
            this.privContext.phraseOutput.detailed.options.push(PhraseOutput_js_1.PhraseOption.WordTimings);
        }
    }
    setSpeakerDiarizationAudioOffsetMs(audioOffsetMs) {
        this.privContext.phraseDetection.speakerDiarization.audioOffsetMs = audioOffsetMs;
    }
    toJSON() {
        const dgi = this.privDynamicGrammar.generateGrammarObject();
        this.privContext.dgi = dgi;
        const ret = JSON.stringify(this.privContext);
        return ret;
    }
}
exports.SpeechContext = SpeechContext;

//# sourceMappingURL=SpeechContext.js.map
