// src/runtimes/external-store/ThreadMessageConverter.ts
var ThreadMessageConverter = class {
  cache = /* @__PURE__ */ new WeakMap();
  convertMessages(messages, converter) {
    return messages.map((m, idx) => {
      const cached = this.cache.get(m);
      const newMessage = converter(cached, m, idx);
      this.cache.set(m, newMessage);
      return newMessage;
    });
  }
};
export {
  ThreadMessageConverter
};
//# sourceMappingURL=ThreadMessageConverter.js.map