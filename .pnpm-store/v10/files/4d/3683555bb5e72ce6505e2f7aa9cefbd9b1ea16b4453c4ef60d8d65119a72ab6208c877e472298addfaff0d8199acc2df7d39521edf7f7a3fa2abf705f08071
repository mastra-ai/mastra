'use strict';

var web = require('stream/web');

// src/tools/stream.ts
var ToolStream = class extends web.WritableStream {
  originalStream;
  writeQueue = Promise.resolve();
  constructor({
    prefix,
    callId,
    name,
    runId
  }, originalStream) {
    super({
      async write(chunk) {
        const writer = originalStream?.getWriter();
        try {
          await writer?.write({
            type: `${prefix}-output`,
            runId,
            from: "USER",
            payload: {
              output: chunk,
              ...prefix === "workflow-step" ? {
                runId,
                stepName: name
              } : {
                [`${prefix}CallId`]: callId,
                [`${prefix}Name`]: name
              }
            }
          });
        } finally {
          writer?.releaseLock();
        }
      }
    });
    this.originalStream = originalStream;
  }
  async write(data) {
    const writer = this.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }
  async custom(data) {
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.originalStream) {
        return;
      }
      const writer = this.originalStream.getWriter();
      try {
        await writer.write(data);
      } finally {
        writer.releaseLock();
      }
    });
    return this.writeQueue;
  }
};

exports.ToolStream = ToolStream;
//# sourceMappingURL=chunk-X7F4CSGR.cjs.map
//# sourceMappingURL=chunk-X7F4CSGR.cjs.map