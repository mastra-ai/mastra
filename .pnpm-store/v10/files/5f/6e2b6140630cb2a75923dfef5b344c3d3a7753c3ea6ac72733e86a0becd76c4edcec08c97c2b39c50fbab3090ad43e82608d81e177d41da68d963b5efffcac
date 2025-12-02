/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

/*
 * This file was generated from the OpenSearch API Spec. Do NOT edit it
 * manually. If you want to make changes, either update the spec or
 * modify the API generator.
 */

import * as Common from './_common'

export type Analyzer = CustomAnalyzer | FingerprintAnalyzer | KeywordAnalyzer | LanguageAnalyzer | NoriAnalyzer | PatternAnalyzer | SimpleAnalyzer | StandardAnalyzer | StopAnalyzer | WhitespaceAnalyzer | IcuAnalyzer | KuromojiAnalyzer | SnowballAnalyzer | DutchAnalyzer | SmartcnAnalyzer | CjkAnalyzer | PhoneAnalyzer

export type AsciiFoldingTokenFilter = TokenFilterBase & {
  preserve_original?: Common.StringifiedBoolean;
  type: 'asciifolding';
}

export type CharFilter = string | CharFilterDefinition

export type CharFilterBase = {
  version?: Common.VersionString;
}

export type CharFilterDefinition = HtmlStripCharFilter | MappingCharFilter | PatternReplaceCharFilter | IcuNormalizationCharFilter | KuromojiIterationMarkCharFilter

export type CharGroupTokenizer = TokenizerBase & {
  max_token_length?: number;
  tokenize_on_chars: string[];
  type: 'char_group';
}

export type CjkAnalyzer = {
  stopwords?: StopWords;
  stopwords_path?: string;
  type?: 'cjk';
}

export type CommonGramsTokenFilter = TokenFilterBase & {
  common_words?: string[];
  common_words_path?: string;
  ignore_case?: boolean;
  query_mode?: boolean;
  type: 'common_grams';
}

export type CompoundWordTokenFilterBase = TokenFilterBase & {
  hyphenation_patterns_path?: string;
  max_subword_size?: number;
  min_subword_size?: number;
  min_word_size?: number;
  only_longest_match?: boolean;
  word_list?: string[];
  word_list_path?: string;
}

export type ConditionTokenFilter = TokenFilterBase & {
  filter: string[];
  script: Common.Script;
  type: 'condition';
}

export type CustomAnalyzer = {
  char_filter?: string[];
  filter?: string[];
  position_increment_gap?: number;
  position_offset_gap?: number;
  tokenizer: string;
  type: 'custom';
}

export type CustomNormalizer = {
  char_filter?: string[];
  filter?: string[];
  type: 'custom';
}

export type DelimitedPayloadEncoding = 'float' | 'identity' | 'int'

export type DelimitedPayloadTokenFilter = TokenFilterBase & {
  delimiter?: string;
  encoding?: DelimitedPayloadEncoding;
  type: 'delimited_payload';
}

export type DictionaryDecompounderTokenFilter = CompoundWordTokenFilterBase & {
  type: 'dictionary_decompounder';
}

export type DutchAnalyzer = {
  stopwords?: StopWords;
  type: 'dutch';
}

export type EdgeNGramSide = 'back' | 'front'

export type EdgeNGramTokenFilter = TokenFilterBase & {
  max_gram?: number;
  min_gram?: number;
  preserve_original?: Common.StringifiedBoolean;
  side?: EdgeNGramSide;
  type: 'edge_ngram';
}

export type EdgeNGramTokenizer = TokenizerBase & {
  custom_token_chars?: string;
  max_gram: number;
  min_gram: number;
  token_chars: TokenChar[];
  type: 'edge_ngram';
}

export type ElisionTokenFilter = TokenFilterBase & {
  articles?: string[];
  articles_case?: Common.StringifiedBoolean;
  articles_path?: string;
  type: 'elision';
}

export type FingerprintAnalyzer = {
  max_output_size: number;
  preserve_original: boolean;
  separator: string;
  stopwords?: StopWords;
  stopwords_path?: string;
  type: 'fingerprint';
  version?: Common.VersionString;
}

export type FingerprintTokenFilter = TokenFilterBase & {
  max_output_size?: number;
  separator?: string;
  type: 'fingerprint';
}

export type HtmlStripCharFilter = CharFilterBase & {
  type: 'html_strip';
}

