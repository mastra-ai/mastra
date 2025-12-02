// src/core/modules/assistant-stream.ts
import { AssistantStream } from "../AssistantStream.js";
import { createMergeStream } from "../utils/stream/merge.js";
import { createTextStreamController } from "./text.js";
import {
  createToolCallStreamController
} from "./tool-call.js";
import { Counter } from "../utils/Counter.js";
import {
  PathAppendEncoder,
  PathMergeEncoder
} from "../utils/stream/path-utils.js";
import { DataStreamEncoder } from "../serialization/data-stream/DataStream.js";
import { generateId } from "../utils/generateId.js";
import { promiseWithResolvers } from "../../utils/promiseWithResolvers.js";
var AssistantStreamControllerImpl = class _AssistantStreamControllerImpl {
  _state;
  _parentId;
  constructor(state) {
    this._state = state || {
      merger: createMergeStream(),
      contentCounter: new Counter()
    };
  }
  get __internal_isClosed() {
    return this._state.merger.isSealed();
  }
  __internal_getReadable() {
    return this._state.merger.readable;
  }
  __internal_subscribeToClose(callback) {
    this._state.closeSubscriber = callback;
  }
  _addPart(part, stream) {
    if (this._state.append) {
      this._state.append.controller.close();
      this._state.append = void 0;
    }
    this.enqueue({
      type: "part-start",
      part,
      path: []
    });
    this._state.merger.addStream(
      stream.pipeThrough(
        new PathAppendEncoder(this._state.contentCounter.value)
      )
    );
  }
  merge(stream) {
    this._state.merger.addStream(
      stream.pipeThrough(new PathMergeEncoder(this._state.contentCounter))
    );
  }
  appendText(textDelta) {
    if (this._state.append?.kind !== "text") {
      this._state.append = {
        kind: "text",
        controller: this.addTextPart()
      };
    }
    this._state.append.controller.append(textDelta);
  }
  appendReasoning(textDelta) {
    if (this._state.append?.kind !== "reasoning") {
      this._state.append = {
        kind: "reasoning",
        controller: this.addReasoningPart()
      };
    }
    this._state.append.controller.append(textDelta);
  }
  addTextPart() {
    const [stream, controller] = createTextStreamController();
    this._addPart({ type: "text" }, stream);
    return controller;
  }
  addReasoningPart() {
    const [stream, controller] = createTextStreamController();
    this._addPart({ type: "reasoning" }, stream);
    return controller;
  }
  addToolCallPart(options) {
    const opt = typeof options === "string" ? { toolName: options } : options;
    const toolName = opt.toolName;
    const toolCallId = opt.toolCallId ?? generateId();
    const [stream, controller] = createToolCallStreamController();
    this._addPart(
      {
        type: "tool-call",
        toolName,
        toolCallId,
        ...this._parentId && { parentId: this._parentId }
      },
      stream
    );
    if (opt.argsText !== void 0) {
      controller.argsText.append(opt.argsText);
      controller.argsText.close();
    }
    if (opt.args !== void 0) {
      controller.argsText.append(JSON.stringify(opt.args));
      controller.argsText.close();
    }
    if (opt.response !== void 0) {
      controller.setResponse(opt.response);
    }
    return controller;
  }
  appendSource(options) {
    this._addPart(
      { ...options, ...this._parentId && { parentId: this._parentId } },
      new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: "part-finish",
            path: []
          });
          controller.close();
        }
      })
    );
  }
  appendFile(options) {
    this._addPart(
      options,
      new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: "part-finish",
            path: []
          });
          controller.close();
        }
      })
    );
  }
  enqueue(chunk) {
    this._state.merger.enqueue(chunk);
    if (chunk.type === "part-start" && chunk.path.length === 0) {
      this._state.contentCounter.up();
    }
  }
  withParentId(parentId) {
    const controller = new _AssistantStreamControllerImpl(this._state);
    controller._parentId = parentId;
    return controller;
  }
  close() {
    this._state.append?.controller?.close();
    this._state.merger.seal();
    this._state.closeSubscriber?.();
  }
};
function createAssistantStream(callback) {
  const controller = new AssistantStreamControllerImpl();
  const runTask = async () => {
    try {
      await callback(controller);
    } catch (e) {
      if (!controller.__internal_isClosed) {
        controller.enqueue({
          type: "error",
          path: [],
          error: String(e)
        });
      }
      throw e;
    } finally {
      if (!controller.__internal_isClosed) {
        controller.close();
      }
    }
  };
  runTask();
  return controller.__internal_getReadable();
}
function createAssistantStreamController() {
  const { resolve, promise } = promiseWithResolvers();
  let controller;
  const stream = createAssistantStream((c) => {
    controller = c;
    controller.__internal_subscribeToClose(
      resolve
    );
    return promise;
  });
  return [stream, controller];
}
function createAssistantStreamResponse(callback) {
  return AssistantStream.toResponse(
    createAssistantStream(callback),
    new DataStreamEncoder()
  );
}
export {
  createAssistantStream,
  createAssistantStreamController,
  createAssistantStreamResponse
};
//# sourceMappingURL=assistant-stream.js.map