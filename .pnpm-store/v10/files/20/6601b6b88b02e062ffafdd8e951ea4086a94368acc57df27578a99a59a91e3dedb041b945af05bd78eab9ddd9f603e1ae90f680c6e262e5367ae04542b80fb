// src/core/object/createObjectStream.ts
import { withPromiseOrValue } from "../utils/withPromiseOrValue.js";
import { ObjectStreamAccumulator } from "./ObjectStreamAccumulator.js";
var ObjectStreamControllerImpl = class {
  _controller;
  _abortController = new AbortController();
  _accumulator;
  get abortSignal() {
    return this._abortController.signal;
  }
  constructor(controller, defaultValue) {
    this._controller = controller;
    this._accumulator = new ObjectStreamAccumulator(defaultValue);
  }
  enqueue(operations) {
    this._accumulator.append(operations);
    this._controller.enqueue({
      snapshot: this._accumulator.state,
      operations
    });
  }
  __internalError(error) {
    this._controller.error(error);
  }
  __internalClose() {
    this._controller.close();
  }
  __internalCancel(reason) {
    this._abortController.abort(reason);
  }
};
var getStreamControllerPair = (defaultValue) => {
  let controller;
  const stream = new ReadableStream({
    start(c) {
      controller = new ObjectStreamControllerImpl(c, defaultValue);
    },
    cancel(reason) {
      controller.__internalCancel(reason);
    }
  });
  return [stream, controller];
};
var createObjectStream = ({
  execute,
  defaultValue = {}
}) => {
  const [stream, controller] = getStreamControllerPair(defaultValue);
  withPromiseOrValue(
    () => execute(controller),
    () => {
      controller.__internalClose();
    },
    (e) => {
      controller.__internalError(e);
    }
  );
  return stream;
};
export {
  createObjectStream
};
//# sourceMappingURL=createObjectStream.js.map