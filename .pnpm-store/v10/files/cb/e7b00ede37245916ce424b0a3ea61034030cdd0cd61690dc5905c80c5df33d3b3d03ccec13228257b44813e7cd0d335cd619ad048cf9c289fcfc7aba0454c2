import type { GenEnum, GenFile, GenMessage } from "../../../../codegenv2/types.js";
import type { Message } from "../../../../types.js";
/**
 * Describes the file google/protobuf/descriptor.proto.
 */
export declare const file_google_protobuf_descriptor: GenFile;
/**
 * The protocol compiler can output a FileDescriptorSet containing the .proto
 * files it parses.
 *
 * @generated from message google.protobuf.FileDescriptorSet
 */
export type FileDescriptorSet = Message<"google.protobuf.FileDescriptorSet"> & {
    /**
     * @generated from field: repeated google.protobuf.FileDescriptorProto file = 1;
     */
    file: FileDescriptorProto[];
};
/**
 * The protocol compiler can output a FileDescriptorSet containing the .proto
 * files it parses.
 *
 * @generated from message google.protobuf.FileDescriptorSet
 */
export type FileDescriptorSetJson = {
    /**
     * @generated from field: repeated google.protobuf.FileDescriptorProto file = 1;
     */
    file?: FileDescriptorProtoJson[];
};
/**
 * Describes the message google.protobuf.FileDescriptorSet.
 * Use `create(FileDescriptorSetSchema)` to create a new message.
 */
export declare const FileDescriptorSetSchema: GenMessage<FileDescriptorSet, {
    jsonType: FileDescriptorSetJson;
}>;
/**
 * Describes a complete .proto file.
 *
 * @generated from message google.protobuf.FileDescriptorProto
 */
export type FileDescriptorProto = Message<"google.protobuf.FileDescriptorProto"> & {
    /**
     * file name, relative to root of source tree
     *
     * @generated from field: optional string name = 1;
     */
    name: string;
    /**
     * e.g. "foo", "foo.bar", etc.
     *
     * @generated from field: optional string package = 2;
     */
    package: string;
    /**
     * Names of files imported by this file.
     *
     * @generated from field: repeated string dependency = 3;
     */
    dependency: string[];
    /**
     * Indexes of the public imported files in the dependency list above.
     *
     * @generated from field: repeated int32 public_dependency = 10;
     */
    publicDependency: number[];
    /**
     * Indexes of the weak imported files in the dependency list.
     * For Google-internal migration only. Do not use.
     *
     * @generated from field: repeated int32 weak_dependency = 11;
     */
    weakDependency: number[];
    /**
     * Names of files imported by this file purely for the purpose of providing
     * option extensions. These are excluded from the dependency list above.
     *
     * @generated from field: repeated string option_dependency = 15;
     */
    optionDependency: string[];
    /**
     * All top-level definitions in this file.
     *
     * @generated from field: repeated google.protobuf.DescriptorProto message_type = 4;
     */
    messageType: DescriptorProto[];
    /**
     * @generated from field: repeated google.protobuf.EnumDescriptorProto enum_type = 5;
     */
    enumType: EnumDescriptorProto[];
    /**
     * @generated from field: repeated google.protobuf.ServiceDescriptorProto service = 6;
     */
    service: ServiceDescriptorProto[];
    /**
     * @generated from field: repeated google.protobuf.FieldDescriptorProto extension = 7;
     */
    extension: FieldDescriptorProto[];
    /**
     * @generated from field: optional google.protobuf.FileOptions options = 8;
     */
    options?: FileOptions;
    /**
     * This field contains optional information about the original source code.
     * You may safely remove this entire field without harming runtime
     * functionality of the descriptors -- the information is needed only by
     * development tools.
     *
     * @generated from field: optional google.protobuf.SourceCodeInfo source_code_info = 9;
     */
    sourceCodeInfo?: SourceCodeInfo;
    /**
     * The syntax of the proto file.
     * The supported values are "proto2", "proto3", and "editions".
     *
     * If `edition` is present, this value must be "editions".
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional string syntax = 12;
     */
    syntax: string;
    /**
     * The edition of the proto file.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.Edition edition = 14;
     */
    edition: Edition;
};
/**
 * Describes a complete .proto file.
 *
 * @generated from message google.protobuf.FileDescriptorProto
 */
export type FileDescriptorProtoJson = {
    /**
     * file name, relative to root of source tree
     *
     * @generated from field: optional string name = 1;
     */
    name?: string;
    /**
     * e.g. "foo", "foo.bar", etc.
     *
     * @generated from field: optional string package = 2;
     */
    package?: string;
    /**
     * Names of files imported by this file.
     *
     * @generated from field: repeated string dependency = 3;
     */
    dependency?: string[];
    /**
     * Indexes of the public imported files in the dependency list above.
     *
     * @generated from field: repeated int32 public_dependency = 10;
     */
    publicDependency?: number[];
    /**
     * Indexes of the weak imported files in the dependency list.
     * For Google-internal migration only. Do not use.
     *
     * @generated from field: repeated int32 weak_dependency = 11;
     */
    weakDependency?: number[];
    /**
     * Names of files imported by this file purely for the purpose of providing
     * option extensions. These are excluded from the dependency list above.
     *
     * @generated from field: repeated string option_dependency = 15;
     */
    optionDependency?: string[];
    /**
     * All top-level definitions in this file.
     *
     * @generated from field: repeated google.protobuf.DescriptorProto message_type = 4;
     */
    messageType?: DescriptorProtoJson[];
    /**
     * @generated from field: repeated google.protobuf.EnumDescriptorProto enum_type = 5;
     */
    enumType?: EnumDescriptorProtoJson[];
    /**
     * @generated from field: repeated google.protobuf.ServiceDescriptorProto service = 6;
     */
    service?: ServiceDescriptorProtoJson[];
    /**
     * @generated from field: repeated google.protobuf.FieldDescriptorProto extension = 7;
     */
    extension?: FieldDescriptorProtoJson[];
    /**
     * @generated from field: optional google.protobuf.FileOptions options = 8;
     */
    options?: FileOptionsJson;
    /**
     * This field contains optional information about the original source code.
     * You may safely remove this entire field without harming runtime
     * functionality of the descriptors -- the information is needed only by
     * development tools.
     *
     * @generated from field: optional google.protobuf.SourceCodeInfo source_code_info = 9;
     */
    sourceCodeInfo?: SourceCodeInfoJson;
    /**
     * The syntax of the proto file.
     * The supported values are "proto2", "proto3", and "editions".
     *
     * If `edition` is present, this value must be "editions".
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional string syntax = 12;
     */
    syntax?: string;
    /**
     * The edition of the proto file.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.Edition edition = 14;
     */
    edition?: EditionJson;
};
/**
 * Describes the message google.protobuf.FileDescriptorProto.
 * Use `create(FileDescriptorProtoSchema)` to create a new message.
 */
export declare const FileDescriptorProtoSchema: GenMessage<FileDescriptorProto, {
    jsonType: FileDescriptorProtoJson;
}>;
/**
 * Describes a message type.
 *
 * @generated from message google.protobuf.DescriptorProto
 */
export type DescriptorProto = Message<"google.protobuf.DescriptorProto"> & {
    /**
     * @generated from field: optional string name = 1;
     */
    name: string;
    /**
     * @generated from field: repeated google.protobuf.FieldDescriptorProto field = 2;
     */
    field: FieldDescriptorProto[];
    /**
     * @generated from field: repeated google.protobuf.FieldDescriptorProto extension = 6;
     */
    extension: FieldDescriptorProto[];
    /**
     * @generated from field: repeated google.protobuf.DescriptorProto nested_type = 3;
     */
    nestedType: DescriptorProto[];
    /**
     * @generated from field: repeated google.protobuf.EnumDescriptorProto enum_type = 4;
     */
    enumType: EnumDescriptorProto[];
    /**
     * @generated from field: repeated google.protobuf.DescriptorProto.ExtensionRange extension_range = 5;
     */
    extensionRange: DescriptorProto_ExtensionRange[];
    /**
     * @generated from field: repeated google.protobuf.OneofDescriptorProto oneof_decl = 8;
     */
    oneofDecl: OneofDescriptorProto[];
    /**
     * @generated from field: optional google.protobuf.MessageOptions options = 7;
     */
    options?: MessageOptions;
    /**
     * @generated from field: repeated google.protobuf.DescriptorProto.ReservedRange reserved_range = 9;
     */
    reservedRange: DescriptorProto_ReservedRange[];
    /**
     * Reserved field names, which may not be used by fields in the same message.
     * A given name may only be reserved once.
     *
     * @generated from field: repeated string reserved_name = 10;
     */
    reservedName: string[];
    /**
     * Support for `export` and `local` keywords on enums.
     *
     * @generated from field: optional google.protobuf.SymbolVisibility visibility = 11;
     */
    visibility: SymbolVisibility;
};
/**
 * Describes a message type.
 *
 * @generated from message google.protobuf.DescriptorProto
 */
export type DescriptorProtoJson = {
    /**
     * @generated from field: optional string name = 1;
     */
    name?: string;
    /**
     * @generated from field: repeated google.protobuf.FieldDescriptorProto field = 2;
     */
    field?: FieldDescriptorProtoJson[];
    /**
     * @generated from field: repeated google.protobuf.FieldDescriptorProto extension = 6;
     */
    extension?: FieldDescriptorProtoJson[];
    /**
     * @generated from field: repeated google.protobuf.DescriptorProto nested_type = 3;
     */
    nestedType?: DescriptorProtoJson[];
    /**
     * @generated from field: repeated google.protobuf.EnumDescriptorProto enum_type = 4;
     */
    enumType?: EnumDescriptorProtoJson[];
    /**
     * @generated from field: repeated google.protobuf.DescriptorProto.ExtensionRange extension_range = 5;
     */
    extensionRange?: DescriptorProto_ExtensionRangeJson[];
    /**
     * @generated from field: repeated google.protobuf.OneofDescriptorProto oneof_decl = 8;
     */
    oneofDecl?: OneofDescriptorProtoJson[];
    /**
     * @generated from field: optional google.protobuf.MessageOptions options = 7;
     */
    options?: MessageOptionsJson;
    /**
     * @generated from field: repeated google.protobuf.DescriptorProto.ReservedRange reserved_range = 9;
     */
    reservedRange?: DescriptorProto_ReservedRangeJson[];
    /**
     * Reserved field names, which may not be used by fields in the same message.
     * A given name may only be reserved once.
     *
     * @generated from field: repeated string reserved_name = 10;
     */
    reservedName?: string[];
    /**
     * Support for `export` and `local` keywords on enums.
     *
     * @generated from field: optional google.protobuf.SymbolVisibility visibility = 11;
     */
    visibility?: SymbolVisibilityJson;
};
/**
 * Describes the message google.protobuf.DescriptorProto.
 * Use `create(DescriptorProtoSchema)` to create a new message.
 */
export declare const DescriptorProtoSchema: GenMessage<DescriptorProto, {
    jsonType: DescriptorProtoJson;
}>;
/**
 * @generated from message google.protobuf.DescriptorProto.ExtensionRange
 */
export type DescriptorProto_ExtensionRange = Message<"google.protobuf.DescriptorProto.ExtensionRange"> & {
    /**
     * Inclusive.
     *
     * @generated from field: optional int32 start = 1;
     */
    start: number;
    /**
     * Exclusive.
     *
     * @generated from field: optional int32 end = 2;
     */
    end: number;
    /**
     * @generated from field: optional google.protobuf.ExtensionRangeOptions options = 3;
     */
    options?: ExtensionRangeOptions;
};
/**
 * @generated from message google.protobuf.DescriptorProto.ExtensionRange
 */
export type DescriptorProto_ExtensionRangeJson = {
    /**
     * Inclusive.
     *
     * @generated from field: optional int32 start = 1;
     */
    start?: number;
    /**
     * Exclusive.
     *
     * @generated from field: optional int32 end = 2;
     */
    end?: number;
    /**
     * @generated from field: optional google.protobuf.ExtensionRangeOptions options = 3;
     */
    options?: ExtensionRangeOptionsJson;
};
/**
 * Describes the message google.protobuf.DescriptorProto.ExtensionRange.
 * Use `create(DescriptorProto_ExtensionRangeSchema)` to create a new message.
 */
export declare const DescriptorProto_ExtensionRangeSchema: GenMessage<DescriptorProto_ExtensionRange, {
    jsonType: DescriptorProto_ExtensionRangeJson;
}>;
/**
 * Range of reserved tag numbers. Reserved tag numbers may not be used by
 * fields or extension ranges in the same message. Reserved ranges may
 * not overlap.
 *
 * @generated from message google.protobuf.DescriptorProto.ReservedRange
 */
export type DescriptorProto_ReservedRange = Message<"google.protobuf.DescriptorProto.ReservedRange"> & {
    /**
     * Inclusive.
     *
     * @generated from field: optional int32 start = 1;
     */
    start: number;
    /**
     * Exclusive.
     *
     * @generated from field: optional int32 end = 2;
     */
    end: number;
};
/**
 * Range of reserved tag numbers. Reserved tag numbers may not be used by
 * fields or extension ranges in the same message. Reserved ranges may
 * not overlap.
 *
 * @generated from message google.protobuf.DescriptorProto.ReservedRange
 */
export type DescriptorProto_ReservedRangeJson = {
    /**
     * Inclusive.
     *
     * @generated from field: optional int32 start = 1;
     */
    start?: number;
    /**
     * Exclusive.
     *
     * @generated from field: optional int32 end = 2;
     */
    end?: number;
};
/**
 * Describes the message google.protobuf.DescriptorProto.ReservedRange.
 * Use `create(DescriptorProto_ReservedRangeSchema)` to create a new message.
 */
export declare const DescriptorProto_ReservedRangeSchema: GenMessage<DescriptorProto_ReservedRange, {
    jsonType: DescriptorProto_ReservedRangeJson;
}>;
/**
 * @generated from message google.protobuf.ExtensionRangeOptions
 */
export type ExtensionRangeOptions = Message<"google.protobuf.ExtensionRangeOptions"> & {
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption: UninterpretedOption[];
    /**
     * For external users: DO NOT USE. We are in the process of open sourcing
     * extension declaration and executing internal cleanups before it can be
     * used externally.
     *
     * @generated from field: repeated google.protobuf.ExtensionRangeOptions.Declaration declaration = 2;
     */
    declaration: ExtensionRangeOptions_Declaration[];
    /**
     * Any features defined in the specific edition.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 50;
     */
    features?: FeatureSet;
    /**
     * The verification state of the range.
     * TODO: flip the default to DECLARATION once all empty ranges
     * are marked as UNVERIFIED.
     *
     * @generated from field: optional google.protobuf.ExtensionRangeOptions.VerificationState verification = 3 [default = UNVERIFIED];
     */
    verification: ExtensionRangeOptions_VerificationState;
};
/**
 * @generated from message google.protobuf.ExtensionRangeOptions
 */
export type ExtensionRangeOptionsJson = {
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption?: UninterpretedOptionJson[];
    /**
     * For external users: DO NOT USE. We are in the process of open sourcing
     * extension declaration and executing internal cleanups before it can be
     * used externally.
     *
     * @generated from field: repeated google.protobuf.ExtensionRangeOptions.Declaration declaration = 2;
     */
    declaration?: ExtensionRangeOptions_DeclarationJson[];
    /**
     * Any features defined in the specific edition.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 50;
     */
    features?: FeatureSetJson;
    /**
     * The verification state of the range.
     * TODO: flip the default to DECLARATION once all empty ranges
     * are marked as UNVERIFIED.
     *
     * @generated from field: optional google.protobuf.ExtensionRangeOptions.VerificationState verification = 3 [default = UNVERIFIED];
     */
    verification?: ExtensionRangeOptions_VerificationStateJson;
};
/**
 * Describes the message google.protobuf.ExtensionRangeOptions.
 * Use `create(ExtensionRangeOptionsSchema)` to create a new message.
 */
export declare const ExtensionRangeOptionsSchema: GenMessage<ExtensionRangeOptions, {
    jsonType: ExtensionRangeOptionsJson;
}>;
/**
 * @generated from message google.protobuf.ExtensionRangeOptions.Declaration
 */
export type ExtensionRangeOptions_Declaration = Message<"google.protobuf.ExtensionRangeOptions.Declaration"> & {
    /**
     * The extension number declared within the extension range.
     *
     * @generated from field: optional int32 number = 1;
     */
    number: number;
    /**
     * The fully-qualified name of the extension field. There must be a leading
     * dot in front of the full name.
     *
     * @generated from field: optional string full_name = 2;
     */
    fullName: string;
    /**
     * The fully-qualified type name of the extension field. Unlike
     * Metadata.type, Declaration.type must have a leading dot for messages
     * and enums.
     *
     * @generated from field: optional string type = 3;
     */
    type: string;
    /**
     * If true, indicates that the number is reserved in the extension range,
     * and any extension field with the number will fail to compile. Set this
     * when a declared extension field is deleted.
     *
     * @generated from field: optional bool reserved = 5;
     */
    reserved: boolean;
    /**
     * If true, indicates that the extension must be defined as repeated.
     * Otherwise the extension must be defined as optional.
     *
     * @generated from field: optional bool repeated = 6;
     */
    repeated: boolean;
};
/**
 * @generated from message google.protobuf.ExtensionRangeOptions.Declaration
 */
