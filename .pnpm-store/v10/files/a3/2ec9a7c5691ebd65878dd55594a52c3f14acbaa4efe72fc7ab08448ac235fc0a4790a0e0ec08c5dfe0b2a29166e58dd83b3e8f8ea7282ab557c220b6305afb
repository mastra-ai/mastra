// src/core/utils/stream/merge.ts
import { promiseWithResolvers } from "../../../utils/promiseWithResolvers.js";
var createMergeStream = () => {
  const list = [];
  let sealed = false;
  let controller;
  let currentPull;
  const handlePull = (item) => {
    if (!item.promise) {
      item.promise = item.reader.read().then(({ done, value }) => {
        item.promise = void 0;
        if (done) {
          list.splice(list.indexOf(item), 1);
          if (sealed && list.length === 0) {
            controller.close();
          }
        } else {
          controller.enqueue(value);
        }
        currentPull?.resolve();
        currentPull = void 0;
      }).catch((e) => {
        console.error(e);
        list.forEach((item2) => {
          item2.reader.cancel();
        });
        list.length = 0;
        controller.error(e);
        currentPull?.reject(e);
        currentPull = void 0;
      });
    }
  };
  const readable = new ReadableStream({
    start(c) {
      controller = c;
    },
    pull() {
      currentPull = promiseWithResolvers();
      list.forEach((item) => {
        handlePull(item);
      });
      return currentPull.promise;
    },
    cancel() {
      list.forEach((item) => {
        item.reader.cancel();
      });
      list.length = 0;
    }
  });
  return {
    readable,
    isSealed() {
      return sealed;
    },
    seal() {
      sealed = true;
      if (list.length === 0) controller.close();
    },
    addStream(stream) {
      if (sealed)
        throw new Error(
          "Cannot add streams after the run callback has settled."
        );
      const item = { reader: stream.getReader() };
      list.push(item);
      handlePull(item);
    },
    enqueue(chunk) {
      this.addStream(
        new ReadableStream({
          start(c) {
            c.enqueue(chunk);
            c.close();
          }
        })
      );
    }
  };
};
export {
  createMergeStream
};
//# sourceMappingURL=merge.js.map