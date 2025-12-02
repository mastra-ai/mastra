export interface DeepgramResponse {
    metadata: Metadata;
    results: Result;
}
export interface Alternative {
    transcript: string;
    confidence: number;
    words: WordBase[];
    summaries?: Summary[];
    paragraphs?: ParagraphGroup;
    entities?: Entity[];
    translations?: Translation[];
    topics?: TopicGroup[];
}
export interface Channel {
    search?: Search[];
    alternatives: Alternative[];
    detected_language?: string;
}
export interface Entity {
    label: string;
    value: string;
    confidence: number;
    start_word: number;
    end_word: number;
}
export interface Hit {
    confidence: number;
    start: number;
    end: number;
    snippet: string;
}
export interface Metadata {
    transaction_key: string;
    request_id: string;
    sha256: string;
    created: string;
    duration: number;
    channels: number;
    models: string[];
    model_info: Record<string, ModelInfo>;
    warnings?: Warning[];
}
export interface ModelInfo {
    name: string;
    version: string;
    arch: string;
}
export interface Paragraph {
    sentences: Sentence[];
    start: number;
    end: number;
    num_words: number;
}
export interface ParagraphGroup {
    transcript: string;
    paragraphs: Paragraph[];
}
export interface Result {
    channels: Channel[];
    utterances?: Utterance[];
    summary?: TranscriptionSummary;
}
export interface Search {
    query: string;
    hits: Hit[];
}
export interface Sentence {
    text: string;
    start: number;
    end: number;
}
export interface Summary {
    summary?: string;
    start_word?: number;
    end_word?: number;
}
export interface TranscriptionSummary {
    result: string;
    short: string;
}
export interface Topic {
    topic: string;
    confidence: number;
}
export interface TopicGroup {
    topics: Topic[];
    text: string;
    start_word: number;
    end_word: number;
}
export interface Translation {
    language: string;
    translation: string;
}
export interface Utterance {
    start: number;
    end: number;
    confidence: number;
    channel: number;
    transcript: string;
    words: WordBase[];
    speaker?: number;
    id: string;
}
export interface Warning {
    parameter: string;
    type: string;
    message: string;
}
export interface WordBase {
    word: string;
    start: number;
    end: number;
    confidence?: number;
    punctuated_word?: string;
    speaker?: number;
    speaker_confidence?: number;
}
//# sourceMappingURL=types.d.ts.map