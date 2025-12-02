import { NumberValue as INumberValue } from "./models";
/**
 *
 * Class for storing DynamoDB numbers that exceed the scale of
 * JavaScript's MAX_SAFE_INTEGER and MIN_SAFE_INTEGER, or the
 * decimal precision limit.
 *
 * This class does not support mathematical operations in JavaScript.
 * Convert the contained string value to your application-specific
 * large number implementation to perform mathematical operations.
 *
 * @public
 *
 */
export declare class NumberValue implements INumberValue {
    value: string;
    /**
     * This class does not validate that your string input is a valid number.
     *
     * @param value - a precise number, or any BigInt or string, or AttributeValue.
     */
    constructor(value: number | Number | BigInt | string | {
        N: string;
    });
    /**
     * This class does not validate that your string input is a valid number.
     *
     * @param value - a precise number, or any BigInt or string, or AttributeValue.
     */
    static from(value: number | Number | BigInt | string | {
        N: string;
    }): NumberValue;
    /**
     * @returns the AttributeValue form for DynamoDB.
     */
    toAttributeValue(): {
        N: string;
    };
    /**
     * @returns BigInt representation.
     *
     * @throws SyntaxError if the string representation is not convertable to a BigInt.
     */
    toBigInt(): bigint;
    /**
     * @override
     *
     * @returns string representation. This is the canonical format in DynamoDB.
     */
    toString(): string;
    /**
     * @override
     */
    valueOf(): string;
}
