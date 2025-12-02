import type { AnyDesc, DescEnum, DescEnumValue, DescExtension, DescField, DescFile, DescMessage, DescMethod, DescOneof, DescService } from "./descriptors.js";
import type { ReflectMessage } from "./reflect/reflect-types.js";
import type { Extendee, ExtensionValueShape } from "./types.js";
import type { EnumOptions, EnumValueOptions, FieldOptions, FileOptions, MessageOptions, MethodOptions, OneofOptions, ServiceOptions } from "./wkt/gen/google/protobuf/descriptor_pb.js";
/**
 * Retrieve an extension value from a message.
 *
 * The function never returns undefined. Use hasExtension() to check whether an
 * extension is set. If the extension is not set, this function returns the
 * default value (if one was specified in the protobuf source), or the zero value
 * (for example `0` for numeric types, `[]` for repeated extension fields, and
 * an empty message instance for message fields).
 *
 * Extensions are stored as unknown fields on a message. To mutate an extension
 * value, make sure to store the new value with setExtension() after mutating.
 *
 * If the extension does not extend the given message, an error is raised.
 */
export declare function getExtension<Desc extends DescExtension>(message: Extendee<Desc>, extension: Desc): ExtensionValueShape<Desc>;
/**
 * Set an extension value on a message. If the message already has a value for
 * this extension, the value is replaced.
 *
 * If the extension does not extend the given message, an error is raised.
 */
export declare function setExtension<Desc extends DescExtension>(message: Extendee<Desc>, extension: Desc, value: ExtensionValueShape<Desc>): void;
/**
 * Remove an extension value from a message.
 *
 * If the extension does not extend the given message, an error is raised.
 */
export declare function clearExtension<Desc extends DescExtension>(message: Extendee<Desc>, extension: Desc): void;
/**
 * Check whether an extension is set on a message.
 */
export declare function hasExtension<Desc extends DescExtension>(message: Extendee<Desc>, extension: Desc): boolean;
/**
 * Check whether an option is set on a descriptor.
 *
 * Options are extensions to the `google.protobuf.*Options` messages defined in
 * google/protobuf/descriptor.proto. This function gets the option message from
 * the descriptor, and calls hasExtension().
 */
export declare function hasOption<Ext extends DescExtension, Desc extends DescForOptionExtension<Ext>>(element: Desc, option: Ext): boolean;
/**
 * Retrieve an option value from a descriptor.
 *
 * Options are extensions to the `google.protobuf.*Options` messages defined in
 * google/protobuf/descriptor.proto. This function gets the option message from
 * the descriptor, and calls getExtension(). Same as getExtension(), this
 * function never returns undefined.
 */
export declare function getOption<Ext extends DescExtension, Desc extends DescForOptionExtension<Ext>>(element: Desc, option: Ext): ExtensionValueShape<Ext>;
type DescForOptionExtension<Ext extends DescExtension> = Extendee<Ext> extends FileOptions ? DescFile : Extendee<Ext> extends EnumOptions ? DescEnum : Extendee<Ext> extends EnumValueOptions ? DescEnumValue : Extendee<Ext> extends MessageOptions ? DescMessage : Extendee<Ext> extends MessageOptions ? DescEnum : Extendee<Ext> extends FieldOptions ? DescField | DescExtension : Extendee<Ext> extends OneofOptions ? DescOneof : Extendee<Ext> extends ServiceOptions ? DescService : Extendee<Ext> extends EnumOptions ? DescEnum : Extendee<Ext> extends MethodOptions ? DescMethod : AnyDesc;
/**
 * @private
 */
export declare function createExtensionContainer<Desc extends DescExtension>(extension: Desc, value?: ExtensionValueShape<Desc>): [ReflectMessage, DescField, () => ExtensionValueShape<Desc>];
export {};
