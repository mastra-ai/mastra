import type { GenEnum, GenFile, GenMessage } from "../../../../codegenv2/types.js";
import type { Any, AnyJson } from "./any_pb.js";
import type { SourceContext, SourceContextJson } from "./source_context_pb.js";
import type { Message } from "../../../../types.js";
/**
 * Describes the file google/protobuf/type.proto.
 */
export declare const file_google_protobuf_type: GenFile;
/**
 * A protocol buffer message type.
 *
 * New usages of this message as an alternative to DescriptorProto are strongly
 * discouraged. This message does not reliability preserve all information
 * necessary to model the schema and preserve semantics. Instead make use of
 * FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.Type
 */
export type Type = Message<"google.protobuf.Type"> & {
    /**
     * The fully qualified message name.
     *
     * @generated from field: string name = 1;
     */
    name: string;
    /**
     * The list of fields.
     *
     * @generated from field: repeated google.protobuf.Field fields = 2;
     */
    fields: Field[];
    /**
     * The list of types appearing in `oneof` definitions in this type.
     *
     * @generated from field: repeated string oneofs = 3;
     */
    oneofs: string[];
    /**
     * The protocol buffer options.
     *
     * @generated from field: repeated google.protobuf.Option options = 4;
     */
    options: Option[];
    /**
     * The source context.
     *
     * @generated from field: google.protobuf.SourceContext source_context = 5;
     */
    sourceContext?: SourceContext;
    /**
     * The source syntax.
     *
     * @generated from field: google.protobuf.Syntax syntax = 6;
     */
    syntax: Syntax;
    /**
     * The source edition string, only valid when syntax is SYNTAX_EDITIONS.
     *
     * @generated from field: string edition = 7;
     */
    edition: string;
};
/**
 * A protocol buffer message type.
 *
 * New usages of this message as an alternative to DescriptorProto are strongly
 * discouraged. This message does not reliability preserve all information
 * necessary to model the schema and preserve semantics. Instead make use of
 * FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.Type
 */
export type TypeJson = {
    /**
     * The fully qualified message name.
     *
     * @generated from field: string name = 1;
     */
    name?: string;
    /**
     * The list of fields.
     *
     * @generated from field: repeated google.protobuf.Field fields = 2;
     */
    fields?: FieldJson[];
    /**
     * The list of types appearing in `oneof` definitions in this type.
     *
     * @generated from field: repeated string oneofs = 3;
     */
    oneofs?: string[];
    /**
     * The protocol buffer options.
     *
     * @generated from field: repeated google.protobuf.Option options = 4;
     */
    options?: OptionJson[];
    /**
     * The source context.
     *
     * @generated from field: google.protobuf.SourceContext source_context = 5;
     */
    sourceContext?: SourceContextJson;
    /**
     * The source syntax.
     *
     * @generated from field: google.protobuf.Syntax syntax = 6;
     */
    syntax?: SyntaxJson;
    /**
     * The source edition string, only valid when syntax is SYNTAX_EDITIONS.
     *
     * @generated from field: string edition = 7;
     */
    edition?: string;
};
/**
 * Describes the message google.protobuf.Type.
 * Use `create(TypeSchema)` to create a new message.
 */
export declare const TypeSchema: GenMessage<Type, {
    jsonType: TypeJson;
}>;
/**
 * A single field of a message type.
 *
 * New usages of this message as an alternative to FieldDescriptorProto are
 * strongly discouraged. This message does not reliability preserve all
 * information necessary to model the schema and preserve semantics. Instead
 * make use of FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.Field
 */
