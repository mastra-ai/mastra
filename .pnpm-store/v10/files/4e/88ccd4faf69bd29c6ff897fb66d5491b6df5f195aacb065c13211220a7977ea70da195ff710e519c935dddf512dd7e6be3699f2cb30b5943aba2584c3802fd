// src/core/object/ObjectStreamAccumulator.ts
var ObjectStreamAccumulator = class _ObjectStreamAccumulator {
  _state;
  constructor(initialValue = null) {
    this._state = initialValue;
  }
  get state() {
    return this._state;
  }
  append(ops) {
    this._state = ops.reduce(
      (state, op) => _ObjectStreamAccumulator.apply(state, op),
      this._state
    );
  }
  static apply(state, op) {
    const type = op.type;
    switch (type) {
      case "set":
        return _ObjectStreamAccumulator.updatePath(
          state,
          op.path,
          () => op.value
        );
      case "append-text":
        return _ObjectStreamAccumulator.updatePath(state, op.path, (current) => {
          if (typeof current !== "string")
            throw new Error(`Expected string at path [${op.path.join(", ")}]`);
          return current + op.value;
        });
      default: {
        const _exhaustiveCheck = type;
        throw new Error(`Invalid operation type: ${_exhaustiveCheck}`);
      }
    }
  }
  static updatePath(state, path, updater) {
    if (path.length === 0) return updater(state);
    state ??= {};
    if (typeof state !== "object") {
      throw new Error(`Invalid path: [${path.join(", ")}]`);
    }
    const [key, ...rest] = path;
    if (Array.isArray(state)) {
      const idx = Number(key);
      if (isNaN(idx))
        throw new Error(`Expected array index at [${path.join(", ")}]`);
      if (idx > state.length || idx < 0)
        throw new Error(`Insert array index out of bounds`);
      const nextState2 = [...state];
      nextState2[idx] = this.updatePath(nextState2[idx], rest, updater);
      return nextState2;
    }
    const nextState = { ...state };
    nextState[key] = this.updatePath(nextState[key], rest, updater);
    return nextState;
  }
};
export {
  ObjectStreamAccumulator
};
//# sourceMappingURL=ObjectStreamAccumulator.js.map