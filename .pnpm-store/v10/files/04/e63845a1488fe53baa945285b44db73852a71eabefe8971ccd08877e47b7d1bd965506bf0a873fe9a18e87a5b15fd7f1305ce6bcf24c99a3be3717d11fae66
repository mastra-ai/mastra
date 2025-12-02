import type { ThreadAssistantMessage } from "../../types";

export const shouldContinue = (
  result: ThreadAssistantMessage,
  humanToolNames: string[] | undefined,
) => {
  // TODO legacy behavior -- make specifying human tool names required
  if (humanToolNames === undefined) {
    return (
      result.status?.type === "requires-action" &&
      result.status.reason === "tool-calls" &&
      result.content.every((c) => c.type !== "tool-call" || !!c.result)
    );
  }

  return (
    result.status?.type === "requires-action" &&
    result.status.reason === "tool-calls" &&
    result.content.every(
      (c) =>
        c.type !== "tool-call" ||
        !!c.result ||
        !humanToolNames.includes(c.toolName),
    )
  );
};
