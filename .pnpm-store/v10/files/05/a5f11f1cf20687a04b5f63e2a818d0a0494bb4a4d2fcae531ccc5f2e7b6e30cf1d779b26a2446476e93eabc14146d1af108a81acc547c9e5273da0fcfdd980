import type { DescField, DescOneof } from "../descriptors.js";
declare const errorNames: string[];
export declare class FieldError extends Error {
    readonly name: (typeof errorNames)[number];
    constructor(fieldOrOneof: DescField | DescOneof, message: string, name?: (typeof errorNames)[number]);
    readonly field: () => DescField | DescOneof;
}
export declare function isFieldError(arg: unknown): arg is FieldError;
export {};
