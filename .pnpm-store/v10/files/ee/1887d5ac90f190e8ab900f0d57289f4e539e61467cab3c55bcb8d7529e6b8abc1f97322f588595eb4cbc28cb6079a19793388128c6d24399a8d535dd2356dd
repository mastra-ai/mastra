"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
// Multi-device Conversation is a Preview feature.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationTranslationResult = void 0;
const TranslationRecognitionResult_js_1 = require("../TranslationRecognitionResult.js");
class ConversationTranslationResult extends TranslationRecognitionResult_js_1.TranslationRecognitionResult {
    constructor(participantId, translations, originalLanguage, resultId, reason, text, duration, offset, errorDetails, json, properties) {
        super(translations, resultId, reason, text, duration, offset, undefined, undefined, errorDetails, json, properties);
        this.privId = participantId;
        this.privOrigLang = originalLanguage;
    }
    /**
     * The unique identifier for the participant this result is for.
     */
    get participantId() {
        return this.privId;
    }
    /**
     * The original language this result was in.
     */
    get originalLang() {
        return this.privOrigLang;
    }
}
exports.ConversationTranslationResult = ConversationTranslationResult;

//# sourceMappingURL=ConversationTranslationResult.js.map
