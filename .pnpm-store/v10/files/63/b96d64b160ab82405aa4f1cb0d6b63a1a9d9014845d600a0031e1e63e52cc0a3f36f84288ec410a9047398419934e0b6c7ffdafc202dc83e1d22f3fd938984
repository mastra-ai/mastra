import type { DescMessage } from "../descriptors.js";
import type { BinaryWriteOptions } from "../to-binary.js";
import type { MessageShape } from "../types.js";
import type { BinaryReadOptions } from "../from-binary.js";
/**
 * Serialize a message, prefixing it with its size.
 *
 * A size-delimited message is a varint size in bytes, followed by exactly
 * that many bytes of a message serialized with the binary format.
 *
 * This size-delimited format is compatible with other implementations.
 * For details, see https://github.com/protocolbuffers/protobuf/issues/10229
 */
export declare function sizeDelimitedEncode<Desc extends DescMessage>(messageDesc: Desc, message: MessageShape<Desc>, options?: BinaryWriteOptions): Uint8Array;
/**
 * Parse a stream of size-delimited messages.
 *
 * A size-delimited message is a varint size in bytes, followed by exactly
 * that many bytes of a message serialized with the binary format.
 *
 * This size-delimited format is compatible with other implementations.
 * For details, see https://github.com/protocolbuffers/protobuf/issues/10229
 */
export declare function sizeDelimitedDecodeStream<Desc extends DescMessage>(messageDesc: Desc, iterable: AsyncIterable<Uint8Array>, options?: BinaryReadOptions): AsyncIterableIterator<MessageShape<Desc>>;
/**
 * Decodes the size from the given size-delimited message, which may be
 * incomplete.
 *
 * Returns an object with the following properties:
 * - size: The size of the delimited message in bytes
 * - offset: The offset in the given byte array where the message starts
 * - eof: true
 *
 * If the size-delimited data does not include all bytes of the varint size,
 * the following object is returned:
 * - size: null
 * - offset: null
 * - eof: false
 *
 * This function can be used to implement parsing of size-delimited messages
 * from a stream.
 */
export declare function sizeDelimitedPeek(data: Uint8Array): {
    readonly eof: false;
    readonly size: number;
    readonly offset: number;
} | {
    readonly eof: true;
    readonly size: null;
    readonly offset: null;
};
