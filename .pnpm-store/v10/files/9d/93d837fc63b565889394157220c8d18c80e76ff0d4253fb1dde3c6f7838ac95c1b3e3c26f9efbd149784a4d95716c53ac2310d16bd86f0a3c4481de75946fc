// src/utils/emitAsync.ts
async function emitAsync(emitter, eventName, ...data) {
  const listeners = emitter.listeners(eventName);
  if (listeners.length === 0) {
    return;
  }
  for (const listener of listeners) {
    await listener.apply(emitter, data);
  }
}

// src/utils/hasConfigurableGlobal.ts
function hasConfigurableGlobal(propertyName) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, propertyName);
  if (typeof descriptor === "undefined") {
    return false;
  }
  if (typeof descriptor.get === "function" && typeof descriptor.get() === "undefined") {
    return false;
  }
  if (typeof descriptor.get === "undefined" && descriptor.value == null) {
    return false;
  }
  if (typeof descriptor.set === "undefined" && !descriptor.configurable) {
    console.error(
      `[MSW] Failed to apply interceptor: the global \`${propertyName}\` property is non-configurable. This is likely an issue with your environment. If you are using a framework, please open an issue about this in their repository.`
    );
    return false;
  }
  return true;
}

export {
  emitAsync,
  hasConfigurableGlobal
};
//# sourceMappingURL=chunk-VYSDLBSS.mjs.map