export type Field = Message<"google.protobuf.Field"> & {
    /**
     * The field type.
     *
     * @generated from field: google.protobuf.Field.Kind kind = 1;
     */
    kind: Field_Kind;
    /**
     * The field cardinality.
     *
     * @generated from field: google.protobuf.Field.Cardinality cardinality = 2;
     */
    cardinality: Field_Cardinality;
    /**
     * The field number.
     *
     * @generated from field: int32 number = 3;
     */
    number: number;
    /**
     * The field name.
     *
     * @generated from field: string name = 4;
     */
    name: string;
    /**
     * The field type URL, without the scheme, for message or enumeration
     * types. Example: `"type.googleapis.com/google.protobuf.Timestamp"`.
     *
     * @generated from field: string type_url = 6;
     */
    typeUrl: string;
    /**
     * The index of the field type in `Type.oneofs`, for message or enumeration
     * types. The first type has index 1; zero means the type is not in the list.
     *
     * @generated from field: int32 oneof_index = 7;
     */
    oneofIndex: number;
    /**
     * Whether to use alternative packed wire representation.
     *
     * @generated from field: bool packed = 8;
     */
    packed: boolean;
    /**
     * The protocol buffer options.
     *
     * @generated from field: repeated google.protobuf.Option options = 9;
     */
    options: Option[];
    /**
     * The field JSON name.
     *
     * @generated from field: string json_name = 10;
     */
    jsonName: string;
    /**
     * The string value of the default value of this field. Proto2 syntax only.
     *
     * @generated from field: string default_value = 11;
     */
    defaultValue: string;
};
/**
 * A single field of a message type.
 *
 * New usages of this message as an alternative to FieldDescriptorProto are
 * strongly discouraged. This message does not reliability preserve all
 * information necessary to model the schema and preserve semantics. Instead
 * make use of FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.Field
 */
export type FieldJson = {
    /**
     * The field type.
     *
     * @generated from field: google.protobuf.Field.Kind kind = 1;
     */
    kind?: Field_KindJson;
    /**
     * The field cardinality.
     *
     * @generated from field: google.protobuf.Field.Cardinality cardinality = 2;
     */
    cardinality?: Field_CardinalityJson;
    /**
     * The field number.
     *
     * @generated from field: int32 number = 3;
     */
    number?: number;
    /**
     * The field name.
     *
     * @generated from field: string name = 4;
     */
    name?: string;
    /**
     * The field type URL, without the scheme, for message or enumeration
     * types. Example: `"type.googleapis.com/google.protobuf.Timestamp"`.
     *
     * @generated from field: string type_url = 6;
     */
    typeUrl?: string;
    /**
     * The index of the field type in `Type.oneofs`, for message or enumeration
     * types. The first type has index 1; zero means the type is not in the list.
     *
     * @generated from field: int32 oneof_index = 7;
     */
    oneofIndex?: number;
    /**
     * Whether to use alternative packed wire representation.
     *
     * @generated from field: bool packed = 8;
     */
    packed?: boolean;
    /**
     * The protocol buffer options.
     *
     * @generated from field: repeated google.protobuf.Option options = 9;
     */
    options?: OptionJson[];
    /**
     * The field JSON name.
     *
     * @generated from field: string json_name = 10;
     */
    jsonName?: string;
    /**
     * The string value of the default value of this field. Proto2 syntax only.
     *
     * @generated from field: string default_value = 11;
     */
    defaultValue?: string;
};
/**
 * Describes the message google.protobuf.Field.
 * Use `create(FieldSchema)` to create a new message.
 */
export declare const FieldSchema: GenMessage<Field, {
    jsonType: FieldJson;
}>;
/**
 * Basic field types.
 *
 * @generated from enum google.protobuf.Field.Kind
 */
