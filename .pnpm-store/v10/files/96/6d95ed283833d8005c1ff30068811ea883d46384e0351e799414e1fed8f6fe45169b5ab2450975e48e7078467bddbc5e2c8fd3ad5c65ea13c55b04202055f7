"use client";

import { type FC, type PropsWithChildren, useEffect, useState } from "react";
import { create } from "zustand";
import { MessageContext } from "../react/MessageContext";
import type { MessageContextValue } from "../react/MessageContext";
import { makeMessageUtilsStore } from "../stores/MessageUtils";
import { writableStore } from "../ReadonlyStore";
import { MessageRuntime } from "../../api/MessageRuntime";
import { ensureBinding } from "../react/utils/ensureBinding";

export namespace MessageRuntimeProvider {
  export type Props = PropsWithChildren<{
    runtime: MessageRuntime;
  }>;
}

const useMessageRuntimeStore = (runtime: MessageRuntime) => {
  const [store] = useState(() => create(() => runtime));

  useEffect(() => {
    ensureBinding(runtime);

    writableStore(store).setState(runtime, true);
  }, [runtime, store]);

  return store;
};

const useMessageUtilsStore = () => {
  const [store] = useState(() => makeMessageUtilsStore());
  return store;
};

export const MessageRuntimeProvider: FC<MessageRuntimeProvider.Props> = ({
  runtime,
  children,
}) => {
  const useMessageRuntime = useMessageRuntimeStore(runtime);
  const useMessageUtils = useMessageUtilsStore();
  const [context] = useState<MessageContextValue>(() => {
    return { useMessageRuntime, useMessageUtils };
  });

  return (
    <MessageContext.Provider value={context}>
      {children}
    </MessageContext.Provider>
  );
};
