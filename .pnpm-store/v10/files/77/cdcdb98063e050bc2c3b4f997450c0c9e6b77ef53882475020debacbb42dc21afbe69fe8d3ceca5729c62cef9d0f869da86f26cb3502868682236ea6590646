import { Document } from '../schema/index.js';
import type { JsonChunkOptions } from '../types.js';
export declare class RecursiveJsonTransformer {
    private maxSize;
    private minSize;
    private ensureAscii;
    private convertLists;
    constructor({ maxSize, minSize, ensureAscii, convertLists }: JsonChunkOptions);
    private static jsonSize;
    /**
     * Transform JSON data while handling circular references
     */
    transform(data: Record<string, any>): Record<string, any>;
    /**
     * Set a value in a nested dictionary based on the given path
     */
    private static setNestedDict;
    /**
     * Convert lists in the JSON structure to dictionaries with index-based keys
     */
    private listToDictPreprocessing;
    /**
     * Handles primitive values (strings, numbers, etc) by either adding them to the current chunk
     * or creating new chunks if they don't fit
     */
    private handlePrimitiveValue;
    /**
     * Creates a nested dictionary chunk from a value and path
     * e.g., path ['a', 'b'], value 'c' becomes { a: { b: 'c' } }
     */
    private createChunk;
    /**
     * Checks if value is within size limits
     */
    private isWithinSizeLimit;
    /**
     * Splits arrays into chunks based on size limits
     * Handles nested objects by recursing into handleNestedObject
     */
    private handleArray;
    /**
     * Splits objects into chunks based on size limits
     * Handles nested arrays and objects by recursing into handleArray and handleNestedObject
     */
    private handleNestedObject;
    /**
     * Splits long strings into smaller chunks at word boundaries
     * Ensures each chunk is within maxSize limit
     */
    private splitLongString;
    /**
     * Core chunking logic that processes JSON data recursively
     * Handles arrays, objects, and primitive values while maintaining structure
     */
    private jsonSplit;
    /**
     * Splits JSON into a list of JSON chunks
     */
    splitJson({ jsonData, convertLists, }: {
        jsonData: Record<string, any>;
        convertLists?: boolean;
    }): Record<string, any>[];
    /**
     * Converts Unicode characters to their escaped ASCII representation
     * e.g., 'café' becomes 'caf\u00e9'
     */
    private escapeNonAscii;
    /**
     * Splits JSON into a list of JSON formatted strings
     */
    splitText({ jsonData, convertLists, ensureAscii, }: {
        jsonData: Record<string, any>;
        convertLists?: boolean;
        ensureAscii?: boolean;
    }): string[];
    /**
     * Create documents from a list of json objects
     */
    createDocuments({ texts, convertLists, ensureAscii, metadatas, }: {
        texts: string[];
        convertLists?: boolean;
        ensureAscii?: boolean;
        metadatas?: Record<string, any>[];
    }): Document[];
    transformDocuments({ ensureAscii, documents, convertLists, }: {
        ensureAscii?: boolean;
        convertLists?: boolean;
        documents: Document[];
    }): Document[];
}
//# sourceMappingURL=json.d.ts.map