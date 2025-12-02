import { AssistantStreamChunk } from "../AssistantStreamChunk";
import { PipeableTransformStream } from "../utils/stream/PipeableTransformStream";
import { ReadonlyJSONObject, ReadonlyJSONValue } from "../../utils/json/json-value";
import { ToolResponse } from "./ToolResponse";
import { ToolCallReader } from "./tool-types";
type ToolCallback = (toolCall: {
    toolCallId: string;
    toolName: string;
    args: ReadonlyJSONObject;
}) => Promise<ToolResponse<ReadonlyJSONValue>> | ToolResponse<ReadonlyJSONValue> | undefined;
type ToolStreamCallback = <TArgs extends ReadonlyJSONObject = ReadonlyJSONObject, TResult extends ReadonlyJSONValue = ReadonlyJSONValue>(toolCall: {
    reader: ToolCallReader<TArgs, TResult>;
    toolCallId: string;
    toolName: string;
}) => void;
type ToolExecutionOptions = {
    execute: ToolCallback;
    streamCall: ToolStreamCallback;
};
export declare class ToolExecutionStream extends PipeableTransformStream<AssistantStreamChunk, AssistantStreamChunk> {
    constructor(options: ToolExecutionOptions);
}
export {};
//# sourceMappingURL=ToolExecutionStream.d.ts.map