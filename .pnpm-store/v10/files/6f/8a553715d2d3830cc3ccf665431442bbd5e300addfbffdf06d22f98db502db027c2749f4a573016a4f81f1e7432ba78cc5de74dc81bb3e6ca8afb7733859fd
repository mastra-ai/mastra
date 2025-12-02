// src/utils/useToolArgsFieldStatus.tsx
import { getPartialJsonObjectFieldState } from "assistant-stream/utils";
import { useMessagePart } from "../context/index.js";
var COMPLETE_STATUS = { type: "complete" };
var useToolArgsFieldStatus = (fieldPath) => {
  return useMessagePart((t) => {
    if (t.type !== "tool-call")
      throw new Error(
        "useToolArgsFieldStatus can only be used inside tool-call message parts"
      );
    const state = getPartialJsonObjectFieldState(t.args, fieldPath);
    if (state === "complete" || t.status.type === "requires-action")
      return COMPLETE_STATUS;
    return t.status;
  });
};
export {
  useToolArgsFieldStatus
};
//# sourceMappingURL=useToolArgsFieldStatus.js.map