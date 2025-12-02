/**
 * Int64Support for the current environment.
 */
export declare const protoInt64: Int64Support;
/**
 * We use the `bigint` primitive to represent 64-bit integral types. If bigint
 * is unavailable, we fall back to a string representation, which means that
 * all values typed as `bigint` will actually be strings.
 *
 * If your code is intended to run in an environment where bigint may be
 * unavailable, it must handle both the bigint and the string representation.
 * For presenting values, this is straight-forward with implicit or explicit
 * conversion to string:
 *
 * ```ts
 * let el = document.createElement("span");
 * el.innerText = message.int64Field; // assuming a protobuf int64 field
 *
 * console.log(`int64: ${message.int64Field}`);
 *
 * let str: string = message.int64Field.toString();
 * ```
 *
 * If you need to manipulate 64-bit integral values and are sure the values
 * can be safely represented as an IEEE-754 double precision number, you can
 * convert to a JavaScript Number:
 *
 * ```ts
 * console.log(message.int64Field.toString())
 * let num = Number(message.int64Field);
 * num = num + 1;
 * message.int64Field = protoInt64.parse(num);
 * ```
 *
 * If you need to manipulate 64-bit integral values that are outside the
 * range of safe representation as a JavaScript Number, we recommend you
 * use a third party library, for example the npm package "long":
 *
 * ```ts
 * // convert the field value to a Long
 * const bits = protoInt64.enc(message.int64Field);
 * const longValue = Long.fromBits(bits.lo, bits.hi);
 *
 * // perform arithmetic
 * const longResult = longValue.subtract(1);
 *
 * // set the result in the field
 * message.int64Field = protoInt64.dec(longResult.low, longResult.high);
 *
 * // Assuming int64Field contains 9223372036854775807:
 * console.log(message.int64Field); // 9223372036854775806
 * ```
 */
interface Int64Support {
    /**
     * 0n if bigint is available, "0" if unavailable.
     */
    readonly zero: bigint;
    /**
     * Is bigint available?
     */
    readonly supported: boolean;
    /**
     * Parse a signed 64-bit integer.
     * Returns a bigint if available, a string otherwise.
     */
    parse(value: string | number | bigint): bigint;
    /**
     * Parse an unsigned 64-bit integer.
     * Returns a bigint if available, a string otherwise.
     */
    uParse(value: string | number | bigint): bigint;
    /**
     * Convert a signed 64-bit integral value to a two's complement.
     */
    enc(value: string | number | bigint): {
        lo: number;
        hi: number;
    };
    /**
     * Convert an unsigned 64-bit integral value to a two's complement.
     */
    uEnc(value: string | number | bigint): {
        lo: number;
        hi: number;
    };
    /**
     * Convert a two's complement to a signed 64-bit integral value.
     * Returns a bigint if available, a string otherwise.
     */
    dec(lo: number, hi: number): bigint;
    /**
     * Convert a two's complement to an unsigned 64-bit integral value.
     * Returns a bigint if available, a string otherwise.
     */
    uDec(lo: number, hi: number): bigint;
}
export {};
