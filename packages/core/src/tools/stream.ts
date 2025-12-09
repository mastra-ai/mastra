import { WritableStream } from 'node:stream/web';
import type { DataChunkType } from '../stream/types';
import type { OutputWriter } from '../workflows';

export class ToolStream extends WritableStream<unknown> {
  private prefix: string;
  private callId: string;
  private name: string;
  private runId: string;
  private writeFn?: OutputWriter;

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
    writeFn?: OutputWriter,
  ) {
    super({
      async write(chunk: any) {
        await getInstance()._write(chunk);
      },
    });

    const self = this;
    function getInstance() {
      return self;
    }

    this.prefix = prefix;
    this.callId = callId;
    this.name = name;
    this.runId = runId;
    this.writeFn = writeFn;
  }

  private async _write(data: any) {
    if (this.writeFn) {
      await this.writeFn({
        type: `${this.prefix}-output`,
        runId: this.runId,
        from: 'USER',
        payload: {
          output: data,
          ...(this.prefix === 'workflow-step'
            ? {
                runId: this.runId,
                stepName: this.name,
              }
            : {
                [`${this.prefix}CallId`]: this.callId,
                [`${this.prefix}Name`]: this.name,
              }),
        },
      });
    }
  }

  async write(data: any) {
    await this._write(data);
  }

  async custom<T extends { type: string }>(data: T extends { type: `data-${string}` } ? DataChunkType : T) {
    if (this.writeFn) {
      await this.writeFn(data);
    }
  }
}