export type ExtensionRangeOptions_DeclarationJson = {
    /**
     * The extension number declared within the extension range.
     *
     * @generated from field: optional int32 number = 1;
     */
    number?: number;
    /**
     * The fully-qualified name of the extension field. There must be a leading
     * dot in front of the full name.
     *
     * @generated from field: optional string full_name = 2;
     */
    fullName?: string;
    /**
     * The fully-qualified type name of the extension field. Unlike
     * Metadata.type, Declaration.type must have a leading dot for messages
     * and enums.
     *
     * @generated from field: optional string type = 3;
     */
    type?: string;
    /**
     * If true, indicates that the number is reserved in the extension range,
     * and any extension field with the number will fail to compile. Set this
     * when a declared extension field is deleted.
     *
     * @generated from field: optional bool reserved = 5;
     */
    reserved?: boolean;
    /**
     * If true, indicates that the extension must be defined as repeated.
     * Otherwise the extension must be defined as optional.
     *
     * @generated from field: optional bool repeated = 6;
     */
    repeated?: boolean;
};
/**
 * Describes the message google.protobuf.ExtensionRangeOptions.Declaration.
 * Use `create(ExtensionRangeOptions_DeclarationSchema)` to create a new message.
 */
export declare const ExtensionRangeOptions_DeclarationSchema: GenMessage<ExtensionRangeOptions_Declaration, {
    jsonType: ExtensionRangeOptions_DeclarationJson;
}>;
/**
 * The verification state of the extension range.
 *
 * @generated from enum google.protobuf.ExtensionRangeOptions.VerificationState
 */
export declare enum ExtensionRangeOptions_VerificationState {
    /**
     * All the extensions of the range must be declared.
     *
     * @generated from enum value: DECLARATION = 0;
     */
    DECLARATION = 0,
    /**
     * @generated from enum value: UNVERIFIED = 1;
     */
    UNVERIFIED = 1
}
/**
 * The verification state of the extension range.
 *
 * @generated from enum google.protobuf.ExtensionRangeOptions.VerificationState
 */
export type ExtensionRangeOptions_VerificationStateJson = "DECLARATION" | "UNVERIFIED";
/**
 * Describes the enum google.protobuf.ExtensionRangeOptions.VerificationState.
 */
export declare const ExtensionRangeOptions_VerificationStateSchema: GenEnum<ExtensionRangeOptions_VerificationState, ExtensionRangeOptions_VerificationStateJson>;
/**
 * Describes a field within a message.
 *
 * @generated from message google.protobuf.FieldDescriptorProto
 */
export type FieldDescriptorProto = Message<"google.protobuf.FieldDescriptorProto"> & {
    /**
     * @generated from field: optional string name = 1;
     */
    name: string;
    /**
     * @generated from field: optional int32 number = 3;
     */
    number: number;
    /**
     * @generated from field: optional google.protobuf.FieldDescriptorProto.Label label = 4;
     */
    label: FieldDescriptorProto_Label;
    /**
     * If type_name is set, this need not be set.  If both this and type_name
     * are set, this must be one of TYPE_ENUM, TYPE_MESSAGE or TYPE_GROUP.
     *
     * @generated from field: optional google.protobuf.FieldDescriptorProto.Type type = 5;
     */
    type: FieldDescriptorProto_Type;
    /**
     * For message and enum types, this is the name of the type.  If the name
     * starts with a '.', it is fully-qualified.  Otherwise, C++-like scoping
     * rules are used to find the type (i.e. first the nested types within this
     * message are searched, then within the parent, on up to the root
     * namespace).
     *
     * @generated from field: optional string type_name = 6;
     */
    typeName: string;
    /**
     * For extensions, this is the name of the type being extended.  It is
     * resolved in the same manner as type_name.
     *
     * @generated from field: optional string extendee = 2;
     */
    extendee: string;
    /**
     * For numeric types, contains the original text representation of the value.
     * For booleans, "true" or "false".
     * For strings, contains the default text contents (not escaped in any way).
     * For bytes, contains the C escaped value.  All bytes >= 128 are escaped.
     *
     * @generated from field: optional string default_value = 7;
     */
    defaultValue: string;
    /**
     * If set, gives the index of a oneof in the containing type's oneof_decl
     * list.  This field is a member of that oneof.
     *
     * @generated from field: optional int32 oneof_index = 9;
     */
    oneofIndex: number;
    /**
     * JSON name of this field. The value is set by protocol compiler. If the
     * user has set a "json_name" option on this field, that option's value
     * will be used. Otherwise, it's deduced from the field's name by converting
     * it to camelCase.
     *
     * @generated from field: optional string json_name = 10;
     */
    jsonName: string;
    /**
     * @generated from field: optional google.protobuf.FieldOptions options = 8;
     */
    options?: FieldOptions;
    /**
     * If true, this is a proto3 "optional". When a proto3 field is optional, it
     * tracks presence regardless of field type.
     *
     * When proto3_optional is true, this field must belong to a oneof to signal
     * to old proto3 clients that presence is tracked for this field. This oneof
     * is known as a "synthetic" oneof, and this field must be its sole member
     * (each proto3 optional field gets its own synthetic oneof). Synthetic oneofs
     * exist in the descriptor only, and do not generate any API. Synthetic oneofs
     * must be ordered after all "real" oneofs.
     *
     * For message fields, proto3_optional doesn't create any semantic change,
     * since non-repeated message fields always track presence. However it still
     * indicates the semantic detail of whether the user wrote "optional" or not.
     * This can be useful for round-tripping the .proto file. For consistency we
     * give message fields a synthetic oneof also, even though it is not required
     * to track presence. This is especially important because the parser can't
     * tell if a field is a message or an enum, so it must always create a
     * synthetic oneof.
     *
     * Proto2 optional fields do not set this flag, because they already indicate
     * optional with `LABEL_OPTIONAL`.
     *
     * @generated from field: optional bool proto3_optional = 17;
     */
    proto3Optional: boolean;
};
/**
 * Describes a field within a message.
 *
 * @generated from message google.protobuf.FieldDescriptorProto
 */
export type FieldDescriptorProtoJson = {
    /**
     * @generated from field: optional string name = 1;
     */
    name?: string;
    /**
     * @generated from field: optional int32 number = 3;
     */
    number?: number;
    /**
     * @generated from field: optional google.protobuf.FieldDescriptorProto.Label label = 4;
     */
    label?: FieldDescriptorProto_LabelJson;
    /**
     * If type_name is set, this need not be set.  If both this and type_name
     * are set, this must be one of TYPE_ENUM, TYPE_MESSAGE or TYPE_GROUP.
     *
     * @generated from field: optional google.protobuf.FieldDescriptorProto.Type type = 5;
     */
    type?: FieldDescriptorProto_TypeJson;
    /**
     * For message and enum types, this is the name of the type.  If the name
     * starts with a '.', it is fully-qualified.  Otherwise, C++-like scoping
     * rules are used to find the type (i.e. first the nested types within this
     * message are searched, then within the parent, on up to the root
     * namespace).
     *
     * @generated from field: optional string type_name = 6;
     */
    typeName?: string;
    /**
     * For extensions, this is the name of the type being extended.  It is
     * resolved in the same manner as type_name.
     *
     * @generated from field: optional string extendee = 2;
     */
    extendee?: string;
    /**
     * For numeric types, contains the original text representation of the value.
     * For booleans, "true" or "false".
     * For strings, contains the default text contents (not escaped in any way).
     * For bytes, contains the C escaped value.  All bytes >= 128 are escaped.
     *
     * @generated from field: optional string default_value = 7;
     */
    defaultValue?: string;
    /**
     * If set, gives the index of a oneof in the containing type's oneof_decl
     * list.  This field is a member of that oneof.
     *
     * @generated from field: optional int32 oneof_index = 9;
     */
    oneofIndex?: number;
    /**
     * JSON name of this field. The value is set by protocol compiler. If the
     * user has set a "json_name" option on this field, that option's value
     * will be used. Otherwise, it's deduced from the field's name by converting
     * it to camelCase.
     *
     * @generated from field: optional string json_name = 10;
     */
    jsonName?: string;
    /**
     * @generated from field: optional google.protobuf.FieldOptions options = 8;
     */
    options?: FieldOptionsJson;
    /**
     * If true, this is a proto3 "optional". When a proto3 field is optional, it
     * tracks presence regardless of field type.
     *
     * When proto3_optional is true, this field must belong to a oneof to signal
     * to old proto3 clients that presence is tracked for this field. This oneof
     * is known as a "synthetic" oneof, and this field must be its sole member
     * (each proto3 optional field gets its own synthetic oneof). Synthetic oneofs
     * exist in the descriptor only, and do not generate any API. Synthetic oneofs
     * must be ordered after all "real" oneofs.
     *
     * For message fields, proto3_optional doesn't create any semantic change,
     * since non-repeated message fields always track presence. However it still
     * indicates the semantic detail of whether the user wrote "optional" or not.
     * This can be useful for round-tripping the .proto file. For consistency we
     * give message fields a synthetic oneof also, even though it is not required
     * to track presence. This is especially important because the parser can't
     * tell if a field is a message or an enum, so it must always create a
     * synthetic oneof.
     *
     * Proto2 optional fields do not set this flag, because they already indicate
     * optional with `LABEL_OPTIONAL`.
     *
     * @generated from field: optional bool proto3_optional = 17;
     */
    proto3Optional?: boolean;
};
/**
 * Describes the message google.protobuf.FieldDescriptorProto.
 * Use `create(FieldDescriptorProtoSchema)` to create a new message.
 */
export declare const FieldDescriptorProtoSchema: GenMessage<FieldDescriptorProto, {
    jsonType: FieldDescriptorProtoJson;
}>;
/**
 * @generated from enum google.protobuf.FieldDescriptorProto.Type
 */
export declare enum FieldDescriptorProto_Type {
    /**
     * 0 is reserved for errors.
     * Order is weird for historical reasons.
     *
     * @generated from enum value: TYPE_DOUBLE = 1;
     */
    DOUBLE = 1,
    /**
     * @generated from enum value: TYPE_FLOAT = 2;
     */
    FLOAT = 2,
    /**
     * Not ZigZag encoded.  Negative numbers take 10 bytes.  Use TYPE_SINT64 if
     * negative values are likely.
     *
     * @generated from enum value: TYPE_INT64 = 3;
     */
    INT64 = 3,
    /**
     * @generated from enum value: TYPE_UINT64 = 4;
     */
    UINT64 = 4,
    /**
     * Not ZigZag encoded.  Negative numbers take 10 bytes.  Use TYPE_SINT32 if
     * negative values are likely.
     *
     * @generated from enum value: TYPE_INT32 = 5;
     */
    INT32 = 5,
    /**
     * @generated from enum value: TYPE_FIXED64 = 6;
     */
    FIXED64 = 6,
    /**
     * @generated from enum value: TYPE_FIXED32 = 7;
     */
    FIXED32 = 7,
    /**
     * @generated from enum value: TYPE_BOOL = 8;
     */
    BOOL = 8,
    /**
     * @generated from enum value: TYPE_STRING = 9;
     */
    STRING = 9,
    /**
     * Tag-delimited aggregate.
     * Group type is deprecated and not supported after google.protobuf. However, Proto3
     * implementations should still be able to parse the group wire format and
     * treat group fields as unknown fields.  In Editions, the group wire format
     * can be enabled via the `message_encoding` feature.
     *
     * @generated from enum value: TYPE_GROUP = 10;
     */
    GROUP = 10,
    /**
     * Length-delimited aggregate.
     *
     * @generated from enum value: TYPE_MESSAGE = 11;
     */
    MESSAGE = 11,
    /**
     * New in version 2.
     *
     * @generated from enum value: TYPE_BYTES = 12;
     */
    BYTES = 12,
    /**
     * @generated from enum value: TYPE_UINT32 = 13;
     */
    UINT32 = 13,
    /**
     * @generated from enum value: TYPE_ENUM = 14;
     */
    ENUM = 14,
    /**
     * @generated from enum value: TYPE_SFIXED32 = 15;
     */
    SFIXED32 = 15,
    /**
     * @generated from enum value: TYPE_SFIXED64 = 16;
     */
    SFIXED64 = 16,
    /**
     * Uses ZigZag encoding.
     *
     * @generated from enum value: TYPE_SINT32 = 17;
     */
    SINT32 = 17,
    /**
     * Uses ZigZag encoding.
     *
     * @generated from enum value: TYPE_SINT64 = 18;
     */
    SINT64 = 18
}
/**
 * @generated from enum google.protobuf.FieldDescriptorProto.Type
 */
export type FieldDescriptorProto_TypeJson = "TYPE_DOUBLE" | "TYPE_FLOAT" | "TYPE_INT64" | "TYPE_UINT64" | "TYPE_INT32" | "TYPE_FIXED64" | "TYPE_FIXED32" | "TYPE_BOOL" | "TYPE_STRING" | "TYPE_GROUP" | "TYPE_MESSAGE" | "TYPE_BYTES" | "TYPE_UINT32" | "TYPE_ENUM" | "TYPE_SFIXED32" | "TYPE_SFIXED64" | "TYPE_SINT32" | "TYPE_SINT64";
/**
 * Describes the enum google.protobuf.FieldDescriptorProto.Type.
 */
export declare const FieldDescriptorProto_TypeSchema: GenEnum<FieldDescriptorProto_Type, FieldDescriptorProto_TypeJson>;
/**
 * @generated from enum google.protobuf.FieldDescriptorProto.Label
 */
export declare enum FieldDescriptorProto_Label {
    /**
     * 0 is reserved for errors
     *
     * @generated from enum value: LABEL_OPTIONAL = 1;
     */
    OPTIONAL = 1,
    /**
     * @generated from enum value: LABEL_REPEATED = 3;
     */
    REPEATED = 3,
    /**
     * The required label is only allowed in google.protobuf.  In proto3 and Editions
     * it's explicitly prohibited.  In Editions, the `field_presence` feature
     * can be used to get this behavior.
     *
     * @generated from enum value: LABEL_REQUIRED = 2;
     */
    REQUIRED = 2
}
/**
 * @generated from enum google.protobuf.FieldDescriptorProto.Label
 */
export type FieldDescriptorProto_LabelJson = "LABEL_OPTIONAL" | "LABEL_REPEATED" | "LABEL_REQUIRED";
/**
 * Describes the enum google.protobuf.FieldDescriptorProto.Label.
 */
export declare const FieldDescriptorProto_LabelSchema: GenEnum<FieldDescriptorProto_Label, FieldDescriptorProto_LabelJson>;
/**
 * Describes a oneof.
 *
 * @generated from message google.protobuf.OneofDescriptorProto
 */
export type OneofDescriptorProto = Message<"google.protobuf.OneofDescriptorProto"> & {
    /**
     * @generated from field: optional string name = 1;
     */
    name: string;
    /**
     * @generated from field: optional google.protobuf.OneofOptions options = 2;
     */
    options?: OneofOptions;
};
/**
 * Describes a oneof.
 *
 * @generated from message google.protobuf.OneofDescriptorProto
 */
export type OneofDescriptorProtoJson = {
    /**
     * @generated from field: optional string name = 1;
     */
    name?: string;
    /**
     * @generated from field: optional google.protobuf.OneofOptions options = 2;
     */
    options?: OneofOptionsJson;
};
/**
 * Describes the message google.protobuf.OneofDescriptorProto.
 * Use `create(OneofDescriptorProtoSchema)` to create a new message.
 */
export declare const OneofDescriptorProtoSchema: GenMessage<OneofDescriptorProto, {
    jsonType: OneofDescriptorProtoJson;
}>;
/**
 * Describes an enum type.
 *
 * @generated from message google.protobuf.EnumDescriptorProto
 */
export type EnumDescriptorProto = Message<"google.protobuf.EnumDescriptorProto"> & {
    /**
     * @generated from field: optional string name = 1;
     */
    name: string;
    /**
     * @generated from field: repeated google.protobuf.EnumValueDescriptorProto value = 2;
     */
    value: EnumValueDescriptorProto[];
    /**
     * @generated from field: optional google.protobuf.EnumOptions options = 3;
     */
    options?: EnumOptions;
    /**
     * Range of reserved numeric values. Reserved numeric values may not be used
     * by enum values in the same enum declaration. Reserved ranges may not
     * overlap.
     *
     * @generated from field: repeated google.protobuf.EnumDescriptorProto.EnumReservedRange reserved_range = 4;
     */
    reservedRange: EnumDescriptorProto_EnumReservedRange[];
    /**
     * Reserved enum value names, which may not be reused. A given name may only
     * be reserved once.
     *
     * @generated from field: repeated string reserved_name = 5;
     */
    reservedName: string[];
    /**
     * Support for `export` and `local` keywords on enums.
     *
     * @generated from field: optional google.protobuf.SymbolVisibility visibility = 6;
     */
    visibility: SymbolVisibility;
};
/**
 * Describes an enum type.
 *
 * @generated from message google.protobuf.EnumDescriptorProto
 */
