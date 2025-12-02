// src/runtimes/remote-thread-list/OptimisticState.ts
import { BaseSubscribable } from "./BaseSubscribable.js";
var pipeTransforms = (initialState, extraParam, transforms) => {
  return transforms.reduce((state, transform) => {
    return transform?.(state, extraParam) ?? state;
  }, initialState);
};
var OptimisticState = class extends BaseSubscribable {
  _pendingTransforms = [];
  _baseValue;
  _cachedValue;
  constructor(initialState) {
    super();
    this._baseValue = initialState;
    this._cachedValue = initialState;
  }
  _updateState() {
    this._cachedValue = this._pendingTransforms.reduce((state, transform) => {
      return pipeTransforms(state, transform.task, [
        transform.loading,
        transform.optimistic
      ]);
    }, this._baseValue);
    this._notifySubscribers();
  }
  get baseValue() {
    return this._baseValue;
  }
  get value() {
    return this._cachedValue;
  }
  update(state) {
    this._baseValue = state;
    this._updateState();
  }
  async optimisticUpdate(transform) {
    const task = transform.execute();
    const pendingTransform = { ...transform, task };
    try {
      this._pendingTransforms.push(pendingTransform);
      this._updateState();
      const result = await task;
      this._baseValue = pipeTransforms(this._baseValue, result, [
        transform.optimistic,
        transform.then
      ]);
      return result;
    } finally {
      const index = this._pendingTransforms.indexOf(pendingTransform);
      if (index > -1) {
        this._pendingTransforms.splice(index, 1);
      }
      this._updateState();
    }
  }
};
export {
  OptimisticState
};
//# sourceMappingURL=OptimisticState.js.map