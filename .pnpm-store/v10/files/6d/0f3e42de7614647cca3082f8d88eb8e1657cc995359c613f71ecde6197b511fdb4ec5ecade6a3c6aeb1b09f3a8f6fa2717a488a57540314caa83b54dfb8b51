import { type DescEnum, type DescMessage } from "./descriptors.js";
import type { JsonValue } from "./json-value.js";
import type { Registry } from "./registry.js";
import type { EnumJsonType, EnumShape, MessageJsonType, MessageShape } from "./types.js";
/**
 * Options for serializing to JSON.
 */
export interface JsonWriteOptions {
    /**
     * By default, fields with implicit presence are not serialized if they are
     * unset. For example, an empty list field or a proto3 int32 field with 0 is
     * not serialized. With this option enabled, such fields are included in the
     * output.
     */
    alwaysEmitImplicit: boolean;
    /**
     * Emit enum values as integers instead of strings: The name of an enum
     * value is used by default in JSON output. An option may be provided to
     * use the numeric value of the enum value instead.
     */
    enumAsInteger: boolean;
    /**
     * Use proto field name instead of lowerCamelCase name: By default proto3
     * JSON printer should convert the field name to lowerCamelCase and use
     * that as the JSON name. An implementation may provide an option to use
     * proto field name as the JSON name instead. Proto3 JSON parsers are
     * required to accept both the converted lowerCamelCase name and the proto
     * field name.
     */
    useProtoFieldName: boolean;
    /**
     * This option is required to write `google.protobuf.Any` and extensions
     * to JSON format.
     */
    registry?: Registry;
}
/**
 * Options for serializing to JSON.
 */
export interface JsonWriteStringOptions extends JsonWriteOptions {
    /**
     * Format JSON with indentation. Indicates the number of space characters to
     * be used as indentation.
     *
     * This option is passed to JSON.stringify as `space`.
     */
    prettySpaces: number;
}
/**
 * Serialize the message to a JSON value, a JavaScript value that can be
 * passed to JSON.stringify().
 */
export declare function toJson<Desc extends DescMessage, Opts extends Partial<JsonWriteOptions> | undefined = undefined>(schema: Desc, message: MessageShape<Desc>, options?: Opts): ToJson<Desc, Opts>;
type ToJson<Desc extends DescMessage, Opts extends undefined | Partial<JsonWriteOptions>> = Opts extends undefined | {
    alwaysEmitImplicit?: false;
    enumAsInteger?: false;
    useProtoFieldName?: false;
} ? MessageJsonType<Desc> : JsonValue;
/**
 * Serialize the message to a JSON string.
 */
export declare function toJsonString<Desc extends DescMessage>(schema: Desc, message: MessageShape<Desc>, options?: Partial<JsonWriteStringOptions>): string;
/**
 * Serialize a single enum value to JSON.
 */
export declare function enumToJson<Desc extends DescEnum>(descEnum: Desc, value: EnumShape<Desc>): EnumJsonType<Desc>;
export {};
