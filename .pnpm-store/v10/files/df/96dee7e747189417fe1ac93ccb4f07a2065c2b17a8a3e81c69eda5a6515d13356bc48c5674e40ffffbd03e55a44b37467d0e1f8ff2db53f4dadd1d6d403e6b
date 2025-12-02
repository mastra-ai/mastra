// src/core/utils/stream/path-utils.ts
import { Counter } from "../Counter.js";
var PathAppendEncoder = class extends TransformStream {
  constructor(idx) {
    super({
      transform(chunk, controller) {
        controller.enqueue({
          ...chunk,
          path: [idx, ...chunk.path]
        });
      }
    });
  }
};
var PathAppendDecoder = class extends TransformStream {
  constructor(idx) {
    super({
      transform(chunk, controller) {
        const {
          path: [idx2, ...path]
        } = chunk;
        if (idx !== idx2)
          throw new Error(`Path mismatch: expected ${idx}, got ${idx2}`);
        controller.enqueue({
          ...chunk,
          path
        });
      }
    });
  }
};
var PathMergeEncoder = class extends TransformStream {
  constructor(counter) {
    const innerCounter = new Counter();
    const mapping = /* @__PURE__ */ new Map();
    super({
      transform(chunk, controller) {
        if (chunk.type === "part-start" && chunk.path.length === 0) {
          mapping.set(innerCounter.up(), counter.up());
        }
        const [idx, ...path] = chunk.path;
        if (idx === void 0) {
          controller.enqueue(chunk);
          return;
        }
        const mappedIdx = mapping.get(idx);
        if (mappedIdx === void 0) throw new Error("Path not found");
        controller.enqueue({
          ...chunk,
          path: [mappedIdx, ...path]
        });
      }
    });
  }
};
export {
  PathAppendDecoder,
  PathAppendEncoder,
  PathMergeEncoder
};
//# sourceMappingURL=path-utils.js.map