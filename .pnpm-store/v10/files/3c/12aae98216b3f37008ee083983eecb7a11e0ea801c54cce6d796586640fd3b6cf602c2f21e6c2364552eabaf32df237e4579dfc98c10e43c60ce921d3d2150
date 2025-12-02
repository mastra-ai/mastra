// src/api/MessagePartRuntime.ts
import { ToolResponse } from "assistant-stream";
var MessagePartRuntimeImpl = class {
  constructor(contentBinding, messageApi, threadApi) {
    this.contentBinding = contentBinding;
    this.messageApi = messageApi;
    this.threadApi = threadApi;
  }
  get path() {
    return this.contentBinding.path;
  }
  __internal_bindMethods() {
    this.addToolResult = this.addToolResult.bind(this);
    this.getState = this.getState.bind(this);
    this.subscribe = this.subscribe.bind(this);
  }
  getState() {
    return this.contentBinding.getState();
  }
  addToolResult(result) {
    const state = this.contentBinding.getState();
    if (!state) throw new Error("Message part is not available");
    if (state.type !== "tool-call")
      throw new Error("Tried to add tool result to non-tool message part");
    if (!this.messageApi)
      throw new Error(
        "Message API is not available. This is likely a bug in assistant-ui."
      );
    if (!this.threadApi) throw new Error("Thread API is not available");
    const message = this.messageApi.getState();
    if (!message) throw new Error("Message is not available");
    const toolName = state.toolName;
    const toolCallId = state.toolCallId;
    const response = ToolResponse.toResponse(result);
    this.threadApi.getState().addToolResult({
      messageId: message.id,
      toolName,
      toolCallId,
      result: response.result,
      artifact: response.artifact,
      isError: response.isError
    });
  }
  subscribe(callback) {
    return this.contentBinding.subscribe(callback);
  }
};
export {
  MessagePartRuntimeImpl
};
//# sourceMappingURL=MessagePartRuntime.js.map