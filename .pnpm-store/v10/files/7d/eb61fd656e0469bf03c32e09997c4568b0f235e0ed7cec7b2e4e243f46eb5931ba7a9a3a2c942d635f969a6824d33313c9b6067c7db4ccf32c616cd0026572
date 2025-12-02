import type { DescEnum, DescExtension, DescMessage, DescService } from "../descriptors.js";
import { type FileDescriptorProto } from "../wkt/gen/google/protobuf/descriptor_pb.js";
import type { FileDescriptorProtoBoot } from "./boot.js";
type EmbedUnknown = {
    bootable: false;
    proto(): FileDescriptorProto;
    base64(): string;
};
type EmbedDescriptorProto = Omit<EmbedUnknown, "bootable"> & {
    bootable: true;
    boot(): FileDescriptorProtoBoot;
};
/**
 * Create necessary information to embed a file descriptor in
 * generated code.
 *
 * @private
 */
export declare function embedFileDesc(file: FileDescriptorProto): EmbedUnknown | EmbedDescriptorProto;
/**
 * Compute the path to a message, enumeration, extension, or service in a
 * file descriptor.
 *
 * @private
 */
export declare function pathInFileDesc(desc: DescMessage | DescEnum | DescExtension | DescService): number[];
/**
 * The file descriptor for google/protobuf/descriptor.proto cannot be embedded
 * in serialized form, since it is required to parse itself.
 *
 * This function takes an instance of the message, and returns a plain object
 * that can be hydrated to the message again via bootFileDescriptorProto().
 *
 * This function only works with a message google.protobuf.FileDescriptorProto
 * for google/protobuf/descriptor.proto, and only supports features that are
 * relevant for the specific use case. For example, it discards file options,
 * reserved ranges and reserved names, and field options that are unused in
 * descriptor.proto.
 *
 * @private
 */
export declare function createFileDescriptorProtoBoot(proto: FileDescriptorProto): FileDescriptorProtoBoot;
export {};
