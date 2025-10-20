import { WritableStream } from 'stream/web';
import type { DataChunkType } from '../stream/types';

export class ToolStream<T> extends WritableStream<T> {
  originalStream?: WritableStream;

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
            from: 'USER',
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
    this.originalStream = originalStream;
  }

  async write(data: any) {
    const writer = this.getWriter();

    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  async custom<T extends { type: string }>(data: T extends { type: `data-${string}` } ? DataChunkType : T) {
    const writer = this.originalStream?.getWriter();
    try {
      await writer?.write(data);
    } finally {
      writer?.releaseLock();
    }
  }
}
