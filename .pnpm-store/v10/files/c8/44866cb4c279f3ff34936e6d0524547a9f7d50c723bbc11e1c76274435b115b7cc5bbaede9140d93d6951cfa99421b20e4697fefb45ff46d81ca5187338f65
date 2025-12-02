"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleSpeechPhrase = void 0;
const Exports_js_1 = require("../Exports.js");
class SimpleSpeechPhrase {
    constructor(json, baseOffset = 0) {
        this.privSimpleSpeechPhrase = JSON.parse(json);
        this.privSimpleSpeechPhrase.RecognitionStatus = this.mapRecognitionStatus(this.privSimpleSpeechPhrase.RecognitionStatus); // RecognitionStatus[this.privSimpleSpeechPhrase.RecognitionStatus as unknown as keyof typeof RecognitionStatus];
        this.updateOffset(baseOffset);
    }
    static fromJSON(json, baseOffset) {
        return new SimpleSpeechPhrase(json, baseOffset);
    }
    updateOffset(baseOffset) {
        this.privSimpleSpeechPhrase.Offset += baseOffset;
    }
    asJson() {
        const jsonObj = { ...this.privSimpleSpeechPhrase };
        // Convert the enum value to its string representation for serialization purposes.
        return JSON.stringify({
            ...jsonObj,
            RecognitionStatus: Exports_js_1.RecognitionStatus[jsonObj.RecognitionStatus]
        });
    }
    get RecognitionStatus() {
        return this.privSimpleSpeechPhrase.RecognitionStatus;
    }
    get DisplayText() {
        return this.privSimpleSpeechPhrase.DisplayText;
    }
    get Offset() {
        return this.privSimpleSpeechPhrase.Offset;
    }
    get Duration() {
        return this.privSimpleSpeechPhrase.Duration;
    }
    get Language() {
        return this.privSimpleSpeechPhrase.PrimaryLanguage === undefined ? undefined : this.privSimpleSpeechPhrase.PrimaryLanguage.Language;
    }
    get LanguageDetectionConfidence() {
        return this.privSimpleSpeechPhrase.PrimaryLanguage === undefined ? undefined : this.privSimpleSpeechPhrase.PrimaryLanguage.Confidence;
    }
    get SpeakerId() {
        return this.privSimpleSpeechPhrase.SpeakerId;
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
exports.SimpleSpeechPhrase = SimpleSpeechPhrase;

//# sourceMappingURL=SimpleSpeechPhrase.js.map
