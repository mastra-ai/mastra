import { type DescField } from "../descriptors.js";
import { FieldError } from "./error.js";
/**
 * Check whether the given field value is valid for the reflect API.
 */
export declare function checkField(field: DescField, value: unknown): FieldError | undefined;
/**
 * Check whether the given list item is valid for the reflect API.
 */
export declare function checkListItem(field: DescField & {
    fieldKind: "list";
}, index: number, value: unknown): FieldError | undefined;
/**
 * Check whether the given map key and value are valid for the reflect API.
 */
export declare function checkMapEntry(field: DescField & {
    fieldKind: "map";
}, key: unknown, value: unknown): FieldError | undefined;
export declare function formatVal(val: unknown): string;
