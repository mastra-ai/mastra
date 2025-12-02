// src/runtimes/local/shouldContinue.tsx
var shouldContinue = (result, humanToolNames) => {
  if (humanToolNames === void 0) {
    return result.status?.type === "requires-action" && result.status.reason === "tool-calls" && result.content.every((c) => c.type !== "tool-call" || !!c.result);
  }
  return result.status?.type === "requires-action" && result.status.reason === "tool-calls" && result.content.every(
    (c) => c.type !== "tool-call" || !!c.result || !humanToolNames.includes(c.toolName)
  );
};
export {
  shouldContinue
};
//# sourceMappingURL=shouldContinue.js.map