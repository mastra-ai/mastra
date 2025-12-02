import {
  deprecated
} from "./chunk-UEY4AZIP.mjs";

// src/localStorageBroadcastChannel.ts
var KEY_PREFIX = "__lsbc__";
var LocalStorageBroadcastChannel = class {
  eventTarget = window;
  channelKey;
  constructor(name) {
    deprecated("LocalStorageBroadcastChannel", "Use the native BroadcastChannel API directly instead.");
    this.channelKey = KEY_PREFIX + name;
    this.setupLocalStorageListener();
  }
  postMessage = (data) => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(this.channelKey, JSON.stringify(data));
      window.localStorage.removeItem(this.channelKey);
    } catch {
    }
  };
  addEventListener = (eventName, listener) => {
    this.eventTarget.addEventListener(this.prefixEventName(eventName), (e) => {
      listener(e);
    });
  };
  setupLocalStorageListener = () => {
    const notifyListeners = (e) => {
      if (e.key !== this.channelKey || !e.newValue) {
        return;
      }
      try {
        const data = JSON.parse(e.newValue || "");
        const event = new MessageEvent(this.prefixEventName("message"), {
          data
        });
        this.eventTarget.dispatchEvent(event);
      } catch {
      }
    };
    window.addEventListener("storage", notifyListeners);
  };
  prefixEventName(eventName) {
    return this.channelKey + eventName;
  }
};

export {
  LocalStorageBroadcastChannel
};
//# sourceMappingURL=chunk-NEMB574L.mjs.map