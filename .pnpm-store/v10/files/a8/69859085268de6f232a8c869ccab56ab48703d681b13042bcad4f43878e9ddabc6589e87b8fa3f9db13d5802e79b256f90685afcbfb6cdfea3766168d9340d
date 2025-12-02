import { z } from 'zod';
import type { RagTool } from '../utils/index.js';
import type { VectorQueryToolOptions } from './types.js';
export declare const createVectorQueryTool: (options: VectorQueryToolOptions) => RagTool<z.ZodObject<{
    filter: z.ZodString;
    queryText: z.ZodString;
    topK: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    filter: string;
    topK: number;
    queryText: string;
}, {
    filter: string;
    topK: number;
    queryText: string;
}> | z.ZodObject<{
    queryText: z.ZodString;
    topK: z.ZodNumber;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    queryText: z.ZodString;
    topK: z.ZodNumber;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    queryText: z.ZodString;
    topK: z.ZodNumber;
}, z.ZodTypeAny, "passthrough">>, any>;
//# sourceMappingURL=vector-query.d.ts.map