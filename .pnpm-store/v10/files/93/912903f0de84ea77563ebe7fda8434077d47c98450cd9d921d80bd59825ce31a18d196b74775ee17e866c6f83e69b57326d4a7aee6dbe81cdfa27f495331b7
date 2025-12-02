import { AssistantStream } from "../AssistantStream";
import { ToolResponseLike } from "../tool/ToolResponse";
import { ReadonlyJSONValue } from "../../utils/json/json-value";
import { UnderlyingReadable } from "../utils/stream/UnderlyingReadable";
import { TextStreamController } from "./text";
export type ToolCallStreamController = {
    argsText: TextStreamController;
    setResponse(response: ToolResponseLike<ReadonlyJSONValue>): void;
    close(): void;
};
export declare const createToolCallStream: (readable: UnderlyingReadable<ToolCallStreamController>) => AssistantStream;
export declare const createToolCallStreamController: () => readonly [AssistantStream, ToolCallStreamController];
//# sourceMappingURL=tool-call.d.ts.map