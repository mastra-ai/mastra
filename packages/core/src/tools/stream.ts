import { WritableStream } from 'stream/web';

export class ToolStream<T> extends WritableStream<T> {
  constructor(
    {
      toolCallId,
      toolName,
      runId,
    }: {
      toolCallId: string;
      toolName: string;
      runId: string;
    },
    originalStream?: WritableStream,
  ) {
    super({
      async write(chunk: any) {
        const writer = originalStream?.getWriter();
        try {
          await writer?.write({
            type: 'tool-output',
            runId,
            from: 'USER',
            payload: {
              output: chunk,
              toolCallId,
              toolName,
            },
          });
        } finally {
          writer?.releaseLock();
        }
      },
    });
  }

  async write(data: any) {
    const writer = this.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }
}
