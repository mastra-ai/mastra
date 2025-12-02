import { TransformStream } from 'stream/web';
import type { StructuredOutputOptions } from '../../agent/types.js';
import type { IMastraLogger } from '../../logger/index.js';
import type { ChunkType } from '../types.js';
import type { OutputSchema } from './schema.js';
/**
 * Transforms raw text-delta chunks into structured object chunks for JSON mode streaming.
 *
 * For JSON response formats, this transformer:
 * - Accumulates text deltas and parses them as partial JSON
 * - Emits 'object' chunks when the parsed structure changes
 * - For arrays: filters incomplete elements and unwraps from {elements: [...]} wrapper
 * - For objects: emits the parsed object directly
 * - For enums: unwraps from {result: ""} wrapper and provides partial matching
 * - Always passes through original chunks for downstream processing
 */
export declare function createObjectStreamTransformer<OUTPUT extends OutputSchema = undefined>({ structuredOutput, logger, }: {
    structuredOutput?: StructuredOutputOptions<OUTPUT>;
    logger?: IMastraLogger;
}): TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>;
/**
 * Transforms object chunks into JSON text chunks for streaming.
 *
 * This transformer:
 * - For arrays: emits opening bracket, new elements, and closing bracket
 * - For objects/no-schema: emits the object as JSON
 */
export declare function createJsonTextStreamTransformer<OUTPUT extends OutputSchema = undefined>(schema?: OUTPUT): TransformStream<ChunkType<OUTPUT>, string>;
//# sourceMappingURL=output-format-handlers.d.ts.map