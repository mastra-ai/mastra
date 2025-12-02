
type LanguageName = "danish"|"dutch"|"english"|"french"|"galician"|"german"|"italian"|"polish"|"portuguese"|"romanian"|"russian"|"spanish"|"swedish"|"ar"|"cs"|"da"|"de"|"en"|"es"|"fa"|"fr"|"gl"|"it"|"ko"|"nl"|"pl"|"pt"|"ro"|"ru"|"sv"|"tr"|"vi";
type GetStopwordsOptions = {language?: LanguageName};
type ExtractionOptions = {
  remove_digits?: boolean;
  return_changed_case?: boolean;
  return_chained_words?: boolean;
  remove_duplicates?: boolean;
  return_max_ngrams?: number | false;
  stopwords?: string[];
} & GetStopwordsOptions;

/**
 * Extracts keywords from the given string.
 * @param {string} str The string to extract keywords from.
 * @param {ExtractionOptions | undefined} options Options for the keyword extraction tool.
 */
export declare function _extract(str: string, options?: ExtractionOptions): string[]


/**
 * Returns the array of stopwords.
 * @param {GetStopwordsOptions | undefined} options
 */
export declare function _getStopwords(options?: GetStopwordsOptions): string[];

/** Provides the list of supported ISO 639-1 language codes */
export declare const supported_language_codes: string[];
