import { WritableStream } from 'stream/web';

export class ToolStream<T> extends WritableStream<T> {
  constructor(
    {
      prefix,
      callId,
      name,
      runId,
    }: {
      prefix: string;
      callId: string;
      name: string;
      runId: string;
    },
    originalStream?: WritableStream,
  ) {
    super({
      async write(chunk: any) {
        const writer = originalStream?.getWriter();

        try {
          await writer?.write({
            type: `${prefix}-output`,
            runId,
            from: 'AGENT',
            payload: {
              output: chunk,
              ...(prefix === 'workflow-step'
                ? {
                    runId,
                    stepName: name,
                  }
                : {
                    [`${prefix}CallId`]: callId,
                    [`${prefix}Name`]: name,
                  }),
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
