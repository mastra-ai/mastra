"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationSynthesisResult = void 0;
/**
 * Defines translation synthesis result, i.e. the voice output of the translated
 * text in the target language.
 * @class TranslationSynthesisResult
 */
class TranslationSynthesisResult {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {ResultReason} reason - The synthesis reason.
     * @param {ArrayBuffer} audio - The audio data.
     */
    constructor(reason, audio) {
        this.privReason = reason;
        this.privAudio = audio;
    }
    /**
     * Translated text in the target language.
     * @member TranslationSynthesisResult.prototype.audio
     * @function
     * @public
     * @returns {ArrayBuffer} Translated audio in the target language.
     */
    get audio() {
        return this.privAudio;
    }
    /**
     * The synthesis status.
     * @member TranslationSynthesisResult.prototype.reason
     * @function
     * @public
     * @returns {ResultReason} The synthesis status.
     */
    get reason() {
        return this.privReason;
    }
}
exports.TranslationSynthesisResult = TranslationSynthesisResult;

//# sourceMappingURL=TranslationSynthesisResult.js.map
