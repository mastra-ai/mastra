import { ZodTypeAny, ZodTypeDef, ZodType, ParseInput, ParseReturnType, RawCreateParams } from 'zod';
export declare enum McpZodTypeKind {
    Completable = "McpCompletable"
}
export type CompleteCallback<T extends ZodTypeAny = ZodTypeAny> = (value: T['_input'], context?: {
    arguments?: Record<string, string>;
}) => T['_input'][] | Promise<T['_input'][]>;
export interface CompletableDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
    type: T;
    complete: CompleteCallback<T>;
    typeName: McpZodTypeKind.Completable;
}
export declare class Completable<T extends ZodTypeAny> extends ZodType<T['_output'], CompletableDef<T>, T['_input']> {
    _parse(input: ParseInput): ParseReturnType<this['_output']>;
    unwrap(): T;
    static create: <T_1 extends ZodTypeAny>(type: T_1, params: RawCreateParams & {
        complete: CompleteCallback<T_1>;
    }) => Completable<T_1>;
}
/**
 * Wraps a Zod type to provide autocompletion capabilities. Useful for, e.g., prompt arguments in MCP.
 */
export declare function completable<T extends ZodTypeAny>(schema: T, complete: CompleteCallback<T>): Completable<T>;
//# sourceMappingURL=completable.d.ts.map