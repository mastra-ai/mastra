import type { WritableStreamDefaultWriter } from 'stream/web';
import { WritableStream } from 'stream/web';

export class ToolStream<T> extends WritableStream<T> {
  #writer?: WritableStreamDefaultWriter<T>;

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
    writer?: WritableStreamDefaultWriter<any>,
  ) {
    super({
      async write(chunk: any) {
        if (!writer) {
          return;
        }

        try {
          console.trace('write tool??');
          await writer.write({
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
          writer.releaseLock();
        }
      },
    });

    this.#writer = writer;
  }

  async write(data: any) {
    if (!this.#writer) {
      return;
    }

    try {
      await this.#writer.write(data);
    } finally {
      this.#writer.releaseLock();
    }
  }
}
