import { ConversationTranscriber, MeetingTranscriber, Recognizer } from "./Exports.js";
/**
 * Allows additions of new phrases to improve speech recognition.
 *
 * Phrases added to the recognizer are effective at the start of the next recognition, or the next time the SpeechSDK must reconnect
 * to the speech service.
 */
export declare class PhraseListGrammar {
    private privGrammerBuilder;
    private constructor();
    /**
     * Creates a PhraseListGrammar from a given speech recognizer. Will accept any recognizer that derives from @class Recognizer.
     * @param recognizer The recognizer to add phrase lists to.
     */
    static fromRecognizer(recognizer: Recognizer | ConversationTranscriber | MeetingTranscriber): PhraseListGrammar;
    /**
     * Adds a single phrase to the current recognizer.
     * @param phrase Phrase to add.
     */
    addPhrase(phrase: string): void;
    /**
     * Adds multiple phrases to the current recognizer.
     * @param phrases Array of phrases to add.
     */
    addPhrases(phrases: string[]): void;
    /**
     * Clears all phrases added to the current recognizer.
     */
    clear(): void;
    /**
     * Sets the phrase list grammar biasing weight.
     * The allowed range is [0.0, 2.0].
     * The default weight is 1.0. Value zero disables the phrase list.
     * @param weight Phrase list grammar biasing weight.
     */
    setWeight(weight: number): void;
}
