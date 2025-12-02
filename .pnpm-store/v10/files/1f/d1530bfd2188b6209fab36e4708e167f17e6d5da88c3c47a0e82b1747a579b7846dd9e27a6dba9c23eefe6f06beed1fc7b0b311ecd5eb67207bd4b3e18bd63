import { type DescField, type DescMessage } from "./descriptors.js";
import type { MessageShape } from "./types.js";
import type { ReflectMessage } from "./reflect/index.js";
import { BinaryReader, WireType } from "./wire/binary-encoding.js";
/**
 * Options for parsing binary data.
 */
export interface BinaryReadOptions {
    /**
     * Retain unknown fields during parsing? The default behavior is to retain
     * unknown fields and include them in the serialized output.
     *
     * For more details see https://developers.google.com/protocol-buffers/docs/proto3#unknowns
     */
    readUnknownFields: boolean;
}
/**
 * Parse serialized binary data.
 */
export declare function fromBinary<Desc extends DescMessage>(schema: Desc, bytes: Uint8Array, options?: Partial<BinaryReadOptions>): MessageShape<Desc>;
/**
 * Parse from binary data, merging fields.
 *
 * Repeated fields are appended. Map entries are added, overwriting
 * existing keys.
 *
 * If a message field is already present, it will be merged with the
 * new data.
 */
export declare function mergeFromBinary<Desc extends DescMessage>(schema: Desc, target: MessageShape<Desc>, bytes: Uint8Array, options?: Partial<BinaryReadOptions>): MessageShape<Desc>;
/**
 * @private
 */
export declare function readField(message: ReflectMessage, reader: BinaryReader, field: DescField, wireType: WireType, options: BinaryReadOptions): void;
