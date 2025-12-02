import type { Message } from "../types.js";
import type { DescEnum, DescEnumValue, DescExtension, DescField, DescFile, DescMessage, DescMethod, DescService } from "../descriptors.js";
import type { JsonValue } from "../json-value.js";
/**
 * Describes a protobuf source file.
 *
 * @private
 */
export type GenFile = DescFile;
/**
 * Describes a message declaration in a protobuf source file.
 *
 * This type is identical to DescMessage, but carries additional type
 * information.
 *
 * @private
 */
export type GenMessage<RuntimeShape extends Message, Opt extends {
    jsonType?: unknown;
    validType?: unknown;
} = {
    jsonType?: unknown;
    validType?: unknown;
}> = Omit<DescMessage, "field" | "typeName"> & {
    field: Record<MessageFieldNames<RuntimeShape>, DescField>;
    typeName: RuntimeShape["$typeName"];
} & brandv2<RuntimeShape, Opt>;
/**
 * Describes an enumeration in a protobuf source file.
 *
 * This type is identical to DescEnum, but carries additional type
 * information.
 *
 * @private
 */
export type GenEnum<RuntimeShape extends number, JsonType extends JsonValue = JsonValue> = Omit<DescEnum, "value"> & {
    value: Record<RuntimeShape, DescEnumValue>;
} & brandv2<RuntimeShape, JsonType>;
/**
 * Describes an extension in a protobuf source file.
 *
 * This type is identical to DescExtension, but carries additional type
 * information.
 *
 * @private
 */
export type GenExtension<Extendee extends Message = Message, RuntimeShape = unknown> = DescExtension & brandv2<Extendee, RuntimeShape>;
/**
 * Describes a service declaration in a protobuf source file.
 *
 * This type is identical to DescService, but carries additional type
 * information.
 *
 * @private
 */
export type GenService<RuntimeShape extends GenServiceMethods> = Omit<DescService, "method"> & {
    method: {
        [K in keyof RuntimeShape]: RuntimeShape[K] & DescMethod;
    };
};
/**
 * @private
 */
export type GenServiceMethods = Record<string, Pick<DescMethod, "input" | "output" | "methodKind">>;
declare class brandv2<A, B = unknown> {
    protected v: "codegenv2";
    protected a: A | boolean;
    protected b: B | boolean;
}
/**
 * Union of the property names of all fields, including oneof members.
 * For an anonymous message (no generated message shape), it's simply a string.
 */
type MessageFieldNames<T extends Message> = Message extends T ? string : Exclude<keyof {
    [P in keyof T as P extends ("$typeName" | "$unknown") ? never : T[P] extends Oneof<infer K> ? K : P]-?: true;
}, number | symbol>;
type Oneof<K extends string> = {
    case: K | undefined;
    value?: unknown;
};
export {};
