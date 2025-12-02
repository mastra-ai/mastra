import type { DescriptorProto, Edition, EnumDescriptorProto, EnumValueDescriptorProto, FeatureSet_FieldPresence, FieldDescriptorProto, FileDescriptorProto, MethodDescriptorProto, MethodOptions_IdempotencyLevel, OneofDescriptorProto, ServiceDescriptorProto } from "./wkt/gen/google/protobuf/descriptor_pb.js";
import type { ScalarValue } from "./reflect/scalar.js";
export type SupportedEdition = Extract<Edition, Edition.EDITION_PROTO2 | Edition.EDITION_PROTO3 | Edition.EDITION_2023 | Edition.EDITION_2024>;
type SupportedFieldPresence = Extract<FeatureSet_FieldPresence, FeatureSet_FieldPresence.EXPLICIT | FeatureSet_FieldPresence.IMPLICIT | FeatureSet_FieldPresence.LEGACY_REQUIRED>;
/**
 * Scalar value types. This is a subset of field types declared by protobuf
 * enum google.protobuf.FieldDescriptorProto.Type The types GROUP and MESSAGE
 * are omitted, but the numerical values are identical.
 */
export declare enum ScalarType {
    DOUBLE = 1,
    FLOAT = 2,
    INT64 = 3,
    UINT64 = 4,
    INT32 = 5,
    FIXED64 = 6,
    FIXED32 = 7,
    BOOL = 8,
    STRING = 9,
    BYTES = 12,
    UINT32 = 13,
    SFIXED32 = 15,
    SFIXED64 = 16,
    SINT32 = 17,// Uses ZigZag encoding.
    SINT64 = 18
}
/**
 * A union of all descriptors, discriminated by a `kind` property.
 */
export type AnyDesc = DescFile | DescEnum | DescEnumValue | DescMessage | DescField | DescExtension | DescOneof | DescService | DescMethod;
/**
 * Describes a protobuf source file.
 */
export interface DescFile {
    readonly kind: "file";
    /**
     * The edition of the protobuf file. Will be EDITION_PROTO2 for syntax="proto2",
     * EDITION_PROTO3 for syntax="proto3";
     */
    readonly edition: SupportedEdition;
    /**
     * The name of the file, excluding the .proto suffix.
     * For a protobuf file `foo/bar.proto`, this is `foo/bar`.
     */
    readonly name: string;
    /**
     * Files imported by this file.
     */
    readonly dependencies: DescFile[];
    /**
     * Top-level enumerations declared in this file.
     * Note that more enumerations might be declared within message declarations.
     */
    readonly enums: DescEnum[];
    /**
     * Top-level messages declared in this file.
     * Note that more messages might be declared within message declarations.
     */
    readonly messages: DescMessage[];
    /**
     * Top-level extensions declared in this file.
     * Note that more extensions might be declared within message declarations.
     */
    readonly extensions: DescExtension[];
    /**
     * Services declared in this file.
     */
    readonly services: DescService[];
    /**
     * Marked as deprecated in the protobuf source.
     */
    readonly deprecated: boolean;
    /**
     * The compiler-generated descriptor.
     */
    readonly proto: FileDescriptorProto;
    toString(): string;
}
/**
 * Describes an enumeration in a protobuf source file.
 */
export interface DescEnum {
    readonly kind: "enum";
    /**
     * The fully qualified name of the enumeration. (We omit the leading dot.)
     */
    readonly typeName: string;
    /**
     * The name of the enumeration, as declared in the protobuf source.
     */
    readonly name: string;
    /**
     * The file this enumeration was declared in.
     */
    readonly file: DescFile;
    /**
     * The parent message, if this enumeration was declared inside a message declaration.
     */
    readonly parent: DescMessage | undefined;
    /**
     * Enumerations can be open or closed.
     * See https://protobuf.dev/programming-guides/enum/
     */
    readonly open: boolean;
    /**
     * Values declared for this enumeration.
     */
    readonly values: DescEnumValue[];
    /**
     * All values of this enum by their number.
     */
    readonly value: Record<number, DescEnumValue>;
    /**
     * A prefix shared by all enum values.
     * For example, `my_enum_` for `enum MyEnum {MY_ENUM_A=0; MY_ENUM_B=1;}`
     */
    readonly sharedPrefix?: string;
    /**
     * Marked as deprecated in the protobuf source.
     */
    readonly deprecated: boolean;
    /**
     * The compiler-generated descriptor.
     */
    readonly proto: EnumDescriptorProto;
    toString(): string;
}
/**
 * Describes an individual value of an enumeration in a protobuf source file.
 */
