"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceProfilePhraseResult = void 0;
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_1 = require("./Exports.js");
/**
 * Output format
 * @class VoiceProfilePhraseResult
 */
class VoiceProfilePhraseResult extends Exports_js_1.VoiceProfileResult {
    constructor(reason, statusText, type, phraseArray) {
        super(reason, statusText);
        this.privPhrases = [];
        Contracts_js_1.Contracts.throwIfNullOrUndefined(phraseArray, "phrase array");
        this.privType = type;
        if (!!phraseArray && !!phraseArray[0]) {
            this.privPhrases = phraseArray;
        }
    }
    get phrases() {
        return this.privPhrases;
    }
    get type() {
        return this.privType;
    }
}
exports.VoiceProfilePhraseResult = VoiceProfilePhraseResult;

//# sourceMappingURL=VoiceProfilePhraseResult.js.map
