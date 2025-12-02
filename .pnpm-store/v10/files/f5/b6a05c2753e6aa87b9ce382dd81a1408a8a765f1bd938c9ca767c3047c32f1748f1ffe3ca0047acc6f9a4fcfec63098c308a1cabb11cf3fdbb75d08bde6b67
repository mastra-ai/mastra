import * as flatbuffers from 'flatbuffers';
/**
 * A Map is a logical nested type that is represented as
 *
 * List<entries: Struct<key: K, value: V>>
 *
 * In this layout, the keys and values are each respectively contiguous. We do
 * not constrain the key and value types, so the application is responsible
 * for ensuring that the keys are hashable and unique. Whether the keys are sorted
 * may be set in the metadata for this field.
 *
 * In a field with Map type, the field has a child Struct field, which then
 * has two children: key type and the second the value type. The names of the
 * child fields may be respectively "entries", "key", and "value", but this is
 * not enforced.
 *
 * Map
 * ```text
 *   - child[0] entries: Struct
 *     - child[0] key: K
 *     - child[1] value: V
 * ```
 * Neither the "entries" field nor the "key" field may be nullable.
 *
 * The metadata is structured so that Arrow systems without special handling
 * for Map can make Map an alias for List. The "layout" attribute for the Map
 * field must have the same contents as a List.
 */
export declare class Map {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Map;
    static getRootAsMap(bb: flatbuffers.ByteBuffer, obj?: Map): Map;
    static getSizePrefixedRootAsMap(bb: flatbuffers.ByteBuffer, obj?: Map): Map;
    /**
     * Set to true if the keys within each value are sorted
     */
    keysSorted(): boolean;
    static startMap(builder: flatbuffers.Builder): void;
    static addKeysSorted(builder: flatbuffers.Builder, keysSorted: boolean): void;
    static endMap(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createMap(builder: flatbuffers.Builder, keysSorted: boolean): flatbuffers.Offset;
}
