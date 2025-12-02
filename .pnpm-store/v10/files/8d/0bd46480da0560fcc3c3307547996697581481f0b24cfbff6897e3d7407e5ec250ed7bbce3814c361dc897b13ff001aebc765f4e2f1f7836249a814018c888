"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationPhrase = void 0;
const Contracts_js_1 = require("../../sdk/Contracts.js");
const Exports_js_1 = require("../Exports.js");
const TranslationStatus_js_1 = require("../TranslationStatus.js");
class TranslationPhrase {
    constructor(phrase, baseOffset) {
        this.privTranslationPhrase = phrase;
        this.privTranslationPhrase.Offset += baseOffset;
        this.privTranslationPhrase.RecognitionStatus = this.mapRecognitionStatus(this.privTranslationPhrase.RecognitionStatus);
        if (this.privTranslationPhrase.Translation !== undefined) {
            this.privTranslationPhrase.Translation.TranslationStatus = this.mapTranslationStatus(this.privTranslationPhrase.Translation.TranslationStatus);
        }
    }
    static fromJSON(json, baseOffset) {
        return new TranslationPhrase(JSON.parse(json), baseOffset);
    }
    static fromTranslationResponse(translationResponse, baseOffset) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(translationResponse, "translationResponse");
        const phrase = translationResponse.SpeechPhrase;
        translationResponse.SpeechPhrase = undefined;
        phrase.Translation = translationResponse;
        phrase.Text = phrase.DisplayText;
        return new TranslationPhrase(phrase, baseOffset);
    }
    get RecognitionStatus() {
        return this.privTranslationPhrase.RecognitionStatus;
    }
    get Offset() {
        return this.privTranslationPhrase.Offset;
    }
    get Duration() {
        return this.privTranslationPhrase.Duration;
    }
    get Text() {
        return this.privTranslationPhrase.Text;
    }
    get Language() {
        return this.privTranslationPhrase.PrimaryLanguage?.Language;
    }
    get Confidence() {
        return this.privTranslationPhrase.PrimaryLanguage?.Confidence;
    }
    get Translation() {
        return this.privTranslationPhrase.Translation;
    }
    asJson() {
        const jsonObj = { ...this.privTranslationPhrase };
        // Convert the enum values to their string representations for serialization
        const serializedObj = {
            ...jsonObj,
            RecognitionStatus: Exports_js_1.RecognitionStatus[jsonObj.RecognitionStatus]
        };
        if (jsonObj.Translation) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            serializedObj.Translation = {
                ...jsonObj.Translation,
                TranslationStatus: TranslationStatus_js_1.TranslationStatus[jsonObj.Translation.TranslationStatus]
            };
        }
        return JSON.stringify(serializedObj);
    }
    mapRecognitionStatus(status) {
        if (typeof status === "string") {
            return Exports_js_1.RecognitionStatus[status];
        }
        else if (typeof status === "number") {
            return status;
        }
    }
    mapTranslationStatus(status) {
        if (typeof status === "string") {
            return TranslationStatus_js_1.TranslationStatus[status];
        }
        else if (typeof status === "number") {
            return status;
        }
    }
}
exports.TranslationPhrase = TranslationPhrase;

//# sourceMappingURL=TranslationPhrase.js.map