export interface DescEnumValue {
    readonly kind: "enum_value";
    /**
     * The name of the enumeration value, as specified in the protobuf source.
     */
    readonly name: string;
    /**
     * A safe and idiomatic name for the value in a TypeScript enum.
     */
    readonly localName: string;
    /**
     * The enumeration this value belongs to.
     */
    readonly parent: DescEnum;
    /**
     * The numeric enumeration value, as specified in the protobuf source.
     */
    readonly number: number;
    /**
     * Marked as deprecated in the protobuf source.
     */
    readonly deprecated: boolean;
    /**
     * The compiler-generated descriptor.
     */
    readonly proto: EnumValueDescriptorProto;
    toString(): string;
}
/**
 * Describes a message declaration in a protobuf source file.
 */
export interface DescMessage {
    readonly kind: "message";
    /**
     * The fully qualified name of the message. (We omit the leading dot.)
     */
    readonly typeName: string;
    /**
     * The name of the message, as specified in the protobuf source.
     */
    readonly name: string;
    /**
     * The file this message was declared in.
     */
    readonly file: DescFile;
    /**
     * The parent message, if this message was declared inside a message declaration.
     */
    readonly parent: DescMessage | undefined;
    /**
     * Fields declared for this message, including fields declared in a oneof
     * group.
     */
    readonly fields: DescField[];
    /**
     * All fields of this message by their "localName".
     */
    readonly field: Record<string, DescField>;
    /**
     * Oneof groups declared for this message.
     * This does not include synthetic oneofs for proto3 optionals.
     */
    readonly oneofs: DescOneof[];
    /**
     * Fields and oneof groups for this message, ordered by their appearance in the
     * protobuf source.
     */
    readonly members: (DescField | DescOneof)[];
    /**
     * Enumerations declared within the message, if any.
     */
    readonly nestedEnums: DescEnum[];
    /**
     * Messages declared within the message, if any.
     * This does not include synthetic messages like map entries.
     */
    readonly nestedMessages: DescMessage[];
    /**
     * Extensions declared within the message, if any.
     */
    readonly nestedExtensions: DescExtension[];
    /**
     * Marked as deprecated in the protobuf source.
     */
    readonly deprecated: boolean;
    /**
     * The compiler-generated descriptor.
     */
    readonly proto: DescriptorProto;
    toString(): string;
}
/**
 * Describes a field declaration in a protobuf source file.
 */
export type DescField = (descFieldScalar & descFieldCommon) | (descFieldList & descFieldCommon) | (descFieldMessage & descFieldCommon) | (descFieldEnum & descFieldCommon) | (descFieldMap & descFieldCommon);
type descFieldCommon = descFieldAndExtensionShared & {
    readonly kind: "field";
    /**
     * The message this field is declared on.
     */
    readonly parent: DescMessage;
    /**
     * A safe and idiomatic name for the field as a property in ECMAScript.
     */
    readonly localName: string;
};
/**
 * Describes an extension in a protobuf source file.
 */
