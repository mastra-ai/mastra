import type { z } from 'zod';
import type { Tool } from './tool.js';
/**
 * UI tool type for use with AI SDK frontend components
 */
export type UITool = {
    input: unknown;
    output: unknown | undefined;
};
/**
 * Infer the input type of a Mastra tool
 */
export type InferToolInput<T> = T extends Tool<infer I, any, any> ? (I extends z.ZodSchema ? z.infer<I> : never) : never;
/**
 * Infer the output type of a Mastra tool
 */
export type InferToolOutput<T> = T extends Tool<any, infer O, any> ? (O extends z.ZodSchema ? z.infer<O> : never) : never;
/**
 * Infer the input and output types of a tool so it can be used as a UI tool.
 */
export type InferUITool<TOOL> = {
    input: InferToolInput<TOOL>;
    output: InferToolOutput<TOOL>;
};
/**
 * A set of tools (object with tool instances)
 */
export type ToolSet = Record<string, Tool<any, any, any>>;
/**
 * Infer the input and output types of a tool set so it can be used as a UI tool set.
 */
export type InferUITools<TOOLS extends ToolSet> = {
    [NAME in keyof TOOLS & string]: InferUITool<TOOLS[NAME]>;
};
/**
 * UI tools type for frontend components
 */
export type UITools = Record<string, UITool>;
//# sourceMappingURL=ui-types.d.ts.map