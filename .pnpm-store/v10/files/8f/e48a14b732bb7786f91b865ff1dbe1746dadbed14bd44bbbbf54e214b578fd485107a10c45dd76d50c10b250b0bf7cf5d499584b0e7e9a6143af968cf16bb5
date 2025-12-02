import { ScalarType } from "../descriptors.js";
/**
 * ScalarValue maps from a scalar field type to a TypeScript value type.
 */
export type ScalarValue<T = ScalarType, LongAsString extends boolean = false> = T extends ScalarType.STRING ? string : T extends ScalarType.INT32 ? number : T extends ScalarType.UINT32 ? number : T extends ScalarType.SINT32 ? number : T extends ScalarType.FIXED32 ? number : T extends ScalarType.SFIXED32 ? number : T extends ScalarType.FLOAT ? number : T extends ScalarType.DOUBLE ? number : T extends ScalarType.INT64 ? LongAsString extends true ? string : bigint : T extends ScalarType.SINT64 ? LongAsString extends true ? string : bigint : T extends ScalarType.SFIXED64 ? LongAsString extends true ? string : bigint : T extends ScalarType.UINT64 ? LongAsString extends true ? string : bigint : T extends ScalarType.FIXED64 ? LongAsString extends true ? string : bigint : T extends ScalarType.BOOL ? boolean : T extends ScalarType.BYTES ? Uint8Array : never;
/**
 * Returns true if both scalar values are equal.
 */
export declare function scalarEquals(type: ScalarType, a: ScalarValue | undefined, b: ScalarValue | undefined): boolean;
/**
 * Returns the zero value for the given scalar type.
 */
export declare function scalarZeroValue<T extends ScalarType, LongAsString extends boolean>(type: T, longAsString: LongAsString): ScalarValue<T, LongAsString>;
/**
 * Returns true for a zero-value. For example, an integer has the zero-value `0`,
 * a boolean is `false`, a string is `""`, and bytes is an empty Uint8Array.
 *
 * In proto3, zero-values are not written to the wire, unless the field is
 * optional or repeated.
 */
export declare function isScalarZeroValue(type: ScalarType, value: unknown): boolean;
