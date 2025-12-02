"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationHypothesis = void 0;
const Contracts_js_1 = require("../../sdk/Contracts.js");
const TranslationStatus_js_1 = require("../TranslationStatus.js");
class TranslationHypothesis {
    constructor(hypothesis, baseOffset) {
        this.privTranslationHypothesis = hypothesis;
        this.privTranslationHypothesis.Offset += baseOffset;
        this.privTranslationHypothesis.Translation.TranslationStatus = this.mapTranslationStatus(this.privTranslationHypothesis.Translation.TranslationStatus);
    }
    static fromJSON(json, baseOffset) {
        return new TranslationHypothesis(JSON.parse(json), baseOffset);
    }
    static fromTranslationResponse(translationHypothesis, baseOffset) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(translationHypothesis, "translationHypothesis");
        const hypothesis = translationHypothesis.SpeechHypothesis;
        translationHypothesis.SpeechHypothesis = undefined;
        hypothesis.Translation = translationHypothesis;
        return new TranslationHypothesis(hypothesis, baseOffset);
    }
    get Duration() {
        return this.privTranslationHypothesis.Duration;
    }
    get Offset() {
        return this.privTranslationHypothesis.Offset;
    }
    get Text() {
        return this.privTranslationHypothesis.Text;
    }
    get Translation() {
        return this.privTranslationHypothesis.Translation;
    }
    get Language() {
        return this.privTranslationHypothesis.PrimaryLanguage?.Language;
    }
    asJson() {
        const jsonObj = { ...this.privTranslationHypothesis };
        // Convert the enum value to its string representation for serialization purposes.
        return jsonObj.Translation !== undefined ? JSON.stringify({
            ...jsonObj,
            TranslationStatus: TranslationStatus_js_1.TranslationStatus[jsonObj.Translation.TranslationStatus]
        }) : JSON.stringify(jsonObj);
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
exports.TranslationHypothesis = TranslationHypothesis;

//# sourceMappingURL=TranslationHypothesis.js.map
