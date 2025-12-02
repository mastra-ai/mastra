/// <reference types="node" />
/// <reference types="node" />
/**
 * Transcoders provide functionality for converting values passed to and from
 * the SDK to byte arrays and flags data that can be stored to the server.
 *
 * @category Key-Value
 */
export interface Transcoder {
    /**
     * Encodes the specified value, returning a buffer and flags that are
     * stored to the server and later used for decoding.
     *
     * @param value The value to encode.
     */
    encode(value: any): [Buffer, number];
    /**
     * Decodes a buffer and flags tuple back to the original type of the
     * document.
     *
     * @param bytes The bytes that were previously encoded.
     * @param flags The flags associated with the data.
     */
    decode(bytes: Buffer, flags: number): any;
}
/**
 * The default transcoder implements cross-sdk transcoding capabilities by
 * taking advantage of the common flags specification to ensure compatibility.
 * This transcoder is capable of encoding/decoding any value which is encodable
 * to JSON, and additionally has special-case handling for Buffer objects.
 *
 * @category Key-Value
 */
export declare class DefaultTranscoder implements Transcoder {
    /**
     * Encodes the specified value, returning a buffer and flags that are
     * stored to the server and later used for decoding.
     *
     * @param value The value to encode.
     */
    encode(value: any): [Buffer, number];
    /**
     * Decodes a buffer and flags tuple back to the original type of the
     * document.
     *
     * @param bytes The bytes that were previously encoded.
     * @param flags The flags associated with the data.
     */
    decode(bytes: Buffer, flags: number): any;
}
/**
 * The raw binary transcoder provides an explicit mechanism for storing and retrieving raw
 * byte data.
 *
 * @category Key-Value
 */
export declare class RawBinaryTranscoder implements Transcoder {
    /**
     * Encodes the specified value, returning a buffer and flags that are
     * stored to the server and later used for decoding.
     *
     * @param value The value to encode.
     */
    encode(value: Buffer): [Buffer, number];
    /**
     * Decodes a buffer and flags tuple back to the original type of the
     * document.
     *
     * @param bytes The bytes that were previously encoded.
     * @param flags The flags associated with the data.
     */
    decode(bytes: Buffer, flags: number): any;
}
/**
 * The raw string transcoder provides an explicit mechanism for storing and retrieving raw
 * string data.
 *
 * @category Key-Value
 */
export declare class RawStringTranscoder implements Transcoder {
    /**
     * Encodes the specified value, returning a buffer and flags that are
     * stored to the server and later used for decoding.
     *
     * @param value The value to encode.
     */
    encode(value: string): [Buffer, number];
    /**
     * Decodes a buffer and flags tuple back to the original type of the
     * document.
     *
     * @param bytes The bytes that were previously encoded.
     * @param flags The flags associated with the data.
     */
    decode(bytes: Buffer, flags: number): string;
}
/**
 * The raw JSON transcoder provides an explicit mechanism for storing and retrieving JSON data.
 *
 * @category Key-Value
 */
export declare class RawJsonTranscoder implements Transcoder {
    /**
     * Encodes the specified value, returning a buffer and flags that are
     * stored to the server and later used for decoding.
     *
     * @param value The value to encode.
     */
    encode(value: string): [Buffer, number];
    /**
     * Decodes a buffer and flags tuple back to the original type of the
     * document.
     *
     * @param bytes The bytes that were previously encoded.
     * @param flags The flags associated with the data.
     */
    decode(bytes: Buffer, flags: number): Buffer;
}
