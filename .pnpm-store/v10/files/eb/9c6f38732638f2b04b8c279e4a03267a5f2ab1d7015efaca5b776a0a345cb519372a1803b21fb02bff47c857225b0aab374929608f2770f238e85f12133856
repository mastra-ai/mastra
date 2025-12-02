import { promiseWithResolvers } from "../../utils/promiseWithResolvers";
import {
  parsePartialJsonObject,
  getPartialJsonObjectFieldState,
} from "../../utils/json/parse-partial-json-object";
import {
  ToolCallArgsReader,
  ToolCallReader,
  ToolCallResponseReader,
} from "./tool-types";
import { DeepPartial, TypeAtPath, TypePath } from "./type-path-utils";
import { ToolResponse } from "./ToolResponse";
import {
  asAsyncIterableStream,
  AsyncIterableStream,
  ReadonlyJSONObject,
  ReadonlyJSONValue,
} from "../../utils";

// TODO: remove dispose

function getField<T>(obj: T, fieldPath: (string | number)[]): unknown {
  let current: unknown = obj;
  for (const key of fieldPath) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key as keyof typeof current];
  }
  return current;
}

interface Handle {
  update(args: unknown): void;
  dispose(): void;
}

class GetHandle<T, TValue> implements Handle {
  private resolve: (value: TValue) => void;
  private reject: (reason: unknown) => void;
  private disposed = false;
  private fieldPath: (string | number)[];

  constructor(
    resolve: (value: TValue) => void,
    reject: (reason: unknown) => void,
    fieldPath: (string | number)[],
  ) {
    this.resolve = resolve;
    this.reject = reject;
    this.fieldPath = fieldPath;
  }

  update(args: unknown): void {
    if (this.disposed) return;

    try {
      // Check if the field is complete
      if (
        getPartialJsonObjectFieldState(
          args as Record<string, unknown>,
          this.fieldPath,
        ) === "complete"
      ) {
        const value = getField(args as T, this.fieldPath);
        if (value !== undefined) {
          this.resolve(value as TValue);
          this.dispose();
        }
      }
    } catch (e) {
      this.reject(e);
      this.dispose();
    }
  }

  dispose(): void {
    this.disposed = true;
  }
}

class StreamValuesHandle<T> implements Handle {
  private controller: ReadableStreamDefaultController<unknown>;
  private disposed = false;
  private fieldPath: (string | number)[];

  constructor(
    controller: ReadableStreamDefaultController<unknown>,
    fieldPath: (string | number)[],
  ) {
    this.controller = controller;
    this.fieldPath = fieldPath;
  }

  update(args: unknown): void {
    if (this.disposed) return;

    try {
      const value = getField(args as T, this.fieldPath);

      if (value !== undefined) {
        this.controller.enqueue(value);
      }

      // Check if the field is complete, if so close the stream
      if (
        getPartialJsonObjectFieldState(
          args as Record<string, unknown>,
          this.fieldPath,
        ) === "complete"
      ) {
        this.controller.close();
        this.dispose();
      }
    } catch (e) {
      this.controller.error(e);
      this.dispose();
    }
  }

  dispose(): void {
    this.disposed = true;
  }
}

class StreamTextHandle<T> implements Handle {
  private controller: ReadableStreamDefaultController<unknown>;
  private disposed = false;
  private fieldPath: (string | number)[];
  private lastValue: string | undefined = undefined;

  constructor(
    controller: ReadableStreamDefaultController<unknown>,
    fieldPath: (string | number)[],
  ) {
    this.controller = controller;
    this.fieldPath = fieldPath;
  }

  update(args: unknown): void {
    if (this.disposed) return;

    try {
      const value = getField(args as T, this.fieldPath);

      if (value !== undefined && typeof value === "string") {
        const delta = value.substring(this.lastValue?.length || 0);
        this.lastValue = value;
        this.controller.enqueue(delta);
      }

      // Check if the field is complete, if so close the stream
      if (
        getPartialJsonObjectFieldState(
          args as Record<string, unknown>,
          this.fieldPath,
        ) === "complete"
      ) {
        this.controller.close();
        this.dispose();
      }
    } catch (e) {
      this.controller.error(e);
      this.dispose();
    }
  }

  dispose(): void {
    this.disposed = true;
  }
}

class ForEachHandle<T> implements Handle {
  private controller: ReadableStreamDefaultController<unknown>;
  private disposed = false;
  private fieldPath: (string | number)[];
  private processedIndexes = new Set<number>();

  constructor(
    controller: ReadableStreamDefaultController<unknown>,
    fieldPath: (string | number)[],
  ) {
    this.controller = controller;
    this.fieldPath = fieldPath;
  }

  update(args: unknown): void {
    if (this.disposed) return;

    try {
      const array = getField(args as T, this.fieldPath);

      if (!Array.isArray(array)) {
        return;
      }

      // Check each array element and emit completed ones that haven't been processed
      for (let i = 0; i < array.length; i++) {
        if (!this.processedIndexes.has(i)) {
          const elementPath = [...this.fieldPath, i];
          if (
            getPartialJsonObjectFieldState(
              args as Record<string, unknown>,
              elementPath,
            ) === "complete"
          ) {
            this.controller.enqueue(array[i]);
            this.processedIndexes.add(i);
          }
        }
      }

      // Check if the entire array is complete
      if (
        getPartialJsonObjectFieldState(
          args as Record<string, unknown>,
          this.fieldPath,
        ) === "complete"
      ) {
        this.controller.close();
        this.dispose();
      }
    } catch (e) {
      this.controller.error(e);
      this.dispose();
    }
  }

  dispose(): void {
    this.disposed = true;
  }
}