export declare enum Field_Kind {
    /**
     * Field type unknown.
     *
     * @generated from enum value: TYPE_UNKNOWN = 0;
     */
    TYPE_UNKNOWN = 0,
    /**
     * Field type double.
     *
     * @generated from enum value: TYPE_DOUBLE = 1;
     */
    TYPE_DOUBLE = 1,
    /**
     * Field type float.
     *
     * @generated from enum value: TYPE_FLOAT = 2;
     */
    TYPE_FLOAT = 2,
    /**
     * Field type int64.
     *
     * @generated from enum value: TYPE_INT64 = 3;
     */
    TYPE_INT64 = 3,
    /**
     * Field type uint64.
     *
     * @generated from enum value: TYPE_UINT64 = 4;
     */
    TYPE_UINT64 = 4,
    /**
     * Field type int32.
     *
     * @generated from enum value: TYPE_INT32 = 5;
     */
    TYPE_INT32 = 5,
    /**
     * Field type fixed64.
     *
     * @generated from enum value: TYPE_FIXED64 = 6;
     */
    TYPE_FIXED64 = 6,
    /**
     * Field type fixed32.
     *
     * @generated from enum value: TYPE_FIXED32 = 7;
     */
    TYPE_FIXED32 = 7,
    /**
     * Field type bool.
     *
     * @generated from enum value: TYPE_BOOL = 8;
     */
    TYPE_BOOL = 8,
    /**
     * Field type string.
     *
     * @generated from enum value: TYPE_STRING = 9;
     */
    TYPE_STRING = 9,
    /**
     * Field type group. Proto2 syntax only, and deprecated.
     *
     * @generated from enum value: TYPE_GROUP = 10;
     */
    TYPE_GROUP = 10,
    /**
     * Field type message.
     *
     * @generated from enum value: TYPE_MESSAGE = 11;
     */
    TYPE_MESSAGE = 11,
    /**
     * Field type bytes.
     *
     * @generated from enum value: TYPE_BYTES = 12;
     */
    TYPE_BYTES = 12,
    /**
     * Field type uint32.
     *
     * @generated from enum value: TYPE_UINT32 = 13;
     */
    TYPE_UINT32 = 13,
    /**
     * Field type enum.
     *
     * @generated from enum value: TYPE_ENUM = 14;
     */
    TYPE_ENUM = 14,
    /**
     * Field type sfixed32.
     *
     * @generated from enum value: TYPE_SFIXED32 = 15;
     */
    TYPE_SFIXED32 = 15,
    /**
     * Field type sfixed64.
     *
     * @generated from enum value: TYPE_SFIXED64 = 16;
     */
    TYPE_SFIXED64 = 16,
    /**
     * Field type sint32.
     *
     * @generated from enum value: TYPE_SINT32 = 17;
     */
    TYPE_SINT32 = 17,
    /**
     * Field type sint64.
     *
     * @generated from enum value: TYPE_SINT64 = 18;
     */
    TYPE_SINT64 = 18
}
/**
 * Basic field types.
 *
 * @generated from enum google.protobuf.Field.Kind
 */
export type Field_KindJson = "TYPE_UNKNOWN" | "TYPE_DOUBLE" | "TYPE_FLOAT" | "TYPE_INT64" | "TYPE_UINT64" | "TYPE_INT32" | "TYPE_FIXED64" | "TYPE_FIXED32" | "TYPE_BOOL" | "TYPE_STRING" | "TYPE_GROUP" | "TYPE_MESSAGE" | "TYPE_BYTES" | "TYPE_UINT32" | "TYPE_ENUM" | "TYPE_SFIXED32" | "TYPE_SFIXED64" | "TYPE_SINT32" | "TYPE_SINT64";
/**
 * Describes the enum google.protobuf.Field.Kind.
 */
export declare const Field_KindSchema: GenEnum<Field_Kind, Field_KindJson>;
/**
 * Whether a field is optional, required, or repeated.
 *
 * @generated from enum google.protobuf.Field.Cardinality
 */
export declare enum Field_Cardinality {
    /**
     * For fields with unknown cardinality.
     *
     * @generated from enum value: CARDINALITY_UNKNOWN = 0;
     */
    UNKNOWN = 0,
    /**
     * For optional fields.
     *
     * @generated from enum value: CARDINALITY_OPTIONAL = 1;
     */
    OPTIONAL = 1,
    /**
     * For required fields. Proto2 syntax only.
     *
     * @generated from enum value: CARDINALITY_REQUIRED = 2;
     */
    REQUIRED = 2,
    /**
     * For repeated fields.
     *
     * @generated from enum value: CARDINALITY_REPEATED = 3;
     */
    REPEATED = 3
}
/**
 * Whether a field is optional, required, or repeated.
 *
 * @generated from enum google.protobuf.Field.Cardinality
 */