export type EnumDescriptorProtoJson = {
    /**
     * @generated from field: optional string name = 1;
     */
    name?: string;
    /**
     * @generated from field: repeated google.protobuf.EnumValueDescriptorProto value = 2;
     */
    value?: EnumValueDescriptorProtoJson[];
    /**
     * @generated from field: optional google.protobuf.EnumOptions options = 3;
     */
    options?: EnumOptionsJson;
    /**
     * Range of reserved numeric values. Reserved numeric values may not be used
     * by enum values in the same enum declaration. Reserved ranges may not
     * overlap.
     *
     * @generated from field: repeated google.protobuf.EnumDescriptorProto.EnumReservedRange reserved_range = 4;
     */
    reservedRange?: EnumDescriptorProto_EnumReservedRangeJson[];
    /**
     * Reserved enum value names, which may not be reused. A given name may only
     * be reserved once.
     *
     * @generated from field: repeated string reserved_name = 5;
     */
    reservedName?: string[];
    /**
     * Support for `export` and `local` keywords on enums.
     *
     * @generated from field: optional google.protobuf.SymbolVisibility visibility = 6;
     */
    visibility?: SymbolVisibilityJson;
};
/**
 * Describes the message google.protobuf.EnumDescriptorProto.
 * Use `create(EnumDescriptorProtoSchema)` to create a new message.
 */
export declare const EnumDescriptorProtoSchema: GenMessage<EnumDescriptorProto, {
    jsonType: EnumDescriptorProtoJson;
}>;
/**
 * Range of reserved numeric values. Reserved values may not be used by
 * entries in the same enum. Reserved ranges may not overlap.
 *
 * Note that this is distinct from DescriptorProto.ReservedRange in that it
 * is inclusive such that it can appropriately represent the entire int32
 * domain.
 *
 * @generated from message google.protobuf.EnumDescriptorProto.EnumReservedRange
 */
export type EnumDescriptorProto_EnumReservedRange = Message<"google.protobuf.EnumDescriptorProto.EnumReservedRange"> & {
    /**
     * Inclusive.
     *
     * @generated from field: optional int32 start = 1;
     */
    start: number;
    /**
     * Inclusive.
     *
     * @generated from field: optional int32 end = 2;
     */
    end: number;
};
/**
 * Range of reserved numeric values. Reserved values may not be used by
 * entries in the same enum. Reserved ranges may not overlap.
 *
 * Note that this is distinct from DescriptorProto.ReservedRange in that it
 * is inclusive such that it can appropriately represent the entire int32
 * domain.
 *
 * @generated from message google.protobuf.EnumDescriptorProto.EnumReservedRange
 */
export type EnumDescriptorProto_EnumReservedRangeJson = {
    /**
     * Inclusive.
     *
     * @generated from field: optional int32 start = 1;
     */
    start?: number;
    /**
     * Inclusive.
     *
     * @generated from field: optional int32 end = 2;
     */
    end?: number;
};
/**
 * Describes the message google.protobuf.EnumDescriptorProto.EnumReservedRange.
 * Use `create(EnumDescriptorProto_EnumReservedRangeSchema)` to create a new message.
 */
export declare const EnumDescriptorProto_EnumReservedRangeSchema: GenMessage<EnumDescriptorProto_EnumReservedRange, {
    jsonType: EnumDescriptorProto_EnumReservedRangeJson;
}>;
/**
 * Describes a value within an enum.
 *
 * @generated from message google.protobuf.EnumValueDescriptorProto
 */
export type EnumValueDescriptorProto = Message<"google.protobuf.EnumValueDescriptorProto"> & {
    /**
     * @generated from field: optional string name = 1;
     */
    name: string;
    /**
     * @generated from field: optional int32 number = 2;
     */
    number: number;
    /**
     * @generated from field: optional google.protobuf.EnumValueOptions options = 3;
     */
    options?: EnumValueOptions;
};
/**
 * Describes a value within an enum.
 *
 * @generated from message google.protobuf.EnumValueDescriptorProto
 */
export type EnumValueDescriptorProtoJson = {
    /**
     * @generated from field: optional string name = 1;
     */
    name?: string;
    /**
     * @generated from field: optional int32 number = 2;
     */
    number?: number;
    /**
     * @generated from field: optional google.protobuf.EnumValueOptions options = 3;
     */
    options?: EnumValueOptionsJson;
};
/**
 * Describes the message google.protobuf.EnumValueDescriptorProto.
 * Use `create(EnumValueDescriptorProtoSchema)` to create a new message.
 */
export declare const EnumValueDescriptorProtoSchema: GenMessage<EnumValueDescriptorProto, {
    jsonType: EnumValueDescriptorProtoJson;
}>;
/**
 * Describes a service.
 *
 * @generated from message google.protobuf.ServiceDescriptorProto
 */
export type ServiceDescriptorProto = Message<"google.protobuf.ServiceDescriptorProto"> & {
    /**
     * @generated from field: optional string name = 1;
     */
    name: string;
    /**
     * @generated from field: repeated google.protobuf.MethodDescriptorProto method = 2;
     */
    method: MethodDescriptorProto[];
    /**
     * @generated from field: optional google.protobuf.ServiceOptions options = 3;
     */
    options?: ServiceOptions;
};
/**
 * Describes a service.
 *
 * @generated from message google.protobuf.ServiceDescriptorProto
 */
export type ServiceDescriptorProtoJson = {
    /**
     * @generated from field: optional string name = 1;
     */
    name?: string;
    /**
     * @generated from field: repeated google.protobuf.MethodDescriptorProto method = 2;
     */
    method?: MethodDescriptorProtoJson[];
    /**
     * @generated from field: optional google.protobuf.ServiceOptions options = 3;
     */
    options?: ServiceOptionsJson;
};
/**
 * Describes the message google.protobuf.ServiceDescriptorProto.
 * Use `create(ServiceDescriptorProtoSchema)` to create a new message.
 */
export declare const ServiceDescriptorProtoSchema: GenMessage<ServiceDescriptorProto, {
    jsonType: ServiceDescriptorProtoJson;
}>;
/**
 * Describes a method of a service.
 *
 * @generated from message google.protobuf.MethodDescriptorProto
 */
export type MethodDescriptorProto = Message<"google.protobuf.MethodDescriptorProto"> & {
    /**
     * @generated from field: optional string name = 1;
     */
    name: string;
    /**
     * Input and output type names.  These are resolved in the same way as
     * FieldDescriptorProto.type_name, but must refer to a message type.
     *
     * @generated from field: optional string input_type = 2;
     */
    inputType: string;
    /**
     * @generated from field: optional string output_type = 3;
     */
    outputType: string;
    /**
     * @generated from field: optional google.protobuf.MethodOptions options = 4;
     */
    options?: MethodOptions;
    /**
     * Identifies if client streams multiple client messages
     *
     * @generated from field: optional bool client_streaming = 5 [default = false];
     */
    clientStreaming: boolean;
    /**
     * Identifies if server streams multiple server messages
     *
     * @generated from field: optional bool server_streaming = 6 [default = false];
     */
    serverStreaming: boolean;
};
/**
 * Describes a method of a service.
 *
 * @generated from message google.protobuf.MethodDescriptorProto
 */
export type MethodDescriptorProtoJson = {
    /**
     * @generated from field: optional string name = 1;
     */
    name?: string;
    /**
     * Input and output type names.  These are resolved in the same way as
     * FieldDescriptorProto.type_name, but must refer to a message type.
     *
     * @generated from field: optional string input_type = 2;
     */
    inputType?: string;
    /**
     * @generated from field: optional string output_type = 3;
     */
    outputType?: string;
    /**
     * @generated from field: optional google.protobuf.MethodOptions options = 4;
     */
    options?: MethodOptionsJson;
    /**
     * Identifies if client streams multiple client messages
     *
     * @generated from field: optional bool client_streaming = 5 [default = false];
     */
    clientStreaming?: boolean;
    /**
     * Identifies if server streams multiple server messages
     *
     * @generated from field: optional bool server_streaming = 6 [default = false];
     */
    serverStreaming?: boolean;
};
/**
 * Describes the message google.protobuf.MethodDescriptorProto.
 * Use `create(MethodDescriptorProtoSchema)` to create a new message.
 */
export declare const MethodDescriptorProtoSchema: GenMessage<MethodDescriptorProto, {
    jsonType: MethodDescriptorProtoJson;
}>;
/**
 * @generated from message google.protobuf.FileOptions
 */
