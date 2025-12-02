import { AssistantStreamChunk } from "../../AssistantStreamChunk";
import { promiseWithResolvers } from "../../../utils/promiseWithResolvers";

type MergeStreamItem = {
  reader: ReadableStreamDefaultReader<AssistantStreamChunk>;
  promise?: Promise<unknown> | undefined;
};

export const createMergeStream = () => {
  const list: MergeStreamItem[] = [];
  let sealed = false;
  let controller: ReadableStreamDefaultController<AssistantStreamChunk>;
  let currentPull: ReturnType<typeof promiseWithResolvers<void>> | undefined;

  const handlePull = (item: MergeStreamItem) => {
    if (!item.promise) {
      // TODO for most streams, we can directly pipeTo to avoid the microTask queue
      // add an option to eagerly pipe the stream to the merge stream
      // ideally, using assistant-stream w sync run method + piping to a sync WritableStream runs in the same microtask
      // this is useful because we often use AssistantStreams internally as a serialization utility, e. g. AssistantTransformStream
      // idea: avoid reader.read() by instead using a WritableStream & if (!hasPendingPull) await waitForPull()?
      item.promise = item.reader
        .read()
        .then(({ done, value }) => {
          item.promise = undefined;
          if (done) {
            list.splice(list.indexOf(item), 1);
            if (sealed && list.length === 0) {
              controller.close();
            }
          } else {
            controller.enqueue(value);
          }

          currentPull?.resolve();
          currentPull = undefined;
        })
        .catch((e) => {
          console.error(e);

          list.forEach((item) => {
            item.reader.cancel();
          });
          list.length = 0;

          controller.error(e);

          currentPull?.reject(e);
          currentPull = undefined;
        });
    }
  };

  const readable = new ReadableStream<AssistantStreamChunk>({
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
    },
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
    addStream(stream: ReadableStream<AssistantStreamChunk>) {
      if (sealed)
        throw new Error(
          "Cannot add streams after the run callback has settled.",
        );

      const item = { reader: stream.getReader() };
      list.push(item);
      handlePull(item);
    },
    enqueue(chunk: AssistantStreamChunk) {
      this.addStream(
        new ReadableStream({
          start(c) {
            c.enqueue(chunk);
            c.close();
          },
        }),
      );
    },
  };
};

// TODO
// export class SpanContainerMerger {
//   public get isSealed() {
//     return this.mergeStream.isSealed();
//   }

//   public get readable() {
//     return this.mergeStream.readable;
//   }

//   private subAllocator = new Counter();
//   private mergeStream = createMergeStream();

//   constructor() {
//     // id 0 is auto allocated
//     this.subAllocator.up();
//   }

//   add(stream: ReadableStream<AssistantStreamChunk>) {
//     this.mergeStream.addStream(
//       stream.pipeThrough(new SpanParentEncoder(this.subAllocator)),
//     );
//   }

//   enqueue(chunk: AssistantStreamChunk & { parentId: 0 }) {
//     this.mergeStream.addStream(
//       new ReadableStream({
//         start(c) {
//           c.enqueue(chunk);
//           c.close();
//         },
//       }),
//     );
//   }

//   seal() {
//     this.mergeStream.seal();
//   }
// }

// export class SpanContainerSplitter {
//   public writable;

//   private isSealed = false;
//   private writers = new Map<
//     number,
//     WritableStreamDefaultWriter<AssistantStreamChunk>
//   >();

//   private closeTasks: Promise<void>[] = [];

//   private allocator = new Counter();
//   private subAllocator = new Counter();

//   constructor() {
//     // id 0 is auto-allocated
//     this.allocator.up();

//     this.writable = new WritableStream({
//       write: (chunk) => {
//         const { type, parentId } = chunk;

//         const writer = this.writers.get(parentId);
//         if (writer === undefined) throw new Error("Parent id not found");

//         writer.write(chunk);

//         if (type === "span") {
//           // allocate a new span id
//           this.writers.set(this.allocator.up(), writer);
//         }
//         if (type === "finish") {
//           this.writers.delete(parentId);
//           writer.close();

//           if (this.writers.size === 0) {
//             const closeTask = this.writable.close();
//             this.closeTasks.push(closeTask);
//             closeTask.then(() => {
//               this.closeTasks.splice(this.closeTasks.indexOf(closeTask), 1);
//             });
//           }
//         }
//       },
//       close: async () => {
//         if (this.writers.size > 0) throw new Error("Not all writers closed");

//         // await and throw on any errors
//         await Promise.all(this.closeTasks);
//       },
//     });
//   }

//   add(stream: WritableStream<AssistantStreamChunk>) {
//     if (this.isSealed) throw new Error("Cannot add streams after sealing");

//     const decoder = new SpanParentDecoder(this.subAllocator);
//     decoder.readable.pipeTo(stream);

//     this.writers.set(this.allocator.up(), decoder.writable.getWriter());
//   }

//   seal() {
//     this.isSealed = true;
//     if (this.writers.size === 0) this.writable.close();
//   }
// }
