// src/core/tool/ToolCallReader.ts
import { promiseWithResolvers } from "../../utils/promiseWithResolvers.js";
import {
  parsePartialJsonObject,
  getPartialJsonObjectFieldState
} from "../../utils/json/parse-partial-json-object.js";
import {
  asAsyncIterableStream
} from "../../utils/index.js";
function getField(obj, fieldPath) {
  let current = obj;
  for (const key of fieldPath) {
    if (current === void 0 || current === null) {
      return void 0;
    }
    current = current[key];
  }
  return current;
}
var GetHandle = class {
  resolve;
  reject;
  disposed = false;
  fieldPath;
  constructor(resolve, reject, fieldPath) {
    this.resolve = resolve;
    this.reject = reject;
    this.fieldPath = fieldPath;
  }
  update(args) {
    if (this.disposed) return;
    try {
      if (getPartialJsonObjectFieldState(
        args,
        this.fieldPath
      ) === "complete") {
        const value = getField(args, this.fieldPath);
        if (value !== void 0) {
          this.resolve(value);
          this.dispose();
        }
      }
    } catch (e) {
      this.reject(e);
      this.dispose();
    }
  }
  dispose() {
    this.disposed = true;
  }
};
var StreamValuesHandle = class {
  controller;
  disposed = false;
  fieldPath;
  constructor(controller, fieldPath) {
    this.controller = controller;
    this.fieldPath = fieldPath;
  }
  update(args) {
    if (this.disposed) return;
    try {
      const value = getField(args, this.fieldPath);
      if (value !== void 0) {
        this.controller.enqueue(value);
      }
      if (getPartialJsonObjectFieldState(
        args,
        this.fieldPath
      ) === "complete") {
        this.controller.close();
        this.dispose();
      }
    } catch (e) {
      this.controller.error(e);
      this.dispose();
    }
  }
  dispose() {
    this.disposed = true;
  }
};
var StreamTextHandle = class {
  controller;
  disposed = false;
  fieldPath;
  lastValue = void 0;
  constructor(controller, fieldPath) {
    this.controller = controller;
    this.fieldPath = fieldPath;
  }
  update(args) {
    if (this.disposed) return;
    try {
      const value = getField(args, this.fieldPath);
      if (value !== void 0 && typeof value === "string") {
        const delta = value.substring(this.lastValue?.length || 0);
        this.lastValue = value;
        this.controller.enqueue(delta);
      }
      if (getPartialJsonObjectFieldState(
        args,
        this.fieldPath
      ) === "complete") {
        this.controller.close();
        this.dispose();
      }
    } catch (e) {
      this.controller.error(e);
      this.dispose();
    }
  }
  dispose() {
    this.disposed = true;
  }
};
var ForEachHandle = class {
  controller;
  disposed = false;
  fieldPath;
  processedIndexes = /* @__PURE__ */ new Set();
  constructor(controller, fieldPath) {
    this.controller = controller;
    this.fieldPath = fieldPath;
  }
  update(args) {
    if (this.disposed) return;
    try {
      const array = getField(args, this.fieldPath);
      if (!Array.isArray(array)) {
        return;
      }
      for (let i = 0; i < array.length; i++) {
        if (!this.processedIndexes.has(i)) {
          const elementPath = [...this.fieldPath, i];
          if (getPartialJsonObjectFieldState(
            args,
            elementPath
          ) === "complete") {
            this.controller.enqueue(array[i]);
            this.processedIndexes.add(i);
          }
        }
      }
      if (getPartialJsonObjectFieldState(
        args,
        this.fieldPath
      ) === "complete") {
        this.controller.close();
        this.dispose();
      }
    } catch (e) {
      this.controller.error(e);
      this.dispose();
    }
  }
  dispose() {
    this.disposed = true;
  }
};
var ToolCallArgsReaderImpl = class {
  argTextDeltas;
  handles = /* @__PURE__ */ new Set();
  args = parsePartialJsonObject("");
  constructor(argTextDeltas) {
    this.argTextDeltas = argTextDeltas;
    this.processStream();
  }
  async processStream() {
    try {
      let accumulatedText = "";
      const reader = this.argTextDeltas.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulatedText += value;
        const parsedArgs = parsePartialJsonObject(accumulatedText);
        if (parsedArgs !== void 0) {
          this.args = parsedArgs;
          for (const handle of this.handles) {
            handle.update(parsedArgs);
          }
        }
      }
    } catch (error) {
      console.error("Error processing argument stream:", error);
      for (const handle of this.handles) {
        handle.dispose();
      }
    }
  }
  get(...fieldPath) {
    return new Promise((resolve, reject) => {
      const handle = new GetHandle(
        resolve,
        reject,
        fieldPath
      );
      if (this.args && getPartialJsonObjectFieldState(
        this.args,
        fieldPath
      ) === "complete") {
        const value = getField(this.args, fieldPath);
        if (value !== void 0) {
          resolve(value);
          return;
        }
      }
      this.handles.add(handle);
      handle.update(this.args);
    });
  }
  streamValues(...fieldPath) {
    const simplePath = fieldPath;
    const stream = new ReadableStream({
      start: (controller) => {
        const handle = new StreamValuesHandle(controller, simplePath);
        this.handles.add(handle);
        handle.update(this.args);
      },
      cancel: () => {
        for (const handle of this.handles) {
          if (handle instanceof StreamValuesHandle) {
            handle.dispose();
            this.handles.delete(handle);
            break;
          }
        }
      }
    });
    return asAsyncIterableStream(stream);
  }
  streamText(...fieldPath) {
    const simplePath = fieldPath;
    const stream = new ReadableStream({
      start: (controller) => {
        const handle = new StreamTextHandle(controller, simplePath);
        this.handles.add(handle);
        handle.update(this.args);
      },
      cancel: () => {
        for (const handle of this.handles) {
          if (handle instanceof StreamTextHandle) {
            handle.dispose();
            this.handles.delete(handle);
            break;
          }
        }
      }
    });
    return asAsyncIterableStream(stream);
  }
  forEach(...fieldPath) {
    const simplePath = fieldPath;
    const stream = new ReadableStream({
      start: (controller) => {
        const handle = new ForEachHandle(controller, simplePath);
        this.handles.add(handle);
        handle.update(this.args);
      },
      cancel: () => {
        for (const handle of this.handles) {
          if (handle instanceof ForEachHandle) {
            handle.dispose();
            this.handles.delete(handle);
            break;
          }
        }
      }
    });
    return asAsyncIterableStream(stream);
  }
};
var ToolCallResponseReaderImpl = class {
  constructor(promise) {
    this.promise = promise;
  }
  get() {
    return this.promise;
  }
};
var ToolCallReaderImpl = class {
  args;
  response;
  writable;
  resolve;
  argsText = "";
  constructor() {
    const stream = new TransformStream();
    this.writable = stream.writable;
    this.args = new ToolCallArgsReaderImpl(stream.readable);
    const { promise, resolve } = promiseWithResolvers();
    this.resolve = resolve;
    this.response = new ToolCallResponseReaderImpl(promise);
  }
  async appendArgsTextDelta(text) {
    const writer = this.writable.getWriter();
    try {
      await writer.write(text);
    } catch (err) {
      console.warn(err);
    } finally {
      writer.releaseLock();
    }
    this.argsText += text;
  }
  setResponse(value) {
    this.resolve(value);
  }
  result = {
    get: async () => {
      const response = await this.response.get();
      return response.result;
    }
  };
};
export {
  ToolCallArgsReaderImpl,
  ToolCallReaderImpl,
  ToolCallResponseReaderImpl
};
//# sourceMappingURL=ToolCallReader.js.map