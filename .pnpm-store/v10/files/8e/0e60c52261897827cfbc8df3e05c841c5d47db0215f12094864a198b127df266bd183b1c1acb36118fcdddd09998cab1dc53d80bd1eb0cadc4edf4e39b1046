import type { Message } from "../types.js";
import type { ScalarValue } from "./scalar.js";
import type { ReflectList, ReflectMap, ReflectMessage } from "./reflect-types.js";
import type { DescField, DescMessage } from "../descriptors.js";
export declare function isObject(arg: unknown): arg is Record<string, unknown>;
export declare function isOneofADT(arg: unknown): arg is OneofADT;
export type OneofADT = {
    case: undefined;
    value?: undefined;
} | {
    case: string;
    value: Message | ScalarValue;
};
export declare function isReflectList(arg: unknown, field?: DescField & {
    fieldKind: "list";
}): arg is ReflectList;
export declare function isReflectMap(arg: unknown, field?: DescField & {
    fieldKind: "map";
}): arg is ReflectMap;
export declare function isReflectMessage(arg: unknown, messageDesc?: DescMessage): arg is ReflectMessage;