export type HunspellTokenFilter = TokenFilterBase & {
  dedup?: boolean;
  dictionary?: string;
  locale: string;
  longest_only?: boolean;
  type: 'hunspell';
}

export type HyphenationDecompounderTokenFilter = CompoundWordTokenFilterBase & {
  type: 'hyphenation_decompounder';
}

export type IcuAnalyzer = {
  method: IcuNormalizationType;
  mode: IcuNormalizationMode;
  type: 'icu_analyzer';
}

export type IcuCollationAlternate = 'non-ignorable' | 'shifted'

export type IcuCollationCaseFirst = 'lower' | 'upper'

export type IcuCollationDecomposition = 'canonical' | 'no'

export type IcuCollationStrength = 'identical' | 'primary' | 'quaternary' | 'secondary' | 'tertiary'

export type IcuCollationTokenFilter = TokenFilterBase & {
  alternate?: IcuCollationAlternate;
  caseFirst?: IcuCollationCaseFirst;
  caseLevel?: boolean;
  country?: string;
  decomposition?: IcuCollationDecomposition;
  hiraganaQuaternaryMode?: boolean;
  language?: string;
  numeric?: boolean;
  rules?: string;
  strength?: IcuCollationStrength;
  type: 'icu_collation';
  variableTop?: string;
  variant?: string;
}

export type IcuFoldingTokenFilter = TokenFilterBase & {
  type: 'icu_folding';
  unicode_set_filter: string;
}

export type IcuNormalizationCharFilter = CharFilterBase & {
  mode?: IcuNormalizationMode;
  name?: IcuNormalizationType;
  type: 'icu_normalizer';
}

export type IcuNormalizationMode = 'compose' | 'decompose'

export type IcuNormalizationTokenFilter = TokenFilterBase & {
  name: IcuNormalizationType;
  type: 'icu_normalizer';
}

export type IcuNormalizationType = 'nfc' | 'nfkc' | 'nfkc_cf'

export type IcuTokenizer = TokenizerBase & {
  rule_files: string;
  type: 'icu_tokenizer';
}

export type IcuTransformDirection = 'forward' | 'reverse'

export type IcuTransformTokenFilter = TokenFilterBase & {
  dir?: IcuTransformDirection;
  id: string;
  type: 'icu_transform';
}

export type KeepTypesMode = 'exclude' | 'include'

export type KeepTypesTokenFilter = TokenFilterBase & {
  mode?: KeepTypesMode;
  type: 'keep_types';
  types?: string[];
}

export type KeepWordsTokenFilter = TokenFilterBase & {
  keep_words?: string[];
  keep_words_case?: boolean;
  keep_words_path?: string;
  type: 'keep';
}

export type KeywordAnalyzer = {
  type: 'keyword';
  version?: Common.VersionString;
}

export type KeywordMarkerTokenFilter = TokenFilterBase & {
  ignore_case?: boolean;
  keywords?: string[];
  keywords_path?: string;
  keywords_pattern?: string;
  type: 'keyword_marker';
}

export type KeywordTokenizer = TokenizerBase & {
  buffer_size: number;
  type: 'keyword';
}

export type KStemTokenFilter = TokenFilterBase & {
  type: 'kstem';
}

export type KuromojiAnalyzer = {
  mode: KuromojiTokenizationMode;
  type: 'kuromoji';
  user_dictionary?: string;
}

export type KuromojiIterationMarkCharFilter = CharFilterBase & {
  normalize_kana: boolean;
  normalize_kanji: boolean;
  type: 'kuromoji_iteration_mark';
}

export type KuromojiPartOfSpeechTokenFilter = TokenFilterBase & {
  stoptags: string[];
  type: 'kuromoji_part_of_speech';
}

export type KuromojiReadingFormTokenFilter = TokenFilterBase & {
  type: 'kuromoji_readingform';
  use_romaji: boolean;
}

export type KuromojiStemmerTokenFilter = TokenFilterBase & {
  minimum_length: number;
  type: 'kuromoji_stemmer';
}

export type KuromojiTokenizationMode = 'extended' | 'normal' | 'search'

export type KuromojiTokenizer = TokenizerBase & {
  discard_compound_token?: boolean;
  discard_punctuation?: boolean;
  mode: KuromojiTokenizationMode;
  nbest_cost?: number;
  nbest_examples?: string;
  type: 'kuromoji_tokenizer';
  user_dictionary?: string;
  user_dictionary_rules?: string[];
}

