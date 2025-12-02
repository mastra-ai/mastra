"use client";

// src/context/providers/TextMessagePartProvider.tsx
import { useEffect, useState } from "react";
import { create } from "zustand";
import {
  MessagePartContext
} from "../react/MessagePartContext.js";
import { writableStore } from "../ReadonlyStore.js";
import {
  MessagePartRuntimeImpl
} from "../../api/MessagePartRuntime.js";
import { ensureBinding } from "../react/utils/ensureBinding.js";
import { jsx } from "react/jsx-runtime";
var COMPLETE_STATUS = {
  type: "complete"
};
var RUNNING_STATUS = {
  type: "running"
};
var TextMessagePartProvider = ({
  children,
  text,
  isRunning
}) => {
  const [context] = useState(() => {
    const useMessagePart = create(() => ({
      status: isRunning ? RUNNING_STATUS : COMPLETE_STATUS,
      type: "text",
      text
    }));
    const MessagePartRuntime = new MessagePartRuntimeImpl({
      path: {
        ref: "text",
        threadSelector: { type: "main" },
        messageSelector: { type: "messageId", messageId: "" },
        messagePartSelector: { type: "index", index: 0 }
      },
      getState: useMessagePart.getState,
      subscribe: useMessagePart.subscribe
    });
    ensureBinding(MessagePartRuntime);
    const useMessagePartRuntime = create(() => MessagePartRuntime);
    return { useMessagePartRuntime, useMessagePart };
  });
  useEffect(() => {
    const state = context.useMessagePart.getState();
    const textUpdated = state.text !== text;
    const targetStatus = isRunning ? RUNNING_STATUS : COMPLETE_STATUS;
    const statusUpdated = state.status !== targetStatus;
    if (!textUpdated && !statusUpdated) return;
    writableStore(context.useMessagePart).setState(
      {
        type: "text",
        text,
        status: targetStatus
      },
      true
    );
  }, [context, isRunning, text]);
  return /* @__PURE__ */ jsx(MessagePartContext.Provider, { value: context, children });
};
export {
  TextMessagePartProvider
};
//# sourceMappingURL=TextMessagePartProvider.js.map