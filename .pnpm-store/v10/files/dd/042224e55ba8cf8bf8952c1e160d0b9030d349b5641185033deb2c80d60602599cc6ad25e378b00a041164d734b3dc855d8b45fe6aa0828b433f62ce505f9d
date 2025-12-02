// src/runtimes/remote-thread-list/BaseSubscribable.tsx
var BaseSubscribable = class {
  _subscribers = /* @__PURE__ */ new Set();
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }
  waitForUpdate() {
    return new Promise((resolve) => {
      const unsubscribe = this.subscribe(() => {
        unsubscribe();
        resolve();
      });
    });
  }
  _notifySubscribers() {
    const errors = [];
    for (const callback of this._subscribers) {
      try {
        callback();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      if (errors.length === 1) {
        throw errors[0];
      } else {
        throw new AggregateError(errors);
      }
    }
  }
};
export {
  BaseSubscribable
};
//# sourceMappingURL=BaseSubscribable.js.map