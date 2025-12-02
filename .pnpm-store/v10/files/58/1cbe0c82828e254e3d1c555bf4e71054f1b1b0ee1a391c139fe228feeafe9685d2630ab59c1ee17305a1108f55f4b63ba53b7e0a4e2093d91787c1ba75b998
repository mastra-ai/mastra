import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { NativeAttributeBinary, NativeAttributeValue } from "./models";
import { NumberValue } from "./NumberValue";
export interface marshallOptions {
  convertEmptyValues?: boolean;
  removeUndefinedValues?: boolean;
  convertClassInstanceToMap?: boolean;
  convertTopLevelContainer?: boolean;
  allowImpreciseNumbers?: boolean;
}
export declare function marshall(
  data: null,
  options?: marshallOptions
): AttributeValue.NULLMember;
export declare function marshall(
  data: Set<bigint> | Set<number> | Set<NumberValue>,
  options?: marshallOptions
): AttributeValue.NSMember;
export declare function marshall(
  data: Set<string>,
  options?: marshallOptions
): AttributeValue.SSMember;
export declare function marshall(
  data: Set<NativeAttributeBinary>,
  options?: marshallOptions
): AttributeValue.BSMember;
export declare function marshall(
  data: NativeAttributeBinary,
  options?: marshallOptions
): AttributeValue.BMember;
export declare function marshall(
  data: boolean,
  options?: marshallOptions
): AttributeValue.BOOLMember;
export declare function marshall(
  data: number | NumberValue | bigint,
  options?: marshallOptions
): AttributeValue.NMember;
export declare function marshall(
  data: string,
  options?: marshallOptions
): AttributeValue.SMember;
export declare function marshall(
  data: boolean,
  options?: marshallOptions
): AttributeValue.BOOLMember;
export declare function marshall<
  O extends {
    convertTopLevelContainer: true;
  }
>(
  data: NativeAttributeValue[],
  options: marshallOptions & O
): AttributeValue.LMember;
export declare function marshall<
  O extends {
    convertTopLevelContainer: false;
  }
>(data: NativeAttributeValue[], options: marshallOptions & O): AttributeValue[];
export declare function marshall<
  O extends {
    convertTopLevelContainer: boolean;
  }
>(
  data: NativeAttributeValue[],
  options: marshallOptions & O
): AttributeValue[] | AttributeValue.LMember;
export declare function marshall(
  data: NativeAttributeValue[],
  options?: marshallOptions
): AttributeValue[];
export declare function marshall<
  O extends {
    convertTopLevelContainer: true;
  }
>(
  data:
    | Map<string, NativeAttributeValue>
    | Record<string, NativeAttributeValue>,
  options: marshallOptions & O
): AttributeValue.MMember;
export declare function marshall<
  O extends {
    convertTopLevelContainer: false;
  }
>(
  data:
    | Map<string, NativeAttributeValue>
    | Record<string, NativeAttributeValue>,
  options: marshallOptions & O
): Record<string, AttributeValue>;
export declare function marshall<
  O extends {
    convertTopLevelContainer: boolean;
  }
>(
  data:
    | Map<string, NativeAttributeValue>
    | Record<string, NativeAttributeValue>,
  options: marshallOptions & O
): Record<string, AttributeValue> | AttributeValue.MMember;
export declare function marshall(
  data:
    | Map<string, NativeAttributeValue>
    | Record<string, NativeAttributeValue>,
  options?: marshallOptions
): Record<string, AttributeValue>;
export declare function marshall(data: any, options?: marshallOptions): any;
export declare function marshall(
  data: unknown,
  options?: marshallOptions
): AttributeValue.$UnknownMember;
