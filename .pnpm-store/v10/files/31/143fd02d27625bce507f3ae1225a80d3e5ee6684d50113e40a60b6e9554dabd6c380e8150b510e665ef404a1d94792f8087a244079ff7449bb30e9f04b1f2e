/**
 * Protobuf binary format wire types.
 *
 * A wire type provides just enough information to find the length of the
 * following value.
 *
 * See https://developers.google.com/protocol-buffers/docs/encoding#structure
 */
export declare enum WireType {
    /**
     * Used for int32, int64, uint32, uint64, sint32, sint64, bool, enum
     */
    Varint = 0,
    /**
     * Used for fixed64, sfixed64, double.
     * Always 8 bytes with little-endian byte order.
     */
    Bit64 = 1,
    /**
     * Used for string, bytes, embedded messages, packed repeated fields
     *
     * Only repeated numeric types (types which use the varint, 32-bit,
     * or 64-bit wire types) can be packed. In proto3, such fields are
     * packed by default.
     */
    LengthDelimited = 2,
    /**
     * Start of a tag-delimited aggregate, such as a proto2 group, or a message
     * in editions with message_encoding = DELIMITED.
     */
    StartGroup = 3,
    /**
     * End of a tag-delimited aggregate.
     */
    EndGroup = 4,
    /**
     * Used for fixed32, sfixed32, float.
     * Always 4 bytes with little-endian byte order.
     */
    Bit32 = 5
}
/**
 * Maximum value for a 32-bit floating point value (Protobuf FLOAT).
 */
export declare const FLOAT32_MAX = 3.4028234663852886e+38;
/**
 * Minimum value for a 32-bit floating point value (Protobuf FLOAT).
 */
export declare const FLOAT32_MIN = -3.4028234663852886e+38;
/**
 * Maximum value for an unsigned 32-bit integer (Protobuf UINT32, FIXED32).
 */
export declare const UINT32_MAX = 4294967295;
/**
 * Maximum value for a signed 32-bit integer (Protobuf INT32, SFIXED32, SINT32).
 */
export declare const INT32_MAX = 2147483647;
/**
 * Minimum value for a signed 32-bit integer (Protobuf INT32, SFIXED32, SINT32).
 */
export declare const INT32_MIN = -2147483648;
export declare class BinaryWriter {
    private readonly encodeUtf8;
    /**
     * We cannot allocate a buffer for the entire output
     * because we don't know it's size.
     *
     * So we collect smaller chunks of known size and
     * concat them later.
     *
     * Use `raw()` to push data to this array. It will flush
     * `buf` first.
     */
    private chunks;
    /**
     * A growing buffer for byte values. If you don't know
     * the size of the data you are writing, push to this
     * array.
     */
    protected buf: number[];
    /**
     * Previous fork states.
     */
    private stack;
    constructor(encodeUtf8?: (text: string) => Uint8Array);
    /**
     * Return all bytes written and reset this writer.
     */
    finish(): Uint8Array<ArrayBuffer>;
    /**
     * Start a new fork for length-delimited data like a message
     * or a packed repeated field.
     *
     * Must be joined later with `join()`.
     */
    fork(): this;
    /**
     * Join the last fork. Write its length and bytes, then
     * return to the previous state.
     */
    join(): this;
    /**
     * Writes a tag (field number and wire type).
     *
     * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
     *
     * Generated code should compute the tag ahead of time and call `uint32()`.
     */
    tag(fieldNo: number, type: WireType): this;
    /**
     * Write a chunk of raw bytes.
     */
    raw(chunk: Uint8Array): this;
    /**
     * Write a `uint32` value, an unsigned 32 bit varint.
     */
    uint32(value: number): this;
    /**
     * Write a `int32` value, a signed 32 bit varint.
     */
    int32(value: number): this;
    /**
     * Write a `bool` value, a variant.
     */
    bool(value: boolean): this;
    /**
     * Write a `bytes` value, length-delimited arbitrary data.
     */
    bytes(value: Uint8Array): this;
    /**
     * Write a `string` value, length-delimited data converted to UTF-8 text.
     */
    string(value: string): this;
    /**
     * Write a `float` value, 32-bit floating point number.
     */
    float(value: number): this;
    /**
     * Write a `double` value, a 64-bit floating point number.
     */
    double(value: number): this;
    /**
     * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
     */
    fixed32(value: number): this;
    /**
     * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
     */
    sfixed32(value: number): this;
    /**
     * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
     */
    sint32(value: number): this;
    /**
     * Write a `fixed64` value, a signed, fixed-length 64-bit integer.
     */
    sfixed64(value: string | number | bigint): this;
    /**
     * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
     */
    fixed64(value: string | number | bigint): this;
    /**
     * Write a `int64` value, a signed 64-bit varint.
     */
    int64(value: string | number | bigint): this;
    /**
     * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
     */
    sint64(value: string | number | bigint): this;
    /**
     * Write a `uint64` value, an unsigned 64-bit varint.
     */
    uint64(value: string | number | bigint): this;
}
export declare class BinaryReader {
    private readonly decodeUtf8;
    /**
     * Current position.
     */
    pos: number;
    /**
     * Number of bytes available in this reader.
     */
    readonly len: number;
    protected readonly buf: Uint8Array;
    private readonly view;
    constructor(buf: Uint8Array, decodeUtf8?: (bytes: Uint8Array) => string);
    /**
     * Reads a tag - field number and wire type.
     */
    tag(): [number, WireType];
    /**
     * Skip one element and return the skipped data.
     *
     * When skipping StartGroup, provide the tags field number to check for
     * matching field number in the EndGroup tag.
     */
    skip(wireType: WireType, fieldNo?: number): Uint8Array;
    protected varint64: () => [number, number];
    /**
     * Throws error if position in byte array is out of range.
     */
    protected assertBounds(): void;
    /**
     * Read a `uint32` field, an unsigned 32 bit varint.
     */
    uint32: () => number;
    /**
     * Read a `int32` field, a signed 32 bit varint.
     */
    int32(): number;
    /**
     * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
     */
    sint32(): number;
    /**
     * Read a `int64` field, a signed 64-bit varint.
     */
    int64(): bigint | string;
    /**
     * Read a `uint64` field, an unsigned 64-bit varint.
     */
    uint64(): bigint | string;
    /**
     * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
     */
    sint64(): bigint | string;
    /**
     * Read a `bool` field, a variant.
     */
    bool(): boolean;
    /**
     * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
     */
    fixed32(): number;
    /**
     * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
     */
    sfixed32(): number;
    /**
     * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
     */
    fixed64(): bigint | string;
    /**
     * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
     */
    sfixed64(): bigint | string;
    /**
     * Read a `float` field, 32-bit floating point number.
     */
    float(): number;
    /**
     * Read a `double` field, a 64-bit floating point number.
     */
    double(): number;
    /**
     * Read a `bytes` field, length-delimited arbitrary data.
     */
    bytes(): Uint8Array;
    /**
     * Read a `string` field, length-delimited data converted to UTF-8 text.
     */
    string(): string;
}
