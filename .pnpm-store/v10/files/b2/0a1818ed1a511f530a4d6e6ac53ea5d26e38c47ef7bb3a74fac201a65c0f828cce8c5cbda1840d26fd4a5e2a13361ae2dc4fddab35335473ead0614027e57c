import { NumberValue as INumberValue } from "./models";
export declare class NumberValue implements INumberValue {
  value: string;
  constructor(
    value:
      | number
      | Number
      | BigInt
      | string
      | {
          N: string;
        }
  );
  static from(
    value:
      | number
      | Number
      | BigInt
      | string
      | {
          N: string;
        }
  ): NumberValue;
  toAttributeValue(): {
    N: string;
  };
  toBigInt(): bigint;
  toString(): string;
  valueOf(): string;
}
