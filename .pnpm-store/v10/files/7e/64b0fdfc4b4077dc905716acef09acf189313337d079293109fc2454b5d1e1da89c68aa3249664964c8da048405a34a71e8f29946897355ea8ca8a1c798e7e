import { AssistantStreamChunk } from "../../AssistantStreamChunk";
import { Counter } from "../Counter";

export class PathAppendEncoder extends TransformStream<
  AssistantStreamChunk,
  AssistantStreamChunk
> {
  constructor(idx: number) {
    super({
      transform(chunk, controller) {
        controller.enqueue({
          ...chunk,
          path: [idx, ...chunk.path],
        });
      },
    });
  }
}

export class PathAppendDecoder extends TransformStream<
  AssistantStreamChunk,
  AssistantStreamChunk
> {
  constructor(idx: number) {
    super({
      transform(chunk, controller) {
        const {
          path: [idx2, ...path],
        } = chunk;

        if (idx !== idx2)
          throw new Error(`Path mismatch: expected ${idx}, got ${idx2}`);

        controller.enqueue({
          ...chunk,
          path,
        });
      },
    });
  }
}

export class PathMergeEncoder extends TransformStream<
  AssistantStreamChunk,
  AssistantStreamChunk
> {
  constructor(counter: Counter) {
    const innerCounter = new Counter();
    const mapping = new Map<number, number>();
    super({
      transform(chunk, controller) {
        if (chunk.type === "part-start" && chunk.path.length === 0) {
          mapping.set(innerCounter.up(), counter.up());
        }

        const [idx, ...path] = chunk.path;
        if (idx === undefined) {
          controller.enqueue(chunk);
          return;
        }
        const mappedIdx = mapping.get(idx);
        if (mappedIdx === undefined) throw new Error("Path not found");

        controller.enqueue({
          ...chunk,
          path: [mappedIdx, ...path],
        });
      },
    });
  }
}
