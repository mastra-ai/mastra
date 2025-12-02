// Marks share a global namespace with other developer code.
const markNames = [
  "convexClientConstructed",
  "convexWebSocketOpen",
  "convexFirstMessageReceived",
] as const;
export type MarkName = (typeof markNames)[number];

// Mark details are not reported to the server.
type MarkDetail = {
  sessionId: string;
};

// `PerformanceMark`s are efficient and show up in browser's performance
// timeline. They can be cleared with `performance.clearMarks()`.
// This is a memory leak, but a worthwhile one: automatic
// cleanup would make in-browser debugging more difficult.
export function mark(name: MarkName, sessionId: string) {
  const detail: MarkDetail = { sessionId };
  // `performance` APIs exists in browsers, Node.js, Deno, and more but it
  // is not required by the Convex client.
  if (typeof performance === "undefined" || !performance.mark) return;
  performance.mark(name, { detail });
}

// `PerfomanceMark` has a built-in toJSON() but the return type varies
// between implementations, e.g. Node.js returns details but Chrome does not.
function performanceMarkToJson(mark: PerformanceMark): MarkJson {
  // Remove "convex" prefix
  let name = mark.name.slice("convex".length);
  // lowercase the first letter
  name = name.charAt(0).toLowerCase() + name.slice(1);
  return {
    name,
    startTime: mark.startTime,
  };
}

// Similar to the return type of `PerformanceMark.toJson()`.
export type MarkJson = {
  name: string;
  // `startTime` is in milliseconds since the time origin like `performance.now()`.
  // https://developer.mozilla.org/en-US/docs/Web/API/DOMHighResTimeStamp#the_time_origin
  startTime: number;
};

export function getMarksReport(sessionId: string): MarkJson[] {
  if (typeof performance === "undefined" || !performance.getEntriesByName) {
    return [];
  }
  const allMarks: PerformanceMark[] = [];
  for (const name of markNames) {
    const marks = (
      performance
        .getEntriesByName(name)
        .filter((entry) => entry.entryType === "mark") as PerformanceMark[]
    ).filter((mark) => mark.detail.sessionId === sessionId);
    allMarks.push(...marks);
  }
  return allMarks.map(performanceMarkToJson);
}
