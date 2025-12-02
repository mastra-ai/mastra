"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesisContext = void 0;
const Exports_js_1 = require("../sdk/Exports.js");
/**
 * Represents the JSON used in the synthesis.context message sent to the speech service.
 * The dynamic grammar is always refreshed from the encapsulated dynamic grammar object.
 */
class SynthesisContext {
    constructor() {
        this.privContext = {};
    }
    /**
     * Adds a section to the synthesis.context object.
     * @param sectionName Name of the section to add.
     * @param value JSON serializable object that represents the value.
     */
    setSection(sectionName, value) {
        this.privContext[sectionName] = value;
    }
    /**
     * Sets the audio output format for synthesis context generation.
     * @param format {AudioOutputFormatImpl} the output format
     */
    set audioOutputFormat(format) {
        this.privAudioOutputFormat = format;
    }
    toJSON() {
        return JSON.stringify(this.privContext);
    }
    setSynthesisSection(speechSynthesizer) {
        const synthesisSection = this.buildSynthesisContext(speechSynthesizer);
        this.setSection("synthesis", synthesisSection);
    }
    buildSynthesisContext(speechSynthesizer) {
        return {
            audio: {
                metadataOptions: {
                    bookmarkEnabled: (!!speechSynthesizer?.bookmarkReached),
                    punctuationBoundaryEnabled: speechSynthesizer?.properties.getProperty(Exports_js_1.PropertyId.SpeechServiceResponse_RequestPunctuationBoundary, (!!speechSynthesizer?.wordBoundary)),
                    sentenceBoundaryEnabled: speechSynthesizer?.properties.getProperty(Exports_js_1.PropertyId.SpeechServiceResponse_RequestSentenceBoundary, false),
                    sessionEndEnabled: true,
                    visemeEnabled: (!!speechSynthesizer?.visemeReceived),
                    wordBoundaryEnabled: speechSynthesizer?.properties.getProperty(Exports_js_1.PropertyId.SpeechServiceResponse_RequestWordBoundary, (!!speechSynthesizer?.wordBoundary)),
                },
                outputFormat: this.privAudioOutputFormat.requestAudioFormatString,
            },
            language: {
                autoDetection: speechSynthesizer?.autoDetectSourceLanguage
            }
        };
    }
}
exports.SynthesisContext = SynthesisContext;

//# sourceMappingURL=SynthesisContext.js.map
