"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhraseListGrammar = void 0;
const Contracts_js_1 = require("./Contracts.js");
/**
 * Allows additions of new phrases to improve speech recognition.
 *
 * Phrases added to the recognizer are effective at the start of the next recognition, or the next time the SpeechSDK must reconnect
 * to the speech service.
 */
class PhraseListGrammar {
    constructor(recogBase) {
        this.privGrammerBuilder = recogBase.dynamicGrammar;
    }
    /**
     * Creates a PhraseListGrammar from a given speech recognizer. Will accept any recognizer that derives from @class Recognizer.
     * @param recognizer The recognizer to add phrase lists to.
     */
    static fromRecognizer(recognizer) {
        const recoBase = recognizer.internalData;
        return new PhraseListGrammar(recoBase);
    }
    /**
     * Adds a single phrase to the current recognizer.
     * @param phrase Phrase to add.
     */
    addPhrase(phrase) {
        this.privGrammerBuilder.addPhrase(phrase);
    }
    /**
     * Adds multiple phrases to the current recognizer.
     * @param phrases Array of phrases to add.
     */
    addPhrases(phrases) {
        this.privGrammerBuilder.addPhrase(phrases);
    }
    /**
     * Clears all phrases added to the current recognizer.
     */
    clear() {
        this.privGrammerBuilder.clearPhrases();
    }
    /**
     * Sets the phrase list grammar biasing weight.
     * The allowed range is [0.0, 2.0].
     * The default weight is 1.0. Value zero disables the phrase list.
     * @param weight Phrase list grammar biasing weight.
     */
    setWeight(weight) {
        Contracts_js_1.Contracts.throwIfNumberOutOfRange(weight, "weight", 0.0, 2.0);
        this.privGrammerBuilder.setWeight(weight);
    }
}
exports.PhraseListGrammar = PhraseListGrammar;

//# sourceMappingURL=PhraseListGrammar.js.map
