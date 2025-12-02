import type { FileDescriptorProto, FileDescriptorSet } from "./wkt/gen/google/protobuf/descriptor_pb.js";
import { type DescEnum, type DescExtension, type DescFile, type DescMessage, type DescService, type SupportedEdition } from "./descriptors.js";
/**
 * A set of descriptors for messages, enumerations, extensions,
 * and services.
 */
export interface Registry {
    readonly kind: "registry";
    /**
     * All types (message, enumeration, extension, or service) contained
     * in this registry.
     */
    [Symbol.iterator](): IterableIterator<DescMessage | DescEnum | DescExtension | DescService>;
    /**
     * Look up a type (message, enumeration, extension, or service) by
     * its fully qualified name.
     */
    get(typeName: string): DescMessage | DescEnum | DescExtension | DescService | undefined;
    /**
     * Look up a message descriptor by its fully qualified name.
     */
    getMessage(typeName: string): DescMessage | undefined;
    /**
     * Look up an enumeration descriptor by its fully qualified name.
     */
    getEnum(typeName: string): DescEnum | undefined;
    /**
     * Look up an extension descriptor by its fully qualified name.
     */
    getExtension(typeName: string): DescExtension | undefined;
    /**
     * Look up an extension by the extendee - the message it extends - and
     * the extension number.
     */
    getExtensionFor(extendee: DescMessage, no: number): DescExtension | undefined;
    /**
     * Look up a service descriptor by its fully qualified name.
     */
    getService(typeName: string): DescService | undefined;
}
/**
 * A registry that allows adding and removing descriptors.
 */
export interface MutableRegistry extends Registry {
    /**
     * Adds the given descriptor - but not types nested within - to the registry.
     */
    add(desc: DescMessage | DescEnum | DescExtension | DescService): void;
    /**
     * Remove the given descriptor - but not types nested within - from the registry.
     */
    remove(desc: DescMessage | DescEnum | DescExtension | DescService): void;
}
/**
 * A registry that includes files.
 */
export interface FileRegistry extends Registry {
    /**
     * All files in this registry.
     */
    readonly files: Iterable<DescFile>;
    /**
     * Look up a file descriptor by file name.
     */
    getFile(fileName: string): DescFile | undefined;
}
/**
 * Create a registry from the given inputs.
 *
 * An input can be:
 * - Any message, enum, service, or extension descriptor, which adds just the
 *   descriptor for this type.
 * - A file descriptor, which adds all typed defined in this file.
 * - A registry, which adds all types from the registry.
 *
 * For duplicate descriptors (same type name), the one given last wins.
 */
export declare function createRegistry(...input: (Registry | DescFile | DescMessage | DescEnum | DescExtension | DescService)[]): Registry;
/**
 * Create a registry that allows adding and removing descriptors.
 */
export declare function createMutableRegistry(...input: (Registry | DescFile | DescMessage | DescEnum | DescExtension | DescService)[]): MutableRegistry;
/**
 * Create a registry (including file descriptors) from a google.protobuf.FileDescriptorSet
 * message.
 */
export declare function createFileRegistry(fileDescriptorSet: FileDescriptorSet): FileRegistry;
/**
 * Create a registry (including file descriptors) from a google.protobuf.FileDescriptorProto
 * message. For every import, the given resolver function is called.
 */
export declare function createFileRegistry(fileDescriptorProto: FileDescriptorProto, resolve: (protoFileName: string) => FileDescriptorProto | DescFile | undefined): FileRegistry;
/**
 * Create a registry (including file descriptors) from one or more registries,
 * merging them.
 */
export declare function createFileRegistry(...registries: FileRegistry[]): FileRegistry;
export declare const minimumEdition: SupportedEdition, maximumEdition: SupportedEdition;
