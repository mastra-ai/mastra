export interface SyncPrerecordedResponse {
  metadata: Metadata;
  results: Result;
}

interface Alternative {
  transcript: string;
  confidence: number;
  words: WordBase[];
  summaries?: Summary[];
  paragraphs?: ParagraphGroup;
  entities?: Entity[];
  translations?: Translation[];
  topics?: TopicGroup[];
  languages?: string[];
}

interface Channel {
  search?: Search[];
  alternatives: Alternative[];
  detected_language?: string;
  language_confidence?: number;
}

interface Entity {
  label: string;
  value: string;
  confidence: number;
  start_word: number;
  end_word: number;
}

interface Hit {
  confidence: number;
  start: number;
  end: number;
  snippet: string;
}

interface Metadata {
  transaction_key: string;
  request_id: string;
  sha256: string;
  created: string;
  duration: number;
  channels: number;
  models: string[];
  warnings?: Warning[];
  model_info: Record<string, ModelInfo>;
  summary_info?: SummaryInfo;
  intents_info?: IntentsInfo;
  sentiment_info?: SentimentInfo;
  topics_info?: TopicsInfo;
  extra?: {
    [key: string]: unknown;
  };
}

interface ModelInfo {
  name: string;
  version: string;
  arch: string;
}

interface SummaryInfo {
  input_tokens: number;
  output_tokens: number;
  model_uuid: string;
}

interface IntentsInfo {
  model_uuid: string;
  input_tokens: number;
  output_tokens: number;
}

interface SentimentInfo {
  model_uuid: string;
  input_tokens: number;
  output_tokens: number;
}

interface TopicsInfo {
  model_uuid: string;
  input_tokens: number;
  output_tokens: number;
}

interface Paragraph {
  sentences: Sentence[];
  start: number;
  end: number;
  num_words: number;
  speaker?: number;
}

interface ParagraphGroup {
  transcript: string;
  paragraphs: Paragraph[];
}

interface Result {
  channels: Channel[];
  utterances?: Utterance[];
  summary?: TranscriptionSummary;
  sentiments?: Sentiments;
  topics?: Topics;
  intents?: Intents;
}

interface Sentiments {
  segments: Segment[];
  average: Average;
}

interface Topics {
  segments: Segment[];
}

interface Intents {
  segments: Segment[];
}

interface Intent {
  intent: string;
  confidence_score: number;
}

interface Average {
  sentiment: string;
  sentiment_score: number;
}

interface Topic {
  topic: string;
  confidence_score: number;
}

interface Segment {
  text: string;
  start_word: number;
  end_word: number;
  sentiment?: string;
  sentiment_score?: number;
  topics?: Topic[];
  intents?: Intent[];
}

interface Search {
  query: string;
  hits: Hit[];
}

interface Sentence {
  text: string;
  start: number;
  end: number;
}

interface Summary {
  summary?: string;
  start_word?: number;
  end_word?: number;
}
interface TranscriptionSummary {
  result: string;
  short: string;
}

interface Topic {
  topic: string;
  confidence: number;
}

interface TopicGroup {
  topics: Topic[];
  text: string;
  start_word: number;
  end_word: number;
}

interface Translation {
  language: string;
  translation: string;
}

interface Utterance {
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  words: WordBase[];
  speaker?: number;
  id: string;
}

interface Warning {
  parameter: string;
  type: string;
  message: string;
}

interface WordBase {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word?: string;
  speaker?: number;
  speaker_confidence?: number;
  language?: string;
}