export type Field_CardinalityJson = "CARDINALITY_UNKNOWN" | "CARDINALITY_OPTIONAL" | "CARDINALITY_REQUIRED" | "CARDINALITY_REPEATED";
/**
 * Describes the enum google.protobuf.Field.Cardinality.
 */
export declare const Field_CardinalitySchema: GenEnum<Field_Cardinality, Field_CardinalityJson>;
/**
 * Enum type definition.
 *
 * New usages of this message as an alternative to EnumDescriptorProto are
 * strongly discouraged. This message does not reliability preserve all
 * information necessary to model the schema and preserve semantics. Instead
 * make use of FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.Enum
 */
export type Enum = Message<"google.protobuf.Enum"> & {
    /**
     * Enum type name.
     *
     * @generated from field: string name = 1;
     */
    name: string;
    /**
     * Enum value definitions.
     *
     * @generated from field: repeated google.protobuf.EnumValue enumvalue = 2;
     */
    enumvalue: EnumValue[];
    /**
     * Protocol buffer options.
     *
     * @generated from field: repeated google.protobuf.Option options = 3;
     */
    options: Option[];
    /**
     * The source context.
     *
     * @generated from field: google.protobuf.SourceContext source_context = 4;
     */
    sourceContext?: SourceContext;
    /**
     * The source syntax.
     *
     * @generated from field: google.protobuf.Syntax syntax = 5;
     */
    syntax: Syntax;
    /**
     * The source edition string, only valid when syntax is SYNTAX_EDITIONS.
     *
     * @generated from field: string edition = 6;
     */
    edition: string;
};
/**
 * Enum type definition.
 *
 * New usages of this message as an alternative to EnumDescriptorProto are
 * strongly discouraged. This message does not reliability preserve all
 * information necessary to model the schema and preserve semantics. Instead
 * make use of FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.Enum
 */
export type EnumJson = {
    /**
     * Enum type name.
     *
     * @generated from field: string name = 1;
     */
    name?: string;
    /**
     * Enum value definitions.
     *
     * @generated from field: repeated google.protobuf.EnumValue enumvalue = 2;
     */
    enumvalue?: EnumValueJson[];
    /**
     * Protocol buffer options.
     *
     * @generated from field: repeated google.protobuf.Option options = 3;
     */
    options?: OptionJson[];
    /**
     * The source context.
     *
     * @generated from field: google.protobuf.SourceContext source_context = 4;
     */
    sourceContext?: SourceContextJson;
    /**
     * The source syntax.
     *
     * @generated from field: google.protobuf.Syntax syntax = 5;
     */
    syntax?: SyntaxJson;
    /**
     * The source edition string, only valid when syntax is SYNTAX_EDITIONS.
     *
     * @generated from field: string edition = 6;
     */
    edition?: string;
};
/**
 * Describes the message google.protobuf.Enum.
 * Use `create(EnumSchema)` to create a new message.
 */
export declare const EnumSchema: GenMessage<Enum, {
    jsonType: EnumJson;
}>;
/**
 * Enum value definition.
 *
 * New usages of this message as an alternative to EnumValueDescriptorProto are
 * strongly discouraged. This message does not reliability preserve all
 * information necessary to model the schema and preserve semantics. Instead
 * make use of FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.EnumValue
 */
export type EnumValue = Message<"google.protobuf.EnumValue"> & {
    /**
     * Enum value name.
     *
     * @generated from field: string name = 1;
     */
    name: string;
    /**
     * Enum value number.
     *
     * @generated from field: int32 number = 2;
     */
    number: number;
    /**
     * Protocol buffer options.
     *
     * @generated from field: repeated google.protobuf.Option options = 3;
     */
    options: Option[];
};
/**
 * Enum value definition.
 *
 * New usages of this message as an alternative to EnumValueDescriptorProto are
 * strongly discouraged. This message does not reliability preserve all
 * information necessary to model the schema and preserve semantics. Instead
 * make use of FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.EnumValue
 */
