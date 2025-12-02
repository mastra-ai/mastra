"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetailedSpeechPhrase = void 0;
const Exports_js_1 = require("../Exports.js");
class DetailedSpeechPhrase {
    constructor(json, baseOffset) {
        this.privDetailedSpeechPhrase = JSON.parse(json);
        this.privDetailedSpeechPhrase.RecognitionStatus = this.mapRecognitionStatus(this.privDetailedSpeechPhrase.RecognitionStatus);
        this.updateOffsets(baseOffset);
    }
    static fromJSON(json, baseOffset) {
        return new DetailedSpeechPhrase(json, baseOffset);
    }
    updateOffsets(baseOffset) {
        this.privDetailedSpeechPhrase.Offset += baseOffset;
        if (!!this.privDetailedSpeechPhrase.NBest) {
            for (const phrase of this.privDetailedSpeechPhrase.NBest) {
                if (!!phrase.Words) {
                    for (const word of phrase.Words) {
                        word.Offset += baseOffset;
                    }
                }
                if (!!phrase.DisplayWords) {
                    for (const word of phrase.DisplayWords) {
                        word.Offset += baseOffset;
                    }
                }
            }
        }
    }
    asJson() {
        const jsonObj = { ...this.privDetailedSpeechPhrase };
        // Convert the enum value to its string representation for serialization purposes.
        return JSON.stringify({
            ...jsonObj,
            RecognitionStatus: Exports_js_1.RecognitionStatus[jsonObj.RecognitionStatus]
        });
    }
    get RecognitionStatus() {
        return this.privDetailedSpeechPhrase.RecognitionStatus;
    }
    get NBest() {
        return this.privDetailedSpeechPhrase.NBest;
    }
    get Duration() {
        return this.privDetailedSpeechPhrase.Duration;
    }
    get Offset() {
        return this.privDetailedSpeechPhrase.Offset;
    }
    get Language() {
        return this.privDetailedSpeechPhrase.PrimaryLanguage === undefined ? undefined : this.privDetailedSpeechPhrase.PrimaryLanguage.Language;
    }
    get LanguageDetectionConfidence() {
        return this.privDetailedSpeechPhrase.PrimaryLanguage === undefined ? undefined : this.privDetailedSpeechPhrase.PrimaryLanguage.Confidence;
    }
    get Text() {
        if (!!this.privDetailedSpeechPhrase.NBest && this.privDetailedSpeechPhrase.NBest[0]) {
            return this.privDetailedSpeechPhrase.NBest[0].Display || this.privDetailedSpeechPhrase.NBest[0].DisplayText;
        }
        return this.privDetailedSpeechPhrase.DisplayText;
    }
    get SpeakerId() {
        return this.privDetailedSpeechPhrase.SpeakerId;
    }
    mapRecognitionStatus(status) {
        if (typeof status === "string") {
            return Exports_js_1.RecognitionStatus[status];
        }
        else if (typeof status === "number") {
            return status;
        }
    }
}
exports.DetailedSpeechPhrase = DetailedSpeechPhrase;

//# sourceMappingURL=DetailedSpeechPhrase.js.map
