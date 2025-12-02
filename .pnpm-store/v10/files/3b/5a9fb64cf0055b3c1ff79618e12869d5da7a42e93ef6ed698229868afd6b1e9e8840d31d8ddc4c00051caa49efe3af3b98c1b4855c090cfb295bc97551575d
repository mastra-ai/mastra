import type { Message, MessageShape } from "../types.js";
import type { Any } from "./gen/google/protobuf/any_pb.js";
import type { DescMessage } from "../descriptors.js";
import type { Registry } from "../registry.js";
/**
 * Creates a `google.protobuf.Any` from a message.
 */
export declare function anyPack<Desc extends DescMessage>(schema: Desc, message: MessageShape<Desc>): Any;
/**
 * Packs the message into the given any.
 */
export declare function anyPack<Desc extends DescMessage>(schema: Desc, message: MessageShape<Desc>, into: Any): void;
/**
 * Returns true if the Any contains the type given by schema.
 */
export declare function anyIs(any: Any, schema: DescMessage): boolean;
/**
 * Returns true if the Any contains a message with the given typeName.
 */
export declare function anyIs(any: Any, typeName: string): boolean;
/**
 * Unpacks the message the Any represents.
 *
 * Returns undefined if the Any is empty, or if packed type is not included
 * in the given registry.
 */
export declare function anyUnpack(any: Any, registry: Registry): Message | undefined;
/**
 * Unpacks the message the Any represents.
 *
 * Returns undefined if the Any is empty, or if it does not contain the type
 * given by schema.
 */
export declare function anyUnpack<Desc extends DescMessage>(any: Any, schema: Desc): MessageShape<Desc> | undefined;
/**
 * Same as anyUnpack but unpacks into the target message.
 */
export declare function anyUnpackTo<Desc extends DescMessage>(any: Any, schema: Desc, message: MessageShape<Desc>): MessageShape<Desc> | undefined;
