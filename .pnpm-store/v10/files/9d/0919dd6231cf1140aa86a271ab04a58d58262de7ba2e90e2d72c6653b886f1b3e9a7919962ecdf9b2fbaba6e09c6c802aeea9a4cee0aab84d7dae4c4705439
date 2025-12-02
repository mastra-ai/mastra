import { ToolCallArgsReader, ToolCallReader, ToolCallResponseReader } from "./tool-types";
import { DeepPartial, TypeAtPath, TypePath } from "./type-path-utils";
import { ToolResponse } from "./ToolResponse";
import { AsyncIterableStream, ReadonlyJSONObject, ReadonlyJSONValue } from "../../utils";
export declare class ToolCallArgsReaderImpl<T extends ReadonlyJSONObject> implements ToolCallArgsReader<T> {
    private argTextDeltas;
    private handles;
    private args;
    constructor(argTextDeltas: ReadableStream<string>);
    private processStream;
    get<PathT extends TypePath<T>>(...fieldPath: PathT): Promise<TypeAtPath<T, PathT>>;
    streamValues<PathT extends TypePath<T>>(...fieldPath: PathT): AsyncIterableStream<DeepPartial<TypeAtPath<T, PathT>>>;
    streamText<PathT extends TypePath<T>>(...fieldPath: PathT): TypeAtPath<T, PathT> extends string & infer U ? AsyncIterableStream<U> : never;
    forEach<PathT extends TypePath<T>>(...fieldPath: PathT): TypeAtPath<T, PathT> extends Array<infer U> ? AsyncIterableStream<U> : never;
}
export declare class ToolCallResponseReaderImpl<TResult extends ReadonlyJSONValue> implements ToolCallResponseReader<TResult> {
    private readonly promise;
    constructor(promise: Promise<ToolResponse<TResult>>);
    get(): Promise<ToolResponse<TResult>>;
}
export declare class ToolCallReaderImpl<TArgs extends ReadonlyJSONObject, TResult extends ReadonlyJSONValue> implements ToolCallReader<TArgs, TResult> {
    readonly args: ToolCallArgsReaderImpl<TArgs>;
    readonly response: ToolCallResponseReaderImpl<TResult>;
    private readonly writable;
    private readonly resolve;
    argsText: string;
    constructor();
    appendArgsTextDelta(text: string): Promise<void>;
    setResponse(value: ToolResponse<TResult>): void;
    result: {
        get: () => Promise<TResult>;
    };
}
//# sourceMappingURL=ToolCallReader.d.ts.map