export type Language = 'Arabic' | 'Armenian' | 'Basque' | 'Brazilian' | 'Bulgarian' | 'Catalan' | 'Chinese' | 'Cjk' | 'Czech' | 'Danish' | 'Dutch' | 'English' | 'Estonian' | 'Finnish' | 'French' | 'Galician' | 'German' | 'Greek' | 'Hindi' | 'Hungarian' | 'Indonesian' | 'Irish' | 'Italian' | 'Latvian' | 'Norwegian' | 'Persian' | 'Portuguese' | 'Romanian' | 'Russian' | 'Sorani' | 'Spanish' | 'Swedish' | 'Thai' | 'Turkish'

export type LanguageAnalyzer = {
  language: Language;
  stem_exclusion: string[];
  stopwords?: StopWords;
  stopwords_path?: string;
  type: 'language';
  version?: Common.VersionString;
}

export type LengthTokenFilter = TokenFilterBase & {
  max?: number;
  min?: number;
  type: 'length';
}

export type LetterTokenizer = TokenizerBase & {
  type: 'letter';
}

export type LimitTokenCountTokenFilter = TokenFilterBase & {
  consume_all_tokens?: boolean;
  max_token_count?: Common.StringifiedInteger;
  type: 'limit';
}

export type LowercaseNormalizer = {
  type: 'lowercase';
}

export type LowercaseTokenFilter = TokenFilterBase & {
  language?: string;
  type: 'lowercase';
}

export type LowercaseTokenizer = TokenizerBase & {
  type: 'lowercase';
}

export type MappingCharFilter = CharFilterBase & {
  mappings?: string[];
  mappings_path?: string;
  type: 'mapping';
}

export type MultiplexerTokenFilter = TokenFilterBase & {
  filters: string[];
  preserve_original?: Common.StringifiedBoolean;
  type: 'multiplexer';
}

export type NGramTokenFilter = TokenFilterBase & {
  max_gram?: number;
  min_gram?: number;
  preserve_original?: Common.StringifiedBoolean;
  type: 'ngram';
}

export type NGramTokenizer = TokenizerBase & {
  custom_token_chars?: string;
  max_gram: number;
  min_gram: number;
  token_chars: TokenChar[];
  type: 'ngram';
}

export type NoriAnalyzer = {
  decompound_mode?: NoriDecompoundMode;
  stoptags?: string[];
  type: 'nori';
  user_dictionary?: string;
  version?: Common.VersionString;
}

export type NoriDecompoundMode = 'discard' | 'mixed' | 'none'

export type NoriPartOfSpeechTokenFilter = TokenFilterBase & {
  stoptags?: string[];
  type: 'nori_part_of_speech';
}

export type NoriTokenizer = TokenizerBase & {
  decompound_mode?: NoriDecompoundMode;
  discard_punctuation?: boolean;
  type: 'nori_tokenizer';
  user_dictionary?: string;
  user_dictionary_rules?: string[];
}

export type Normalizer = LowercaseNormalizer | CustomNormalizer

export type PathHierarchyTokenizer = TokenizerBase & {
  buffer_size: Common.StringifiedInteger;
  delimiter: string;
  replacement?: string;
  reverse: Common.StringifiedBoolean;
  skip: Common.StringifiedInteger;
  type: 'path_hierarchy';
}

export type PatternAnalyzer = {
  flags?: string;
  lowercase?: boolean;
  pattern: string;
  stopwords?: StopWords;
  type: 'pattern';
  version?: Common.VersionString;
}

export type PatternCaptureTokenFilter = TokenFilterBase & {
  patterns: string[];
  preserve_original?: Common.StringifiedBoolean;
  type: 'pattern_capture';
}

export type PatternReplaceCharFilter = CharFilterBase & {
  flags?: string;
  pattern: string;
  replacement?: string;
  type: 'pattern_replace';
}

export type PatternReplaceTokenFilter = TokenFilterBase & {
  all?: boolean;
  flags?: string;
  pattern: string;
  replacement?: string;
  type: 'pattern_replace';
}

export type PatternTokenizer = TokenizerBase & {
  flags?: string;
  group?: number;
  pattern?: string;
  type: 'pattern';
}

export type PersianStemTokenFilter = TokenFilterBase & {
  type: 'persian_stem';
}

export type PhoneAnalyzer = {
  'phone-region'?: string;
  type?: 'phone' | 'phone-search';
}

export type PhoneticEncoder = 'beider_morse' | 'caverphone1' | 'caverphone2' | 'cologne' | 'daitch_mokotoff' | 'double_metaphone' | 'haasephonetik' | 'koelnerphonetik' | 'metaphone' | 'nysiis' | 'refined_soundex' | 'soundex'

