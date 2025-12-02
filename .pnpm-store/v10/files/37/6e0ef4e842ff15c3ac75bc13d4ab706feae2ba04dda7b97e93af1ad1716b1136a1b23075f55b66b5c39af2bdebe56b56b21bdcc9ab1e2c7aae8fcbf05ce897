export interface LiveTranscriptionEvent {
    type: "Results";
    channel_index: number[];
    duration: number;
    start: number;
    is_final?: boolean;
    speech_final?: boolean;
    channel: {
        alternatives: {
            transcript: string;
            confidence: number;
            languages: string[];
            words: {
                word: string;
                start: number;
                end: number;
                confidence: number;
                language: string;
                punctuated_word: string;
                speaker?: number;
            }[];
        }[];
    };
    metadata: {
        request_id: string;
        model_info: {
            name: string;
            version: string;
            arch: string;
        };
        model_uuid: string;
    };
    from_finalize?: boolean;
}
//# sourceMappingURL=LiveTranscriptionEvent.d.ts.map