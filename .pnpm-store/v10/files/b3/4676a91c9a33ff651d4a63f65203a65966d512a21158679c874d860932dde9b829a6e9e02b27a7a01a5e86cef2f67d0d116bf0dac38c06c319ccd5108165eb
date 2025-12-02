import { JsonSchemaObject } from "../Types.js";
type Opener = string;
type MessagePrefix = string;
type Closer = string;
type Builder = [Opener, Closer] | [Opener, MessagePrefix, Closer];
export declare function withMessage(schema: JsonSchemaObject, key: string, get: (props: {
    value: unknown;
    json: string;
}) => Builder | void): string;
export {};
