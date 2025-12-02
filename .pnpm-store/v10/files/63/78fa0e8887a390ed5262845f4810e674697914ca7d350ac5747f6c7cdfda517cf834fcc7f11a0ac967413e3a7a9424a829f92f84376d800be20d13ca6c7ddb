import type { SpeechModel } from 'ai-v5';
import { MastraVoice } from '../voice.js';
export declare class AISDKSpeech extends MastraVoice {
    private model;
    private defaultVoice?;
    constructor(model: SpeechModel, options?: {
        voice?: string;
    });
    speak(input: string | NodeJS.ReadableStream, options?: {
        speaker?: string;
        language?: string;
        providerOptions?: Record<string, any>;
        abortSignal?: AbortSignal;
        headers?: Record<string, string>;
    }): Promise<NodeJS.ReadableStream>;
    listen(): Promise<string>;
    getSpeakers(): Promise<never[]>;
    getListener(): Promise<{
        enabled: boolean;
    }>;
    private streamToText;
}
//# sourceMappingURL=speech.d.ts.map