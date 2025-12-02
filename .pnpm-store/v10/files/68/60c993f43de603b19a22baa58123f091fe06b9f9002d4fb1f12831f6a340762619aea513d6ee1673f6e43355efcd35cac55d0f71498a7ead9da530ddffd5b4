import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "./models";
import { NumberValue } from "./NumberValue";
export interface unmarshallOptions {
  wrapNumbers?:
    | boolean
    | ((value: string) => number | bigint | NumberValue | any);
  convertWithoutMapWrapper?: boolean;
}
export declare const unmarshall: (
  data: Record<string, AttributeValue> | AttributeValue,
  options?: unmarshallOptions
) => Record<string, NativeAttributeValue>;
