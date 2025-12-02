import { getPartialJsonObjectFieldState } from "assistant-stream/utils";
import { useMessagePart } from "../context";

const COMPLETE_STATUS = { type: "complete" };

export const useToolArgsFieldStatus = (fieldPath: (string | number)[]) => {
  return useMessagePart((t) => {
    if (t.type !== "tool-call")
      throw new Error(
        "useToolArgsFieldStatus can only be used inside tool-call message parts",
      );

    const state = getPartialJsonObjectFieldState(t.args, fieldPath);
    if (state === "complete" || t.status.type === "requires-action")
      return COMPLETE_STATUS;
    return t.status;
  });
};
