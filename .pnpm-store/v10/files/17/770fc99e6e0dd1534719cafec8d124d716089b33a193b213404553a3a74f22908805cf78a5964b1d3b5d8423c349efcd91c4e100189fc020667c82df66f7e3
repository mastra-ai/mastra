import { DataStreamChunk, DataStreamStreamChunkType } from "./chunk-types";

export class DataStreamChunkEncoder extends TransformStream<
  DataStreamChunk,
  string
> {
  constructor() {
    super({
      transform: (chunk, controller) => {
        controller.enqueue(`${chunk.type}:${JSON.stringify(chunk.value)}\n`);
      },
    });
  }
}

export class DataStreamChunkDecoder extends TransformStream<
  string,
  DataStreamChunk
> {
  constructor() {
    super({
      transform: (chunk, controller) => {
        const index = chunk.indexOf(":");
        if (index === -1) throw new Error("Invalid stream part");
        controller.enqueue({
          type: chunk.slice(0, index) as DataStreamStreamChunkType,
          value: JSON.parse(chunk.slice(index + 1)),
        });
      },
    });
  }
}
