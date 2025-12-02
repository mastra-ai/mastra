import type { DescriptorProto_ExtensionRange, FieldDescriptorProto_Label, FieldDescriptorProto_Type, FieldOptions_OptionRetention, FieldOptions_OptionTargetType, FieldOptions_EditionDefault, EnumValueDescriptorProto, FileDescriptorProto } from "../wkt/gen/google/protobuf/descriptor_pb.js";
import type { DescFile } from "../descriptors.js";
/**
 * Hydrate a file descriptor for google/protobuf/descriptor.proto from a plain
 * object.
 *
 * See createFileDescriptorProtoBoot() for details.
 *
 * @private
 */
export declare function boot(boot: FileDescriptorProtoBoot): DescFile;
/**
 * An object literal for initializing the message google.protobuf.FileDescriptorProto
 * for google/protobuf/descriptor.proto.
 *
 * See createFileDescriptorProtoBoot() for details.
 *
 * @private
 */
export type FileDescriptorProtoBoot = {
    name: "google/protobuf/descriptor.proto";
    package: "google.protobuf";
    messageType: DescriptorProtoBoot[];
    enumType: EnumDescriptorProtoBoot[];
};
export type DescriptorProtoBoot = {
    name: string;
    field?: FieldDescriptorProtoBoot[];
    nestedType?: DescriptorProtoBoot[];
    enumType?: EnumDescriptorProtoBoot[];
    extensionRange?: Pick<DescriptorProto_ExtensionRange, "start" | "end">[];
};
export type FieldDescriptorProtoBoot = {
    name: string;
    number: number;
    label?: FieldDescriptorProto_Label;
    type: FieldDescriptorProto_Type;
    typeName?: string;
    extendee?: string;
    defaultValue?: string;
    options?: FieldOptionsBoot;
};
export type FieldOptionsBoot = {
    packed?: boolean;
    deprecated?: boolean;
    retention?: FieldOptions_OptionRetention;
    targets?: FieldOptions_OptionTargetType[];
    editionDefaults?: FieldOptions_EditionDefaultBoot[];
};
export type FieldOptions_EditionDefaultBoot = Pick<FieldOptions_EditionDefault, "edition" | "value">;
export type EnumDescriptorProtoBoot = {
    name: string;
    value: EnumValueDescriptorProtoBoot[];
};
export type EnumValueDescriptorProtoBoot = Pick<EnumValueDescriptorProto, "name" | "number">;
/**
 * Creates the message google.protobuf.FileDescriptorProto from an object literal.
 *
 * See createFileDescriptorProtoBoot() for details.
 *
 * @private
 */
export declare function bootFileDescriptorProto(init: FileDescriptorProtoBoot): FileDescriptorProto;
