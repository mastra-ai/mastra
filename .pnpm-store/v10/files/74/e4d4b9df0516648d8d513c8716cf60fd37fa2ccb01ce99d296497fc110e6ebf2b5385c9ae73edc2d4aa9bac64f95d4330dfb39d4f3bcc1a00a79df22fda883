const e = require("./errors");
const v = require("./validations");

class EventManager {
  static createSafeListener(listener) {
    if (listener === undefined) {
      return undefined;
    }
    if (!v.isFunction(listener)) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidListenerProvided,
        `Provided listener is not of type 'function'`,
      );
    } else {
      return (...params) => {
        try {
          listener(...params);
        } catch (err) {
          console.error(`Error invoking user supplied listener`, err);
        }
      };
    }
  }

  static normalizeListeners(listeners = []) {
    if (!Array.isArray(listeners)) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidListenerProvided,
        `Listeners must be provided as an array of functions`,
      );
    }
    return listeners
      .map((listener) => EventManager.createSafeListener(listener))
      .filter((listener) => {
        switch (typeof listener) {
          case "function":
            return true;
          case "undefined":
            return false;
          default:
            throw new e.ElectroError(
              e.ErrorCodes.InvalidListenerProvided,
              `Provided listener is not of type 'function`,
            );
        }
      });
  }

  constructor({ listeners = [] } = {}) {
    this.listeners = EventManager.normalizeListeners(listeners);
  }

  add(listeners = []) {
    if (!Array.isArray(listeners)) {
      listeners = [listeners];
    }

    this.listeners = this.listeners.concat(
      EventManager.normalizeListeners(listeners),
    );
  }

  trigger(event, adHocListeners = []) {
    const allListeners = [
      ...this.listeners,
      ...EventManager.normalizeListeners(adHocListeners),
    ];

    for (const listener of allListeners) {
      listener(event);
    }
  }
}

module.exports = {
  EventManager,
};
