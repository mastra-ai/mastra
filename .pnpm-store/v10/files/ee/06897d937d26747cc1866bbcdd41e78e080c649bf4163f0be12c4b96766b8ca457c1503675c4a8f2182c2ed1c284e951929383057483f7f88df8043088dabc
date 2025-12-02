"use client";

import { type FC, type PropsWithChildren, useEffect, useState } from "react";
import { create } from "zustand";
import { MessagePartContext } from "../react/MessagePartContext";
import type { MessagePartContextValue } from "../react/MessagePartContext";
import { writableStore } from "../ReadonlyStore";
import { MessagePartRuntime } from "../../api/MessagePartRuntime";
import { ensureBinding } from "../react/utils/ensureBinding";

export namespace MessagePartRuntimeProvider {
  export type Props = PropsWithChildren<{
    runtime: MessagePartRuntime;
  }>;
}

const useMessagePartRuntimeStore = (runtime: MessagePartRuntime) => {
  const [store] = useState(() => create(() => runtime));

  useEffect(() => {
    ensureBinding(runtime);

    writableStore(store).setState(runtime, true);
  }, [runtime, store]);

  return store;
};

export const MessagePartRuntimeProvider: FC<
  MessagePartRuntimeProvider.Props
> = ({ runtime, children }) => {
  const useMessagePartRuntime = useMessagePartRuntimeStore(runtime);
  const [context] = useState<MessagePartContextValue>(() => {
    return { useMessagePartRuntime };
  });

  return (
    <MessagePartContext.Provider value={context}>
      {children}
    </MessagePartContext.Provider>
  );
};
