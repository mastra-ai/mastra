import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
export declare const baseSchema: {
    queryText: z.ZodString;
    topK: z.ZodNumber;
};
export declare const outputSchema: z.ZodObject<{
    relevantContext: z.ZodAny;
    sources: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        metadata: z.ZodAny;
        vector: z.ZodArray<z.ZodNumber, "many">;
        score: z.ZodNumber;
        document: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        vector: number[];
        score: number;
        document: string;
        metadata?: any;
    }, {
        id: string;
        vector: number[];
        score: number;
        document: string;
        metadata?: any;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    sources: {
        id: string;
        vector: number[];
        score: number;
        document: string;
        metadata?: any;
    }[];
    relevantContext?: any;
}, {
    sources: {
        id: string;
        vector: number[];
        score: number;
        document: string;
        metadata?: any;
    }[];
    relevantContext?: any;
}>;
export declare const filterSchema: z.ZodObject<{
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
}>;
export type RagTool<TInput extends z.ZodType<any, z.ZodTypeDef, any> | undefined, TOutput extends z.ZodType<any, z.ZodTypeDef, any> | undefined> = Tool<TInput, TOutput> & {
    execute: NonNullable<Tool<TInput, TOutput>['execute']>;
};
//# sourceMappingURL=tool-schemas.d.ts.map