export type DescExtension = (Omit<descFieldScalar, "oneof"> & descExtensionCommon) | (Omit<descFieldEnum, "oneof"> & descExtensionCommon) | (Omit<descFieldMessage, "oneof"> & descExtensionCommon) | (descFieldList & descExtensionCommon);
type descExtensionCommon = descFieldAndExtensionShared & {
    readonly kind: "extension";
    /**
     * The fully qualified name of the extension.
     */
    readonly typeName: string;
    /**
     * The file this extension was declared in.
     */
    readonly file: DescFile;
    /**
     * The parent message, if this extension was declared inside a message declaration.
     */
    readonly parent: DescMessage | undefined;
    /**
     * The message that this extension extends.
     */
    readonly extendee: DescMessage;
    /**
     * The `oneof` group this field belongs to, if any.
     */
    readonly oneof: undefined;
};
interface descFieldAndExtensionShared {
    /**
     * The field name, as specified in the protobuf source
     */
    readonly name: string;
    /**
     * The field number, as specified in the protobuf source.
     */
    readonly number: number;
    /**
     * The field name in JSON.
     */
    readonly jsonName: string;
    /**
     * Marked as deprecated in the protobuf source.
     */
    readonly deprecated: boolean;
    /**
     * Presence of the field.
     * See https://protobuf.dev/programming-guides/field_presence/
     */
    readonly presence: SupportedFieldPresence;
    /**
     * The compiler-generated descriptor.
     */
    readonly proto: FieldDescriptorProto;
    /**
     * Get the edition features for this protobuf element.
     */
    toString(): string;
}
type descFieldSingularCommon = {
    /**
     * The `oneof` group this field belongs to, if any.
     *
     * This does not include synthetic oneofs for proto3 optionals.
     */
    readonly oneof: DescOneof | undefined;
};
type descFieldScalar<T extends ScalarType = ScalarType> = T extends T ? {
    readonly fieldKind: "scalar";
    /**
     * Scalar type, if it is a scalar field.
     */
    readonly scalar: T;
    /**
     * By default, 64-bit integral types (int64, uint64, sint64, fixed64,
     * sfixed64) are represented with BigInt.
     *
     * If the field option `jstype = JS_STRING` is set, this property
     * is true, and 64-bit integral types are represented with String.
     */
    readonly longAsString: boolean;
    /**
     * The message type, if it is a message field.
     */
    readonly message: undefined;
    /**
     * The enum type, if it is an enum field.
     */
    readonly enum: undefined;
    /**
     * Return the default value specified in the protobuf source.
     */
    getDefaultValue(): ScalarValue<T> | undefined;
} & descFieldSingularCommon : never;
type descFieldMessage = {
    readonly fieldKind: "message";
    /**
     * Scalar type, if it is a scalar field.
     */
    readonly scalar: undefined;
    /**
     * The message type, if it is a message field.
     */
    readonly message: DescMessage;
    /**
     * Encode the message delimited (a.k.a. proto2 group encoding), or
     * length-prefixed?
     */
    readonly delimitedEncoding: boolean;
    /**
     * The enum type, if it is an enum field.
     */
    readonly enum: undefined;
    /**
     * Return the default value specified in the protobuf source.
     */
    getDefaultValue(): undefined;
} & descFieldSingularCommon;
type descFieldEnum = {
    readonly fieldKind: "enum";
    /**
     * Scalar type, if it is a scalar field.
     */
    readonly scalar: undefined;
    /**
     * The message type, if it is a message field.
     */
    readonly message: undefined;
    /**
     * The enum type, if it is an enum field.
     */
    readonly enum: DescEnum;
    /**
     * Return the default value specified in the protobuf source.
     */
    getDefaultValue(): number | undefined;
} & descFieldSingularCommon;
type descFieldList = (descFieldListScalar & descFieldListCommon) | (descFieldListEnum & descFieldListCommon) | (descFieldListMessage & descFieldListCommon);
type descFieldListCommon = {
    readonly fieldKind: "list";
    /**
     * Pack this repeated field? Only valid for repeated enum fields, and
     * for repeated scalar fields except BYTES and STRING.
     */
    readonly packed: boolean;
    /**
     * The `oneof` group this field belongs to, if any.
     */
    readonly oneof: undefined;
};
type descFieldListScalar<T extends ScalarType = ScalarType> = T extends T ? {
    readonly listKind: "scalar";
    /**
     * The enum list element type.
     */
    readonly enum: undefined;
    /**
     * The message list element type.
     */
    readonly message: undefined;
    /**
     * Scalar list element type.
     */
    readonly scalar: T;
    /**
     * By default, 64-bit integral types (int64, uint64, sint64, fixed64,
     * sfixed64) are represented with BigInt.
     *
     * If the field option `jstype = JS_STRING` is set, this property
     * is true, and 64-bit integral types are represented with String.
     */
    readonly longAsString: boolean;
} : never;
type descFieldListEnum = {
    readonly listKind: "enum";
    /**
     * The enum list element type.
     */
    readonly enum: DescEnum;
    /**
     * The message list element type.
     */
    readonly message: undefined;
    /**
     * Scalar list element type.
     */
    readonly scalar: undefined;
};
type descFieldListMessage = {
    readonly listKind: "message";
    /**
     * The enum list element type.
     */
    readonly enum: undefined;
    /**
     * The message list element type.
     */
    readonly message: DescMessage;
    /**
     * Scalar list element type.
     */
    readonly scalar: undefined;
    /**
     * Encode the message delimited (a.k.a. proto2 group encoding), or
     * length-prefixed?
     */
    readonly delimitedEncoding: boolean;
};
type descFieldMap = (descFieldMapScalar & descFieldMapCommon) | (descFieldMapEnum & descFieldMapCommon) | (descFieldMapMessage & descFieldMapCommon);
type descFieldMapCommon<T extends ScalarType = ScalarType> = T extends Exclude<ScalarType, ScalarType.FLOAT | ScalarType.DOUBLE | ScalarType.BYTES> ? {
    readonly fieldKind: "map";
    /**
     * The scalar map key type.
     */
    readonly mapKey: T;
    /**
     * The `oneof` group this field belongs to, if any.
     */
    readonly oneof: undefined;
    /**
     * Encode the map entry message delimited (a.k.a. proto2 group encoding),
     * or length-prefixed? As of Edition 2023, this is always false for map fields,
     * and also applies to map values, if they are messages.
     */
    readonly delimitedEncoding: false;
} : never;
type descFieldMapScalar<T extends ScalarType = ScalarType> = T extends T ? {
    readonly mapKind: "scalar";
    /**
     * The enum map value type.
     */
    readonly enum: undefined;
    /**
     * The message map value type.
     */
    readonly message: undefined;
    /**
     * Scalar map value type.
     */
    readonly scalar: T;
} : never;
type descFieldMapEnum = {
    readonly mapKind: "enum";
    /**
     * The enum map value type.
     */
    readonly enum: DescEnum;
    /**
     * The message map value type.
     */
    readonly message: undefined;
    /**
     * Scalar map value type.
     */
    readonly scalar: undefined;
};
type descFieldMapMessage = {
    readonly mapKind: "message";
    /**
     * The enum map value type.
     */
    readonly enum: undefined;
    /**
     * The message map value type.
     */
    readonly message: DescMessage;
    /**
     * Scalar map value type.
     */
    readonly scalar: undefined;
};
/**
 * Describes a oneof group in a protobuf source file.
 */
