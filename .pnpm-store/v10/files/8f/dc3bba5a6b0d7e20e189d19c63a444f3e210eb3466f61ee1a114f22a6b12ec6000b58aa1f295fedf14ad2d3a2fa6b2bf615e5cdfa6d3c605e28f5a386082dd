"use client";

import { FC, PropsWithChildren, useEffect, useState } from "react";
import { create, StoreApi, UseBoundStore } from "zustand";
import {
  MessagePartContext,
  MessagePartContextValue,
} from "../react/MessagePartContext";
import { MessagePartStatus } from "../../types/AssistantTypes";
import { writableStore } from "../ReadonlyStore";
import {
  MessagePartRuntimeImpl,
  MessagePartState,
} from "../../api/MessagePartRuntime";
import { ensureBinding } from "../react/utils/ensureBinding";

export namespace TextMessagePartProvider {
  export type Props = PropsWithChildren<{
    text: string;
    isRunning?: boolean | undefined;
  }>;
}

const COMPLETE_STATUS: MessagePartStatus = {
  type: "complete",
};

const RUNNING_STATUS: MessagePartStatus = {
  type: "running",
};

export const TextMessagePartProvider: FC<TextMessagePartProvider.Props> = ({
  children,
  text,
  isRunning,
}) => {
  const [context] = useState<
    MessagePartContextValue & {
      useMessagePart: UseBoundStore<
        StoreApi<MessagePartState & { type: "text" }>
      >;
    }
  >(() => {
    const useMessagePart = create<MessagePartState & { type: "text" }>(() => ({
      status: isRunning ? RUNNING_STATUS : COMPLETE_STATUS,
      type: "text",
      text,
    }));

    const MessagePartRuntime = new MessagePartRuntimeImpl({
      path: {
        ref: "text",
        threadSelector: { type: "main" },
        messageSelector: { type: "messageId", messageId: "" },
        messagePartSelector: { type: "index", index: 0 },
      },
      getState: useMessagePart.getState,
      subscribe: useMessagePart.subscribe,
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
        status: targetStatus,
      } satisfies MessagePartState,
      true,
    );
  }, [context, isRunning, text]);

  return (
    <MessagePartContext.Provider value={context}>
      {children}
    </MessagePartContext.Provider>
  );
};
