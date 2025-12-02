import type { Message } from "../types.js";
import type { DescFile } from "../descriptors.js";
import type { GenMessage } from "./types.js";
/**
 * Hydrate a message descriptor.
 *
 * @private
 */
export declare function messageDesc<Shape extends Message, Opt extends {
    jsonType?: unknown;
    validType?: unknown;
} = {
    jsonType: undefined;
    validType: undefined;
}>(file: DescFile, path: number, ...paths: number[]): GenMessage<Shape, Opt>;
