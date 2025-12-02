/**
 * Options for transcription
 */
interface TranscriptionSchema extends Record<string, unknown> {
  /**
   * @see https://developers.deepgram.com/docs/model
   */
  model?: string;

  /**
   * @deprecated
   * @see https://developers.deepgram.com/docs/tier
   */
  tier?: string;

  /**
   * @see https://developers.deepgram.com/docs/version
   */
  version?: string;

  /**
   * @see https://developers.deepgram.com/docs/language
   */
  language?: string;

  /**
   * @see https://developers.deepgram.com/docs/punctuation
   */
  punctuate?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/profanity-filter
   */
  profanity_filter?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/redaction
   */
  redact?: string[] | string | boolean;

  /**
   * @see https://developers.deepgram.com/docs/diarization
   */
  diarize?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/diarization
   */
  diarize_version?: string;

  /**
   * @see https://developers.deepgram.com/docs/smart-format
   */
  smart_format?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/filler-words
   */
  filler_words?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/multichannel
   */
  multichannel?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/numerals
   * @deprecated
   */
  numerals?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/search
   */
  search?: string[] | string;

  /**
   * @see https://developers.deepgram.com/docs/find-and-replace
   */
  replace?: string[] | string;

  /**
   * @see https://developers.deepgram.com/docs/callback
   */
  callback?: string;

  /**
   * @see https://developers.deepgram.com/docs/callback#results
   */
  callback_method?: "put" | "post";

  /**
   * @see https://developers.deepgram.com/docs/keywords
   */
  keywords?: string[] | string;

  /**
   * @see https://developers.deepgram.com/docs/keyterm
   */
  keyterm?: string[] | string;

  /**
   * @see https://developers.deepgram.com/docs/tagging
   */
  tag?: string[];

  /**
   * As yet unreleased.
   */
  sentiment?: boolean;

  /**
   * As yet unreleased.
   */
  intents?: boolean;

  /**
   * As yet unreleased.
   */
  custom_intent?: string[] | string;

  /**
   * As yet unreleased.
   */
  custom_intent_mode?: "strict" | "extended";

  /**
   * As yet unreleased.
   */
  topics?: boolean;

  /**
   * As yet unreleased.
   */
  custom_topic?: string[] | string;

  /**
   * As yet unreleased.
   */
  custom_topic_mode?: "strict" | "extended";

  /**
   * @see https://developers.deepgram.com/docs/extra-metadata
   */
  extra?: string[] | string;
}

interface PrerecordedSchema extends TranscriptionSchema {
  /**
   * @see https://developers.deepgram.com/docs/detect-entities
   */
  detect_entities?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/language-detection
   */
  detect_language?: boolean | string[];

  /**
   * @see https://developers.deepgram.com/docs/topic-detection
   */
  detect_topics?: boolean;

  /**
   * Alternatives will run your transcription X number of times and return
   * that many variations of the transcription, allowing for the selection
   * of the most accurate. Cost increases by number of alternatives.
   *
   * @deprecated
   */
  alternatives?: number;

  /**
   * @see https://developers.deepgram.com/docs/paragraphs
   */
  paragraphs?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/summarization
   */
  summarize?: boolean | string;

  /**
   * @see https://developers.deepgram.com/docs/utterances
   */
  utterances?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/utterance-split
   */
  utt_split?: number;

  /**
   * @see https://developers.deepgram.com/docs/smart-format#dictation
   */
  dictation?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/smart-format#measurements
   */
  measurements?: boolean;
}

interface LiveSchema extends TranscriptionSchema {
  /**
   * @see https://developers.deepgram.com/docs/channels
   */
  channels?: number;

  /**
   * @see https://developers.deepgram.com/docs/encoding
   */
  encoding?: string;

  /**
   * @see https://developers.deepgram.com/docs/sample-rate
   */
  sample_rate?: number;

  /**
   * @see https://developers.deepgram.com/docs/endpointing
   */
  endpointing?: false | number;

  /**
   * @see https://developers.deepgram.com/docs/interim-results
   */
  interim_results?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/smart-format#using-no-delay
   */
  no_delay?: boolean;

  /**
   * @see https://developers.deepgram.com/docs/understanding-end-of-speech-detection
   */
  utterance_end_ms?: number;

  /**
   * @see https://developers.deepgram.com/docs/start-of-speech-detection
   */
  vad_events?: boolean;
}

export type { TranscriptionSchema, PrerecordedSchema, LiveSchema };
