// src/runtimes/adapters/speech/WebSpeechSynthesisAdapter.ts
var WebSpeechSynthesisAdapter = class {
  speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    const subscribers = /* @__PURE__ */ new Set();
    const handleEnd = (reason, error) => {
      if (res.status.type === "ended") return;
      res.status = { type: "ended", reason, error };
      subscribers.forEach((handler) => handler());
    };
    utterance.addEventListener("end", () => handleEnd("finished"));
    utterance.addEventListener("error", (e) => handleEnd("error", e.error));
    window.speechSynthesis.speak(utterance);
    const res = {
      status: { type: "running" },
      cancel: () => {
        window.speechSynthesis.cancel();
        handleEnd("cancelled");
      },
      subscribe: (callback) => {
        if (res.status.type === "ended") {
          let cancelled = false;
          queueMicrotask(() => {
            if (!cancelled) callback();
          });
          return () => {
            cancelled = true;
          };
        } else {
          subscribers.add(callback);
          return () => {
            subscribers.delete(callback);
          };
        }
      }
    };
    return res;
  }
};
export {
  WebSpeechSynthesisAdapter
};
//# sourceMappingURL=WebSpeechSynthesisAdapter.js.map