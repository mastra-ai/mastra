// src/logger.ts
var loggedMessages = /* @__PURE__ */ new Set();
var logger = {
  /**
   * A custom logger that ensures messages are logged only once.
   * Reduces noise and duplicated messages when logs are in a hot codepath.
   */
  warnOnce: (msg) => {
    if (loggedMessages.has(msg)) {
      return;
    }
    loggedMessages.add(msg);
    console.warn(msg);
  },
  logOnce: (msg) => {
    if (loggedMessages.has(msg)) {
      return;
    }
    console.log(msg);
    loggedMessages.add(msg);
  }
};

export {
  logger
};
//# sourceMappingURL=chunk-CYDR2ZSA.mjs.map