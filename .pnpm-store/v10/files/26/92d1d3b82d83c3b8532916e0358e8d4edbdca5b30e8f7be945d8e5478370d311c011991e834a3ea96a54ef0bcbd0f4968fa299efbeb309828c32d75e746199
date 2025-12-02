import { ReadonlyJSONValue, ReadonlyJSONObject } from "../../utils";
import { ObjectStreamOperation } from "./types";

export class ObjectStreamAccumulator {
  private _state: ReadonlyJSONValue;

  constructor(initialValue: ReadonlyJSONValue = null) {
    this._state = initialValue;
  }

  get state() {
    return this._state;
  }

  append(ops: readonly ObjectStreamOperation[]) {
    this._state = ops.reduce(
      (state, op) => ObjectStreamAccumulator.apply(state, op),
      this._state,
    );
  }

  private static apply(state: ReadonlyJSONValue, op: ObjectStreamOperation) {
    const type = op.type;
    switch (type) {
      case "set":
        return ObjectStreamAccumulator.updatePath(
          state,
          op.path,
          () => op.value,
        );
      case "append-text":
        return ObjectStreamAccumulator.updatePath(state, op.path, (current) => {
          if (typeof current !== "string")
            throw new Error(`Expected string at path [${op.path.join(", ")}]`);
          return current + op.value;
        });

      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Invalid operation type: ${_exhaustiveCheck}`);
      }
    }
  }

  private static updatePath(
    state: ReadonlyJSONValue | undefined,
    path: readonly string[],
    updater: (current: ReadonlyJSONValue | undefined) => ReadonlyJSONValue,
  ): ReadonlyJSONValue {
    if (path.length === 0) return updater(state);

    // Initialize state as empty object if it's null and we're trying to set a property
    state ??= {};

    if (typeof state !== "object") {
      throw new Error(`Invalid path: [${path.join(", ")}]`);
    }

    const [key, ...rest] = path as [string, ...(readonly string[])];
    if (Array.isArray(state)) {
      const idx = Number(key);
      if (isNaN(idx))
        throw new Error(`Expected array index at [${path.join(", ")}]`);
      if (idx > state.length || idx < 0)
        throw new Error(`Insert array index out of bounds`);

      const nextState = [...state];
      nextState[idx] = this.updatePath(nextState[idx], rest, updater);

      return nextState;
    }

    const nextState = { ...(state as ReadonlyJSONObject) };
    nextState[key] = this.updatePath(nextState[key], rest, updater);

    return nextState;
  }
}
