import { DetailedOptions } from "./DetailedOptions";
import { SimpleOptions } from "./SimpleOptions";
import { InterimResults } from "./InterimResults";
import { PhraseResults } from "./PhraseResults";
/**
 * The detailed output options.
 */
export declare enum PhraseOption {
    WordTimings = "WordTimings",
    SNR = "SNR",
    Pronunciation = "Pronunciation",
    WordPronunciation = "WordPronunciation",
    WordConfidence = "WordConfidence",
    Words = "Words",
    Sentiment = "Sentiment",
    PronunciationAssessment = "PronunciationAssessment",
    ContentAssessment = "ContentAssessment",
    PhraseAMScore = "PhraseAMScore",
    PhraseLMScore = "PhraseLMScore",
    WordAMScore = "WordAMScore",
    WordLMScore = "WordLMScore",
    RuleTree = "RuleTree",
    NBestTimings = "NBestTimings",
    DecoderDiagnostics = "DecoderDiagnostics",
    DisplayWordTimings = "DisplayWordTimings",
    DisplayWords = "DisplayWords"
}
/**
 * The detailed output extensions.
 */
export declare enum PhraseExtension {
    Graph = "Graph",
    Corrections = "Corrections",
    Sentiment = "Sentiment"
}
/**
 * The Recognition modes
 */
export declare enum OutputFormat {
    Simple = "Simple",
    Detailed = "Detailed"
}
/**
 * The Tentative Phrase Results option
 */
export declare enum TentativePhraseResultsOption {
    None = "None",
    Always = "Always"
}
/**
 * Defines the phrase output in the speech Context message
 */
export interface PhraseOutput {
    /**
     * The output format.
     */
    format?: OutputFormat;
    /**
     * The detailed options.
     */
    detailed?: DetailedOptions;
    /**
     * The simple options.
     */
    simple?: SimpleOptions;
    /**
     * The interim results.
     */
    interimResults?: InterimResults;
    /**
     * The phrase results.
     */
    phraseResults?: PhraseResults;
    /**
     * The tentative phrase results option
     */
    tentativePhraseResults?: TentativePhraseResultsOption;
}
