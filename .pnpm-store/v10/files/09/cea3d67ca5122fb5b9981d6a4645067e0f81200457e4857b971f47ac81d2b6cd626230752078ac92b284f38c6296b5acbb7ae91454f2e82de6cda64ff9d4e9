import { ReadonlyJSONValue } from "../../utils";
import { ObjectStreamOperation, ObjectStreamChunk } from "./types";
type ObjectStreamController = {
    readonly abortSignal: AbortSignal;
    enqueue(operations: readonly ObjectStreamOperation[]): void;
};
type CreateObjectStreamOptions = {
    execute: (controller: ObjectStreamController) => void | PromiseLike<void>;
    defaultValue?: ReadonlyJSONValue;
};
export declare const createObjectStream: ({ execute, defaultValue, }: CreateObjectStreamOptions) => ReadableStream<ObjectStreamChunk>;
export {};
//# sourceMappingURL=createObjectStream.d.ts.map