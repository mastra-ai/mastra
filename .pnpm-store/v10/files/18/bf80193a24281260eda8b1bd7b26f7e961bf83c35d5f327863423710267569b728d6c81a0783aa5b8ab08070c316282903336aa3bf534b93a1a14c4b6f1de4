import type { GenEnum as GenEnumV1, GenExtension as GenExtensionV1, GenMessage as GenMessageV1 } from "./codegenv1/types.js";
import type { GenEnum as GenEnumV2, GenExtension as GenExtensionV2, GenMessage as GenMessageV2 } from "./codegenv2/types.js";
import type { DescEnum, DescExtension, DescMessage, DescMethod } from "./descriptors.js";
import type { OneofADT } from "./reflect/guard.js";
import type { WireType } from "./wire/index.js";
import type { JsonValue } from "./json-value.js";
/**
 * The type `Message` contains the properties shared by all messages.
 */
export type Message<TypeName extends string = string> = {
    /**
     * The fully qualified Protobuf type-name of the message.
     */
    readonly $typeName: TypeName;
    /**
     * Unknown fields and extensions stored on the message.
     */
    $unknown?: UnknownField[];
};
/**
 * Extract the message type from a message descriptor.
 */
export type MessageShape<Desc extends DescMessage> = Desc extends GenMessageV1<infer RuntimeShapeV1> ? RuntimeShapeV1 : Desc extends GenMessageV2<infer RuntimeShape> ? RuntimeShape : Message;
/**
 * Extract the message JSON type from a message descriptor.
 *
 * JSON types are only available for code generated with the plugin option
 * `json_types=true`. If JSON types are unavailable, this type falls back to the
 * `JsonValue` type.
 */
export type MessageJsonType<Desc extends DescMessage> = Desc extends GenMessageV1<Message, infer JsonTypeV1 extends JsonValue> ? JsonTypeV1 : Desc extends GenMessageV2<Message, {
    jsonType: infer JsonType extends JsonValue;
}> ? JsonType : JsonValue;
/**
 * Extract the message Valid type from a message descriptor.
 *
 * Valid types are only available for code generated with the plugin option
 * `valid_types`. If Valid types are unavailable, this type falls back to the
 * regular message shape.
 */
export type MessageValidType<Desc extends DescMessage> = Desc extends GenMessageV1<infer RuntimeShapeV1> ? RuntimeShapeV1 : Desc extends GenMessageV2<Message, {
    validType: infer ValidType extends Message;
}> ? ValidType : Desc extends GenMessageV2<infer RuntimeShape> ? RuntimeShape : Message;
/**
 * Extract the init type from a message descriptor.
 * The init type is accepted by the function create().
 */
export type MessageInitShape<Desc extends DescMessage> = Desc extends GenMessageV1<infer RuntimeShape> ? MessageInit<RuntimeShape> : Desc extends GenMessageV2<infer RuntimeShape> ? MessageInit<RuntimeShape> : Record<string, unknown>;
/**
 * Extract the enum type of from an enum descriptor.
 */
export type EnumShape<Desc extends DescEnum> = Desc extends GenEnumV1<infer RuntimeShape> ? RuntimeShape : Desc extends GenEnumV2<infer RuntimeShape> ? RuntimeShape : number;
/**
 * Extract the enum JSON type from a enum descriptor.
 */
export type EnumJsonType<Desc extends DescEnum> = Desc extends GenEnumV1<number, infer JsonType> ? JsonType : Desc extends GenEnumV2<number, infer JsonType> ? JsonType : string | null;
/**
 * Extract the value type from an extension descriptor.
 */
export type ExtensionValueShape<Desc extends DescExtension> = Desc extends GenExtensionV1<Message, infer RuntimeShape> ? RuntimeShape : Desc extends GenExtensionV2<Message, infer RuntimeShape> ? RuntimeShape : unknown;
/**
 * Extract the type of the extended message from an extension descriptor.
 */
export type Extendee<Desc extends DescExtension> = Desc extends GenExtensionV1<infer Extendee> ? Extendee : Desc extends GenExtensionV2<infer Extendee> ? Extendee : Message;
/**
 * Unknown fields are fields that were not recognized during parsing, or
 * extension.
 */
export type UnknownField = {
    readonly no: number;
    readonly wireType: WireType;
    readonly data: Uint8Array;
};
/**
 * Describes a streaming RPC declaration.
 */
export type DescMethodStreaming<I extends DescMessage = DescMessage, O extends DescMessage = DescMessage> = DescMethodClientStreaming<I, O> | DescMethodServerStreaming<I, O> | DescMethodBiDiStreaming<I, O>;
/**
 * Describes a unary RPC declaration.
 */
export type DescMethodUnary<I extends DescMessage = DescMessage, O extends DescMessage = DescMessage> = DescMethodTyped<"unary", I, O>;
/**
 * Describes a server streaming RPC declaration.
 */
export type DescMethodServerStreaming<I extends DescMessage = DescMessage, O extends DescMessage = DescMessage> = DescMethodTyped<"server_streaming", I, O>;
/**
 * Describes a client streaming RPC declaration.
 */
export type DescMethodClientStreaming<I extends DescMessage = DescMessage, O extends DescMessage = DescMessage> = DescMethodTyped<"client_streaming", I, O>;
/**
 * Describes a bidi streaming RPC declaration.
 */
export type DescMethodBiDiStreaming<I extends DescMessage = DescMessage, O extends DescMessage = DescMessage> = DescMethodTyped<"bidi_streaming", I, O>;
/**
 * The init type for a message, which makes all fields optional.
 * The init type is accepted by the function create().
 */
type MessageInit<T extends Message> = T | {
    [P in keyof T as P extends "$unknown" ? never : P]?: P extends "$typeName" ? never : FieldInit<T[P]>;
};
type FieldInit<F> = F extends (Date | Uint8Array | bigint | boolean | string | number) ? F : F extends Array<infer U> ? Array<FieldInit<U>> : F extends ReadonlyArray<infer U> ? ReadonlyArray<FieldInit<U>> : F extends Message ? MessageInit<F> : F extends OneofSelectedMessage<infer C, infer V> ? {
    case: C;
    value: MessageInit<V>;
} : F extends OneofADT ? F : F extends MapWithMessage<infer V> ? {
    [key: string | number]: MessageInit<V>;
} : F;
type MapWithMessage<V extends Message> = {
    [key: string | number]: V;
};
type OneofSelectedMessage<K extends string, M extends Message> = {
    case: K;
    value: M;
};
type DescMethodTyped<K extends DescMethod["methodKind"], I extends DescMessage, O extends DescMessage> = Omit<DescMethod, "methodKind" | "input" | "output"> & {
    /**
     * One of the four available method types.
     */
    readonly methodKind: K;
    /**
     * The message type for requests.
     */
    readonly input: I;
    /**
     * The message type for responses.
     */
    readonly output: O;
};
export {};
