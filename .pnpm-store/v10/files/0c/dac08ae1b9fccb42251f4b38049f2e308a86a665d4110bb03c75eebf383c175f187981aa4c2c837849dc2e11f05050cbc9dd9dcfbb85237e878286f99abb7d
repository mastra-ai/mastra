// src/core/utils/stream/LineDecoderStream.ts
var LineDecoderStream = class extends TransformStream {
  buffer = "";
  constructor() {
    super({
      transform: (chunk, controller) => {
        this.buffer += chunk;
        const lines = this.buffer.split("\n");
        for (let i = 0; i < lines.length - 1; i++) {
          controller.enqueue(lines[i]);
        }
        this.buffer = lines[lines.length - 1] || "";
      },
      flush: () => {
        if (this.buffer) {
          throw new Error(
            `Stream ended with an incomplete line: "${this.buffer}"`
          );
        }
      }
    });
  }
};
export {
  LineDecoderStream
};
//# sourceMappingURL=LineDecoderStream.js.map