export type FileOptions = Message<"google.protobuf.FileOptions"> & {
    /**
     * Sets the Java package where classes generated from this .proto will be
     * placed.  By default, the proto package is used, but this is often
     * inappropriate because proto packages do not normally start with backwards
     * domain names.
     *
     * @generated from field: optional string java_package = 1;
     */
    javaPackage: string;
    /**
     * Controls the name of the wrapper Java class generated for the .proto file.
     * That class will always contain the .proto file's getDescriptor() method as
     * well as any top-level extensions defined in the .proto file.
     * If java_multiple_files is disabled, then all the other classes from the
     * .proto file will be nested inside the single wrapper outer class.
     *
     * @generated from field: optional string java_outer_classname = 8;
     */
    javaOuterClassname: string;
    /**
     * If enabled, then the Java code generator will generate a separate .java
     * file for each top-level message, enum, and service defined in the .proto
     * file.  Thus, these types will *not* be nested inside the wrapper class
     * named by java_outer_classname.  However, the wrapper class will still be
     * generated to contain the file's getDescriptor() method as well as any
     * top-level extensions defined in the file.
     *
     * @generated from field: optional bool java_multiple_files = 10 [default = false];
     */
    javaMultipleFiles: boolean;
    /**
     * This option does nothing.
     *
     * @generated from field: optional bool java_generate_equals_and_hash = 20 [deprecated = true];
     * @deprecated
     */
    javaGenerateEqualsAndHash: boolean;
    /**
     * A proto2 file can set this to true to opt in to UTF-8 checking for Java,
     * which will throw an exception if invalid UTF-8 is parsed from the wire or
     * assigned to a string field.
     *
     * TODO: clarify exactly what kinds of field types this option
     * applies to, and update these docs accordingly.
     *
     * Proto3 files already perform these checks. Setting the option explicitly to
     * false has no effect: it cannot be used to opt proto3 files out of UTF-8
     * checks.
     *
     * @generated from field: optional bool java_string_check_utf8 = 27 [default = false];
     */
    javaStringCheckUtf8: boolean;
    /**
     * @generated from field: optional google.protobuf.FileOptions.OptimizeMode optimize_for = 9 [default = SPEED];
     */
    optimizeFor: FileOptions_OptimizeMode;
    /**
     * Sets the Go package where structs generated from this .proto will be
     * placed. If omitted, the Go package will be derived from the following:
     *   - The basename of the package import path, if provided.
     *   - Otherwise, the package statement in the .proto file, if present.
     *   - Otherwise, the basename of the .proto file, without extension.
     *
     * @generated from field: optional string go_package = 11;
     */
    goPackage: string;
    /**
     * Should generic services be generated in each language?  "Generic" services
     * are not specific to any particular RPC system.  They are generated by the
     * main code generators in each language (without additional plugins).
     * Generic services were the only kind of service generation supported by
     * early versions of google.protobuf.
     *
     * Generic services are now considered deprecated in favor of using plugins
     * that generate code specific to your particular RPC system.  Therefore,
     * these default to false.  Old code which depends on generic services should
     * explicitly set them to true.
     *
     * @generated from field: optional bool cc_generic_services = 16 [default = false];
     */
    ccGenericServices: boolean;
    /**
     * @generated from field: optional bool java_generic_services = 17 [default = false];
     */
    javaGenericServices: boolean;
    /**
     * @generated from field: optional bool py_generic_services = 18 [default = false];
     */
    pyGenericServices: boolean;
    /**
     * Is this file deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for everything in the file, or it will be completely ignored; in the very
     * least, this is a formalization for deprecating files.
     *
     * @generated from field: optional bool deprecated = 23 [default = false];
     */
    deprecated: boolean;
    /**
     * Enables the use of arenas for the proto messages in this file. This applies
     * only to generated classes for C++.
     *
     * @generated from field: optional bool cc_enable_arenas = 31 [default = true];
     */
    ccEnableArenas: boolean;
    /**
     * Sets the objective c class prefix which is prepended to all objective c
     * generated classes from this .proto. There is no default.
     *
     * @generated from field: optional string objc_class_prefix = 36;
     */
    objcClassPrefix: string;
    /**
     * Namespace for generated classes; defaults to the package.
     *
     * @generated from field: optional string csharp_namespace = 37;
     */
    csharpNamespace: string;
    /**
     * By default Swift generators will take the proto package and CamelCase it
     * replacing '.' with underscore and use that to prefix the types/symbols
     * defined. When this options is provided, they will use this value instead
     * to prefix the types/symbols defined.
     *
     * @generated from field: optional string swift_prefix = 39;
     */
    swiftPrefix: string;
    /**
     * Sets the php class prefix which is prepended to all php generated classes
     * from this .proto. Default is empty.
     *
     * @generated from field: optional string php_class_prefix = 40;
     */
    phpClassPrefix: string;
    /**
     * Use this option to change the namespace of php generated classes. Default
     * is empty. When this option is empty, the package name will be used for
     * determining the namespace.
     *
     * @generated from field: optional string php_namespace = 41;
     */
    phpNamespace: string;
    /**
     * Use this option to change the namespace of php generated metadata classes.
     * Default is empty. When this option is empty, the proto file name will be
     * used for determining the namespace.
     *
     * @generated from field: optional string php_metadata_namespace = 44;
     */
    phpMetadataNamespace: string;
    /**
     * Use this option to change the package of ruby generated classes. Default
     * is empty. When this option is not set, the package name will be used for
     * determining the ruby package.
     *
     * @generated from field: optional string ruby_package = 45;
     */
    rubyPackage: string;
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 50;
     */
    features?: FeatureSet;
    /**
     * The parser stores options it doesn't recognize here.
     * See the documentation for the "Options" section above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption: UninterpretedOption[];
};
/**
 * @generated from message google.protobuf.FileOptions
 */
export type FileOptionsJson = {
    /**
     * Sets the Java package where classes generated from this .proto will be
     * placed.  By default, the proto package is used, but this is often
     * inappropriate because proto packages do not normally start with backwards
     * domain names.
     *
     * @generated from field: optional string java_package = 1;
     */
    javaPackage?: string;
    /**
     * Controls the name of the wrapper Java class generated for the .proto file.
     * That class will always contain the .proto file's getDescriptor() method as
     * well as any top-level extensions defined in the .proto file.
     * If java_multiple_files is disabled, then all the other classes from the
     * .proto file will be nested inside the single wrapper outer class.
     *
     * @generated from field: optional string java_outer_classname = 8;
     */
    javaOuterClassname?: string;
    /**
     * If enabled, then the Java code generator will generate a separate .java
     * file for each top-level message, enum, and service defined in the .proto
     * file.  Thus, these types will *not* be nested inside the wrapper class
     * named by java_outer_classname.  However, the wrapper class will still be
     * generated to contain the file's getDescriptor() method as well as any
     * top-level extensions defined in the file.
     *
     * @generated from field: optional bool java_multiple_files = 10 [default = false];
     */
    javaMultipleFiles?: boolean;
    /**
     * This option does nothing.
     *
     * @generated from field: optional bool java_generate_equals_and_hash = 20 [deprecated = true];
     * @deprecated
     */
    javaGenerateEqualsAndHash?: boolean;
    /**
     * A proto2 file can set this to true to opt in to UTF-8 checking for Java,
     * which will throw an exception if invalid UTF-8 is parsed from the wire or
     * assigned to a string field.
     *
     * TODO: clarify exactly what kinds of field types this option
     * applies to, and update these docs accordingly.
     *
     * Proto3 files already perform these checks. Setting the option explicitly to
     * false has no effect: it cannot be used to opt proto3 files out of UTF-8
     * checks.
     *
     * @generated from field: optional bool java_string_check_utf8 = 27 [default = false];
     */
    javaStringCheckUtf8?: boolean;
    /**
     * @generated from field: optional google.protobuf.FileOptions.OptimizeMode optimize_for = 9 [default = SPEED];
     */
    optimizeFor?: FileOptions_OptimizeModeJson;
    /**
     * Sets the Go package where structs generated from this .proto will be
     * placed. If omitted, the Go package will be derived from the following:
     *   - The basename of the package import path, if provided.
     *   - Otherwise, the package statement in the .proto file, if present.
     *   - Otherwise, the basename of the .proto file, without extension.
     *
     * @generated from field: optional string go_package = 11;
     */
    goPackage?: string;
    /**
     * Should generic services be generated in each language?  "Generic" services
     * are not specific to any particular RPC system.  They are generated by the
     * main code generators in each language (without additional plugins).
     * Generic services were the only kind of service generation supported by
     * early versions of google.protobuf.
     *
     * Generic services are now considered deprecated in favor of using plugins
     * that generate code specific to your particular RPC system.  Therefore,
     * these default to false.  Old code which depends on generic services should
     * explicitly set them to true.
     *
     * @generated from field: optional bool cc_generic_services = 16 [default = false];
     */
    ccGenericServices?: boolean;
    /**
     * @generated from field: optional bool java_generic_services = 17 [default = false];
     */
    javaGenericServices?: boolean;
    /**
     * @generated from field: optional bool py_generic_services = 18 [default = false];
     */
    pyGenericServices?: boolean;
    /**
     * Is this file deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for everything in the file, or it will be completely ignored; in the very
     * least, this is a formalization for deprecating files.
     *
     * @generated from field: optional bool deprecated = 23 [default = false];
     */
    deprecated?: boolean;
    /**
     * Enables the use of arenas for the proto messages in this file. This applies
     * only to generated classes for C++.
     *
     * @generated from field: optional bool cc_enable_arenas = 31 [default = true];
     */
    ccEnableArenas?: boolean;
    /**
     * Sets the objective c class prefix which is prepended to all objective c
     * generated classes from this .proto. There is no default.
     *
     * @generated from field: optional string objc_class_prefix = 36;
     */
    objcClassPrefix?: string;
    /**
     * Namespace for generated classes; defaults to the package.
     *
     * @generated from field: optional string csharp_namespace = 37;
     */
    csharpNamespace?: string;
    /**
     * By default Swift generators will take the proto package and CamelCase it
     * replacing '.' with underscore and use that to prefix the types/symbols
     * defined. When this options is provided, they will use this value instead
     * to prefix the types/symbols defined.
     *
     * @generated from field: optional string swift_prefix = 39;
     */
    swiftPrefix?: string;
    /**
     * Sets the php class prefix which is prepended to all php generated classes
     * from this .proto. Default is empty.
     *
     * @generated from field: optional string php_class_prefix = 40;
     */
    phpClassPrefix?: string;
    /**
     * Use this option to change the namespace of php generated classes. Default
     * is empty. When this option is empty, the package name will be used for
     * determining the namespace.
     *
     * @generated from field: optional string php_namespace = 41;
     */
    phpNamespace?: string;
    /**
     * Use this option to change the namespace of php generated metadata classes.
     * Default is empty. When this option is empty, the proto file name will be
     * used for determining the namespace.
     *
     * @generated from field: optional string php_metadata_namespace = 44;
     */
    phpMetadataNamespace?: string;
    /**
     * Use this option to change the package of ruby generated classes. Default
     * is empty. When this option is not set, the package name will be used for
     * determining the ruby package.
     *
     * @generated from field: optional string ruby_package = 45;
     */
    rubyPackage?: string;
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 50;
     */
    features?: FeatureSetJson;
    /**
     * The parser stores options it doesn't recognize here.
     * See the documentation for the "Options" section above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption?: UninterpretedOptionJson[];
};
/**
 * Describes the message google.protobuf.FileOptions.
 * Use `create(FileOptionsSchema)` to create a new message.
 */
export declare const FileOptionsSchema: GenMessage<FileOptions, {
    jsonType: FileOptionsJson;
}>;
/**
 * Generated classes can be optimized for speed or code size.
 *
 * @generated from enum google.protobuf.FileOptions.OptimizeMode
 */
export declare enum FileOptions_OptimizeMode {
    /**
     * Generate complete code for parsing, serialization,
     *
     * @generated from enum value: SPEED = 1;
     */
    SPEED = 1,
    /**
     * etc.
     *
     * Use ReflectionOps to implement these methods.
     *
     * @generated from enum value: CODE_SIZE = 2;
     */
    CODE_SIZE = 2,
    /**
     * Generate code using MessageLite and the lite runtime.
     *
     * @generated from enum value: LITE_RUNTIME = 3;
     */
    LITE_RUNTIME = 3
}
/**
 * Generated classes can be optimized for speed or code size.
 *
 * @generated from enum google.protobuf.FileOptions.OptimizeMode
 */
export type FileOptions_OptimizeModeJson = "SPEED" | "CODE_SIZE" | "LITE_RUNTIME";
/**
 * Describes the enum google.protobuf.FileOptions.OptimizeMode.
 */
export declare const FileOptions_OptimizeModeSchema: GenEnum<FileOptions_OptimizeMode, FileOptions_OptimizeModeJson>;
/**
 * @generated from message google.protobuf.MessageOptions
 */
export type MessageOptions = Message<"google.protobuf.MessageOptions"> & {
    /**
     * Set true to use the old proto1 MessageSet wire format for extensions.
     * This is provided for backwards-compatibility with the MessageSet wire
     * format.  You should not use this for any other reason:  It's less
     * efficient, has fewer features, and is more complicated.
     *
     * The message must be defined exactly as follows:
     *   message Foo {
     *     option message_set_wire_format = true;
     *     extensions 4 to max;
     *   }
     * Note that the message cannot have any defined fields; MessageSets only
     * have extensions.
     *
     * All extensions of your type must be singular messages; e.g. they cannot
     * be int32s, enums, or repeated messages.
     *
     * Because this is an option, the above two restrictions are not enforced by
     * the protocol compiler.
     *
     * @generated from field: optional bool message_set_wire_format = 1 [default = false];
     */
    messageSetWireFormat: boolean;
    /**
     * Disables the generation of the standard "descriptor()" accessor, which can
     * conflict with a field of the same name.  This is meant to make migration
     * from proto1 easier; new code should avoid fields named "descriptor".
     *
     * @generated from field: optional bool no_standard_descriptor_accessor = 2 [default = false];
     */
    noStandardDescriptorAccessor: boolean;
    /**
     * Is this message deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for the message, or it will be completely ignored; in the very least,
     * this is a formalization for deprecating messages.
     *
     * @generated from field: optional bool deprecated = 3 [default = false];
     */
    deprecated: boolean;
    /**
     * Whether the message is an automatically generated map entry type for the
     * maps field.
     *
     * For maps fields:
     *     map<KeyType, ValueType> map_field = 1;
     * The parsed descriptor looks like:
     *     message MapFieldEntry {
     *         option map_entry = true;
     *         optional KeyType key = 1;
     *         optional ValueType value = 2;
     *     }
     *     repeated MapFieldEntry map_field = 1;
     *
     * Implementations may choose not to generate the map_entry=true message, but
     * use a native map in the target language to hold the keys and values.
     * The reflection APIs in such implementations still need to work as
     * if the field is a repeated message field.
     *
     * NOTE: Do not set the option in .proto files. Always use the maps syntax
     * instead. The option should only be implicitly set by the proto compiler
     * parser.
     *
     * @generated from field: optional bool map_entry = 7;
     */
    mapEntry: boolean;
    /**
     * Enable the legacy handling of JSON field name conflicts.  This lowercases
     * and strips underscored from the fields before comparison in proto3 only.
     * The new behavior takes `json_name` into account and applies to proto2 as
     * well.
     *
     * This should only be used as a temporary measure against broken builds due
     * to the change in behavior for JSON field name conflicts.
     *
     * TODO This is legacy behavior we plan to remove once downstream
     * teams have had time to migrate.
     *
     * @generated from field: optional bool deprecated_legacy_json_field_conflicts = 11 [deprecated = true];
     * @deprecated
     */
    deprecatedLegacyJsonFieldConflicts: boolean;
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 12;
     */
    features?: FeatureSet;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption: UninterpretedOption[];
};
/**
 * @generated from message google.protobuf.MessageOptions
 */
export type MessageOptionsJson = {
    /**
     * Set true to use the old proto1 MessageSet wire format for extensions.
     * This is provided for backwards-compatibility with the MessageSet wire
     * format.  You should not use this for any other reason:  It's less
     * efficient, has fewer features, and is more complicated.
     *
     * The message must be defined exactly as follows:
     *   message Foo {
     *     option message_set_wire_format = true;
     *     extensions 4 to max;
     *   }
     * Note that the message cannot have any defined fields; MessageSets only
     * have extensions.
     *
     * All extensions of your type must be singular messages; e.g. they cannot
     * be int32s, enums, or repeated messages.
     *
     * Because this is an option, the above two restrictions are not enforced by
     * the protocol compiler.
     *
     * @generated from field: optional bool message_set_wire_format = 1 [default = false];
     */
    messageSetWireFormat?: boolean;
    /**
     * Disables the generation of the standard "descriptor()" accessor, which can
     * conflict with a field of the same name.  This is meant to make migration
     * from proto1 easier; new code should avoid fields named "descriptor".
     *
     * @generated from field: optional bool no_standard_descriptor_accessor = 2 [default = false];
     */
    noStandardDescriptorAccessor?: boolean;
    /**
     * Is this message deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for the message, or it will be completely ignored; in the very least,
     * this is a formalization for deprecating messages.
     *
     * @generated from field: optional bool deprecated = 3 [default = false];
     */
    deprecated?: boolean;
    /**
     * Whether the message is an automatically generated map entry type for the
     * maps field.
     *
     * For maps fields:
     *     map<KeyType, ValueType> map_field = 1;
     * The parsed descriptor looks like:
     *     message MapFieldEntry {
     *         option map_entry = true;
     *         optional KeyType key = 1;
     *         optional ValueType value = 2;
     *     }
     *     repeated MapFieldEntry map_field = 1;
     *
     * Implementations may choose not to generate the map_entry=true message, but
     * use a native map in the target language to hold the keys and values.
     * The reflection APIs in such implementations still need to work as
     * if the field is a repeated message field.
     *
     * NOTE: Do not set the option in .proto files. Always use the maps syntax
     * instead. The option should only be implicitly set by the proto compiler
     * parser.
     *
     * @generated from field: optional bool map_entry = 7;
     */
    mapEntry?: boolean;
    /**
     * Enable the legacy handling of JSON field name conflicts.  This lowercases
     * and strips underscored from the fields before comparison in proto3 only.
     * The new behavior takes `json_name` into account and applies to proto2 as
     * well.
     *
     * This should only be used as a temporary measure against broken builds due
     * to the change in behavior for JSON field name conflicts.
     *
     * TODO This is legacy behavior we plan to remove once downstream
     * teams have had time to migrate.
     *
     * @generated from field: optional bool deprecated_legacy_json_field_conflicts = 11 [deprecated = true];
     * @deprecated
     */
    deprecatedLegacyJsonFieldConflicts?: boolean;
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 12;
     */
    features?: FeatureSetJson;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption?: UninterpretedOptionJson[];
};
/**
 * Describes the message google.protobuf.MessageOptions.
 * Use `create(MessageOptionsSchema)` to create a new message.
 */
export declare const MessageOptionsSchema: GenMessage<MessageOptions, {
    jsonType: MessageOptionsJson;
}>;
/**
 * @generated from message google.protobuf.FieldOptions
 */
export type FieldOptions = Message<"google.protobuf.FieldOptions"> & {
    /**
     * NOTE: ctype is deprecated. Use `features.(pb.cpp).string_type` instead.
     * The ctype option instructs the C++ code generator to use a different
     * representation of the field than it normally would.  See the specific
     * options below.  This option is only implemented to support use of
     * [ctype=CORD] and [ctype=STRING] (the default) on non-repeated fields of
     * type "bytes" in the open source release.
     * TODO: make ctype actually deprecated.
     *
     * @generated from field: optional google.protobuf.FieldOptions.CType ctype = 1 [default = STRING];
     */
    ctype: FieldOptions_CType;
    /**
     * The packed option can be enabled for repeated primitive fields to enable
     * a more efficient representation on the wire. Rather than repeatedly
     * writing the tag and type for each element, the entire array is encoded as
     * a single length-delimited blob. In proto3, only explicit setting it to
     * false will avoid using packed encoding.  This option is prohibited in
     * Editions, but the `repeated_field_encoding` feature can be used to control
     * the behavior.
     *
     * @generated from field: optional bool packed = 2;
     */
    packed: boolean;
    /**
     * The jstype option determines the JavaScript type used for values of the
     * field.  The option is permitted only for 64 bit integral and fixed types
     * (int64, uint64, sint64, fixed64, sfixed64).  A field with jstype JS_STRING
     * is represented as JavaScript string, which avoids loss of precision that
     * can happen when a large value is converted to a floating point JavaScript.
     * Specifying JS_NUMBER for the jstype causes the generated JavaScript code to
     * use the JavaScript "number" type.  The behavior of the default option
     * JS_NORMAL is implementation dependent.
     *
     * This option is an enum to permit additional types to be added, e.g.
     * goog.math.Integer.
     *
     * @generated from field: optional google.protobuf.FieldOptions.JSType jstype = 6 [default = JS_NORMAL];
     */
    jstype: FieldOptions_JSType;
    /**
     * Should this field be parsed lazily?  Lazy applies only to message-type
     * fields.  It means that when the outer message is initially parsed, the
     * inner message's contents will not be parsed but instead stored in encoded
     * form.  The inner message will actually be parsed when it is first accessed.
     *
     * This is only a hint.  Implementations are free to choose whether to use
     * eager or lazy parsing regardless of the value of this option.  However,
     * setting this option true suggests that the protocol author believes that
     * using lazy parsing on this field is worth the additional bookkeeping
     * overhead typically needed to implement it.
     *
     * This option does not affect the public interface of any generated code;
     * all method signatures remain the same.  Furthermore, thread-safety of the
     * interface is not affected by this option; const methods remain safe to
     * call from multiple threads concurrently, while non-const methods continue
     * to require exclusive access.
     *
     * Note that lazy message fields are still eagerly verified to check
     * ill-formed wireformat or missing required fields. Calling IsInitialized()
     * on the outer message would fail if the inner message has missing required
     * fields. Failed verification would result in parsing failure (except when
     * uninitialized messages are acceptable).
     *
     * @generated from field: optional bool lazy = 5 [default = false];
     */
    lazy: boolean;
    /**
     * unverified_lazy does no correctness checks on the byte stream. This should
     * only be used where lazy with verification is prohibitive for performance
     * reasons.
     *
     * @generated from field: optional bool unverified_lazy = 15 [default = false];
     */
    unverifiedLazy: boolean;
    /**
     * Is this field deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for accessors, or it will be completely ignored; in the very least, this
     * is a formalization for deprecating fields.
     *
     * @generated from field: optional bool deprecated = 3 [default = false];
     */
    deprecated: boolean;
    /**
     * DEPRECATED. DO NOT USE!
     * For Google-internal migration only. Do not use.
     *
     * @generated from field: optional bool weak = 10 [default = false, deprecated = true];
     * @deprecated
     */
    weak: boolean;
    /**
     * Indicate that the field value should not be printed out when using debug
     * formats, e.g. when the field contains sensitive credentials.
     *
     * @generated from field: optional bool debug_redact = 16 [default = false];
     */
    debugRedact: boolean;
    /**
     * @generated from field: optional google.protobuf.FieldOptions.OptionRetention retention = 17;
     */
    retention: FieldOptions_OptionRetention;
    /**
     * @generated from field: repeated google.protobuf.FieldOptions.OptionTargetType targets = 19;
     */
    targets: FieldOptions_OptionTargetType[];
    /**
     * @generated from field: repeated google.protobuf.FieldOptions.EditionDefault edition_defaults = 20;
     */
    editionDefaults: FieldOptions_EditionDefault[];
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 21;
     */
    features?: FeatureSet;
    /**
     * @generated from field: optional google.protobuf.FieldOptions.FeatureSupport feature_support = 22;
     */
    featureSupport?: FieldOptions_FeatureSupport;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption: UninterpretedOption[];
};
/**
 * @generated from message google.protobuf.FieldOptions
 */
export type FieldOptionsJson = {
    /**
     * NOTE: ctype is deprecated. Use `features.(pb.cpp).string_type` instead.
     * The ctype option instructs the C++ code generator to use a different
     * representation of the field than it normally would.  See the specific
     * options below.  This option is only implemented to support use of
     * [ctype=CORD] and [ctype=STRING] (the default) on non-repeated fields of
     * type "bytes" in the open source release.
     * TODO: make ctype actually deprecated.
     *
     * @generated from field: optional google.protobuf.FieldOptions.CType ctype = 1 [default = STRING];
     */
    ctype?: FieldOptions_CTypeJson;
    /**
     * The packed option can be enabled for repeated primitive fields to enable
     * a more efficient representation on the wire. Rather than repeatedly
     * writing the tag and type for each element, the entire array is encoded as
     * a single length-delimited blob. In proto3, only explicit setting it to
     * false will avoid using packed encoding.  This option is prohibited in
     * Editions, but the `repeated_field_encoding` feature can be used to control
     * the behavior.
     *
     * @generated from field: optional bool packed = 2;
     */
    packed?: boolean;
    /**
     * The jstype option determines the JavaScript type used for values of the
     * field.  The option is permitted only for 64 bit integral and fixed types
     * (int64, uint64, sint64, fixed64, sfixed64).  A field with jstype JS_STRING
     * is represented as JavaScript string, which avoids loss of precision that
     * can happen when a large value is converted to a floating point JavaScript.
     * Specifying JS_NUMBER for the jstype causes the generated JavaScript code to
     * use the JavaScript "number" type.  The behavior of the default option
     * JS_NORMAL is implementation dependent.
     *
     * This option is an enum to permit additional types to be added, e.g.
     * goog.math.Integer.
     *
     * @generated from field: optional google.protobuf.FieldOptions.JSType jstype = 6 [default = JS_NORMAL];
     */
    jstype?: FieldOptions_JSTypeJson;
    /**
     * Should this field be parsed lazily?  Lazy applies only to message-type
     * fields.  It means that when the outer message is initially parsed, the
     * inner message's contents will not be parsed but instead stored in encoded
     * form.  The inner message will actually be parsed when it is first accessed.
     *
     * This is only a hint.  Implementations are free to choose whether to use
     * eager or lazy parsing regardless of the value of this option.  However,
     * setting this option true suggests that the protocol author believes that
     * using lazy parsing on this field is worth the additional bookkeeping
     * overhead typically needed to implement it.
     *
     * This option does not affect the public interface of any generated code;
     * all method signatures remain the same.  Furthermore, thread-safety of the
     * interface is not affected by this option; const methods remain safe to
     * call from multiple threads concurrently, while non-const methods continue
     * to require exclusive access.
     *
     * Note that lazy message fields are still eagerly verified to check
     * ill-formed wireformat or missing required fields. Calling IsInitialized()
     * on the outer message would fail if the inner message has missing required
     * fields. Failed verification would result in parsing failure (except when
     * uninitialized messages are acceptable).
     *
     * @generated from field: optional bool lazy = 5 [default = false];
     */
    lazy?: boolean;
    /**
     * unverified_lazy does no correctness checks on the byte stream. This should
     * only be used where lazy with verification is prohibitive for performance
     * reasons.
     *
     * @generated from field: optional bool unverified_lazy = 15 [default = false];
     */
    unverifiedLazy?: boolean;
    /**
     * Is this field deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for accessors, or it will be completely ignored; in the very least, this
     * is a formalization for deprecating fields.
     *
     * @generated from field: optional bool deprecated = 3 [default = false];
     */
    deprecated?: boolean;
    /**
     * DEPRECATED. DO NOT USE!
     * For Google-internal migration only. Do not use.
     *
     * @generated from field: optional bool weak = 10 [default = false, deprecated = true];
     * @deprecated
     */
    weak?: boolean;
    /**
     * Indicate that the field value should not be printed out when using debug
     * formats, e.g. when the field contains sensitive credentials.
     *
     * @generated from field: optional bool debug_redact = 16 [default = false];
     */
    debugRedact?: boolean;
    /**
     * @generated from field: optional google.protobuf.FieldOptions.OptionRetention retention = 17;
     */
    retention?: FieldOptions_OptionRetentionJson;
    /**
     * @generated from field: repeated google.protobuf.FieldOptions.OptionTargetType targets = 19;
     */
    targets?: FieldOptions_OptionTargetTypeJson[];
    /**
     * @generated from field: repeated google.protobuf.FieldOptions.EditionDefault edition_defaults = 20;
     */
    editionDefaults?: FieldOptions_EditionDefaultJson[];
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 21;
     */
    features?: FeatureSetJson;
    /**
     * @generated from field: optional google.protobuf.FieldOptions.FeatureSupport feature_support = 22;
     */
    featureSupport?: FieldOptions_FeatureSupportJson;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption?: UninterpretedOptionJson[];
};
/**
 * Describes the message google.protobuf.FieldOptions.
 * Use `create(FieldOptionsSchema)` to create a new message.
 */
export declare const FieldOptionsSchema: GenMessage<FieldOptions, {
    jsonType: FieldOptionsJson;
}>;
/**
 * @generated from message google.protobuf.FieldOptions.EditionDefault
 */
export type FieldOptions_EditionDefault = Message<"google.protobuf.FieldOptions.EditionDefault"> & {
    /**
     * @generated from field: optional google.protobuf.Edition edition = 3;
     */
    edition: Edition;
    /**
     * Textproto value.
     *
     * @generated from field: optional string value = 2;
     */
    value: string;
};
/**
 * @generated from message google.protobuf.FieldOptions.EditionDefault
 */
export type FieldOptions_EditionDefaultJson = {
    /**
     * @generated from field: optional google.protobuf.Edition edition = 3;
     */
    edition?: EditionJson;
    /**
     * Textproto value.
     *
     * @generated from field: optional string value = 2;
     */
    value?: string;
};
/**
 * Describes the message google.protobuf.FieldOptions.EditionDefault.
 * Use `create(FieldOptions_EditionDefaultSchema)` to create a new message.
 */
export declare const FieldOptions_EditionDefaultSchema: GenMessage<FieldOptions_EditionDefault, {
    jsonType: FieldOptions_EditionDefaultJson;
}>;
/**
 * Information about the support window of a feature.
 *
 * @generated from message google.protobuf.FieldOptions.FeatureSupport
 */
export type FieldOptions_FeatureSupport = Message<"google.protobuf.FieldOptions.FeatureSupport"> & {
    /**
     * The edition that this feature was first available in.  In editions
     * earlier than this one, the default assigned to EDITION_LEGACY will be
     * used, and proto files will not be able to override it.
     *
     * @generated from field: optional google.protobuf.Edition edition_introduced = 1;
     */
    editionIntroduced: Edition;
    /**
     * The edition this feature becomes deprecated in.  Using this after this
     * edition may trigger warnings.
     *
     * @generated from field: optional google.protobuf.Edition edition_deprecated = 2;
     */
    editionDeprecated: Edition;
    /**
     * The deprecation warning text if this feature is used after the edition it
     * was marked deprecated in.
     *
     * @generated from field: optional string deprecation_warning = 3;
     */
    deprecationWarning: string;
    /**
     * The edition this feature is no longer available in.  In editions after
     * this one, the last default assigned will be used, and proto files will
     * not be able to override it.
     *
     * @generated from field: optional google.protobuf.Edition edition_removed = 4;
     */
    editionRemoved: Edition;
};
/**
 * Information about the support window of a feature.
 *
 * @generated from message google.protobuf.FieldOptions.FeatureSupport
 */
export type FieldOptions_FeatureSupportJson = {
    /**
     * The edition that this feature was first available in.  In editions
     * earlier than this one, the default assigned to EDITION_LEGACY will be
     * used, and proto files will not be able to override it.
     *
     * @generated from field: optional google.protobuf.Edition edition_introduced = 1;
     */
    editionIntroduced?: EditionJson;
    /**
     * The edition this feature becomes deprecated in.  Using this after this
     * edition may trigger warnings.
     *
     * @generated from field: optional google.protobuf.Edition edition_deprecated = 2;
     */
    editionDeprecated?: EditionJson;
    /**
     * The deprecation warning text if this feature is used after the edition it
     * was marked deprecated in.
     *
     * @generated from field: optional string deprecation_warning = 3;
     */
    deprecationWarning?: string;
    /**
     * The edition this feature is no longer available in.  In editions after
     * this one, the last default assigned will be used, and proto files will
     * not be able to override it.
     *
     * @generated from field: optional google.protobuf.Edition edition_removed = 4;
     */
    editionRemoved?: EditionJson;
};
/**
 * Describes the message google.protobuf.FieldOptions.FeatureSupport.
 * Use `create(FieldOptions_FeatureSupportSchema)` to create a new message.
 */
export declare const FieldOptions_FeatureSupportSchema: GenMessage<FieldOptions_FeatureSupport, {
    jsonType: FieldOptions_FeatureSupportJson;
}>;
/**
 * @generated from enum google.protobuf.FieldOptions.CType
 */
export declare enum FieldOptions_CType {
    /**
     * Default mode.
     *
     * @generated from enum value: STRING = 0;
     */
    STRING = 0,
    /**
     * The option [ctype=CORD] may be applied to a non-repeated field of type
     * "bytes". It indicates that in C++, the data should be stored in a Cord
     * instead of a string.  For very large strings, this may reduce memory
     * fragmentation. It may also allow better performance when parsing from a
     * Cord, or when parsing with aliasing enabled, as the parsed Cord may then
     * alias the original buffer.
     *
     * @generated from enum value: CORD = 1;
     */
    CORD = 1,
    /**
     * @generated from enum value: STRING_PIECE = 2;
     */
    STRING_PIECE = 2
}
/**
 * @generated from enum google.protobuf.FieldOptions.CType
 */
export type FieldOptions_CTypeJson = "STRING" | "CORD" | "STRING_PIECE";
/**
 * Describes the enum google.protobuf.FieldOptions.CType.
 */
export declare const FieldOptions_CTypeSchema: GenEnum<FieldOptions_CType, FieldOptions_CTypeJson>;
/**
 * @generated from enum google.protobuf.FieldOptions.JSType
 */
export declare enum FieldOptions_JSType {
    /**
     * Use the default type.
     *
     * @generated from enum value: JS_NORMAL = 0;
     */
    JS_NORMAL = 0,
    /**
     * Use JavaScript strings.
     *
     * @generated from enum value: JS_STRING = 1;
     */
    JS_STRING = 1,
    /**
     * Use JavaScript numbers.
     *
     * @generated from enum value: JS_NUMBER = 2;
     */
    JS_NUMBER = 2
}
/**
 * @generated from enum google.protobuf.FieldOptions.JSType
 */
export type FieldOptions_JSTypeJson = "JS_NORMAL" | "JS_STRING" | "JS_NUMBER";
/**
 * Describes the enum google.protobuf.FieldOptions.JSType.
 */
export declare const FieldOptions_JSTypeSchema: GenEnum<FieldOptions_JSType, FieldOptions_JSTypeJson>;
/**
 * If set to RETENTION_SOURCE, the option will be omitted from the binary.
 *
 * @generated from enum google.protobuf.FieldOptions.OptionRetention
 */
export declare enum FieldOptions_OptionRetention {
    /**
     * @generated from enum value: RETENTION_UNKNOWN = 0;
     */
    RETENTION_UNKNOWN = 0,
    /**
     * @generated from enum value: RETENTION_RUNTIME = 1;
     */
    RETENTION_RUNTIME = 1,
    /**
     * @generated from enum value: RETENTION_SOURCE = 2;
     */
    RETENTION_SOURCE = 2
}
/**
 * If set to RETENTION_SOURCE, the option will be omitted from the binary.
 *
 * @generated from enum google.protobuf.FieldOptions.OptionRetention
 */
export type FieldOptions_OptionRetentionJson = "RETENTION_UNKNOWN" | "RETENTION_RUNTIME" | "RETENTION_SOURCE";
/**
 * Describes the enum google.protobuf.FieldOptions.OptionRetention.
 */
export declare const FieldOptions_OptionRetentionSchema: GenEnum<FieldOptions_OptionRetention, FieldOptions_OptionRetentionJson>;
/**
 * This indicates the types of entities that the field may apply to when used
 * as an option. If it is unset, then the field may be freely used as an
 * option on any kind of entity.
 *
 * @generated from enum google.protobuf.FieldOptions.OptionTargetType
 */
export declare enum FieldOptions_OptionTargetType {
    /**
     * @generated from enum value: TARGET_TYPE_UNKNOWN = 0;
     */
    TARGET_TYPE_UNKNOWN = 0,
    /**
     * @generated from enum value: TARGET_TYPE_FILE = 1;
     */
    TARGET_TYPE_FILE = 1,
    /**
     * @generated from enum value: TARGET_TYPE_EXTENSION_RANGE = 2;
     */
    TARGET_TYPE_EXTENSION_RANGE = 2,
    /**
     * @generated from enum value: TARGET_TYPE_MESSAGE = 3;
     */
    TARGET_TYPE_MESSAGE = 3,
    /**
     * @generated from enum value: TARGET_TYPE_FIELD = 4;
     */
    TARGET_TYPE_FIELD = 4,
    /**
     * @generated from enum value: TARGET_TYPE_ONEOF = 5;
     */
    TARGET_TYPE_ONEOF = 5,
    /**
     * @generated from enum value: TARGET_TYPE_ENUM = 6;
     */
    TARGET_TYPE_ENUM = 6,
    /**
     * @generated from enum value: TARGET_TYPE_ENUM_ENTRY = 7;
     */
    TARGET_TYPE_ENUM_ENTRY = 7,
    /**
     * @generated from enum value: TARGET_TYPE_SERVICE = 8;
     */
    TARGET_TYPE_SERVICE = 8,
    /**
     * @generated from enum value: TARGET_TYPE_METHOD = 9;
     */
    TARGET_TYPE_METHOD = 9
}
/**
 * This indicates the types of entities that the field may apply to when used
 * as an option. If it is unset, then the field may be freely used as an
 * option on any kind of entity.
 *
 * @generated from enum google.protobuf.FieldOptions.OptionTargetType
 */
export type FieldOptions_OptionTargetTypeJson = "TARGET_TYPE_UNKNOWN" | "TARGET_TYPE_FILE" | "TARGET_TYPE_EXTENSION_RANGE" | "TARGET_TYPE_MESSAGE" | "TARGET_TYPE_FIELD" | "TARGET_TYPE_ONEOF" | "TARGET_TYPE_ENUM" | "TARGET_TYPE_ENUM_ENTRY" | "TARGET_TYPE_SERVICE" | "TARGET_TYPE_METHOD";
/**
 * Describes the enum google.protobuf.FieldOptions.OptionTargetType.
 */
export declare const FieldOptions_OptionTargetTypeSchema: GenEnum<FieldOptions_OptionTargetType, FieldOptions_OptionTargetTypeJson>;
/**
 * @generated from message google.protobuf.OneofOptions
 */
export type OneofOptions = Message<"google.protobuf.OneofOptions"> & {
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 1;
     */
    features?: FeatureSet;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption: UninterpretedOption[];
};
/**
 * @generated from message google.protobuf.OneofOptions
 */
export type OneofOptionsJson = {
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 1;
     */
    features?: FeatureSetJson;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption?: UninterpretedOptionJson[];
};
/**
 * Describes the message google.protobuf.OneofOptions.
 * Use `create(OneofOptionsSchema)` to create a new message.
 */
export declare const OneofOptionsSchema: GenMessage<OneofOptions, {
    jsonType: OneofOptionsJson;
}>;
/**
 * @generated from message google.protobuf.EnumOptions
 */
export type EnumOptions = Message<"google.protobuf.EnumOptions"> & {
    /**
     * Set this option to true to allow mapping different tag names to the same
     * value.
     *
     * @generated from field: optional bool allow_alias = 2;
     */
    allowAlias: boolean;
    /**
     * Is this enum deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for the enum, or it will be completely ignored; in the very least, this
     * is a formalization for deprecating enums.
     *
     * @generated from field: optional bool deprecated = 3 [default = false];
     */
    deprecated: boolean;
    /**
     * Enable the legacy handling of JSON field name conflicts.  This lowercases
     * and strips underscored from the fields before comparison in proto3 only.
     * The new behavior takes `json_name` into account and applies to proto2 as
     * well.
     * TODO Remove this legacy behavior once downstream teams have
     * had time to migrate.
     *
     * @generated from field: optional bool deprecated_legacy_json_field_conflicts = 6 [deprecated = true];
     * @deprecated
     */
    deprecatedLegacyJsonFieldConflicts: boolean;
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 7;
     */
    features?: FeatureSet;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption: UninterpretedOption[];
};
/**
 * @generated from message google.protobuf.EnumOptions
 */
export type EnumOptionsJson = {
    /**
     * Set this option to true to allow mapping different tag names to the same
     * value.
     *
     * @generated from field: optional bool allow_alias = 2;
     */
    allowAlias?: boolean;
    /**
     * Is this enum deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for the enum, or it will be completely ignored; in the very least, this
     * is a formalization for deprecating enums.
     *
     * @generated from field: optional bool deprecated = 3 [default = false];
     */
    deprecated?: boolean;
    /**
     * Enable the legacy handling of JSON field name conflicts.  This lowercases
     * and strips underscored from the fields before comparison in proto3 only.
     * The new behavior takes `json_name` into account and applies to proto2 as
     * well.
     * TODO Remove this legacy behavior once downstream teams have
     * had time to migrate.
     *
     * @generated from field: optional bool deprecated_legacy_json_field_conflicts = 6 [deprecated = true];
     * @deprecated
     */
    deprecatedLegacyJsonFieldConflicts?: boolean;
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 7;
     */
    features?: FeatureSetJson;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption?: UninterpretedOptionJson[];
};
/**
 * Describes the message google.protobuf.EnumOptions.
 * Use `create(EnumOptionsSchema)` to create a new message.
 */
export declare const EnumOptionsSchema: GenMessage<EnumOptions, {
    jsonType: EnumOptionsJson;
}>;
/**
 * @generated from message google.protobuf.EnumValueOptions
 */
export type EnumValueOptions = Message<"google.protobuf.EnumValueOptions"> & {
    /**
     * Is this enum value deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for the enum value, or it will be completely ignored; in the very least,
     * this is a formalization for deprecating enum values.
     *
     * @generated from field: optional bool deprecated = 1 [default = false];
     */
    deprecated: boolean;
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 2;
     */
    features?: FeatureSet;
    /**
     * Indicate that fields annotated with this enum value should not be printed
     * out when using debug formats, e.g. when the field contains sensitive
     * credentials.
     *
     * @generated from field: optional bool debug_redact = 3 [default = false];
     */
    debugRedact: boolean;
    /**
     * Information about the support window of a feature value.
     *
     * @generated from field: optional google.protobuf.FieldOptions.FeatureSupport feature_support = 4;
     */
    featureSupport?: FieldOptions_FeatureSupport;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption: UninterpretedOption[];
};
/**
 * @generated from message google.protobuf.EnumValueOptions
 */
export type EnumValueOptionsJson = {
    /**
     * Is this enum value deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for the enum value, or it will be completely ignored; in the very least,
     * this is a formalization for deprecating enum values.
     *
     * @generated from field: optional bool deprecated = 1 [default = false];
     */
    deprecated?: boolean;
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 2;
     */
    features?: FeatureSetJson;
    /**
     * Indicate that fields annotated with this enum value should not be printed
     * out when using debug formats, e.g. when the field contains sensitive
     * credentials.
     *
     * @generated from field: optional bool debug_redact = 3 [default = false];
     */
    debugRedact?: boolean;
    /**
     * Information about the support window of a feature value.
     *
     * @generated from field: optional google.protobuf.FieldOptions.FeatureSupport feature_support = 4;
     */
    featureSupport?: FieldOptions_FeatureSupportJson;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption?: UninterpretedOptionJson[];
};
/**
 * Describes the message google.protobuf.EnumValueOptions.
 * Use `create(EnumValueOptionsSchema)` to create a new message.
 */
export declare const EnumValueOptionsSchema: GenMessage<EnumValueOptions, {
    jsonType: EnumValueOptionsJson;
}>;
/**
 * @generated from message google.protobuf.ServiceOptions
 */
export type ServiceOptions = Message<"google.protobuf.ServiceOptions"> & {
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 34;
     */
    features?: FeatureSet;
    /**
     * Is this service deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for the service, or it will be completely ignored; in the very least,
     * this is a formalization for deprecating services.
     *
     * @generated from field: optional bool deprecated = 33 [default = false];
     */
    deprecated: boolean;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption: UninterpretedOption[];
};
/**
 * @generated from message google.protobuf.ServiceOptions
 */
export type ServiceOptionsJson = {
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 34;
     */
    features?: FeatureSetJson;
    /**
     * Is this service deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for the service, or it will be completely ignored; in the very least,
     * this is a formalization for deprecating services.
     *
     * @generated from field: optional bool deprecated = 33 [default = false];
     */
    deprecated?: boolean;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption?: UninterpretedOptionJson[];
};
/**
 * Describes the message google.protobuf.ServiceOptions.
 * Use `create(ServiceOptionsSchema)` to create a new message.
 */
export declare const ServiceOptionsSchema: GenMessage<ServiceOptions, {
    jsonType: ServiceOptionsJson;
}>;
/**
 * @generated from message google.protobuf.MethodOptions
 */
export type MethodOptions = Message<"google.protobuf.MethodOptions"> & {
    /**
     * Is this method deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for the method, or it will be completely ignored; in the very least,
     * this is a formalization for deprecating methods.
     *
     * @generated from field: optional bool deprecated = 33 [default = false];
     */
    deprecated: boolean;
    /**
     * @generated from field: optional google.protobuf.MethodOptions.IdempotencyLevel idempotency_level = 34 [default = IDEMPOTENCY_UNKNOWN];
     */
    idempotencyLevel: MethodOptions_IdempotencyLevel;
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 35;
     */
    features?: FeatureSet;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption: UninterpretedOption[];
};
/**
 * @generated from message google.protobuf.MethodOptions
 */
export type MethodOptionsJson = {
    /**
     * Is this method deprecated?
     * Depending on the target platform, this can emit Deprecated annotations
     * for the method, or it will be completely ignored; in the very least,
     * this is a formalization for deprecating methods.
     *
     * @generated from field: optional bool deprecated = 33 [default = false];
     */
    deprecated?: boolean;
    /**
     * @generated from field: optional google.protobuf.MethodOptions.IdempotencyLevel idempotency_level = 34 [default = IDEMPOTENCY_UNKNOWN];
     */
    idempotencyLevel?: MethodOptions_IdempotencyLevelJson;
    /**
     * Any features defined in the specific edition.
     * WARNING: This field should only be used by protobuf plugins or special
     * cases like the proto compiler. Other uses are discouraged and
     * developers should rely on the protoreflect APIs for their client language.
     *
     * @generated from field: optional google.protobuf.FeatureSet features = 35;
     */
    features?: FeatureSetJson;
    /**
     * The parser stores options it doesn't recognize here. See above.
     *
     * @generated from field: repeated google.protobuf.UninterpretedOption uninterpreted_option = 999;
     */
    uninterpretedOption?: UninterpretedOptionJson[];
};
/**
 * Describes the message google.protobuf.MethodOptions.
 * Use `create(MethodOptionsSchema)` to create a new message.
 */
export declare const MethodOptionsSchema: GenMessage<MethodOptions, {
    jsonType: MethodOptionsJson;
}>;
/**
 * Is this method side-effect-free (or safe in HTTP parlance), or idempotent,
 * or neither? HTTP based RPC implementation may choose GET verb for safe
 * methods, and PUT verb for idempotent methods instead of the default POST.
 *
 * @generated from enum google.protobuf.MethodOptions.IdempotencyLevel
 */
export declare enum MethodOptions_IdempotencyLevel {
    /**
     * @generated from enum value: IDEMPOTENCY_UNKNOWN = 0;
     */
    IDEMPOTENCY_UNKNOWN = 0,
    /**
     * implies idempotent
     *
     * @generated from enum value: NO_SIDE_EFFECTS = 1;
     */
    NO_SIDE_EFFECTS = 1,
    /**
     * idempotent, but may have side effects
     *
     * @generated from enum value: IDEMPOTENT = 2;
     */
    IDEMPOTENT = 2
}
/**
 * Is this method side-effect-free (or safe in HTTP parlance), or idempotent,
 * or neither? HTTP based RPC implementation may choose GET verb for safe
 * methods, and PUT verb for idempotent methods instead of the default POST.
 *
 * @generated from enum google.protobuf.MethodOptions.IdempotencyLevel
 */
export type MethodOptions_IdempotencyLevelJson = "IDEMPOTENCY_UNKNOWN" | "NO_SIDE_EFFECTS" | "IDEMPOTENT";
/**
 * Describes the enum google.protobuf.MethodOptions.IdempotencyLevel.
 */
export declare const MethodOptions_IdempotencyLevelSchema: GenEnum<MethodOptions_IdempotencyLevel, MethodOptions_IdempotencyLevelJson>;
/**
 * A message representing a option the parser does not recognize. This only
 * appears in options protos created by the compiler::Parser class.
 * DescriptorPool resolves these when building Descriptor objects. Therefore,
 * options protos in descriptor objects (e.g. returned by Descriptor::options(),
 * or produced by Descriptor::CopyTo()) will never have UninterpretedOptions
 * in them.
 *
 * @generated from message google.protobuf.UninterpretedOption
 */
export type UninterpretedOption = Message<"google.protobuf.UninterpretedOption"> & {
    /**
     * @generated from field: repeated google.protobuf.UninterpretedOption.NamePart name = 2;
     */
    name: UninterpretedOption_NamePart[];
    /**
     * The value of the uninterpreted option, in whatever type the tokenizer
     * identified it as during parsing. Exactly one of these should be set.
     *
     * @generated from field: optional string identifier_value = 3;
     */
    identifierValue: string;
    /**
     * @generated from field: optional uint64 positive_int_value = 4;
     */
    positiveIntValue: bigint;
    /**
     * @generated from field: optional int64 negative_int_value = 5;
     */
    negativeIntValue: bigint;
    /**
     * @generated from field: optional double double_value = 6;
     */
    doubleValue: number;
    /**
     * @generated from field: optional bytes string_value = 7;
     */
    stringValue: Uint8Array;
    /**
     * @generated from field: optional string aggregate_value = 8;
     */
    aggregateValue: string;
};
/**
 * A message representing a option the parser does not recognize. This only
 * appears in options protos created by the compiler::Parser class.
 * DescriptorPool resolves these when building Descriptor objects. Therefore,
 * options protos in descriptor objects (e.g. returned by Descriptor::options(),
 * or produced by Descriptor::CopyTo()) will never have UninterpretedOptions
 * in them.
 *
 * @generated from message google.protobuf.UninterpretedOption
 */
export type UninterpretedOptionJson = {
    /**
     * @generated from field: repeated google.protobuf.UninterpretedOption.NamePart name = 2;
     */
    name?: UninterpretedOption_NamePartJson[];
    /**
     * The value of the uninterpreted option, in whatever type the tokenizer
     * identified it as during parsing. Exactly one of these should be set.
     *
     * @generated from field: optional string identifier_value = 3;
     */
    identifierValue?: string;
    /**
     * @generated from field: optional uint64 positive_int_value = 4;
     */
    positiveIntValue?: string;
    /**
     * @generated from field: optional int64 negative_int_value = 5;
     */
    negativeIntValue?: string;
    /**
     * @generated from field: optional double double_value = 6;
     */
    doubleValue?: number | "NaN" | "Infinity" | "-Infinity";
    /**
     * @generated from field: optional bytes string_value = 7;
     */
    stringValue?: string;
    /**
     * @generated from field: optional string aggregate_value = 8;
     */
    aggregateValue?: string;
};
/**
 * Describes the message google.protobuf.UninterpretedOption.
 * Use `create(UninterpretedOptionSchema)` to create a new message.
 */
export declare const UninterpretedOptionSchema: GenMessage<UninterpretedOption, {
    jsonType: UninterpretedOptionJson;
}>;
/**
 * The name of the uninterpreted option.  Each string represents a segment in
 * a dot-separated name.  is_extension is true iff a segment represents an
 * extension (denoted with parentheses in options specs in .proto files).
 * E.g.,{ ["foo", false], ["bar.baz", true], ["moo", false] } represents
 * "foo.(bar.baz).moo".
 *
 * @generated from message google.protobuf.UninterpretedOption.NamePart
 */
export type UninterpretedOption_NamePart = Message<"google.protobuf.UninterpretedOption.NamePart"> & {
    /**
     * @generated from field: required string name_part = 1;
     */
    namePart: string;
    /**
     * @generated from field: required bool is_extension = 2;
     */
    isExtension: boolean;
};
/**
 * The name of the uninterpreted option.  Each string represents a segment in
 * a dot-separated name.  is_extension is true iff a segment represents an
 * extension (denoted with parentheses in options specs in .proto files).
 * E.g.,{ ["foo", false], ["bar.baz", true], ["moo", false] } represents
 * "foo.(bar.baz).moo".
 *
 * @generated from message google.protobuf.UninterpretedOption.NamePart
 */
export type UninterpretedOption_NamePartJson = {
    /**
     * @generated from field: required string name_part = 1;
     */
    namePart?: string;
    /**
     * @generated from field: required bool is_extension = 2;
     */
    isExtension?: boolean;
};
/**
 * Describes the message google.protobuf.UninterpretedOption.NamePart.
 * Use `create(UninterpretedOption_NamePartSchema)` to create a new message.
 */
export declare const UninterpretedOption_NamePartSchema: GenMessage<UninterpretedOption_NamePart, {
    jsonType: UninterpretedOption_NamePartJson;
}>;
/**
 * TODO Enums in C++ gencode (and potentially other languages) are
 * not well scoped.  This means that each of the feature enums below can clash
 * with each other.  The short names we've chosen maximize call-site
 * readability, but leave us very open to this scenario.  A future feature will
 * be designed and implemented to handle this, hopefully before we ever hit a
 * conflict here.
 *
 * @generated from message google.protobuf.FeatureSet
 */
export type FeatureSet = Message<"google.protobuf.FeatureSet"> & {
    /**
     * @generated from field: optional google.protobuf.FeatureSet.FieldPresence field_presence = 1;
     */
    fieldPresence: FeatureSet_FieldPresence;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.EnumType enum_type = 2;
     */
    enumType: FeatureSet_EnumType;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.RepeatedFieldEncoding repeated_field_encoding = 3;
     */
    repeatedFieldEncoding: FeatureSet_RepeatedFieldEncoding;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.Utf8Validation utf8_validation = 4;
     */
    utf8Validation: FeatureSet_Utf8Validation;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.MessageEncoding message_encoding = 5;
     */
    messageEncoding: FeatureSet_MessageEncoding;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.JsonFormat json_format = 6;
     */
    jsonFormat: FeatureSet_JsonFormat;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.EnforceNamingStyle enforce_naming_style = 7;
     */
    enforceNamingStyle: FeatureSet_EnforceNamingStyle;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility default_symbol_visibility = 8;
     */
    defaultSymbolVisibility: FeatureSet_VisibilityFeature_DefaultSymbolVisibility;
};
/**
 * TODO Enums in C++ gencode (and potentially other languages) are
 * not well scoped.  This means that each of the feature enums below can clash
 * with each other.  The short names we've chosen maximize call-site
 * readability, but leave us very open to this scenario.  A future feature will
 * be designed and implemented to handle this, hopefully before we ever hit a
 * conflict here.
 *
 * @generated from message google.protobuf.FeatureSet
 */
export type FeatureSetJson = {
    /**
     * @generated from field: optional google.protobuf.FeatureSet.FieldPresence field_presence = 1;
     */
    fieldPresence?: FeatureSet_FieldPresenceJson;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.EnumType enum_type = 2;
     */
    enumType?: FeatureSet_EnumTypeJson;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.RepeatedFieldEncoding repeated_field_encoding = 3;
     */
    repeatedFieldEncoding?: FeatureSet_RepeatedFieldEncodingJson;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.Utf8Validation utf8_validation = 4;
     */
    utf8Validation?: FeatureSet_Utf8ValidationJson;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.MessageEncoding message_encoding = 5;
     */
    messageEncoding?: FeatureSet_MessageEncodingJson;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.JsonFormat json_format = 6;
     */
    jsonFormat?: FeatureSet_JsonFormatJson;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.EnforceNamingStyle enforce_naming_style = 7;
     */
    enforceNamingStyle?: FeatureSet_EnforceNamingStyleJson;
    /**
     * @generated from field: optional google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility default_symbol_visibility = 8;
     */
    defaultSymbolVisibility?: FeatureSet_VisibilityFeature_DefaultSymbolVisibilityJson;
};
/**
 * Describes the message google.protobuf.FeatureSet.
 * Use `create(FeatureSetSchema)` to create a new message.
 */
export declare const FeatureSetSchema: GenMessage<FeatureSet, {
    jsonType: FeatureSetJson;
}>;
/**
 * @generated from message google.protobuf.FeatureSet.VisibilityFeature
 */
export type FeatureSet_VisibilityFeature = Message<"google.protobuf.FeatureSet.VisibilityFeature"> & {};
/**
 * @generated from message google.protobuf.FeatureSet.VisibilityFeature
 */
export type FeatureSet_VisibilityFeatureJson = {};
/**
 * Describes the message google.protobuf.FeatureSet.VisibilityFeature.
 * Use `create(FeatureSet_VisibilityFeatureSchema)` to create a new message.
 */
export declare const FeatureSet_VisibilityFeatureSchema: GenMessage<FeatureSet_VisibilityFeature, {
    jsonType: FeatureSet_VisibilityFeatureJson;
}>;
/**
 * @generated from enum google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility
 */
export declare enum FeatureSet_VisibilityFeature_DefaultSymbolVisibility {
    /**
     * @generated from enum value: DEFAULT_SYMBOL_VISIBILITY_UNKNOWN = 0;
     */
    DEFAULT_SYMBOL_VISIBILITY_UNKNOWN = 0,
    /**
     * Default pre-EDITION_2024, all UNSET visibility are export.
     *
     * @generated from enum value: EXPORT_ALL = 1;
     */
    EXPORT_ALL = 1,
    /**
     * All top-level symbols default to export, nested default to local.
     *
     * @generated from enum value: EXPORT_TOP_LEVEL = 2;
     */
    EXPORT_TOP_LEVEL = 2,
    /**
     * All symbols default to local.
     *
     * @generated from enum value: LOCAL_ALL = 3;
     */
    LOCAL_ALL = 3,
    /**
     * All symbols local by default. Nested types cannot be exported.
     * With special case caveat for message { enum {} reserved 1 to max; }
     * This is the recommended setting for new protos.
     *
     * @generated from enum value: STRICT = 4;
     */
    STRICT = 4
}
/**
 * @generated from enum google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility
 */
export type FeatureSet_VisibilityFeature_DefaultSymbolVisibilityJson = "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN" | "EXPORT_ALL" | "EXPORT_TOP_LEVEL" | "LOCAL_ALL" | "STRICT";
/**
 * Describes the enum google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility.
 */
export declare const FeatureSet_VisibilityFeature_DefaultSymbolVisibilitySchema: GenEnum<FeatureSet_VisibilityFeature_DefaultSymbolVisibility, FeatureSet_VisibilityFeature_DefaultSymbolVisibilityJson>;
/**
 * @generated from enum google.protobuf.FeatureSet.FieldPresence
 */
export declare enum FeatureSet_FieldPresence {
    /**
     * @generated from enum value: FIELD_PRESENCE_UNKNOWN = 0;
     */
    FIELD_PRESENCE_UNKNOWN = 0,
    /**
     * @generated from enum value: EXPLICIT = 1;
     */
    EXPLICIT = 1,
    /**
     * @generated from enum value: IMPLICIT = 2;
     */
    IMPLICIT = 2,
    /**
     * @generated from enum value: LEGACY_REQUIRED = 3;
     */
    LEGACY_REQUIRED = 3
}
/**
 * @generated from enum google.protobuf.FeatureSet.FieldPresence
 */
export type FeatureSet_FieldPresenceJson = "FIELD_PRESENCE_UNKNOWN" | "EXPLICIT" | "IMPLICIT" | "LEGACY_REQUIRED";
/**
 * Describes the enum google.protobuf.FeatureSet.FieldPresence.
 */
export declare const FeatureSet_FieldPresenceSchema: GenEnum<FeatureSet_FieldPresence, FeatureSet_FieldPresenceJson>;
/**
 * @generated from enum google.protobuf.FeatureSet.EnumType
 */
export declare enum FeatureSet_EnumType {
    /**
     * @generated from enum value: ENUM_TYPE_UNKNOWN = 0;
     */
    ENUM_TYPE_UNKNOWN = 0,
    /**
     * @generated from enum value: OPEN = 1;
     */
    OPEN = 1,
    /**
     * @generated from enum value: CLOSED = 2;
     */
    CLOSED = 2
}
/**
 * @generated from enum google.protobuf.FeatureSet.EnumType
 */
export type FeatureSet_EnumTypeJson = "ENUM_TYPE_UNKNOWN" | "OPEN" | "CLOSED";
/**
 * Describes the enum google.protobuf.FeatureSet.EnumType.
 */
export declare const FeatureSet_EnumTypeSchema: GenEnum<FeatureSet_EnumType, FeatureSet_EnumTypeJson>;
/**
 * @generated from enum google.protobuf.FeatureSet.RepeatedFieldEncoding
 */
export declare enum FeatureSet_RepeatedFieldEncoding {
    /**
     * @generated from enum value: REPEATED_FIELD_ENCODING_UNKNOWN = 0;
     */
    REPEATED_FIELD_ENCODING_UNKNOWN = 0,
    /**
     * @generated from enum value: PACKED = 1;
     */
    PACKED = 1,
    /**
     * @generated from enum value: EXPANDED = 2;
     */
    EXPANDED = 2
}
/**
 * @generated from enum google.protobuf.FeatureSet.RepeatedFieldEncoding
 */
export type FeatureSet_RepeatedFieldEncodingJson = "REPEATED_FIELD_ENCODING_UNKNOWN" | "PACKED" | "EXPANDED";
/**
 * Describes the enum google.protobuf.FeatureSet.RepeatedFieldEncoding.
 */
export declare const FeatureSet_RepeatedFieldEncodingSchema: GenEnum<FeatureSet_RepeatedFieldEncoding, FeatureSet_RepeatedFieldEncodingJson>;
/**
 * @generated from enum google.protobuf.FeatureSet.Utf8Validation
 */
export declare enum FeatureSet_Utf8Validation {
    /**
     * @generated from enum value: UTF8_VALIDATION_UNKNOWN = 0;
     */
    UTF8_VALIDATION_UNKNOWN = 0,
    /**
     * @generated from enum value: VERIFY = 2;
     */
    VERIFY = 2,
    /**
     * @generated from enum value: NONE = 3;
     */
    NONE = 3
}
/**
 * @generated from enum google.protobuf.FeatureSet.Utf8Validation
 */
export type FeatureSet_Utf8ValidationJson = "UTF8_VALIDATION_UNKNOWN" | "VERIFY" | "NONE";
/**
 * Describes the enum google.protobuf.FeatureSet.Utf8Validation.
 */
export declare const FeatureSet_Utf8ValidationSchema: GenEnum<FeatureSet_Utf8Validation, FeatureSet_Utf8ValidationJson>;
/**
 * @generated from enum google.protobuf.FeatureSet.MessageEncoding
 */
export declare enum FeatureSet_MessageEncoding {
    /**
     * @generated from enum value: MESSAGE_ENCODING_UNKNOWN = 0;
     */
    MESSAGE_ENCODING_UNKNOWN = 0,
    /**
     * @generated from enum value: LENGTH_PREFIXED = 1;
     */
    LENGTH_PREFIXED = 1,
    /**
     * @generated from enum value: DELIMITED = 2;
     */
    DELIMITED = 2
}
/**
 * @generated from enum google.protobuf.FeatureSet.MessageEncoding
 */
export type FeatureSet_MessageEncodingJson = "MESSAGE_ENCODING_UNKNOWN" | "LENGTH_PREFIXED" | "DELIMITED";
/**
 * Describes the enum google.protobuf.FeatureSet.MessageEncoding.
 */
export declare const FeatureSet_MessageEncodingSchema: GenEnum<FeatureSet_MessageEncoding, FeatureSet_MessageEncodingJson>;
/**
 * @generated from enum google.protobuf.FeatureSet.JsonFormat
 */
export declare enum FeatureSet_JsonFormat {
    /**
     * @generated from enum value: JSON_FORMAT_UNKNOWN = 0;
     */
    JSON_FORMAT_UNKNOWN = 0,
    /**
     * @generated from enum value: ALLOW = 1;
     */
    ALLOW = 1,
    /**
     * @generated from enum value: LEGACY_BEST_EFFORT = 2;
     */
    LEGACY_BEST_EFFORT = 2
}
/**
 * @generated from enum google.protobuf.FeatureSet.JsonFormat
 */
export type FeatureSet_JsonFormatJson = "JSON_FORMAT_UNKNOWN" | "ALLOW" | "LEGACY_BEST_EFFORT";
/**
 * Describes the enum google.protobuf.FeatureSet.JsonFormat.
 */
export declare const FeatureSet_JsonFormatSchema: GenEnum<FeatureSet_JsonFormat, FeatureSet_JsonFormatJson>;
/**
 * @generated from enum google.protobuf.FeatureSet.EnforceNamingStyle
 */
export declare enum FeatureSet_EnforceNamingStyle {
    /**
     * @generated from enum value: ENFORCE_NAMING_STYLE_UNKNOWN = 0;
     */
    ENFORCE_NAMING_STYLE_UNKNOWN = 0,
    /**
     * @generated from enum value: STYLE2024 = 1;
     */
    STYLE2024 = 1,
    /**
     * @generated from enum value: STYLE_LEGACY = 2;
     */
    STYLE_LEGACY = 2
}
/**
 * @generated from enum google.protobuf.FeatureSet.EnforceNamingStyle
 */
export type FeatureSet_EnforceNamingStyleJson = "ENFORCE_NAMING_STYLE_UNKNOWN" | "STYLE2024" | "STYLE_LEGACY";
/**
 * Describes the enum google.protobuf.FeatureSet.EnforceNamingStyle.
 */
export declare const FeatureSet_EnforceNamingStyleSchema: GenEnum<FeatureSet_EnforceNamingStyle, FeatureSet_EnforceNamingStyleJson>;
/**
 * A compiled specification for the defaults of a set of features.  These
 * messages are generated from FeatureSet extensions and can be used to seed
 * feature resolution. The resolution with this object becomes a simple search
 * for the closest matching edition, followed by proto merges.
 *
 * @generated from message google.protobuf.FeatureSetDefaults
 */
export type FeatureSetDefaults = Message<"google.protobuf.FeatureSetDefaults"> & {
    /**
     * @generated from field: repeated google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault defaults = 1;
     */
    defaults: FeatureSetDefaults_FeatureSetEditionDefault[];
    /**
     * The minimum supported edition (inclusive) when this was constructed.
     * Editions before this will not have defaults.
     *
     * @generated from field: optional google.protobuf.Edition minimum_edition = 4;
     */
    minimumEdition: Edition;
    /**
     * The maximum known edition (inclusive) when this was constructed. Editions
     * after this will not have reliable defaults.
     *
     * @generated from field: optional google.protobuf.Edition maximum_edition = 5;
     */
    maximumEdition: Edition;
};
/**
 * A compiled specification for the defaults of a set of features.  These
 * messages are generated from FeatureSet extensions and can be used to seed
 * feature resolution. The resolution with this object becomes a simple search
 * for the closest matching edition, followed by proto merges.
 *
 * @generated from message google.protobuf.FeatureSetDefaults
 */
export type FeatureSetDefaultsJson = {
    /**
     * @generated from field: repeated google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault defaults = 1;
     */
    defaults?: FeatureSetDefaults_FeatureSetEditionDefaultJson[];
    /**
     * The minimum supported edition (inclusive) when this was constructed.
     * Editions before this will not have defaults.
     *
     * @generated from field: optional google.protobuf.Edition minimum_edition = 4;
     */
    minimumEdition?: EditionJson;
    /**
     * The maximum known edition (inclusive) when this was constructed. Editions
     * after this will not have reliable defaults.
     *
     * @generated from field: optional google.protobuf.Edition maximum_edition = 5;
     */
    maximumEdition?: EditionJson;
};
/**
 * Describes the message google.protobuf.FeatureSetDefaults.
 * Use `create(FeatureSetDefaultsSchema)` to create a new message.
 */
export declare const FeatureSetDefaultsSchema: GenMessage<FeatureSetDefaults, {
    jsonType: FeatureSetDefaultsJson;
}>;
/**
 * A map from every known edition with a unique set of defaults to its
 * defaults. Not all editions may be contained here.  For a given edition,
 * the defaults at the closest matching edition ordered at or before it should
 * be used.  This field must be in strict ascending order by edition.
 *
 * @generated from message google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault
 */
export type FeatureSetDefaults_FeatureSetEditionDefault = Message<"google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault"> & {
    /**
     * @generated from field: optional google.protobuf.Edition edition = 3;
     */
    edition: Edition;
    /**
     * Defaults of features that can be overridden in this edition.
     *
     * @generated from field: optional google.protobuf.FeatureSet overridable_features = 4;
     */
    overridableFeatures?: FeatureSet;
    /**
     * Defaults of features that can't be overridden in this edition.
     *
     * @generated from field: optional google.protobuf.FeatureSet fixed_features = 5;
     */
    fixedFeatures?: FeatureSet;
};
/**
 * A map from every known edition with a unique set of defaults to its
 * defaults. Not all editions may be contained here.  For a given edition,
 * the defaults at the closest matching edition ordered at or before it should
 * be used.  This field must be in strict ascending order by edition.
 *
 * @generated from message google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault
 */
export type FeatureSetDefaults_FeatureSetEditionDefaultJson = {
    /**
     * @generated from field: optional google.protobuf.Edition edition = 3;
     */
    edition?: EditionJson;
    /**
     * Defaults of features that can be overridden in this edition.
     *
     * @generated from field: optional google.protobuf.FeatureSet overridable_features = 4;
     */
    overridableFeatures?: FeatureSetJson;
    /**
     * Defaults of features that can't be overridden in this edition.
     *
     * @generated from field: optional google.protobuf.FeatureSet fixed_features = 5;
     */
    fixedFeatures?: FeatureSetJson;
};
/**
 * Describes the message google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault.
 * Use `create(FeatureSetDefaults_FeatureSetEditionDefaultSchema)` to create a new message.
 */
export declare const FeatureSetDefaults_FeatureSetEditionDefaultSchema: GenMessage<FeatureSetDefaults_FeatureSetEditionDefault, {
    jsonType: FeatureSetDefaults_FeatureSetEditionDefaultJson;
}>;
/**
 * Encapsulates information about the original source file from which a
 * FileDescriptorProto was generated.
 *
 * @generated from message google.protobuf.SourceCodeInfo
 */
export type SourceCodeInfo = Message<"google.protobuf.SourceCodeInfo"> & {
    /**
     * A Location identifies a piece of source code in a .proto file which
     * corresponds to a particular definition.  This information is intended
     * to be useful to IDEs, code indexers, documentation generators, and similar
     * tools.
     *
     * For example, say we have a file like:
     *   message Foo {
     *     optional string foo = 1;
     *   }
     * Let's look at just the field definition:
     *   optional string foo = 1;
     *   ^       ^^     ^^  ^  ^^^
     *   a       bc     de  f  ghi
     * We have the following locations:
     *   span   path               represents
     *   [a,i)  [ 4, 0, 2, 0 ]     The whole field definition.
     *   [a,b)  [ 4, 0, 2, 0, 4 ]  The label (optional).
     *   [c,d)  [ 4, 0, 2, 0, 5 ]  The type (string).
     *   [e,f)  [ 4, 0, 2, 0, 1 ]  The name (foo).
     *   [g,h)  [ 4, 0, 2, 0, 3 ]  The number (1).
     *
     * Notes:
     * - A location may refer to a repeated field itself (i.e. not to any
     *   particular index within it).  This is used whenever a set of elements are
     *   logically enclosed in a single code segment.  For example, an entire
     *   extend block (possibly containing multiple extension definitions) will
     *   have an outer location whose path refers to the "extensions" repeated
     *   field without an index.
     * - Multiple locations may have the same path.  This happens when a single
     *   logical declaration is spread out across multiple places.  The most
     *   obvious example is the "extend" block again -- there may be multiple
     *   extend blocks in the same scope, each of which will have the same path.
     * - A location's span is not always a subset of its parent's span.  For
     *   example, the "extendee" of an extension declaration appears at the
     *   beginning of the "extend" block and is shared by all extensions within
     *   the block.
     * - Just because a location's span is a subset of some other location's span
     *   does not mean that it is a descendant.  For example, a "group" defines
     *   both a type and a field in a single declaration.  Thus, the locations
     *   corresponding to the type and field and their components will overlap.
     * - Code which tries to interpret locations should probably be designed to
     *   ignore those that it doesn't understand, as more types of locations could
     *   be recorded in the future.
     *
     * @generated from field: repeated google.protobuf.SourceCodeInfo.Location location = 1;
     */
    location: SourceCodeInfo_Location[];
};
/**
 * Encapsulates information about the original source file from which a
 * FileDescriptorProto was generated.
 *
 * @generated from message google.protobuf.SourceCodeInfo
 */
export type SourceCodeInfoJson = {
    /**
     * A Location identifies a piece of source code in a .proto file which
     * corresponds to a particular definition.  This information is intended
     * to be useful to IDEs, code indexers, documentation generators, and similar
     * tools.
     *
     * For example, say we have a file like:
     *   message Foo {
     *     optional string foo = 1;
     *   }
     * Let's look at just the field definition:
     *   optional string foo = 1;
     *   ^       ^^     ^^  ^  ^^^
     *   a       bc     de  f  ghi
     * We have the following locations:
     *   span   path               represents
     *   [a,i)  [ 4, 0, 2, 0 ]     The whole field definition.
     *   [a,b)  [ 4, 0, 2, 0, 4 ]  The label (optional).
     *   [c,d)  [ 4, 0, 2, 0, 5 ]  The type (string).
     *   [e,f)  [ 4, 0, 2, 0, 1 ]  The name (foo).
     *   [g,h)  [ 4, 0, 2, 0, 3 ]  The number (1).
     *
     * Notes:
     * - A location may refer to a repeated field itself (i.e. not to any
     *   particular index within it).  This is used whenever a set of elements are
     *   logically enclosed in a single code segment.  For example, an entire
     *   extend block (possibly containing multiple extension definitions) will
     *   have an outer location whose path refers to the "extensions" repeated
     *   field without an index.
     * - Multiple locations may have the same path.  This happens when a single
     *   logical declaration is spread out across multiple places.  The most
     *   obvious example is the "extend" block again -- there may be multiple
     *   extend blocks in the same scope, each of which will have the same path.
     * - A location's span is not always a subset of its parent's span.  For
     *   example, the "extendee" of an extension declaration appears at the
     *   beginning of the "extend" block and is shared by all extensions within
     *   the block.
     * - Just because a location's span is a subset of some other location's span
     *   does not mean that it is a descendant.  For example, a "group" defines
     *   both a type and a field in a single declaration.  Thus, the locations
     *   corresponding to the type and field and their components will overlap.
     * - Code which tries to interpret locations should probably be designed to
     *   ignore those that it doesn't understand, as more types of locations could
     *   be recorded in the future.
     *
     * @generated from field: repeated google.protobuf.SourceCodeInfo.Location location = 1;
     */
    location?: SourceCodeInfo_LocationJson[];
};
/**
 * Describes the message google.protobuf.SourceCodeInfo.
 * Use `create(SourceCodeInfoSchema)` to create a new message.
 */
export declare const SourceCodeInfoSchema: GenMessage<SourceCodeInfo, {
    jsonType: SourceCodeInfoJson;
}>;
/**
 * @generated from message google.protobuf.SourceCodeInfo.Location
 */
export type SourceCodeInfo_Location = Message<"google.protobuf.SourceCodeInfo.Location"> & {
    /**
     * Identifies which part of the FileDescriptorProto was defined at this
     * location.
     *
     * Each element is a field number or an index.  They form a path from
     * the root FileDescriptorProto to the place where the definition appears.
     * For example, this path:
     *   [ 4, 3, 2, 7, 1 ]
     * refers to:
     *   file.message_type(3)  // 4, 3
     *       .field(7)         // 2, 7
     *       .name()           // 1
     * This is because FileDescriptorProto.message_type has field number 4:
     *   repeated DescriptorProto message_type = 4;
     * and DescriptorProto.field has field number 2:
     *   repeated FieldDescriptorProto field = 2;
     * and FieldDescriptorProto.name has field number 1:
     *   optional string name = 1;
     *
     * Thus, the above path gives the location of a field name.  If we removed
     * the last element:
     *   [ 4, 3, 2, 7 ]
     * this path refers to the whole field declaration (from the beginning
     * of the label to the terminating semicolon).
     *
     * @generated from field: repeated int32 path = 1 [packed = true];
     */
    path: number[];
    /**
     * Always has exactly three or four elements: start line, start column,
     * end line (optional, otherwise assumed same as start line), end column.
     * These are packed into a single field for efficiency.  Note that line
     * and column numbers are zero-based -- typically you will want to add
     * 1 to each before displaying to a user.
     *
     * @generated from field: repeated int32 span = 2 [packed = true];
     */
    span: number[];
    /**
     * If this SourceCodeInfo represents a complete declaration, these are any
     * comments appearing before and after the declaration which appear to be
     * attached to the declaration.
     *
     * A series of line comments appearing on consecutive lines, with no other
     * tokens appearing on those lines, will be treated as a single comment.
     *
     * leading_detached_comments will keep paragraphs of comments that appear
     * before (but not connected to) the current element. Each paragraph,
     * separated by empty lines, will be one comment element in the repeated
     * field.
     *
     * Only the comment content is provided; comment markers (e.g. //) are
     * stripped out.  For block comments, leading whitespace and an asterisk
     * will be stripped from the beginning of each line other than the first.
     * Newlines are included in the output.
     *
     * Examples:
     *
     *   optional int32 foo = 1;  // Comment attached to foo.
     *   // Comment attached to bar.
     *   optional int32 bar = 2;
     *
     *   optional string baz = 3;
     *   // Comment attached to baz.
     *   // Another line attached to baz.
     *
     *   // Comment attached to moo.
     *   //
     *   // Another line attached to moo.
     *   optional double moo = 4;
     *
     *   // Detached comment for corge. This is not leading or trailing comments
     *   // to moo or corge because there are blank lines separating it from
     *   // both.
     *
     *   // Detached comment for corge paragraph 2.
     *
     *   optional string corge = 5;
     *   /* Block comment attached
     *    * to corge.  Leading asterisks
     *    * will be removed. *\/
     *   /* Block comment attached to
     *    * grault. *\/
     *   optional int32 grault = 6;
     *
     *   // ignored detached comments.
     *
     * @generated from field: optional string leading_comments = 3;
     */
    leadingComments: string;
    /**
     * @generated from field: optional string trailing_comments = 4;
     */
    trailingComments: string;
    /**
     * @generated from field: repeated string leading_detached_comments = 6;
     */
    leadingDetachedComments: string[];
};
/**
 * @generated from message google.protobuf.SourceCodeInfo.Location
 */
export type SourceCodeInfo_LocationJson = {
    /**
     * Identifies which part of the FileDescriptorProto was defined at this
     * location.
     *
     * Each element is a field number or an index.  They form a path from
     * the root FileDescriptorProto to the place where the definition appears.
     * For example, this path:
     *   [ 4, 3, 2, 7, 1 ]
     * refers to:
     *   file.message_type(3)  // 4, 3
     *       .field(7)         // 2, 7
     *       .name()           // 1
     * This is because FileDescriptorProto.message_type has field number 4:
     *   repeated DescriptorProto message_type = 4;
     * and DescriptorProto.field has field number 2:
     *   repeated FieldDescriptorProto field = 2;
     * and FieldDescriptorProto.name has field number 1:
     *   optional string name = 1;
     *
     * Thus, the above path gives the location of a field name.  If we removed
     * the last element:
     *   [ 4, 3, 2, 7 ]
     * this path refers to the whole field declaration (from the beginning
     * of the label to the terminating semicolon).
     *
     * @generated from field: repeated int32 path = 1 [packed = true];
     */
    path?: number[];
    /**
     * Always has exactly three or four elements: start line, start column,
     * end line (optional, otherwise assumed same as start line), end column.
     * These are packed into a single field for efficiency.  Note that line
     * and column numbers are zero-based -- typically you will want to add
     * 1 to each before displaying to a user.
     *
     * @generated from field: repeated int32 span = 2 [packed = true];
     */
    span?: number[];
    /**
     * If this SourceCodeInfo represents a complete declaration, these are any
     * comments appearing before and after the declaration which appear to be
     * attached to the declaration.
     *
     * A series of line comments appearing on consecutive lines, with no other
     * tokens appearing on those lines, will be treated as a single comment.
     *
     * leading_detached_comments will keep paragraphs of comments that appear
     * before (but not connected to) the current element. Each paragraph,
     * separated by empty lines, will be one comment element in the repeated
     * field.
     *
     * Only the comment content is provided; comment markers (e.g. //) are
     * stripped out.  For block comments, leading whitespace and an asterisk
     * will be stripped from the beginning of each line other than the first.
     * Newlines are included in the output.
     *
     * Examples:
     *
     *   optional int32 foo = 1;  // Comment attached to foo.
     *   // Comment attached to bar.
     *   optional int32 bar = 2;
     *
     *   optional string baz = 3;
     *   // Comment attached to baz.
     *   // Another line attached to baz.
     *
     *   // Comment attached to moo.
     *   //
     *   // Another line attached to moo.
     *   optional double moo = 4;
     *
     *   // Detached comment for corge. This is not leading or trailing comments
     *   // to moo or corge because there are blank lines separating it from
     *   // both.
     *
     *   // Detached comment for corge paragraph 2.
     *
     *   optional string corge = 5;
     *   /* Block comment attached
     *    * to corge.  Leading asterisks
     *    * will be removed. *\/
     *   /* Block comment attached to
     *    * grault. *\/
     *   optional int32 grault = 6;
     *
     *   // ignored detached comments.
     *
     * @generated from field: optional string leading_comments = 3;
     */
    leadingComments?: string;
    /**
     * @generated from field: optional string trailing_comments = 4;
     */
    trailingComments?: string;
    /**
     * @generated from field: repeated string leading_detached_comments = 6;
     */
    leadingDetachedComments?: string[];
};
/**
 * Describes the message google.protobuf.SourceCodeInfo.Location.
 * Use `create(SourceCodeInfo_LocationSchema)` to create a new message.
 */
export declare const SourceCodeInfo_LocationSchema: GenMessage<SourceCodeInfo_Location, {
    jsonType: SourceCodeInfo_LocationJson;
}>;
/**
 * Describes the relationship between generated code and its original source
 * file. A GeneratedCodeInfo message is associated with only one generated
 * source file, but may contain references to different source .proto files.
 *
 * @generated from message google.protobuf.GeneratedCodeInfo
 */
export type GeneratedCodeInfo = Message<"google.protobuf.GeneratedCodeInfo"> & {
    /**
     * An Annotation connects some span of text in generated code to an element
     * of its generating .proto file.
     *
     * @generated from field: repeated google.protobuf.GeneratedCodeInfo.Annotation annotation = 1;
     */
    annotation: GeneratedCodeInfo_Annotation[];
};
/**
 * Describes the relationship between generated code and its original source
 * file. A GeneratedCodeInfo message is associated with only one generated
 * source file, but may contain references to different source .proto files.
 *
 * @generated from message google.protobuf.GeneratedCodeInfo
 */
export type GeneratedCodeInfoJson = {
    /**
     * An Annotation connects some span of text in generated code to an element
     * of its generating .proto file.
     *
     * @generated from field: repeated google.protobuf.GeneratedCodeInfo.Annotation annotation = 1;
     */
    annotation?: GeneratedCodeInfo_AnnotationJson[];
};
/**
 * Describes the message google.protobuf.GeneratedCodeInfo.
 * Use `create(GeneratedCodeInfoSchema)` to create a new message.
 */
export declare const GeneratedCodeInfoSchema: GenMessage<GeneratedCodeInfo, {
    jsonType: GeneratedCodeInfoJson;
}>;
/**
 * @generated from message google.protobuf.GeneratedCodeInfo.Annotation
 */
export type GeneratedCodeInfo_Annotation = Message<"google.protobuf.GeneratedCodeInfo.Annotation"> & {
    /**
     * Identifies the element in the original source .proto file. This field
     * is formatted the same as SourceCodeInfo.Location.path.
     *
     * @generated from field: repeated int32 path = 1 [packed = true];
     */
    path: number[];
    /**
     * Identifies the filesystem path to the original source .proto.
     *
     * @generated from field: optional string source_file = 2;
     */
    sourceFile: string;
    /**
     * Identifies the starting offset in bytes in the generated code
     * that relates to the identified object.
     *
     * @generated from field: optional int32 begin = 3;
     */
    begin: number;
    /**
     * Identifies the ending offset in bytes in the generated code that
     * relates to the identified object. The end offset should be one past
     * the last relevant byte (so the length of the text = end - begin).
     *
     * @generated from field: optional int32 end = 4;
     */
    end: number;
    /**
     * @generated from field: optional google.protobuf.GeneratedCodeInfo.Annotation.Semantic semantic = 5;
     */
    semantic: GeneratedCodeInfo_Annotation_Semantic;
};
/**
 * @generated from message google.protobuf.GeneratedCodeInfo.Annotation
 */
export type GeneratedCodeInfo_AnnotationJson = {
    /**
     * Identifies the element in the original source .proto file. This field
     * is formatted the same as SourceCodeInfo.Location.path.
     *
     * @generated from field: repeated int32 path = 1 [packed = true];
     */
    path?: number[];
    /**
     * Identifies the filesystem path to the original source .proto.
     *
     * @generated from field: optional string source_file = 2;
     */
    sourceFile?: string;
    /**
     * Identifies the starting offset in bytes in the generated code
     * that relates to the identified object.
     *
     * @generated from field: optional int32 begin = 3;
     */
    begin?: number;
    /**
     * Identifies the ending offset in bytes in the generated code that
     * relates to the identified object. The end offset should be one past
     * the last relevant byte (so the length of the text = end - begin).
     *
     * @generated from field: optional int32 end = 4;
     */
    end?: number;
    /**
     * @generated from field: optional google.protobuf.GeneratedCodeInfo.Annotation.Semantic semantic = 5;
     */
    semantic?: GeneratedCodeInfo_Annotation_SemanticJson;
};
/**
 * Describes the message google.protobuf.GeneratedCodeInfo.Annotation.
 * Use `create(GeneratedCodeInfo_AnnotationSchema)` to create a new message.
 */
export declare const GeneratedCodeInfo_AnnotationSchema: GenMessage<GeneratedCodeInfo_Annotation, {
    jsonType: GeneratedCodeInfo_AnnotationJson;
}>;
/**
 * Represents the identified object's effect on the element in the original
 * .proto file.
 *
 * @generated from enum google.protobuf.GeneratedCodeInfo.Annotation.Semantic
 */
export declare enum GeneratedCodeInfo_Annotation_Semantic {
    /**
     * There is no effect or the effect is indescribable.
     *
     * @generated from enum value: NONE = 0;
     */
    NONE = 0,
    /**
     * The element is set or otherwise mutated.
     *
     * @generated from enum value: SET = 1;
     */
    SET = 1,
    /**
     * An alias to the element is returned.
     *
     * @generated from enum value: ALIAS = 2;
     */
    ALIAS = 2
}
/**
 * Represents the identified object's effect on the element in the original
 * .proto file.
 *
 * @generated from enum google.protobuf.GeneratedCodeInfo.Annotation.Semantic
 */
export type GeneratedCodeInfo_Annotation_SemanticJson = "NONE" | "SET" | "ALIAS";
/**
 * Describes the enum google.protobuf.GeneratedCodeInfo.Annotation.Semantic.
 */
export declare const GeneratedCodeInfo_Annotation_SemanticSchema: GenEnum<GeneratedCodeInfo_Annotation_Semantic, GeneratedCodeInfo_Annotation_SemanticJson>;
/**
 * The full set of known editions.
 *
 * @generated from enum google.protobuf.Edition
 */
export declare enum Edition {
    /**
     * A placeholder for an unknown edition value.
     *
     * @generated from enum value: EDITION_UNKNOWN = 0;
     */
    EDITION_UNKNOWN = 0,
    /**
     * A placeholder edition for specifying default behaviors *before* a feature
     * was first introduced.  This is effectively an "infinite past".
     *
     * @generated from enum value: EDITION_LEGACY = 900;
     */
    EDITION_LEGACY = 900,
    /**
     * Legacy syntax "editions".  These pre-date editions, but behave much like
     * distinct editions.  These can't be used to specify the edition of proto
     * files, but feature definitions must supply proto2/proto3 defaults for
     * backwards compatibility.
     *
     * @generated from enum value: EDITION_PROTO2 = 998;
     */
    EDITION_PROTO2 = 998,
    /**
     * @generated from enum value: EDITION_PROTO3 = 999;
     */
    EDITION_PROTO3 = 999,
    /**
     * Editions that have been released.  The specific values are arbitrary and
     * should not be depended on, but they will always be time-ordered for easy
     * comparison.
     *
     * @generated from enum value: EDITION_2023 = 1000;
     */
    EDITION_2023 = 1000,
    /**
     * @generated from enum value: EDITION_2024 = 1001;
     */
    EDITION_2024 = 1001,
    /**
     * Placeholder editions for testing feature resolution.  These should not be
     * used or relied on outside of tests.
     *
     * @generated from enum value: EDITION_1_TEST_ONLY = 1;
     */
    EDITION_1_TEST_ONLY = 1,
    /**
     * @generated from enum value: EDITION_2_TEST_ONLY = 2;
     */
    EDITION_2_TEST_ONLY = 2,
    /**
     * @generated from enum value: EDITION_99997_TEST_ONLY = 99997;
     */
    EDITION_99997_TEST_ONLY = 99997,
    /**
     * @generated from enum value: EDITION_99998_TEST_ONLY = 99998;
     */
    EDITION_99998_TEST_ONLY = 99998,
    /**
     * @generated from enum value: EDITION_99999_TEST_ONLY = 99999;
     */
    EDITION_99999_TEST_ONLY = 99999,
    /**
     * Placeholder for specifying unbounded edition support.  This should only
     * ever be used by plugins that can expect to never require any changes to
     * support a new edition.
     *
     * @generated from enum value: EDITION_MAX = 2147483647;
     */
    EDITION_MAX = 2147483647
}
/**
 * The full set of known editions.
 *
 * @generated from enum google.protobuf.Edition
 */
export type EditionJson = "EDITION_UNKNOWN" | "EDITION_LEGACY" | "EDITION_PROTO2" | "EDITION_PROTO3" | "EDITION_2023" | "EDITION_2024" | "EDITION_1_TEST_ONLY" | "EDITION_2_TEST_ONLY" | "EDITION_99997_TEST_ONLY" | "EDITION_99998_TEST_ONLY" | "EDITION_99999_TEST_ONLY" | "EDITION_MAX";
/**
 * Describes the enum google.protobuf.Edition.
 */
export declare const EditionSchema: GenEnum<Edition, EditionJson>;
/**
 * Describes the 'visibility' of a symbol with respect to the proto import
 * system. Symbols can only be imported when the visibility rules do not prevent
 * it (ex: local symbols cannot be imported).  Visibility modifiers can only set
 * on `message` and `enum` as they are the only types available to be referenced
 * from other files.
 *
 * @generated from enum google.protobuf.SymbolVisibility
 */
export declare enum SymbolVisibility {
    /**
     * @generated from enum value: VISIBILITY_UNSET = 0;
     */
    VISIBILITY_UNSET = 0,
    /**
     * @generated from enum value: VISIBILITY_LOCAL = 1;
     */
    VISIBILITY_LOCAL = 1,
    /**
     * @generated from enum value: VISIBILITY_EXPORT = 2;
     */
    VISIBILITY_EXPORT = 2
}
/**
 * Describes the 'visibility' of a symbol with respect to the proto import
 * system. Symbols can only be imported when the visibility rules do not prevent
 * it (ex: local symbols cannot be imported).  Visibility modifiers can only set
 * on `message` and `enum` as they are the only types available to be referenced
 * from other files.
 *
 * @generated from enum google.protobuf.SymbolVisibility
 */
export type SymbolVisibilityJson = "VISIBILITY_UNSET" | "VISIBILITY_LOCAL" | "VISIBILITY_EXPORT";
/**
 * Describes the enum google.protobuf.SymbolVisibility.
 */
export declare const SymbolVisibilitySchema: GenEnum<SymbolVisibility, SymbolVisibilityJson>;