export type PhoneticLanguage = 'any' | 'common' | 'cyrillic' | 'english' | 'french' | 'german' | 'hebrew' | 'hungarian' | 'polish' | 'romanian' | 'russian' | 'spanish'

export type PhoneticNameType = 'ashkenazi' | 'generic' | 'sephardic'

export type PhoneticRuleType = 'approx' | 'exact'

export type PhoneticTokenFilter = TokenFilterBase & {
  encoder: PhoneticEncoder;
  languageset: PhoneticLanguage[];
  max_code_len?: number;
  name_type: PhoneticNameType;
  replace?: boolean;
  rule_type: PhoneticRuleType;
  type: 'phonetic';
}

export type PorterStemTokenFilter = TokenFilterBase & {
  type: 'porter_stem';
}

export type PredicateTokenFilter = TokenFilterBase & {
  script: Common.Script;
  type: 'predicate_token_filter';
}

export type RemoveDuplicatesTokenFilter = TokenFilterBase & {
  type: 'remove_duplicates';
}

export type ReverseTokenFilter = TokenFilterBase & {
  type: 'reverse';
}

export type ShingleTokenFilter = TokenFilterBase & {
  filler_token?: string;
  max_shingle_size?: number | string;
  min_shingle_size?: number | string;
  output_unigrams?: boolean;
  output_unigrams_if_no_shingles?: boolean;
  token_separator?: string;
  type: 'shingle';
}

export type SimpleAnalyzer = {
  type: 'simple';
  version?: Common.VersionString;
}

export type SimplePatternSplitTokenizer = TokenizerBase & {
  pattern?: string;
  type: 'simple_pattern_split';
}

export type SimplePatternTokenizer = TokenizerBase & {
  pattern?: string;
  type: 'simple_pattern';
}

export type SmartcnAnalyzer = {
  type?: 'smartcn';
}

export type SmartcnStopTokenFilter = TokenFilterBase & {
  type: 'smartcn_stop';
}

export type SmartcnTokenizer = TokenizerBase & {
  type: 'smartcn_tokenizer';
}

export type SnowballAnalyzer = {
  language: SnowballLanguage;
  stopwords?: StopWords;
  type: 'snowball';
  version?: Common.VersionString;
}

export type SnowballLanguage = 'Armenian' | 'Basque' | 'Catalan' | 'Danish' | 'Dutch' | 'English' | 'Finnish' | 'French' | 'German' | 'German2' | 'Hungarian' | 'Italian' | 'Kp' | 'Lovins' | 'Norwegian' | 'Porter' | 'Portuguese' | 'Romanian' | 'Russian' | 'Spanish' | 'Swedish' | 'Turkish'

export type SnowballTokenFilter = TokenFilterBase & {
  language: SnowballLanguage;
  type: 'snowball';
}

export type StandardAnalyzer = {
  max_token_length?: number;
  stopwords?: StopWords;
  type: 'standard';
}

export type StandardTokenizer = TokenizerBase & {
  max_token_length?: number;
  type: 'standard';
}

export type StemmerOverrideTokenFilter = TokenFilterBase & {
  rules?: string[];
  rules_path?: string;
  type: 'stemmer_override';
}

export type StemmerTokenFilter = TokenFilterBase & {
  language?: string;
  type: 'stemmer';
}

export type StopAnalyzer = {
  stopwords?: StopWords;
  stopwords_path?: string;
  type: 'stop';
  version?: Common.VersionString;
}

export type StopTokenFilter = TokenFilterBase & {
  ignore_case?: boolean;
  remove_trailing?: boolean;
  stopwords?: StopWords;
  stopwords_path?: string;
  type: 'stop';
}

export type StopWords = Common.StringOrStringArray

export type SynonymFormat = 'solr' | 'wordnet'

export type SynonymGraphTokenFilter = TokenFilterBase & {
  expand?: boolean;
  format?: SynonymFormat;
  lenient?: boolean;
  synonyms?: string[];
  synonyms_path?: string;
  tokenizer?: string;
  type: 'synonym_graph';
  updateable?: boolean;
}

export type SynonymTokenFilter = TokenFilterBase & {
  expand?: boolean;
  format?: SynonymFormat;
  lenient?: boolean;
  synonyms?: string[];
  synonyms_path?: string;
  tokenizer?: string;
  type: 'synonym';
  updateable?: boolean;
}

export type TokenChar = 'custom' | 'digit' | 'letter' | 'punctuation' | 'symbol' | 'whitespace'

