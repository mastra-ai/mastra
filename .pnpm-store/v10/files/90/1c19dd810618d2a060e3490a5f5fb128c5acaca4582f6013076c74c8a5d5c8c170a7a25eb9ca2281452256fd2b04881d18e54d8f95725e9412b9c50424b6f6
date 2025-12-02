import { PropertyCollection } from "../PropertyCollection.js";
import { ResultReason } from "../ResultReason.js";
import { TranslationRecognitionResult } from "../TranslationRecognitionResult.js";
import { Translations } from "../Translations.js";
export declare class ConversationTranslationResult extends TranslationRecognitionResult {
    private privId;
    private privOrigLang;
    constructor(participantId: string, translations: Translations, originalLanguage?: string, resultId?: string, reason?: ResultReason, text?: string, duration?: number, offset?: number, errorDetails?: string, json?: string, properties?: PropertyCollection);
    /**
     * The unique identifier for the participant this result is for.
     */
    get participantId(): string;
    /**
     * The original language this result was in.
     */
    get originalLang(): string;
}
