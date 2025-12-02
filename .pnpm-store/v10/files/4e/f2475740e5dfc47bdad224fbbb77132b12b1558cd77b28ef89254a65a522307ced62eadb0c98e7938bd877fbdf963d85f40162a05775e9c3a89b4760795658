import type { tags } from "./tags";
export declare class GelError extends Error {
    protected static tags: {
        [tag in tags]?: boolean;
    };
    private _message;
    private _query?;
    private _attrs?;
    constructor(message?: string, options?: {
        cause?: unknown;
    });
    get message(): string;
    get name(): string;
    hasTag(tag: tags): boolean;
}
export type ErrorType = new (msg: string) => GelError;
export declare enum ErrorAttr {
    hint = 1,
    details = 2,
    serverTraceback = 257,
    positionStart = -15,
    positionEnd = -14,
    lineStart = -13,
    columnStart = -12,
    utf16ColumnStart = -11,
    lineEnd = -10,
    columnEnd = -9,
    utf16ColumnEnd = -8,
    characterStart = -7,
    characterEnd = -6
}
export declare function prettyPrintError(attrs: Map<number, Uint8Array | string>, query: string): string;
