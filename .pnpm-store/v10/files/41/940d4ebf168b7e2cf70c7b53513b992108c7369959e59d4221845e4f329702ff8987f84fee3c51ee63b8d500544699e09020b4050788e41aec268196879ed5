export class LineDecoderStream extends TransformStream<string, string> {
  private buffer = "";

  constructor() {
    super({
      transform: (chunk, controller) => {
        this.buffer += chunk;
        const lines = this.buffer.split("\n");

        // Process all complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          controller.enqueue(lines[i]);
        }

        // Keep the last incomplete line in the buffer
        this.buffer = lines[lines.length - 1] || "";
      },
      flush: () => {
        // If there's content in the buffer when the stream ends, it means
        // the stream ended with an incomplete line (no trailing newline)
        if (this.buffer) {
          throw new Error(
            `Stream ended with an incomplete line: "${this.buffer}"`,
          );
        }
      },
    });
  }
}