// Implementation of ToolCallReader that uses stream of partial JSON
export class ToolCallArgsReaderImpl<T extends ReadonlyJSONObject>
  implements ToolCallArgsReader<T>
{
  private argTextDeltas: ReadableStream<string>;
  private handles: Set<Handle> = new Set();
  private args: unknown = parsePartialJsonObject("");

  constructor(argTextDeltas: ReadableStream<string>) {
    this.argTextDeltas = argTextDeltas;
    this.processStream();
  }

  private async processStream(): Promise<void> {
    try {
      let accumulatedText = "";
      const reader = this.argTextDeltas.getReader();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        accumulatedText += value;
        const parsedArgs = parsePartialJsonObject(accumulatedText);

        if (parsedArgs !== undefined) {
          this.args = parsedArgs;
          // Notify all handles of the updated args
          for (const handle of this.handles) {
            handle.update(parsedArgs);
          }
        }
      }
    } catch (error) {
      console.error("Error processing argument stream:", error);
      // Notify handles of the error
      for (const handle of this.handles) {
        handle.dispose();
      }
    }
  }

  get<PathT extends TypePath<T>>(
    ...fieldPath: PathT
  ): Promise<TypeAtPath<T, PathT>> {
    return new Promise<TypeAtPath<T, PathT>>((resolve, reject) => {
      const handle = new GetHandle<T, TypeAtPath<T, PathT>>(
        resolve,
        reject,
        fieldPath,
      );

      // Check if the field is already complete in current args
      if (
        this.args &&
        getPartialJsonObjectFieldState(
          this.args as Record<string, unknown>,
          fieldPath,
        ) === "complete"
      ) {
        const value = getField(this.args as T, fieldPath);
        if (value !== undefined) {
          resolve(value as TypeAtPath<T, PathT>);
          return;
        }
      }

      this.handles.add(handle);
      handle.update(this.args);
    });
  }

  streamValues<PathT extends TypePath<T>>(
    ...fieldPath: PathT
  ): AsyncIterableStream<DeepPartial<TypeAtPath<T, PathT>>> {
    // Use a type assertion to convert the complex TypePath to a simple array
    const simplePath = fieldPath as unknown as (string | number)[];

    const stream = new ReadableStream<DeepPartial<TypeAtPath<T, PathT>>>({
      start: (controller) => {
        const handle = new StreamValuesHandle<T>(controller, simplePath);
        this.handles.add(handle);

        // Check current args immediately
        handle.update(this.args);
      },
      cancel: () => {
        // Find and dispose the corresponding handle
        for (const handle of this.handles) {
          if (handle instanceof StreamValuesHandle) {
            handle.dispose();
            this.handles.delete(handle);
            break;
          }
        }
      },
    });

    return asAsyncIterableStream(stream) as any;
  }

  streamText<PathT extends TypePath<T>>(
    ...fieldPath: PathT
  ): TypeAtPath<T, PathT> extends string & infer U
    ? AsyncIterableStream<U>
    : never {
    // Use a type assertion to convert the complex TypePath to a simple array
    const simplePath = fieldPath as unknown as (string | number)[];

    const stream = new ReadableStream<unknown>({
      start: (controller) => {
        const handle = new StreamTextHandle<T>(controller, simplePath);
        this.handles.add(handle);

        // Check current args immediately
        handle.update(this.args);
      },
      cancel: () => {
        // Find and dispose the corresponding handle
        for (const handle of this.handles) {
          if (handle instanceof StreamTextHandle) {
            handle.dispose();
            this.handles.delete(handle);
            break;
          }
        }
      },
    });

    return asAsyncIterableStream(stream) as any;
  }

  forEach<PathT extends TypePath<T>>(
    ...fieldPath: PathT
  ): TypeAtPath<T, PathT> extends Array<infer U>
    ? AsyncIterableStream<U>
    : never {
    // Use a type assertion to convert the complex TypePath to a simple array
    const simplePath = fieldPath as unknown as (string | number)[];

    const stream = new ReadableStream<unknown>({
      start: (controller) => {
        const handle = new ForEachHandle<T>(controller, simplePath);
        this.handles.add(handle);

        // Check current args immediately
        handle.update(this.args);
      },
      cancel: () => {
        // Find and dispose the corresponding handle
        for (const handle of this.handles) {
          if (handle instanceof ForEachHandle) {
            handle.dispose();
            this.handles.delete(handle);
            break;
          }
        }
      },
    });

    return asAsyncIterableStream(stream) as any;
  }
}

export class ToolCallResponseReaderImpl<TResult extends ReadonlyJSONValue>
  implements ToolCallResponseReader<TResult>
{
  constructor(private readonly promise: Promise<ToolResponse<TResult>>) {}

  public get() {
    return this.promise;
  }
}

export class ToolCallReaderImpl<
  TArgs extends ReadonlyJSONObject,
  TResult extends ReadonlyJSONValue,
> implements ToolCallReader<TArgs, TResult>
{
  public readonly args: ToolCallArgsReaderImpl<TArgs>;
  public readonly response: ToolCallResponseReaderImpl<TResult>;
  private readonly writable: WritableStream<string>;
  private readonly resolve: (value: ToolResponse<TResult>) => void;

  public argsText: string = "";

  constructor() {
    const stream = new TransformStream<string, string>();
    this.writable = stream.writable;
    this.args = new ToolCallArgsReaderImpl<TArgs>(stream.readable);

    const { promise, resolve } = promiseWithResolvers<ToolResponse<TResult>>();
    this.resolve = resolve;
    this.response = new ToolCallResponseReaderImpl<TResult>(promise);
  }

  async appendArgsTextDelta(text: string): Promise<void> {
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

  setResponse(value: ToolResponse<TResult>): void {
    this.resolve(value);
  }

  result = {
    get: async () => {
      const response = await this.response.get();
      return response.result;
    },
  };
}
