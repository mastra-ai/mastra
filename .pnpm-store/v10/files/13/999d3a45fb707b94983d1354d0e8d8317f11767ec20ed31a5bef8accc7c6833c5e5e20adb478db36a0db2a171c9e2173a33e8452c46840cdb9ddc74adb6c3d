import type { TranscriptionModel } from 'ai-v5';
import { MastraVoice } from '../voice.js';
export declare class AISDKTranscription extends MastraVoice {
    private model;
    constructor(model: TranscriptionModel);
    speak(): Promise<NodeJS.ReadableStream>;
    getSpeakers(): Promise<never[]>;
    getListener(): Promise<{
        enabled: boolean;
    }>;
    /**
     * Transcribe audio to text
     * For enhanced metadata (segments, language, duration), use AI SDK's transcribe() directly
     */
    listen(audioStream: NodeJS.ReadableStream, options?: {
        providerOptions?: Record<string, any>;
        abortSignal?: AbortSignal;
        headers?: Record<string, string>;
    }): Promise<string>;
    private convertToBuffer;
}
//# sourceMappingURL=transcription.d.ts.map