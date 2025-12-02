// src/hooks/mitt.ts
function mitt(all) {
  all = all || /* @__PURE__ */ new Map();
  return {
    /**
     * A Map of event names to registered handler functions.
     */
    all,
    /**
     * Register an event handler for the given type.
     * @param {string|symbol} type Type of event to listen for, or `'*'` for all events
     * @param {Function} handler Function to call in response to given event
     * @memberOf mitt
     */
    on(type, handler) {
      const handlers = all.get(type);
      if (handlers) {
        handlers.push(handler);
      } else {
        all.set(type, [handler]);
      }
    },
    /**
     * Remove an event handler for the given type.
     * If `handler` is omitted, all handlers of the given type are removed.
     * @param {string|symbol} type Type of event to unregister `handler` from (`'*'` to remove a wildcard handler)
     * @param {Function} [handler] Handler function to remove
     * @memberOf mitt
     */
    off(type, handler) {
      const handlers = all.get(type);
      if (handlers) {
        if (handler) {
          handlers.splice(handlers.indexOf(handler) >>> 0, 1);
        } else {
          all.set(type, []);
        }
      }
    },
    /**
     * Invoke all handlers for the given type.
     * If present, `'*'` handlers are invoked after type-matched handlers.
     *
     * Note: Manually firing '*' handlers is not supported.
     *
     * @param {string|symbol} type The event type to invoke
     * @param {Any} [evt] Any value (object is recommended and powerful), passed to each handler
     * @memberOf mitt
     */
    emit(type, evt) {
      let handlers = all.get(type);
      if (handlers) {
        handlers.slice().map((handler) => {
          handler(evt);
        });
      }
      handlers = all.get("*");
      if (handlers) {
        handlers.slice().map((handler) => {
          handler(type, evt);
        });
      }
    }
  };
}

// src/hooks/index.ts
var AvailableHooks = /* @__PURE__ */ ((AvailableHooks2) => {
  AvailableHooks2["ON_EVALUATION"] = "onEvaluation";
  AvailableHooks2["ON_GENERATION"] = "onGeneration";
  AvailableHooks2["ON_SCORER_RUN"] = "onScorerRun";
  return AvailableHooks2;
})(AvailableHooks || {});
var hooks = mitt();
function registerHook(hook, action) {
  hooks.on(hook, action);
}
function executeHook(hook, data) {
  setImmediate(() => {
    hooks.emit(hook, data);
  });
}

export { AvailableHooks, executeHook, registerHook };
//# sourceMappingURL=chunk-L54GIUCB.js.map
//# sourceMappingURL=chunk-L54GIUCB.js.map