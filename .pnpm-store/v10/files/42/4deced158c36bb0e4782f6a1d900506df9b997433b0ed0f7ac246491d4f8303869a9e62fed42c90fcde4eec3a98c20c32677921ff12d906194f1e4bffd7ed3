"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechHypothesis = void 0;
class SpeechHypothesis {
    constructor(json, baseOffset) {
        this.privSpeechHypothesis = JSON.parse(json);
        this.updateOffset(baseOffset);
    }
    static fromJSON(json, baseOffset) {
        return new SpeechHypothesis(json, baseOffset);
    }
    updateOffset(baseOffset) {
        this.privSpeechHypothesis.Offset += baseOffset;
    }
    asJson() {
        return JSON.stringify(this.privSpeechHypothesis);
    }
    get Text() {
        return this.privSpeechHypothesis.Text;
    }
    get Offset() {
        return this.privSpeechHypothesis.Offset;
    }
    get Duration() {
        return this.privSpeechHypothesis.Duration;
    }
    get Language() {
        return this.privSpeechHypothesis.PrimaryLanguage === undefined ? undefined : this.privSpeechHypothesis.PrimaryLanguage.Language;
    }
    get LanguageDetectionConfidence() {
        return this.privSpeechHypothesis.PrimaryLanguage === undefined ? undefined : this.privSpeechHypothesis.PrimaryLanguage.Confidence;
    }
    get SpeakerId() {
        return this.privSpeechHypothesis.SpeakerId;
    }
}
exports.SpeechHypothesis = SpeechHypothesis;

//# sourceMappingURL=SpeechHypothesis.js.map