export type EnumValueJson = {
    /**
     * Enum value name.
     *
     * @generated from field: string name = 1;
     */
    name?: string;
    /**
     * Enum value number.
     *
     * @generated from field: int32 number = 2;
     */
    number?: number;
    /**
     * Protocol buffer options.
     *
     * @generated from field: repeated google.protobuf.Option options = 3;
     */
    options?: OptionJson[];
};
/**
 * Describes the message google.protobuf.EnumValue.
 * Use `create(EnumValueSchema)` to create a new message.
 */
export declare const EnumValueSchema: GenMessage<EnumValue, {
    jsonType: EnumValueJson;
}>;
/**
 * A protocol buffer option, which can be attached to a message, field,
 * enumeration, etc.
 *
 * New usages of this message as an alternative to FileOptions, MessageOptions,
 * FieldOptions, EnumOptions, EnumValueOptions, ServiceOptions, or MethodOptions
 * are strongly discouraged.
 *
 * @generated from message google.protobuf.Option
 */
export type Option = Message<"google.protobuf.Option"> & {
    /**
     * The option's name. For protobuf built-in options (options defined in
     * descriptor.proto), this is the short name. For example, `"map_entry"`.
     * For custom options, it should be the fully-qualified name. For example,
     * `"google.api.http"`.
     *
     * @generated from field: string name = 1;
     */
    name: string;
    /**
     * The option's value packed in an Any message. If the value is a primitive,
     * the corresponding wrapper type defined in google/protobuf/wrappers.proto
     * should be used. If the value is an enum, it should be stored as an int32
     * value using the google.protobuf.Int32Value type.
     *
     * @generated from field: google.protobuf.Any value = 2;
     */
    value?: Any;
};
/**
 * A protocol buffer option, which can be attached to a message, field,
 * enumeration, etc.
 *
 * New usages of this message as an alternative to FileOptions, MessageOptions,
 * FieldOptions, EnumOptions, EnumValueOptions, ServiceOptions, or MethodOptions
 * are strongly discouraged.
 *
 * @generated from message google.protobuf.Option
 */
export type OptionJson = {
    /**
     * The option's name. For protobuf built-in options (options defined in
     * descriptor.proto), this is the short name. For example, `"map_entry"`.
     * For custom options, it should be the fully-qualified name. For example,
     * `"google.api.http"`.
     *
     * @generated from field: string name = 1;
     */
    name?: string;
    /**
     * The option's value packed in an Any message. If the value is a primitive,
     * the corresponding wrapper type defined in google/protobuf/wrappers.proto
     * should be used. If the value is an enum, it should be stored as an int32
     * value using the google.protobuf.Int32Value type.
     *
     * @generated from field: google.protobuf.Any value = 2;
     */
    value?: AnyJson;
};
/**
 * Describes the message google.protobuf.Option.
 * Use `create(OptionSchema)` to create a new message.
 */
export declare const OptionSchema: GenMessage<Option, {
    jsonType: OptionJson;
}>;
/**
 * The syntax in which a protocol buffer element is defined.
 *
 * @generated from enum google.protobuf.Syntax
 */
export declare enum Syntax {
    /**
     * Syntax `proto2`.
     *
     * @generated from enum value: SYNTAX_PROTO2 = 0;
     */
    PROTO2 = 0,
    /**
     * Syntax `proto3`.
     *
     * @generated from enum value: SYNTAX_PROTO3 = 1;
     */
    PROTO3 = 1,
    /**
     * Syntax `editions`.
     *
     * @generated from enum value: SYNTAX_EDITIONS = 2;
     */
    EDITIONS = 2
}
/**
 * The syntax in which a protocol buffer element is defined.
 *
 * @generated from enum google.protobuf.Syntax
 */
export type SyntaxJson = "SYNTAX_PROTO2" | "SYNTAX_PROTO3" | "SYNTAX_EDITIONS";
/**
 * Describes the enum google.protobuf.Syntax.
 */
export declare const SyntaxSchema: GenEnum<Syntax, SyntaxJson>;
