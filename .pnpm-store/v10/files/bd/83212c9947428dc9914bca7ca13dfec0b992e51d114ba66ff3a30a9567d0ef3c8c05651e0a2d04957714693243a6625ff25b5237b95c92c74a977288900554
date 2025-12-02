import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import type { RegisteredLogger } from '../../../logger/index.js';
import { MastraModelInput } from '../../base/index.js';
import type { ChunkType } from '../../types.js';
export declare class AISDKV5InputStream extends MastraModelInput {
    constructor({ component, name }: {
        component: RegisteredLogger;
        name: string;
    });
    transform({ runId, stream, controller, }: {
        runId: string;
        stream: ReadableStream<LanguageModelV2StreamPart>;
        controller: ReadableStreamDefaultController<ChunkType>;
    }): Promise<void>;
}
//# sourceMappingURL=input.d.ts.map