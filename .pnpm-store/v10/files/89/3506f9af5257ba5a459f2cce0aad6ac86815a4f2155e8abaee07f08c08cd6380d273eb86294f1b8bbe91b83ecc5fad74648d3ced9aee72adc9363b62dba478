import type { DescEnum, DescFile } from "../descriptors.js";
import type { GenEnum } from "./types.js";
import type { JsonValue } from "../json-value.js";
/**
 * Hydrate an enum descriptor.
 *
 * @private
 */
export declare function enumDesc<Shape extends number, JsonType extends JsonValue = JsonValue>(file: DescFile, path: number, ...paths: number[]): GenEnum<Shape, JsonType>;
/**
 * Construct a TypeScript enum object at runtime from a descriptor.
 */
export declare function tsEnum(desc: DescEnum): enumObject;
type enumObject = {
    [key: number]: string;
    [k: string]: number | string;
};
export {};
