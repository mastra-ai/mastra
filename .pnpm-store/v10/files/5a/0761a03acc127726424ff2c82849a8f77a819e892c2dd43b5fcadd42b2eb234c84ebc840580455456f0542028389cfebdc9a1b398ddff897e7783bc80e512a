import type { FinishReason, LanguageModelResponseMetadata, LanguageModelUsage } from 'ai-v5';
import type { loop } from '../loop.js';
export declare function verifyNoObjectGeneratedError(error: unknown, expected: {
    message: string;
    response: LanguageModelResponseMetadata & {
        body?: string;
    };
    usage: LanguageModelUsage;
    finishReason: FinishReason;
}): void;
export declare function streamObjectTests({ loopFn, runId }: {
    loopFn: typeof loop;
    runId: string;
}): void;
//# sourceMappingURL=streamObject.d.ts.map