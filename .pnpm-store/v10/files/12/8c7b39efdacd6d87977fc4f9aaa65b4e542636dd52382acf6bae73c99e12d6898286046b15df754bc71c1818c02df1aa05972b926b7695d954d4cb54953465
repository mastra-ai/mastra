import { ReadonlyJSONValue } from "../../utils";
import { withPromiseOrValue } from "../utils/withPromiseOrValue";
import { ObjectStreamAccumulator } from "./ObjectStreamAccumulator";
import { ObjectStreamOperation, ObjectStreamChunk } from "./types";

type ObjectStreamController = {
  readonly abortSignal: AbortSignal;

  enqueue(operations: readonly ObjectStreamOperation[]): void;
};

class ObjectStreamControllerImpl implements ObjectStreamController {
  private _controller: ReadableStreamDefaultController<ObjectStreamChunk>;
  private _abortController = new AbortController();
  private _accumulator: ObjectStreamAccumulator;

  get abortSignal() {
    return this._abortController.signal;
  }

  constructor(
    controller: ReadableStreamDefaultController<ObjectStreamChunk>,
    defaultValue: ReadonlyJSONValue,
  ) {
    this._controller = controller;
    this._accumulator = new ObjectStreamAccumulator(defaultValue);
  }

  enqueue(operations: readonly ObjectStreamOperation[]) {
    this._accumulator.append(operations);

    this._controller.enqueue({
      snapshot: this._accumulator.state,
      operations,
    });
  }

  __internalError(error: unknown) {
    this._controller.error(error);
  }

  __internalClose() {
    this._controller.close();
  }

  __internalCancel(reason?: unknown) {
    this._abortController.abort(reason);
  }
}

const getStreamControllerPair = (defaultValue: ReadonlyJSONValue) => {
  let controller!: ObjectStreamControllerImpl;
  const stream = new ReadableStream<ObjectStreamChunk>({
    start(c) {
      controller = new ObjectStreamControllerImpl(c, defaultValue);
    },
    cancel(reason: unknown) {
      controller.__internalCancel(reason);
    },
  });

  return [stream, controller] as const;
};

type CreateObjectStreamOptions = {
  execute: (controller: ObjectStreamController) => void | PromiseLike<void>;
  defaultValue?: ReadonlyJSONValue;
};

export const createObjectStream = ({
  execute,
  defaultValue = {},
}: CreateObjectStreamOptions) => {
  const [stream, controller] = getStreamControllerPair(defaultValue);

  withPromiseOrValue(
    () => execute(controller),
    () => {
      controller.__internalClose();
    },
    (e: unknown) => {
      controller.__internalError(e);
    },
  );

  return stream;
};
