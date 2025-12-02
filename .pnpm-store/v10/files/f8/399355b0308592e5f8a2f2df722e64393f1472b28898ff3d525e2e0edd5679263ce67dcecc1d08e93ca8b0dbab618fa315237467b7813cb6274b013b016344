import type { GenEnum, GenFile, GenMessage } from "../../../../codegenv2/types.js";
import type { Message } from "../../../../types.js";
import type { JsonObject, JsonValue } from "../../../../json-value.js";
/**
 * Describes the file google/protobuf/struct.proto.
 */
export declare const file_google_protobuf_struct: GenFile;
/**
 * `Struct` represents a structured data value, consisting of fields
 * which map to dynamically typed values. In some languages, `Struct`
 * might be supported by a native representation. For example, in
 * scripting languages like JS a struct is represented as an
 * object. The details of that representation are described together
 * with the proto support for the language.
 *
 * The JSON representation for `Struct` is JSON object.
 *
 * @generated from message google.protobuf.Struct
 */
export type Struct = Message<"google.protobuf.Struct"> & {
    /**
     * Unordered map of dynamically typed values.
     *
     * @generated from field: map<string, google.protobuf.Value> fields = 1;
     */
    fields: {
        [key: string]: Value;
    };
};
/**
 * `Struct` represents a structured data value, consisting of fields
 * which map to dynamically typed values. In some languages, `Struct`
 * might be supported by a native representation. For example, in
 * scripting languages like JS a struct is represented as an
 * object. The details of that representation are described together
 * with the proto support for the language.
 *
 * The JSON representation for `Struct` is JSON object.
 *
 * @generated from message google.protobuf.Struct
 */
export type StructJson = JsonObject;
/**
 * Describes the message google.protobuf.Struct.
 * Use `create(StructSchema)` to create a new message.
 */
export declare const StructSchema: GenMessage<Struct, {
    jsonType: StructJson;
}>;
/**
 * `Value` represents a dynamically typed value which can be either
 * null, a number, a string, a boolean, a recursive struct value, or a
 * list of values. A producer of value is expected to set one of these
 * variants. Absence of any variant indicates an error.
 *
 * The JSON representation for `Value` is JSON value.
 *
 * @generated from message google.protobuf.Value
 */
export type Value = Message<"google.protobuf.Value"> & {
    /**
     * The kind of value.
     *
     * @generated from oneof google.protobuf.Value.kind
     */
    kind: {
        /**
         * Represents a null value.
         *
         * @generated from field: google.protobuf.NullValue null_value = 1;
         */
        value: NullValue;
        case: "nullValue";
    } | {
        /**
         * Represents a double value.
         *
         * @generated from field: double number_value = 2;
         */
        value: number;
        case: "numberValue";
    } | {
        /**
         * Represents a string value.
         *
         * @generated from field: string string_value = 3;
         */
        value: string;
        case: "stringValue";
    } | {
        /**
         * Represents a boolean value.
         *
         * @generated from field: bool bool_value = 4;
         */
        value: boolean;
        case: "boolValue";
    } | {
        /**
         * Represents a structured value.
         *
         * @generated from field: google.protobuf.Struct struct_value = 5;
         */
        value: Struct;
        case: "structValue";
    } | {
        /**
         * Represents a repeated `Value`.
         *
         * @generated from field: google.protobuf.ListValue list_value = 6;
         */
        value: ListValue;
        case: "listValue";
    } | {
        case: undefined;
        value?: undefined;
    };
};
/**
 * `Value` represents a dynamically typed value which can be either
 * null, a number, a string, a boolean, a recursive struct value, or a
 * list of values. A producer of value is expected to set one of these
 * variants. Absence of any variant indicates an error.
 *
 * The JSON representation for `Value` is JSON value.
 *
 * @generated from message google.protobuf.Value
 */
export type ValueJson = JsonValue;
/**
 * Describes the message google.protobuf.Value.
 * Use `create(ValueSchema)` to create a new message.
 */
export declare const ValueSchema: GenMessage<Value, {
    jsonType: ValueJson;
}>;
/**
 * `ListValue` is a wrapper around a repeated field of values.
 *
 * The JSON representation for `ListValue` is JSON array.
 *
 * @generated from message google.protobuf.ListValue
 */
export type ListValue = Message<"google.protobuf.ListValue"> & {
    /**
     * Repeated field of dynamically typed values.
     *
     * @generated from field: repeated google.protobuf.Value values = 1;
     */
    values: Value[];
};
/**
 * `ListValue` is a wrapper around a repeated field of values.
 *
 * The JSON representation for `ListValue` is JSON array.
 *
 * @generated from message google.protobuf.ListValue
 */
export type ListValueJson = JsonValue[];
/**
 * Describes the message google.protobuf.ListValue.
 * Use `create(ListValueSchema)` to create a new message.
 */
export declare const ListValueSchema: GenMessage<ListValue, {
    jsonType: ListValueJson;
}>;
/**
 * `NullValue` is a singleton enumeration to represent the null value for the
 * `Value` type union.
 *
 * The JSON representation for `NullValue` is JSON `null`.
 *
 * @generated from enum google.protobuf.NullValue
 */
export declare enum NullValue {
    /**
     * Null value.
     *
     * @generated from enum value: NULL_VALUE = 0;
     */
    NULL_VALUE = 0
}
/**
 * `NullValue` is a singleton enumeration to represent the null value for the
 * `Value` type union.
 *
 * The JSON representation for `NullValue` is JSON `null`.
 *
 * @generated from enum google.protobuf.NullValue
 */
export type NullValueJson = null;
/**
 * Describes the enum google.protobuf.NullValue.
 */
export declare const NullValueSchema: GenEnum<NullValue, NullValueJson>;
