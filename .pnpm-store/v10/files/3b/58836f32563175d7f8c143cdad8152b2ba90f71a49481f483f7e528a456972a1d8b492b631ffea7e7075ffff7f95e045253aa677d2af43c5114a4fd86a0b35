import { PronunciationAssessmentOptions } from "../PronunciationScore/PronunciationAssessmentOptions";
import { InteractiveEnrichmentOptions } from "./InteractiveEnrichmentOptions";
import { DictationEnrichmentOptions } from "./DictationEnrichmentOptions";
import { ConversationEnrichmentOptions } from "./ConversationEnrichmentOptions";
import { ContentAssessmentOptions } from "./ContentAssessmentOptions";
import { SecondPassRescoringMode } from "./SecondPassRescoringMode";
/**
 * Profanity handling options.
 */
export declare enum ProfanityHandlingMode {
    /**
     * This is the default behavior. The Microsoft Speech Service masks profanity with asterisks.
     */
    Masked = "Masked",
    /**
     * The Microsoft Speech Service removes profanity from all results.
     */
    Removed = "Removed",
    /**
     * The Microsoft Speech Service recognizes and returns profanity in all results.
     */
    Raw = "Raw",
    /**
     * The Microsoft Speech Service will surround profane words by XML tags &lt;profanity&gt; ... &lt;/profanity&gt;
     */
    Tagged = "Tagged",
    /**
     * The Microsoft Speech Service will add profanity label to the Words
     */
    Labeled = "Labeled"
}
/**
 * The capitalization mode
 */
export declare enum CapitalizationMode {
    /**
     * Enable capitalization
     */
    Enabled = "Enabled",
    /**
     * Disable capitalization
     */
    Disabled = "Disabled"
}
/**
 * Defines the phrase detection payload in the speech Context message
 */
export interface Enrichment {
    /**
     * The interactive enrichment options.
     */
    interactive?: InteractiveEnrichmentOptions;
    /**
     * The dictation enrichment options.
     */
    dictation?: DictationEnrichmentOptions;
    /**
     * The conversation enrichment options.
     */
    conversation?: ConversationEnrichmentOptions;
    /**
     * The pronunciation assessment options.
     */
    pronunciationAssessment?: PronunciationAssessmentOptions;
    /**
     * The content assessment options.
     */
    contentAssessment?: ContentAssessmentOptions;
    /**
     * If true, strips the startTriggerKeyword from the phrase reco result
     */
    stripStartTriggerKeyword?: boolean;
    /**
     * The profanity handling mode.
     */
    profanity?: ProfanityHandlingMode;
    /**
     * The capitalization mode.
     */
    capitalization?: CapitalizationMode;
    /**
     * The interim template
     */
    interimTemplate?: string;
    /**
     * The final template
     */
    finalTemplate?: string;
    /**
     * The second pass rescoring mode.
     */
    secondPassRescoring?: SecondPassRescoringMode;
}
