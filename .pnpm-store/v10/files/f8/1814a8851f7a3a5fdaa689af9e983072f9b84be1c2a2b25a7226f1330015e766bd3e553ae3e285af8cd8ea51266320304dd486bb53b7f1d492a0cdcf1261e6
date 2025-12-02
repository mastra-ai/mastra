"use strict";
const markNames = [
  "convexClientConstructed",
  "convexWebSocketOpen",
  "convexFirstMessageReceived"
];
export function mark(name, sessionId) {
  const detail = { sessionId };
  if (typeof performance === "undefined" || !performance.mark) return;
  performance.mark(name, { detail });
}
function performanceMarkToJson(mark2) {
  let name = mark2.name.slice("convex".length);
  name = name.charAt(0).toLowerCase() + name.slice(1);
  return {
    name,
    startTime: mark2.startTime
  };
}
export function getMarksReport(sessionId) {
  if (typeof performance === "undefined" || !performance.getEntriesByName) {
    return [];
  }
  const allMarks = [];
  for (const name of markNames) {
    const marks = performance.getEntriesByName(name).filter((entry) => entry.entryType === "mark").filter((mark2) => mark2.detail.sessionId === sessionId);
    allMarks.push(...marks);
  }
  return allMarks.map(performanceMarkToJson);
}
//# sourceMappingURL=metrics.js.map
