import type { MessageShape } from "./types.js";
import { BinaryWriter } from "./wire/binary-encoding.js";
import { type DescField, type DescMessage } from "./descriptors.js";
import type { ReflectMessage } from "./reflect/index.js";
/**
 * Options for serializing to binary data.
 *
 * V1 also had the option `readerFactory` for using a custom implementation to
 * encode to binary.
 */
export interface BinaryWriteOptions {
    /**
     * Include unknown fields in the serialized output? The default behavior
     * is to retain unknown fields and include them in the serialized output.
     *
     * For more details see https://developers.google.com/protocol-buffers/docs/proto3#unknowns
     */
    writeUnknownFields: boolean;
}
export declare function toBinary<Desc extends DescMessage>(schema: Desc, message: MessageShape<Desc>, options?: Partial<BinaryWriteOptions>): Uint8Array<ArrayBuffer>;
/**
 * @private
 */
export declare function writeField(writer: BinaryWriter, opts: BinaryWriteOptions, msg: ReflectMessage, field: DescField): void;
