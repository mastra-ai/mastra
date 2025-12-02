// src/context/stores/AssistantToolUIs.ts
import { create } from "zustand";
var makeAssistantToolUIsStore = () => create((set) => {
  const renderers = /* @__PURE__ */ new Map();
  return Object.freeze({
    getToolUI: (name) => {
      const arr = renderers.get(name);
      const last = arr?.at(-1);
      if (last) return last;
      return null;
    },
    setToolUI: (name, render) => {
      let arr = renderers.get(name);
      if (!arr) {
        arr = [];
        renderers.set(name, arr);
      }
      arr.push(render);
      set({});
      return () => {
        const index = arr.indexOf(render);
        if (index !== -1) {
          arr.splice(index, 1);
        }
        if (index === arr.length) {
          set({});
        }
      };
    }
  });
});
export {
  makeAssistantToolUIsStore
};
//# sourceMappingURL=AssistantToolUIs.js.map