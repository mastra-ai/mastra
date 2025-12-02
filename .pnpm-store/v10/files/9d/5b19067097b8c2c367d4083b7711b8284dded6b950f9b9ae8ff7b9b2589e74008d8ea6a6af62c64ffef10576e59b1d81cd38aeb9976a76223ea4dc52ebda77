export interface SyncAnalyzeResponse {
    model_uuid: string;
    metadata: Metadata;
    results: Results;
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
interface SummaryInfo {
    model_uuid: string;
    input_tokens: number;
    output_tokens: number;
}
interface TopicsInfo {
    model_uuid: string;
    input_tokens: number;
    output_tokens: number;
}
interface Metadata {
    request_id: string;
    created: string;
    language: string;
    intents_info: IntentsInfo;
    sentiment_info: SentimentInfo;
    summary_info: SummaryInfo;
    topics_info: TopicsInfo;
    extra?: {
        [key: string]: unknown;
    };
}
interface Average {
    sentiment: string;
    sentiment_score: number;
}
interface Summary {
    text: string;
}
interface Topic {
    topic: string;
    confidence_score: number;
}
interface Intent {
    intent: string;
    confidence_score: number;
}
interface Segment {
    text: string;
    start_word: number;
    end_word: number;
    sentiment: "positive" | "neutral" | "negative";
    sentiment_score?: number;
    topics?: Topic[];
    intents?: Intent[];
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
interface Results {
    sentiments?: Sentiments;
    summary?: Summary;
    topics?: Topics;
    intents?: Intents;
}
export {};
//# sourceMappingURL=SyncAnalyzeResponse.d.ts.map