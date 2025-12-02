import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "./models";
import { NumberValue } from "./NumberValue";
/**
 * An optional configuration object for `convertToNative`
 */
export interface unmarshallOptions {
    /**
     * Whether to modify how numbers are unmarshalled from DynamoDB.
     * When set to true, returns numbers as NumberValue instances instead of native JavaScript numbers.
     * This allows for the safe round-trip transport of numbers of arbitrary size.
     *
     * If a function is provided, it will be called with the string representation of numbers to handle
     * custom conversions (e.g., using BigInt or decimal libraries).
     */
    wrapNumbers?: boolean | ((value: string) => number | bigint | NumberValue | any);
    /**
     * When true, skip wrapping the data in `{ M: data }` before converting.
     *
     * Default is true when using the DynamoDBDocumentClient,
     * but false if directly using the unmarshall function (backwards compatibility).
     */
    convertWithoutMapWrapper?: boolean;
}
/**
 * Convert a DynamoDB record into a JavaScript object.
 *
 * @param data - The DynamoDB record
 * @param options - An optional configuration object for `unmarshall`
 */
export declare const unmarshall: (data: Record<string, AttributeValue> | AttributeValue, options?: unmarshallOptions) => Record<string, NativeAttributeValue>;
