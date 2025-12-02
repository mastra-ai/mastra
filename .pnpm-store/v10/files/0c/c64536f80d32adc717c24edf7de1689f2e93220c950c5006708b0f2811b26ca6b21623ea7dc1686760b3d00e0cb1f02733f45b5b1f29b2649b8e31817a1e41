import { AssistantStream } from "../AssistantStream";
import { AssistantMessage } from "../utils/types";
import { AssistantMessageAccumulator } from "./assistant-message-accumulator";

export class AssistantMessageStream {
  constructor(public readonly readable: ReadableStream<AssistantMessage>) {
    this.readable = readable;
  }

  static fromAssistantStream(stream: AssistantStream) {
    return new AssistantMessageStream(
      stream.pipeThrough(new AssistantMessageAccumulator()),
    );
  }

  async unstable_result(): Promise<AssistantMessage> {
    let last: AssistantMessage | undefined;
    for await (const chunk of this) {
      last = chunk;
    }

    if (!last) {
      return {
        role: "assistant",
        status: { type: "complete", reason: "unknown" },
        parts: [],
        content: [],
        metadata: {
          unstable_state: null,
          unstable_data: [],
          unstable_annotations: [],
          steps: [],
          custom: {},
        },
      };
    }
    return last;
  }

  [Symbol.asyncIterator]() {
    const reader = this.readable.getReader();
    return {
      async next(): Promise<IteratorResult<AssistantMessage, undefined>> {
        const { done, value } = await reader.read();
        return done ? { done: true, value: undefined } : { done: false, value };
      },
    };
  }

  tee(): [AssistantMessageStream, AssistantMessageStream] {
    const [readable1, readable2] = this.readable.tee();
    return [
      new AssistantMessageStream(readable1),
      new AssistantMessageStream(readable2),
    ];
  }
}
