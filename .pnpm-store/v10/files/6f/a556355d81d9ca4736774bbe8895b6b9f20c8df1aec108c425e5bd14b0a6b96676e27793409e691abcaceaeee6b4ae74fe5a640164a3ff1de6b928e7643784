// src/eventBus.ts
var _on = (eventToHandlersMap, latestPayloadMap, event, handler, opts) => {
  const { notify } = opts || {};
  let handlers = eventToHandlersMap.get(event);
  if (!handlers) {
    handlers = [];
    eventToHandlersMap.set(event, handlers);
  }
  handlers.push(handler);
  if (notify && latestPayloadMap.has(event)) {
    handler(latestPayloadMap.get(event));
  }
};
var _dispatch = (eventToHandlersMap, event, payload) => (eventToHandlersMap.get(event) || []).map((h) => h(payload));
var _off = (eventToHandlersMap, event, handler) => {
  const handlers = eventToHandlersMap.get(event);
  if (handlers) {
    if (handler) {
      handlers.splice(handlers.indexOf(handler) >>> 0, 1);
    } else {
      eventToHandlersMap.set(event, []);
    }
  }
};
var createEventBus = () => {
  const eventToHandlersMap = /* @__PURE__ */ new Map();
  const latestPayloadMap = /* @__PURE__ */ new Map();
  const eventToPredispatchHandlersMap = /* @__PURE__ */ new Map();
  const emit = (event, payload) => {
    latestPayloadMap.set(event, payload);
    _dispatch(eventToPredispatchHandlersMap, event, payload);
    _dispatch(eventToHandlersMap, event, payload);
  };
  return {
    // Subscribe to an event
    on: (...args) => _on(eventToHandlersMap, latestPayloadMap, ...args),
    // Subscribe to an event with priority
    // Registered handlers with `prioritizedOn` will be called before handlers registered with `on`
    prioritizedOn: (...args) => _on(eventToPredispatchHandlersMap, latestPayloadMap, ...args),
    // Dispatch an event
    emit,
    // Unsubscribe from an event
    off: (...args) => _off(eventToHandlersMap, ...args),
    // Unsubscribe from an event with priority
    // Unsubscribes handlers only registered with `prioritizedOn`
    prioritizedOff: (...args) => _off(eventToPredispatchHandlersMap, ...args),
    // Internal utilities
    internal: {
      retrieveListeners: (event) => eventToHandlersMap.get(event) || []
    }
  };
};

export {
  createEventBus
};
//# sourceMappingURL=chunk-GVKBGR5N.mjs.map