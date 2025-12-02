// src/runtimes/external-store/auto-status.tsx
var AUTO_STATUS_RUNNING = Object.freeze({ type: "running" });
var AUTO_STATUS_COMPLETE = Object.freeze({
  type: "complete",
  reason: "unknown"
});
var AUTO_STATUS_PENDING = Object.freeze({
  type: "requires-action",
  reason: "tool-calls"
});
var isAutoStatus = (status) => status === AUTO_STATUS_RUNNING || status === AUTO_STATUS_COMPLETE;
var getAutoStatus = (isLast, isRunning, hasPendingToolCalls) => isLast && isRunning ? AUTO_STATUS_RUNNING : hasPendingToolCalls ? AUTO_STATUS_PENDING : AUTO_STATUS_COMPLETE;
export {
  getAutoStatus,
  isAutoStatus
};
//# sourceMappingURL=auto-status.js.map