import type { DescField, DescMessage, DescOneof } from "../descriptors.js";
import { unsafeLocal } from "./unsafe.js";
import type { Message, UnknownField } from "../types.js";
import type { ScalarValue } from "./scalar.js";
/**
 * ReflectMessage provides dynamic access and manipulation of a message.
 */
export interface ReflectMessage {
    /**
     * The underlying message instance.
     */
    readonly message: Message;
    /**
     * The descriptor for the message.
     */
    readonly desc: DescMessage;
    /**
     * The fields of the message. This is a shortcut to message.fields.
     */
    readonly fields: readonly DescField[];
    /**
     * The fields of the message, sorted by field number ascending.
     */
    readonly sortedFields: readonly DescField[];
    /**
     * Oneof groups of the message. This is a shortcut to message.oneofs.
     */
    readonly oneofs: readonly DescOneof[];
    /**
     * Fields and oneof groups for this message. This is a shortcut to message.members.
     */
    readonly members: readonly (DescField | DescOneof)[];
    /**
     * Find a field by number.
     */
    findNumber(number: number): DescField | undefined;
    /**
     * Returns true if the field is set.
     *
     * - Scalar and enum fields with implicit presence (proto3):
     *   Set if not a zero value.
     *
     * - Scalar and enum fields with explicit presence (proto2, oneof):
     *   Set if a value was set when creating or parsing the message, or when a
     *   value was assigned to the field's property.
     *
     * - Message fields:
     *   Set if the property is not undefined.
     *
     * - List and map fields:
     *   Set if not empty.
     */
    isSet(field: DescField): boolean;
    /**
     * Resets the field, so that isSet() will return false.
     */
    clear(field: DescField): void;
    /**
     * Return the selected field of a oneof group.
     */
    oneofCase(oneof: DescOneof): DescField | undefined;
    /**
     * Returns the field value. Values are converted or wrapped to make it easier
     * to manipulate messages.
     *
     * - Scalar fields:
     *   Returns the value, but converts 64-bit integer fields with the option
     *   `jstype=JS_STRING` to a bigint value.
     *   If the field is not set, the default value is returned. If no default
     *   value is set, the zero value is returned.
     *
     * - Enum fields:
     *   Returns the numeric value. If the field is not set, the default value is
     *   returned. If no default value is set, the zero value is returned.
     *
     * - Message fields:
     *   Returns a ReflectMessage. If the field is not set, a new message is
     *   returned, but not set on the field.
     *
     * - List fields:
     *   Returns a ReflectList object.
     *
     * - Map fields:
     *   Returns a ReflectMap object.
     *
     * Note that get() never returns `undefined`. To determine whether a field is
     * set, use isSet().
     */
    get<Field extends DescField>(field: Field): ReflectMessageGet<Field>;
    /**
     * Set a field value.
     *
     * Expects values in the same form that get() returns:
     *
     * - Scalar fields:
     *   64-bit integer fields with the option `jstype=JS_STRING` as a bigint value.
     *
     * - Message fields:
     *   ReflectMessage.
     *
     * - List fields:
     *   ReflectList.
     *
     * - Map fields:
     *   ReflectMap.
     *
     * Throws an error if the value is invalid for the field. `undefined` is not
     * a valid value. To reset a field, use clear().
     */
    set<Field extends DescField>(field: Field, value: unknown): void;
    /**
     * Returns the unknown fields of the message.
     */
    getUnknown(): UnknownField[] | undefined;
    /**
     * Sets the unknown fields of the message, overwriting any previous values.
     */
    setUnknown(value: UnknownField[]): void;
    [unsafeLocal]: Message;
}
/**
 * ReflectList provides dynamic access and manipulation of a list field on a
 * message.
 *
 * ReflectList is iterable - you can loop through all items with a for...of loop.
 *
 * Values are converted or wrapped to make it easier to manipulate them:
 * - Scalar 64-bit integer fields with the option `jstype=JS_STRING` are
 *   converted to bigint.
 * - Messages are wrapped in a ReflectMessage.
 */
export interface ReflectList<V = unknown> extends Iterable<V> {
    /**
     * Returns the list field.
     */
    field(): DescField & {
        fieldKind: "list";
    };
    /**
     * The size of the list.
     */
    readonly size: number;
    /**
     * Retrieves the item at the specified index, or undefined if the index
     * is out of range.
     */
    get(index: number): V | undefined;
    /**
     * Adds an item at the end of the list.
     * Throws an error if an item is invalid for this list.
     */
    add(item: V): void;
    /**
     * Replaces the item at the specified index with the specified item.
     * Throws an error if the index is out of range (index < 0 || index >= size).
     * Throws an error if the item is invalid for this list.
     */
    set(index: number, item: V): void;
    /**
     * Removes all items from the list.
     */
    clear(): void;
    [Symbol.iterator](): IterableIterator<V>;
    entries(): IterableIterator<[number, V]>;
    keys(): IterableIterator<number>;
    values(): IterableIterator<V>;
    [unsafeLocal]: unknown[];
}
/**
 * ReflectMap provides dynamic access and manipulation of a map field on a
 * message.
 *
 * ReflectMap is iterable - you can loop through all entries with a for...of loop.
 *
 * Keys and values are converted or wrapped to make it easier to manipulate them:
 * - A map field is a record object on a message, where keys are always strings.
 *   ReflectMap converts keys to their closest possible type in TypeScript.
 * - Messages are wrapped in a ReflectMessage.
 */
export interface ReflectMap<K = unknown, V = unknown> extends ReadonlyMap<K, V> {
    /**
     * Returns the map field.
     */
    field(): DescField & {
        fieldKind: "map";
    };
    /**
     * Removes the entry for the specified key.
     * Returns false if the key is unknown.
     */
    delete(key: K): boolean;
    /**
     * Sets or replaces the item at the specified key with the specified value.
     * Throws an error if the key or value is invalid for this map.
     */
    set(key: K, value: V): this;
    /**
     * Removes all entries from the map.
     */
    clear(): void;
    [unsafeLocal]: Record<string, unknown>;
}
/**
 * The return type of ReflectMessage.get()
 */
export type ReflectMessageGet<Field extends DescField = DescField> = (Field extends {
    fieldKind: "map";
} ? ReflectMap : Field extends {
    fieldKind: "list";
} ? ReflectList : Field extends {
    fieldKind: "enum";
} ? number : Field extends {
    fieldKind: "message";
} ? ReflectMessage : Field extends {
    fieldKind: "scalar";
    scalar: infer T;
} ? ScalarValue<T> : never);
