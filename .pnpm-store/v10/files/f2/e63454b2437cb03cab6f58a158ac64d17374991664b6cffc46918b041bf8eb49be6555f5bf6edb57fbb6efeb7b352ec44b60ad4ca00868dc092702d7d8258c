import type { Chunk } from './types.js';
/**
 * SourceFile exposes the API to slice the contents of a file
 * into chunks for displaying the source code of a stack
 * frame
 */
export declare class SourceFile {
    #private;
    constructor(options: {
        contents?: string;
    });
    /**
     * Slice the file contents for the buffer size around a given
     * line number.
     *
     * @example
     * ```ts
     * const chunks = sourceFile.slice(11, 7)
     * // Here chunks will be an array of 7 items from line number
     * // 8 to 14
     * ```
     */
    slice(lineNumber: number, bufferSize: number): undefined | Chunk[];
}
