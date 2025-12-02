"use client";

// src/model-context/makeAssistantVisible.tsx
import {
  useEffect,
  useRef,
  forwardRef,
  useId,
  createContext,
  useContext
} from "react";
import { z } from "zod";
import { useAssistantRuntime } from "../context/index.js";
import { useComposedRefs } from "@radix-ui/react-compose-refs";
import { tool } from "./tool.js";
import { jsx } from "react/jsx-runtime";
var click = tool({
  parameters: z.object({
    clickId: z.string()
  }),
  execute: async ({ clickId }) => {
    const escapedClickId = CSS.escape(clickId);
    const el = document.querySelector(`[data-click-id='${escapedClickId}']`);
    if (el instanceof HTMLElement) {
      el.click();
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      return {};
    } else {
      return "Element not found";
    }
  }
});
var edit = tool({
  parameters: z.object({
    editId: z.string(),
    value: z.string()
  }),
  execute: async ({ editId, value }) => {
    const escapedEditId = CSS.escape(editId);
    const el = document.querySelector(`[data-edit-id='${escapedEditId}']`);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      return {};
    } else {
      return "Element not found";
    }
  }
});
var ReadableContext = createContext(false);
var makeAssistantVisible = (Component, config) => {
  const ReadableComponent = forwardRef(
    (props, outerRef) => {
      const isNestedReadable = useContext(ReadableContext);
      const clickId = useId();
      const componentRef = useRef(null);
      const assistant = useAssistantRuntime();
      const { clickable, editable } = config ?? {};
      useEffect(() => {
        return assistant.registerModelContextProvider({
          getModelContext: () => {
            return {
              tools: {
                ...clickable ? { click } : {},
                ...editable ? { edit } : {}
              },
              system: !isNestedReadable ? componentRef.current?.outerHTML : void 0
            };
          }
        });
      }, [isNestedReadable, assistant, clickable, editable]);
      const ref = useComposedRefs(componentRef, outerRef);
      return /* @__PURE__ */ jsx(ReadableContext.Provider, { value: true, children: /* @__PURE__ */ jsx(
        Component,
        {
          ...props,
          ...config?.clickable ? { "data-click-id": clickId } : {},
          ...config?.editable ? { "data-edit-id": clickId } : {},
          ref
        }
      ) });
    }
  );
  ReadableComponent.displayName = Component.displayName;
  return ReadableComponent;
};
var makeAssistantVisible_default = makeAssistantVisible;
export {
  makeAssistantVisible_default as default,
  makeAssistantVisible
};
//# sourceMappingURL=makeAssistantVisible.js.map