export interface DescOneof {
    readonly kind: "oneof";
    /**
     * The name of the oneof group, as specified in the protobuf source.
     */
    readonly name: string;
    /**
     * A safe and idiomatic name for the oneof group as a property in ECMAScript.
     */
    readonly localName: string;
    /**
     * The message this oneof group was declared in.
     */
    readonly parent: DescMessage;
    /**
     * The fields declared in this oneof group.
     */
    readonly fields: DescField[];
    /**
     * Marked as deprecated in the protobuf source.
     * Note that oneof groups cannot be marked as deprecated, this property
     * only exists for consistency and will always be false.
     */
    readonly deprecated: boolean;
    /**
     * The compiler-generated descriptor.
     */
    readonly proto: OneofDescriptorProto;
    toString(): string;
}
/**
 * Describes a service declaration in a protobuf source file.
 */
export interface DescService {
    readonly kind: "service";
    /**
     * The fully qualified name of the service. (We omit the leading dot.)
     */
    readonly typeName: string;
    /**
     * The name of the service, as specified in the protobuf source.
     */
    readonly name: string;
    /**
     * The file this service was declared in.
     */
    readonly file: DescFile;
    /**
     * The RPCs this service declares.
     */
    readonly methods: DescMethod[];
    /**
     * All methods of this service by their "localName".
     */
    readonly method: Record<string, DescMethod>;
    /**
     * Marked as deprecated in the protobuf source.
     */
    readonly deprecated: boolean;
    /**
     * The compiler-generated descriptor.
     */
    readonly proto: ServiceDescriptorProto;
    toString(): string;
}
/**
 * Describes an RPC declaration in a protobuf source file.
 */
export interface DescMethod {
    readonly kind: "rpc";
    /**
     * The name of the RPC, as specified in the protobuf source.
     */
    readonly name: string;
    /**
     * A safe and idiomatic name for the RPC as a method in ECMAScript.
     */
    readonly localName: string;
    /**
     * The parent service.
     */
    readonly parent: DescService;
    /**
     * One of the four available method types.
     */
    readonly methodKind: "unary" | "server_streaming" | "client_streaming" | "bidi_streaming";
    /**
     * The message type for requests.
     */
    readonly input: DescMessage;
    /**
     * The message type for responses.
     */
    readonly output: DescMessage;
    /**
     * The idempotency level declared in the protobuf source, if any.
     */
    readonly idempotency: MethodOptions_IdempotencyLevel;
    /**
     * Marked as deprecated in the protobuf source.
     */
    readonly deprecated: boolean;
    /**
     * The compiler-generated descriptor.
     */
    readonly proto: MethodDescriptorProto;
    toString(): string;
}
/**
 * Comments on an element in a protobuf source file.
 */
export interface DescComments {
    readonly leadingDetached: readonly string[];
    readonly leading?: string;
    readonly trailing?: string;
    readonly sourcePath: readonly number[];
}
export {};
