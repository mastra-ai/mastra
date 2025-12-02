import type { MessageShape } from "./types.js";
import type { DescMessage } from "./descriptors.js";
/**
 * Merge message `source` into message `target`, following Protobuf semantics.
 *
 * This is the same as serializing the source message, then deserializing it
 * into the target message via `mergeFromBinary()`, with one difference:
 * While serialization will create a copy of all values, `merge()` will copy
 * the reference for `bytes` and messages.
 *
 * Also see https://protobuf.com/docs/language-spec#merging-protobuf-messages
 */
export declare function merge<Desc extends DescMessage>(schema: Desc, target: MessageShape<Desc>, source: MessageShape<Desc>): void;
