// src/core/tool/ToolResponse.ts
var TOOL_RESPONSE_SYMBOL = Symbol.for("aui.tool-response");
var ToolResponse = class _ToolResponse {
  get [TOOL_RESPONSE_SYMBOL]() {
    return true;
  }
  artifact;
  result;
  isError;
  constructor(options) {
    if (options.artifact !== void 0) {
      this.artifact = options.artifact;
    }
    this.result = options.result;
    this.isError = options.isError ?? false;
  }
  static [Symbol.hasInstance](obj) {
    return typeof obj === "object" && obj !== null && TOOL_RESPONSE_SYMBOL in obj;
  }
  static toResponse(result) {
    if (result instanceof _ToolResponse) {
      return result;
    }
    return new _ToolResponse({
      result: result === void 0 ? "<no result>" : result
    });
  }
};
export {
  ToolResponse
};
//# sourceMappingURL=ToolResponse.js.map