export type TokenFilter = string | TokenFilterDefinition

export type TokenFilterBase = {
  version?: Common.VersionString;
}

export type TokenFilterDefinition = AsciiFoldingTokenFilter | CommonGramsTokenFilter | ConditionTokenFilter | DelimitedPayloadTokenFilter | EdgeNGramTokenFilter | ElisionTokenFilter | FingerprintTokenFilter | HunspellTokenFilter | HyphenationDecompounderTokenFilter | KeepTypesTokenFilter | KeepWordsTokenFilter | KeywordMarkerTokenFilter | KStemTokenFilter | LengthTokenFilter | LimitTokenCountTokenFilter | LowercaseTokenFilter | MultiplexerTokenFilter | NGramTokenFilter | NoriPartOfSpeechTokenFilter | PatternCaptureTokenFilter | PatternReplaceTokenFilter | PersianStemTokenFilter | PorterStemTokenFilter | PredicateTokenFilter | RemoveDuplicatesTokenFilter | ReverseTokenFilter | ShingleTokenFilter | SnowballTokenFilter | StemmerOverrideTokenFilter | StemmerTokenFilter | StopTokenFilter | SynonymGraphTokenFilter | SynonymTokenFilter | TrimTokenFilter | TruncateTokenFilter | UniqueTokenFilter | UppercaseTokenFilter | WordDelimiterGraphTokenFilter | WordDelimiterTokenFilter | KuromojiStemmerTokenFilter | KuromojiReadingFormTokenFilter | KuromojiPartOfSpeechTokenFilter | IcuTokenizer | IcuCollationTokenFilter | IcuFoldingTokenFilter | IcuNormalizationTokenFilter | IcuTransformTokenFilter | PhoneticTokenFilter | DictionaryDecompounderTokenFilter | SmartcnStopTokenFilter

export type Tokenizer = string | TokenizerDefinition

export type TokenizerBase = {
  version?: Common.VersionString;
}

export type TokenizerDefinition = CharGroupTokenizer | EdgeNGramTokenizer | KeywordTokenizer | LetterTokenizer | LowercaseTokenizer | NGramTokenizer | NoriTokenizer | PathHierarchyTokenizer | StandardTokenizer | UaxEmailUrlTokenizer | WhitespaceTokenizer | KuromojiTokenizer | PatternTokenizer | SimplePatternTokenizer | SimplePatternSplitTokenizer | IcuTokenizer | SmartcnTokenizer

export type TrimTokenFilter = TokenFilterBase & {
  type: 'trim';
}

export type TruncateTokenFilter = TokenFilterBase & {
  length?: number;
  type: 'truncate';
}

export type UaxEmailUrlTokenizer = TokenizerBase & {
  max_token_length?: number;
  type: 'uax_url_email';
}

export type UniqueTokenFilter = TokenFilterBase & {
  only_on_same_position?: boolean;
  type: 'unique';
}

export type UppercaseTokenFilter = TokenFilterBase & {
  type: 'uppercase';
}

export type WhitespaceAnalyzer = {
  type: 'whitespace';
  version?: Common.VersionString;
}

export type WhitespaceTokenizer = TokenizerBase & {
  max_token_length?: number;
  type: 'whitespace';
}

export type WordDelimiterGraphTokenFilter = TokenFilterBase & {
  adjust_offsets?: boolean;
  catenate_all?: boolean;
  catenate_numbers?: boolean;
  catenate_words?: boolean;
  generate_number_parts?: boolean;
  generate_word_parts?: boolean;
  ignore_keywords?: boolean;
  preserve_original?: Common.StringifiedBoolean;
  protected_words?: string[];
  protected_words_path?: string;
  split_on_case_change?: boolean;
  split_on_numerics?: boolean;
  stem_english_possessive?: boolean;
  type: 'word_delimiter_graph';
  type_table?: string[];
  type_table_path?: string;
}

export type WordDelimiterTokenFilter = TokenFilterBase & {
  catenate_all?: boolean;
  catenate_numbers?: boolean;
  catenate_words?: boolean;
  generate_number_parts?: boolean;
  generate_word_parts?: boolean;
  preserve_original?: Common.StringifiedBoolean;
  protected_words?: string[];
  protected_words_path?: string;
  split_on_case_change?: boolean;
  split_on_numerics?: boolean;
  stem_english_possessive?: boolean;
  type: 'word_delimiter';
  type_table?: string[];
  type_table_path?: string;
}

