import type { AnyDesc, DescEnum, DescExtension, DescFile, DescMessage, DescService } from "../descriptors.js";
/**
 * Iterate over all types - enumerations, extensions, services, messages -
 * and enumerations, extensions and messages nested in messages.
 */
export declare function nestedTypes(desc: DescFile | DescMessage): Iterable<DescMessage | DescEnum | DescExtension | DescService>;
/**
 * Iterate over types referenced by fields of the given message.
 *
 * For example:
 *
 * ```proto
 * syntax="proto3";
 *
 * message Example {
 *   Msg singular = 1;
 *   repeated Level list = 2;
 * }
 *
 * message Msg {}
 *
 * enum Level {
 *   LEVEL_UNSPECIFIED = 0;
 * }
 * ```
 *
 * The message Example references the message Msg, and the enum Level.
 */
export declare function usedTypes(descMessage: DescMessage): Iterable<DescMessage | DescEnum>;
/**
 * Returns the ancestors of a given Protobuf element, up to the file.
 */
export declare function parentTypes(desc: AnyDesc): Parent[];
type Parent = DescFile | DescEnum | DescMessage | DescService;
export {};
